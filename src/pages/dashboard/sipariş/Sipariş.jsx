import { useEffect, useState, useContext } from 'react';
import { useParams } from 'react-router-dom';
import { AuthContext } from '../../../context/AuthContext';

const Sipariş = () => {
  const { user } = useContext(AuthContext);
  const { restaurantId } = useParams();
  const [orders, setOrders] = useState([]);
  const [orderDetails, setOrderDetails] = useState({});

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/order/${restaurantId}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        if (!res.ok) throw new Error('Siparişler alınamadı');
        const data = await res.json();
        setOrders(data);
      } catch (err) {
        alert(err.message);
      }
    };

    fetchOrders();
  }, [restaurantId]);

  const fetchOrderDetails = async (orderId) => {
    if (orderDetails[orderId]) return; // Daha önce alınmışsa tekrar alma

    try {
      const res = await fetch(`http://localhost:5000/api/order/${orderId}/details`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
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
          Authorization: `Bearer ${localStorage.getItem('token')}`,
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

  if (user.role !== 'admin') return null;

  const groupedOrders = {
    pending: orders.filter((o) => o.status === 'pending'),
    preparing: orders.filter((o) => o.status === 'preparing'),
    ready: orders.filter((o) => o.status === 'ready'),
    completed: orders.filter((o) => o.status === 'completed'),
  };

  const renderOrderCard = (order, canApprove = false) => (
    <div key={order.id} className="p-4 bg-white shadow-md rounded-md">
      <p className="font-semibold">Masa: {order.table_id}</p>
      <p>Durum: {order.status.charAt(0).toUpperCase() + order.status.slice(1)}</p>
      <p>Toplam: {order.total_price} TL</p>
      {order.payment_method && (
        <p>Ödeme Yöntemi: {order.payment_method}</p>
      )}
      {order.payment_method === 'meal_voucher' && (
        <p>Yemek Kartı: {order.meal_voucher_type}</p>
      )}
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

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Siparişlerim</h2>
      </div>

      <div className="space-y-8">
        <section>
          <h3 className="text-xl font-semibold mb-4">Onay Bekleyenler</h3>
          {groupedOrders.pending.length === 0 ? (
            <p className="text-gray-500">Onay bekleyen sipariş yok.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupedOrders.pending.map((order) => renderOrderCard(order, true))}
            </div>
          )}
        </section>

        <section>
          <h3 className="text-xl font-semibold mb-4">Sipariş Hazırlanıyor</h3>
          {groupedOrders.preparing.length === 0 ? (
            <p className="text-gray-500">Hazırlanan sipariş yok.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupedOrders.preparing.map((order) => renderOrderCard(order))}
            </div>
          )}
        </section>

        <section>
          <h3 className="text-xl font-semibold mb-4">Sipariş Hazır</h3>
          {groupedOrders.ready.length === 0 ? (
            <p className="text-gray-500">Hazırlanan sipariş yok.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupedOrders.ready.map((order) => renderOrderCard(order))}
            </div>
          )}
        </section>

        <section>
          <h3 className="text-xl font-semibold mb-4">Hesabı Kapatılanlar</h3>
          {groupedOrders.completed.length === 0 ? (
            <p className="text-gray-500">Hesabı kapatılan sipariş yok</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupedOrders.completed.map((order) => renderOrderCard(order))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Sipariş;
