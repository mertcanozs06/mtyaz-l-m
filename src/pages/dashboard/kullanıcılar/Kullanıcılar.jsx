import { useEffect, useState, useContext } from 'react';
import { useParams } from 'react-router-dom';
import { AuthContext } from '../../../context/AuthContext';

const Kullanıcılar = () => {
  const { restaurantId } = useParams();
  const { user } = useContext(AuthContext);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!restaurantId) return;

    const fetchUsers = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`http://localhost:5000/api/user/${restaurantId}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });

        if (!res.ok) throw new Error('Kullanıcılar alınamadı');
        const data = await res.json();
        setUsers(data);
      } catch (err) {
        console.error('Kullanıcı çekme hatası:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [restaurantId]);

  if (!user) return null;
  if (user.role !== 'admin') return null;

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Kullanıcılar</h2>
      </div>

      {loading && <p className="text-gray-500">Yükleniyor...</p>}
      {error && <p className="text-red-500">Hata: {error}</p>}

      {!loading && !error && users.length === 0 && (
        <p className="text-gray-500">Hiç kullanıcı bulunamadı.</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {users.map((u) => (
          <div key={u.id} className="p-4 bg-white shadow-md rounded-md">
            <p><strong>E-posta:</strong> {u.email}</p>
            <p><strong>Rol:</strong> {
              u.role === 'admin' ? 'Yönetici' :
              u.role === 'waiter' ? 'Garson' :
              u.role === 'kitchen' ? 'Mutfak' : u.role
            }</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Kullanıcılar;
