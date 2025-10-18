import { createIyzicoPayment } from "./iyzicoService.js";

(async () => {
  console.log("🧪 Iyzico Sandbox Test Başlatılıyor...");

  const result = await createIyzicoPayment({
    conversationId: "test_001",
    price: 1000,
    paidPrice: 1000,
    user: {
      id: 1,
      name: "Test User",
      email: "test@test.com",
      phone: "+905555555555",
    },
    basketItems: [
      {
        id: "1",
        name: "Test Paket",
        category1: "Abonelik",
        itemType: "VIRTUAL",
        price: "1000.00",
        category2: "Yazılım",
      },
    ],
    callbackUrl: "http://localhost:5000/api/subscription/callback",
  });

  console.log("💳 Test Payment Result:", JSON.stringify(result, null, 2));

  if (result.success) {
    console.log("✅ Test başarılı! Ödeme URL:", result.paymentPageUrl);
  } else {
    console.log("❌ Test başarısız:", result.errorMessage);
  }
})();
