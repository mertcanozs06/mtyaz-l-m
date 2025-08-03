import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const UserSettings = () => {
  const { restaurantid } = useParams();
  const [users, setUsers] = useState([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('waiter');

  useEffect(() => {
    fetch(`http://localhost:5000/api/user/${restaurantid}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch users');
        return res.json();
      })
      .then((data) => setUsers(data))
      .catch((err) => alert('Kullanıcılar alınamadı: ' + err.message));
  }, [restaurantid]);

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`http://localhost:5000/api/user/${restaurantid}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ email, password, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setUsers([...users, { id: Date.now(), email, role }]);
      setEmail('');
      setPassword('');
      setRole('waiter');
      alert('Kullanıcı eklendi!');
    } catch (err) {
      alert('Kullanıcı eklenemedi: ' + err.message);
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      const res = await fetch(`http://localhost:5000/api/user/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setUsers(users.filter((user) => user.id !== userId));
      alert('Kullanıcı silindi!');
    } catch (err) {
      alert('Kullanıcı silinemedi: ' + err.message);
    }
  };

  return (
    <div className="p-4">
      <h3 className="text-xl font-semibold mb-4">Kullanıcı Ayarları</h3>
      <form onSubmit={handleAddUser} className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium">E-posta</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 border rounded-md"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Şifre</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 border rounded-md"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Rol</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full p-2 border rounded-md"
          >
            <option value="waiter">Garson</option>
            <option value="kitchen">Mutfak</option>
          </select>
        </div>
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
        >
          Kullanıcı Ekle
        </button>
      </form>
      <h4 className="text-lg font-semibold mb-4">Mevcut Kullanıcılar</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {users.map((user) => (
          <div key={user.id} className="p-4 bg-white shadow-md rounded-md flex justify-between items-center">
            <div>
              <p><strong>E-posta:</strong> {user.email}</p>
              <p><strong>Rol:</strong> {user.role === 'admin' ? 'Yönetici' : user.role === 'waiter' ? 'Garson' : 'Mutfak'}</p>
            </div>
            {user.role !== 'admin' && (
              <button
                onClick={() => handleDeleteUser(user.id)}
                className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600"
              >
                Sil
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserSettings;
