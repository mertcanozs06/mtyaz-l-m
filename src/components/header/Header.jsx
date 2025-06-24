import React from 'react'
import Logo from './logo/Logo';
import Links from './links/Links';
import Navbar from './navbar/Navbar';
import { XMarkIcon } from '@heroicons/react/16/solid'
import { Bars3Icon } from '@heroicons/react/16/solid'
import { useState } from 'react'
const Header = () => {
  const [isOpen, setIsOpen] = useState(false); // Hamburger menü aç/kapa durumu
  
    const toggleMenu = () => {
      setIsOpen(!isOpen);
    };
  return (
    <div className="w-full h-20 p-4 flex items-center justify-between">
         <Logo/>
           <button
                   className=" block md:hidden focus:outline-none"
                   onClick={toggleMenu}
                   aria-label="Toggle menu"
                   >
                   {isOpen ? (
                     <XMarkIcon className="w-6 h-6" />
                   ) : (
                     <Bars3Icon className="w-6 h-6" />
                   )}
                 </button>
         
        <Navbar isOpen={isOpen}/>
        <Links isOpen={isOpen}/>
    </div>
  )
}

export default Header