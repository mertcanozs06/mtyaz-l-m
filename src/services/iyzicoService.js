import Iyzipay from "iyzipay";
import dotenv from "dotenv";

dotenv.config();

// 🔐 Ortam değişkenleri
const IYZICO_API_KEY = process.env.IYZICO_API_KEY;
const IYZICO_SECRET_KEY = process.env.IYZICO_SECRET_KEY;
const IYZICO_BASE_URL = process.env.IYZICO_BASE_URL || "https://sandbox-api.iyzipay.com";
const BASE_URL = process.env.BASE_URL || "http://localhost:5000";

// 🏗️ Iyzipay SDK konfigürasyonu
const iyzipay = new Iyzipay({
  apiKey: IYZICO_API_KEY,
  secretKey: IYZICO_SECRET_KEY,
  uri: IYZICO_BASE_URL,
});

/**
 * 💳 Iyzico ödeme oluşturma servisi (SDK ile)
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
    console.log("🚀 Iyzico SDK ile ödeme başlatılıyor...");

    // 📞 Telefon formatı
    let formattedPhone = user.phone || "";
    formattedPhone = formattedPhone.replace(/\D/g, "");
    if (formattedPhone.startsWith("90") && formattedPhone.length === 12) {
      formattedPhone = "+" + formattedPhone;
    } else if (formattedPhone.startsWith("0") && formattedPhone.length === 11) {
      formattedPhone = "+90" + formattedPhone.slice(1);
    } else if (formattedPhone.length === 10) {
      formattedPhone = "+90" + formattedPhone;
    } else {
      formattedPhone = "+905555555555"; // Fallback telefon numarası
    }

    // Email doğrulama
    const email = user.email && user.email.includes("@") ? user.email : "test@example.com";

    // BasketItems doğrulama
    if (!basketItems || !Array.isArray(basketItems) || basketItems.length === 0) {
      console.error("❌ basketItems eksik veya geçersiz:", basketItems);
      return {
        success: false,
        errorMessage: "Sepet öğeleri eksik veya geçersiz.",
        errorCode: "INVALID_BASKET_ITEMS",
      };
    }

    // Price ve paidPrice aynı (KDV olmadan)
    const priceValue = parseFloat(price);
    const paidPriceValue = parseFloat(paidPrice);

    // Name ve surname ayırma
    const fullName = user.name || "User";
    const nameParts = fullName.split(" ");
    const buyerName = nameParts[0] || "User";
    const buyerSurname = nameParts.slice(1).join(" ") || nameParts[0];

    // SDK için request objesi
    const request = {
      locale: Iyzipay.LOCALE.TR,
      conversationId,
      price: priceValue.toFixed(2),
      paidPrice: paidPriceValue.toFixed(2),
      currency: Iyzipay.CURRENCY.TRY,
      installment: '12', // 12 taksit (vade farkı olmadan yıllık)
      basketId: `BASKET_${conversationId}`,
      paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT,
      callbackUrl: callbackUrl || `${BASE_URL}/api/subscription/callback`,
      buyer: {
        id: user.id.toString(),
        name: buyerName,
        surname: buyerSurname,
        gsmNumber: formattedPhone,
        email,
        identityNumber: "11111111111", // Sandbox dummy TC Kimlik
        lastLoginDate: new Date().toISOString().replace('T', ' ').slice(0, 19),
        registrationDate: new Date().toISOString().replace('T', ' ').slice(0, 19),
        registrationAddress: "Turkey",
        ip: "85.110.245.12",
        city: "Istanbul",
        country: "Turkey",
      },
      shippingAddress: {
        contactName: `${buyerName} ${buyerSurname}`,
        city: "Istanbul",
        country: "Turkey",
        address: "Online Service",
      },
      billingAddress: {
        contactName: `${buyerName} ${buyerSurname}`,
        city: "Istanbul",
        country: "Turkey",
        address: "Online Service",
      },
      basketItems: basketItems.map(item => ({
        id: item.id || String(Date.now()),
        name: item.name,
        category1: item.category1 || "Abonelik",
        category2: item.category2 || "Yazılım",
        itemType: Iyzipay.BASKET_ITEM_TYPE.VIRTUAL,
        price: parseFloat(item.price).toFixed(2),
      })),
    };

    console.log("📋 SDK Request:", JSON.stringify(request, null, 2));

    // SDK ile ödeme başlat
    return new Promise((resolve) => {
      iyzipay.checkoutFormInitialize.create(request, (err, result) => {
        if (err) {
          console.error("❌ Iyzico SDK hatası:", err);
          resolve({
            success: false,
            errorMessage: formatIyzicoError(err.errorMessage || "SDK hatası"),
            errorCode: err.errorCode || "SDK_ERROR",
            rawError: err,
          });
          return;
        }

        console.log("📥 SDK Response:", JSON.stringify(result, null, 2));

        if (result.status === "success" && result.paymentPageUrl && result.token) {
          console.log("✅ Iyzico ödeme SDK ile oluşturuldu:", result.paymentPageUrl);
          resolve({
            success: true,
            token: result.token,
            paymentPageUrl: result.paymentPageUrl,
          });
        } else {
          console.warn("⚠️ Iyzico SDK ödeme hatası:", {
            errorMessage: result.errorMessage,
            errorCode: result.errorCode,
            rawResponse: result,
          });
          resolve({
            success: false,
            errorMessage: formatIyzicoError(result.errorMessage || "Ödeme başlatılamadı."),
            errorCode: result.errorCode || "UNKNOWN_ERROR",
            rawResponse: result,
          });
        }
      });
    });

  } catch (err) {
    console.error("💥 createIyzicoPayment SDK hatası:", err.message, err.stack);
    return {
      success: false,
      errorMessage: err.message,
      errorCode: "INTERNAL_ERROR",
      rawResponse: null,
    };
  }
};

/**
 * 🔍 Ödeme doğrulama servisi (SDK ile)
 * handleIyzicoCallback() → burayı çağırır
 */
