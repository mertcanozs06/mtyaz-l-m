import React from 'react';
import { FaCheckCircle, FaClock, FaUser } from 'react-icons/fa';

const FiyatListesi = () => {
  const packages = [
    {
      id: 1,
      name: "Basic Paket",
      oldPrice: 400,
      newPrice: 360,
      features: [
        { icon: <FaCheckCircle className="text-green-500 mr-2" />, text: "Sınırsız QR Menü Oluşturma" },
        { icon: <FaClock className="text-blue-500 mr-2" />, text: "Sınırsız Menü/Ürün Ekleme ve Silme" },
        { icon: <FaUser className="text-purple-500 mr-2" />, text: "Sınırsız Kullanıcı Ekleme ve Silme" },
        { icon: <FaCheckCircle className="text-green-500 mr-2" />, text: "Sınırsız Masa  Ekleme ve Silme" },
        { icon: <FaCheckCircle className="text-green-500 mr-2" />, text: "Sınırsız Bölge  Ekleme ve Silme" },
      ],
    },
    {
      id: 2,
      name: "Pro Paket",
      oldPrice: 800,
      newPrice: 720,
      features: [
        { icon: <FaCheckCircle className="text-green-500 mr-2" />, text: "Sınırsız QR Menü Oluşturma" },
        { icon: <FaClock className="text-blue-500 mr-2" />, text: "Sınırsız Menü/Ürün Ekleme ve Silme" },
        { icon: <FaUser className="text-purple-500 mr-2" />, text: "Sınırsız Kullanıcı Ekleme ve Silme" },
        { icon: <FaCheckCircle className="text-green-500 mr-2" />, text: "Sınırsız Masa  Ekleme ve Silme" },
        { icon: <FaCheckCircle className="text-green-500 mr-2" />, text: "Sınırsız Bölge  Ekleme ve Silme" },
        { icon: <FaCheckCircle className="text-green-500 mr-2" />, text: "Sipariş Yönetim Modülü" },
        { icon: <FaCheckCircle className="text-green-500 mr-2" />, text: "Garson Paneli" },
        { icon: <FaCheckCircle className="text-green-500 mr-2" />, text: "Mutfak Paneli" },
        { icon: <FaCheckCircle className="text-green-500 mr-2" />, text: "En Fazla 20 Şube Ekleme" },
        { icon: <FaCheckCircle className="text-green-500 mr-2" />, text: "Tüm Şubelerinizi Tek Yerden Yönetme" },
      ],
    },
    {
      id: 3,
      name: "Premium Paket",
      oldPrice: 1199.00,
      newPrice: 1000.00,
      features: [
        { icon: <FaCheckCircle className="text-green-500 mr-2" />, text: "Sınırsız QR Menü Oluşturma" },
        { icon: <FaClock className="text-blue-500 mr-2" />, text: "Sınırsız Menü/Ürün Ekleme ve Silme" },
        { icon: <FaUser className="text-purple-500 mr-2" />, text: "Sınırsız Kullanıcı Ekleme ve Silme" },
        { icon: <FaCheckCircle className="text-green-500 mr-2" />, text: "Sınırsız Masa  Ekleme ve Silme" },
        { icon: <FaCheckCircle className="text-green-500 mr-2" />, text: "Sınırsız Bölge  Ekleme ve Silme" },
        { icon: <FaCheckCircle className="text-green-500 mr-2" />, text: "Sipariş Yönetim Modülü" },
        { icon: <FaCheckCircle className="text-green-500 mr-2" />, text: "Garson Paneli" },
        { icon: <FaCheckCircle className="text-green-500 mr-2" />, text: "Mutfak Paneli" },
        { icon: <FaCheckCircle className="text-green-500 mr-2" />, text: "Sınırsız Şube Ekleme" },
        { icon: <FaCheckCircle className="text-green-500 mr-2" />, text: "Tüm Şubelerinizi Tek Yerden Yönetme" },
        { icon: <FaCheckCircle className="text-green-500 mr-2" />, text: "Reçete İle Stok Kontrol Modülü" },
        { icon: <FaCheckCircle className="text-green-500 mr-2" />, text: "Gelişmiş Raporlama Modülü" },
        { icon: <FaCheckCircle className="text-green-500 mr-2" />, text: "Ödeme Entegrasyonu" },
      ],
    },
  ];

  return (
    <div className="container mx-auto py-10 px-4">
      <h2 className="text-3xl font-bold text-center mb-8">PAKETLER</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {packages.map((pkg) => (
          <div
            key={pkg.id}
            className="bg-white rounded-xl shadow-lg p-6 text-left transform hover:scale-105 transition duration-300 flex flex-col justify-between min-h-[700px]"
          >
            <div className="flex flex-col justify-between flex-grow">
              {/* Başlık */}
              <h3 className="text-xl font-semibold mb-4">{pkg.name}</h3>

              {/* Özellikler */}
              <ul className="text-left mb-6">
                {pkg.features.map((feature, index) => (
                  <li key={index} className="flex items-center mb-2">
                    {feature.icon}
                    {feature.text}
                  </li>
                ))}
              </ul>

              {/* Fiyatlar */}
              <div className="flex justify-center mb-6 mt-auto">
                <span className="text-gray-500 line-through mr-4">
                  {pkg.oldPrice.toFixed(2)}₺
                </span>
                <span className="text-2xl font-bold text-red-600">
                  {pkg.newPrice.toFixed(2)}₺
                </span>
              </div>
            </div>

            {/* Buton */}
            <button className="bg-blue-600 w-full text-white px-4 py-2 rounded-lg hover:bg-blue-700 cursor-pointer transition duration-200">
              PAKET AL
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FiyatListesi;
