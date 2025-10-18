import { poolPromise, sql } from "../config/db.js";
import { createIyzicoPayment, verifyPayment, formatIyzicoError } from "../services/iyzicoService.js";
import dotenv from "dotenv";

dotenv.config();

/**
 * 🧾 Yeni abonelik oluşturur ve Iyzico ödeme başlatır
 * @route POST /api/subscription/create
 * @access Private (JWT zorunlu değil — simpleAuth ile)
 */
export const createSubscription = async (req, res) => {
  const pool = await poolPromise;
  const user = req.user; // simpleAuth veya authMiddleware’den geliyor

  try {
    console.log("🔐 createSubscription başlatıldı | Kullanıcı:", user?.id);

    const { package_type = "basic", branches = 1 } = req.body;

    // 💰 Paket fiyatları (Yıllık model: aylık fiyat × 12)
    const pricing = {
      basic: 360,    // Aylık: ₺360 × 12 = ₺4.320
      advance: 720,  // Aylık: ₺720 × 12 = ₺8.640
      elevate: 1200, // Aylık: ₺1.200 × 12 = ₺14.400
    };

    const monthlyPrice = pricing[package_type] || 360;
    const branchCount = branches > 0 ? parseInt(branches) : 1;
    const totalPrice = monthlyPrice * branchCount * 12; // Yıllık toplam

    // 🧾 Ödeme kaydı oluştur (güncel şema ile)
    const conversationId = `sub_${user.id}_${Date.now()}`;

    const insertQuery = `
      INSERT INTO Payments (customer_order_id, amount, payment_method, payment_url)
      OUTPUT INSERTED.id
      VALUES (@customer_order_id, @amount, @payment_method, @payment_url)
    `;

    const customerOrderId = `sub_${user.id}_${Date.now()}`;

    const insertResult = await pool.request()
      .input("customer_order_id", sql.NVarChar, customerOrderId)
      .input("amount", sql.Decimal(18, 2), totalPrice)
      .input("payment_method", sql.NVarChar, "iyzico")
      .input("payment_url", sql.NVarChar, null) // Henüz URL yok
      .query(insertQuery);

    const paymentId = insertResult.recordset[0]?.id;

    if (!paymentId) {
      return res.status(500).json({ message: "Ödeme kaydı oluşturulamadı." });
    }

    console.log("💾 Ödeme kaydı oluşturuldu:", paymentId);

    // 🧾 Iyzico ödeme parametreleri
    const callbackUrl = `${process.env.BASE_URL || "http://localhost:5000"}/api/subscription/callback`;

    const basketItems = [
      {
        id: String(paymentId),
        name: `${package_type.toUpperCase()} Paketi (${branchCount} şube)`,
        category1: "Abonelik",
        itemType: "VIRTUAL",
        price: totalPrice,
      },
    ];

    // 🚀 Iyzico ödeme başlat
    console.log("🚀 Iyzico ödeme başlatılıyor:", {
      conversationId,
      totalPrice,
      basketItems,
      callbackUrl,
    });

    const iyzicoResponse = await createIyzicoPayment({
      conversationId,
      price: totalPrice,
      paidPrice: totalPrice,
      user,
      basketItems,
      callbackUrl,
    });

    console.log("📥 Iyzico yanıtı:", iyzicoResponse);

    // ❌ Hata durumunda işlemi iptal et
    if (!iyzicoResponse?.success) {
      await pool.request()
        .input("id", sql.Int, paymentId)
        .input("payment_url", sql.NVarChar, "failed")
        .query("UPDATE Payments SET payment_url = @payment_url WHERE id = @id");

      return res.status(400).json({
        message: formatIyzicoError(iyzicoResponse?.errorMessage || "Ödeme başlatılamadı."),
      });
    }

    // ✅ Başarılı durumda token ve URL'i kaydet
    await pool.request()
      .input("id", sql.Int, paymentId)
      .input("iyzico_token", sql.NVarChar, iyzicoResponse.token)
      .input("payment_url", sql.NVarChar, iyzicoResponse.paymentPageUrl)
      .query(`
        UPDATE Payments
        SET iyzico_token = @iyzico_token, payment_url = @payment_url
        WHERE id = @id
      `);

    console.log("✅ Iyzico ödeme başarıyla başlatıldı:", iyzicoResponse.paymentPageUrl);

    return res.status(200).json({
      message: "Ödeme başarıyla başlatıldı.",
      payment: {
        id: paymentId,
        token: iyzicoResponse.token,
        paymentUrl: iyzicoResponse.paymentPageUrl,
        amount: totalPrice,
        package_type,
      },
    });
  } catch (err) {
    console.error("💥 Abonelik oluşturma hatası:", err);
    return res.status(500).json({
      message: "Abonelik oluşturulurken bir hata oluştu.",
      error: err.message,
    });
  }
};

