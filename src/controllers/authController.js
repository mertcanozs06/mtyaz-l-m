// Sadece test amaçlı: Otomatik dummy kayıt fonksiyonu
export const dummyRegister = async (req, res) => {
  const random = Math.floor(Math.random() * 100000);
  const testData = {
    name: `TestUser${random}`,
    email: `test${random}@mail.com`,
    password: "Test1234!",
    phone: `05${Math.floor(100000000 + Math.random() * 899999999)}`,
    address: "Test Mahallesi, Test Sokak",
    restaurantName: `TestRestoran${random}`,
    package_type: "advance",
    branch_count: 3 + (random % 5),
  };
  req.body = testData;
  return await register(req, res);
};
// ✅ controllers/authController.js
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { poolPromise, sql } from "../config/db.js";
import { calculateTotal } from "../utils/priceCalculator.js";

/**
 * 🧾 REGISTER — Yeni restoran + şube + kullanıcı (admin) + paket oluşturur
 */
export const register = async (req, res) => {
  const pool = await poolPromise;
  const trx = pool.transaction();

  try {
    await trx.begin();

    const {
      name,
      email,
      password,
      phone,
      address,
      restaurantName,
      package_type = "basic",
      branch_count = 1,
    } = req.body;

    if (!name || !email || !password || !restaurantName) {
      await trx.rollback();
      return res.status(400).json({ message: "Eksik bilgi gönderildi." });
    }

    // 📧 E-posta kontrolü
    const emailCheck = await trx
      .request()
      .input("email", sql.NVarChar, email)
      .query("SELECT id FROM Users WHERE email = @email");

    if (emailCheck.recordset.length > 0) {
      await trx.rollback();
      return res.status(409).json({ message: "Bu e-posta zaten kayıtlı." });
    }

    // 💰 Paket hesaplama (Yıllık model: aylık fiyat × 12)
    const { monthly: monthlyPrice, branches: totalBranches } = calculateTotal(
      package_type,
      branch_count
    );
    const totalPrice = monthlyPrice * 12; // Yıllık toplam
    const pricePerBranch = totalBranches
      ? Number((monthlyPrice / totalBranches).toFixed(2))
      : monthlyPrice;

    // Telefonu kesin olarak +905... formatına çevir
    let formattedPhone = phone || "";
    formattedPhone = formattedPhone.replace(/\D/g, ""); // Sadece rakamlar kalsın
    if (formattedPhone.startsWith("90") && formattedPhone.length === 12) {
      formattedPhone = "+" + formattedPhone;
    } else if (formattedPhone.startsWith("0") && formattedPhone.length === 11) {
      formattedPhone = "+90" + formattedPhone.slice(1);
    } else if (formattedPhone.length === 10) {
      formattedPhone = "+90" + formattedPhone;
    } else if (formattedPhone.startsWith("905") && formattedPhone.length === 12) {
      formattedPhone = "+" + formattedPhone;
    } else {
      formattedPhone = "+905555555555"; // fallback
    }
    console.log("Iyzico'ya giden telefon:", formattedPhone);

    // 🍽️ Restoran ekle
    const restaurantResult = await trx
      .request()
      .input("name", sql.NVarChar, restaurantName)
      .input("address", sql.NVarChar, address || "")
      .query(`
        INSERT INTO Restaurants (name, address)
        OUTPUT INSERTED.id
        VALUES (@name, @address)
      `);
    const restaurant_id = restaurantResult.recordset[0].id;

    // 🏢 Merkez Şube
    const branchResult = await trx
      .request()
      .input("restaurant_id", sql.Int, restaurant_id)
      .input("address", sql.NVarChar, address || "")
      .input("phone", sql.NVarChar, phone || "")
      .query(`
        INSERT INTO Branches (restaurant_id, name, address, phone)
        OUTPUT INSERTED.id
        VALUES (@restaurant_id, 'Merkez Şube', @address, @phone)
      `);
    const branch_id = branchResult.recordset[0].id;

    // 👤 Kullanıcı oluştur (Admin)
    const hashedPassword = await bcrypt.hash(password, 10);
    const userResult = await trx
      .request()
      .input("restaurant_id", sql.Int, restaurant_id)
      .input("branch_id", sql.Int, branch_id)
      .input("name", sql.NVarChar, name)
      .input("email", sql.NVarChar, email)
      .input("password", sql.NVarChar, hashedPassword)
      .input("phone", sql.NVarChar, phone || "")
      .input("package_type", sql.NVarChar, package_type)
      .query(`
        INSERT INTO Users (restaurant_id, branch_id, name, email, password, phone, role, package_type, is_active, is_initial_admin, createdAt, updatedAt, last_login_at)
        OUTPUT INSERTED.id
        VALUES (@restaurant_id, @branch_id, @name, @email, @password, @phone, 'admin', @package_type, 0, 1, GETDATE(), GETDATE(), NULL)
      `);
    const user_id = userResult.recordset[0].id;


    // 📦 Paket kaydı (30 gün deneme - trial sonrası ödeme ile aktifleşir)
    await trx
      .request()
      .input("user_id", sql.Int, user_id)
      .input("package_type", sql.NVarChar, package_type)
      .input("max_branches", sql.Int, totalBranches)
      .input("price_per_branch", sql.Decimal(18, 2), pricePerBranch)
      .input("total_price", sql.Decimal(18, 2), totalPrice)
      .input("trial_start_date", sql.DateTime, new Date())
      .input(
        "trial_end_date",
        sql.DateTime,
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      )
      .input("is_trial_active", sql.Bit, 1)
      .query(`
        INSERT INTO UserPackages
          (user_id, package_type, max_branches, price_per_branch, total_price, trial_start_date, trial_end_date, is_trial_active, created_at, updated_at)
        VALUES
          (@user_id, @package_type, @max_branches, @price_per_branch, @total_price, @trial_start_date, @trial_end_date, @is_trial_active, GETDATE(), GETDATE())
      `);

    // 💳 Iyzico ödeme başlat (SDK ile)
    const { createIyzicoPayment } = await import("../services/iyzicoService.js");
    const conversationId = `reg_${user_id}_${Date.now()}`;
    const basketItems = [
      {
        id: String(user_id),
        name: `${package_type.toUpperCase()} Paketi (${totalBranches} şube)`,
        category1: "Abonelik",
        category2: "Yazılım",
        itemType: "VIRTUAL",
        price: Number(totalPrice).toFixed(2),
      },
    ];
    const callbackUrl = `${process.env.BASE_URL || "http://localhost:5000"}/api/subscription/callback`;
    console.log("Iyzico payment params:", {
      conversationId,
      price: Number(totalPrice).toFixed(2),
      paidPrice: Number(totalPrice).toFixed(2),
      user: { id: user_id, name, email, phone: formattedPhone },
      basketItems,
      callbackUrl,
    });
    const iyzicoResponse = await createIyzicoPayment({
      conversationId,
      price: Number(totalPrice),
      paidPrice: Number(totalPrice),
      user: {
        id: user_id,
        name: name || "Kullanıcı",
        email: email || "test@example.com",
        phone: formattedPhone,
      },
      basketItems,
      callbackUrl,
    });
    if (iyzicoResponse && iyzicoResponse.errorMessage) {
      console.error("Iyzico error detail:", iyzicoResponse.errorMessage);
    }

    let paymentPageUrl = null;
    if (iyzicoResponse && iyzicoResponse.success && iyzicoResponse.paymentPageUrl) {
      paymentPageUrl = iyzicoResponse.paymentPageUrl;
    }

    // 🔐 JWT token
    const token = jwt.sign(
      {
        user_id,
        email,
        restaurant_id,
        branch_id,
        role: "admin",
      },
      process.env.JWT_SECRET || "your_jwt_secret",
      { expiresIn: "8h" }
    );

    await trx.commit();

    console.log(`✅ Yeni kullanıcı kaydı: ${email}`);

    return res.status(201).json({
      message: "Kayıt başarılı.",
      token,
      user_id,
      restaurant_id,
      branch_id,
      package_type,
      totalBranches,
      totalPrice,
      paymentPageUrl, // ödeme linki frontend'e dönülüyor
    });
  } catch (err) {
    console.error("❌ Register Error:", err);
    try {
      await trx.rollback();
    } catch {}
    return res
      .status(500)
      .json({ message: "Sunucu hatası: Kayıt başarısız.", error: err.message });
  }
};

