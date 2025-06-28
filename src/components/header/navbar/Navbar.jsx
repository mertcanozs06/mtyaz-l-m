import React from 'react'
import { NavLink } from 'react-router-dom'

const Navbar = ({isOpen}) => {
  
  return (
    <div className={`${
            isOpen ? 'block' : 'hidden'
          } z-10 md:flex md:items-center md:gap-6 w-full md:w-auto absolute md:static top-20 left-0 bg-blue-300 md:bg-transparent py-0 md:p-0 transition-all duration-300`}
        > 
        <ul className="flex flex-col md:flex-row gap-1 md:gap-6">
          <NavLink to='/kimleriçin'
                className={({ isActive }) =>
                  `hover:text-blue-300  ${isActive ? 'text-blue-400' : ''} `
                }
                onClick={() => setIsOpen(false)} // Mobil menüde tıklanınca kapanır
              
             >
          <li className='border-2 md:border-none rounded py-2'>
              Kimler İçin
          </li>
          </NavLink>


           <NavLink to='/özellikler'
                 className={({ isActive }) =>
                  `hover:text-blue-300 ${isActive ? 'text-blue-400' : ''}`
                }
                onClick={() => setIsOpen(false)} // Mobil menüde tıklanınca kapanır
              >
          <li className='border-2 md:border-none rounded py-2'>
              Özellikler
          </li>
          </NavLink>


          <NavLink to='/hakkımızda'
               className={({ isActive }) =>
                  `hover:text-blue-300 ${isActive ? 'text-blue-400' : ''}`
                }
                onClick={() => setIsOpen(false)} // Mobil menüde tıklanınca kapanır
              
            >
          <li className='border-2 md:border-none rounded py-2'>
              Hakkımızda
          </li>
          </NavLink>

          <NavLink to='/fiyatlar'
               className={({ isActive }) =>
                  `hover:text-blue-300 ${isActive ? 'text-blue-400' : ''}`
                }
                onClick={() => setIsOpen(false)} // Mobil menüde tıklanınca kapanır
              
            >
          <li className='border-2 md:border-none rounded py-2'>
              Fiyatlar
          </li>
            </NavLink> 
            

          <NavLink to='/ortaklıklar'
               className={({ isActive }) =>
                  `hover:text-blue-300 ${isActive ? 'text-blue-400' : ''}`
                }
                onClick={() => setIsOpen(false)} // Mobil menüde tıklanınca kapanır
              
            >
          <li className='border-2 rounded md:border-none py-2'>
              Ortaklıklar
          </li>
          </NavLink>
          
          <NavLink to='/iletişim'
               className={({ isActive }) =>
                  `hover:text-blue-300  ${isActive ? 'text-blue-400 ' : ''}`
                }
                onClick={() => setIsOpen(false)} // Mobil menüde tıklanınca kapanır
              
            >
          <li className='border-2 md:border-none rounded  py-2 '>
              İletişim
        </li>
        </NavLink>
            
        </ul>
    </div>
  )
}

export default Navbar