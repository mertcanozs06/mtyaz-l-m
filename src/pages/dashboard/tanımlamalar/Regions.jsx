import { useEffect, useState, useContext } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { AuthContext } from '../../../context/AuthContext';

const Regions = () => {
  const { restaurantId, branchId } = useParams();
  const { user, selectedBranch, package_type ,token } = useContext(AuthContext);
  const [regions, setRegions] = useState([]);
  const [regionName, setRegionName] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null); // Silme onayı için

  // Bölgeleri çek
  useEffect(() => {
    const fetchRegions = async () => {
      if (!user || !selectedBranch) {
        setErrorMessage('Kullanıcı veya şube bilgisi eksik.');
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

      try {
        const res = await fetch(`http://localhost:5000/api/${restaurantId}/${branchId}/regions`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        if (!res.ok) {
          const errorData = await res.json();
          if (res.status === 401) throw new Error('Lütfen giriş yapın.');
          if (res.status === 403) throw new Error('Bu şubeye erişim yetkiniz yok.');
          throw new Error(errorData.message || 'Bölgeler yüklenemedi.');
        }
        const data = await res.json();
        setRegions(data);
        setLoading(false);
      } catch (err) {
        setErrorMessage(err.message);
        setLoading(false);
      }
    };

    fetchRegions();
  }, [user, restaurantId, branchId, selectedBranch]);

  // Bölge ekleme
  const addRegion = async () => {
    if (!regionName.trim()) {
      setErrorMessage('Bölge adı boş olamaz.');
      return;
    }

    try {
      const res = await fetch(`http://localhost:5000/api/${restaurantId}/${branchId}/regions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ name: regionName.trim() }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        if (res.status === 401) throw new Error('Lütfen giriş yapın.');
        if (res.status === 403) throw new Error('Bu şubeye erişim yetkiniz yok.');
        if (res.status === 400) throw new Error(errorData.message || 'Geçersiz bölge adı.');
        throw new Error(errorData.message || 'Bölge eklenemedi.');
      }
      const newRegion = await res.json();
      setRegions([...regions, newRegion]);
      setRegionName('');
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  // Bölge silme
  const deleteRegion = async (regionId) => {
    try {
      const res = await fetch(`http://localhost:5000/api/${restaurantId}/${branchId}/regions/${regionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!res.ok) {
        const errorData = await res.json();
        if (res.status === 401) throw new Error('Lütfen giriş yapın.');
        if (res.status === 403) throw new Error('Bu şubeye erişim yetkiniz yok.');
        if (res.status === 404) throw new Error('Bölge bulunamadı.');
        if (res.status === 400) throw new Error(errorData.message || 'Bölge silinemedi.');
        throw new Error(errorData.message || 'Bölge silinemedi.');
      }
      setRegions(regions.filter((region) => region.id !== regionId));
      setDeleteConfirm(null);
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  // Paket kontrolü
  if (!['package2', 'premium'].includes(package_type)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-red-100 text-red-600 p-4 rounded-md shadow-md max-w-md text-center">
          Bu özellik yalnızca package2 ve premium paketlerde kullanılabilir.
        </div>
      </div>
    );
  }

  // Yetkisiz erişim
  if (!user || user.role !== 'admin' || user.restaurant_id !== parseInt(restaurantId) || branchId !== selectedBranch) {
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

  return (
    <div className="p-4 bg-gray-100 min-h-screen">
      <h3 className="text-lg font-semibold mb-4">
        Bölgeler – Restoran {restaurantId}, Şube {branchId}
      </h3>
      <div className="mb-4 flex items-center gap-2">
        <input
          type="text"
          value={regionName}
          onChange={(e) => setRegionName(e.target.value)}
          placeholder="Bölge adı (örn. Bahçe, Teras)"
          className="p-2 border rounded-md w-full max-w-xs"
        />
        <button
          onClick={addRegion}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          Bölge Ekle
        </button>
      </div>
      {regions.length === 0 ? (
        <div className="text-gray-600">Bu şubede tanımlı bölge bulunmamaktadır.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {regions.map((region) => (
            <div key={region.id} className="p-4 bg-white shadow-md rounded-md flex justify-between items-center">
              <p className="font-medium">{region.name}</p>
              <button
                onClick={() => setDeleteConfirm(region.id)}
                className="bg-red-500 text-white px-3 py-1 rounded-md hover:bg-red-600"
              >
                Sil
              </button>
              {deleteConfirm === region.id && (
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                  <div className="bg-white p-4 rounded-md shadow-md max-w-sm text-center">
                    <p>"{region.name}" bölgesini silmek istediğinizden emin misiniz?</p>
                    <div className="mt-4 flex gap-4 justify-center">
                      <button
                        onClick={() => deleteRegion(region.id)}
                        className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                      >
                        Evet, Sil
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="bg-gray-300 text-black px-3 py-1 rounded hover:bg-gray-400"
                      >
                        İptal
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Regions;
