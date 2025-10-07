// services/iyzicoService.js
import Iyzipay from 'iyzipay';
import dotenv from 'dotenv';
dotenv.config();

// .env'den bilgileri al
const iyzipay = new Iyzipay({
  apiKey: process.env.IYZI_API_KEY,
  secretKey: process.env.IYZI_SECRET_KEY,
  uri: process.env.IYZI_BASE_URL || 'https://sandbox-api.iyzipay.com',
});

/**
 * ✅ Ödeme oluşturur (register veya ek şube için)
 * @param {Object} paymentData
 * @returns {Promise<Object>}
 */
export const createPayment = async (paymentData) => {
  const {
    price, // toplam tutar (ör. 7200)
    paidPrice, // ödenecek tutar (genelde aynı)
    currency = Iyzipay.CURRENCY.TRY,
    conversationId,
    buyer,
    basketItems,
    callbackUrl,
    card,
  } = paymentData;

  try {
    const request = {
      locale: Iyzipay.LOCALE.TR,
      conversationId: conversationId || `conv_${Date.now()}`,
      price: price.toFixed(2),
      paidPrice: paidPrice.toFixed(2),
      currency,
      installment: '1',
      basketId: basketItems && basketItems.length > 0 ? basketItems[0].id : 'BASKET001',
      paymentChannel: Iyzipay.PAYMENT_CHANNEL.WEB,
      paymentGroup: Iyzipay.PAYMENT_GROUP.SUBSCRIPTION,
      callbackUrl: callbackUrl || `${process.env.BASE_URL}/api/payments/callback`,

      buyer: {
        id: buyer.id,
        name: buyer.name,
        surname: buyer.surname,
        gsmNumber: buyer.phone,
        email: buyer.email,
        identityNumber: buyer.identityNumber || '11111111111',
        registrationAddress: buyer.address || 'Türkiye',
        city: buyer.city || 'İstanbul',
        country: 'Turkey',
        ip: buyer.ip || '85.34.78.112',
      },

      billingAddress: {
        contactName: `${buyer.name} ${buyer.surname}`,
        city: buyer.city || 'İstanbul',
        country: 'Turkey',
        address: buyer.address || 'Türkiye',
      },

      paymentCard: {
        cardHolderName: card.cardHolderName,
        cardNumber: card.cardNumber,
        expireMonth: card.expireMonth,
        expireYear: card.expireYear,
        cvc: card.cvc,
        registerCard: '0',
      },

      basketItems: basketItems.map((item) => ({
        id: item.id,
        name: item.name,
        category1: item.category || 'Abonelik',
        itemType: Iyzipay.BASKET_ITEM_TYPE.VIRTUAL,
        price: item.price.toFixed(2),
      })),
    };

    return new Promise((resolve, reject) => {
      iyzipay.payment.create(request, (err, result) => {
        if (err) {
          console.error('Iyzico ödeme hatası:', err);
          return reject({ success: false, error: err });
        }

        if (result.status !== 'success') {
          console.warn('Iyzico hata:', result.errorMessage);
          return reject({ success: false, error: result.errorMessage });
        }

        resolve({
          success: true,
          paymentId: result.paymentId,
          conversationId: result.conversationId,
          status: result.status,
          result,
        });
      });
    });
  } catch (error) {
    console.error('createPayment genel hata:', error);
    throw new Error(error.message);
  }
};

/**
 * ✅ Callback doğrulama (ödeme tamamlandıktan sonra Iyzico'dan gelen yanıtı işler)
 * @param {string} token
 * @returns {Promise<Object>}
 */
export const verifyPayment = async (token) => {
  try {
    const request = { locale: Iyzipay.LOCALE.TR, token };

    return new Promise((resolve, reject) => {
      iyzipay.payment.retrieve(request, (err, result) => {
        if (err) {
          console.error('Iyzico doğrulama hatası:', err);
          return reject({ success: false, error: err });
        }

        if (result.status !== 'success') {
          console.warn('Ödeme doğrulama başarısız:', result.errorMessage);
          return reject({ success: false, error: result.errorMessage });
        }

        resolve({
          success: true,
          status: result.status,
          paymentId: result.paymentId,
          conversationId: result.conversationId,
          price: result.price,
          paidPrice: result.paidPrice,
          result,
        });
      });
    });
  } catch (error) {
    console.error('verifyPayment genel hata:', error);
    throw new Error(error.message);
  }
};

/**
 * ✅ Hata formatlayıcı
 */
export const formatIyzicoError = (err) => {
  if (!err) return 'Bilinmeyen hata';
  if (err.errorMessage) return err.errorMessage;
  if (err.message) return err.message;
  return JSON.stringify(err);
};

export default {
  createPayment,
  verifyPayment,
  formatIyzicoError,
};
