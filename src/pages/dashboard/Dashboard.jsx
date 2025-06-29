import React, { useEffect, useState} from 'react'
import { Outlet, useParams, useNavigate, NavLink} from 'react-router-dom'
import DashboardLogo from './components/dashboard-logo/DashboardLogo'
import { XMarkIcon } from '@heroicons/react/16/solid'
import { Bars3Icon } from '@heroicons/react/16/solid'
import DashboardNavbar from './components/dashboard-navbar/DashboardNavbar'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../../qrmenusistem'
import { getAuth, signOut } from "firebase/auth";
const Dashboard = () => {
  

const auth = getAuth();


    const [isOpen, setIsOpen] = useState(false); // Hamburger menü aç/kapa durumu
     
       const toggleMenu = () => {
         setIsOpen(!isOpen);
       }; 

   const[user , setUser] = useState(undefined)
   const {uid} = useParams();
   const navigate = useNavigate();
   useEffect(()=>{
   const unsubscribe = onAuthStateChanged(auth , (user)=>{
       if (user && user.uid === uid) {
         setUser(user); // sadece set et
} else {
  navigate('/login');
    }
   });
    return () => unsubscribe();
   }, [uid,navigate]);
   
   
     
  return (
    <div className='w-full h-screen flex md:flex-row flex-col '>
        <div className='md:w-48 w-full h-30 flex flex-col gap-5 '>
             <div className="flex items-center justify-between w-full h-10 md:px-0 md:py-0 px-3 py-3">
            <DashboardLogo/>
            <button
                               className=" block md:hidden focus:outline-none "
                               onClick={toggleMenu}
                               aria-label="Toggle menu"
                               >
                               {isOpen ? (
                                 <XMarkIcon className="w-6 h-6" />
                               ) : (
                                 <Bars3Icon className="w-6 h-6" />
                               )}
                             </button>
                             
                             
                             <button
                             className='border-2 border-red-800 cursor-pointer p-2 text-amber-500'  
                             
                             onClick={()=> {
                                const userOut = signOut(auth)
                                 if (userOut) {
                                   navigate("/") 
                                 }
                                 else {
                                   console.log("Çıkışta hata oldu...");
                                 }
                                                              
                             }}>
                                 Çıkış Yap
                             </button>
                            

                             </div>
            <DashboardNavbar isOpen={isOpen}/>
 
        </div>

        

        <div className='flex-1 h-full md:ml-10 ml-0 '>
           <Outlet/>
        </div>
    </div>
  )
}

export default Dashboard