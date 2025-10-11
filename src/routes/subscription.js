import express from "express";
import cors from "cors";
import { createSubscription, handleIyzicoCallback } from "../controllers/subscriptionController.js";
import { simpleAuth } from "../middleware/auth.js"; // ✅ authMiddleware yerine simpleAuth kullanıyoruz

const router = express.Router();

// 🌍 CORS yapılandırması (tüm tarayıcılar için uyumlu)
router.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// 🔁 Safari ve Edge için preflight yanıtı
router.options("*", (req, res) => {
  res.header("Access-Control-Allow-Origin", process.env.FRONTEND_URL || "http://localhost:5173");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");
  return res.sendStatus(200);
});

// 🧾 Abonelik oluşturma (JWT token yeterli, is_active kontrolü yapılmaz)
router.post("/create", simpleAuth, async (req, res, next) => {
  try {
    await createSubscription(req, res);
  } catch (err) {
    console.error("❌ Subscription create error:", err);
    next(err);
  }
});

// 🔁 Iyzico callback (ödeme sonucu)
// Burada ödeme tamamlanınca kullanıcı aktif hale getirilecek.
router.post("/callback", async (req, res, next) => {
  try {
    await handleIyzicoCallback(req, res);
  } catch (err) {
    console.error("❌ Subscription callback error:", err);
    next(err);
  }
});

export default router;
