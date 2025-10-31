// src/components/LoadingScreen.jsx
import React from "react";

const LoadingScreen = () => {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-white text-gray-700">
      <img
        src="../../../public/şirketlogo3.png"
        alt="Logo"
        className="w-60 h-60 mb-4 animate-pulse "
      />
      <p className="text-lg font-semibold">Lütfen Bekleyiniz...</p>
    </div>
  );
};

export default LoadingScreen;
