import express from "express";
import sql from "mssql";
import { createPayment, verifyPayment, formatIyzicoError } from "../services/iyzicoService.js";
import { calculateTotal } from "../utils/priceCalculator.js";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

/**
 * ✅ 1️⃣ Ödeme oluşturma endpoint’i
 * Kullanıcı kayıt sırasında veya dashboard üzerinden şube artırma / paket yenileme için ödeme başlatır.
 */
router.post("/create", async (req, res) => {
  const { user_id, package_type, branch_count, is_upgrade } = req.body;

  try {
    if (!user_id || !package_type) {
      return res.status(400).json({ message: "user_id ve package_type zorunludur" });
    }

    // 1️⃣ Kullanıcı bilgilerini çek
    const userQuery = await sql.query`
      SELECT id, name, email, phone, restaurant_id 
      FROM Users WHERE id = ${user_id}
    `;
    if (userQuery.recordset.length === 0) {
      return res.status(404).json({ message: "Kullanıcı bulunamadı" });
    }

    const user = userQuery.recordset[0];

    // 2️⃣ Toplam fiyatı hesapla (utils/priceCalculator)
    const priceInfo = calculatePrice(package_type, branch_count);
    const { totalPrice } = priceInfo;

    // 3️⃣ İyzico ödeme isteğini hazırla
    const paymentData = {
      price: totalPrice,
      paidPrice: totalPrice,
      conversationId: `pay_${Date.now()}`,
      buyer: {
        id: user.id,
        name: user.name || "Müşteri",
        surname: user.name || "Soyad",
        email: user.email,
        phone: user.phone || "+905555555555",
        city: "İstanbul",
        country: "Turkey",
        address: "Online ödeme",
        ip: req.ip || "85.34.78.112",
      },
      card: req.body.card, // Frontend'den kart bilgileri gelir
      basketItems: [
        {
          id: `PKG_${package_type}`,
          name: `${package_type} Paketi`,
          category: "Abonelik",
          price: totalPrice,
        },
      ],
      callbackUrl: `${process.env.BASE_URL}/api/payments/callback`,
    };

    const result = await createPayment(paymentData);

    // 4️⃣ Başarılı sonuç döndür
    return res.status(200).json({
      success: true,
      message: "Ödeme işlemi başlatıldı",
      paymentData: result.result,
      redirectUrl: result.result.paymentPageUrl, // Kullanıcıyı yönlendireceğin URL
    });
  } catch (error) {
    console.error("💥 /payments/create hata:", error);
    return res.status(500).json({
      success: false,
      message: "Ödeme oluşturulamadı",
      error: formatIyzicoError(error),
    });
  }
});

/**
 * ✅ 2️⃣ Callback Endpoint — İyzico'dan dönüş alır
 * Ödeme başarılıysa UserPackages tablosuna kayıt ekler
 */
router.post("/callback", async (req, res) => {
  const { token } = req.body;

  try {
    const result = await verifyPayment(token);

    if (!result.success) {
      return res.status(400).json({ message: "Ödeme doğrulanamadı", result });
    }

    const conversationId = result.conversationId;
    const paidPrice = parseFloat(result.paidPrice);

    // conversationId üzerinden kullanıcıyı bulmak için basit bir örnek
    // (Gerçek uygulamada session veya veritabanı cache kullanılmalı)
    const user_id = conversationId.split("_")[1];

    // Kullanıcının son paketini bul
    const existingPackage = await sql.query`
      SELECT TOP 1 * FROM UserPackages WHERE user_id = ${user_id} ORDER BY created_at DESC
    `;

    let newMaxBranches = null;
    let packageType = null;

    if (existingPackage.recordset.length > 0) {
      packageType = existingPackage.recordset[0].package_type;
      newMaxBranches =
        existingPackage.recordset[0].max_branches + (paidPrice / calculatePrice(packageType, 1).totalPrice);
    }

    // 3️⃣ Yeni ödeme kaydını Payments tablosuna ekle
    await sql.query`
      INSERT INTO Payments (customer_order_id, amount, payment_method, transaction_id, paid_at)
      VALUES (NULL, ${paidPrice}, 'iyzico', ${conversationId}, GETDATE())
    `;

    // 4️⃣ UserPackages güncelle veya ekle
    if (existingPackage.recordset.length > 0) {
      await sql.query`
        UPDATE UserPackages
        SET max_branches = ${newMaxBranches},
            created_at = GETDATE()
        WHERE user_id = ${user_id}
      `;
    } else {
      await sql.query`
        INSERT INTO UserPackages (user_id, package_type, max_branches, created_at)
        VALUES (${user_id}, ${packageType || "basic"}, ${newMaxBranches || 1}, GETDATE())
      `;
    }

    return res.status(200).json({
      success: true,
      message: "Ödeme başarıyla tamamlandı ve paket güncellendi",
      result,
    });
  } catch (error) {
    console.error("💥 /payments/callback hata:", error);
    return res.status(500).json({
      success: false,
      message: "Callback işlenemedi",
      error: formatIyzicoError(error),
    });
  }
});

/**
 * ✅ 3️⃣ Kullanıcının ödeme geçmişi
 */
router.get("/history/:user_id", async (req, res) => {
  const { user_id } = req.params;
  try {
    const result = await sql.query`
      SELECT p.id, p.amount, p.payment_method, p.paid_at, up.package_type, up.max_branches
      FROM Payments p
      LEFT JOIN UserPackages up ON up.user_id = ${user_id}
      WHERE up.user_id = ${user_id}
      ORDER BY p.paid_at DESC
    `;

    return res.status(200).json({
      success: true,
      history: result.recordset,
    });
  } catch (error) {
    console.error("💥 /payments/history hata:", error);
    res.status(500).json({ success: false, message: "Geçmiş ödemeler getirilemedi" });
  }
});

export default router;
