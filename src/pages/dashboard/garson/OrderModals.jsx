import React, { useState, useEffect } from 'react';

const OrderModals = ({ table, orders, waiterEmail, onClose }) => {
  const [orderDetails, setOrderDetails] = useState([]);
  const [servedItems, setServedItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        setIsLoading(true);
        const details = [];

        for (const order of orders) {
          const response = await fetch(`/api/orders/${order.id}/details`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          });

          if (!response.ok) {
            throw new Error(`Sipariş detayları çekilemedi: ${response.statusText}`);
          }

          const data = await response.json();
          details.push(
            ...data.map((item) => ({
              order_id: order.id,
              menu_id: item.menu_id,
              menu_name: item.menu_name,
              category: item.category,
              price: (item.menu_price + (item.extra_price || 0)) * item.quantity,
              quantity: item.quantity,
              extra_name: item.extra_name,
              is_prepared: item.is_prepared,
            }))
          );
        }

        setOrderDetails(details);
        setError(null);
      } catch (error) {
        console.error('Sipariş detayları çekilirken hata:', error);
        setError(error.message);
      } finally {
        setIsLoading(false);
      }
    };

    if (orders.length > 0) {
      fetchOrderDetails();
    } else {
      setIsLoading(false);
      setOrderDetails([]);
    }
  }, [orders]);

  const handleServeItem = async (detail) => {
    if (!detail.is_prepared) {
      alert('Bu ürün henüz hazırlanmadı!');
      return;
    }

    try {
      const response = await fetch('/api/orders/served', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          order_id: detail.order_id,
          menu_id: detail.menu_id,
          category: detail.category,
          price: detail.price,
          waiter_email: waiterEmail,
        }),
      });

      if (response.ok) {
        setServedItems([...servedItems, detail.menu_id]);
      } else {
        const errorData = await response.json();
        console.error('Servis kaydedilemedi:', errorData.message);
        alert(errorData.message);
      }
    } catch (error) {
      console.error('Ürün servis edilirken hata:', error);
      alert('Ürün servis edilirken hata oluştu');
    }
  };

  const handleServeAll = async () => {
    if (orderDetails.some((detail) => !detail.is_prepared)) {
      alert('Bazı ürünler henüz hazırlanmadı!');
      return;
    }

    try {
      const responses = await Promise.all(
        orderDetails.map((detail) =>
          fetch('/api/orders/served', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
              order_id: detail.order_id,
              menu_id: detail.menu_id,
              category: detail.category,
              price: detail.price,
              waiter_email: waiterEmail,
            }),
          })
        )
      );

      if (responses.every((res) => res.ok)) {
        setServedItems(orderDetails.map((detail) => detail.menu_id));
        onClose();
      } else {
        console.error('Tüm ürünler servis edilemedi');
        alert('Tüm ürünler servis edilemedi');
      }
    } catch (error) {
      console.error('Tüm ürünler servis edilirken hata:', error);
      alert('Tüm ürünler servis edilirken hata oluştu');
    }
  };

  const handleTakeService = async () => {
    if (orderDetails.some((detail) => !detail.is_prepared)) {
      alert('Bazı ürünler henüz hazırlanmadı!');
      return;
    }

    try {
      const responses = await Promise.all(
        orderDetails.map((detail) =>
          fetch('/api/orders/served', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
              order_id: detail.order_id,
              menu_id: detail.menu_id,
              category: detail.category,
              price: detail.price,
              waiter_email: waiterEmail,
            }),
          })
        )
      );

      if (responses.every((res) => res.ok)) {
        setServedItems(orderDetails.map((detail) => detail.menu_id));
        onClose();
      } else {
        console.error('Servis alınamadı');
        alert('Servis alınamadı');
      }
    } catch (error) {
      console.error('Servis alınırken hata:', error);
      alert('Servis alınırken hata oluştu');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">Masa {table.table_number} Sipariş Detayları</h2>

        {isLoading && <p className="text-center">Detaylar yükleniyor...</p>}
        {error && <p className="text-center text-red-500">Hata: {error}</p>}

        {!isLoading && !error && orderDetails.length === 0 ? (
          <p>Bu masada sipariş yok.</p>
        ) : (
          <ul className="space-y-2">
            {orderDetails.map((detail) => (
              <li key={`${detail.order_id}-${detail.menu_id}`} className="flex justify-between items-center">
                <span>
                  {detail.menu_name} {detail.extra_name ? `+ ${detail.extra_name}` : ''} 
                  ({detail.category}) - {detail.price.toFixed(2)} TL (x{detail.quantity})
                  {!detail.is_prepared && <span className="text-red-500"> (Hazırlanmadı)</span>}
                </span>
                {!servedItems.includes(detail.menu_id) && (
                  <button
                    className="bg-green-500 text-white px-2 py-1 rounded"
                    onClick={() => handleServeItem(detail)}
                    disabled={!detail.is_prepared}
                  >
                    Servis Et
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-between mt-4">
          <button
            className="bg-blue-500 text-white px-4 py-2 rounded"
            onClick={handleServeAll}
            disabled={orderDetails.length === 0 || servedItems.length === orderDetails.length}
          >
            Tümünü Servis Et
          </button>
          <button
            className="bg-yellow-500 text-white px-4 py-2 rounded"
            onClick={handleTakeService}
            disabled={orderDetails.length === 0 || servedItems.length === orderDetails.length}
          >
            Servisi Al
          </button>
          <button
            className="bg-gray-500 text-white px-4 py-2 rounded"
            onClick={onClose}
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderModals;
