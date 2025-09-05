import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {jwtDecode} from 'jwt-decode'; // jwt-decode import
import OrderModals from './OrderModals';

const Garson = () => {
  const { restaurantId } = useParams();
  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState({});
  const [selectedTable, setSelectedTable] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // waiterEmail'i token'dan al
  const token = localStorage.getItem('token');
  let waiterEmail = null;
  try {
    waiterEmail = token ? jwtDecode(token).email : null;
  } catch (err) {
    console.error('Token çözümleme hatası:', err);
  }
  console.log('restaurantId:', restaurantId);
  console.log('waiterEmail:', waiterEmail);
  console.log('Token:', token);

  // Masaları çek
  useEffect(() => {
    const fetchTables = async () => {
      try {
        setIsLoading(true);
        if (!token) {
          throw new Error('Token bulunamadı, lütfen giriş yapın');
        }
        if (!waiterEmail) {
          throw new Error('Garson email bulunamadı, token geçersiz');
        }
        const response = await fetch(`http://localhost:5000/api/table/${restaurantId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
          throw new Error(`Masalar çekilemedi: ${response.statusText}`);
        }
        const data = await response.json();
        setTables(data);
        setError(null);
      } catch (error) {
        console.error('Masalar çekilirken hata:', error);
        setError(error.message);
      } finally {
        setIsLoading(false);
      }
    };
    if (restaurantId) {
      fetchTables();
    } else {
      setError('Restaurant ID bulunamadı');
      setIsLoading(false);
    }
  }, [restaurantId, token]);

  // Masanın siparişlerini çek
  const fetchOrders = async (table_id) => {
    try {
      const response = await fetch(`/api/orders/${restaurantId}?table_id=${table_id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        throw new Error(`Siparişler çekilemedi: ${response.statusText}`);
      }
      const data = await response.json();
      setOrders((prev) => ({ ...prev, [table_id]: data }));
    } catch (error) {
      console.error('Siparişler çekilirken hata:', error);
      setError(error.message);
    }
  };

  // Detaylar linkine tıklama
  const openOrderModal = (table) => {
    setSelectedTable(table);
    fetchOrders(table.id);
    setModalOpen(true);
  };

  // Yükleniyor veya hata durumu
  if (isLoading) {
    return <div className="p-4 text-center">Yükleniyor...</div>;
  }
  if (error) {
    return <div className="p-4 text-center text-red-500">Hata: {error}</div>;
  }
  if (!tables.length) {
    return <div className="p-4 text-center">Bu restoranda masa bulunamadı.</div>;
  }
  if (!waiterEmail) {
    return <div className="p-4 text-center text-red-500">Garson email bulunamadı, lütfen giriş yapın.</div>;
  }

  return (
    <div className="grid grid-cols-3 gap-4 p-4">
      {tables.map((table) => {
        const tableOrders = orders[table.id] || [];
        const totalPrice = tableOrders.reduce((sum, order) => sum + order.total, 0);

        // Masanın başka bir garson tarafından alınıp alınmadığını kontrol et
        const isTaken = tableOrders.some(
          (order) => order.servedBy && order.servedBy !== waiterEmail
        );

        return (
          <div
            key={table.id}
            className="bg-white p-4 rounded-lg shadow-md text-center"
          >
            <h3 className="text-lg font-bold">Masa {table.table_number}</h3>
            {totalPrice > 0 ? (
              <>
                <p className="text-red-500 font-semibold">
                  {totalPrice.toFixed(2)} TL
                </p>
                {!isTaken && (
                  <button
                    className="text-blue-500 underline"
                    onClick={() => openOrderModal(table)}
                  >
                    Detaylar
                  </button>
                )}
              </>
            ) : (
              <p>Sipariş yok</p>
            )}
          </div>
        );
      })}
      {modalOpen && selectedTable && (
        <OrderModals
          table={selectedTable}
          orders={orders[selectedTable.id] || []}
          waiterEmail={waiterEmail}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
};

export default Garson;
