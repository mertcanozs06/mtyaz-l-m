import { useEffect, useState, useContext } from 'react';
import { useParams } from 'react-router-dom';
import { AuthContext } from '../../../context/AuthContext';

const Regions = () => {
  const { restaurantId } = useParams();
  const { token } = useContext(AuthContext);
  const [regions, setRegions] = useState([]);
  const [regionName, setRegionName] = useState('');

  useEffect(() => {
    const fetchRegions = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/regions/${restaurantId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Bölgeler alınamadı');
        const data = await res.json();
        setRegions(data);
      } catch (err) {
        console.error(err);
      }
    };
    if (token && restaurantId) fetchRegions();
  }, [restaurantId, token]);

  const addRegion = async () => {
    try {
      const res = await fetch(`http://localhost:5000/api/regions/${restaurantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: regionName })
      });
      if (!res.ok) throw new Error('Bölge eklenemedi');
      const data = await res.json();
      setRegions((prev) => [...prev, data]);
      setRegionName('');
    } catch (err) {
      alert('Bölge eklenemedi: ' + err.message);
    }
  };

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-4">Bölgeler</h3>
      <div className="mb-4">
        <input
          type="text"
          value={regionName}
          onChange={(e) => setRegionName(e.target.value)}
          placeholder="Bölge adı"
          className="p-2 border rounded-md mr-2"
        />
        <button
          onClick={addRegion}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-600">
          Bölge Ekle Bölüm
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {regions.map((region => (
          <div key={region.id} className="p-4 bg-white shadow-md rounded-md">
            <p>{region.name}</p>
          </div>
        )))}
      </div>
    </div>
  );
};

export default Regions;
