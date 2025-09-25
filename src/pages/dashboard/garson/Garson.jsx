import React, { useState, useEffect, useContext } from 'react';
import { useParams } from 'react-router-dom';
import OrderModals from './OrderModals';
import { SocketContext } from '../../../context/SocketContext';
import { AuthContext } from '../../../context/AuthContext';

const Garson = () => {
  const { restaurantId } = useParams();
  const { socket, isConnected } = useContext(SocketContext);
  const { token, user } = useContext(AuthContext);

  const waiterEmail = user?.email ?? null;

  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState({});
  const [selectedTable, setSelectedTable] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

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
  }, [restaurantId, token, waiterEmail]);

  // Siparişleri çek
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await fetch(`http://localhost:5000/api/order/${restaurantId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error(`Siparişler çekilemedi: ${response.statusText}`);
        const data = await response.json();

        const ordersByTable = {};
        data
          .filter((order) => order.servedBy === null)
          .forEach((order) => {
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

  // 🔌 Socket bağlantısı ve sipariş güncellemesi
  useEffect(() => {
    if (!socket || !isConnected || !restaurantId) return;

    socket.emit('join_waiter', restaurantId);

    const handleOrderUpdate = (updatedOrder) => {
      setOrders((prevOrders) => {
        const updated = { ...prevOrders };
        const tableId = updatedOrder.table_id;

        // Sipariş garsona servis edildiyse listeden çıkar
        if (updatedOrder.servedBy !== null) {
          updated[tableId] = updated[tableId]?.filter((o) => o.id !== updatedOrder.id);
          if (updated[tableId]?.length === 0) {
            delete updated[tableId];
          }
        } else {
          if (!updated[tableId]) updated[tableId] = [];
          const idx = updated[tableId].findIndex((o) => o.id === updatedOrder.id);
          if (idx !== -1) {
            updated[tableId][idx] = updatedOrder;
          } else {
            updated[tableId].push(updatedOrder);
          }
        }

        return updated;
      });
    };

    socket.on('order_update', handleOrderUpdate);

    return () => {
      socket.off('order_update', handleOrderUpdate);
    };
  }, [socket, isConnected, restaurantId]);

  // Modal aç/kapat işlemleri
  const openOrderModal = (table) => {
    setSelectedTable(table);
    setModalOpen(true);
  };

  const closeOrderModal = () => {
    setModalOpen(false);
    setSelectedTable(null);
  };

  const handleOrdersCleared = (tableId) => {
    setOrders((prevOrders) => {
      const updated = { ...prevOrders };
      updated[tableId] = [];
      return updated;
    });
  };

  // Gerekli kontroller
  if (isLoading) return <div className="p-4 text-center">Yükleniyor...</div>;
  if (error) return <div className="p-4 text-center text-red-500">Hata: {error}</div>;
  if (!tables.length) return <div className="p-4 text-center">Bu restoranda masa bulunamadı.</div>;
  if (!waiterEmail)
    return <div className="p-4 text-center text-red-500">Garson email bulunamadı, lütfen giriş yapın.</div>;

  // Arayüz
  return (
    <div className="grid grid-cols-3 gap-4 p-4">
      {tables.map((table) => {
        const tableOrders = orders[table.id] || [];
        const totalPrice = tableOrders.reduce((sum, order) => sum + order.total_price, 0);

        return (
          <div key={table.id} className="bg-white p-4 rounded-lg shadow-md text-center">
            <h3 className="text-lg font-bold">Masa {table.table_number}</h3>
            {totalPrice > 0 ? (
              <>
                <p className="text-red-500 font-semibold">{totalPrice.toFixed(2)} TL</p>
                <button className="text-blue-500 underline" onClick={() => openOrderModal(table)}>
                  Detaylar
                </button>
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
          restaurantId={restaurantId}
          onClose={closeOrderModal}
          onOrdersCleared={handleOrdersCleared}
        />
      )}
    </div>
  );
};

export default Garson;
