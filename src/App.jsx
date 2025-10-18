import React, { useContext, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext } from './context/AuthContext.jsx';
import { SocketContext } from './context/SocketContext.jsx';
import Home from './pages/home/Home';
import Kimlerİçin from './pages/kimleriçin/Kimlerİçin';
import Özellikler from './pages/özelllikler/Özellikler';
import About from './pages/about/About';
import Fiyatlar from './pages/fiyatlar/Fiyatlar.jsx';
import Ortaklıklar from './pages/ortaklık/Ortaklıklar';
import Contact from './pages/contact/Contact';
import PrivateRoute from './pages/dashboard/PrivateRoute.jsx';
import Tables from './pages/dashboard/tanımlamalar/Tables.jsx';
import Regions from './pages/dashboard/tanımlamalar/Regions.jsx';
import Menus from './pages/dashboard/tanımlamalar/Menus.jsx';
import Discounts from './pages/dashboard/tanımlamalar/Discounts.jsx';
import MenuSettings from './pages/dashboard/ayarlar/MenuSettings.jsx';
import UserSettings from './pages/dashboard/ayarlar/UserSettings.jsx';
import Register from './pages/register/Register';
import Login from './pages/login/Login';
import Success from './pages/success/Success';
import Dashboard from './pages/dashboard/Dashboard.jsx';
import DigitalMenu from './pages/dashboard/digital-menu/DigitalMenu.jsx';
import Tanımlamalar from './pages/dashboard/tanımlamalar/Tanımlamalar.jsx';
import Sipariş from './pages/dashboard/sipariş/Sipariş.jsx';
import Mutfak from './pages/dashboard/mutfak/Mutfak.jsx';
import İşlemler from './pages/dashboard/işlemler/İşlemler.jsx';
import Raporlar from './pages/dashboard/raporlar/Raporlar.jsx';
import Kullanıcılar from './pages/dashboard/kullanıcılar/Kullanıcılar.jsx';
import Ayarlar from './pages/dashboard/ayarlar/Ayarlar.jsx';
import QRMenu from './pages/qrmenu/QRMenu.jsx';
import Garson from './pages/dashboard/garson/Garson.jsx';
import BranchAdd from './pages/dashboard/branchadd/BranchAdd.jsx';
import Error from './pages/error/Error.jsx';

function App() {
  const { user, selectedBranch } = useContext(AuthContext);
  const { socket } = useContext(SocketContext);

  useEffect(() => {
    if (socket && user && selectedBranch) {
      const restaurantId = user.restaurant_id;
      const branchId = selectedBranch;
      if (user.role === 'admin') {
        socket.emit('join_admin', { restaurantId, branchId });
      } else if (user.role === 'owner') {
        socket.emit('join_owner', { restaurantId, branchId });
      } else if (user.role === 'waiter') {
        socket.emit('join-restaurant', { restaurantId, branchId });
      } else if (user.role === 'kitchen') {
        socket.emit('join_kitchen', { restaurantId, branchId });
      }
    }
  }, [socket, user, selectedBranch]);

  return (
   
        <Routes>
          {/* Genel Sayfalar */}
          <Route path="/" element={<Home />} />
          <Route path="/kimleriçin" element={<Kimlerİçin />} />
          <Route path="/özellikler" element={<Özellikler />} />
          <Route path="/hakkımızda" element={<About />} />
          <Route path="/fiyatlar" element={<Fiyatlar />} />
          <Route path="/ortaklıklar" element={<Ortaklıklar />} />
          <Route path="/iletişim" element={<Contact />} />

          {/* Giriş ve Kayıt */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Ödeme Sayfaları */}
          <Route path="/success" element={<Success />} />

          {/* QR Menü */}
          <Route
            path="/qrmenu/:restaurantId/:branchId/:tableNumber"
            element={<QRMenu />}
          />

          {/* Dashboard ve Alt Rotolar */}
          <Route
            path="/dashboard/:restaurantId/:branchId"
            element={
              <PrivateRoute roles={['admin', 'owner', 'waiter', 'kitchen']}>
                <Dashboard />
              </PrivateRoute>
            }
          >
            {/* Paket kısıtlamalarına göre koşullu rotalar */}
            {user?.package_type !== 'base' && (
              <>
                <Route path="orders" element={<Sipariş />} />
                <Route path="operations" element={<İşlemler />} />
                <Route path="reports" element={<Raporlar />} />
              </>
            )}
            <Route path="waiter" element={<Garson />} />
            <Route path="kitchen" element={<Mutfak />} />
            <Route path="users" element={<Kullanıcılar />} />
            <Route path="qrmenu" element={<DigitalMenu />} />
            <Route path="definitions" element={<Tanımlamalar />}>
              <Route path="tables" element={<Tables />} />
              <Route path="regions" element={<Regions />} />
              <Route path="menus" element={<Menus />} />
            </Route>
            {(user?.package_type === 'package2' || user?.package_type === 'premium') && (
              <Route path="branchadd" element={<BranchAdd />} />
            )}
            <Route path="settings" element={<Ayarlar />}>
              <Route path="menu" element={<MenuSettings />} />
              <Route path="users" element={<UserSettings />} />
            </Route>
          </Route>

          {/* Bilinmeyen Rotolar için Hata Sayfası */}
          <Route path="*" element={<Error />} />
        </Routes>
      
  );
}

export default App;
