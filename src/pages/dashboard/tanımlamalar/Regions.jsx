import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const Regions = () => {
  const { restaurantId } = useParams();
  const [regions, setRegions] = useState([]);
  const [regionName, setRegionName] = useState('');

  useEffect(() => {
    // Bölgeleri getiren bir endpoint eklenebilir
    setRegions([]); // Şimdilik boş
  }, [restaurantId]);

  const addRegion = async () => {
    try {
      // Bölge ekleme endpoint'i eklenebilir
      setRegions([...regions, { id: Date.now(), name: regionName }]);
      setRegionName('');
    } catch (err) {
      alert('Bölge eklenemedi: ' + err.message);
    };
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
