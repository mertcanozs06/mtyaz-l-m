import { useEffect, useState, useContext } from 'react';
import { useParams } from 'react-router-dom';
import { AuthContext } from '../../../context/AuthContext';

const Mutfak = () => {
  const { restaurantId } = useParams();
  const { user, logout } = useContext(AuthContext);
  const [orders, setOrders] = useState([]);
  const [orderDetails, setOrderDetails] = useState({});

  useEffect(() => {
    fetch(`http://localhost:5000/api/order/${restaurantId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch orders');
        return res.json();
      })
      .then((data) => setOrders(data))
      .catch((err) => alert('Siparişler alınamadı: ' + err.message));
  }, [restaurantId]);

  const fetchOrderDetails = async (orderId) => {
    try {
      const res = await fetch(`http://localhost:5000/api/order/${orderId}/details`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!res.ok) throw new Error('Failed to fetch order details');
      const data = await res.json();
      setOrderDetails((prev) => ({ ...prev, [orderId]: data }));
    } catch (err) {
      alert('Sipariş detayları alınamadı: ' + err.message);
    }
  };

  const handlePrepareItem = async (detailId) => {
    try {
      const res = await fetch(`http://localhost:5000/api/order/details/${detailId}/prepare`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!res.ok) throw new Error('Failed to prepare item');
      setOrderDetails((prev) => ({
        ...prev,
        [Object.keys(prev).find((key) =>
          prev[key].some((detail) => detail.id === detailId)
        )]: prev[
          Object.keys(prev).find((key) =>
            prev[key].some((detail) => detail.id === detailId)
          )
        ].map((detail) =>
          detail.id === detailId ? { ...detail, is_prepared: 1 } : detail
        ),
      }));
      alert('Ürün hazırlandı!');
    } catch (err) {
      alert('Ürün hazırlanamadı: ' + err.message);
    }
  };

  const handlePrepareOrder = async (orderId) => {
    try {
      const res = await fetch(`http://localhost:5000/api/order/${orderId}/prepare`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!res.ok) throw new Error('Failed to prepare order');
      setOrders(orders.map((o) => (o.id === orderId ? { ...o, status: 'ready' } : o)));
      alert('Sipariş hazırlandı!');
    } catch (err) {
      alert('Sipariş hazırlanamadı: ' + err.message);
    }
  };

  if (user.role !== 'kitchen') return null;

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Mutfak Paneli</h2>
        
      </div>
      <div className="space-y-8">
        <h3 className="text-xl font-semibold mb-4">Hazırlanacak Siparişler</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {orders
            .filter((order) => order.status === 'preparing')
            .map((order) => (
              <div key={order.id} className="p-4 bg-white shadow-md rounded-md">
                <p><strong>Masa:</strong> {order.table_id}</p>
                <p><strong>Durum:</strong> Hazırlanıyor</p>
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

