import { NavLink, useParams, useNavigate } from 'react-router-dom';
import { useContext, useState, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';

const Navbar = () => {
  const { restaurantId, branchId } = useParams();
  const navigate = useNavigate();
  const {
    user,
    branches,
    selectedBranch,
    setSelectedBranch,
    package_type,
    logout,
  } = useContext(AuthContext);

  const [openDropdown, setOpenDropdown] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBranches = async () => {
      if (!user) {
        setErrorMessage('Kullanıcı bilgisi eksik.');
        setLoading(false);
        return;
      }
      if (branches && branches.length > 0) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(
          `http://localhost:5000/api/restaurant/${user.restaurant_id}/branches`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
          }
        );

        if (!res.ok) {
          if (res.status === 401) {
            setErrorMessage('Oturumunuz sona erdi. Lütfen tekrar giriş yapın.');
            logout();
            navigate('/login');
            return;
          }
          if (res.status === 403) throw new Error('Bu restorana erişim yetkiniz yok.');
          throw new Error('Şubeler yüklenemedi');
        }

        const data = await res.json();
        if (data.length > 0) {
          const branchToSelect = branchId || data[0].id.toString();
          setSelectedBranch(branchToSelect);
        }
      } catch (err) {
        setErrorMessage(err.message);
      } finally {
        setLoading(false);
      }
    };

    console.log('NavLink rendering:', { restaurantId, branchId, selectedBranch });
    fetchBranches();
  }, [user, branches, branchId, setSelectedBranch, logout, navigate]);

  const toggleDropdown = (name) => {
    setOpenDropdown((prev) => (prev === name ? null : name));
  };

  const handleBranchChange = (e) => {
    const newBranch = e.target.value;
    setSelectedBranch(newBranch);
    navigate(`/dashboard/${restaurantId}/${newBranch}`);
  };

  // === Menü Tanımları ===
  const fullAdminNavItems = [
    { name: 'QR Menü', path: 'qrmenu', packages: ['base', 'package2', 'premium'] },
    { name: 'Tanımlamalar', path: 'definitions', packages: ['base', 'package2', 'premium'] },
    { name: 'Şube Ekleme', path: 'branchadd', packages: ['package2', 'premium'] },
    { name: 'Siparişlerim', path: 'orders', packages: ['package2', 'premium'] },
    {
      name: 'İşlemler',
      path: 'operations',
      packages: ['package2', 'premium'],
      subItems: [
        { name: 'İşlem 1', path: 'operations/1' },
        { name: 'İşlem 2', path: 'operations/2' },
      ],
    },
    {
      name: 'Raporlar',
      path: 'reports',
      packages: ['premium'],
      subItems: [
        { name: 'GÜN SONU RAPORLARI', path: 'reports/daily' },
        { name: 'STOK RAPORU', path: 'reports/stock' },
      ],
    },
    { name: 'Kullanıcılar', path: 'users', packages: ['package2', 'premium'] },
    { name: 'Garson', path: 'waiter', packages: ['base', 'package2', 'premium'] },
    { name: 'Mutfak', path: 'kitchen', packages: ['base', 'package2', 'premium'] },
    { name: 'Ayarlar', path: 'settings', packages: ['base', 'package2', 'premium'] },
  ];

  const navItems = {
    owner: fullAdminNavItems,
    admin: fullAdminNavItems,
    waiter: [
      { name: 'Garson', path: 'waiter', packages: ['base', 'package2', 'premium'] },
    ],
    kitchen: [
      { name: 'Mutfak', path: 'kitchen', packages: ['base', 'package2', 'premium'] },
    ],
  };

  const role = user?.role || 'waiter';
  const roleNavItems = Array.isArray(navItems[role]) ? navItems[role] : [];
  const availableNavItems = roleNavItems.filter(
    (item) => !item.packages || item.packages.includes(package_type)
  );

  const buildLink = (subPath) => `/dashboard/${restaurantId}/${selectedBranch || branchId}/${subPath}`;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-gray-600">Yükleniyor...</div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-red-100 text-red-600 p-4 rounded-md shadow-md max-w-md text-center">
          {errorMessage}
          <button
            className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            onClick={() => {
              setErrorMessage('');
              if (errorMessage.includes('Oturumunuz sona erdi')) {
                logout();
                navigate('/login');
              }
            }}
          >
            Kapat
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Şube Seçimi */}
      {branches && branches.length > 1 && (
        <div className="p-4 bg-gray-100 sm:bg-transparent sm:p-0 sm:absolute sm:top-4 sm:left-4">
          <label className="block text-sm font-medium mb-2 text-black sm:text-white">
            Şube Seç
          </label>
          <select
            value={selectedBranch || branchId || ''}
            onChange={handleBranchChange}
            className="w-full max-w-xs p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Şube Seçin</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id.toString()}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Masaüstü Sidebar */}
      <nav className="bg-blue-600 text-white h-screen w-64 fixed top-0 left-0 p-6 overflow-auto hidden sm:flex flex-col justify-between">
        <div>
          {availableNavItems.map((item) => (
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
                          to={buildLink(sub.path)}
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
                  to={buildLink(item.path)}
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

        <button
          onClick={() => {
            logout();
            navigate('/login');
          }}
          className="w-full bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md"
        >
          Çıkış Yap
        </button>
      </nav>

      {/* Mobil Navbar */}
      <nav className="bg-blue-600 text-white p-4 sm:hidden">
        <div className="flex flex-row overflow-x-auto space-x-4 whitespace-nowrap pb-2">
          {availableNavItems.map((item) => (
            <div key={item.name} className="relative">
              {item.subItems ? (
                <>
                  <button
                    onClick={() => toggleDropdown(item.name)}
                    className="hover:underline"
                  >
                    {item.name} {openDropdown === item.name ? '▲' : '▼'}
                  </button>
                  {openDropdown === item.name && (
                    <div className="absolute z-50 bg-blue-600 text-white rounded-md mt-1 p-2 flex flex-col space-y-1">
                      {item.subItems.map((sub) => (
                        <NavLink
                          key={sub.path}
                          to={buildLink(sub.path)}
                          className={({ isActive }) =>
                            `block px-3 py-1 hover:underline ${isActive ? 'underline font-semibold' : ''}`
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
                  to={buildLink(item.path)}
                  className={({ isActive }) =>
                    `hover:underline ${isActive ? 'underline font-semibold' : ''}`
                  }
                >
                  {item.name}
                </NavLink>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4">
          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600"
          >
            Çıkış Yap
          </button>
        </div>
      </nav>
    </>
  );
};

export default Navbar;
