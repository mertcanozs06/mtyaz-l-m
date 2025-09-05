import React from 'react';
import {
  FaPhone,
  FaEnvelope,
  FaMapMarkerAlt,
  FaFacebookF,
  FaTwitter,
  FaInstagram,
  FaLinkedinIn,
  FaYoutube,
  FaCopyright,
} from 'react-icons/fa';

const Footer = () => {
  return (
    <footer className="bg-gray-900 text-white py-10 px-4">
      <div className="max-w-screen-xl mx-auto">

        {/* === BİLGİ BÖLÜMLERİ === */}
        <div className="flex flex-col md:flex-row md:flex-nowrap justify-between gap-8">
          {/* === Template Bölümleri === */}
          {/* İletişim */}
          <div className="w-full md:w-1/6 space-y-4 text-center md:text-left">
            <h2 className="text-xl font-bold">İletişim</h2>
            <ul className="space-y-2 text-sm">
              <li className="flex justify-center md:justify-start items-center">
                <FaMapMarkerAlt className="mr-2" />
                <a href="https://maps.google.com" className="hover:underline cursor-pointer">123 Örnek Cadde</a>
              </li>
              <li className="flex justify-center md:justify-start items-center">
                <FaPhone className="mr-2" />
                <a href="tel:+905551234567" className="hover:underline cursor-pointer">+90 555 123 45 67</a>
              </li>
              <li className="flex justify-center md:justify-start items-center">
                <FaEnvelope className="mr-2" />
                <a href="mailto:info@ornek.com" className="hover:underline cursor-pointer">info@ornek.com</a>
              </li>
            </ul>
          </div>

          {/* Özellikler */}
          <div className="w-full md:w-1/6 space-y-4 text-center md:text-left">
            <h2 className="text-xl font-bold">Özellikler</h2>
            <ul className="space-y-2 text-sm">
              {[
                'Hızlı Teslimat',
                'Güvenli Ödeme',
                '24/7 Destek',
                'Kolay İade',
                'Ücretsiz Kargo',
                'Kişiselleştirme',
              ].map((item, index) => (
                <li key={index}>
                  <a href="#" className="hover:underline cursor-pointer">{item}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Hakkımızda */}
          <div className="w-full md:w-1/6 space-y-4 text-center md:text-left">
            <h2 className="text-xl font-bold">Hakkımızda</h2>
            <ul className="space-y-2 text-sm">
              {['Misyonumuz', 'Vizyonumuz', 'Ekibimiz'].map((item, index) => (
                <li key={index}>
                  <a href="#" className="hover:underline cursor-pointer">{item}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Sözleşmeler */}
          <div className="w-full md:w-1/6 space-y-4 text-center md:text-left">
            <h2 className="text-xl font-bold">Sözleşmeler</h2>
            <ul className="space-y-2 text-sm">
              {[
                'Kullanıcı Sözleşmesi',
                'Gizlilik Politikası',
                'İade Koşulları',
                'Çerez Politikası',
                'Hizmet Şartları',
              ].map((item, index) => (
                <li key={index}>
                  <a href="#" className="hover:underline cursor-pointer">{item}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* İş Ortaklığı */}
          <div className="w-full md:w-1/6 space-y-4 text-center md:text-left">
            <h2 className="text-xl font-bold">İş Ortaklığı</h2>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#" className="hover:underline cursor-pointer">Bayilik</a>
              </li>
            </ul>
          </div>

          {/* Kaynaklar */}
          <div className="w-full md:w-1/6 space-y-4 text-center md:text-left">
            <h2 className="text-xl font-bold">Kaynaklar</h2>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#" className="hover:underline cursor-pointer">Bilgi Merkezi</a>
              </li>
              <li>
                <a href="#" className="hover:underline cursor-pointer">API</a>
              </li>
            </ul>
          </div>
        </div>

        {/* === SOSYAL MEDYA === */}
        <div className="mt-10">
          <h2 className="text-xl font-bold text-center mb-4">Sosyal Medya</h2>
          <div className="flex justify-center space-x-4">
            {[{
              icon: <FaFacebookF />,
              href: "https://facebook.com"
            }, {
              icon: <FaTwitter />,
              href: "https://twitter.com"
            }, {
              icon: <FaInstagram />,
              href: "https://instagram.com"
            }, {
              icon: <FaLinkedinIn />,
              href: "https://linkedin.com"
            }, {
              icon: <FaYoutube />,
              href: "https://youtube.com"
            }].map((social, idx) => (
              <a
                key={idx}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                className="border-2 border-white rounded-full p-2 hover:bg-white hover:text-gray-900 transition"
              >
                {social.icon}
              </a>
            ))}
          </div>
        </div>

        {/* === TELİF HAKKI === */}
        <div className="text-center text-sm mt-6 flex justify-center items-center space-x-2">
          <FaCopyright />
          <span>2025. Tüm Hakları Saklıdır.</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
