import { useEffect, useState, useContext, useCallback } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { AuthContext } from '../../../context/AuthContext';
import { SocketContext } from '../../../context/SocketContext';

const Sipariş = () => {
  const { restaurantId, branchId } = useParams();
  const { user, selectedBranch, package_type,token } = useContext(AuthContext);
  const { socket, isConnected } = useContext(SocketContext);

  const [orders, setOrders] = useState([]);
  const [orderDetails, setOrderDetails] = useState({});
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [approveConfirm, setApproveConfirm] = useState(null);

  // Masaları ve siparişleri çek
  useEffect(() => {
    const fetchData = async () => {
      if (!user || !selectedBranch || !token) {
        setErrorMessage('Kullanıcı, şube veya token bilgisi eksik.');
        setLoading(false);
        return;
      }

      if (user.restaurant_id !== parseInt(restaurantId, 10)) {
        setErrorMessage('Bu restorana erişim yetkiniz yok.');
        setLoading(false);
        return;
      }

      if (branchId !== selectedBranch) {
        setErrorMessage('Seçilen şube geçersiz.');
        setLoading(false);
        return;
      }

      try {
        // 1. Masaları çek
        const tablesRes = await fetch(
          `http://localhost:5000/api/table/${restaurantId}/${branchId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        if (!tablesRes.ok) {
          const errData = await tablesRes.json().catch(() => ({}));
          if (tablesRes.status === 401) throw new Error('Lütfen giriş yapın.');
          if (tablesRes.status === 403)
            throw new Error('Bu şubeye erişim yetkiniz yok.');
          throw new Error(errData.message || 'Masalar yüklenemedi.');
        }
        const tablesData = await tablesRes.json();
        setTables(tablesData);

        // 2. Siparişleri çek
        const ordersRes = await fetch(
          `http://localhost:5000/api/order/${restaurantId}/${branchId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        if (!ordersRes.ok) {
          const errData = await ordersRes.json().catch(() => ({}));
          if (ordersRes.status === 401) throw new Error('Lütfen giriş yapın.');
          if (ordersRes.status === 403)
            throw new Error('Bu şubeye erişim yetkiniz yok.');
          throw new Error(errData.message || 'Siparişler yüklenemedi.');
        }
        const ordersData = await ordersRes.json();
        setOrders(ordersData);

        setLoading(false);
      } catch (err) {
        console.error('fetchData error in Sipariş:', err);
        setErrorMessage(err.message || 'Bir hata oluştu.');
        setLoading(false);
      }
    };

    if (restaurantId && branchId && token) {
      fetchData();
    }
  }, [restaurantId, branchId, token, user, selectedBranch]);

  // Sipariş detaylarını getir
  const fetchOrderDetails = async (orderId) => {
    if (orderDetails[orderId]) {
      return; // zaten çekmişiz
    }
    try {
      // Endpoint backend’te tanımlı: router.get('/:order_id/details', …)
      // Ama sen frontend’te restaurantId / branchId da geçerek çağırıyorsun.
      // Burada backend’in bu URL’i desteklediğinden emin olmalısın.
      const res = await fetch(
        `http://localhost:5000/api/order/${restaurantId}/${branchId}/${orderId}/details`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 401) throw new Error('Lütfen giriş yapın.');
        if (res.status === 403)
          throw new Error('Bu şubeye erişim yetkiniz yok.');
        throw new Error(errData.message || 'Sipariş detayları yüklenemedi.');
      }
      const data = await res.json();
      setOrderDetails((prev) => ({
        ...prev,
        [orderId]: data,
      }));
    } catch (err) {
      console.error('fetchOrderDetails error:', err);
      setErrorMessage(err.message || 'Detay alınamadı.');
    }
  };

  // Siparişi onayla (PUT)
  const handleApproveOrder = async (orderId) => {
    try {
      const res = await fetch(
        `http://localhost:5000/api/order/${restaurantId}/${branchId}/${orderId}/approve`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 401) throw new Error('Lütfen giriş yapın.');
        if (res.status === 403)
          throw new Error('Bu şubeye erişim yetkiniz yok.');
        throw new Error(errData.message || 'Sipariş onaylanamadı.');
      }
      // Başarılı ise durum güncelle
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId ? { ...o, status: 'preparing' } : o
        )
      );
      setApproveConfirm(null);
      // Socket ile durumu bildir
      socket?.emit('order_status_updated', {
        restaurant_id: parseInt(restaurantId, 10),
        branch_id: parseInt(branchId, 10),
        id: orderId,
        status: 'preparing',
      });
    } catch (err) {
      console.error('handleApproveOrder error:', err);
      setErrorMessage(err.message || 'Onay hatası.');
    }
  };

  // Yeni sipariş geldiğinde state güncelle
  const handleNewOrder = useCallback(
    (newOrder) => {
      if (
        newOrder.restaurant_id !== parseInt(restaurantId, 10) ||
        newOrder.branch_id !== parseInt(branchId, 10)
      ) {
        return;
      }
      setOrders((prev) => {
        const exists = prev.find((o) => o.id === newOrder.id);
        if (!exists) {
          return [...prev, newOrder];
        } else if (exists.status !== newOrder.status) {
          return prev.map((o) =>
            o.id === newOrder.id ? { ...o, status: newOrder.status } : o
          );
        }
        return prev;
      });
    },
    [restaurantId, branchId]
  );

  // Sipariş durumu güncellendiğinde
  const handleOrderStatusUpdated = useCallback(
    (updatedOrder) => {
      if (
        updatedOrder.restaurant_id !== parseInt(restaurantId, 10) ||
        updatedOrder.branch_id !== parseInt(branchId, 10)
      ) {
        return;
      }
      setOrders((prev) =>
        prev.map((o) =>
          o.id === updatedOrder.id
            ? { ...o, status: updatedOrder.status }
            : o
        )
      );
    },
    [restaurantId, branchId]
  );

  // Socket bağlanınca odalara katıl ve event dinleyiciler ekle
  useEffect(() => {
    if (
      !socket ||
      !isConnected ||
      !restaurantId ||
      !branchId ||
      user?.role !== 'admin'
    ) {
      return;
    }

    // Odaya katıl
    socket.emit('join_admin', {
      restaurantId: parseInt(restaurantId, 10),
      branchId: parseInt(branchId, 10),
    });

    // Önce var olan listener’ları temizle
    socket.off('new_order', handleNewOrder);
    socket.off('order_status_updated', handleOrderStatusUpdated);

    // Yeni listener ekle
    socket.on('new_order', handleNewOrder);
    socket.on('order_status_updated', handleOrderStatusUpdated);

    socket.on('connect', () => {
      socket.emit('join_admin', {
        restaurantId: parseInt(restaurantId, 10),
        branchId: parseInt(branchId, 10),
      });
    });

    return () => {
      socket.off('new_order', handleNewOrder);
      socket.off('order_status_updated', handleOrderStatusUpdated);
      socket.off('connect');
    };
  }, [
    socket,
    isConnected,
    restaurantId,
    branchId,
    user,
    handleNewOrder,
    handleOrderStatusUpdated,
  ]);

  // Paket kontrolü
  if (!['base', 'package2', 'premium'].includes(package_type)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-red-100 text-red-600 p-4 rounded-md shadow-md max-w-md text-center">
          Bu özellik yalnızca base, package2 ve premium paketlerde kullanılabilir.
        </div>
      </div>
    );
  }

  // Yetkisiz erişim
  if (
    !user ||
    user.role !== 'admin' ||
    user.restaurant_id !== parseInt(restaurantId, 10) ||
    branchId !== selectedBranch
  ) {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-gray-600">Yükleniyor...</div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-red-100 text-red-600 p-4 rounded-md shadow-md max-w-md text-center">
          {errorMessage}
          <button
            className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            onClick={() => setErrorMessage('')}
          >
            Kapat
          </button>
        </div>
      </div>
    );
  }

  const groupedOrders = {
    pending: orders.filter((o) => o.status === 'pending'),
    preparing: orders.filter((o) => o.status === 'preparing'),
    ready: orders.filter((o) => o.status === 'ready'),
    completed: orders.filter((o) => o.status === 'completed'),
  };

  const renderOrderCard = (order, canApprove = false) => {
    const table = tables.find((t) => t.id === order.table_id);
    const tableNumber = table
      ? `${table.table_number}${table.region ? ` (${table.region})` : ''}`
      : `#${order.table_id}`;

    return (
      <div key={order.id} className="p-4 bg-white shadow-md rounded-md relative">
        <p className="font-semibold">Masa: {tableNumber}</p>
        <p>
          Durum:{' '}
          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
        </p>
        <p>Toplam: {order.total_price} TL</p>
        {order.payment_method && <p>Ödeme Yöntemi: {order.payment_method}</p>}
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
                  Fiyat:{' '}
                  {(detail.menu_price + (detail.extra_price || 0)) *
                    detail.quantity}{' '}
                  TL
                </p>
              </div>
            ))}
          </div>
        )}

        {canApprove && (
          <button
            onClick={() => setApproveConfirm(order.id)}
            className="mt-4 w-full bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
          >
            Onayla
          </button>
        )}

        {approveConfirm === order.id && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-4 rounded-md shadow-md max-w-sm text-center">
              <p>
                "Masa {tableNumber}" için siparişi onaylamak istediğinizden
                emin misiniz?
              </p>
              <div className="mt-4 flex gap-4 justify-center">
                <button
                  onClick={() => handleApproveOrder(order.id)}
                  className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                >
                  Evet, Onayla
                </button>
                <button
                  onClick={() => setApproveConfirm(null)}
                  className="bg-gray-300 text-black px-3 py-1 rounded hover:bg-gray-400"
                >
                  İptal
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8 bg-gray-100">
      <h2 className="text-2xl font-bold mb-6">
        Siparişler – Restoran {restaurantId}, Şube {branchId}
      </h2>

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
                {groupedOrders[key].map((order) =>
                  renderOrderCard(order, key === 'pending')
                )}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
};

export default Sipariş;

