import React from 'react'
import { NavLink } from 'react-router-dom'

const Navbar = ({isOpen}) => {
  
  return (
    <div className={`${
            isOpen ? 'block' : 'hidden'
          } z-10 md:flex md:items-center md:gap-6 w-full md:w-auto absolute md:static top-20 left-0 bg-blue-300 md:bg-transparent py-2 md:p-0 transition-all duration-300`}
        > 
        <ul className="flex flex-col md:flex-row gap-4 md:gap-6">
          <li>
             <NavLink to='/kimleriçin'
                className={({ isActive }) =>
                  `hover:text-blue-300  ${isActive ? 'text-blue-400' : ''} `
                }
                onClick={() => setIsOpen(false)} // Mobil menüde tıklanınca kapanır
              
             >
              Kimler İçin
             </NavLink>
          </li>

          <li>
              <NavLink to='/özellikler'
                 className={({ isActive }) =>
                  `hover:text-blue-300 ${isActive ? 'text-blue-400' : ''}`
                }
                onClick={() => setIsOpen(false)} // Mobil menüde tıklanınca kapanır
              
              
              >
              Özellikler
              </NavLink>
          </li>

          <li>
            <NavLink to='/hakkımızda'
               className={({ isActive }) =>
                  `hover:text-blue-300 ${isActive ? 'text-blue-400' : ''}`
                }
                onClick={() => setIsOpen(false)} // Mobil menüde tıklanınca kapanır
              
            >
              Hakkımızda
            </NavLink>
          </li>

          <li>
            <NavLink to='/fiyatlar'
               className={({ isActive }) =>
                  `hover:text-blue-300 ${isActive ? 'text-blue-400' : ''}`
                }
                onClick={() => setIsOpen(false)} // Mobil menüde tıklanınca kapanır
              
            >
              Fiyatlar
            </NavLink>
          </li>
            
          <li>
            <NavLink to='/ortaklıklar'
               className={({ isActive }) =>
                  `hover:text-blue-300 ${isActive ? 'text-blue-400' : ''}`
                }
                onClick={() => setIsOpen(false)} // Mobil menüde tıklanınca kapanır
              
            >
              Ortaklıklar
            </NavLink>
          </li>
            
          <li className='hover:bg-red-500 md:hover:bg-transparent'>
            <NavLink to='/iletişim'
               className={({ isActive }) =>
                  `hover:text-blue-300 ${isActive ? 'text-blue-400 ' : ''}`
                }
                onClick={() => setIsOpen(false)} // Mobil menüde tıklanınca kapanır
              
            >
              İletişim
          </NavLink>
        </li>
            
        </ul>
    </div>
  )
}

export default Navbar