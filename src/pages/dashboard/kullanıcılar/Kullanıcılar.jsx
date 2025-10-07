import { useEffect, useState, useContext } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { AuthContext } from '../../../context/AuthContext';

const Kullanıcılar = () => {
  const { restaurantId, branchId } = useParams();
  const { user, token, selectedBranch, package_type, logout } = useContext(AuthContext);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Kullanıcıları çek
  useEffect(() => {
    const fetchUsers = async () => {
      if (!restaurantId || !branchId || !token) {
        setError('Restoran, şube veya token bilgisi eksik.');
        setLoading(false);
        return;
      }

      if (user?.restaurant_id !== parseInt(restaurantId)) {
        setError('Bu restorana erişim yetkiniz yok.');
        setLoading(false);
        return;
      }

      if (branchId !== selectedBranch) {
        setError('Seçilen şube geçersiz.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`http://localhost:5000/api/${restaurantId}/${branchId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const errorData = await res.json();
          if (res.status === 401) throw new Error('Oturumunuz sona erdi. Lütfen tekrar giriş yapın.');
          if (res.status === 403) throw new Error('Bu şubeye erişim yetkiniz yok.');
          if (res.status === 404) throw new Error(errorData.message || 'Bu şubede kullanıcı bulunamadı.');
          throw new Error(errorData.message || 'Kullanıcılar alınamadı.');
        }
        const data = await res.json();
        setUsers(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [restaurantId, branchId, token, user, selectedBranch]);

  // Paket kontrolü
  if (!['base', 'package2', 'premium'].includes(package_type)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-red-100 text-red-600 p-4 rounded-md shadow-md max-w-md text-center">
          Kullanıcı yönetimi özelliği yalnızca base, package2 ve premium paketlerde kullanılabilir.
        </div>
      </div>
    );
  }

  // Yetkisiz erişim
  if (!user || !['admin', 'owner'].includes(user.role) || user.restaurant_id !== parseInt(restaurantId) || branchId !== selectedBranch) {
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
    <div className="min-h-screen p-4 sm:p-6 md:p-8 bg-gray-100">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">
          Kullanıcılar – Restoran {restaurantId}, Şube {branchId}
        </h2>
        <button
          onClick={() => logout()}
          className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600"
        >
          Çıkış Yap
        </button>
      </div>

      <div className="space-y-8">
        <h3 className="text-xl font-semibold mb-4">Kullanıcı Listesi</h3>
        {users.length === 0 ? (
          <p className="text-gray-500">Bu şubede kullanıcı bulunmamaktadır.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {users.map((u) => (
              <div key={u.id} className="p-4 bg-white shadow-md rounded-md">
                <p>
                  <strong>E-posta:</strong> {u.email}
                </p>
                <p>
                  <strong>Rol:</strong>{' '}
                  {u.role === 'admin'
                    ? 'Yönetici'
                    : u.role === 'owner'
                    ? 'Sahip'
                    : u.role === 'waiter'
                    ? 'Garson'
                    : u.role === 'kitchen'
                    ? 'Mutfak'
                    : u.role}
                </p>
                <p>
                  <strong>Şube ID:</strong> {u.branch_id}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Kullanıcılar;
