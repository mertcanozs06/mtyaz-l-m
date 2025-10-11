// ✅ routes/auth.js
import express from "express";
import cors from "cors";
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

export default router;
