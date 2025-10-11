import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : "http://localhost:5000/api";

export default function Register() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    address: "",
    restaurantName: "",
    package_type: "basic",
    branch_count: 1,
  });

  const [priceData, setPriceData] = useState(null);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // 💰 Paket veya şube sayısı değiştiğinde fiyatı hesapla
  useEffect(() => {
    const fetchPrice = async () => {
      if (!formData.package_type) return;
      setLoadingPrice(true);

      try {
        const response = await fetch(
          `${API_URL}/payments/calculate?package_type=${encodeURIComponent(
            formData.package_type
          )}&branches=${encodeURIComponent(formData.branch_count)}`
        );

        if (!response.ok) throw new Error("Fiyat bilgisi alınamadı.");

        const data = await response.json();
        if (data && data.formatted) {
          setPriceData(data);
        } else {
          throw new Error("Fiyat verisi hatalı döndü.");
        }
      } catch (err) {
        console.error("💸 Fiyat alınamadı:", err);
        setPriceData(null);
      } finally {
        setLoadingPrice(false);
      }
    };

    fetchPrice();
  }, [formData.package_type, formData.branch_count]);

  // 🔄 Input değişimlerini yönet
  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => {
      if (name === "package_type") {
        return {
          ...prev,
          package_type: value,
          branch_count: value === "basic" ? 1 : prev.branch_count,
        };
      }

      return {
        ...prev,
        [name]:
          name === "branch_count" ? Math.max(1, parseInt(value) || 1) : value,
      };
    });
  };

  // 🧾 Kayıt + Abonelik ödeme işlemi
  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await response.json();
      if (response.ok) {
        setMessage("Kayıt başarılı! Yönlendiriliyorsunuz...");
        // Eğer paymentPageUrl varsa otomatik yönlendir
        if (data.paymentPageUrl) {
          window.location.href = data.paymentPageUrl;
        } else {
          // Eğer ödeme linki yoksa, dashboard veya başka bir sayfaya yönlendir
          navigate("/dashboard");
        }
      } else {
        setMessage(data.message || "Kayıt başarısız.");
      }
    } catch (err) {
      setMessage("Bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-green-100 p-4">
      <div className="bg-white shadow-2xl rounded-2xl w-full max-w-md p-8">
        <h2 className="text-3xl font-bold text-center text-emerald-700 mb-6">
          Restoran Kaydı Oluştur 🍽️
        </h2>

        <form onSubmit={handleRegister} className="space-y-4">
          <input
            type="text"
            name="name"
            placeholder="Ad Soyad"
            value={formData.name}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg px-4 py-2"
            required
          />
          <input
            type="email"
            name="email"
            placeholder="E-posta"
            value={formData.email}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg px-4 py-2"
            required
          />
          <input
            type="password"
            name="password"
            placeholder="Şifre"
            value={formData.password}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg px-4 py-2"
            required
          />
          <input
            type="text"
            name="phone"
            placeholder="+905xxxxxxxxx"
            value={formData.phone}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg px-4 py-2"
            required
          />
          <input
            type="text"
            name="address"
            placeholder="Adres"
            value={formData.address}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg px-4 py-2"
            required
          />
          <input
            type="text"
            name="restaurantName"
            placeholder="Restoran Adı"
            value={formData.restaurantName}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg px-4 py-2"
            required
          />

          <div>
            <label className="block mb-1 font-semibold text-gray-700">
              Paket Seçimi
            </label>
            <select
              name="package_type"
              value={formData.package_type}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-4 py-2"
            >
              <option value="basic">Basic</option>
              <option value="advance">Advance</option>
              <option value="elevate">Elevate</option>
            </select>
          </div>

          {(formData.package_type === "advance" ||
            formData.package_type === "elevate") && (
            <div>
              <label className="block mb-1 font-semibold text-gray-700">
                Şube Sayısı
              </label>
              <input
                type="number"
                name="branch_count"
                min="1"
                value={formData.branch_count}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2"
              />
            </div>
          )}

          {/* 💰 Fiyat Bilgisi */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
            {loadingPrice ? (
              <p>💸 Fiyat hesaplanıyor...</p>
            ) : priceData ? (
              <>
                <p>
                  <strong>Aylık:</strong> {priceData.formatted.monthly}
                </p>
                <p>
                  <strong>Yıllık:</strong> {priceData.formatted.annual}
                </p>
              </>
            ) : (
              <p className="text-gray-500">Fiyat bilgisi alınamadı.</p>
            )}
          </div>

          {message && (
            <div
              className={`text-center font-medium ${
                message.includes("❌") ? "text-red-600" : "text-emerald-600"
              }`}
            >
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2 mt-2 text-white font-semibold rounded-lg transition ${
              loading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {loading ? "İşleniyor..." : "Kaydı Tamamla ve Ödemeye Geç 💳"}
          </button>
        </form>
      </div>
    </div>
  );
}
