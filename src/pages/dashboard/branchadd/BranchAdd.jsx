import React, { useState } from "react";
import { FaPlus, FaGlobe } from "react-icons/fa";

const BranchAdd = () => {
  const [showForm, setShowForm] = useState(false);
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [branch, setBranch] = useState("");

  const [data, setData] = useState({});
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [selectedCity, setSelectedCity] = useState("");

  // Şube Ekle butonuna basınca formu aç
  const toggleForm = () => {
    setShowForm(!showForm);
  };

  // Formdaki Şube Ekle butonuna basınca veriyi kaydet ve formu kapat
  const handleAddBranch = () => {
    if (!country || !city || !branch) return;

    setData((prev) => {
      const updated = { ...prev };
      if (!updated[country]) updated[country] = { cities: {} };
      if (!updated[country].cities[city]) updated[country].cities[city] = [];
      updated[country].cities[city].push(branch);
      return updated;
    });

    setCountry("");
    setCity("");
    setBranch("");
    setShowForm(false);
  };

  return (
    <div className="p-6">
      {/* Üstteki Şube Ekle butonu */}
      <div className="flex items-center space-x-2 mb-4">
        <button
          onClick={toggleForm}
          className="flex items-center bg-gray-300 text-black px-4 py-2 rounded-full cursor-pointer"
        >
          <FaPlus className="mr-2" /> Şube Ekle
        </button>

        {/* Eklenen ülkeler */}
        {Object.keys(data).map((c) => (
          <button
            key={c}
            onClick={() => {
              setSelectedCountry(c);
              setSelectedCity("");
            }}
            className="flex items-center bg-gray-300 text-black px-3 py-2 rounded-full cursor-pointer"
          >
            <FaGlobe className="mr-1" />
            {c}
          </button>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-green-300 p-4 rounded-lg w-full max-w-md mb-4">
          <div className="mb-3">
            <label className="block text-black mb-1">Ülke Adı</label>
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full px-3 py-2 rounded border border-gray-300"
            />
          </div>

          <div className="mb-3">
            <label className="block text-black mb-1">Şehir Ekle</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full px-3 py-2 rounded border border-gray-300"
            />
          </div>

          <div className="mb-3">
            <label className="block text-black mb-1">Şube Adı</label>
            <input
              type="text"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="w-full px-3 py-2 rounded border border-gray-300"
            />
          </div>

          <button
            onClick={handleAddBranch}
            className="bg-gray-300 text-black px-4 py-2 rounded-full w-full cursor-pointer"
          >
            Şube Ekle
          </button>
        </div>
      )}

      {/* Seçilen Ülke için şehir select inputu */}
      {selectedCountry && (
        <div className="mb-4">
          <label className="block text-black mb-1">
            {selectedCountry} Ülkesindeki Şehirler
          </label>
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="w-full px-3 py-2 rounded border border-gray-300"
          >
            <option value="">Şehir Seçiniz</option>
            {Object.keys(data[selectedCountry].cities).map((cityName) => (
              <option key={cityName} value={cityName}>
                {cityName}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Seçilen şehir için şube adlarını göster */}
      {selectedCountry && selectedCity && (
        <div className="flex gap-2 flex-wrap">
          {data[selectedCountry].cities[selectedCity].map((b, idx) => (
            <div
              key={idx}
              className="bg-green-200 px-3 py-1 rounded-full cursor-pointer"
            >
              {b}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BranchAdd;

