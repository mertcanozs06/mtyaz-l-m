import { useEffect, useState, useContext } from 'react';
import { useParams } from 'react-router-dom';
import { AuthContext } from '../../../context/AuthContext';

const Discounts = () => {
  const { restaurantId } = useParams();
  const { user } = useContext(AuthContext);
  const [discounts, setDiscounts] = useState([]);
  const [name, setName] = useState('');
  const [percentage, setPercentage] = useState('');

  useEffect(() => {
    fetch(`http://localhost:5000/api/discount/${restaurantId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch discounts');
        return res.json();
      })
      .then((data) => setDiscounts(data))
      .catch((err) => alert('İndirimler alınamadı: ' + err.message));
  }, [restaurantId]);

  const addDiscount = async () => {
    if (!name || !percentage) {
      alert('Lütfen indirim adı ve yüzdesini girin.');
      return;
    }
    if (percentage <= 0 || percentage > 100) {
      alert('Yüzde 0 ile 100 arasında olmalıdır.');
      return;
    }
    try {
      const res = await fetch(`http://localhost:5000/api/discount/${restaurantId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ name, percentage: parseFloat(percentage) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setDiscounts([...discounts, { id: data.id || Date.now(), name, percentage: parseFloat(percentage) }]);
      setName('');
      setPercentage('');
      alert('İndirim eklendi!');
    } catch (err) {
      alert('İndirim eklenemedi: ' + err.message);
    }
  };

  const deleteDiscount = async (id) => {
    try {
      const res = await fetch(`http://localhost:5000/api/discount/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setDiscounts(discounts.filter((discount) => discount.id !== id));
      alert('İndirim silindi!');
    } catch (err) {
      alert('İndirim silinemedi: ' + err.message);
    }
  };

  if (user.role !== 'admin') return null;

  return (
    <div className="p-4">
      <h3 className="text-xl font-semibold mb-4">İndirimler</h3>
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="İndirim adı"
          className="p-2 border rounded-md"
        />
        <input
          type="number"
          value={percentage}
          onChange={(e) => setPercentage(e.target.value)}
          placeholder="Yüzde (%)"
          min="0"
          max="100"
          className="p-2 border rounded-md"
        />
        <button
          onClick={addDiscount}
          className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
        >
          İndirim Ekle
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {discounts.length === 0 ? (
          <p className="text-gray-500">Henüz indirim tanımlanmamış.</p>
        ) : (
          discounts.map((discount) => (
            <div key={discount.id} className="p-4 bg-white shadow-md rounded-md flex justify-between items-center">
              <p>
                {discount.name} - %{discount.percentage}
              </p>
              <button
                onClick={() => deleteDiscount(discount.id)}
                className="bg-red-500 text-white px-3 py-1 rounded-md hover:bg-red-600"
              >
                Sil
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Discounts;