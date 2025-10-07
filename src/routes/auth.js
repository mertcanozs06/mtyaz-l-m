import express from "express";
import { poolPromise, sql } from "../config/db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

/* -------------------------------------------------------
   🔧 Yardımcı Fonksiyonlar
------------------------------------------------------- */
const executeQuery = async (query, inputs, transaction = null) => {
  const request = transaction
    ? transaction.request()
    : (await poolPromise).request();
  Object.entries(inputs).forEach(([key, value]) => {
    request.input(key, value);
  });
  return request.query(query);
};

const logAuditAction = async (
  userId,
  action,
  targetUserId,
  restaurantId,
  branchId,
  transaction = null
) => {
  try {
    await executeQuery(
      `INSERT INTO UserAuditLog (user_id, action, target_user_id, created_at)
       VALUES (@userId, @action, @targetUserId, GETDATE())`,
      { userId: userId || null, action, targetUserId: targetUserId || null },
      transaction
    );
  } catch (err) {
    console.error("Audit log kaydı başarısız:", err);
  }
};

/* -------------------------------------------------------
   🧩 REGISTER – Paket seçimi + fiyatlandırma + 30 gün deneme
------------------------------------------------------- */
router.post("/register", async (req, res) => {
  const transaction = (await poolPromise).transaction();

  try {
    await transaction.begin();

    const {
      restaurantName,
      email,
      password,
      name,
      phone,
      address,
      package_type,
      branch_count,
    } = req.body;

    // 1️⃣ Paket doğrulama
    if (!package_type || !["basic", "advance", "elevate"].includes(package_type)) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ message: "Geçersiz paket tipi", error_code: "INVALID_PACKAGE" });
    }

    // 2️⃣ Email kontrolü
    const emailCheck = await executeQuery(
      `SELECT id FROM Users WHERE email = @email`,
      { email },
      transaction
    );
    if (emailCheck.recordset.length > 0) {
      await transaction.rollback();
      return res.status(409).json({
        message: "Bu email adresi zaten kullanımda",
        error_code: "DUPLICATE_EMAIL",
      });
    }

    // 3️⃣ Paket fiyatları (KDV dahil)
    const PACKAGE_PRICES = {
      basic: 360,
      advance: 720,
      elevate: 1200,
    };

    let total_branches = 1;
    let price_per_branch = PACKAGE_PRICES[package_type];
    let total_price = price_per_branch;

    if (package_type !== "basic") {
      if (!branch_count || isNaN(branch_count) || branch_count < 1) {
        await transaction.rollback();
        return res.status(400).json({
          message: "Geçersiz şube sayısı",
          error_code: "INVALID_BRANCH_COUNT",
        });
      }
      total_branches = branch_count;
      total_price = price_per_branch * total_branches;
    }

    // 4️⃣ Restoran oluştur
    const restaurantResult = await executeQuery(
      `INSERT INTO Restaurants (name, address)
       OUTPUT INSERTED.id
       VALUES (@name, @address)`,
      { name: restaurantName, address },
      transaction
    );
    const restaurant_id = restaurantResult.recordset[0].id;

    // 5️⃣ Kullanıcı oluştur
    const hashedPassword = await bcrypt.hash(password, 10);
    const userResult = await executeQuery(
      `INSERT INTO Users (restaurant_id, email, password, role, name, phone, package_type, is_initial_admin, is_active)
       OUTPUT INSERTED.id
       VALUES (@restaurant_id, @email, @password, 'admin', @name, @phone, @package_type, 1, 1)`,
      {
        restaurant_id,
        email,
        password: hashedPassword,
        name,
        phone,
        package_type,
      },
      transaction
    );
    const user_id = userResult.recordset[0].id;

    // 6️⃣ Varsayılan şube oluştur
    const branchResult = await executeQuery(
      `INSERT INTO Branches (restaurant_id, name, country, city, address, phone)
       OUTPUT INSERTED.id, INSERTED.name
       VALUES (@restaurant_id, 'Varsayılan Şube', 'Türkiye', 'Varsayılan Şehir', @address, @phone)`,
      { restaurant_id, address, phone },
      transaction
    );
    const branch = branchResult.recordset[0];

    // 7️⃣ Kullanıcı paketi oluştur (30 gün deneme)
    await executeQuery(
      `INSERT INTO UserPackages 
        (user_id, package_type, max_branches, price_per_branch, total_price, created_at, trial_start_date, trial_end_date, is_trial_active)
       VALUES 
        (@user_id, @package_type, @max_branches, @price_per_branch, @total_price, GETDATE(), GETDATE(), DATEADD(DAY, 30, GETDATE()), 1)`,
      {
        user_id,
        package_type,
        max_branches: total_branches,
        price_per_branch,
        total_price,
      },
      transaction
    );

    // 8️⃣ Kullanıcıya şube ID ata
    await executeQuery(
      `UPDATE Users SET branch_id = @branch_id WHERE id = @user_id`,
      { branch_id: branch.id, user_id },
      transaction
    );

    // 9️⃣ Audit log
    await logAuditAction(
      user_id,
      "USER_REGISTERED",
      null,
      restaurant_id,
      branch.id,
      transaction
    );

    // 🔟 JWT token oluştur
    const token = jwt.sign(
      {
        user_id,
        email,
        role: "admin",
        restaurant_id,
        branch_id: branch.id,
        is_initial_admin: 1,
        package_type,
      },
      process.env.JWT_SECRET || "your_jwt_secret",
      { expiresIn: "8h" }
    );

    // 🔔 Socket bildirimi
    req.io?.to(`admin_${restaurant_id}_${branch.id}`).emit("user-action-logged", {
      action: "USER_REGISTERED",
      target_user_id: user_id,
      package_type,
      total_branches,
      total_price,
      is_trial_active: true,
    });

    await transaction.commit();

    res.status(201).json({
      token,
      restaurant_id,
      branches: [branch],
      package_type,
      total_branches,
      price_per_branch,
      total_price,
      trial: {
        active: true,
        start_date: new Date(),
        end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
  } catch (err) {
    await transaction.rollback();
    console.error("Registration Error:", err);
    res.status(500).json({
      message: "Kayıt başarısız",
      error_code: "SERVER_ERROR",
      error: err.message,
    });
  }
});

