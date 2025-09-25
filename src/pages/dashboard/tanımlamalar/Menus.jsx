import { useEffect, useState, useContext } from 'react';
import { useParams } from 'react-router-dom';
import { SocketContext } from '../../../context/SocketContext';

const Menus = () => {
  const { restaurantId } = useParams();
  const { socket, isConnected } = useContext(SocketContext);

  const [menus, setMenus] = useState([]);
  const [extras, setExtras] = useState({});
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [image, setImage] = useState(null);
  const [extraName, setExtraName] = useState('');
  const [extraPrice, setExtraPrice] = useState('');
  const [selectedMenuId, setSelectedMenuId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingMenus, setEditingMenus] = useState({});

  useEffect(() => {
    const fetchMenus = () => {
      fetch(`http://localhost:5000/api/menu/${restaurantId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      })
        .then((res) => {
          if (!res.ok) throw new Error('Failed to fetch menus');
          return res.json();
        })
        .then((data) => {
          setMenus(data);
          data.forEach((menu) => {
            fetchExtras(menu.id);
          });
        })
        .catch((err) => {
          alert('Menüler alınamadı: ' + err.message);
        });
    };

    fetchMenus();

    if (!isConnected || !socket) return;
    const handleMenuUpdated = () => {
      fetchMenus();
    };
    socket.on('menu-updated', handleMenuUpdated);

    return () => {
      socket.off('menu-updated', handleMenuUpdated);
    };
  }, [restaurantId, socket, isConnected]);

  const fetchExtras = async (menuId) => {
    try {
      const res = await fetch(
        `http://localhost:5000/api/menu/extras/${restaurantId}?menu_id=${menuId}`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }
      );
      if (!res.ok) throw new Error('Failed to fetch extras');
      const data = await res.json();
      setExtras((prev) => ({ ...prev, [menuId]: data }));
    } catch (err) {
      console.error(`Ekstra malzemeler alınamadı (menu ${menuId}): ${err.message}`);
    }
  };

  const resetForm = () => {
    setName('');
    setPrice('');
    setDescription('');
    setCategory('');
    setImage(null);
    setSelectedMenuId(null);
    setIsEditing(false);
    setExtraName('');
    setExtraPrice('');
  };

  const addMenu = async () => {
    if (!name || !price) {
      alert('Lütfen menü adı ve fiyat girin.');
      return;
    }
    const formData = new FormData();
    formData.append('name', name);
    formData.append('price', parseFloat(price));
    formData.append('description', description);
    formData.append('category', category);
    if (image) formData.append('image', image);

    try {
      const res = await fetch(`http://localhost:5000/api/menu/${restaurantId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Bilinmeyen hata');

      setMenus((prev) => [
        ...prev,
        {
          id: data.id,
          name,
          price: parseFloat(price),
          description,
          category,
          image_url: data.image_url,
        },
      ]);
      resetForm();
      alert('Menü eklendi!');
      socket?.emit('menu-updated', { restaurant_id: restaurantId });
    } catch (err) {
      alert('Menü eklenemedi: ' + err.message);
    }
  };

  const deleteMenu = async (menuId) => {
    if (!window.confirm('Bu menüyü silmek istediğinizden emin misiniz?')) return;
    try {
      const res = await fetch(`http://localhost:5000/api/menu/${menuId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setMenus((prev) => prev.filter((menu) => menu.id !== menuId));
      setExtras((prev) => {
        const copy = { ...prev };
        delete copy[menuId];
        return copy;
      });
      alert('Menü silindi!');
      socket?.emit('menu-updated', { restaurant_id: restaurantId });
    } catch (err) {
      alert('Menü silinemedi: ' + err.message);
    }
  };

  const addExtra = async () => {
    if (!selectedMenuId || !extraName || !extraPrice) {
      alert('Lütfen menü seçin ve ekstra malzeme adı ile fiyat girin.');
      return;
    }
    try {
      const res = await fetch(
        `http://localhost:5000/api/menu/extras/${restaurantId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({
            menu_id: selectedMenuId,
            name: extraName,
            price: parseFloat(extraPrice),
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setExtras((prev) => ({
        ...prev,
        [selectedMenuId]: [
          ...(prev[selectedMenuId] || []),
          { id: data.id, name: extraName, price: parseFloat(extraPrice) },
        ],
      }));
      setExtraName('');
      setExtraPrice('');
      setSelectedMenuId(null);
      alert('Ekstra malzeme eklendi!');
      socket?.emit('menu-updated', { restaurant_id: restaurantId });
    } catch (err) {
      alert('Ekstra malzeme eklenemedi: ' + err.message);
    }
  };

  const deleteExtra = async (menuId, extraId) => {
    if (!window.confirm('Bu ekstra malzemeyi silmek istediğinizden emin misiniz?')) return;
    try {
      const res = await fetch(
        `http://localhost:5000/api/menu/extras/${extraId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setExtras((prev) => ({
        ...prev,
        [menuId]: prev[menuId].filter((extra) => extra.id !== extraId),
      }));
      alert('Ekstra malzeme silindi!');
      socket?.emit('menu-updated', { restaurant_id: restaurantId });
    } catch (err) {
      alert('Ekstra malzeme silinemedi: ' + err.message);
    }
  };

  const updateMenuInline = async (menuId, updatedData) => {
    try {
      const formData = new FormData();
      formData.append('name', updatedData.name);
      formData.append('price', parseFloat(updatedData.price));
      formData.append('description', updatedData.description);
      formData.append('category', updatedData.category);
      if (updatedData.image) formData.append('image', updatedData.image);

      const res = await fetch(`http://localhost:5000/api/menu/${menuId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Bilinmeyen hata');

      setMenus((prev) =>
        prev.map((menu) =>
          menu.id === menuId
            ? {
                ...menu,
                name: updatedData.name,
                price: parseFloat(updatedData.price),
                description: updatedData.description,
                category: updatedData.category,
                image_url: data.image_url ?? menu.image_url,
              }
            : menu
        )
      );

      setEditingMenus((prev) => {
        const copy = { ...prev };
        delete copy[menuId];
        return copy;
      });

      alert('Menü güncellendi!');
      socket?.emit('menu-updated', { restaurant_id: restaurantId });
    } catch (err) {
      alert('Menü güncellenemedi: ' + err.message);
    }
  };

  return (
    <div className="p-4">
      <h3 className="text-xl font-semibold mb-4">Menü Tanımlama</h3>

      {/* Menü Ekleme Formu */}
      <div className="mb-6">
        <h4 className="text-lg font-semibold mb-2">Menü Ekle</h4>
        <div className="flex flex-col gap-4">
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
            placeholder="Kategori"
            className="p-2 border rounded-md"
          />
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImage(e.target.files[0])}
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

      {/* Ekstra Malzeme Ekleme Formu */}
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

      <h3 className="text-xl font-semibold mb-4">Menüler</h3>
      <div className="space-y-8">
        {[...new Set(menus.map((m) => m.category || 'Genel'))].map((cat) => (
          <div key={cat}>
            <h4 className="text-lg font-semibold mb-2">{cat}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {menus
                .filter((m) => (m.category || 'Genel') === cat)
                .map((menu) => {
                  const isEditingThis = !!editingMenus[menu.id];
                  const editData = editingMenus[menu.id] || {};

                  return (
                    <div key={menu.id} className="p-4 bg-white shadow-md rounded-md">
                      {isEditingThis ? (
                        <>
                          <input
                            type="text"
                            value={editData.name}
                            onChange={(e) =>
                              setEditingMenus((prev) => ({
                                ...prev,
                                [menu.id]: {
                                  ...prev[menu.id],
                                  name: e.target.value,
                                },
                              }))
                            }
                            className="p-2 border rounded-md mb-2 w-full"
                          />
                          <input
                            type="number"
                            value={editData.price}
                            onChange={(e) =>
                              setEditingMenus((prev) => ({
                                ...prev,
                                [menu.id]: {
                                  ...prev[menu.id],
                                  price: e.target.value,
                                },
                              }))
                            }
                            className="p-2 border rounded-md mb-2 w-full"
                          />
                          <input
                            type="text"
                            value={editData.description}
                            onChange={(e) =>
                              setEditingMenus((prev) => ({
                                ...prev,
                                [menu.id]: {
                                  ...prev[menu.id],
                                  description: e.target.value,
                                },
                              }))
                            }
                            className="p-2 border rounded-md mb-2 w-full"
                          />
                          <input
                            type="text"
                            value={editData.category}
                            onChange={(e) =>
                              setEditingMenus((prev) => ({
                                ...prev,
                                [menu.id]: {
                                  ...prev[menu.id],
                                  category: e.target.value,
                                },
                              }))
                            }
                            className="p-2 border rounded-md mb-2 w-full"
                          />
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) =>
                              setEditingMenus((prev) => ({
                                ...prev,
                                [menu.id]: {
                                  ...prev[menu.id],
                                  image: e.target.files[0],
                                },
                              }))
                            }
                            className="p-2 border rounded-md mb-2 w-full"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => updateMenuInline(menu.id, editData)}
                              className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600"
                            >
                              Güncelle
                            </button>
                            <button
                              onClick={() =>
                                setEditingMenus((prev) => {
                                  const copy = { ...prev };
                                  delete copy[menu.id];
                                  return copy;
                                })
                              }
                              className="bg-gray-400 text-white px-4 py-2 rounded-md hover:bg-gray-500"
                            >
                              İptal
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          {menu.image_url && (
                            <img
                              src={`http://localhost:5000${menu.image_url}`}
                              alt={menu.name}
                              className="w-full object-cover mb-2 rounded-md"
                              style={{ height: '300px' }}
                            />
                          )}
                          <p className="text-lg font-semibold">{menu.name}</p>
                          <p className="text-gray-600">{menu.description}</p>
                          <p className="text-blue-600 font-bold">{menu.price} TL</p>

                          <div className="mt-2">
                            <h5 className="font-semibold">Ekstra Malzemeler:</h5>
                            {(extras[menu.id] || []).length > 0 ? (
                              extras[menu.id].map((extra) => (
                                <div
                                  key={extra.id}
                                  className="flex justify-between items-center mt-1"
                                >
                                  <p>
                                    {extra.name} - {extra.price} TL
                                  </p>
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

                          <div className="flex gap-2 mt-4">
                            <button
                              onClick={() =>
                                setEditingMenus((prev) => ({
                                  ...prev,
                                  [menu.id]: {
                                    name: menu.name,
                                    price: menu.price,
                                    description: menu.description || '',
                                    category: menu.category || '',
                                    image: null,
                                  },
                                }))
                              }
                              className="bg-yellow-500 text-white px-4 py-2 rounded-md hover:bg-yellow-600"
                            >
                              Düzenle
                            </button>
                            <button
                              onClick={() => deleteMenu(menu.id)}
                              className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600"
                            >
                              Sil
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Menus;

