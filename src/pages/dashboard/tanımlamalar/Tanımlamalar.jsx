import { Outlet, NavLink, Navigate, useParams } from 'react-router-dom';
import { useContext, useState, useEffect } from 'react';
import { AuthContext } from '../../../context/AuthContext';

const Tanımlamalar = () => {
  const { user, selectedBranch, package_type } = useContext(AuthContext);
  const { restaurantId, branchId } = useParams();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // Yetkilendirme ve şube kontrolü
  useEffect(() => {
    if (!user) {
      setErrorMessage('Giriş yapmanız gerekiyor.');
      setLoading(false);
      return;
    }

    if (user.restaurant_id !== parseInt(restaurantId)) {
      setErrorMessage('Bu restorana erişim yetkiniz yok.');
      setLoading(false);
      return;
    }

    if (branchId !== selectedBranch) {
      setErrorMessage('Seçilen şube geçersiz.');
      setLoading(false);
      return;
    }

    setLoading(false);
  }, [user, restaurantId, branchId, selectedBranch]);

  // Yetkisiz erişim
  if (!user || user.role !== 'admin') {
    return <Navigate to="/login" replace />;
  }

  // Yükleme durumu
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-gray-600">Yükleniyor...</div>
      </div>
    );
  }

  // Hata mesajı
  if (errorMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-red-100 text-red-600 p-4 rounded-md shadow-md max-w-md text-center">
          {errorMessage}
          <button
            className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            onClick={() => setErrorMessage('')}
          >
            Kapat
          </button>
        </div>
      </div>
    );
  }

  // NavLink'ler için paket kısıtlamaları
  const navItems = [
    { name: 'Masalar', to: 'tables', packages: ['base', 'package2', 'premium'] },
    { name: 'Bölgeler', to: 'regions', packages: ['base', 'package2', 'premium'] },
    { name: 'Menüler', to: 'menus', packages: ['package2', 'premium'] },
  ];

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8 bg-gray-100">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">
          Tanımlamalar – Restoran {restaurantId}, Şube {branchId}
        </h2>
      </div>
      <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4 mb-6">
        {navItems
          .filter((item) => !item.packages || item.packages.includes(package_type))
          .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `px-4 py-2 rounded-md ${isActive ? 'bg-blue-600 text-white' : 'bg-gray-200'}`
              }
            >
              {item.name}
            </NavLink>
          ))}
      </div>
      <Outlet context={{ restaurantId, branchId, package_type }} />
    </div>
  );
};

export default Tanımlamalar;
