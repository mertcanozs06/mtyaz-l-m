import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { poolPromise, sql } from "../config/db.js";

dotenv.config();

export const authMiddleware =
  (roles = []) =>
  async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Token bulunamadı",
        error_code: "NO_TOKEN",
      });
    }

    const token = authHeader.split(" ")[1];
    let decoded;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || "default_secret");
      req.user = decoded;

      // Rol kontrolü
      if (roles.length > 0 && !roles.includes(decoded.role)) {
        await logAuditAction(decoded.id, "UNAUTHORIZED_ACCESS", null, decoded.restaurant_id, decoded.branch_id);
        return res.status(403).json({
          message: "Bu işlem için yetkiniz yok",
          error_code: "FORBIDDEN_ROLE",
        });
      }

      // Kullanıcı aktif mi?
      const pool = await poolPromise;
      const statusRes = await pool
        .request()
        .input("id", sql.Int, decoded.id)
        .query("SELECT is_active FROM Users WHERE id = @id");

      if (statusRes.recordset.length === 0 || !statusRes.recordset[0].is_active) {
        await logAuditAction(decoded.id, "INACTIVE_USER_ACCESS", null, decoded.restaurant_id, decoded.branch_id);
        return res.status(403).json({
          message: "Kullanıcı hesabı aktif değil",
          error_code: "INACTIVE_USER",
        });
      }

      next();
    } catch (err) {
      console.error("🔐 Kimlik doğrulama hatası:", err.message);

      if (err.name === "TokenExpiredError") {
        await logAuditAction(decoded?.id || null, "TOKEN_EXPIRED", null, decoded?.restaurant_id, decoded?.branch_id);
        return res.status(401).json({
          message: "Oturum süreniz doldu. Lütfen tekrar giriş yapın.",
          error_code: "TOKEN_EXPIRED",
        });
      }

      await logAuditAction(decoded?.id || null, "INVALID_TOKEN", null, decoded?.restaurant_id, decoded?.branch_id);
      return res.status(401).json({
        message: "Geçersiz token",
        error_code: "INVALID_TOKEN",
      });
    }
  };

export const simpleAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token bulunamadı", error_code: "NO_TOKEN" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "default_secret");
    req.user = decoded;
    next();
  } catch (err) {
    console.error("❌ simpleAuth hata:", err.message);
    return res.status(401).json({ message: "Geçersiz token", error_code: "INVALID_TOKEN" });
  }
};

const logAuditAction = async (userId, action, targetUserId, restaurantId, branchId) => {
  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("userId", sql.Int, userId)
      .input("action", sql.NVarChar, action)
      .input("targetUserId", sql.Int, targetUserId)
      .input("restaurantId", sql.Int, restaurantId)
      .input("branchId", sql.Int, branchId)
      .input("created_at", sql.DateTime, new Date())
      .query(`
        INSERT INTO UserAuditLog (user_id, action, target_user_id, restaurant_id, branch_id, created_at)
        VALUES (@userId, @action, @targetUserId, @restaurantId, @branchId, @created_at)
      `);
  } catch (err) {
    console.error("Audit log kaydı başarısız:", err.message);
  }
};
