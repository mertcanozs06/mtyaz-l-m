import React from 'react';
import { Link } from 'react-router-dom';

const Success = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-400 to-blue-500">
      <div className="bg-white p-8 rounded-lg shadow-lg text-center">
        <h1 className="text-3xl font-bold text-green-600 mb-4">Ödeme Başarılı!</h1>
        <p className="text-gray-700 mb-6">
          Aboneliğiniz aktifleştirildi. Artık sisteme giriş yapabilirsiniz.
        </p>
        <Link
          to="/login"
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Giriş Yap
        </Link>
      </div>
    </div>
  );
};

export default Success;
