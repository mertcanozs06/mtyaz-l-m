// services/iyzicoService.js (DEĞİŞMEDİ)
import Iyzipay from "iyzipay";
import dotenv from "dotenv";
dotenv.config();

const IYZICO_API_KEY = process.env.IYZICO_API_KEY;
const IYZICO_SECRET_KEY = process.env.IYZICO_SECRET_KEY;
const IYZICO_BASE_URL = process.env.IYZICO_BASE_URL || "https://sandbox-api.iyzipay.com";
const BASE_URL = process.env.BASE_URL || "http://localhost:5000";

const iyzipay = new Iyzipay({
  apiKey: IYZICO_API_KEY,
  secretKey: IYZICO_SECRET_KEY,
  uri: IYZICO_BASE_URL,
});

export const createIyzicoPayment = async ({
  conversationId,
  price,
  paidPrice,
  user,
  basketItems,
  callbackUrl,
}) => {
  try {
    console.log("Iyzico SDK ile ödeme başlatılıyor...");
    let formattedPhone = user.phone || "";
    formattedPhone = formattedPhone.replace(/\D/g, "");
    if (formattedPhone.startsWith("90") && formattedPhone.length === 12) {
      formattedPhone = "+" + formattedPhone;
    } else if (formattedPhone.startsWith("0") && formattedPhone.length === 11) {
      formattedPhone = "+90" + formattedPhone.slice(1);
    } else if (formattedPhone.length === 10) {
      formattedPhone = "+90" + formattedPhone;
    } else {
      formattedPhone = "+905555555555";
    }
    const email = user.email && user.email.includes("@") ? user.email : "test@example.com";
    if (!basketItems || !Array.isArray(basketItems) || basketItems.length === 0) {
      return { success: false, errorMessage: "Sepet öğeleri eksik.", errorCode: "INVALID_BASKET_ITEMS" };
    }

    const priceValue = parseFloat(price);
    const paidPriceValue = parseFloat(paidPrice);
    const fullName = user.name || "User";
    const nameParts = fullName.split(" ");
    const buyerName = nameParts[0] || "User";
    const buyerSurname = nameParts.slice(1).join(" ") || nameParts[0];

    const request = {
      locale: Iyzipay.LOCALE.TR,
      conversationId,
      price: priceValue.toFixed(2),
      paidPrice: paidPriceValue.toFixed(2),
      currency: Iyzipay.CURRENCY.TRY,
      installment: "1",
      basketId: `BASKET_${conversationId}`,
      paymentGroup: Iyzipay.PAYMENT_GROUP.SUBSCRIPTION,
      callbackUrl: callbackUrl || `${BASE_URL}/api/subscription/callback`,
      buyer: {
        id: user.id.toString(),
        name: buyerName,
        surname: buyerSurname,
        gsmNumber: formattedPhone,
        email,
        identityNumber: "11111111111",
        lastLoginDate: new Date().toISOString().replace("T", " ").slice(0, 19),
        registrationDate: new Date().toISOString().replace("T", " ").slice(0, 19),
        registrationAddress: "Turkey",
        ip: "85.110.245.12",
        city: "Istanbul",
        country: "Turkey",
      },
      shippingAddress: { contactName: `${buyerName} ${buyerSurname}`, city: "Istanbul", country: "Turkey", address: "Online Service" },
      billingAddress: { contactName: `${buyerName} ${buyerSurname}`, city: "Istanbul", country: "Turkey", address: "Online Service" },
      basketItems: basketItems.map((item) => ({
        id: item.id || String(Date.now()),
        name: item.name,
        category1: item.category1 || "Abonelik",
        category2: item.category2 || "Yazılım",
        itemType: Iyzipay.BASKET_ITEM_TYPE.VIRTUAL,
        price: parseFloat(item.price).toFixed(2),
      })),
    };

    return new Promise((resolve) => {
      iyzipay.checkoutFormInitialize.create(request, (err, result) => {
        if (err) {
          console.error("Iyzico SDK hatası:", err);
          resolve({ success: false, errorMessage: formatIyzicoError(err.errorMessage || "SDK hatası"), errorCode: err.errorCode || "SDK_ERROR" });
          return;
        }
        if (result.status === "success" && result.paymentPageUrl && result.token) {
          resolve({ success: true, token: result.token, paymentPageUrl: result.paymentPageUrl, paymentId: result.paymentId || null });
        } else {
          resolve({ success: false, errorMessage: formatIyzicoError(result.errorMessage || "Ödeme başlatılamadı."), errorCode: result.errorCode || "UNKNOWN_ERROR" });
        }
      });
    });
  } catch (err) {
    console.error("createIyzicoPayment SDK hatası:", err.message);
    return { success: false, errorMessage: err.message, errorCode: "INTERNAL_ERROR" };
  }
};

export const verifyPayment = async (token) => {
  try {
    const request = { locale: Iyzipay.LOCALE.TR, token };
    return new Promise((resolve) => {
      iyzipay.checkoutForm.retrieve(request, (err, result) => {
        if (err) {
          resolve({ status: "failed", errorMessage: formatIyzicoError(err.errorMessage || "Doğrulama hatası"), errorCode: err.errorCode || "SDK_ERROR" });
          return;
        }
        if (result.status === "success") {
          resolve({ status: "success", paymentId: result.paymentId, amount: result.paidPrice, currency: result.currency, paymentStatus: result.paymentStatus });
        } else {
          resolve({ status: "failed", errorMessage: formatIyzicoError(result.errorMessage || "Ödeme doğrulanamadı."), errorCode: result.errorCode || "UNKNOWN_ERROR" });
        }
      });
    });
  } catch (err) {
    return { status: "failed", errorMessage: err.message, errorCode: "INTERNAL_ERROR" };
  }
};

export const formatIyzicoError = (errMsg) => {
  if (!errMsg) return "Bilinmeyen hata.";
  if (errMsg.includes("Do not honour")) return "Kart reddedildi.";
  if (errMsg.includes("Invalid Card Number")) return "Kart numarası geçersiz.";
  if (errMsg.includes("Insufficient Funds")) return "Yetersiz bakiye.";
  if (errMsg.includes("Expired Card")) return "Kart süresi dolmuş.";
  return errMsg;
};

export default { createIyzicoPayment, verifyPayment, formatIyzicoError };