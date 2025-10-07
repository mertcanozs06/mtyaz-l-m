import React, { useState, useEffect, useContext } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import OrderModals from './OrderModals';
import { SocketContext } from '../../../context/SocketContext';
import { AuthContext } from '../../../context/AuthContext';

const Garson = () => {
  const { restaurantId, branchId } = useParams();
  const { socket, isConnected } = useContext(SocketContext);
  const { user, token, selectedBranch, package_type, logout } = useContext(AuthContext);

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
      if (!restaurantId || !branchId || !token || !waiterEmail) {
        setError('Restoran, şube, token veya garson email bilgisi eksik.');
        setIsLoading(false);
        return;
      }

      if (user?.restaurant_id !== parseInt(restaurantId)) {
        setError('Bu restorana erişim yetkiniz yok.');
        setIsLoading(false);
        return;
      }

      if (branchId !== selectedBranch) {
        setError('Seçilen şube geçersiz.');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const response = await fetch(`http://localhost:5000/api/${restaurantId}/${branchId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          const errorData = await response.json();
          if (response.status === 401) throw new Error('Oturumunuz sona erdi. Lütfen tekrar giriş yapın.');
          if (response.status === 403) throw new Error('Bu şubeye erişim yetkiniz yok.');
          if (response.status === 404) throw new Error(errorData.message || 'Bu şubede masa bulunamadı.');
          throw new Error(errorData.message || 'Masalar alınamadı.');
        }
        const data = await response.json();
        setTables(data);
        setError(null);
      } catch (error) {
        setError(error.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTables();
  }, [restaurantId, branchId, token, waiterEmail, user, selectedBranch]);

  // Siparişleri çek
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await fetch(`http://localhost:5000/api/${restaurantId}/${branchId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          const errorData = await response.json();
          if (response.status === 401) throw new Error('Oturumunuz sona erdi. Lütfen tekrar giriş yapın.');
          if (response.status === 403) throw new Error('Bu şubeye erişim yetkiniz yok.');
          if (response.status === 404) throw new Error(errorData.message || 'Bu şubede sipariş bulunamadı.');
          throw new Error(errorData.message || 'Siparişler alınamadı.');
        }
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
        setError(error.message);
      }
    };

    fetchOrders();
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, [restaurantId, branchId, token]);

  // Socket bağlantısı ve sipariş güncellemesi
  useEffect(() => {
    if (!socket || !isConnected || !restaurantId || !branchId) return;

    const room = `${restaurantId}_${branchId}`;
    socket.emit('join_waiter', room);

    const handleOrderUpdate = (updatedOrder) => {
      if (updatedOrder.branch_id !== parseInt(branchId)) return; // Şube kontrolü
      setOrders((prevOrders) => {
        const updated = { ...prevOrders };
        const tableId = updatedOrder.table_id;

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
      socket.emit('leave_waiter', room);
    };
  }, [socket, isConnected, restaurantId, branchId]);

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

  // Paket kontrolü
  if (!['base', 'package2', 'premium'].includes(package_type)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-red-100 text-red-600 p-4 rounded-md shadow-md max-w-md text-center">
          Garson özelliği yalnızca base, package2 ve premium paketlerde kullanılabilir.
        </div>
      </div>
    );
  }

  // Yetkisiz erişim
  if (!user || user.role !== 'waiter' || user.restaurant_id !== parseInt(restaurantId) || branchId !== selectedBranch) {
    return <Navigate to="/login" replace />;
  }

  // Gerekli kontroller
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-gray-600">Yükleniyor...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-red-100 text-red-600 p-4 rounded-md shadow-md max-w-md text-center">
          {error}
          <button
            className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            onClick={() => setError(null)}
          >
            Kapat
          </button>
        </div>
      </div>
    );
  }

  if (!tables.length) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-gray-600">Bu şubede masa bulunamadı.</div>
      </div>
    );
  }

  if (!waiterEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-red-100 text-red-600 p-4 rounded-md shadow-md max-w-md text-center">
          Garson email bulunamadı, lütfen giriş yapın.
        </div>
      </div>
    );
  }

  // Arayüz
  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8 bg-gray-100">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">
          Garson Paneli – Restoran {restaurantId}, Şube {branchId}
        </h2>
        <button
          onClick={() => logout()}
          className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600"
        >
          Çıkış Yap
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {tables.map((table) => {
          const tableOrders = orders[table.id] || [];
          const totalPrice = tableOrders.reduce((sum, order) => sum + order.total_price, 0);

          return (
            <div key={table.id} className="bg-white p-4 rounded-lg shadow-md text-center">
              <h3 className="text-lg font-bold">
                Masa {table.table_number} ({table.region})
              </h3>
              {totalPrice > 0 ? (
                <>
                  <p className="text-red-500 font-semibold">{totalPrice.toFixed(2)} TL</p>
                  <button
                    className="text-blue-500 underline hover:text-blue-600"
                    onClick={() => openOrderModal(table)}
                  >
                    Detaylar
                  </button>
                </>
              ) : (
                <p className="text-gray-500">Sipariş yok</p>
              )}
            </div>
          );
        })}
      </div>

      {modalOpen && selectedTable && (
        <OrderModals
          table={selectedTable}
          orders={orders[selectedTable.id] || []}
          restaurantId={restaurantId}
          branchId={branchId}
          onClose={closeOrderModal}
          onOrdersCleared={handleOrdersCleared}
        />
      )}
    </div>
  );
};

export default Garson;