/**
 * 🔁 Iyzico ödeme callback işlemi
 * — Ödeme başarılı olursa kullanıcı aktif edilir
 * — Restaurant ve Branch kayıtları aktiflenir
 */
export const handleIyzicoCallback = async (req, res) => {
  // Iyzico bazen body'de, bazen query'de token gönderir
  const token = req.body.token || req.query.token;

  if (!token) {
    return res.status(400).json({ message: "Token bulunamadı." });
  }

  try {
    console.log("🔁 handleIyzicoCallback çağrıldı | token:", token);

    const result = await verifyPayment(token);
    const pool = await poolPromise;

    if (result.status === "success") {
      // ✅ Ödeme kaydını güncelle
      const paymentUpdate = await pool.request()
        .input("token", sql.NVarChar, token)
        .query(`
          UPDATE Payments
          SET payment_url = 'success'
          OUTPUT INSERTED.customer_order_id
          WHERE iyzico_token = @token
        `);

      const customerOrderId = paymentUpdate.recordset[0]?.customer_order_id;
      console.log("✅ Ödeme başarılı, customer_order_id:", customerOrderId);

      // Kullanıcı ID'sini customer_order_id'den çıkar (reg_{userId}_{timestamp} veya sub_{userId}_{timestamp})
      const userIdMatch = customerOrderId?.match(/^(reg|sub)_(\d+)_/);
      const userId = userIdMatch ? parseInt(userIdMatch[2]) : null;

      if (userId) {
        // 🟢 Kullanıcıyı aktif et (ödeme sonrası)
        await pool.request()
          .input("id", sql.Int, userId)
          .query(`UPDATE Users SET is_active = 1 WHERE id = @id`);

        // 🏪 İlgili restoranı da aktif et
        await pool.request()
          .input("user_id", sql.Int, userId)
          .query(`
            UPDATE Restaurants
            SET is_active = 1
            WHERE id = (SELECT restaurant_id FROM Users WHERE id = @user_id)
          `);

        // 🏢 Şubeleri aktif et
        await pool.request()
          .input("user_id", sql.Int, userId)
          .query(`
            UPDATE Branches
            SET is_active = 1
            WHERE restaurant_id = (SELECT restaurant_id FROM Users WHERE id = @user_id)
          `);

        // 📦 UserPackages tablosunda güncelle (ödeme sonrası aktif)
        await pool.request()
          .input("user_id", sql.Int, userId)
          .query(`
            UPDATE UserPackages
            SET is_trial_active = 0
            WHERE user_id = @user_id
          `);

        console.log(`✅ Kullanıcı #${userId} aktif hale getirildi (ödeme başarılı).`);
      }

      return res.redirect(`${process.env.FRONTEND_URL || "http://localhost:5173"}/success`);
    }

    // ❌ Başarısız ödeme
    await pool.request()
      .input("token", sql.NVarChar, token)
      .query(`
        UPDATE Payments
        SET payment_url = 'failed'
        WHERE iyzico_token = @token
      `);

    console.warn("⚠️ Ödeme başarısız:", result.errorMessage);
    return res.redirect(`${process.env.FRONTEND_URL || "http://localhost:5173"}/register`);
  } catch (err) {
    console.error("💥 Callback işleme hatası:", err.message);
    return res.status(500).json({
      message: "Callback işleme hatası",
      error: err.message,
    });
  }
};
