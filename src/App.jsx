import { Routes , Route } from "react-router-dom";
import ReactDOM from 'react-dom/client';
import Home from './pages/home/Home';
import Kimlerİçin from "./pages/kimleriçin/Kimlerİçin";
import Özellikler from './pages/özelllikler/Özellikler';
import About from './pages/about/About';
import Fiyatlar from "./pages/fiyatlar/Fiyatlar";
import Ortaklıklar from "./pages/ortaklık/Ortaklıklar";
import Contact from './pages/contact/Contact';
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
function App() {
  return (
   <div>
         <Routes>
           <Route path="/" element={<Home/>} />
           <Route path="/kimleriçin" element={<Kimlerİçin/>} />
           <Route path="/özellikler" element={<Özellikler/>} />
           <Route path="/hakkımızda" element={<About/>} />
           <Route path="/fiyatlar" element={<Fiyatlar/>} />
           <Route path="/ortaklıklar" element={<Ortaklıklar/>} />
           <Route path="/iletişim" element={<Contact/>} />
           <Route path="/dashboard/:uid" element={<Dashboard/>}>
              <Route path='digital-menu' element={<DigitalMenu/>}/>
              <Route path='tanımlamalar' element={<Tanımlamalar/>}/>
              <Route path='sipariş' element={<Sipariş/>}/>
              <Route path='mutfak' element={<Mutfak/>}/>
              <Route path='işlemler' element={<İşlemler/>}/>
              <Route path='raporlar' element={<Raporlar/>}/>
              <Route path='kullanıcılar' element={<Kullanıcılar/>}/>
              <Route path='ayarlar' element={<Ayarlar/>}/>
           </Route>
           <Route path="/register" element={<Register/>} />
           <Route path="/login" element={<Login/>} />
         </Routes>
   </div>
  );  
}
export default App
