import { useEffect, useState, useContext } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { AuthContext } from '../../../context/AuthContext';

const Tables = () => {
  const { restaurantId, branchId } = useParams();
  const { user, selectedBranch, package_type,token } = useContext(AuthContext);
  const [tables, setTables] = useState([]);
  const [regions, setRegions] = useState([]);
  const [tableNumber, setTableNumber] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [loadingTableId, setLoadingTableId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Masaları ve bölgeleri çek
  useEffect(() => {
    const fetchData = async () => {
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
        // Bölgeleri çek
        const regionsRes = await fetch(`http://localhost:5000/api/${restaurantId}/${branchId}/regions`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        if (!regionsRes.ok) {
          const errorData = await regionsRes.json();
          if (regionsRes.status === 401) throw new Error('Lütfen giriş yapın.');
          if (regionsRes.status === 403) throw new Error('Bu şubeye erişim yetkiniz yok.');
          throw new Error(errorData.message || 'Bölgeler yüklenemedi.');
        }
        const regionsData = await regionsRes.json();
        setRegions(regionsData);

        // Masaları çek
        const tablesRes = await fetch(`http://localhost:5000/api/${restaurantId}/${branchId}/tables`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        if (!tablesRes.ok) {
          const errorData = await tablesRes.json();
          if (tablesRes.status === 401) throw new Error('Lütfen giriş yapın.');
          if (tablesRes.status === 403) throw new Error('Bu şubeye erişim yetkiniz yok.');
          throw new Error(errorData.message || 'Masalar yüklenemedi.');
        }
        const tablesData = await tablesRes.json();
        setTables(tablesData);
        setLoading(false);
      } catch (err) {
        setErrorMessage(err.message);
        setLoading(false);
      }
    };

    fetchData();
  }, [user, restaurantId, branchId, selectedBranch]);

  // Masa ekle
  const addTable = async () => {
    if (!tableNumber.trim()) {
      setErrorMessage('Masa numarası boş olamaz.');
      return;
    }

    try {
      const res = await fetch(`http://localhost:5000/api/${restaurantId}/${branchId}/tables`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          table_number: parseInt(tableNumber),
          region: selectedRegion || null,
        }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        if (res.status === 401) throw new Error('Lütfen giriş yapın.');
        if (res.status === 403) throw new Error('Bu şubeye erişim yetkiniz yok.');
        if (res.status === 400) throw new Error(errorData.message || 'Geçersiz masa numarası.');
        throw new Error(errorData.message || 'Masa eklenemedi.');
      }
      const newTable = await res.json();
      setTables([...tables, newTable]);
      setTableNumber('');
      setSelectedRegion('');
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  // Masa sil
  const deleteTable = async (tableId) => {
    setLoadingTableId(tableId);
    try {
      const res = await fetch(`http://localhost:5000/api/${restaurantId}/${branchId}/tables/${tableId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!res.ok) {
        const errorData = await res.json();
        if (res.status === 401) throw new Error('Lütfen giriş yapın.');
        if (res.status === 403) throw new Error('Bu şubeye erişim yetkiniz yok.');
        if (res.status === 400) throw new Error(errorData.message || 'Masa silinemedi.');
        throw new Error(errorData.message || 'Masa silinemedi.');
      }
      setTables(tables.filter((table) => table.id !== tableId));
      setDeleteConfirm(null);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoadingTableId(null);
    }
  };

  // Paket kontrolü (masalar tüm paketlerde açık)
  if (!['base', 'package2', 'premium'].includes(package_type)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-red-100 text-red-600 p-4 rounded-md shadow-md max-w-md text-center">
          Bu özellik yalnızca base, package2 ve premium paketlerde kullanılabilir.
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
      <h3 className="text-xl font-semibold mb-4">
        Masalar – Restoran {restaurantId}, Şube {branchId}
      </h3>

      {/* Masa ekleme alanı */}
      <div className="mb-4 flex flex-col sm:flex-row items-center gap-2">
        <input
          type="number"
          value={tableNumber}
          onChange={(e) => setTableNumber(e.target.value)}
          placeholder="Masa numarası (örn. 1)"
          className="p-2 border rounded-md w-full max-w-xs"
        />
        <select
          value={selectedRegion}
          onChange={(e) => setSelectedRegion(e.target.value)}
          className="p-2 border rounded-md w-full max-w-xs"
        >
          <option value="">Bölge seç (opsiyonel)</option>
          {regions.map((region) => (
            <option key={region.id} value={region.name}>
              {region.name}
            </option>
          ))}
        </select>
        <button
          onClick={addTable}
          className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
        >
          Masa Ekle
        </button>
      </div>

      {/* Masa listesi */}
      {tables.length === 0 ? (
        <div className="text-gray-600">Bu şubede tanımlı masa bulunmamaktadır.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {tables.map((table) => (
            <div
              key={table.id}
              className="p-4 bg-white shadow-md rounded-md flex justify-between items-center relative"
            >
              <p>
                Masa: {table.table_number} {table.region ? `(${table.region})` : ''}
              </p>
              <button
                onClick={() => setDeleteConfirm(table.id)}
                disabled={loadingTableId === table.id}
                className={`px-3 py-1 rounded-md text-white ${
                  loadingTableId === table.id ? 'bg-gray-400' : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                {loadingTableId === table.id ? 'Siliniyor...' : 'Sil'}
              </button>
              {deleteConfirm === table.id && (
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white p-4 rounded-md shadow-md max-w-sm text-center">
                    <p>"Masa {table.table_number}" silmek istediğinizden emin misiniz?</p>
                    <div className="mt-4 flex gap-4 justify-center">
                      <button
                        onClick={() => deleteTable(table.id)}
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

export default Tables;
