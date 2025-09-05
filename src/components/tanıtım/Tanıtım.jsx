import React from 'react';
import { MdQrCodeScanner } from 'react-icons/md';
import { BiFastForward } from 'react-icons/bi';
import { FiRefreshCw } from 'react-icons/fi';
import { GiMoneyStack } from 'react-icons/gi';

const Tanitim = () => {
  return (
    <div className="bg-gray-800 text-white py-12 px-4">
      <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6">

        {/* Temassız Sipariş */}
        <div className="flex flex-col items-center p-6 bg-white text-gray-800 rounded-lg shadow-md hover:shadow-lg transition">
          <MdQrCodeScanner size={60} className="mb-4 text-blue-600" />
          <p className="text-center font-semibold text-lg">Temassız Sipariş</p>
        </div>

        {/* Hızlı ve Kolay Menü */}
        <div className="flex flex-col items-center p-6 bg-white text-gray-800 rounded-lg shadow-md hover:shadow-lg transition">
          <BiFastForward size={60} className="mb-4 text-green-600" />
          <p className="text-center font-semibold text-lg">Hızlı ve Kolay Menü</p>
        </div>

        {/* Gerçek Zamanlı Güncelleme */}
        <div className="flex flex-col items-center p-6 bg-white text-gray-800 rounded-lg shadow-md hover:shadow-lg transition">
          <FiRefreshCw size={60} className="mb-4 text-yellow-600" />
          <p className="text-center font-semibold text-lg">Gerçek Zamanlı Güncelleme</p>
        </div>

        {/* Maliyet & Kağıt Tasarrufu */}
        <div className="flex flex-col items-center p-6 bg-white text-gray-800 rounded-lg shadow-md hover:shadow-lg transition">
          <GiMoneyStack size={60} className="mb-4 text-red-600" />
          <p className="text-center font-semibold text-lg">Maliyet & Kağıt Tasarrufu</p>
        </div>

      </div>
    </div>
  );
};

export default Tanitim;
