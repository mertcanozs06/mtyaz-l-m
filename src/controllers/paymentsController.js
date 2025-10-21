// Dosya: controllers/paymentsController.js
import jwt from "jsonwebtoken";
import { poolPromise, sql } from "../config/db.js";
import { calculateTotal } from "../utils/priceCalculator.js";
import { createIyzicoPayment } from "../services/iyzicoService.js";

export const createPayment = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: "Token bulunamadı." });

    const token = authHeader.split(" ")[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || "your_jwt_secret");
    } catch (err) {
      return res.status(401).json({ message: "Geçersiz token." });
    }

    const { user_id, restaurant_id, branch_id } = decoded;
    if (!user_id || !restaurant_id)
      return res.status(400).json({ message: "Eksik bilgi: user_id veya restaurant_id" });

    const { package_type = "basic", branches = 1 } = req.body;
    const total = calculateTotal(package_type, branches);
    const pricePerBranch = total.perBranch;
    const monthlyPrice = total.monthly;
    const totalPrice = monthlyPrice * 12;

    const pool = await poolPromise;

    const userInfo = await pool.request()
      .input("user_id", sql.Int, user_id)
      .query("SELECT name, email, phone FROM Users WHERE id = @user_id");

    const user = userInfo.recordset[0];
    if (!user) return res.status(404).json({ message: "Kullanıcı bulunamadı." });

    const conversationId = `pay_${user_id}_${Date.now()}`;
    const basketItems = [
      {
        id: (package_type + "_" + Date.now()).toString(),
        name: `${package_type} paket (${branches} şube)`,
        category1: "Abonelik",
        category2: "Yazılım",
        itemType: "VIRTUAL",
        price: totalPrice.toFixed(2),
      },
    ];

    const callbackUrl = `${process.env.BASE_URL || "http://localhost:5000"}/api/subscription/callback`;

    const iyzicoResult = await createIyzicoPayment({
      conversationId,
      price: totalPrice,
      paidPrice: totalPrice,
      user: {
        id: user_id,
        name: user.name || "Kullanıcı",
        email: user.email || "test@example.com",
        phone: user.phone || "+905555555555",
      },
      basketItems,
      callbackUrl,
    });

    if (!iyzicoResult.success) {
      return res.status(400).json({ message: iyzicoResult.errorMessage });
    }

    const customerOrderId = `pay_${user_id}_${Date.now()}`;
    await pool.request()
      .input("customer_order_id", sql.NVarChar, customerOrderId)
      .input("amount", sql.Decimal(18, 2), totalPrice)
      .input("payment_method", sql.NVarChar, "iyzico")
      .input("status", sql.NVarChar, "pending")
      .input("iyzico_token", sql.NVarChar, iyzicoResult.token)
      .input("payment_url", sql.NVarChar, iyzicoResult.paymentPageUrl)
      .input("created_at", sql.DateTime, new Date())
      .query(`
        INSERT INTO Payments (customer_order_id, amount, payment_method, status, iyzico_token, payment_url, created_at)
        VALUES (@customer_order_id, @amount, @payment_method, @status, @iyzico_token, @payment_url, @created_at)
      `);

    await pool.request()
      .input("user_id", sql.Int, user_id)
      .input("package_type", sql.NVarChar, package_type)
      .input("max_branches", sql.Int, branches)
      .input("price_per_branch", sql.Decimal(18, 2), pricePerBranch)
      .input("total_price", sql.Decimal(18, 2), totalPrice)
      .input("trial_start_date", sql.DateTime, new Date())
      .input("trial_end_date", sql.DateTime, new Date(Date.now() + 14 * 24 * 60 * 60 * 1000))
      .input("is_trial_active", sql.Bit, 1)
      .input("updated_at", sql.DateTime, new Date())
      .query(`
        INSERT INTO UserPackages
          (user_id, package_type, max_branches, price_per_branch, total_price, trial_start_date, trial_end_date, is_trial_active, created_at, updated_at)
        VALUES
          (@user_id, @package_type, @max_branches, @price_per_branch, @total_price, @trial_start_date, @trial_end_date, @is_trial_active, GETDATE(), @updated_at)
      `);

    return res.status(201).json({
      message: "Ödeme oluşturuldu.",
      payment: {
        transaction_id: iyzicoResult.paymentId || `TRX-${Date.now()}`,
        amount: totalPrice,
        payment_method: "iyzico",
        paymentPageUrl: iyzicoResult.paymentPageUrl,
        token: iyzicoResult.token,
      },
      user_id,
      restaurant_id,
      branch_id,
    });
  } catch (err) {
    console.error("❌ Ödeme oluşturma hatası:", err);
    return res.status(500).json({ message: "Ödeme oluşturulamadı.", error: err.message });
  }
};

// ----------------------------------------------------------
// 💳 İyzico callback işleme fonksiyonu eklendi
// ----------------------------------------------------------
export const handleCallback = async (req, res) => {
  try {
    console.log("📩 İyzico callback alındı:", req.body);

    const { status, token } = req.body;

    const pool = await poolPromise;
    await pool.request()
      .input("iyzico_token", sql.NVarChar, token)
      .input("status", sql.NVarChar, status === "success" ? "completed" : "failed")
      .query(`
        UPDATE Payments
        SET status = @status
        WHERE iyzico_token = @iyzico_token
      `);

    console.log(`✅ Ödeme durumu güncellendi: ${status}`);
    return res.status(200).json({ message: "Callback işlendi", status });
  } catch (error) {
    console.error("❌ Callback işleme hatası:", error);
    return res.status(500).json({ message: "Callback işlenemedi", error: error.message });
  }
};
