import { useEffect, useState, useContext } from 'react';
import { useParams } from 'react-router-dom';
import { AuthContext } from '../../../context/AuthContext';

const Kullanıcılar = () => {
  const { restaurantId } = useParams();
  const { user, logout } = useContext(AuthContext);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetch(`http://localhost:5000/api/user/${restaurantId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch users');
        return res.json();
      })
      .then((data) => setUsers(data))
      .catch((err) => alert('Kullanıcılar alınamadı: ' + err.message));
  }, [restaurantId]);

  if (user.role !== 'admin') return null;

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Kullanıcılar</h2>
      
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {users.map((user) => (
          <div key={user.id} className="p-4 bg-white shadow-md rounded-md">
            <p><strong>E-posta:</strong> {user.email}</p>
            <p><strong>Rol:</strong> {user.role === 'admin' ? 'Yönetici' : user.role === 'waiter' ? 'Garson' : 'Mutfak'}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Kullanıcılar;
