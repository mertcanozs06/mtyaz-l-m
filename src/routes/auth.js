// ✅ routes/auth.js
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import { poolPromise, sql } from "../config/db.js";
import { register, login } from "../controllers/authController.js";

const router = express.Router();

/**
 * 🌐 CORS Ayarları
 * Geliştirme: http://localhost:5173
 * Üretim: .env dosyasındaki FRONTEND_URL
 */
router.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// ✅ CORS preflight (OPTIONS)
router.options("*", (req, res) => res.sendStatus(200));

/**
 * 🧾 Auth rotaları
 * /api/auth/register → Yeni kullanıcı kaydı
 * /api/auth/login    → Giriş yap
 */
router.post("/register", async (req, res, next) => {
  try {
    await register(req, res);
  } catch (err) {
    console.error("❌ Register route error:", err);
    next(err);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    await login(req, res);
  } catch (err) {
    console.error("❌ Login route error:", err);
    next(err);
  }
});

/**
 * 👤 Kullanıcı bilgileri
 * /api/auth/user → JWT'den kullanıcı bilgilerini döner
 */
router.get("/user", async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Token bulunamadı." });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your_jwt_secret");

    const pool = await poolPromise;
    const userResult = await pool
      .request()
      .input("id", sql.Int, decoded.user_id)
      .query("SELECT * FROM Users WHERE id = @id");

    const user = userResult.recordset[0];
    if (!user) {
      return res.status(404).json({ message: "Kullanıcı bulunamadı." });
    }

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      restaurant_id: user.restaurant_id,
      branch_id: user.branch_id,
      package_type: user.package_type,
      is_active: user.is_active,
    });
  } catch (err) {
    console.error("❌ User route error:", err);
    next(err);
  }
});

export default router;