export const verifyPayment = async (token) => {
  try {
    console.log("🔍 Iyzico SDK ile ödeme doğrulama başlatıldı, token:", token);

    const request = {
      token: token,
    };

    return new Promise((resolve) => {
      iyzipay.checkoutForm.retrieve(request, (err, result) => {
        if (err) {
          console.error("❌ Iyzico SDK doğrulama hatası:", err);
          resolve({
            status: "failed",
            errorMessage: formatIyzicoError(err.errorMessage || "Doğrulama hatası"),
            errorCode: err.errorCode || "SDK_ERROR",
            raw: err,
          });
          return;
        }

        console.log("📥 SDK Doğrulama Response:", JSON.stringify(result, null, 2));

        if (result.status === "success") {
          console.log("✅ Ödeme SDK ile doğrulandı:", token);
          resolve({ status: "success", raw: result });
        } else {
          console.warn("⚠️ Ödeme doğrulama başarısız:", {
            errorMessage: result.errorMessage,
            errorCode: result.errorCode,
            raw: result,
          });
          resolve({
            status: "failed",
            errorMessage: formatIyzicoError(result.errorMessage || "Ödeme doğrulanamadı."),
            errorCode: result.errorCode || "UNKNOWN_ERROR",
            raw: result,
          });
        }
      });
    });

  } catch (err) {
    console.error("💥 verifyPayment SDK hatası:", err.message, err.stack);
    return {
      status: "failed",
      errorMessage: err.message,
      errorCode: "INTERNAL_ERROR",
      raw: null,
    };
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
  if (errMsg.includes("Invalid request")) return "Geçersiz istek. Lütfen bilgilerinizi kontrol edin.";
  return errMsg;
};

export default {
  createIyzicoPayment,
  verifyPayment,
  formatIyzicoError,
};
