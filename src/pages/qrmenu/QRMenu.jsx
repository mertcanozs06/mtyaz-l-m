import { useEffect, useState, useContext } from 'react';
import { useParams } from 'react-router-dom';
import { SocketContext } from '../../context/SocketContext';
import { FiShoppingCart, FiUserPlus, FiTrash, FiMenu } from 'react-icons/fi';

const QRMenu = () => {
  const { restaurantId, tableNumber } = useParams();
  const { socket, isConnected } = useContext(SocketContext);

  const [menus, setMenus] = useState([]);
  const [extras, setExtras] = useState({});
  const [tables, setTables] = useState([]);
  const [cart, setCart] = useState({});
  const [customers, setCustomers] = useState([]);
  const [activeCustomer, setActiveCustomer] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [selectedTable, setSelectedTable] = useState('');
  const [loadingTables, setLoadingTables] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedExtras, setSelectedExtras] = useState({});
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');

  // İlk useEffect: Menüleri ve masaları çek, socket eventlerini kur
  useEffect(() => {
    if (!socket || !isConnected) return;

    socket.emit('join-restaurant', restaurantId);

    const fetchMenus = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/menu/${restaurantId}`);
        if (!res.ok) throw new Error('Menüler alınamadı');
        const data = await res.json();
        setMenus(data);
      } catch (err) {
        alert(err.message);
      }
    };

    const fetchTables = async () => {
      setLoadingTables(true);
      try {
        const res = await fetch(`http://localhost:5000/api/table/${restaurantId}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        });
        if (!res.ok) throw new Error('Masalar yüklenemedi: ' + res.status);
        const data = await res.json();
        setTables(data);
        if (tableNumber) {
          const found = data.find(t => t.table_number === parseInt(tableNumber, 10));
          if (found) setSelectedTable(found.id.toString());
          else alert('Geçersiz masa numarası!');
        }
      } catch (err) {
        alert(err.message);
      } finally {
        setLoadingTables(false);
      }
    };

    fetchMenus();
    fetchTables();

    const onMenuUpdated = () => {
      fetchMenus();
    };

    socket.on('menu-updated', onMenuUpdated);

    return () => {
      socket.off('menu-updated', onMenuUpdated);
    };
  }, [socket, isConnected, restaurantId, tableNumber]);

  // Ekstra malzemeleri çek
  useEffect(() => {
    if (!menus.length) return;

    (async () => {
      const extrasData = {};
      for (const m of menus) {
        try {
          const res = await fetch(
            `http://localhost:5000/api/menu/extras/${restaurantId}?menu_id=${m.id}`
          );
          if (!res.ok) throw new Error('Ekstra malzemeler alınamadı');
          const data = await res.json();
          extrasData[m.id] = data;
        } catch (err) {
          console.error(`Hata (menu ${m.id}): ${err.message}`);
        }
      }
      setExtras(extrasData);
    })();
  }, [menus, restaurantId]);

  // Menüden ekstra seçimi toggle
  const handleExtraToggle = (menuId, extraId) => {
    setSelectedExtras(prev => {
      const setForMenu = new Set(prev[menuId] || []);
      if (setForMenu.has(extraId)) {
        setForMenu.delete(extraId);
      } else {
        setForMenu.add(extraId);
      }
      return { ...prev, [menuId]: setForMenu };
    });
  };

  const addToCart = (menuId) => {
    if (!activeCustomer) {
      alert("Lütfen önce bir müşteri seçin!");
      return;
    }

    const extrasForMenu = selectedExtras[menuId] || new Set();
    const newItems = extrasForMenu.size
      ? Array.from(extrasForMenu).map(extraId => ({
          menu_id: menuId,
          extra_id: extraId,
          quantity: 1,
        }))
      : [{ menu_id: menuId, extra_id: null, quantity: 1 }];

    setCart(prev => ({
      ...prev,
      [activeCustomer]: [...(prev[activeCustomer] || []), ...newItems],
    }));
  };

  const updateQuantity = (customer, idx, delta) => {
    setCart(prev => ({
      ...prev,
      [customer]: prev[customer].map((it, i) =>
        i === idx ? { ...it, quantity: Math.max(1, it.quantity + delta) } : it
      ),
    }));
  };

  const removeFromCart = (customer, idx) => {
    setCart(prev => ({
      ...prev,
      [customer]: prev[customer].filter((_, i) => i !== idx),
    }));
  };

  const calculateCustomerTotal = (name) => {
    return (cart[name] || []).reduce((sum, it) => {
      const m = menus.find(mn => mn.id === it.menu_id);
      const e = it.extra_id
        ? (extras[it.menu_id] || []).find(ex => ex.id === it.extra_id)
        : { price: 0 };
      return sum + ((m?.price || 0) + (e?.price || 0)) * it.quantity;
    }, 0).toFixed(2);
  };

  const calculateTotal = () => {
    return Object.values(cart)
      .flat()
      .reduce((sum, it) => {
        const m = menus.find(mn => mn.id === it.menu_id);
        const e = it.extra_id
          ? (extras[it.menu_id] || []).find(ex => ex.id === it.extra_id)
          : { price: 0 };
        return sum + ((m?.price || 0) + (e?.price || 0)) * it.quantity;
      }, 0)
      .toFixed(2);
  };

  const handlePlaceOrder = async () => {
    if (!selectedTable) {
      alert('Lütfen bir masa seçin!');
      return;
    }
    const allItems = Object.values(cart).flat();
    if (!allItems.length) {
      alert('Sepetiniz boş!');
      return;
    }

    try {
      const res = await fetch(`http://localhost:5000/api/order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          restaurant_id: restaurantId,
          table_id: selectedTable,
          items: allItems,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Sipariş gönderilemedi');
      setCart({});
      setSelectedTable('');
      setCustomers([]);
      setActiveCustomer('');
      setIsCartOpen(false);
      alert('Siparişiniz başarıyla alındı!');
      socket.emit('order-placed', { restaurant_id: restaurantId });
    } catch (err) {
      alert('Sipariş başarısız: ' + err.message);
    }
  };

  const addCustomer = () => {
    const name = newCustomerName.trim();
    if (!name) return;
    if (customers.includes(name)) {
      alert("Bu isim zaten ekli!");
      return;
    }
    setCustomers(prev => [...prev, name]);
    setNewCustomerName('');
    setShowAddCustomer(false);
    setActiveCustomer(name);
  };

  const removeCustomer = (name) => {
    setCustomers(prev => prev.filter(c => c !== name));
    setCart(prev => {
      const updated = { ...prev };
      delete updated[name];
      return updated;
    });
    if (activeCustomer === name) setActiveCustomer('');
  };

  // Kategorileri al ve "Tümü" seçeneği ekle
  const categories = ['all', ...new Set(menus.map(m => m.category || 'Genel'))];

  // Kategoriye göre filtrelenmiş menüleri al
  const filteredMenus = selectedCategory === 'all'
    ? menus
    : menus.filter(m => (m.category || 'Genel') === selectedCategory);

  // Ürün sayısına göre grid sütun sayısını belirle (mobilde en fazla 2)
  const getGridCols = (itemCount) => {
    if (itemCount <= 2) return `grid-cols-${itemCount}`;
    return 'grid-cols-2';
  };

  // Ürün sayısına göre stil sınıflarını belirle
  const getCardStyles = (itemCount) => {
    if (itemCount === 1) {
      return {
        padding: 'p-4 sm:p-4',
        imgHeight: 'h-48 sm:h-96',
        nameSize: 'text-lg sm:text-lg',
        descSize: 'text-base sm:text-base',
        priceSize: 'text-base sm:text-base',
        extraSize: 'text-md sm:text-md',
        extraPriceSize: 'text-lg sm:text-lg',
        checkboxSize: 'w-5 sm:w-5 h-5 sm:h-5',
        buttonPadding: 'px-4 sm:px-4 py-2 sm:py-2',
        buttonTextSize: 'text-lg sm:text-lg',
        marginBottom: 'mb-2 sm:mb-2',
        extrasMargin: 'mb-4 sm:mb-4'
      };
    } else {
      return {
        padding: 'p-3 sm:p-4',
        imgHeight: 'h-36 sm:h-96',
        nameSize: 'text-base sm:text-lg',
        descSize: 'text-sm sm:text-base',
        priceSize: 'text-sm sm:text-base',
        extraSize: 'text-sm sm:text-md',
        extraPriceSize: 'text-base sm:text-lg',
        checkboxSize: 'w-4 sm:w-5 h-4 sm:h-5',
        buttonPadding: 'px-3 sm:px-4 py-1 sm:py-2',
        buttonTextSize: 'text-base sm:text-lg',
        marginBottom: 'mb-1 sm:mb-2',
        extrasMargin: 'mb-3 sm:mb-4'
      };
    }
  };

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8 bg-gray-100 relative">
      <div className="sticky top-4 left-0 right-0 z-50 flex justify-between items-center px-4 sm:px-6 md:px-8 bg-gray-100">
        <button
          className="bg-white p-2 rounded-full shadow-md hover:bg-gray-100 transition"
          onClick={() => setShowCategoryMenu(!showCategoryMenu)}
        >
          <FiMenu className="text-2xl text-blue-600" />
        </button>
        {showCategoryMenu && (
          <div className="absolute top-12 left-4 sm:left-6 md:left-8 w-48 max-w-[90vw] bg-white border rounded-md shadow-xl z-50 p-2">
            {categories.map(cat => (
              <div
                key={cat}
                className={`p-2 cursor-pointer hover:bg-gray-100 rounded-md ${selectedCategory === cat ? 'bg-blue-100 font-semibold' : ''}`}
                onClick={() => {
                  setSelectedCategory(cat);
                  setShowCategoryMenu(false);
                }}
              >
                {cat === 'all' ? 'Tümü' : cat}
              </div>
            ))}
          </div>
        )}
        <button
          className="bg-white p-2 rounded-full shadow-md hover:bg-gray-100 transition relative"
          onClick={() => setIsCartOpen(!isCartOpen)}
        >
          <FiShoppingCart className="text-2xl text-blue-600" />
          {Object.values(cart).flat().length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full">
              {Object.values(cart).flat().length}
            </span>
          )}
        </button>
      </div>

      <div className="mb-6">
        <h2 className="text-3xl font-bold text-center whitespace-nowrap">Restoran Menüsü</h2>
      </div>

      {isCartOpen && (
        <div className="fixed top-20 right-4 sm:right-6 md:right-8 w-96 max-w-[90vw] bg-white border rounded-md shadow-xl z-50 p-4 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold">Sepetiniz</h3>
            <button onClick={() => setShowAddCustomer(!showAddCustomer)}>
              <FiUserPlus className="text-xl text-green-600" />
            </button>
          </div>

          {showAddCustomer && (
            <div className="flex gap-2 mb-2">
              <input
                className="flex-1 border px-2 py-1 rounded"
                placeholder="Kullanıcı giriniz"
                value={newCustomerName}
                onChange={e => setNewCustomerName(e.target.value)}
              />
              <button
                className="bg-blue-500 text-white px-3 rounded hover:bg-blue-600"
                onClick={addCustomer}
              >
                Ekle
              </button>
            </div>
          )}

          {customers.map(name => (
            <div
              key={name}
              className={`p-2 border rounded-md mb-2 cursor-pointer ${activeCustomer === name ? 'bg-green-100 border-green-500' : 'bg-gray-50'}`}
              onClick={() => setActiveCustomer(name)}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="font-semibold">{name}</span>
                <button onClick={e => { e.stopPropagation(); removeCustomer(name); }}>
                  <FiTrash className="text-red-500 hover:text-red-700" />
                </button>
              </div>

              {(cart[name] || []).map((it, idx) => {
                const m = menus.find(mn => mn.id === it.menu_id);
                const e = it.extra_id ? (extras[it.menu_id] || []).find(ex => ex.id === it.extra_id) : null;
                const itemTotal = ((m?.price || 0) + (e?.price || 0)) * it.quantity;
                return (
                  <div key={idx} className="text-sm flex justify-between items-start bg-white p-2 mb-1 rounded border">
                    <div>
                      {m?.image_url && (
                        <img
                          src={`http://localhost:5000${m.image_url}`}
                          alt={m.name}
                          className="w-full h-40 object-cover mb-2 rounded-md"
                        />
                      )}
                      <p className="font-semibold">{m?.name} {e && `+ ${e.name}`}</p>
                      <p>Birim: {(m?.price || 0) + (e?.price || 0)} TL</p>
                      <p>Toplam: {itemTotal.toFixed(2)} TL</p>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <button onClick={() => updateQuantity(name, idx, 1)} className="px-2 bg-gray-200 rounded">+</button>
                      <button onClick={() => updateQuantity(name, idx, -1)} className="px-2 bg-gray-200 rounded">-</button>
                      <button onClick={() => removeFromCart(name, idx)} className="text-red-500 text-xs">Kaldır</button>
                    </div>
                  </div>
                );
              })}

              <div className="text-sm font-semibold text-right pr-2">
                Kullanıcı Toplamı: {calculateCustomerTotal(name)} TL
              </div>
            </div>
          ))}

          <div className="flex justify-between items-center mt-2">
            <p className="text-md font-bold">Toplam: {calculateTotal()} TL</p>
            <button
              onClick={handlePlaceOrder}
              className="bg-green-500 text-white text-sm px-4 py-2 rounded hover:bg-green-600"
            >
              Siparişi Onayla
            </button>
          </div>
        </div>
      )}

      <div className="mt-16 mb-6">
        <label className="block text-sm font-medium mb-2">Seçili Masa</label>
        <select
          value={selectedTable}
          onChange={e => setSelectedTable(e.target.value)}
          className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Masa Seçin</option>
          {tables.map(t => (
            <option key={t.id} value={t.id}>Masa {t.table_number}</option>
          ))}
        </select>
      </div>

      <h3 className="text-xl font-semibold mb-4">Menü</h3>
      <div className="space-y-8">
        {[...new Set(filteredMenus.map(m => m.category || 'Genel'))].map(cat => (
          <div key={cat}>
            <h4 className="text-lg font-semibold mb-2">{cat}</h4>
            <div className={`grid ${getGridCols(Math.min(filteredMenus.filter(m => (m.category || 'Genel') === cat).length, 2))} sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4`}>
              {filteredMenus.filter(m => (m.category || 'Genel') === cat).map(m => {
                const styles = getCardStyles(Math.min(filteredMenus.filter(m => (m.category || 'Genel') === cat).length, 2));
                return (
                  <div key={m.id} className={`${styles.padding} bg-white shadow-md rounded-md flex flex-col justify-between`}>
                    <div>
                      {m.image_url && (
                        <img
                          src={`http://localhost:5000${m.image_url}`}
                          alt={m.name}
                          className={`w-full ${styles.imgHeight} object-cover ${styles.marginBottom} rounded-md`}
                        />
                      )}
                      <p className={`${styles.nameSize} font-semibold mb-1`}>{m.name}</p>
                      <p className={`${styles.descSize} text-gray-600 mb-1`}>{m.description}</p>
                      <p className={`${styles.priceSize} text-blue-600 font-bold ${styles.marginBottom}`}>{m.price} TL</p>
                    </div>

                    {extras[m.id]?.length > 0 && (
                      <div className={`${styles.extrasMargin} space-y-1`}>
                        {extras[m.id].map(ex => (
                          <label key={ex.id} className={`flex items-center ${styles.extraSize} font-medium`}>
                            <input
                              type="checkbox"
                              className={`mr-1 sm:mr-2 ${styles.checkboxSize}`}
                              checked={selectedExtras[m.id]?.has(ex.id) || false}
                              onChange={() => handleExtraToggle(m.id, ex.id)}
                            />
                            <span>
                              {ex.name} <span className={`${styles.extraPriceSize} text-gray-600`}>+{ex.price} TL</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    )}

                    <button
                      onClick={() => addToCart(m.id)}
                      className={`mt-auto bg-blue-500 text-white ${styles.buttonTextSize} ${styles.buttonPadding} rounded-md hover:bg-blue-600`}
                    >
                      Sepete Ekle
                    </button>
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

export default QRMenu;
