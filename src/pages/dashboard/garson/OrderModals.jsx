import React, { useState, useEffect } from 'react';

const OrderModals = ({ table, orders, waiterEmail, restaurantId, token, onClose }) => {
  const [orderDetails, setOrderDetails] = useState([]);
  const [servedItems, setServedItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Sipariş detaylarını ve servis edilenleri çek
  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        setIsLoading(true);
        const details = [];

        // Her sipariş için detayları çek
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

          // Servis edilen ürünleri çek (yeni endpoint)
          const servedResponse = await fetch(
            `http://localhost:5000/api/order/served/${order.id}`,
            {
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
            }
          );
          if (servedResponse.ok) {
            const servedData = await servedResponse.json();
            setServedItems((prev) => [
              ...prev,
              ...servedData.map((item) => item.menu_id),
            ]);
          }
        }

        // Menülerden kategori bilgisi çek
        const menuIds = [...new Set(details.map((item) => item.menu_id))];
        const menuResponse = await fetch(`http://localhost:5000/api/menu/${restaurantId}`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        if (!menuResponse.ok) throw new Error('Menü bilgileri çekilemedi');
        const menus = await menuResponse.json();

        const detailsWithCategory = details.map((detail) => {
          const menu = menus.find((m) => m.id === detail.menu_id);
          return { ...detail, category: menu ? menu.category : 'Bilinmeyen' };
        });

        setOrderDetails(detailsWithCategory);
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
  }, [orders, restaurantId, token]);

  // Tek bir ürünü servis et
  const handleServeItem = async (detail) => {
    if (!detail.is_prepared) {
      alert('Bu ürün henüz hazırlanmadı!');
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/api/order/served', {
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

  // Tümünü Servis Et
  const handleServeAll = async () => {
    if (orderDetails.some((detail) => !detail.is_prepared)) {
      alert('Bazı ürünler henüz hazırlanmadı!');
      return;
    }

    try {
      const responses = await Promise.all(
        orderDetails
          .filter((detail) => !servedItems.includes(detail.menu_id))
          .map((detail) =>
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

      if (responses.every((res) => res.ok)) {
        setServedItems(orderDetails.map((detail) => detail.menu_id));
      } else {
        console.error('Tüm ürünler servis edilemedi');
        alert('Tüm ürünler servis edilemedi');
      }
    } catch (error) {
      console.error('Tüm ürünler servis edilirken hata:', error);
      alert('Tüm ürünler servis edilirken hata oluştu');
    }
  };

  // Servisi Al (Siparişi kapat)
  const handleTakeService = async () => {
    if (orderDetails.some((detail) => !detail.is_prepared)) {
      alert('Bazı ürünler henüz hazırlanmadı!');
      return;
    }
    if (servedItems.length !== orderDetails.length) {
      alert('Tüm ürünler servis edilmeden sipariş kapatılamaz!');
      return;
    }

    try {
      const responses = await Promise.all(
        orders.map((order) =>
          fetch(`http://localhost:5000/api/order/${order.id}/close`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              payment_method: 'cash', // TODO: Kullanıcıdan alınabilir
              meal_voucher_type: null,
              discount_id: null,
            }),
          })
        )
      );

      if (responses.every((res) => res.ok)) {
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
              <li
                key={`${detail.order_id}-${detail.menu_id}`}
                className="flex justify-between items-center"
              >
                <span>
                  {detail.menu_name} {detail.extra_name ? `+ ${detail.extra_name}` : ''} (
                  {detail.category}) - {detail.price.toFixed(2)} TL (x{detail.quantity})
                  {!detail.is_prepared && <span className="text-red-500"> (Hazırlanmadı)</span>}
                  {servedItems.includes(detail.menu_id) && (
                    <span className="text-gray-400"> (Servis Edildi)</span>
                  )}
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
            className={`bg-blue-500 text-white px-4 py-2 rounded ${
              isLoading || orderDetails.length === 0 || servedItems.length === orderDetails.length
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }`}
            onClick={handleServeAll}
            disabled={isLoading || orderDetails.length === 0 || servedItems.length === orderDetails.length}
          >
            Tümünü Servis Et
          </button>
          <button
            className={`bg-yellow-500 text-white px-4 py-2 rounded ${
              isLoading || orderDetails.length === 0 || servedItems.length !== orderDetails.length
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }`}
            onClick={handleTakeService}
            disabled={isLoading || orderDetails.length === 0 || servedItems.length !== orderDetails.length}
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
