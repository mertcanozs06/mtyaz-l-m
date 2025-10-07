// src/pages/dashboard/settings/Ayarlar.jsx
import { Outlet, NavLink, useParams } from 'react-router-dom';
import { useContext, useState, useEffect } from 'react';
import { AuthContext } from '../../../context/AuthContext';

const Ayarlar = () => {
  const { restaurantId } = useParams();
  const { user, token, logout } = useContext(AuthContext);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [error, setError] = useState(null);

  // Şubeleri çek
  useEffect(() => {
    const fetchBranches = async () => {
      if (!token || !restaurantId) {
        setError('Token veya restoran bilgisi eksik.');
        return;
      }
      try {
        const response = await fetch(`http://localhost:5000/api/branches/${restaurantId}`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Şubeler alınamadı.');
        }
        const data = await response.json();
        setBranches(data);
        setSelectedBranch(data[0]?.id || null);
        setError(null);
      } catch (err) {
        setError(err.message);
      }
    };
    fetchBranches();
  }, [restaurantId, token]);

  if (!user || !['admin', 'owner'].includes(user.role)) {
    return null;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-red-100 text-red-600 p-4 rounded-md shadow-md max-w-md text-center">
          {error}
          <button
            className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            onClick={() => setError(null)}
          >
            Kapat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Ayarlar – Restoran {restaurantId}</h2>
        <button
          onClick={() => logout()}
          className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600"
        >
          Çıkış Yap
        </button>
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Şube Seç</label>
        <select
          value={selectedBranch || ''}
          onChange={(e) => setSelectedBranch(e.target.value)}
          className="w-full max-w-xs p-2 border rounded-md"
          disabled={!branches.length}
        >
          <option value="" disabled>Şube Seçiniz</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name} ({branch.city})
            </option>
          ))}
        </select>
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
        <NavLink
          to="branches"
          className={({ isActive }) =>
            `px-4 py-2 rounded-md ${isActive ? 'bg-blue-600 text-white' : 'bg-gray-200'}`
          }
        >
          Şube Yönetimi
        </NavLink>
      </div>
      {selectedBranch && <Outlet context={{ selectedBranch }} />}
    </div>
  );
};

export default Ayarlar;
