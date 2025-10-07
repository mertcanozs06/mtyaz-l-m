import React, { useState, useEffect, useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../../../context/AuthContext';

const OrderModals = ({ table, orders, restaurantId, branchId, onClose, onOrdersCleared }) => {
  const { token, user, selectedBranch, package_type } = useContext(AuthContext);
  const waiterEmail = user?.email;

  const [orderDetails, setOrderDetails] = useState([]);
  const [servedItems, setServedItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [serviceTakenBy, setServiceTakenBy] = useState(null);

  useEffect(() => {
    if (!token || !orders.length || !waiterEmail) {
      setError('Token, sipariş veya garson email bilgisi eksik.');
      return;
    }

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

          if (!response.ok) {
            const errorData = await response.json();
            if (response.status === 401) throw new Error('Oturumunuz sona erdi. Lütfen tekrar giriş yapın.');
            if (response.status === 403) throw new Error('Bu siparişe erişim yetkiniz yok.');
            if (response.status === 404) throw new Error('Sipariş detayları bulunamadı.');
            throw new Error(errorData.message || 'Sipariş detayları çekilemedi.');
          }

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

          if (!servedRes.ok) {
            const errorData = await servedRes.json();
            if (servedRes.status === 401) throw new Error('Oturumunuz sona erdi. Lütfen tekrar giriş yapın.');
            if (servedRes.status === 403) throw new Error('Bu siparişe erişim yetkiniz yok.');
            throw new Error(errorData.message || 'Servis edilen ürünler çekilemedi.');
          }

          const servedData = await servedRes.json();
          allServedItems = [...allServedItems, ...servedData];

          if (order.servedBy) {
            setServiceTakenBy(order.servedBy);
          }
        }

        const menuRes = await fetch(`http://localhost:5000/api/${restaurantId}/${branchId}/menu`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        if (!menuRes.ok) {
          const errorData = await menuRes.json();
          if (menuRes.status === 401) throw new Error('Oturumunuz sona erdi. Lütfen tekrar giriş yapın.');
          if (menuRes.status === 403) throw new Error('Bu menüye erişim yetkiniz yok.');
          if (menuRes.status === 404) throw new Error('Bu şubede menü bulunamadı.');
          throw new Error(errorData.message || 'Menü bilgileri çekilemedi.');
        }

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
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrderDetails();
  }, [orders, restaurantId, branchId, token, waiterEmail, table.id, onClose, onOrdersCleared]);

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
    if (!token) {
      setError('Token mevcut değil.');
      return;
    }
    if (!detail.is_prepared) {
      setError('Bu ürün henüz hazırlanmadı.');
      return;
    }
    if (isServed(detail)) {
      setError('Bu ürün zaten servis edildi.');
      return;
    }

    try {
      const res = await fetch(`http://localhost:5000/api/served/${restaurantId}/${branchId}`, {
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
        if (res.status === 401) throw new Error('Oturumunuz sona erdi. Lütfen tekrar giriş yapın.');
        if (res.status === 403) throw new Error('Bu işlemi gerçekleştirme yetkiniz yok.');
        if (res.status === 404) throw new Error('Geçersiz sipariş veya şube.');
        throw new Error(errorData.message || 'Servis işlemi başarısız.');
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
      setError(err.message);
    }
  };

  const handleServeAll = async () => {
    if (!token) {
      setError('Token mevcut değil.');
      return;
    }
    if (orderDetails.some((d) => !d.is_prepared)) {
      setError('Bazı ürünler hazırlanmadı.');
      return;
    }
    const toServe = orderDetails.filter((d) => !isServed(d));
    if (toServe.length === 0) {
      setError('Servis edilecek ürün yok.');
      return;
    }

    try {
      const responses = await Promise.all(
        toServe.map((detail) =>
          fetch(`http://localhost:5000/api/served/${restaurantId}/${branchId}`, {
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

      const errors = [];
      responses.forEach((r, index) => {
        if (!r.ok) {
          errors.push(`Ürün ${toServe[index].menu_name} servis edilemedi.`);
        }
      });

      if (errors.length === 0) {
        setServedItems((prev) => [
          ...prev,
          ...toServe.map((d) => ({ order_id: d.order_id, menu_id: d.menu_id })),
        ]);
        setOrderDetails([]);
        onOrdersCleared(table.id);
        onClose();
      } else {
        setError(errors.join(' '));
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleTakeService = async () => {
    if (!token) {
      setError('Token mevcut değil.');
      return;
    }
    if (orderDetails.some((d) => !d.is_prepared)) {
      setError('Bazı ürünler hazırlanmadı.');
      return;
    }

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

      const errors = [];
      responses.forEach((r, index) => {
        if (!r.ok) {
          errors.push(`Sipariş ${orders[index].id} alınamadı.`);
        }
      });

      if (errors.length === 0) {
        setServiceTakenBy(waiterEmail);
      } else {
        setError(errors.join(' '));
      }
    } catch (err) {
      setError(err.message);
    }
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
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
        <div className="bg-white p-6 rounded-lg max-w-md w-full">
          <p className="text-xl text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
        <div className="bg-white p-6 rounded-lg max-w-md w-full text-center">
          <p className="text-red-500">Hata: {error}</p>
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          Masa {table.table_number} ({table.region}) Sipariş Detayları
        </h2>

        {orderDetails.length === 0 ? (
          <p className="text-gray-500">Bu masada aktif sipariş yok.</p>
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
                      className={`bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600 ${
                        serviceTakenBy !== waiterEmail || !detail.is_prepared
                          ? 'opacity-50 cursor-not-allowed'
                          : ''
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
            className={`bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 ${
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
            className={`bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 ${
              isLoading || orderDetails.length === 0 || serviceTakenBy === waiterEmail
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }`}
          >
            Servisi Al
          </button>

          <button
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
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
