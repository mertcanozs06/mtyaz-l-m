import sql from "mssql";
import { createPayment, verifyCallback } from "../services/iyzicoService.js";
import {
  calculateTotal,
  calculateAddBranchesAmount,
  calculateAnnualFromMonthly,
  formatCurrency,
} from "../utils/priceCalculator.js";
import { logAuditAction } from "../utils/auditLogger.js";

/**
 * 💳 Yeni ödeme oluştur (kayıt veya ek şube satın alma)
 */
export const initiatePayment = async (req, res) => {
  const pool = await sql.connect();
  const transaction = new sql.Transaction(pool);

  try {
    const { user_id, package_type, branch_count, mode } = req.body;

    if (!user_id || !package_type) {
      return res
        .status(400)
        .json({ message: "Eksik bilgi: user_id veya package_type" });
    }

    await transaction.begin();

    // Kullanıcıyı bul
    const userResult = await pool
      .request()
      .input("id", sql.Int, user_id)
      .query("SELECT id, name, email, restaurant_id FROM Users WHERE id = @id");

    if (userResult.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ message: "Kullanıcı bulunamadı" });
    }

    const user = userResult.recordset[0];

    // Kullanıcının mevcut paket bilgisi
    const pkgResult = await pool
      .request()
      .input("user_id", sql.Int, user_id)
      .query(
        "SELECT TOP 1 package_type, max_branches FROM UserPackages WHERE user_id = @user_id ORDER BY created_at DESC"
      );

    let totalInfo;
    if (mode === "add_branches" && pkgResult.recordset.length > 0) {
      const current = pkgResult.recordset[0];
      totalInfo = calculateAddBranchesAmount(
        current.package_type,
        current.max_branches,
        branch_count
      );
    } else {
      totalInfo = calculateTotal(package_type, branch_count);
    }

    const annual = calculateAnnualFromMonthly(totalInfo.monthly);
    const formatted = formatCurrency(totalInfo.monthly);

    // 🧾 İyzico üzerinden ödeme isteği oluştur
    const paymentInit = await createPayment({
      email: user.email,
      name: user.name,
      price: totalInfo.monthly,
      packageType: package_type,
      branchCount: branch_count,
      userId: user_id,
    });

    if (!paymentInit || !paymentInit.paymentPageUrl) {
      await transaction.rollback();
      return res.status(500).json({
        message: "Ödeme başlatılamadı",
        detail: paymentInit?.errorMessage || "İyzico isteği başarısız",
      });
    }

    // Payment kaydını geçici olarak oluştur
    await pool
      .request()
      .input("customer_order_id", sql.NVarChar, paymentInit.paymentId || null)
      .input("amount", sql.Decimal(18, 2), totalInfo.monthly)
      .input("payment_method", sql.NVarChar, "iyzico")
      .input("transaction_id", sql.NVarChar, null)
      .input("paid_at", sql.DateTime, null)
      .query(
        "INSERT INTO Payments (customer_order_id, amount, payment_method, transaction_id, paid_at) VALUES (@customer_order_id, @amount, @payment_method, @transaction_id, @paid_at)"
      );

    await transaction.commit();

    res.json({
      success: true,
      paymentPageUrl: paymentInit.paymentPageUrl,
      monthlyAmount: formatted,
      annualAmount: formatCurrency(annual),
      details: totalInfo,
    });
  } catch (err) {
    console.error("❌ initiatePayment hata:", err);
    await transaction.rollback();
    res.status(500).json({ message: "Sunucu hatası", error: err.message });
  }
};

/**
 * ✅ Ödeme başarı callback doğrulama
 */
export const handlePaymentCallback = async (req, res) => {
  try {
    const { paymentId, status, conversationId } = req.body;

    const verified = await verifyCallback(paymentId);

    if (!verified.success) {
      return res.status(400).json({ message: "Ödeme doğrulanamadı" });
    }

    const pool = await sql.connect();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    // Payment kaydını güncelle
    await pool
      .request()
      .input("transaction_id", sql.NVarChar, paymentId)
      .input("paid_at", sql.DateTime, new Date())
      .query(
        "UPDATE Payments SET transaction_id=@transaction_id, paid_at=@paid_at WHERE customer_order_id=@transaction_id"
      );

    // Kullanıcı paketi kaydet / güncelle
    const { userId, packageType, branchCount } = verified.metadata || {};

    if (userId && packageType) {
      await pool
        .request()
        .input("user_id", sql.Int, userId)
        .input("package_type", sql.NVarChar, packageType)
        .input("max_branches", sql.Int, branchCount || 0)
        .input("created_at", sql.DateTime, new Date())
        .query(
          "INSERT INTO UserPackages (user_id, package_type, max_branches, created_at) VALUES (@user_id, @package_type, @max_branches, @created_at)"
        );
    }

    await logAuditAction(
      userId,
      "PAYMENT_SUCCESS",
      null,
      null,
      null,
      transaction
    );

    await transaction.commit();

    res.json({
      success: true,
      message: "Ödeme başarıyla tamamlandı",
    });
  } catch (err) {
    console.error("❌ handlePaymentCallback hata:", err);
    res.status(500).json({ message: "Sunucu hatası", error: err.message });
  }
};

/**
 * 🧾 Kullanıcının ödeme geçmişi
 */
export const getPaymentHistory = async (req, res) => {
  try {
    const { user_id } = req.params;
    const pool = await sql.connect();

    const result = await pool
      .request()
      .input("user_id", sql.Int, user_id)
      .query(
        `SELECT P.id, P.amount, P.payment_method, P.transaction_id, P.paid_at, 
                U.package_type, U.max_branches, U.created_at AS package_created_at
         FROM Payments P
         LEFT JOIN UserPackages U ON U.user_id = @user_id
         WHERE U.user_id = @user_id
         ORDER BY P.paid_at DESC`
      );

    res.json({ success: true, history: result.recordset });
  } catch (err) {
    console.error("❌ getPaymentHistory hata:", err);
    res.status(500).json({ message: "Sunucu hatası", error: err.message });
  }
};
