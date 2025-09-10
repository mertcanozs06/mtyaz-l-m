import React, { useState } from 'react';
import bizitercih from '../../../src/assets/Images/bizitercih.jpg'
import bizitercih2 from '../../../src/assets/Images/bizitercih2.jpg'
import bizitercih3 from '../../../src/assets/Images/bizitercih3.jpg'
const NedenBizi = () => {
  // State ile manuel veri tanımlama
  const [sections, setSections] = useState([
    {
      id: 1,
      title: 'Kaliteli Hizmet',
      description: 'Uzman ekibimizle her zaman en iyi hizmeti sunuyoruz.',
      image: bizitercih,
    },
    {
      id: 2,
      title: 'Hızlı Teslimat',
      description: 'Siparişlerinizi en kısa sürede teslim ediyoruz.',
      image: bizitercih2,
    },
    {
      id: 3,
      title: 'Müşteri Memnuniyeti',
      description: 'Müşterilerimizin memnuniyeti bizim önceliğimiz.',
      image: bizitercih3,
    },
    {
      id: 4,
      title: 'Uygun Fiyat',
      description: 'Kaliteli hizmeti uygun fiyatlarla sunuyoruz.',
      image: '/images/fiyat.jpg',
    },
  ]);

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
      {/* Ana Başlık */}
      <h1 className="text-3xl sm:text-4xl font-bold text-center text-gray-800 mb-10">
        BİZİ NEDEN TERCİH ETMELİSİNİZ
      </h1>

      {/* Dinamik Alt Başlıklar */}
      {sections.map((section) => (
        <div key={section.id} className="flex flex-col sm:flex-row items-center mb-6 justify-center">
          <div className="w-full sm:w-1/2 mb-4 sm:mb-0">
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-700 mb-2 text-left">
              {section.title}
            </h2>
            <p className="text-gray-600 text-base sm:text-lg">
              {section.description}
            </p>
          </div>
          <div className="w-full h-[250px] sm:h-auto sm:max-w-md sm:aspect-[4/3]">
            <img
              src={section.image}
              alt={section.title}
             className="w-full h-full object-cover rounded-lg"
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default NedenBizi;
