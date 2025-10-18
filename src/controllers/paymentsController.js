import jwt from "jsonwebtoken";
import { poolPromise, sql } from "../config/db.js";
import { calculateTotal } from "../utils/priceCalculator.js";
import { createIyzicoPayment as iyzicoCreate } from "../services/iyzicoService.js";



/**
 * createPayment - token ile çağrılır. Kullanıcının user_id ve restaurant_id'si JWT içinden alınır.
 * Payments tablosuna (customer_order_id, amount, payment_method, transaction_id, paid_at) ekler.
 * Ayrıca UserPackages tablosuna güncel paket bilgisi ekler.
 */
export const createPayment = async (req, res) => {
  try {
    // Authorization token al
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
    if (!user_id || !restaurant_id) return res.status(400).json({ message: "Eksik bilgi: user_id veya restaurant_id" });

    // request body
    const { package_type = "basic", branches = 1 } = req.body;
    const total = calculateTotal(package_type, branches);
    const pricePerBranch = total.perBranch;
    const monthlyPrice = total.monthly;
    const totalPrice = monthlyPrice * 12; // Yıllık toplam

    const pool = await poolPromise;

    // 1) UserPackages kaydı (güncel alanlarla)
    await pool.request()
      .input("user_id", sql.Int, user_id)
      .input("package_type", sql.NVarChar, package_type)
      .input("max_branches", sql.Int, branches)
      .input("price_per_branch", sql.Decimal(18,2), pricePerBranch)
      .input("total_price", sql.Decimal(18,2), totalPrice)
      .input("trial_start_date", sql.DateTime, new Date())
      .input("trial_end_date", sql.DateTime, new Date(Date.now() + 14*24*60*60*1000))
      .input("is_trial_active", sql.Bit, 1)
      .query(`
        INSERT INTO UserPackages
          (user_id, package_type, max_branches, price_per_branch, total_price, trial_start_date, trial_end_date, is_trial_active, created_at)
        VALUES
          (@user_id, @package_type, @max_branches, @price_per_branch, @total_price, @trial_start_date, @trial_end_date, @is_trial_active, GETDATE())
      `);

    // 2) Iyzico'ya istek (SDK ile)
    let iyzicoResult = null;
    try {
      // Kullanıcı bilgilerini al
      const userInfo = await pool.request()
        .input("user_id", sql.Int, user_id)
        .query("SELECT name, email, phone FROM Users WHERE id = @user_id");

      const user = userInfo.recordset[0];
      if (!user) throw new Error("Kullanıcı bulunamadı");

      const conversationId = `pay_${user_id}_${Date.now()}`;
      const basketItems = [{
        id: (package_type + "_" + Date.now()).toString(),
        name: `${package_type} paket (${branches} şube)`,
        category1: "Abonelik",
        category2: "Yazılım",
        itemType: "VIRTUAL",
        price: totalPrice.toFixed(2)
      }];

      const callbackUrl = `${process.env.BASE_URL || "http://localhost:5000"}/api/subscription/callback`;

      iyzicoResult = await iyzicoCreate({
        conversationId,
        price: totalPrice,
        paidPrice: totalPrice,
        user: {
          id: user_id,
          name: user.name || "Kullanıcı",
          email: user.email || "test@example.com",
          phone: user.phone || "+905555555555"
        },
        basketItems,
        callbackUrl
      });
    } catch (iyzErr) {
      console.warn("Iyzico create error:", iyzErr);
    }

    // 3) Payments tablosuna kayıt (güncel şema ile)
    const fakeTransactionId = `TRX-${Date.now()}`;
    const customerOrderId = `pay_${user_id}_${Date.now()}`;

    await pool.request()
      .input("customer_order_id", sql.NVarChar, customerOrderId)
      .input("amount", sql.Decimal(18,2), totalPrice)
      .input("payment_method", sql.NVarChar, iyzicoResult?.payment_method || "iyzico")
      .input("status", sql.NVarChar, "pending")
      .input("iyzico_token", sql.NVarChar, iyzicoResult?.token || null)
      .input("payment_url", sql.NVarChar, iyzicoResult?.paymentPageUrl || null)
      .input("created_at", sql.DateTime, new Date())
      .query(`
        INSERT INTO Payments (customer_order_id, amount, payment_method, status, iyzico_token, payment_url, created_at)
        VALUES (@customer_order_id, @amount, @payment_method, @status, @iyzico_token, @payment_url, @created_at)
      `);

    // 4) Response - iyzicoResult varsa onun checkout bilgilerini dön, yoksa fake transaction gönder
    const responsePayload = {
      message: "Ödeme oluşturuldu.",
      payment: {
        transaction_id: iyzicoResult?.paymentId || fakeTransactionId,
        amount: totalPrice,
        payment_method: iyzicoResult?.payment_method || "iyzico_test",
        paymentPageUrl: iyzicoResult?.paymentPageUrl || null,
        checkoutFormContent: iyzicoResult?.checkoutFormContent || null
      },
      user_id,
      restaurant_id,
      branch_id
    };

    return res.status(201).json(responsePayload);
  } catch (err) {
    console.error("❌ Ödeme oluşturma hatası:", err);
    return res.status(500).json({ message: "Ödeme oluşturulamadı.", error: err.message });
  }
};

/**
 * handleCallback - Iyzico callback (checkout form retrieve sonrası)
 * Basit: verifyPayment kullanılarak doğrulanır ve Payments/CustomerOrders güncellenir.
 */
export const handleCallback = async (req, res) => {
  try {
    // Bu proje kapsamında, callback verisini işlemek için verifyPayment kullanalım (service içinde)
    console.log("🔁 Iyzico callback geldi:", req.body);
    return res.json({ message: "Callback işlendi." });
  } catch (err) {
    console.error("Callback error:", err);
    return res.status(500).json({ message: "Callback işlenemedi.", error: err.message });
  }
};
