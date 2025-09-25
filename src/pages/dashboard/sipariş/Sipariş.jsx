import { useEffect, useState, useContext, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { AuthContext } from '../../../context/AuthContext';
import { SocketContext } from '../../../context/SocketContext';

const Sipariş = () => {
  const { user, token } = useContext(AuthContext);
  const { restaurantId } = useParams();
  const { socket, isConnected } = useContext(SocketContext);

  const [orders, setOrders] = useState([]);
  const [orderDetails, setOrderDetails] = useState({});
  const [tables, setTables] = useState([]);

  useEffect(() => {
    const fetchTables = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/table/${restaurantId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Masalar alınamadı');
        const data = await res.json();
        setTables(data);
      } catch (err) {
        alert(err.message);
      }
    };

    if (restaurantId && token) fetchTables();
  }, [restaurantId, token]);

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
        alert(err.message);
      }
    };

    if (restaurantId && token) fetchOrders();
  }, [restaurantId, token]);

  const fetchOrderDetails = async (orderId) => {
    if (orderDetails[orderId]) return;

    try {
      const res = await fetch(`http://localhost:5000/api/order/${orderId}/details`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Sipariş detayları alınamadı');
      const data = await res.json();
      setOrderDetails((prev) => ({ ...prev, [orderId]: data }));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleApproveOrder = async (orderId) => {
    try {
      const res = await fetch(`http://localhost:5000/api/order/${orderId}/approve`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) throw new Error('Sipariş onaylanamadı');

      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId ? { ...order, status: 'preparing' } : order
        )
      );
    } catch (err) {
      alert(err.message);
    }
  };

  const handleNewOrder = useCallback((newOrder) => {
    if (newOrder.restaurant_id !== parseInt(restaurantId)) return;

    setOrders((prev) => {
      const exists = prev.find((o) => o.id === newOrder.id);
      if (!exists) {
        return [...prev, newOrder];
      } else if (exists.status !== newOrder.status) {
        return prev.map((o) => (o.id === newOrder.id ? { ...o, status: newOrder.status } : o));
      }
      return prev;
    });
  }, [restaurantId]);

  const handleOrderStatusUpdated = useCallback((updatedOrder) => {
    setOrders((prev) =>
      prev.map((order) =>
        order.id === updatedOrder.id ? { ...order, status: updatedOrder.status } : order
      )
    );
  }, []);

  useEffect(() => {
    if (!socket || !isConnected || !restaurantId || user?.role !== 'admin') return;

    socket.emit('join_admin', restaurantId);

    socket.off('new_order');
    socket.off('order_status_updated');

    socket.on('new_order', handleNewOrder);
    socket.on('order_status_updated', handleOrderStatusUpdated);

    socket.on('connect', () => {
      socket.emit('join_admin', restaurantId);
    });

    return () => {
      socket.off('new_order', handleNewOrder);
      socket.off('order_status_updated', handleOrderStatusUpdated);
      socket.off('connect');
    };
  }, [socket, isConnected, restaurantId, user, handleNewOrder, handleOrderStatusUpdated]);

  if (!user || user.role !== 'admin') return null;

  const groupedOrders = {
    pending: orders.filter((o) => o.status === 'pending'),
    preparing: orders.filter((o) => o.status === 'preparing'),
    ready: orders.filter((o) => o.status === 'ready'),
    completed: orders.filter((o) => o.status === 'completed'),
  };

  const renderOrderCard = (order, canApprove = false) => {
    const table = tables.find((t) => Number(t.id) === Number(order.table_id)); // DÜZELTİLDİ
    const tableNumber = table ? table.table_number : `#${order.table_id}`;

    return (
      <div key={order.id} className="p-4 bg-white shadow-md rounded-md">
        <p className="font-semibold">Masa: {tableNumber}</p>
        <p>Durum: {order.status.charAt(0).toUpperCase() + order.status.slice(1)}</p>
        <p>Toplam: {order.total_price} TL</p>
        {order.payment_method && <p>Ödeme Yöntemi: {order.payment_method}</p>}
        {order.payment_method === 'meal_voucher' && <p>Yemek Kartı: {order.meal_voucher_type}</p>}
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
                  Fiyat: {(detail.menu_price + (detail.extra_price || 0)) * detail.quantity} TL
                </p>
              </div>
            ))}
          </div>
        )}

        {canApprove && (
          <button
            onClick={() => handleApproveOrder(order.id)}
            className="mt-4 w-full bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
          >
            Onayla
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8">
      <h2 className="text-2xl font-bold mb-6">Siparişlerim</h2>

      <div className="space-y-8">
        {['pending', 'preparing', 'ready', 'completed'].map((key) => (
          <section key={key}>
            <h3 className="text-xl font-semibold mb-4">
              {key === 'pending' && 'Onay Bekleyenler'}
              {key === 'preparing' && 'Hazırlanıyor'}
              {key === 'ready' && 'Hazır'}
              {key === 'completed' && 'Hesabı Kapatılanlar'}
            </h3>
            {groupedOrders[key].length === 0 ? (
              <p className="text-gray-500">Gösterilecek sipariş yok.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupedOrders[key].map((order) => renderOrderCard(order, key === 'pending'))}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
};

export default Sipariş;
