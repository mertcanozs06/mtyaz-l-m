import { useEffect, useState, useContext } from 'react';
import { useParams } from 'react-router-dom';
import { SocketContext } from '../../context/SocketContext';

const QRMenu = () => {
  const { restaurantId, tableNumber } = useParams();
  const socket = useContext(SocketContext);

  const [menus, setMenus] = useState([]);
  const [extras, setExtras] = useState({});
  const [tables, setTables] = useState([]);
  const [cart, setCart] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [loadingTables, setLoadingTables] = useState(false);

  useEffect(() => {
    if (!socket) return;

    socket.emit('join-restaurant', restaurantId);

    const fetchMenus = () => {
      fetch(`http://localhost:5000/api/menu/${restaurantId}`)
        .then(res => {
          if (!res.ok) throw new Error('Menüler alınamadı');
          return res.json();
        })
        .then(data => setMenus(data))
        .catch(err => alert(err.message));
    };

    const fetchTables = async () => {
      setLoadingTables(true);
      try {
        const res = await fetch(`http://localhost:5000/api/table/${restaurantId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        });

        if (!res.ok) throw new Error('Masalar yüklenemedi: ' + res.status);
        const data = await res.json();
        setTables(data);

        if (tableNumber) {
          const found = data.find(t => t.table_number === parseInt(tableNumber));
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
  }, [socket, restaurantId, tableNumber]);

  useEffect(() => {
    if (menus.length === 0) return;

    const fetchExtras = async () => {
      const extrasData = {};
      for (const menu of menus) {
        try {
          const res = await fetch(
            `http://localhost:5000/api/menu/extras/${restaurantId}?menu_id=${menu.id}`
          );
          if (!res.ok) throw new Error('Ekstra malzemeler alınamadı');
          extrasData[menu.id] = await res.json();
        } catch (err) {
          console.error(`Ekstra malzemeler hata (menu ${menu.id}): ${err.message}`);
        }
      }
      setExtras(extrasData);
    };

    fetchExtras();
  }, [menus, restaurantId]);

  const addToCart = (menuId, extraId = null) => {
    const existingItemIndex = cart.findIndex(
      (item) => item.menu_id === menuId && item.extra_id === extraId
    );
    if (existingItemIndex !== -1) {
      const newCart = [...cart];
      newCart[existingItemIndex].quantity += 1;
      setCart(newCart);
    } else {
      setCart([...cart, { menu_id: menuId, extra_id: extraId, quantity: 1 }]);
    }
  };

  const updateQuantity = (index, delta) => {
    const newCart = [...cart];
    newCart[index].quantity = Math.max(1, newCart[index].quantity + delta);
    setCart(newCart);
  };

  const removeFromCart = (index) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return cart
      .reduce((total, item) => {
        const menu = menus.find((m) => m.id === item.menu_id);
        const extra = item.extra_id
          ? (extras[item.menu_id] || []).find((e) => e.id === item.extra_id)
          : { price: 0 };
        return total + ((menu?.price || 0) + (extra?.price || 0)) * item.quantity;
      }, 0)
      .toFixed(2);
  };

  const handlePlaceOrder = async () => {
    if (!selectedTable) {
      alert('Lütfen bir masa seçin!');
      return;
    }
    if (cart.length === 0) {
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
          items: cart,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setCart([]);
      setSelectedTable('');
      alert('Siparişiniz başarıyla alındı!');
      socket.emit('order-placed', { restaurant_id: restaurantId });
    } catch (err) {
      alert('Sipariş oluşturulamadı: ' + err.message);
    }
  };

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8 bg-gray-100">
      <h2 className="text-3xl font-bold mb-6 text-center">Restoran Menüsü</h2>
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Seçili Masa</label>
        <select
          value={selectedTable}
          onChange={(e) => setSelectedTable(e.target.value)}
          className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Masa Seçin</option>
          {tables.map((table) => (
            <option key={table.id} value={table.id}>
              Masa {table.table_number}
            </option>
          ))}
        </select>
      </div>

      <h3 className="text-xl font-semibold mb-4">Menü</h3>
      <div className="space-y-8">
        {[...new Set(menus.map((m) => m.category || 'Genel'))].map((category) => (
          <div key={category}>
            <h4 className="text-lg font-semibold mb-2">{category}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {menus
                .filter((m) => (m.category || 'Genel') === category)
                .map((menu) => (
                  <div key={menu.id} className="p-4 bg-white shadow-md rounded-md">
                    <p className="text-lg font-semibold">{menu.name}</p>
                    <p className="text-gray-600">{menu.description}</p>
                    <p className="text-blue-600 font-bold">{menu.price} TL</p>
                    <button
                      onClick={() => addToCart(menu.id)}
                      className="mt-2 w-full bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
                    >
                      Sepete Ekle
                    </button>
                    <select
                      onChange={(e) => {
                        if (e.target.value) addToCart(menu.id, e.target.value);
                        e.target.value = '';
                      }}
                      className="mt-2 w-full p-2 border rounded-md"
                    >
                      <option value="">Ekstra Malzeme Seçin</option>
                      {(extras[menu.id] || []).map((extra) => (
                        <option key={extra.id} value={extra.id}>
                          {extra.name} (+{extra.price} TL)
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>

      <h3 className="text-xl font-semibold mb-4">Sepetiniz</h3>
      {cart.length === 0 ? (
        <p className="text-gray-500">Sepetiniz boş.</p>
      ) : (
        <div className="space-y-4">
          {cart.map((item, index) => {
            const menu = menus.find((m) => m.id === item.menu_id);
            const extra = item.extra_id
              ? (extras[item.menu_id] || []).find((e) => e.id === item.extra_id)
              : null;
            const itemPrice = ((menu?.price || 0) + (extra?.price || 0)) * item.quantity;
            return (
              <div
                key={index}
                className="p-4 bg-white shadow-md rounded-md flex justify-between items-center"
              >
                <div>
                  <p className="font-semibold">
                    {menu?.name} x{item.quantity}
                    {extra ? ` + ${extra.name}` : ''}
                  </p>
                  <p className="text-gray-600">
                    Birim Fiyat: {(menu?.price || 0) + (extra?.price || 0)} TL
                  </p>
                  <p className="text-blue-600 font-bold">Toplam: {itemPrice.toFixed(2)} TL</p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => updateQuantity(index, -1)}
                    className="bg-gray-300 text-black px-2 py-1 rounded-md hover:bg-gray-400"
                  >
                    -
                  </button>
                  <button
                    onClick={() => updateQuantity(index, 1)}
                    className="bg-gray-300 text-black px-2 py-1 rounded-md hover:bg-gray-400"
                  >
                    +
                  </button>
                  <button
                    onClick={() => removeFromCart(index)}
                    className="bg-red-500 text-white px-2 py-1 rounded-md hover:bg-red-600"
                  >
                    Kaldır
                  </button>
                </div>
              </div>
            );
          })}
          <div className="flex justify-between items-center p-4 bg-white shadow-md rounded-md">
            <p className="text-lg font-bold">Genel Toplam: {calculateTotal()} TL</p>
            <button
              onClick={handlePlaceOrder}
              className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600"
            >
              Siparişi Onayla
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default QRMenu;
