import { Outlet, NavLink } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../../../context/AuthContext'

const Ayarlar = () => {
  const { user, logout } = useContext(AuthContext);

  if (user.role !== 'admin') return null;

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Ayarlar</h2>
    
      </div>
      <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4 mb-6">
        <NavLink
          to="menu"
          className={({ isActive }) =>
            `px-4 py-2 rounded-md ${isActive ? 'bg-blue-600 text-white' : 'bg-gray-200'}`
          }
        >
          Menü Ayarları
        </NavLink>
        <NavLink
          to="users"
          className={({ isActive }) =>
            `px-4 py-2 rounded-md ${isActive ? 'bg-blue-600 text-white' : 'bg-gray-200'}`
          }
        >
          Kullanıcı Ayarları
        </NavLink>
      </div>
      <Outlet />
    </div>
  );
};

export default Ayarlar;
