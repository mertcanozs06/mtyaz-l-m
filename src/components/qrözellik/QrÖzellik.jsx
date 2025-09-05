import { useState } from 'react';

export default function QrÖzellik() {
  const [openIndex, setOpenIndex] = useState(null);

  return (
    <div className="bg-gray-800 text-white p-6 md:p-10 flex flex-col md:flex-row items-start gap-6">
      {/* Sol Menü Alanı */}
      <div className="w-full md:w-1/2 flex flex-col gap-4">
        {[0, 1, 2, 3, 4].map((index) => {
          const isOpen = openIndex === index;
          return (
            <div
              key={index}
              onClick={() => setOpenIndex(isOpen ? null : index)}
              className={`border border-white rounded-md p-4 transition-all duration-300 select-none cursor-pointer ${
                isOpen ? 'bg-red-600' : 'hover:bg-gray-700'
              }`}
            >
              <button
                type="button"
                className="w-full text-left text-lg font-semibold bg-transparent p-0 m-0 cursor-pointer"
                // Buton clickini kaldırdık, dış div clickini tetikliyor
              >
                Digital Menu
              </button>
              {isOpen && (
                <div className="mt-3 space-y-2" style={{ cursor: 'pointer' }}>
                  <p>
                    Adisyo QR menü, ürünlerinizi düzenli, anlaşılır ve etkileyici
                    şekilde müşterilerinize sunmanıza yardımcı olur. Hizmet
                    kalitenizi geliştirin, müşterilerinizi memnun ederek gelirinizi
                    arttırın.
                  </p>
                  <a
                    href="#"
                    className="inline-block border border-white text-white px-4 py-2 rounded-md hover:bg-white hover:text-gray-800 transition"
                    style={{ cursor: 'pointer' }}
                  >
                    Daha Fazla Bilgi
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Sağ Görsel */}
      <div className="w-full md:w-1/2 flex justify-center md:justify-end items-start">
        <img
          src="https://www.qrcode-monkey.com/img/default-preview-qr.svg"
          alt="QR Kod ile Menü"
          className="w-full max-w-sm rounded-md object-contain"
        />
      </div>
    </div>
  );
}
