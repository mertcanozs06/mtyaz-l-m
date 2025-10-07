// src/pages/dashboard/settings/UserSettings.jsx
import { useEffect, useState } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import { AuthContext } from '../../../context/AuthContext';

const UserSettings = () => {
  const { restaurantId } = useParams();
  const { selectedBranch } = useOutletContext();
  const { updateUser } = useContext(AuthContext);
  const [users, setUsers] = useState([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('waiter');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    if (!selectedBranch) return;
    setIsLoading(true);
    fetch(`http://localhost:5000/api/users/${restaurantId}/${selectedBranch}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Kullanıcılar alınamadı.');
        return res.json();
      })
      .then((data) => {
        setUsers(data);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [restaurantId, selectedBranch]);

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!selectedBranch) {
      setError('Lütfen bir şube seçin.');
      return;
    }
    if (!email || !password || !role) {
      setError('E-posta, şifre ve rol zorunludur.');
      return;
    }
    try {
      setIsLoading(true);
      const res = await fetch(`http://localhost:5000/api/users/${restaurantId}/${selectedBranch}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ email, password, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Kullanıcı eklenemedi.');
      setUsers([...users, { id: data.id, email, role }]);
      setEmail('');
      setPassword('');
      setRole('waiter');
      setSuccessMessage('Kullanıcı eklendi!');
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Bu kullanıcıyı silmek istediğinizden emin misiniz?')) return;
    try {
      setIsLoading(true);
      const res = await fetch(`http://localhost:5000/api/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Kullanıcı silinemedi.');
      setUsers(users.filter((user) => user.id !== userId));
      setSuccessMessage('Kullanıcı silindi!');
      setError(null);
      await updateUser(); // Kullanıcı rolü değişmiş olabilir
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="text-center">Yükleniyor...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-100 text-red-600 p-4 rounded-md max-w-md mx-auto text-center">
        {error}
        <button
          className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          onClick={() => setError(null)}
        >
          Kapat
        </button>
      </div>
    );
  }

  return (
    <div className="p-4">
      {successMessage && (
        <div className="bg-green-100 text-green-600 p-4 rounded-md mb-4 max-w-md text-center">
          {successMessage}
          <button
            className="mt-2 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            onClick={() => setSuccessMessage(null)}
          >
            Kapat
          </button>
        </div>
      )}
      <h3 className="text-xl font-semibold mb-4">Kullanıcı Ayarları (Şube: {selectedBranch})</h3>
      <form onSubmit={handleAddUser} className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium">E-posta</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 border rounded-md"
            required
            disabled={isLoading}
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
            disabled={isLoading}
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Rol</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full p-2 border rounded-md"
            disabled={isLoading}
          >
            <option value="waiter">Garson</option>
            <option value="kitchen">Mutfak</option>
          </select>
        </div>
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
          disabled={isLoading}
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
                disabled={isLoading}
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
