import React, { useState } from 'react';
import Logo from './logo/Logo';
import Links from './links/Links';
import Navbar from './navbar/Navbar';
import { XMarkIcon, Bars3Icon } from '@heroicons/react/16/solid';

const Header = () => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => setIsOpen(!isOpen);

  return (
    <>
      <header className="w-full flex-wrap    h-25  p-4 flex items-center justify-between bg-white mb-2 ">
        <Logo />

        {/* Hamburger Buton - sadece mobilde görünür */}
        <button
          className="block md:hidden focus:outline-none flex-shrink-0"
          onClick={toggleMenu}
          aria-label="Toggle menu"
        >
          {isOpen ? (
            <XMarkIcon className="w-6 h-6" />
          ) : (
            <Bars3Icon className="w-6 h-6" />
          )}
        </button>

        {/* Navbar - masaüstünde görünür, mobilde gizli */}
        <nav className="hidden md:flex">
          <Navbar />
        </nav>

        {/* Links - masaüstünde ve mobilde hep görünür */}
        <div>
          <Links />
        </div>
      </header>

      {/* Mobilde hamburger menü açıkken navbar göster */}
      {isOpen && (
        <div className="md:hidden w-full bg-white border-t border-gray-200 px-4 py-4">
          <Navbar isOpen={isOpen}/>
        </div>
      )}
    </>
  );
};

export default Header;

