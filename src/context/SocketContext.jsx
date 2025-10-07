import { createContext, useEffect, useState, useContext, useRef } from 'react';
import { io } from 'socket.io-client';
import { AuthContext } from './AuthContext';

export const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const { user, selectedBranch, token } = useContext(AuthContext);

  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);

  const prevBranchRef = useRef(null);
  const prevRoleRef = useRef(null);
  const reconnectAttempts = useRef(0);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  // 🔌 Socket bağlantısını başlat
  useEffect(() => {
    if (!token) return;

    console.log(`[Socket] Bağlantı başlatılıyor → ${API_URL}`);

    const newSocket = io(API_URL, {
      withCredentials: true,
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 15000,
      auth: { token },
    });

    setSocket(newSocket);

    // 🔄 Bağlantı olayları
    newSocket.on('connect', () => {
      console.log(`[Socket] ✅ Bağlandı: ${newSocket.id}`);
      setIsConnected(true);
      setError(null);
      reconnectAttempts.current = 0;
    });

    newSocket.on('disconnect', (reason) => {
      console.warn(`[Socket] ⚠️ Bağlantı koptu: ${reason}`);
      setIsConnected(false);
      setError(`Bağlantı koptu: ${reason}`);
    });

    newSocket.on('connect_error', (err) => {
      reconnectAttempts.current += 1;
      console.error(`[Socket] ❌ Hata: ${err.message} (deneme ${reconnectAttempts.current})`);
      setError(`Socket bağlantı hatası: ${err.message}`);
    });

    newSocket.on('reconnect', (attemptNumber) => {
      console.log(`[Socket] 🔁 Yeniden bağlandı (${attemptNumber}. deneme)`);
      setIsConnected(true);
      setError(null);
    });

    // 🔔 --- EVENTLERİN TAMAMI ---
    newSocket.on('branch-added', ({ id, restaurant_id, country, city, name }) =>
      console.log(`[Socket] 🏢 Yeni şube: ${name} (ID: ${id})`)
    );

    newSocket.on('branch-deleted', ({ branch_id }) =>
      console.log(`[Socket] 🗑️ Şube silindi: ${branch_id}`)
    );

    newSocket.on('menu-added', ({ id, name }) =>
      console.log(`[Socket] 🍽️ Yeni menü: ${name} (ID: ${id})`)
    );

    newSocket.on('menu-deleted', ({ menu_id }) =>
      console.log(`[Socket] 🧾 Menü silindi: ${menu_id}`)
    );

    newSocket.on('menu-updated', ({ id, name }) =>
      console.log(`[Socket] ✏️ Menü güncellendi: ${name} (ID: ${id})`)
    );

    newSocket.on('extra-added', ({ id, menu_id, name }) =>
      console.log(`[Socket] ➕ Yeni ekstra: ${name} (Menü ID: ${menu_id})`)
    );

    newSocket.on('extra-deleted', ({ extra_id, menu_id }) =>
      console.log(`[Socket] ➖ Ekstra silindi: ${extra_id} (Menü ID: ${menu_id})`)
    );

    newSocket.on('region-added', ({ id, name }) =>
      console.log(`[Socket] 🗺️ Yeni bölge: ${name} (ID: ${id})`)
    );

    newSocket.on('region-deleted', ({ region_id }) =>
      console.log(`[Socket] 📍 Bölge silindi: ${region_id}`)
    );

    newSocket.on('order-created', ({ order_id, table_id, status }) =>
      console.log(`[Socket] 🧾 Yeni sipariş: ${order_id} (Masa: ${table_id}, Durum: ${status})`)
    );

    newSocket.on('order-updated', ({ order_id, status }) =>
      console.log(`[Socket] 🔄 Sipariş güncellendi: ${order_id} → ${status}`)
    );

    newSocket.on('payment-created', ({ transaction_id, order_id, status }) =>
      console.log(`[Socket] 💰 Yeni ödeme: ${transaction_id} (Sipariş: ${order_id}, Durum: ${status})`)
    );

    newSocket.on('audit-log', ({ id, user_id, action }) =>
      console.log(`[Socket] 🧠 Yeni audit log: ${action} (Kullanıcı: ${user_id}, Log ID: ${id})`)
    );

    // 🧹 Temizlik
    return () => {
      console.log('[Socket] 🧹 Bağlantı kapatılıyor...');
      newSocket.removeAllListeners();
      newSocket.disconnect();
      setSocket(null);
    };
  }, [token, API_URL]);

  // 🔁 Kullanıcı veya şube değiştiğinde odaları güncelle
  useEffect(() => {
    if (!socket || !user || !selectedBranch) return;

    const { restaurant_id, role, is_initial_admin } = user;
    const branchId = selectedBranch;
    const restaurantId = restaurant_id;

    if (!restaurantId || !branchId || !role) {
      console.warn('[Socket] Eksik bilgi:', { restaurantId, branchId, role });
      setError('Eksik bilgi: Restaurant veya şube seçili değil');
      return;
    }

    // Önceki odadan çık
    if (prevBranchRef.current !== branchId || prevRoleRef.current !== role) {
      const prevBranch = prevBranchRef.current;
      const prevRole = prevRoleRef.current;

      if (prevRole && prevBranch) {
        console.log(`[Socket] 🚪 Önceki odadan çıkılıyor: ${prevBranch} (${prevRole})`);

        if (prevRole === 'admin' || prevRole === 'owner') {
          socket.emit('leave_admin', { restaurantId, branchId: prevBranch });
        } else if (prevRole === 'waiter') {
          socket.emit('leave_waiter', { restaurantId, branchId: prevBranch });
        } else if (prevRole === 'kitchen') {
          socket.emit('leave_kitchen', { restaurantId, branchId: prevBranch });
        }
      }
    }

    console.log('[Socket] 🚀 Odaya katılıyor:', { restaurantId, branchId, role, is_initial_admin });

    // Yeni odalara katıl
    socket.emit('join', `restaurant_${restaurantId}_${branchId}`);
    if (role === 'admin') {
      socket.emit('join_admin', { restaurantId, branchId, isInitialAdmin: is_initial_admin });
    } else if (role === 'owner') {
      socket.emit('join_owner', { restaurantId, branchId });
    } else if (role === 'waiter') {
      socket.emit('join_waiter', { restaurantId, branchId });
    } else if (role === 'kitchen') {
      socket.emit('join_kitchen', { restaurantId, branchId });
    }

    // Referansları güncelle
    prevBranchRef.current = branchId;
    prevRoleRef.current = role;
  }, [socket, user, selectedBranch]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, error }}>
      {children}
    </SocketContext.Provider>
  );
};
