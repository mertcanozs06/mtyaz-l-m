import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import OrderModals from './OrderModals';

const Garson = () => {
  const { restaurantId } = useParams();
  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState({});
  const [selectedTable, setSelectedTable] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const ws = useRef(null); // WebSocket referansı

  const token = localStorage.getItem('token');
  let waiterEmail = null;
  try {
    waiterEmail = token ? jwtDecode(token).email : null;
  } catch (err) {
    console.error('Token çözümleme hatası:', err);
  }

  // Masaları çek
  useEffect(() => {
    const fetchTables = async () => {
      try {
        setIsLoading(true);
        if (!token) throw new Error('Token bulunamadı, lütfen giriş yapın');
        if (!waiterEmail) throw new Error('Garson email bulunamadı, token geçersiz');

        const response = await fetch(`http://localhost:5000/api/table/${restaurantId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error(`Masalar çekilemedi: ${response.statusText}`);
        const data = await response.json();
        setTables(data);
        setError(null);
      } catch (error) {
        console.error('Masalar çekilirken hata:', error);
        setError(error.message);
      } finally {
        setIsLoading(false);
      }
    };

    if (restaurantId) {
      fetchTables();
    } else {
      setError('Restaurant ID bulunamadı');
      setIsLoading(false);
    }
  }, [restaurantId, token]);

  // Siparişleri çek (başlangıçta ve 30 sn'de bir)
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await fetch(`http://localhost:5000/api/order/${restaurantId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error(`Siparişler çekilemedi: ${response.statusText}`);
        const data = await response.json();

        const ordersByTable = {};
        data.forEach((order) => {
          if (!ordersByTable[order.table_id]) ordersByTable[order.table_id] = [];
          ordersByTable[order.table_id].push(order);
        });
        setOrders(ordersByTable);
      } catch (error) {
        console.error('Siparişler çekilirken hata:', error);
        setError(error.message);
      }
    };

    fetchOrders();
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, [restaurantId, token]);

  // 🔌 WebSocket bağlantısı
  useEffect(() => {
    if (!restaurantId || !token) return;

    const wsUrl = `ws://localhost:5000/ws/order/${restaurantId}`;
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      console.log('WebSocket bağlantısı açıldı');
    };

    ws.current.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('WebSocket mesajı:', message);

        if (message.type === 'order_update') {
          const updatedOrder = message.order;
          setOrders((prevOrders) => {
            const updatedOrders = { ...prevOrders };
            const tableId = updatedOrder.table_id;
            if (!updatedOrders[tableId]) updatedOrders[tableId] = [];

            // Var olan siparişi güncelle veya yeni olarak ekle
            const index = updatedOrders[tableId].findIndex((o) => o.id === updatedOrder.id);
            if (index !== -1) {
              updatedOrders[tableId][index] = updatedOrder;
            } else {
              updatedOrders[tableId].push(updatedOrder);
            }

            return updatedOrders;
          });
        }
      } catch (err) {
        console.error('WebSocket mesajı çözümleme hatası:', err);
      }
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket hatası:', error);
    };

    ws.current.onclose = () => {
      console.log('WebSocket bağlantısı kapatıldı');
    };

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [restaurantId, token]);

  const openOrderModal = (table) => {
    setSelectedTable(table);
    setModalOpen(true);
  };

  const closeOrderModal = () => {
    setModalOpen(false);
    setSelectedTable(null);
  };

  if (isLoading) return <div className="p-4 text-center">Yükleniyor...</div>;
  if (error) return <div className="p-4 text-center text-red-500">Hata: {error}</div>;
  if (!tables.length) return <div className="p-4 text-center">Bu restoranda masa bulunamadı.</div>;
  if (!waiterEmail)
    return <div className="p-4 text-center text-red-500">Garson email bulunamadı, lütfen giriş yapın.</div>;

  return (
    <div className="grid grid-cols-3 gap-4 p-4">
      {tables.map((table) => {
        const tableOrders = orders[table.id] || [];
        const totalPrice = tableOrders.reduce((sum, order) => sum + order.total_price, 0);
        const isTaken = tableOrders.some(
          (order) => order.servedBy && order.servedBy !== waiterEmail
        );

        return (
          <div key={table.id} className="bg-white p-4 rounded-lg shadow-md text-center">
            <h3 className="text-lg font-bold">Masa {table.table_number}</h3>
            {totalPrice > 0 ? (
              <>
                <p className="text-red-500 font-semibold">{totalPrice.toFixed(2)} TL</p>
                {!isTaken && (
                  <button
                    className="text-blue-500 underline"
                    onClick={() => openOrderModal(table)}
                  >
                    Detaylar
                  </button>
                )}
              </>
            ) : (
              <p>Sipariş yok</p>
            )}
          </div>
        );
      })}
      {modalOpen && selectedTable && (
        <OrderModals
          table={selectedTable}
          orders={orders[selectedTable.id] || []}
          waiterEmail={waiterEmail}
          restaurantId={restaurantId}
          token={token}
          onClose={closeOrderModal}
        />
      )}
    </div>
  );
};

export default Garson;
