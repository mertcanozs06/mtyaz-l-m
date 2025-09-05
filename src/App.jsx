import { Routes , Route, Navigate } from "react-router-dom";
import { SocketProvider } from "./context/SocketContext.jsx";
import ReactDOM from 'react-dom/client';
import Home from './pages/home/Home';
import Kimlerİçin from "./pages/kimleriçin/Kimlerİçin";
import Özellikler from './pages/özelllikler/Özellikler';
import About from './pages/about/About';
import Fiyatlar from "./pages/fiyatlar/Fiyatlar.jsx";
import Ortaklıklar from "./pages/ortaklık/Ortaklıklar";
import Contact from './pages/contact/Contact';
import { AuthProvider } from './context/AuthContext.jsx';
import PrivateRoute from './pages/dashboard/PrivateRoute.jsx';
import Tables from './pages/dashboard/tanımlamalar/Tables.jsx';
import Regions from './pages/dashboard/tanımlamalar/Regions.jsx';
import Menus from './pages/dashboard/tanımlamalar/Menus.jsx';
import Discounts from './pages/dashboard/tanımlamalar/Discounts.jsx';
import MenuSettings from './pages/dashboard/ayarlar/MenuSettings.jsx';
import UserSettings from './pages/dashboard/ayarlar/UserSettings.jsx';
import Register from "./pages/register/Register";
import Login from "./pages/login/Login";
import Dashboard from "./pages/dashboard/Dashboard.jsx" ;
import DigitalMenu from "./pages/dashboard/digital-menu/DigitalMenu.jsx";
import Tanımlamalar from "./pages/dashboard/tanımlamalar/Tanımlamalar.jsx"
import Sipariş from "./pages/dashboard/sipariş/Sipariş.jsx";
import Mutfak from "./pages/dashboard/mutfak/Mutfak.jsx";
import İşlemler from './pages/dashboard/işlemler/İşlemler.jsx'
import Raporlar from "./pages/dashboard/raporlar/Raporlar.jsx";
import Kullanıcılar from "./pages/dashboard/kullanıcılar/Kullanıcılar.jsx";
import Ayarlar from "./pages/dashboard/ayarlar/Ayarlar.jsx";
import QRMenu from "./pages/qrmenu/QRMenu.jsx";
import Garson from "./pages/dashboard/garson/Garson.jsx";
import Error from "./pages/error/Error.jsx";
import { useEffect, useState } from "react";
import { BsDisplay } from "react-icons/bs";
function App() {

 

  return (
   <div>
        <AuthProvider>
          <SocketProvider>
         <Routes>
           <Route path="/" element={<Home/>} />
           <Route path="/kimleriçin" element={<Kimlerİçin/>} />
           <Route path="/özellikler" element={<Özellikler/>} />
           <Route path="/hakkımızda" element={<About/>} />
           <Route path="/fiyatlar" element={<Fiyatlar/>} />
           <Route path="/ortaklıklar" element={<Ortaklıklar/>} />
           <Route path="/iletişim" element={<Contact/>} />
           <Route
            path="/dashboard/:restaurantId"
            element={
              <PrivateRoute roles={['admin', 'waiter', 'kitchen']}>
                <Dashboard />
              </PrivateRoute>
            }
          >
            <Route path="orders" element={<Sipariş/>} />
            <Route path="operations" element={<İşlemler />} />
            <Route path="waiter" element={<Garson/>} />
            <Route path="kitchen" element={<Mutfak />} />
            <Route path="reports" element={<Raporlar />} />
            <Route path="users" element={<Kullanıcılar />} />
            <Route path="qrmenu" element={<DigitalMenu />} />
            <Route path="definitions" element={<Tanımlamalar />}>
              <Route path="tables" element={<Tables />} />
              <Route path="regions" element={<Regions />} />
              <Route path="menus" element={<Menus />} />
              <Route path="discounts" element={<Discounts />} />
            </Route>
            <Route path="settings" element={<Ayarlar />}>
              <Route path="menu" element={<MenuSettings />} />
              <Route path="users" element={<UserSettings />} />
            </Route>
          </Route>
            <Route path="/qrmenu/:restaurantId/:tableNumber" element={<QRMenu/>}/>
           <Route path="/register" element={<Register/>} />
           <Route path="/login" element={<Login />} />
         </Routes>
         </SocketProvider>
         </AuthProvider>
        
   </div>
  );  
}
export default App
