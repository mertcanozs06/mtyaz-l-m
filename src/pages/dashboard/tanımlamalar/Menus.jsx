import { useEffect, useState, useContext } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { AuthContext } from '../../../context/AuthContext';
import { SocketContext } from '../../../context/SocketContext';

const Menus = () => {
  const { restaurantId, branchId } = useParams();
  const { user, selectedBranch, package_type,token} = useContext(AuthContext);
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
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteExtraConfirm, setDeleteExtraConfirm] = useState(null);

  // Menüleri ve ekstraları çek
  useEffect(() => {
    const fetchMenus = async () => {
      if (!user || !selectedBranch) {
        setErrorMessage('Kullanıcı veya şube bilgisi eksik.');
        setLoading(false);
        return;
      }

      if (user.restaurant_id !== parseInt(restaurantId)) {
        setErrorMessage('Bu restorana erişim yetkiniz yok.');
        setLoading(false);
        return;
      }

      if (branchId !== selectedBranch) {
        setErrorMessage('Seçilen şube geçersiz.');
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`http://localhost:5000/api/${restaurantId}/${branchId}/menus`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        if (!res.ok) {
          const errorData = await res.json();
          if (res.status === 401) throw new Error('Lütfen giriş yapın.');
          if (res.status === 403) throw new Error('Bu şubeye erişim yetkiniz yok.');
          throw new Error(errorData.message || 'Menüler yüklenemedi.');
        }
        const data = await res.json();
        setMenus(data);
        data.forEach((menu) => fetchExtras(menu.id));
        setLoading(false);
      } catch (err) {
        setErrorMessage(err.message);
        setLoading(false);
      }
    };

    fetchMenus();

    if (!isConnected || !socket) return;
    const handleMenuUpdated = (payload) => {
      if (payload.restaurant_id === parseInt(restaurantId) && payload.branch_id === parseInt(branchId)) {
        fetchMenus();
      }
    };
    socket.on('menu-updated', handleMenuUpdated);

    return () => {
      socket.off('menu-updated', handleMenuUpdated);
    };
  }, [user, restaurantId, branchId, selectedBranch, socket, isConnected]);

  const fetchExtras = async (menuId) => {
    try {
      const res = await fetch(
        `http://localhost:5000/api/${restaurantId}/${branchId}/menus/extras?menu_id=${menuId}`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }
      );
      if (!res.ok) throw new Error('Ekstra malzemeler yüklenemedi.');
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
      setErrorMessage('Lütfen menü adı ve fiyat girin.');
      return;
    }
    const formData = new FormData();
    formData.append('name', name);
    formData.append('price', parseFloat(price));
    formData.append('description', description);
    formData.append('category', category);
    if (image) formData.append('image', image);

    try {
      const res = await fetch(`http://localhost:5000/api/${restaurantId}/${branchId}/menus`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: formData,
      });
      if (!res.ok) {
        const errorData = await res.json();
        if (res.status === 401) throw new Error('Lütfen giriş yapın.');
        if (res.status === 403) throw new Error('Bu şubeye erişim yetkiniz yok.');
        throw new Error(errorData.message || 'Menü eklenemedi.');
      }
      const data = await res.json();
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
      socket?.emit('menu-updated', { restaurant_id: parseInt(restaurantId), branch_id: parseInt(branchId) });
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  const deleteMenu = async (menuId) => {
    try {
      const res = await fetch(`http://localhost:5000/api/${restaurantId}/${branchId}/menus/${menuId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!res.ok) {
        const errorData = await res.json();
        if (res.status === 401) throw new Error('Lütfen giriş yapın.');
        if (res.status === 403) throw new Error('Bu şubeye erişim yetkiniz yok.');
        throw new Error(errorData.message || 'Menü silinemedi.');
      }
      setMenus((prev) => prev.filter((menu) => menu.id !== menuId));
      setExtras((prev) => {
        const copy = { ...prev };
        delete copy[menuId];
        return copy;
      });
      setDeleteConfirm(null);
      socket?.emit('menu-updated', { restaurant_id: parseInt(restaurantId), branch_id: parseInt(branchId) });
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  const addExtra = async () => {
    if (!selectedMenuId || !extraName || !extraPrice) {
      setErrorMessage('Lütfen menü seçin ve ekstra malzeme adı ile fiyat girin.');
      return;
    }
    try {
      const res = await fetch(`http://localhost:5000/api/${restaurantId}/${branchId}/menus/extras`, {
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
      });
      if (!res.ok) {
        const errorData = await res.json();
        if (res.status === 401) throw new Error('Lütfen giriş yapın.');
        if (res.status === 403) throw new Error('Bu şubeye erişim yetkiniz yok.');
        throw new Error(errorData.message || 'Ekstra malzeme eklenemedi.');
      }
      const data = await res.json();
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
      socket?.emit('menu-updated', { restaurant_id: parseInt(restaurantId), branch_id: parseInt(branchId) });
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  const deleteExtra = async (menuId, extraId) => {
    try {
      const res = await fetch(`http://localhost:5000/api/${restaurantId}/${branchId}/menus/extras/${extraId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
      if (!res.ok) {
        const errorData = await res.json();
        if (res.status === 401) throw new Error('Lütfen giriş yapın.');
        if (res.status === 403) throw new Error('Bu şubeye erişim yetkiniz yok.');
        throw new Error(errorData.message || 'Ekstra malzeme silinemedi.');
      }
      setExtras((prev) => ({
        ...prev,
        [menuId]: prev[menuId].filter((extra) => extra.id !== extraId),
      }));
      setDeleteExtraConfirm(null);
      socket?.emit('menu-updated', { restaurant_id: parseInt(restaurantId), branch_id: parseInt(branchId) });
    } catch (err) {
      setErrorMessage(err.message);
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

      const res = await fetch(`http://localhost:5000/api/${restaurantId}/${branchId}/menus/${menuId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: formData,
      });
      if (!res.ok) {
        const errorData = await res.json();
        if (res.status === 401) throw new Error('Lütfen giriş yapın.');
        if (res.status === 403) throw new Error('Bu şubeye erişim yetkiniz yok.');
        throw new Error(errorData.message || 'Menü güncellenemedi.');
      }
      const data = await res.json();
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
      socket?.emit('menu-updated', { restaurant_id: parseInt(restaurantId), branch_id: parseInt(branchId) });
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  // Paket kontrolü
  if (!['package2', 'premium'].includes(package_type)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-red-100 text-red-600 p-4 rounded-md shadow-md max-w-md text-center">
          Bu özellik yalnızca package2 ve premium paketlerde kullanılabilir.
        </div>
      </div>
    );
  }

  // Yetkisiz erişim
  if (!user || user.role !== 'admin' || user.restaurant_id !== parseInt(restaurantId) || branchId !== selectedBranch) {
    return <Navigate to="/login" replace />;
  }

  // Yükleme durumu
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-gray-600">Yükleniyor...</div>
      </div>
    );
  }

  // Hata mesajı
  if (errorMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-red-100 text-red-600 p-4 rounded-md shadow-md max-w-md text-center">
          {errorMessage}
          <button
            className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            onClick={() => setErrorMessage('')}
          >
            Kapat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-100 min-h-screen">
      <h3 className="text-xl font-semibold mb-4">
        Menü Tanımlama – Restoran {restaurantId}, Şube {branchId}
      </h3>

      {/* Menü Ekleme Formu */}
      <div className="mb-6">
        <h4 className="text-lg font-semibold mb-2">Menü Ekle</h4>
        <div className="flex flex-col gap-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Menü adı (örn. Hamburger)"
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
            placeholder="Açıklama (opsiyonel)"
            className="p-2 border rounded-md"
          />
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Kategori (örn. Ana Yemek)"
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
            placeholder="Ekstra malzeme adı (örn. Peynir)"
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
      {menus.length === 0 ? (
        <div className="text-gray-600">Bu şubede tanımlı menü bulunmamaktadır.</div>
      ) : (
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
                      <div
                        key={menu.id}
                        className="p-4 bg-white shadow-md rounded-md relative"
                      >
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
                              placeholder="Menü adı"
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
                              placeholder="Fiyat (TL)"
                              min="0"
                              step="0.01"
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
                              placeholder="Açıklama"
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
                              placeholder="Kategori"
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
                            <p className="text-gray-600">{menu.description || 'Açıklama yok'}</p>
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
                                      onClick={() => setDeleteExtraConfirm({ menuId: menu.id, extraId: extra.id })}
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
                                onClick={() => setDeleteConfirm(menu.id)}
                                className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600"
                              >
                                Sil
                              </button>
                            </div>
                          </>
                        )}
                        {deleteConfirm === menu.id && (
                          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                            <div className="bg-white p-4 rounded-md shadow-md max-w-sm text-center">
                              <p>"{menu.name}" menüsünü silmek istediğinizden emin misiniz?</p>
                              <div className="mt-4 flex gap-4 justify-center">
                                <button
                                  onClick={() => deleteMenu(menu.id)}
                                  className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                                >
                                  Evet, Sil
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm(null)}
                                  className="bg-gray-300 text-black px-3 py-1 rounded hover:bg-gray-400"
                                >
                                  İptal
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                        {deleteExtraConfirm && deleteExtraConfirm.menuId === menu.id && (
                          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                            <div className="bg-white p-4 rounded-md shadow-md max-w-sm text-center">
                              <p>"{extras[menu.id]?.find((e) => e.id === deleteExtraConfirm.extraId)?.name}" ekstra malzemesini silmek istediğinizden emin misiniz?</p>
                              <div className="mt-4 flex gap-4 justify-center">
                                <button
                                  onClick={() => deleteExtra(deleteExtraConfirm.menuId, deleteExtraConfirm.extraId)}
                                  className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                                >
                                  Evet, Sil
                                </button>
                                <button
                                  onClick={() => setDeleteExtraConfirm(null)}
                                  className="bg-gray-300 text-black px-3 py-1 rounded hover:bg-gray-400"
                                >
                                  İptal
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Menus;

