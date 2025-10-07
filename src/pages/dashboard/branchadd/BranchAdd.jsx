import React, { useState, useEffect, useContext } from 'react';
import { Navigate, useParams, useNavigate } from 'react-router-dom';
import { FaPlus, FaGlobe, FaTrash } from 'react-icons/fa';
import { AuthContext } from '../../../context/AuthContext';

const BranchAdd = () => {
  const { restaurantId, branchId } = useParams();
  const { token, user, package_type, logout, selectedBranch, setSelectedBranch, updateUser } = useContext(AuthContext);
  const navigate = useNavigate();

  const [showForm, setShowForm] = useState(false);
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [branch, setBranch] = useState('');
  const [branches, setBranches] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [selectedCity, setSelectedCity] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Şubeleri çek
  useEffect(() => {
    const fetchBranches = async () => {
      if (!token || !restaurantId) {
        setError('Token veya restoran bilgisi eksik.');
        return;
      }

      try {
        setIsLoading(true);
        const response = await fetch(`http://localhost:5000/api/branches/${restaurantId}`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          if (response.status === 401) throw new Error('Oturumunuz sona erdi. Lütfen tekrar giriş yapın.');
          if (response.status === 403) throw new Error('Bu restorana erişim yetkiniz yok.');
          if (response.status === 404) throw new Error('Bu restorana ait şube bulunamadı. Lütfen yeni bir şube ekleyin.');
          throw new Error(errorData.message || 'Şubeler alınamadı.');
        }

        const data = await response.json();
        setBranches(data);
        if (data.length > 0 && !selectedBranch) {
          setSelectedBranch(data[0].id.toString());
          navigate(`/dashboard/${restaurantId}/${data[0].id}`);
        }
        // X-New-Token kontrolü
        const newToken = response.headers.get('X-New-Token');
        if (newToken) {
          localStorage.setItem('token', newToken);
          updateUser();
        }
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBranches();
  }, [restaurantId, token, selectedBranch, setSelectedBranch, navigate, updateUser]);

  // Şube Ekle butonuna basınca formu aç
  const toggleForm = () => {
    setShowForm(!showForm);
    setCountry('');
    setCity('');
    setBranch('');
    setError(null);
  };

  // Formdaki Şube Ekle butonuna basınca backend’e kaydet
  const handleAddBranch = async () => {
    if (!country || !city || !branch) {
      setError('Ülke, şehir ve şube adı zorunludur.');
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`http://localhost:5000/api/branches/${restaurantId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ country, city, name: branch }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 401) throw new Error('Oturumunuz sona erdi. Lütfen tekrar giriş yapın.');
        if (response.status === 403) throw new Error('Bu işlemi gerçekleştirme yetkiniz yok.');
        if (response.status === 400) throw new Error(errorData.message || 'Geçersiz veri.');
        throw new Error(errorData.message || 'Şube eklenemedi.');
      }

      // Backend’den yeni şube ID’sini almak için tekrar şubeleri çek
      const updatedBranches = await fetch(`http://localhost:5000/api/branches/${restaurantId}`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }).then((res) => res.json());

      setBranches(updatedBranches);
      localStorage.setItem('branches', JSON.stringify(updatedBranches));
      setCountry('');
      setCity('');
      setBranch('');
      setShowForm(false);
      setError(null);
      // Yeni şubeyi seç
      if (updatedBranches.length > 0) {
        setSelectedBranch(updatedBranches[updatedBranches.length - 1].id.toString());
        navigate(`/dashboard/${restaurantId}/${updatedBranches[updatedBranches.length - 1].id}`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Şube sil
  const handleDeleteBranch = async (branchId) => {
    if (!window.confirm('Bu şubeyi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.')) {
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`http://localhost:5000/api/branches/${branchId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 401) throw new Error('Oturumunuz sona erdi. Lütfen tekrar giriş yapın.');
        if (response.status === 403) throw new Error('Bu işlemi gerçekleştirme yetkiniz yok.');
        if (response.status === 404) throw new Error('Şube bulunamadı.');
        throw new Error(errorData.message || 'Şube silinemedi.');
      }

      // Şubeleri güncelle
      const updatedBranches = branches.filter((b) => b.id !== branchId);
      setBranches(updatedBranches);
      localStorage.setItem('branches', JSON.stringify(updatedBranches));
      setSelectedCountry(null);
      setSelectedCity('');
      setError(null);
      // Eğer silinen şube seçiliyse, başka bir şubeye yönlendir
      if (selectedBranch === branchId.toString() && updatedBranches.length > 0) {
        setSelectedBranch(updatedBranches[0].id.toString());
        navigate(`/dashboard/${restaurantId}/${updatedBranches[0].id}`);
      } else if (updatedBranches.length === 0) {
        setSelectedBranch(null);
        navigate(`/dashboard/${restaurantId}/branchadd`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Ülke ve şehir bazlı veri yapısı oluştur
  const groupedBranches = branches.reduce((acc, branch) => {
    if (!acc[branch.country]) acc[branch.country] = { cities: {} };
    if (!acc[branch.country].cities[branch.city]) acc[branch.country].cities[branch.city] = [];
    acc[branch.country].cities[branch.city].push({ id: branch.id, name: branch.name });
    return acc;
  }, {});

  // Paket kontrolü
  if (!['package2', 'premium'].includes(package_type)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-red-100 text-red-600 p-4 rounded-md shadow-md max-w-md text-center">
          Şube yönetimi özelliği yalnızca package2 ve premium paketlerde kullanılabilir.
        </div>
      </div>
    );
  }

  // Yetkisiz erişim
  if (!user || !['admin', 'owner'].includes(user.role) || user.restaurant_id !== parseInt(restaurantId)) {
    return <Navigate to="/login" replace />;
  }

  // Yükleme durumu
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-gray-600">Yükleniyor...</div>
      </div>
    );
  }

  // Hata durumu
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-red-100 text-red-600 p-4 rounded-md shadow-md max-w-md text-center">
          {error}
          <button
            className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            onClick={() => {
              setError(null);
              if (error.includes('Oturumunuz sona erdi')) {
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
    <div className="p-6 bg-gray-100 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Şube Yönetimi – Restoran {restaurantId}</h2>
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

      {/* Üstteki Şube Ekle butonu ve ülkeler */}
      <div className="flex items-center space-x-2 mb-4">
        <button
          onClick={toggleForm}
          className="flex items-center bg-gray-300 text-black px-4 py-2 rounded-full hover:bg-gray-400"
          disabled={isLoading}
        >
          <FaPlus className="mr-2" /> Şube Ekle
        </button>

        {Object.keys(groupedBranches).map((c) => (
          <button
            key={c}
            onClick={() => {
              setSelectedCountry(c);
              setSelectedCity('');
            }}
            className="flex items-center bg-gray-300 text-black px-3 py-2 rounded-full hover:bg-gray-400"
          >
            <FaGlobe className="mr-1" />
            {c}
          </button>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-green-300 p-4 rounded-lg w-full max-w-md mb-4">
          <div className="mb-3">
            <label className="block text-black mb-1">Ülke Adı</label>
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full px-3 py-2 rounded border border-gray-300"
              disabled={isLoading}
            />
          </div>

          <div className="mb-3">
            <label className="block text-black mb-1">Şehir Adı</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full px-3 py-2 rounded border border-gray-300"
              disabled={isLoading}
            />
          </div>

          <div className="mb-3">
            <label className="block text-black mb-1">Şube Adı</label>
            <input
              type="text"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="w-full px-3 py-2 rounded border border-gray-300"
              disabled={isLoading}
            />
          </div>

          <button
            onClick={handleAddBranch}
            className="bg-gray-300 text-black px-4 py-2 rounded-full w-full hover:bg-gray-400"
            disabled={isLoading}
          >
            Şube Ekle
          </button>
        </div>
      )}

      {/* Seçilen Ülke için şehir select inputu */}
      {selectedCountry && (
        <div className="mb-4">
          <label className="block text-black mb-1">
            {selectedCountry} Ülkesindeki Şehirler
          </label>
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="w-full px-3 py-2 rounded border border-gray-300"
            disabled={isLoading}
          >
            <option value="">Şehir Seçiniz</option>
            {Object.keys(groupedBranches[selectedCountry].cities).map((cityName) => (
              <option key={cityName} value={cityName}>
                {cityName}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Seçilen şehir için şube adlarını göster */}
      {selectedCountry && selectedCity && (
        <div className="flex gap-2 flex-wrap">
          {groupedBranches[selectedCountry].cities[selectedCity].map((b) => (
            <div
              key={b.id}
              className="flex items-center bg-green-200 px-3 py-1 rounded-full"
            >
              <span>{b.name}</span>
              <button
                onClick={() => handleDeleteBranch(b.id)}
                className="ml-2 text-red-600 hover:text-red-800"
                title="Şubeyi Sil"
              >
                <FaTrash />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BranchAdd;
