import { NavLink, useParams } from 'react-router-dom';
import { useContext, useState } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';

const Navbar = () => {
  const { restaurantId } = useParams();
  const { user, logout } = useContext(AuthContext);

  const [openDropdown, setOpenDropdown] = useState(null);

  const toggleDropdown = (name) => {
    setOpenDropdown(openDropdown === name ? null : name);
  };

  const navItems = {
    admin: [
      { name: 'QR Menü', path: `/dashboard/${restaurantId}/qrmenu` },
      { name: 'Tanımlamalar', path: `/dashboard/${restaurantId}/definitions` },
      { name: 'Siparişlerim', path: `/dashboard/${restaurantId}/orders` },
      {
        name: 'İşlemler',
        path: `/dashboard/${restaurantId}/operations`,
        subItems: [
          { name: 'İşlem 1', path: `/dashboard/${restaurantId}/operations/1` },
          { name: 'İşlem 2', path: `/dashboard/${restaurantId}/operations/2` },
        ],
      },
      {
        name: 'Raporlar',
        path: `/dashboard/${restaurantId}/reports`,
        subItems: [
          { name: 'GÜN SONU RAPORLARI', path: `/dashboard/${restaurantId}/reports/daily` },
          { name: 'STOK RAPORU', path: `/dashboard/${restaurantId}/reports/stock` },
        ],
      },
      { name: 'Kullanıcılar', path: `/dashboard/${restaurantId}/users` },
      { name: 'Garson', path: `/dashboard/${restaurantId}/waiter` },
      { name: 'Mutfak', path: `/dashboard/${restaurantId}/kitchen` },
      { name: 'Ayarlar', path: `/dashboard/${restaurantId}/settings` },
    ],
    waiter: [{ name: 'Garson', path: `/dashboard/${restaurantId}/waiter` }],
    kitchen: [{ name: 'Mutfak', path: `/dashboard/${restaurantId}/kitchen` }],
  };

  if (user?.role === 'admin') {
    return (
      <>
        {/* Sidebar: sadece sm ve üstü */}
        <nav className="bg-blue-600 text-white h-screen w-64 fixed top-0 left-0 p-6 overflow-auto hidden sm:flex flex-col justify-between">
          <div>
            {navItems.admin.map((item) => (
              <div key={item.name} className="mb-2">
                {item.subItems ? (
                  <>
                    <button
                      onClick={() => toggleDropdown(item.name)}
                      className="w-full text-left px-3 py-2 hover:bg-blue-700 rounded flex justify-between items-center"
                    >
                      <span>{item.name}</span>
                      <span>{openDropdown === item.name ? '▲' : '▼'}</span>
                    </button>
                    {openDropdown === item.name && (
                      <div className="ml-4 mt-1 flex flex-col space-y-1">
                        {item.subItems.map((sub) => (
                          <NavLink
                            key={sub.path}
                            to={sub.path}
                            className={({ isActive }) =>
                              `block px-3 py-1 rounded hover:bg-blue-500 ${
                                isActive ? 'bg-blue-800 font-semibold' : ''
                              }`
                            }
                          >
                            {sub.name}
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <NavLink
                    to={item.path}
                    className={({ isActive }) =>
                      `block px-3 py-2 rounded hover:bg-blue-700 ${
                        isActive ? 'bg-blue-800 font-semibold' : ''
                      }`
                    }
                  >
                    {item.name}
                  </NavLink>
                )}
              </div>
            ))}
          </div>

          <div>
            <button
              onClick={logout}
              className="w-full bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md"
            >
              Çıkış Yap
            </button>
          </div>
        </nav>

        {/* Mobil için yatay navbar: sadece sm altı */}
        <nav className="bg-blue-600 text-white p-4 sm:hidden ml-0">
          <div className="container mx-auto">
            <div className="flex flex-row overflow-x-auto space-x-4 whitespace-nowrap pb-2">
              {navItems.admin.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `hover:underline ${isActive ? 'underline font-semibold' : ''}`
                  }
                >
                  {item.name}
                </NavLink>
              ))}
            </div>

            <div className="mt-4 flex-shrink-0">
              <button
                onClick={logout}
                className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600"
              >
                Çıkış Yap
              </button>
            </div>
          </div>
        </nav>
      </>
    );
  }

  // waiter ve kitchen rolleri için orijinal navbar
  return (
    <nav className="bg-blue-600 text-white p-4">
      <div className="container mx-auto">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
          <div className="flex sm:flex-row flex-row overflow-x-auto space-x-4 sm:space-x-4 whitespace-nowrap pb-2 sm:pb-0">
            {navItems[user?.role || 'waiter'].map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `hover:underline ${isActive ? 'underline font-semibold' : ''}`
                }
              >
                {item.name}
              </NavLink>
            ))}
          </div>

          <div className="mt-4 sm:mt-0 flex-shrink-0">
            <button
              onClick={logout}
              className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600"
            >
              Çıkış Yap
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
