import { useEffect, useState, useContext } from 'react';
import { useParams } from 'react-router-dom';
import { AuthContext } from '../../../context/AuthContext';

const Garson = () => {
  const { restaurantId } = useParams();
  const { user } = useContext(AuthContext);
  const [orders, setOrders] = useState([]);
  const [orderDetails, setOrderDetails] = useState({});
  const [discounts, setDiscounts] = useState([]);
  const [selectedDiscounts, setSelectedDiscounts] = useState({});
  const [paymentMethods, setPaymentMethods] = useState({});
  const [mealVoucherTypes, setMealVoucherTypes] = useState({});
  const [expandedDetails, setExpandedDetails] = useState({}); // toggle için

  useEffect(() => {
    fetch(`http://localhost:5000/api/order/${restaurantId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    })
      .then((res) => res.json())
      .then((data) => setOrders(data))
      .catch((err) => alert('Siparişler alınamadı: ' + err.message));

    fetch(`http://localhost:5000/api/discount/${restaurantId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    })
      .then((res) => res.json())
      .then((data) => setDiscounts(data))
      .catch((err) => alert('İndirimler alınamadı: ' + err.message));
  }, [restaurantId]);

  const toggleDetails = async (orderId) => {
    if (!expandedDetails[orderId]) {
      await fetchOrderDetails(orderId);
    }
    setExpandedDetails((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

  const fetchOrderDetails = async (orderId) => {
    try {
      const res = await fetch(`http://localhost:5000/api/order/${orderId}/details`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await res.json();
      setOrderDetails((prev) => ({ ...prev, [orderId]: data }));
    } catch (err) {
      alert('Sipariş detayları alınamadı: ' + err.message);
    }
  };

  const calculateDiscountedTotal = (order) => {
    const discountId = selectedDiscounts[order.id];
    if (!discountId) return order.total_price;
    const discount = discounts.find((d) => d.id == discountId);
    if (!discount) return order.total_price;
    const discounted = order.total_price * (1 - discount.percentage / 100);
    return discounted.toFixed(2);
  };

  const handleCloseOrder = async (orderId) => {
    const discount_id = selectedDiscounts[orderId] || '';
    const payment_method = paymentMethods[orderId] || 'cash';
    const meal_voucher_type =
      payment_method === 'meal_voucher' ? mealVoucherTypes[orderId] || '' : '';

    const discount = discounts.find((d) => d.id == discount_id);
    const discount_name = discount ? discount.name : null;

    try {
      const res = await fetch(`http://localhost:5000/api/order/${orderId}/close`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ discount_id, payment_method, meal_voucher_type, discount_name }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Hesap kapatılamadı');

      setOrders((prevOrders) =>
        prevOrders.map((order) =>
          order.id === orderId
            ? {
                ...order,
                status: 'completed',
                total_price: data.total_price,
                payment_method,
                meal_voucher_type,
                discount_name,
              }
            : order
        )
      );

      alert('Hesap başarıyla kapatıldı!');
    } catch (err) {
      alert('Hesap kapatılamadı: ' + err.message);
    }
  };

  if (user.role !== 'waiter') return null;

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8">
      <h2 className="text-2xl font-bold mb-4">Garson Paneli</h2>
      {orders.filter((order) => order.status === 'ready').length === 0 ? (
        <p className="text-gray-500">Hazır sipariş yok.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {orders
            .filter((order) => order.status === 'ready')
            .map((order) => (
              <div key={order.id} className="p-4 bg-white shadow-md rounded-md">
                <p><strong>Masa:</strong> {order.table_id}</p>
                <p><strong>Durum:</strong> Hazır</p>
                <p><strong>Toplam:</strong> {calculateDiscountedTotal(order)} TL</p>

                <button
                  onClick={() => toggleDetails(order.id)}
                  className="text-blue-500 hover:underline mt-2"
                >
                  {expandedDetails[order.id] ? 'Detayları Gizle' : 'Detayları Göster'}
                </button>

                {expandedDetails[order.id] && orderDetails[order.id] && (
                  <div className="mt-4">
                    <h4 className="font-semibold">Sipariş Detayları</h4>
                    {orderDetails[order.id].map((detail) => (
                      <div key={detail.id} className="p-2 border-b">
                        <p>
                          {detail.menu_name} x{detail.quantity}
                          {detail.extra_name ? ` + ${detail.extra_name}` : ''}
                        </p>
                        <p>
                          Fiyat:{' '}
                          {(detail.menu_price + (detail.extra_price || 0)) * detail.quantity} TL
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-2">
                  <label className="block text-sm font-medium">İndirim</label>
                  <select
                    onChange={(e) =>
                      setSelectedDiscounts({
                        ...selectedDiscounts,
                        [order.id]: e.target.value,
                      })
                    }
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="">İndirim Seçin</option>
                    {discounts.map((discount) => (
                      <option key={discount.id} value={discount.id}>
                        {discount.name} - %{discount.percentage}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-2">
                  <label className="block text-sm font-medium">Ödeme Yöntemi</label>
                  <select
                    value={paymentMethods[order.id] || 'cash'}
                    onChange={(e) =>
                      setPaymentMethods({
                        ...paymentMethods,
                        [order.id]: e.target.value,
                      })
                    }
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="cash">Nakit</option>
                    <option value="credit_card">Kredi Kartı</option>
                    <option value="meal_voucher">Yemek Kartı</option>
                  </select>
                </div>

                {paymentMethods[order.id] === 'meal_voucher' && (
                  <div className="mt-2">
                    <label className="block text-sm font-medium">Yemek Kartı Türü</label>
                    <select
                      value={mealVoucherTypes[order.id] || ''}
                      onChange={(e) =>
                        setMealVoucherTypes({
                          ...mealVoucherTypes,
                          [order.id]: e.target.value,
                        })
                      }
                      className="w-full p-2 border rounded-md"
                    >
                      <option value="">Kart Türü Seçin</option>
                      <option value="multinet">Multinet</option>
                      <option value="ticket">Ticket</option>
                      <option value="metropol">Metropol</option>
                      <option value="sodexo">Sodexo</option>
                    </select>
                  </div>
                )}

                <button
                  onClick={() => handleCloseOrder(order.id)}
                  className="mt-4 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
                >
                  Hesabı Kapat
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};

export default Garson;
