import express from "express";
import { poolPromise, sql } from "../config/db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

/* -------------------------------------------------------
   🔧 Yardımcı Fonksiyonlar
------------------------------------------------------- */
const logAuditAction = async (
  userId,
  action,
  targetUserId,
  restaurantId,
  branchId,
  transaction = null
) => {
  try {
    const request = transaction
      ? transaction.request()
      : (await poolPromise).request();

    await request
      .input("userId", sql.Int, userId || null)
      .input("action", sql.NVarChar, action)
      .input("targetUserId", sql.Int, targetUserId || null)
      .input("restaurantId", sql.Int, restaurantId || null)
      .input("branchId", sql.Int, branchId || null)
      .query(`
        INSERT INTO UserAuditLog (user_id, action, target_user_id, restaurant_id, branch_id, created_at)
        VALUES (@userId, @action, @targetUserId, @restaurantId, @branchId, GETDATE())
      `);
  } catch (err) {
    console.error("Audit log kaydı başarısız:", err);
  }
};

const validateBranchInput = ({ name, country, city }) => {
  if (!name || typeof name !== "string" || name.length > 100) {
    return { valid: false, message: "Geçersiz şube adı", error_code: "INVALID_BRANCH_NAME" };
  }
  if (!country || typeof country !== "string" || country.length > 50) {
    return { valid: false, message: "Geçersiz ülke", error_code: "INVALID_COUNTRY" };
  }
  if (!city || typeof city !== "string" || city.length > 50) {
    return { valid: false, message: "Geçersiz şehir", error_code: "INVALID_CITY" };
  }
  return { valid: true };
};

/* -------------------------------------------------------
   🏢 ŞUBE EKLE (sadece admin / owner)
------------------------------------------------------- */
router.post(
  "/branches/:restaurant_id",
  authMiddleware(["admin", "owner"]),
  async (req, res) => {
    const transaction = (await poolPromise).transaction();

    try {
      await transaction.begin();
      const request = transaction.request();

      const { name, country, city } = req.body;
      const { restaurant_id } = req.params;
      const user_id = req.user.user_id;

      // ✅ Girdi doğrulama
      const validation = validateBranchInput({ name, country, city });
      if (!validation.valid) {
        await transaction.rollback();
        return res.status(400).json({
          message: validation.message,
          error_code: validation.error_code,
        });
      }

      // ✅ Restoran kontrolü
      const restaurantCheck = await request
        .input("restaurant_id", sql.Int, parseInt(restaurant_id))
        .query("SELECT id FROM Restaurants WHERE id = @restaurant_id");

      if (restaurantCheck.recordset.length === 0) {
        await transaction.rollback();
        return res
          .status(404)
          .json({ message: "Restoran bulunamadı", error_code: "RESTAURANT_NOT_FOUND" });
      }

      // ✅ Paket limit kontrolü
      const packageResult = await request
        .input("user_id", sql.Int, user_id)
        .query(
          `SELECT package_type, max_branches 
           FROM UserPackages WHERE user_id = @user_id`
        );

      if (packageResult.recordset.length === 0) {
        await transaction.rollback();
        return res
          .status(403)
          .json({ message: "Geçerli paket bulunamadı", error_code: "INVALID_PACKAGE" });
      }

      const { package_type, max_branches } = packageResult.recordset[0];

      const branchCount = await request
        .input("restaurant_id", sql.Int, parseInt(restaurant_id))
        .query(
          "SELECT COUNT(*) AS count FROM Branches WHERE restaurant_id = @restaurant_id"
        );

      const count = branchCount.recordset[0].count;

      if (max_branches && count >= max_branches) {
        await logAuditAction(
          user_id,
          "BRANCH_LIMIT_EXCEEDED",
          null,
          restaurant_id,
          null,
          transaction
        );
        await transaction.rollback();
        return res.status(403).json({
          message: `Bu pakette (${package_type}) en fazla ${max_branches} şube eklenebilir`,
          error_code: "BRANCH_LIMIT_EXCEEDED",
        });
      }

      // ✅ Şube oluştur
      const branchResult = await request
        .input("restaurant_id", sql.Int, parseInt(restaurant_id))
        .input("name", sql.NVarChar, name)
        .input("country", sql.NVarChar, country)
        .input("city", sql.NVarChar, city)
        .query(`
          INSERT INTO Branches (restaurant_id, name, country, city)
          OUTPUT INSERTED.id, INSERTED.name
          VALUES (@restaurant_id, @name, @country, @city)
        `);

      const branch = branchResult.recordset[0];

      // ✅ Audit log
      await logAuditAction(user_id, "BRANCH_ADDED", null, restaurant_id, branch.id, transaction);

      // ✅ Socket.IO bildirimi
      req.io
        ?.to(`admin_${restaurant_id}_${branch.id}`)
        .emit("branch-updated", {
          restaurant_id,
          branch_id: branch.id,
          name,
        });

      await transaction.commit();

      res.status(201).json({
        branch_id: branch.id,
        name,
        message: "Şube başarıyla eklendi",
      });
    } catch (err) {
      await transaction.rollback();
      console.error("Error creating branch:", err);
      res.status(500).json({
        message: "Şube eklenemedi",
        error_code: "SERVER_ERROR",
        error: err.message,
      });
    }
  }
);

/* -------------------------------------------------------
   📋 ŞUBELERİ GETİR
------------------------------------------------------- */
router.get(
  "/:restaurant_id/branches",
  authMiddleware(["admin", "owner", "waiter", "kitchen"]),
  async (req, res) => {
    const transaction = (await poolPromise).transaction();

    try {
      await transaction.begin();
      const request = transaction.request();
      const { restaurant_id } = req.params;
      const user_id = req.user.user_id;

      const restaurantCheck = await request
        .input("restaurant_id", sql.Int, parseInt(restaurant_id))
        .query("SELECT id FROM Restaurants WHERE id = @restaurant_id");

      if (restaurantCheck.recordset.length === 0) {
        await transaction.rollback();
        return res
          .status(404)
          .json({ message: "Restoran bulunamadı", error_code: "RESTAURANT_NOT_FOUND" });
      }

      const result = await request
        .input("restaurant_id", sql.Int, parseInt(restaurant_id))
        .query("SELECT id, name, country, city FROM Branches WHERE restaurant_id = @restaurant_id");

      await logAuditAction(user_id, "BRANCHES_FETCHED", null, restaurant_id, null, transaction);

      await transaction.commit();
      res.json(result.recordset);
    } catch (err) {
      await transaction.rollback();
      console.error("Error fetching branches:", err);
      res.status(500).json({
        message: "Şubeler getirilemedi",
        error_code: "SERVER_ERROR",
        error: err.message,
      });
    }
  }
);

export default router;
