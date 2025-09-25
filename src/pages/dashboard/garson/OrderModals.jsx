import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../../context/AuthContext';

const OrderModals = ({ table, orders, restaurantId, onClose, onOrdersCleared }) => {
  const { token, user } = useContext(AuthContext);
  const waiterEmail = user?.email;

  const [orderDetails, setOrderDetails] = useState([]);
  const [servedItems, setServedItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [serviceTakenBy, setServiceTakenBy] = useState(null);

  useEffect(() => {
    if (!token || orders.length === 0) return;

    const fetchOrderDetails = async () => {
      try {
        setIsLoading(true);
        const details = [];
        let allServedItems = [];

        for (const order of orders) {
          const response = await fetch(`http://localhost:5000/api/order/${order.id}/details`, {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          });

          if (!response.ok) throw new Error(`Sipariş detayları çekilemedi: ${response.statusText}`);

          const data = await response.json();
          details.push(
            ...data.map((item) => ({
              order_id: order.id,
              menu_id: item.menu_id,
              menu_name: item.menu_name,
              quantity: item.quantity,
              extra_name: item.extra_name,
              extra_price: item.extra_price || 0,
              menu_price: item.menu_price,
              price: (item.menu_price + (item.extra_price || 0)) * item.quantity,
              is_prepared: item.is_prepared,
            }))
          );

          const servedRes = await fetch(`http://localhost:5000/api/order/served/${order.id}`, {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          });

          if (servedRes.ok) {
            const servedData = await servedRes.json();
            allServedItems = [...allServedItems, ...servedData];
          }

          if (order.servedBy) {
            setServiceTakenBy(order.servedBy);
          }
        }

        const menuRes = await fetch(`http://localhost:5000/api/menu/${restaurantId}`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        if (!menuRes.ok) throw new Error('Menü bilgileri çekilemedi');

        const menus = await menuRes.json();

        const detailsWithCategory = details.map((detail) => {
          const menu = menus.find((m) => m.id === detail.menu_id);
          return { ...detail, category: menu ? menu.category : 'Bilinmeyen' };
        });

        const filteredDetails = detailsWithCategory.filter((detail) => {
          const isServed = allServedItems.some(
            (item) => item.order_id === detail.order_id && item.menu_id === detail.menu_id
          );
          return !isServed;
        });

        setOrderDetails(filteredDetails);
        setServedItems(allServedItems);
        setError(null);

        if (filteredDetails.length === 0 && allServedItems.length > 0) {
          onOrdersCleared(table.id);
          onClose();
        }
      } catch (err) {
        console.error('Sipariş detayları çekilirken hata:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrderDetails();
  }, [orders, restaurantId, token, table.id, onClose, onOrdersCleared]);

  useEffect(() => {
    if (!token) return;

    const checkAllOrdersCompleted = async () => {
      const allCompleted = orders.every((o) => o.status === 'completed');
      if (allCompleted && orders.length > 0) {
        onOrdersCleared(table.id);
        onClose();
      }
    };

    checkAllOrdersCompleted();
  }, [orders, token, table.id, onOrdersCleared, onClose]);

  const isServed = (detail) =>
    servedItems.some(
      (item) => item.order_id === detail.order_id && item.menu_id === detail.menu_id
    );

  const handleServeItem = async (detail) => {
    if (!token) return alert('Token mevcut değil!');
    if (!detail.is_prepared) return alert('Bu ürün henüz hazırlanmadı!');
    if (isServed(detail)) return alert('Bu ürün zaten servis edildi!');

    try {
      const res = await fetch('http://localhost:5000/api/order/served', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          order_id: detail.order_id,
          menu_id: detail.menu_id,
          category: detail.category,
          price: detail.price,
          waiter_email: waiterEmail,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Servis işlemi başarısız');
      }

      setServedItems((prev) => [...prev, { order_id: detail.order_id, menu_id: detail.menu_id }]);
      setOrderDetails((prev) =>
        prev.filter(
          (item) => !(item.order_id === detail.order_id && item.menu_id === detail.menu_id)
        )
      );

      if (orderDetails.length === 1) {
        onOrdersCleared(table.id);
        onClose();
      }
    } catch (err) {
      alert('Hata: ' + err.message);
    }
  };

  const handleServeAll = async () => {
    if (!token) return;
    if (orderDetails.some((d) => !d.is_prepared)) return alert('Bazı ürünler hazırlanmadı!');
    const toServe = orderDetails.filter((d) => !isServed(d));
    if (toServe.length === 0) return alert('Servis edilecek ürün yok');

    try {
      const responses = await Promise.all(
        toServe.map((detail) =>
          fetch('http://localhost:5000/api/order/served', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
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

      if (responses.every((r) => r.ok)) {
        setServedItems((prev) => [
          ...prev,
          ...toServe.map((d) => ({ order_id: d.order_id, menu_id: d.menu_id })),
        ]);
        setOrderDetails([]);
        onOrdersCleared(table.id);
        onClose();
      } else {
        alert('Bazı ürünler servis edilemedi!');
      }
    } catch (err) {
      alert('Hata: ' + err.message);
    }
  };

  const handleTakeService = async () => {
    if (!token) return alert('Token mevcut değil!');
    if (orderDetails.some((d) => !d.is_prepared)) return alert('Bazı ürünler hazırlanmadı!');

    try {
      const responses = await Promise.all(
        orders.map((order) =>
          fetch(`http://localhost:5000/api/order/${order.id}/take`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ waiter_email: waiterEmail }),
          })
        )
      );

      if (responses.every((r) => r.ok)) {
        setServiceTakenBy(waiterEmail);
      } else {
        alert('Servisi alamadınız!');
      }
    } catch (err) {
      alert('Servis alınırken hata oluştu: ' + err.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Masa {table.table_number} Sipariş Detayları</h2>

        {isLoading && <p>Yükleniyor...</p>}
        {error && <p className="text-red-500">Hata: {error}</p>}

        {!isLoading && !error && orderDetails.length === 0 ? (
          <p>Bu masada aktif sipariş yok.</p>
        ) : (
          <ul className="space-y-2 max-h-[50vh] overflow-y-auto">
            {orderDetails.map((detail) => {
              const served = isServed(detail);

              return (
                <li key={`${detail.order_id}-${detail.menu_id}`} className="flex justify-between">
                  <span>
                    {detail.menu_name}
                    {detail.extra_name ? ` + ${detail.extra_name}` : ''} ({detail.category}) -{' '}
                    {detail.price.toFixed(2)} TL (x{detail.quantity})
                    {!detail.is_prepared && (
                      <span className="text-red-500"> (Hazırlanmadı)</span>
                    )}
                    {served && <span className="text-gray-400"> (Servis Edildi)</span>}
                  </span>
                  {!served && (
                    <button
                      onClick={() => handleServeItem(detail)}
                      disabled={serviceTakenBy !== waiterEmail || !detail.is_prepared}
                      className={`bg-green-500 text-white px-2 py-1 rounded ${
                        serviceTakenBy !== waiterEmail ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      Servis Et
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex justify-between mt-4">
          <button
            onClick={handleServeAll}
            disabled={
              isLoading ||
              orderDetails.length === 0 ||
              orderDetails.every((d) => isServed(d)) ||
              serviceTakenBy !== waiterEmail
            }
            className={`bg-blue-500 text-white px-4 py-2 rounded ${
              isLoading ||
              orderDetails.length === 0 ||
              orderDetails.every((d) => isServed(d)) ||
              serviceTakenBy !== waiterEmail
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }`}
          >
            Tümünü Servis Et
          </button>

          <button
            onClick={handleTakeService}
            disabled={isLoading || orderDetails.length === 0 || serviceTakenBy === waiterEmail}
            className={`bg-yellow-500 text-white px-4 py-2 rounded ${
              isLoading || orderDetails.length === 0 || serviceTakenBy === waiterEmail
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }`}
          >
            Servisi Al
          </button>

          <button
            className="bg-gray-500 text-white px-4 py-2 rounded"
            onClick={onClose}
            disabled={isLoading}
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderModals;