/**
 * 🔑 LOGIN — Email + Şifre kontrolü → JWT döner
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Eksik bilgi gönderildi." });

    const pool = await poolPromise;
    const userResult = await pool
      .request()
      .input("email", sql.NVarChar, email)
      .query(`SELECT TOP 1 * FROM Users WHERE email = @email`);

    const user = userResult.recordset[0];
    if (!user)
      return res.status(401).json({ message: "E-posta veya şifre hatalı." });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ message: "E-posta veya şifre hatalı." });

    // 🎟️ Paket durumu kontrolü
    const packageResult = await pool
      .request()
      .input("user_id", sql.Int, user.id)
      .query(`SELECT TOP 1 * FROM UserPackages WHERE user_id = @user_id ORDER BY created_at DESC`);

    const userPackage = packageResult.recordset[0];
    if (!userPackage || (!user.is_active && !userPackage.is_trial_active)) {
      return res.status(403).json({ message: "Hesabınız aktif değil. Ödeme yapmanız gerekiyor." });
    }

    // 👥 Şube kontrolü
    const branchesResult = await pool
      .request()
      .input("restaurant_id", sql.Int, user.restaurant_id)
      .query(`SELECT id, name FROM Branches WHERE restaurant_id = @restaurant_id`);

    const branches = branchesResult.recordset;
    if (!branches || branches.length === 0) {
      return res.status(404).json({ message: "Bu restorana ait şube bulunamadı." });
    }

    // 🔐 Token oluştur
    const token = jwt.sign(
      {
        user_id: user.id,
        email: user.email,
        restaurant_id: user.restaurant_id,
        branch_id: user.branch_id,
        role: user.role,
      },
      process.env.JWT_SECRET || "your_jwt_secret",
      { expiresIn: "8h" }
    );

    console.log(`✅ Kullanıcı girişi: ${email}`);

    return res.json({
      message: "Giriş başarılı.",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        restaurant_id: user.restaurant_id,
        branch_id: user.branch_id,
        package_type: user.package_type || "basic",
      },
      branches,
      package: userPackage ? {
        type: userPackage.package_type,
        status: user.is_active ? "active" : (userPackage.is_trial_active ? "trial" : "inactive"),
        trial_end_date: userPackage.trial_end_date,
      } : null,
    });
  } catch (err) {
    console.error("❌ Login Error:", err);
    return res
      .status(500)
      .json({ message: "Sunucu hatası.", error: err.message });
  }
};
