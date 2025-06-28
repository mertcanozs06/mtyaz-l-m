import React, { useEffect, useState} from 'react'
import { Outlet, useParams, useNavigate} from 'react-router-dom'
import DashboardLogo from './components/dashboard-logo/DashboardLogo'
import { XMarkIcon } from '@heroicons/react/16/solid'
import { Bars3Icon } from '@heroicons/react/16/solid'
import DashboardNavbar from './components/dashboard-navbar/DashboardNavbar'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../../qrmenusistem'
const Dashboard = () => {
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
    <div className='w-full h-screen flex flex-row '>
        <div className='w-48 h-full flex flex-col gap-5 '>
             <div className="flex items-center justify-between px-3">
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
                             </div>
            <DashboardNavbar isOpen={isOpen}/>
 
        </div>

        <div className='flex-1 h-full ml-10 '>
           <Outlet/>
        </div>
    </div>
  )
}

export default Dashboard