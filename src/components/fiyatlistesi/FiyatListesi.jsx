import React from 'react';
import { FaCheckCircle, FaClock, FaUser } from 'react-icons/fa'; // Örnek ikonlar, isteğe göre değiştirilebilir

const FiyatListesi = () => {
  // Dinamik fiyatlar için değişkenler
  const oldPrice = 199.99; // Çizgili fiyat
  const newPrice = 149.99; // Büyük fiyat

  // Paket verileri (özellikler sonradan eklenecek)
  const packages = [
    { id: 1, name: "Basic Paket" },
    { id: 2, name: "Pro Paket" },
    { id: 3, name: "Premium Paket" },
  ];

  return (
    <div className="container  mx-auto py-10 px-4">
      {/* Başlık */}
      <h2 className="text-3xl font-bold text-center mb-8">PAKETLER</h2>

      {/* Kartlar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {packages.map((pkg) => (
          <div
            key={pkg.id}
            className="bg-white rounded-xl shadow-lg p-6 text-left transform hover:scale-105 transition duration-300"
          >
            {/* Paket Adı */}
            <h3 className="text-xl font-semibold mb-4">{pkg.name}</h3>

            {/* Paket Özellikleri (Yer Tutucu) */}
            <ul className="text-left mb-6">
              <li className="flex items-center mb-2">
                <FaCheckCircle className="text-green-500 mr-2" />
                Özellik 1 (Sonradan eklenecek)
              </li>
              <li className="flex items-center mb-2">
                <FaClock className="text-blue-500 mr-2" />
                Özellik 2 (Sonradan eklenecek)
              </li>
              <li className="flex items-center">
                <FaUser className="text-purple-500 mr-2" />
                Özellik 3 (Sonradan eklenecek)
              </li>
            </ul>

            {/* Fiyatlar */}
            <div className="flex justify-center mb-4">
              <span className="text-gray-500 line-through mr-4">${oldPrice.toFixed(2)}</span>
              <span className="text-2xl font-bold text-red-600">${newPrice.toFixed(2)}</span>
            </div>

            {/* Buton */}
            <button
              className="bg-blue-600 w-full text-white px-4 py-2 rounded-lg hover:bg-blue-700 cursor-pointer transition duration-200"
            >
              PAKET AL
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FiyatListesi;