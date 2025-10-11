// ✅ routes/dashboard.js
import express from "express";
import { poolPromise, sql } from "../config/db.js";
import { authMiddleware } from "../middleware/auth.js";
import { calculateAnnualFromMonthly, formatCurrency } from "../utils/priceCalculator.js";
import { createIyzicoPayment } from "../services/iyzicoService.js";

const router = express.Router();

/**
 * 🧭 Kullanıcının Dashboard Bilgilerini Döndürür
 * - Aktif paket
 * - Şube sayısı
 * - Ödeme geçmişi
 * - Kalan gün
 */
router.get("/", authMiddleware(["admin", "owner"]), async (req, res) => {
  try {
    const { user_id } = req.user;
    const pool = await poolPromise;

    // 🔹 Aktif paket bilgisi
    const pkgResult = await pool.request()
      .input("user_id", sql.Int, user_id)
      .query(`
        SELECT TOP 1 
          package_type,
          max_branches,
          start_date,
          end_date,
          status
        FROM UserPackages
        WHERE user_id = @user_id
        ORDER BY created_at DESC
      `);

    if (pkgResult.recordset.length === 0) {
      return res.status(404).json({ message: "Aktif paket bulunamadı" });
    }

    const packageInfo = pkgResult.recordset[0];

    // 🔹 Şube sayısı
    const branchResult = await pool.request()
      .input("user_id", sql.Int, user_id)
      .query(`
        SELECT COUNT(*) AS branch_count
        FROM Branches b
        INNER JOIN Restaurants r ON b.restaurant_id = r.id
        WHERE r.user_id = @user_id
      `);

    const branchCount = branchResult.recordset[0].branch_count || 0;

    // 🔹 Ödeme geçmişi
    const paymentsResult = await pool.request()
      .input("user_id", sql.Int, user_id)
      .query(`
        SELECT 
          id,
          package_type,
          amount,
          status,
          paid_at,
          transaction_id
        FROM Payments
        WHERE user_id = @user_id
        ORDER BY paid_at DESC
      `);

    // 🔹 Kalan gün hesabı
    const now = new Date();
    const remainingDays = Math.max(
      0,
      Math.ceil((new Date(packageInfo.end_date) - now) / (1000 * 60 * 60 * 24))
    );

    // ✅ JSON Response
    res.json({
      success: true,
      package: {
        type: packageInfo.package_type,
        status: packageInfo.status,
        max_branches: packageInfo.max_branches,
        active_branches: branchCount,
        remaining_branches: Math.max(0, packageInfo.max_branches - branchCount),
        start_date: packageInfo.start_date,
        end_date: packageInfo.end_date,
        remaining_days: remainingDays,
      },
      payments: paymentsResult.recordset.map((p) => ({
        id: p.id,
        package_type: p.package_type,
        amount: formatCurrency(p.amount),
        paid_at: p.paid_at,
        status: p.status,
        transaction_id: p.transaction_id,
      })),
    });
  } catch (err) {
    console.error("❌ Dashboard error:", err);
    res.status(500).json({
      message: "Dashboard verileri alınamadı.",
      error: err.message,
    });
  }
});

/**
 * 💳 Paket Yenileme (Yıllık)
 * Kullanıcı mevcut paketini yenilemek istediğinde çağrılır.
 */
router.post("/renew", authMiddleware(["admin", "owner"]), async (req, res) => {
  try {
    const { user_id, email } = req.user;
    const pool = await poolPromise;

    // 🔹 Aktif paket çek
    const pkgResult = await pool.request()
      .input("user_id", sql.Int, user_id)
      .query(`
        SELECT TOP 1 package_type, max_branches, end_date
        FROM UserPackages
        WHERE user_id = @user_id
        ORDER BY created_at DESC
      `);

    if (pkgResult.recordset.length === 0) {
      return res.status(404).json({ message: "Aktif paket bulunamadı" });
    }

    const { package_type, max_branches } = pkgResult.recordset[0];

    // 🔹 Paket ücret hesaplama
    const amountMonthly =
      package_type === "basic"
        ? 360
        : package_type === "advance"
        ? 720 * max_branches
        : 1200 * max_branches;

    const amountYearly = calculateAnnualFromMonthly(amountMonthly);

    // 🔹 İyzico ödeme isteği
    const iyzicoPayment = await createIyzicoPayment({
      price: amountYearly,
      paidPrice: amountYearly,
      buyer: {
        id: String(user_id),
        name: "Yenileme Kullanıcısı",
        surname: "-",
        email: email || "unknown@example.com",
        phone: "+905555555555",
      },
      basketItems: [
        {
          id: `${package_type}_${Date.now()}`,
          name: `Yıllık ${package_type} paketi yenileme (${max_branches} şube)`,
          price: amountYearly,
        },
      ],
    });

    // 🔹 Kullanıcıya ödeme sayfası URL’ini döndür
    return res.json({
      success: true,
      message: "Yenileme ödemesi oluşturuldu.",
      iyzico_url:
        iyzicoPayment?.paymentPageUrl || iyzicoPayment?.checkoutFormUrl || null,
      package: package_type,
      amount: amountYearly,
      formatted: formatCurrency(amountYearly),
    });
  } catch (err) {
    console.error("❌ Renew package error:", err);
    res.status(500).json({
      message: "Paket yenileme işlemi başarısız.",
      error: err.message,
    });
  }
});

export default router;
