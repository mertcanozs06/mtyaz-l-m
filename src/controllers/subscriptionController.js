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

    // 💰 Paket fiyatları
    const pricing = {
      basic: 299,
      advance: 499,
      elevate: 799,
    };

    const monthlyPrice = pricing[package_type] || 299;
    const branchCount = branches > 0 ? parseInt(branches) : 1;
    const totalPrice = monthlyPrice * branchCount;

    // 🧾 Ödeme kaydı oluştur
    const conversationId = `sub_${user.id}_${Date.now()}`;

    const insertQuery = `
      INSERT INTO Payments (user_id, amount, package_type, branch_count, status, conversation_id, created_at)
      OUTPUT INSERTED.id
      VALUES (@user_id, @amount, @package_type, @branch_count, @status, @conversation_id, GETDATE())
    `;

    const insertResult = await pool.request()
      .input("user_id", sql.Int, user.id)
      .input("amount", sql.Decimal(18, 2), totalPrice)
      .input("package_type", sql.NVarChar, package_type)
      .input("branch_count", sql.Int, branchCount)
      .input("status", sql.NVarChar, "pending")
      .input("conversation_id", sql.NVarChar, conversationId)
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
    const iyzicoResponse = await createIyzicoPayment({
      conversationId,
      price: totalPrice,
      paidPrice: totalPrice,
      user,
      basketItems,
      callbackUrl,
    });

    // ❌ Hata durumunda işlemi iptal et
    if (!iyzicoResponse?.success) {
      await pool.request()
        .input("id", sql.Int, paymentId)
        .input("status", sql.NVarChar, "failed")
        .query("UPDATE Payments SET status = @status WHERE id = @id");

      return res.status(400).json({
        message: formatIyzicoError(iyzicoResponse?.errorMessage || "Ödeme başlatılamadı."),
      });
    }

    // ✅ Başarılı durumda token ve URL'i kaydet
    await pool.request()
      .input("id", sql.Int, paymentId)
      .input("token", sql.NVarChar, iyzicoResponse.token)
      .input("payment_url", sql.NVarChar, iyzicoResponse.paymentPageUrl)
      .query(`
        UPDATE Payments 
        SET iyzico_token = @token, payment_url = @payment_url, updated_at = GETDATE()
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
  const { token } = req.body;

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
        .input("status", sql.NVarChar, "success")
        .query(`
          UPDATE Payments 
          SET status = @status, updated_at = GETDATE()
          OUTPUT INSERTED.user_id
          WHERE iyzico_token = @token
        `);

      const userId = paymentUpdate.recordset[0]?.user_id;

      if (userId) {
        // 🟢 Kullanıcıyı aktif et
        await pool.request()
          .input("id", sql.Int, userId)
          .query(`UPDATE Users SET is_active = 1, updated_at = GETDATE() WHERE id = @id`);

        // 🏪 İlgili restoranı da aktif et
        await pool.request()
          .input("user_id", sql.Int, userId)
          .query(`
            UPDATE Restaurants 
            SET is_active = 1, updated_at = GETDATE()
            WHERE owner_id = @user_id
          `);

        // 🏢 Şubeleri aktif et
        await pool.request()
          .input("user_id", sql.Int, userId)
          .query(`
            UPDATE Branches 
            SET is_active = 1, updated_at = GETDATE()
            WHERE restaurant_id IN (
              SELECT id FROM Restaurants WHERE owner_id = @user_id
            )
          `);

        console.log(`✅ Kullanıcı #${userId} aktif hale getirildi (ödeme başarılı).`);
      }

      return res.redirect(`${process.env.FRONTEND_URL || "http://localhost:5173"}/success`);
    }

    // ❌ Başarısız ödeme
    await pool.request()
      .input("token", sql.NVarChar, token)
      .input("status", sql.NVarChar, "failed")
      .query(`
        UPDATE Payments 
        SET status = @status, updated_at = GETDATE()
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
