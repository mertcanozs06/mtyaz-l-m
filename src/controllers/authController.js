// controllers/authController.js
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { poolPromise, sql } from "../config/db.js";
import { calculateTotal } from "../utils/priceCalculator.js";

export const register = async (req, res) => {
  const pool = await poolPromise;
  const trx = pool.transaction();
  try {
    await trx.begin();
    const {
      name, email, password, phone, address, restaurantName,
      package_type = "basic", branch_count = 1
    } = req.body;

    if (!name || !email || !password || !restaurantName) {
      await trx.rollback();
      return res.status(400).json({ message: "Eksik bilgi." });
    }

    const emailCheck = await trx.request().input("email", sql.NVarChar, email)
      .query("SELECT id FROM Users WHERE email = @email");
    if (emailCheck.recordset.length > 0) {
      await trx.rollback();
      return res.status(409).json({ message: "Bu e-posta zaten kayıtlı." });
    }

    const { monthly: monthlyPrice, branches: totalBranches } = calculateTotal(package_type, branch_count);
    const totalPrice = monthlyPrice * 12;
    const pricePerBranch = totalBranches ? (monthlyPrice / totalBranches).toFixed(2) : monthlyPrice;

    let formattedPhone = (phone || "").replace(/\D/g, "");
    if (formattedPhone.startsWith("90") && formattedPhone.length === 12) formattedPhone = "+" + formattedPhone;
    else if (formattedPhone.startsWith("0") && formattedPhone.length === 11) formattedPhone = "+90" + formattedPhone.slice(1);
    else if (formattedPhone.length === 10) formattedPhone = "+90" + formattedPhone;
    else formattedPhone = "+905555555555";

    // 1. Restoran
    const restaurantResult = await trx.request()
      .input("name", sql.NVarChar, restaurantName)
      .input("address", sql.NVarChar, address || "")
      .query("INSERT INTO Restaurants (name, address, is_active) OUTPUT INSERTED.id VALUES (@name, @address, 0)");
    const restaurant_id = restaurantResult.recordset[0].id;

    // 2. Merkez Şube
    const branchResult = await trx.request()
      .input("restaurant_id", sql.Int, restaurant_id)
      .input("address", sql.NVarChar, address || "")
      .input("phone", sql.NVarChar, phone || "")
      .input("country", sql.NVarChar, "Türkiye")
      .input("city", sql.NVarChar, "İstanbul")
      .query("INSERT INTO Branches (restaurant_id, name, address, phone, country, city, is_active) OUTPUT INSERTED.id VALUES (@restaurant_id, 'Merkez Şube', @address, @phone, @country, @city, 0)");
    const branch_id = branchResult.recordset[0].id;

    // 3. Kullanıcı (Admin)
    const hashedPassword = await bcrypt.hash(password, 10);
    const userResult = await trx.request()
      .input("restaurant_id", sql.Int, restaurant_id)
      .input("branch_id", sql.Int, branch_id)
      .input("name", sql.NVarChar, name)
      .input("email", sql.NVarChar, email)
      .input("password", sql.NVarChar, hashedPassword)
      .input("phone", sql.NVarChar, phone || "")
      .input("package_type", sql.NVarChar, package_type)
      .input("branch_count", sql.Int, totalBranches)
      .query(`
        INSERT INTO Users (restaurant_id, branch_id, name, email, password, phone, role, package_type, is_active, is_initial_admin, createdAt, updatedAt, created_by, branch_count)
        OUTPUT INSERTED.id
        VALUES (@restaurant_id, @branch_id, @name, @email, @password, @phone, 'admin', @package_type, 0, 1, GETDATE(), GETDATE(), NULL, @branch_count)
      `);
    const user_id = userResult.recordset[0].id;

    // 4. UserPackages (Trial)
    await trx.request()
      .input("user_id", sql.Int, user_id)
      .input("package_type", sql.NVarChar, package_type)
      .input("max_branches", sql.Int, totalBranches)
      .input("price_per_branch", sql.Decimal(18, 2), pricePerBranch)
      .input("total_price", sql.Decimal(18, 2), totalPrice)
      .input("trial_start_date", sql.DateTime, new Date())
      .input("trial_end_date", sql.DateTime, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
      .input("is_trial_active", sql.Bit, 1)
      .query(`
        INSERT INTO UserPackages (user_id, package_type, max_branches, price_per_branch, total_price, trial_start_date, trial_end_date, is_trial_active, created_at)
        VALUES (@user_id, @package_type, @max_branches, @price_per_branch, @total_price, @trial_start_date, @trial_end_date, @is_trial_active, GETDATE())
      `);

    // 5. Iyzico Ödeme
    const { createIyzicoPayment } = await import("../services/iyzicoService.js");
    const conversationId = `reg_${user_id}_${Date.now()}`;
    const basketItems = [{
      id: String(user_id),
      name: `${package_type.toUpperCase()} Paketi (${totalBranches} şube)`,
      category1: "Abonelik",
      itemType: "VIRTUAL",
      price: totalPrice.toFixed(2),
    }];
    const callbackUrl = `${process.env.BASE_URL || "http://localhost:5000"}/api/subscription/callback`;

    const iyzicoResponse = await createIyzicoPayment({
      conversationId, price: totalPrice, paidPrice: totalPrice,
      user: { id: user_id, name, email, phone: formattedPhone },
      basketItems, callbackUrl
    });

    // 6. Payments kaydı (customer_order_id = NULL)
    if (iyzicoResponse.success) {
      await trx.request()
        .input("customer_order_id", sql.Int, null)
        .input("user_id", sql.Int, user_id)
        .input("amount", sql.Decimal(18, 2), totalPrice)
        .input("payment_method", sql.NVarChar, "iyzico")
        .input("status", sql.NVarChar, "pending")
        .input("iyzico_token", sql.NVarChar, iyzicoResponse.token)
        .input("payment_url", sql.NVarChar, iyzicoResponse.paymentPageUrl)
        .input("package_type", sql.NVarChar, package_type)
        .input("branch_count", sql.Int, totalBranches)
        .input("branch_id", sql.Int, branch_id)
        .input("transaction_id", sql.NVarChar, iyzicoResponse.paymentId || `TRX-${user_id}-${Date.now()}`)
        .input("subscription_status", sql.NVarChar, "pending")
        .input("created_at", sql.DateTime, new Date())
        .query(`
          INSERT INTO Payments (customer_order_id, user_id, amount, payment_method, status, iyzico_token, payment_url, package_type, branch_count, branch_id, transaction_id, subscription_status, created_at)
          VALUES (@customer_order_id, @user_id, @amount, @payment_method, @status, @iyzico_token, @payment_url, @package_type, @branch_count, @branch_id, @transaction_id, @subscription_status, @created_at)
        `);
    }

    const token = jwt.sign(
      { user_id, email, restaurant_id, branch_id, role: "admin" },
      process.env.JWT_SECRET || "your_jwt_secret",
      { expiresIn: "8h" }
    );

    // UserAuditLog'a kayıt logu ekle
    await trx.request()
      .input("user_id", sql.Int, user_id)
      .input("action", sql.NVarChar, "USER_REGISTERED")
      .input("target_user_id", sql.Int, user_id)
      .input("restaurant_id", sql.Int, restaurant_id)
      .input("branch_id", sql.Int, branch_id)
      .input("created_at", sql.DateTime, new Date())
      .query(`
        INSERT INTO UserAuditLog (user_id, action, target_user_id, restaurant_id, branch_id, created_at)
        VALUES (@user_id, @action, @target_user_id, @restaurant_id, @branch_id, @created_at)
      `);

    await trx.commit();
    return res.status(201).json({
      message: "Kayıt başarılı.",
      token, user_id, restaurant_id, branch_id, package_type, totalBranches, totalPrice,
      paymentPageUrl: iyzicoResponse.success ? iyzicoResponse.paymentPageUrl : null
    });
  } catch (err) {
    await trx.rollback();
    console.error("Register Error:", err);
    return res.status(500).json({ message: "Kayıt başarısız.", error: err.message });
  }
};
/**
 * 🔑 LOGIN — Email + Şifre kontrolü → JWT döner
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Eksik bilgi gönderildi." });

    const pool = await poolPromise;
    const userResult = await pool
      .request()
      .input("email", sql.NVarChar, email)
      .query(`SELECT TOP 1 * FROM Users WHERE email = @email`);

    const user = userResult.recordset[0];
    if (!user)
      return res.status(401).json({ message: "E-posta veya şifre hatalı." });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ message: "E-posta veya şifre hatalı." });

    // 🎟️ Paket durumu kontrolü
    const packageResult = await pool
      .request()
      .input("user_id", sql.Int, user.id)
      .query(`SELECT TOP 1 * FROM UserPackages WHERE user_id = @user_id ORDER BY created_at DESC`);

    const userPackage = packageResult.recordset[0];
    if (!userPackage || (!user.is_active && !userPackage.is_trial_active)) {
      return res.status(403).json({ message: "Hesabınız aktif değil. Ödeme yapmanız gerekiyor." });
    }

    // 👥 Şube kontrolü
    const branchesResult = await pool
      .request()
      .input("restaurant_id", sql.Int, user.restaurant_id)
      .query(`SELECT id, name FROM Branches WHERE restaurant_id = @restaurant_id`);

    const branches = branchesResult.recordset;
    if (!branches || branches.length === 0) {
      return res.status(404).json({ message: "Bu restorana ait şube bulunamadı." });
    }

    // 🔐 Token oluştur
    const token = jwt.sign(
      {
        user_id: user.id,
        email: user.email,
        restaurant_id: user.restaurant_id,
        branch_id: user.branch_id,
        role: user.role,
      },
      process.env.JWT_SECRET || "your_jwt_secret",
      { expiresIn: "8h" }
    );

    // last_login_at güncelle
    await pool.request()
      .input("user_id", sql.Int, user.id)
      .query("UPDATE Users SET last_login_at = GETDATE() WHERE id = @user_id");

    console.log(`✅ Kullanıcı girişi: ${email}`);

    return res.json({
      message: "Giriş başarılı.",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        restaurant_id: user.restaurant_id,
        branch_id: user.branch_id,
        package_type: user.package_type || "basic",
      },
      branches,
      package: userPackage ? {
        type: userPackage.package_type,
        status: user.is_active ? "active" : (userPackage.is_trial_active ? "trial" : "inactive"),
        trial_end_date: userPackage.trial_end_date,
      } : null,
    });
  } catch (err) {
    console.error("❌ Login Error:", err);
    return res
      .status(500)
      .json({ message: "Sunucu hatası.", error: err.message });
  }
};
