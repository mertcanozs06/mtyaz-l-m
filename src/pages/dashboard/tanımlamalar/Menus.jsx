import { useEffect, useState, useContext } from 'react';
import { useParams } from 'react-router-dom';
import { SocketContext } from '../../../context/SocketContext';

const Menus = () => {
  const { restaurantId } = useParams();
  const socket = useContext(SocketContext);
  const [menus, setMenus] = useState([]);
  const [extras, setExtras] = useState({});
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [extraName, setExtraName] = useState('');
  const [extraPrice, setExtraPrice] = useState('');
  const [selectedMenuId, setSelectedMenuId] = useState(null);

  useEffect(() => {
    // Menüleri getir
    const fetchMenus = () => {
      fetch(`http://localhost:5000/api/menu/${restaurantId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      })
        .then((res) => {
          if (!res.ok) throw new Error('Failed to fetch menus');
          return res.json();
        })
        .then((data) => setMenus(data))
        .catch((err) => alert('Menüler alınamadı: ' + err.message));
    };

    fetchMenus();

    // Socket.IO ile menü güncellemelerini dinle
    socket.on('menu-updated', () => {
      fetchMenus();
    });

    return () => socket.off('menu-updated');
  }, [restaurantId, socket]);

  const fetchExtras = async (menuId) => {
    try {
      const res = await fetch(`http://localhost:5000/api/menu/extras/${restaurantId}?menu_id=${menuId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!res.ok) throw new Error('Failed to fetch extras');
      const data = await res.json();
      setExtras((prev) => ({ ...prev, [menuId]: data }));
    } catch (err) {
      console.error(`Ekstra malzemeler alınamadı (menu ${menuId}): ${err.message}`);
    }
  };

  const addMenu = async () => {
    if (!name || !price) {
      alert('Lütfen menü adı ve fiyat girin.');
      return;
    }
    try {
      const res = await fetch(`http://localhost:5000/api/menu/${restaurantId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ name, price: parseFloat(price), description, category }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setMenus([...menus, { id: data.id, name, price: parseFloat(price), description, category }]);
      setName('');
      setPrice('');
      setDescription('');
      setCategory('');
      alert('Menü eklendi!');
      socket.emit('menu-updated', { restaurant_id: restaurantId });
    } catch (err) {
      alert('Menü eklenemedi: ' + err.message);
    }
  };

  const addExtra = async () => {
    if (!selectedMenuId || !extraName || !extraPrice) {
      alert('Lütfen menü seçin ve ekstra malzeme adı ile fiyat girin.');
      return;
    }
    try {
      const res = await fetch(`http://localhost:5000/api/menu/extras/${restaurantId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ menu_id: selectedMenuId, name: extraName, price: parseFloat(extraPrice) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setExtras((prev) => ({
        ...prev,
        [selectedMenuId]: [...(prev[selectedMenuId] || []), { id: data.id, name: extraName, price: parseFloat(extraPrice) }],
      }));
      setExtraName('');
      setExtraPrice('');
      alert('Ekstra malzeme eklendi!');
      socket.emit('menu-updated', { restaurant_id: restaurantId });
    } catch (err) {
      alert('Ekstra malzeme eklenemedi: ' + err.message);
    }
  };

  const deleteExtra = async (menuId, extraId) => {
    try {
      const res = await fetch(`http://localhost:5000/api/menu/extras/${extraId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setExtras((prev) => ({
        ...prev,
        [menuId]: prev[menuId].filter((extra) => extra.id !== extraId),
      }));
      alert('Ekstra malzeme silindi!');
      socket.emit('menu-updated', { restaurant_id: restaurantId });
    } catch (err) {
      alert('Ekstra malzeme silinemedi: ' + err.message);
    }
  };

  return (
    <div className="p-4">
      <h3 className="text-xl font-semibold mb-4">Menü Tanımlama</h3>

      {/* Menü Ekleme */}
      <div className="mb-6">
        <h4 className="text-lg font-semibold mb-2">Menü Ekle</h4>
        <div className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Menü adı"
            className="p-2 border rounded-md"
          />
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Fiyat (TL)"
            min="0"
            step="0.01"
            className="p-2 border rounded-md"
          />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Açıklama"
            className="p-2 border rounded-md"
          />
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Kategori (örn: Pideler)"
            className="p-2 border rounded-md"
          />
          <button
            onClick={addMenu}
            className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
          >
            Menü Ekle
          </button>
        </div>
      </div>

      {/* Ekstra Malzeme Ekleme */}
      <div className="mb-6">
        <h4 className="text-lg font-semibold mb-2">Menüye Özel Ekstra Malzeme Ekle</h4>
        <div className="flex flex-col sm:flex-row gap-4">
          <select
            value={selectedMenuId || ''}
            onChange={(e) => {
              setSelectedMenuId(e.target.value);
              if (e.target.value) fetchExtras(e.target.value);
            }}
            className="p-2 border rounded-md"
          >
            <option value="">Menü Seçin</option>
            {menus.map((menu) => (
              <option key={menu.id} value={menu.id}>
                {menu.name} {menu.category ? `(${menu.category})` : ''}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={extraName}
            onChange={(e) => setExtraName(e.target.value)}
            placeholder="Ekstra malzeme adı"
            className="p-2 border rounded-md"
          />
          <input
            type="number"
            value={extraPrice}
            onChange={(e) => setExtraPrice(e.target.value)}
            placeholder="Fiyat (TL)"
            min="0"
            step="0.01"
            className="p-2 border rounded-md"
          />
          <button
            onClick={addExtra}
            className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
          >
            Ekstra Malzeme Ekle
          </button>
        </div>
      </div>

      {/* Menü Listesi */}
      <h3 className="text-xl font-semibold mb-4">Menüler</h3>
      <div className="space-y-8">
        {[...new Set(menus.map((m) => m.category || 'Genel'))].map((category) => (
          <div key={category}>
            <h4 className="text-lg font-semibold mb-2">{category}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {menus.filter((m) => (m.category || 'Genel') === category).map((menu) => (
                <div key={menu.id} className="p-4 bg-white shadow-md rounded-md">
                  <p className="text-lg font-semibold">{menu.name}</p>
                  <p className="text-gray-600">{menu.description}</p>
                  <p className="text-blue-600 font-bold">{menu.price} TL</p>
                  <div className="mt-2">
                    <h5 className="font-semibold">Ekstra Malzemeler:</h5>
                    {(extras[menu.id] || []).length ? (
                      extras[menu.id].map((extra) => (
                        <div key={extra.id} className="flex justify-between items-center mt-1">
                          <p>{extra.name} - {extra.price} TL</p>
                          <button
                            onClick={() => deleteExtra(menu.id, extra.id)}
                            className="bg-red-500 text-white px-2 py-1 rounded-md hover:bg-red-600"
                          >
                            Sil
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500">Ekstra malzeme yok.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Menus;
