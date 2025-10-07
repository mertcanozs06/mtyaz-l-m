import { useEffect, useState, useContext, useCallback } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { AuthContext } from '../../../context/AuthContext';
import { SocketContext } from '../../../context/SocketContext';

const Mutfak = () => {
  const { restaurantId, branchId } = useParams();
  const { user, token, selectedBranch, package_type, logout } = useContext(AuthContext);
  const { socket, isConnected } = useContext(SocketContext);
  const [orders, setOrders] = useState([]);
  const [orderDetails, setOrderDetails] = useState({});
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [prepareItemConfirm, setPrepareItemConfirm] = useState(null);
  const [prepareOrderConfirm, setPrepareOrderConfirm] = useState(null);

  // Masaları ve siparişleri çek
  useEffect(() => {
    const fetchData = async () => {
      if (!user || !selectedBranch || !token) {
        setErrorMessage('Kullanıcı, şube veya token bilgisi eksik.');
        setLoading(false);
        return;
      }

      if (user.restaurant_id !== parseInt(restaurantId)) {
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
        // Masaları çek
        const tablesRes = await fetch(`http://localhost:5000/api/${restaurantId}/${branchId}/tables`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!tablesRes.ok) {
          const errorData = await tablesRes.json();
          if (tablesRes.status === 401) throw new Error('Oturumunuz sona erdi. Lütfen tekrar giriş yapın.');
          if (tablesRes.status === 403) throw new Error('Bu şubeye erişim yetkiniz yok.');
          throw new Error(errorData.message || 'Masalar yüklenemedi.');
        }
        const tablesData = await tablesRes.json();
        setTables(tablesData);

        // Hazırlanacak siparişleri çek
        const ordersRes = await fetch(`http://localhost:5000/api/${restaurantId}/${branchId}?status=preparing`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!ordersRes.ok) {
          const errorData = await ordersRes.json();
          if (ordersRes.status === 401) throw new Error('Oturumunuz sona erdi. Lütfen tekrar giriş yapın.');
          if (ordersRes.status === 403) throw new Error('Bu şubeye erişim yetkiniz yok.');
          throw new Error(errorData.message || 'Siparişler yüklenemedi.');
        }
        const ordersData = await ordersRes.json();
        setOrders(ordersData);
        setLoading(false);
      } catch (err) {
        setErrorMessage(err.message);
        setLoading(false);
      }
    };

    if (restaurantId && branchId && token) fetchData();
  }, [restaurantId, branchId, token, user, selectedBranch]);

  // Sipariş detaylarını getir
  const fetchOrderDetails = async (orderId) => {
    if (orderDetails[orderId]) return;

    try {
      const res = await fetch(`http://localhost:5000/api/${orderId}/details`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errorData = await res.json();
        if (res.status === 401) throw new Error('Oturumunuz sona erdi. Lütfen tekrar giriş yapın.');
        if (res.status === 403) throw new Error('Bu şubeye erişim yetkiniz yok.');
        throw new Error(errorData.message || 'Sipariş detayları yüklenemedi.');
      }
      const data = await res.json();
      setOrderDetails((prev) => ({ ...prev, [orderId]: data }));
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  // Ürünü hazırla
  const handlePrepareItem = async (detailId) => {
    try {
      const res = await fetch(`http://localhost:5000/api/details/${detailId}/prepare`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) {
        const errorData = await res.json();
        if (res.status === 401) throw new Error('Oturumunuz sona erdi. Lütfen tekrar giriş yapın.');
        if (res.status === 403) throw new Error('Bu şubeye erişim yetkiniz yok.');
        throw new Error(errorData.message || 'Ürün hazırlanamadı.');
      }
      const orderId = Object.keys(orderDetails).find((key) =>
        orderDetails[key].some((detail) => detail.id === detailId)
      );
      setOrderDetails((prevDetails) => {
        if (!prevDetails[orderId]) return prevDetails;
        const updatedDetails = prevDetails[orderId].map((detail) =>
          detail.id === detailId ? { ...detail, is_prepared: true } : detail
        );
        return { ...prevDetails, [orderId]: updatedDetails };
      });
      socket?.emit('order_detail_prepared', {
        restaurant_id: parseInt(restaurantId),
        branch_id: parseInt(branchId),
        orderId,
        detailId,
      });
      setPrepareItemConfirm(null);
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  // Tüm siparişi hazırla
  const handlePrepareOrder = async (orderId) => {
    try {
      const res = await fetch(`http://localhost:5000/api/${orderId}/prepare`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) {
        const errorData = await res.json();
        if (res.status === 401) throw new Error('Oturumunuz sona erdi. Lütfen tekrar giriş yapın.');
        if (res.status === 403) throw new Error('Bu şubeye erişim yetkiniz yok.');
        throw new Error(errorData.message || 'Sipariş hazırlanamadı.');
      }
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      setOrderDetails((prevDetails) => {
        if (!prevDetails[orderId]) return prevDetails;
        const updatedDetails = prevDetails[orderId].map((detail) => ({
          ...detail,
          is_prepared: true,
        }));
        return { ...prevDetails, [orderId]: updatedDetails };
      });
      socket?.emit('order_prepared', {
        restaurant_id: parseInt(restaurantId),
        branch_id: parseInt(branchId),
        orderId,
      });
      setPrepareOrderConfirm(null);
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  // Yeni sipariş
  const handleNewOrder = useCallback(
    (order) => {
      if (
        !order ||
        order.restaurant_id !== parseInt(restaurantId) ||
        order.branch_id !== parseInt(branchId) ||
        order.status !== 'preparing'
      ) {
        return;
      }
      setOrders((prevOrders) => {
        const existing = prevOrders.find((o) => o.id === order.id);
        if (!existing) {
          fetchOrderDetails(order.id);
          return [...prevOrders, order];
        }
        return prevOrders;
      });
    },
    [restaurantId, branchId]
  );

  // Sipariş detayı hazırlandı
  const handleOrderDetailPrepared = useCallback(
    ({ orderId, detailId }) => {
      if (
        orderId &&
        detailId &&
        orderDetails[orderId] &&
        orderDetails[orderId].some((d) => d.id === detailId)
      ) {
        setOrderDetails((prevDetails) => {
          const updatedDetails = prevDetails[orderId].map((detail) =>
            detail.id === detailId ? { ...detail, is_prepared: true } : detail
          );
          return { ...prevDetails, [orderId]: updatedDetails };
        });
      } else {
        fetchOrderDetails(orderId);
      }
    },
    []
  );

  // Tüm sipariş hazırlandı
  const handleOrderPrepared = useCallback(
    (orderId) => {
      setOrders((prevOrders) => prevOrders.filter((order) => order.id !== orderId));
      setOrderDetails((prevDetails) => {
        if (!prevDetails[orderId]) return prevDetails;
        const updatedDetails = prevDetails[orderId].map((detail) => ({
          ...detail,
          is_prepared: true,
        }));
        return { ...prevDetails, [orderId]: updatedDetails };
      });
    },
    []
  );

  // Socket bağlan
  useEffect(() => {
    if (!socket || !isConnected || !restaurantId || !branchId || user?.role !== 'kitchen') return;

    socket.emit('join_kitchen', { restaurant_id: parseInt(restaurantId), branch_id: parseInt(branchId) });

    socket.off('new_order');
    socket.off('order_detail_prepared');
    socket.off('order_prepared');

    socket.on('new_order', handleNewOrder);
    socket.on('order_detail_prepared', handleOrderDetailPrepared);
    socket.on('order_prepared', handleOrderPrepared);

    socket.on('connect', () => {
      socket.emit('join_kitchen', { restaurant_id: parseInt(restaurantId), branch_id: parseInt(branchId) });
    });

    return () => {
      socket.off('new_order', handleNewOrder);
      socket.off('order_detail_prepared', handleOrderDetailPrepared);
      socket.off('order_prepared', handleOrderPrepared);
      socket.off('connect');
    };
  }, [socket, isConnected, restaurantId, branchId, user, handleNewOrder, handleOrderDetailPrepared, handleOrderPrepared]);

  // Paket kontrolü
  if (!['base', 'package2', 'premium'].includes(package_type)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-red-100 text-red-600 p-4 rounded-md shadow-md max-w-md text-center">
          Mutfak özelliği yalnızca base, package2 ve premium paketlerde kullanılabilir.
        </div>
      </div>
    );
  }

  // Yetkisiz erişim
  if (!user || user.role !== 'kitchen' || user.restaurant_id !== parseInt(restaurantId) || branchId !== selectedBranch) {
    return <Navigate to="/login" replace />;
  }

  // Yükleme durumu
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-gray-600">Yükleniyor...</div>
      </div>
    );
  }

  // Hata mesajı
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

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8 bg-gray-100">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">
          Mutfak Paneli – Restoran {restaurantId}, Şube {branchId}
        </h2>
        <div className="flex items-center gap-4">
          <span className={`text-sm ${isConnected ? 'text-green-500' : 'text-red-500'}`}>
            {isConnected ? 'Bağlı' : 'Bağlantı Yok'}
          </span>
          <button
            onClick={() => logout()}
            className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600"
          >
            Çıkış Yap
          </button>
        </div>
      </div>

      <div className="space-y-8">
        <h3 className="text-xl font-semibold mb-4">Hazırlanacak Siparişler</h3>
        {orders.length === 0 ? (
          <p className="text-gray-500">Bu şubede hazırlanacak sipariş bulunmamaktadır.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {orders.map((order) => {
              const table = tables.find((t) => t.id === order.table_id);
              const tableNumber = table ? `${table.table_number}${table.region ? ` (${table.region})` : ''}` : `#${order.table_id}`;

              return (
                <div key={order.id} className="p-4 bg-white shadow-md rounded-md relative">
                  <p className="font-semibold">Masa: {tableNumber}</p>
                  <p>Durum: Hazırlanıyor</p>
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
                          <p>Durum: {detail.is_prepared ? 'Hazır' : 'Hazırlanacak'}</p>
                          {!detail.is_prepared && (
                            <button
                              onClick={() => setPrepareItemConfirm(detail.id)}
                              className="mt-2 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
                            >
                              Ürünü Hazırla
                            </button>
                          )}
                          {prepareItemConfirm === detail.id && (
                            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                              <div className="bg-white p-4 rounded-md shadow-md max-w-sm text-center">
                                <p>
                                  "{detail.menu_name} x{detail.quantity}" ürününü hazırlamak istediğinizden emin misiniz?
                                </p>
                                <div className="mt-4 flex gap-4 justify-center">
                                  <button
                                    onClick={() => handlePrepareItem(detail.id)}
                                    className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                                  >
                                    Evet, Hazırla
                                  </button>
                                  <button
                                    onClick={() => setPrepareItemConfirm(null)}
                                    className="bg-gray-300 text-black px-3 py-1 rounded hover:bg-gray-400"
                                  >
                                    İptal
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      <button
                        onClick={() => setPrepareOrderConfirm(order.id)}
                        className="mt-4 w-full bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600"
                      >
                        Tüm Siparişi Hazırla
                      </button>
                      {prepareOrderConfirm === order.id && (
                        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                          <div className="bg-white p-4 rounded-md shadow-md max-w-sm text-center">
                            <p>"Masa {tableNumber}" için tüm siparişi hazırlamak istediğinizden emin misiniz?</p>
                            <div className="mt-4 flex gap-4 justify-center">
                              <button
                                onClick={() => handlePrepareOrder(order.id)}
                                className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
                              >
                                Evet, Hazırla
                              </button>
                              <button
                                onClick={() => setPrepareOrderConfirm(null)}
                                className="bg-gray-300 text-black px-3 py-1 rounded hover:bg-gray-400"
                              >
                                İptal
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Mutfak;
