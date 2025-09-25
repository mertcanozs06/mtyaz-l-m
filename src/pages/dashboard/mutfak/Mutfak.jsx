import { useEffect, useState, useContext, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { AuthContext } from '../../../context/AuthContext';
import { SocketContext } from '../../../context/SocketContext';

const Mutfak = () => {
  const { restaurantId } = useParams();
  const { user, token } = useContext(AuthContext);
  const { socket, isConnected } = useContext(SocketContext);

  const [orders, setOrders] = useState([]);
  const [orderDetails, setOrderDetails] = useState({});
  const [tables, setTables] = useState({});

  // Masaları getir
  useEffect(() => {
    const fetchTables = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/table/${restaurantId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Masalar alınamadı');
        const data = await res.json();
        const tableMap = data.reduce((map, t) => ({ ...map, [t.id]: t.table_number }), {});
        setTables(tableMap);
      } catch (err) {
        console.error('Masalar alınamadı:', err.message);
      }
    };

    if (restaurantId && token) fetchTables();
  }, [restaurantId, token]);

  // Siparişleri getir
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/order/${restaurantId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Siparişler alınamadı');
        const data = await res.json();
        setOrders(data);
      } catch (err) {
        console.error('Siparişler alınamadı:', err.message);
      }
    };

    if (restaurantId && token) fetchOrders();
  }, [restaurantId, token]);

  // Sipariş detaylarını getir
  const fetchOrderDetails = async (orderId) => {
    try {
      const res = await fetch(`http://localhost:5000/api/order/${orderId}/details`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Detaylar alınamadı');
      const data = await res.json();
      setOrderDetails((prev) => ({ ...prev, [orderId]: data }));
      console.log(`Sipariş detayları getirildi: orderId=${orderId}`, data);
    } catch (err) {
      console.error('Sipariş detayları alınamadı:', err.message);
    }
  };

  // Ürünü hazırla
  const handlePrepareItem = async (detailId) => {
    try {
      const res = await fetch(`http://localhost:5000/api/order/details/${detailId}/prepare`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Hazırlama başarısız');

      const orderId = Object.keys(orderDetails).find((key) =>
        orderDetails[key].some((detail) => detail.id === detailId)
      );

      setOrderDetails((prevDetails) => {
        if (!prevDetails[orderId]) return prevDetails;
        const updatedDetails = prevDetails[orderId].map((detail) =>
          detail.id === detailId ? { ...detail, is_prepared: 1 } : detail
        );
        return { ...prevDetails, [orderId]: updatedDetails };
      });

      if (socket && isConnected) {
        socket.emit('order_detail_prepared', { restaurant_id: restaurantId, orderId, detailId });
        console.log('order_detail_prepared gönderildi:', { restaurant_id: restaurantId, orderId, detailId });
      }

      console.log('Ürün hazırlandı:', { orderId, detailId });
    } catch (err) {
      console.error('Ürün hazırlanamadı:', err.message);
    }
  };

  // Tüm siparişi hazırla
  const handlePrepareOrder = async (orderId) => {
    try {
      const res = await fetch(`http://localhost:5000/api/order/${orderId}/prepare`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Sipariş hazırlanamadı');

      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: 'ready' } : o))
      );
      setOrderDetails((prevDetails) => {
        if (!prevDetails[orderId]) return prevDetails;
        const updatedDetails = prevDetails[orderId].map((detail) => ({
          ...detail,
          is_prepared: 1,
        }));
        return { ...prevDetails, [orderId]: updatedDetails };
      });

      if (socket && isConnected) {
        socket.emit('order_prepared', { restaurant_id: restaurantId, orderId });
        console.log('order_prepared gönderildi:', { restaurant_id: restaurantId, orderId });
      }

      console.log('Tüm sipariş hazırlandı:', orderId);
    } catch (err) {
      console.error('Sipariş hazırlanamadı:', err.message);
    }
  };

  // Yeni sipariş
  const handleNewOrder = useCallback((order) => {
    if (!order || typeof order.restaurant_id === 'undefined') {
      console.error('Hatalı sipariş verisi:', order);
      return;
    }

    if (order.restaurant_id === parseInt(restaurantId) && order.status === 'preparing') {
      setOrders((prevOrders) => {
        const existing = prevOrders.find((o) => o.id === order.id);
        if (!existing) {
          return [...prevOrders, order];
        } else if (existing.status !== order.status) {
          return prevOrders.map((o) => (o.id === order.id ? { ...o, status: order.status } : o));
        }
        return prevOrders;
      });

      fetchOrderDetails(order.id);
    }
  }, [restaurantId]);

  const handleOrderDetailPrepared = useCallback(({ orderId, detailId }) => {
    console.log('Sipariş detayı hazırlandı:', { orderId, detailId });
    setOrderDetails((prevDetails) => {
      if (!prevDetails[orderId]) {
        fetchOrderDetails(orderId);
        return prevDetails;
      }
      const updatedDetails = prevDetails[orderId].map((detail) =>
        detail.id === detailId ? { ...detail, is_prepared: 1 } : detail
      );
      return { ...prevDetails, [orderId]: updatedDetails };
    });
  }, []);

  const handleOrderPrepared = useCallback((orderId) => {
    console.log('Tüm sipariş hazırlandı:', orderId);
    setOrders((prevOrders) =>
      prevOrders.map((order) =>
        order.id === orderId ? { ...order, status: 'ready' } : order
      )
    );
    setOrderDetails((prevDetails) => {
      if (!prevDetails[orderId]) return prevDetails;
      const updatedDetails = prevDetails[orderId].map((detail) => ({
        ...detail,
        is_prepared: 1,
      }));
      return { ...prevDetails, [orderId]: updatedDetails };
    });
  }, []);

  // Socket bağlan
  useEffect(() => {
    if (!socket || !isConnected || !restaurantId || user?.role !== 'kitchen') return;

    socket.emit('join_kitchen', restaurantId);
    console.log(`Mutfak odasına katıldı: ${restaurantId}`);

    socket.off('new_order');
    socket.off('order_detail_prepared');
    socket.off('order_prepared');

    socket.on('new_order', handleNewOrder);
    socket.on('order_detail_prepared', handleOrderDetailPrepared);
    socket.on('order_prepared', handleOrderPrepared);

    socket.on('connect', () => {
      console.log('Socket yeniden bağlandı, mutfak odasına tekrar katılıyor:', restaurantId);
      socket.emit('join_kitchen', restaurantId);
    });

    socket.on('disconnect', () => {
      console.log('Socket bağlantısı koptu');
    });

    return () => {
      socket.off('new_order', handleNewOrder);
      socket.off('order_detail_prepared', handleOrderDetailPrepared);
      socket.off('order_prepared', handleOrderPrepared);
      socket.off('connect');
      socket.off('disconnect');
      console.log('Socket olayları temizlendi');
    };
  }, [socket, isConnected, restaurantId, user, handleNewOrder, handleOrderDetailPrepared, handleOrderPrepared]);

  if (!user || user.role !== 'kitchen') {
    console.log('Erişim engellendi, kullanıcı rolü:', user?.role);
    return null;
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Mutfak Paneli</h2>
        <span className={`text-sm ${isConnected ? 'text-green-500' : 'text-red-500'}`}>
          {isConnected ? 'Bağlı' : 'Bağlantı Yok'}
        </span>
      </div>

      <div className="space-y-8">
        <h3 className="text-xl font-semibold mb-4">Hazırlanacak Siparişler</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {orders
            .filter((order) => order.status === 'preparing')
            .map((order) => (
              <div key={order.id} className="p-4 bg-white shadow-md rounded-md">
                <p>
                  <strong>Masa:</strong> Masa {tables[order.table_id] || order.table_id}
                </p>
                <p>
                  <strong>Durum:</strong> Hazırlanıyor
                </p>
                <button
                  onClick={() => fetchOrderDetails(order.id)}
                  className="text-blue-500 hover:underline mt-2"
                >
                  Detayları Göster
                </button>

                {orderDetails[order.id] && (
                  <div className="mt-4">
                    <h4 className="font-semibold">Sipariş Detayları</h4>
                    {orderDetails[order.id].map((detail) => (
                      <div key={detail.id} className="p-2 border-b">
                        <p>
                          {detail.menu_name} x{detail.quantity}
                          {detail.extra_name ? ` + ${detail.extra_name}` : ''}
                        </p>
                        <p>
                          <strong>Durum:</strong>{' '}
                          {detail.is_prepared ? 'Hazır' : 'Hazırlanacak'}
                        </p>
                        {!detail.is_prepared && (
                          <button
                            onClick={() => handlePrepareItem(detail.id)}
                            className="mt-2 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
                          >
                            Ürünü Hazırla
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={() => handlePrepareOrder(order.id)}
                      className="mt-4 w-full bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600"
                    >
                      Tüm Siparişi Hazırla
                    </button>
                  </div>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default Mutfak;
