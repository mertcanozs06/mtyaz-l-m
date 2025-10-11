import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

// 🔐 Ortam değişkenleri
const IYZICO_API_KEY = process.env.IYZICO_API_KEY;
const IYZICO_SECRET_KEY = process.env.IYZICO_SECRET_KEY;
const IYZICO_BASE_URL = process.env.IYZICO_BASE_URL || "https://sandbox-api.iyzipay.com";

// 🧮 SHA1 → Base64 imza oluşturucu
const generateSignature = (data) => {
  const hash = crypto.createHash("sha1").update(data).digest("base64");
  return hash;
};

/**
 * 💳 Iyzico ödeme oluşturma servisi
 * createSubscription() → burayı çağırır
 */
export const createIyzicoPayment = async ({
  conversationId,
  price,
  paidPrice,
  user,
  basketItems,
  callbackUrl,
}) => {
  try {
    const body = {
      locale: "tr",
      conversationId,
      price: price.toFixed(2),
      paidPrice: paidPrice.toFixed(2),
      currency: "TRY",
      installment: 1,
      basketId: `BASKET_${conversationId}`,
      paymentGroup: "PRODUCT",
      callbackUrl,
      buyer: {
        id: String(user.id),
        name: user.name || "Kullanıcı",
        surname: "Admin",
        gsmNumber: user.phone || "+905555555555",
        email: user.email,
        identityNumber: "11111111111",
        lastLoginDate: new Date().toISOString(),
        registrationDate: new Date().toISOString(),
        registrationAddress: "Türkiye",
        ip: "85.34.78.112",
        city: "İstanbul",
        country: "Turkey",
      },
      shippingAddress: {
        contactName: user.name || "Kullanıcı",
        city: "İstanbul",
        country: "Turkey",
        address: "Online Hizmet",
      },
      billingAddress: {
        contactName: user.name || "Kullanıcı",
        city: "İstanbul",
        country: "Turkey",
        address: "Online Hizmet",
      },
      basketItems,
    };

    // 🔐 Authorization Header
    const randomString = crypto.randomBytes(8).toString("hex");
    const authContent = `${IYZICO_API_KEY}${randomString}${IYZICO_SECRET_KEY}`;
    const signature = generateSignature(authContent);

    const headers = {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `IYZWS ${IYZICO_API_KEY}:${signature}:${randomString}`,
    };

    console.log("🚀 Iyzico ödeme isteği gönderiliyor...");

    const response = await fetch(`${IYZICO_BASE_URL}/payment/iyzipos/initialize`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const result = await response.json();

    if (result.status === "success" && result.paymentPageUrl && result.token) {
      console.log("✅ Iyzico ödeme oluşturuldu:", result.paymentPageUrl);
      return {
        success: true,
        token: result.token,
        paymentPageUrl: result.paymentPageUrl,
      };
    }

    console.warn("⚠️ Iyzico ödeme hatası:", result.errorMessage);
    return {
      success: false,
      errorMessage: result.errorMessage || "Ödeme başlatılamadı.",
    };
  } catch (err) {
    console.error("💥 createIyzicoPayment hata:", err.message);
    return { success: false, errorMessage: err.message };
  }
};

/**
 * 🔍 Iyzico ödeme doğrulama servisi
 * handleIyzicoCallback() → burayı çağırır
 */
export const verifyPayment = async (token) => {
  try {
    const randomString = crypto.randomBytes(8).toString("hex");
    const authContent = `${IYZICO_API_KEY}${randomString}${IYZICO_SECRET_KEY}`;
    const signature = generateSignature(authContent);

    const headers = {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `IYZWS ${IYZICO_API_KEY}:${signature}:${randomString}`,
    };

    console.log("🔍 Iyzico ödeme doğrulama başlatıldı...");

    const response = await fetch(`${IYZICO_BASE_URL}/payment/detail`, {
      method: "POST",
      headers,
      body: JSON.stringify({ token }),
    });

    const result = await response.json();

    if (result.status === "success") {
      console.log("✅ Ödeme doğrulandı:", token);
      return { status: "success", raw: result };
    }

    console.warn("⚠️ Ödeme doğrulama başarısız:", result.errorMessage);
    return {
      status: "failed",
      errorMessage: result.errorMessage || "Ödeme doğrulanamadı.",
      raw: result,
    };
  } catch (err) {
    console.error("💥 verifyPayment hata:", err.message);
    return { status: "failed", errorMessage: err.message };
  }
};

/**
 * 🧹 Iyzico hata mesajı formatlayıcı
 */
export const formatIyzicoError = (errMsg) => {
  if (!errMsg) return "Bilinmeyen bir hata oluştu.";
  if (errMsg.includes("Do not honour")) return "Kart reddedildi, lütfen farklı bir kart deneyin.";
  if (errMsg.includes("Invalid Card Number")) return "Kart numarası geçersiz.";
  if (errMsg.includes("Insufficient Funds")) return "Yetersiz bakiye.";
  if (errMsg.includes("Expired Card")) return "Kart süresi dolmuş.";
  return errMsg;
};

export default {
  createIyzicoPayment,
  verifyPayment,
  formatIyzicoError,
};
