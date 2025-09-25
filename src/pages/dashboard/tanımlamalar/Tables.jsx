import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const Tables = () => {
  const { restaurantId } = useParams();
  const [tables, setTables] = useState([]);
  const [tableNumber, setTableNumber] = useState('');
  const [loadingTableId, setLoadingTableId] = useState(null);

  // Masaları çek
  useEffect(() => {
    fetch(`http://localhost:5000/api/table/${restaurantId}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch tables');
        return res.json();
      })
      .then((data) => setTables(data))
      .catch((err) => alert('Masalar alınamadı: ' + err.message));
  }, [restaurantId]);

  // Masa ekle
  const addTable = async () => {
    if (!tableNumber) return;

    try {
      const res = await fetch(`http://localhost:5000/api/table/${restaurantId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ table_number: parseInt(tableNumber) }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message);

      setTables([...tables, { id: data.id, table_number: parseInt(tableNumber) }]);
      setTableNumber('');
    } catch (err) {
      alert('Masa eklenemedi: ' + err.message);
    }
  };

  // Masa sil
  const deleteTable = async (tableId) => {
    setLoadingTableId(tableId); // Silme başladı

    try {
      const res = await fetch(`http://localhost:5000/api/table/${tableId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message);

      // UI'dan sil
      setTables(tables.filter((table) => table.id !== tableId));
    } catch (err) {
      alert('Masa silinemedi: ' + err.message);
    } finally {
      setLoadingTableId(null); // Silme bitti
    }
  };

  return (
    <div className="p-4">
      <h3 className="text-xl font-semibold mb-4">Masalar</h3>

      {/* Masa ekleme alanı */}
      <div className="mb-4">
        <input
          type="number"
          value={tableNumber}
          onChange={(e) => setTableNumber(e.target.value)}
          placeholder="Masa numarası"
          className="p-2 border rounded-md mr-2"
        />
        <button
          onClick={addTable}
          className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
        >
          Masa Ekle
        </button>
      </div>

      {/* Masa listesi */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {tables.map((table) => (
          <div
            key={table.id}
            className="p-4 bg-white shadow-md rounded-md flex justify-between items-center"
          >
            <p>Masa: {table.table_number}</p>
            <button
              onClick={() => deleteTable(table.id)}
              disabled={loadingTableId === table.id}
              className={`px-3 py-1 rounded-md text-white ${
                loadingTableId === table.id ? 'bg-gray-400' : 'bg-red-500 hover:bg-red-600'
              }`}
            >
              {loadingTableId === table.id ? 'Siliniyor...' : 'Sil'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Tables;
