import { useState } from 'react';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';

const FAQ = () => {
  // State to track which FAQ item is open
  const [openIndex, setOpenIndex] = useState(null);

  // Toggle function for opening/closing FAQ items
  const toggleFAQ = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  // FAQ data
  const faqs = [
    {
      question: 'QR Menü sistemi nedir?',
      answer: 'QR Menü sistemi, müşterilerin bir QR kodu tarayarak restoran menüsüne dijital olarak erişmesini sağlayan bir teknolojidir. Bu sistem, fiziksel menü ihtiyacını azaltır ve hijyenik bir çözüm sunar.',
    },
    {
      question: 'QR Menü nasıl kullanılır?',
      answer: 'Müşteriler, telefonlarının kamerasıyla masadaki QR kodunu tarar ve açılan web sayfasında menüyü görüntüler. Siparişlerini doğrudan sistem üzerinden verebilirler.',
    },
    {
      question: 'QR Menü’nün avantajları nelerdir?',
      answer: 'QR Menü, hızlı erişim, kolay güncelleme, maliyet tasarrufu ve çevre dostu bir çözüm sunar. Ayrıca müşteri deneyimini dijitalleştirir.',
    },
    {
      question: 'QR Menü sistemi güvenli mi?',
      answer: 'Evet, QR Menü sistemi güvenlidir. Veriler şifreli bir şekilde saklanır ve kullanıcı bilgileri korunur.',
    },
    {
      question: 'QR Menü sistemi hangi cihazlarda çalışır?',
      answer: 'QR Menü, iOS ve Android cihazlar dahil tüm modern akıllı telefonlarda ve tabletlerde çalışır.',
    },
    {
      question: 'QR Menü’yü nasıl oluştururum?',
      answer: 'QR Menü oluşturmak için bir platforma kaydolabilir, menünüzü dijital olarak yükleyebilir ve size özel bir QR kodu alabilirsiniz.',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center py-8 px-4">
      {/* Title */}
      <h1 className="text-3xl font-bold text-gray-800 mb-4">Sıkça Sorulan Sorular</h1>

      {/* Description */}
      <p className="text-gray-600 text-center mb-8 max-w-md">
        QR Menü sistemi hakkında merak ettiğiniz her şeyi burada bulabilirsiniz. Sorularınızı yanıtlamak için buradayız!
      </p>

      {/* FAQ Items */}
      <div className="w-full max-w-md space-y-4">
        {faqs.map((faq, index) => (
          <div
            key={index}
            className="bg-white rounded-lg shadow-md overflow-hidden"
          >
            {/* Question Header */}
            <div
              className="flex justify-between items-center p-4 cursor-pointer"
              onClick={() => toggleFAQ(index)}
            >
              <h3 className="text-lg font-semibold text-gray-800">{faq.question}</h3>
              {openIndex === index ? (
                <FaChevronUp className="text-gray-600" />
              ) : (
                <FaChevronDown className="text-gray-600" />
              )}
            </div>

            {/* Answer Section */}
            {openIndex === index && (
              <div className="p-4 bg-gray-50 text-gray-700">
                <p>{faq.answer}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default FAQ;