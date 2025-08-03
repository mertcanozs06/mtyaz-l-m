import { NavLink, useParams } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';

const Navbar = () => {
  const { restaurantId } = useParams();
  const { user, logout } = useContext(AuthContext);

  const navItems = {
    admin: [
      { name: 'QR Menü', path: `/dashboard/${restaurantId}/qrmenu` },
      { name: 'Tanımlamalar', path: `/dashboard/${restaurantId}/definitions` },
      { name: 'Siparişlerim', path: `/dashboard/${restaurantId}/orders` },
      { name: 'İşlemler', path: `/dashboard/${restaurantId}/operations` },
      { name: 'Raporlar', path: `/dashboard/${restaurantId}/reports` },
      { name: 'Kullanıcılar', path: `/dashboard/${restaurantId}/users` },
      { name: 'Garson', path: `/dashboard/${restaurantId}/waiter` },
      { name: 'Mutfak', path: `/dashboard/${restaurantId}/kitchen` },
      { name: 'Ayarlar', path: `/dashboard/${restaurantId}/settings` },
    ],
    waiter: [{ name: 'Garson', path: `/dashboard/${restaurantId}/waiter` }],
    kitchen: [{ name: 'Mutfak', path: `/dashboard/${restaurantId}/kitchen` }],
  };

  return (
    <nav className="bg-blue-600 text-white p-4">
      <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center">
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
          {navItems[user?.role || 'waiter'].map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `hover:underline ${isActive ? 'underline' : ''}`
              }
            >
              {item.name}
            </NavLink>
          ))}
        </div>
        <button
          onClick={logout}
          className="mt-4 sm:mt-0 bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600"
        >
          Çıkış Yap
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