/* -------------------------------------------------------
   🔐 LOGIN
------------------------------------------------------- */
router.post("/login", async (req, res) => {
  const transaction = (await poolPromise).transaction();
  try {
    await transaction.begin();

    const { email, password } = req.body;

    const userResult = await executeQuery(
      `SELECT 
        u.id, u.email, u.password, u.role, u.restaurant_id, u.branch_id, 
        u.is_initial_admin, u.package_type, u.is_active,
        up.max_branches, up.price_per_branch, up.total_price, 
        up.is_trial_active, up.trial_end_date
       FROM Users u
       LEFT JOIN UserPackages up ON u.id = up.user_id
       WHERE u.email = @email`,
      { email },
      transaction
    );

    const user = userResult.recordset[0];
    if (!user) {
      await logAuditAction(
        null,
        "LOGIN_FAILED_INVALID_EMAIL",
        null,
        null,
        null,
        transaction
      );
      await transaction.commit();
      return res
        .status(401)
        .json({ message: "Geçersiz kimlik bilgileri", error_code: "INVALID_CREDENTIALS" });
    }

    if (!user.is_active) {
      await logAuditAction(
        user.id,
        "LOGIN_FAILED_INACTIVE",
        null,
        user.restaurant_id,
        user.branch_id,
        transaction
      );
      await transaction.commit();
      return res
        .status(403)
        .json({ message: "Kullanıcı hesabı aktif değil", error_code: "INACTIVE_USER" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      await logAuditAction(
        user.id,
        "LOGIN_FAILED_WRONG_PASSWORD",
        null,
        user.restaurant_id,
        user.branch_id,
        transaction
      );
      await transaction.commit();
      return res
        .status(401)
        .json({ message: "Geçersiz şifre", error_code: "INVALID_PASSWORD" });
    }

    const branchesResult = await executeQuery(
      `SELECT id, name, country, city 
       FROM Branches WHERE restaurant_id = @restaurant_id`,
      { restaurant_id: user.restaurant_id },
      transaction
    );

    await logAuditAction(
      user.id,
      "LOGIN_SUCCESS",
      null,
      user.restaurant_id,
      user.branch_id,
      transaction
    );

    const token = jwt.sign(
      {
        user_id: user.id,
        email: user.email,
        role: user.role,
        restaurant_id: user.restaurant_id,
        branch_id: user.branch_id,
        is_initial_admin: user.is_initial_admin,
        package_type: user.package_type,
      },
      process.env.JWT_SECRET || "your_jwt_secret",
      { expiresIn: "8h" }
    );

    req.io?.to(`admin_${user.restaurant_id}_${user.branch_id}`).emit("user-action-logged", {
      action: "LOGIN_SUCCESS",
      target_user_id: user.id,
    });

    await transaction.commit();

    res.json({
      token,
      restaurant_id: user.restaurant_id,
      branches: branchesResult.recordset,
      package_type: user.package_type,
      max_branches: user.max_branches,
      price_per_branch: user.price_per_branch,
      total_price: user.total_price,
      trial_active: user.is_trial_active,
      trial_end_date: user.trial_end_date,
    });
  } catch (err) {
    await transaction.rollback();
    console.error("Login Error:", err);
    res.status(500).json({
      message: "Giriş başarısız",
      error_code: "SERVER_ERROR",
      error: err.message,
    });
  }
});

export default router;
