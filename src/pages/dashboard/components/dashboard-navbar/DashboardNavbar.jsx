import React from 'react'
import { NavLink } from 'react-router-dom'
const DashboardNavbar = ({isOpen}) => {
  return (
    <div className={`${isOpen ? 'block' : 'hidden'} md:block  z-10  h-10 items-center gap-6 `}
        > 
        <ul className="flex  md:flex-col flex-row overflow-x-scroll   gap-2">
          
             <NavLink to='digital-menu'
                className={({ isActive }) =>
                  `hover:text-blue-300  ${isActive ? 'text-blue-400 ' : ''} `
                }
                 // Mobil menüde tıklanınca kapanır    
             >
              <li className='border border-amber-300 p-1 md:w-48 w-30      hover:bg-emerald-600 rounded-xl cursor-pointer'>
              QR MENÜ
              </li>
             </NavLink>
        

          
              <NavLink to='tanımlamalar'
                 className={({ isActive }) =>
                  `hover:text-blue-300 ${isActive ? 'text-blue-400' : ''}`
                }
                 // Mobil menüde tıklanınca kapanır    
              >
                <li className='border border-amber-300 p-1 hover:bg-emerald-600 rounded-xl cursor-pointer'>
              TANIMLAMALAR
              </li>
              </NavLink>
         

          
            <NavLink to='sipariş'
               className={({ isActive }) =>
                  `hover:text-blue-300 ${isActive ? 'text-blue-400' : ''}`
                }
                 // Mobil menüde tıklanınca kapanır    
            >
              <li className='border border-amber-300 p-1 hover:bg-emerald-600 rounded-xl cursor-pointer'>
              SİPARİŞLER
              </li>
            </NavLink>
          

          
            <NavLink to='mutfak'
               className={({ isActive }) =>
                  `hover:text-blue-300 ${isActive ? 'text-blue-400' : ''}`
                }
                 // Mobil menüde tıklanınca kapanır    
            >
              <li className='border border-amber-300 p-1 hover:bg-emerald-600 rounded-xl cursor-pointer'>
              MUTFAK 
              </li>
            </NavLink>
          
            
          
            <NavLink to='işlemler'
               className={({ isActive }) =>
                  `hover:text-blue-300 ${isActive ? 'text-blue-400' : ''}`
                }
                 // Mobil menüde tıklanınca kapanır
              
            >
              <li className='border border-amber-300 p-1 hover:bg-emerald-600 rounded-xl cursor-pointer'> 
              İŞLEMLER
              </li>
            </NavLink>
          
            
          
            <NavLink to='raporlar'
               className={({ isActive }) =>
                  `hover:text-blue-300 ${isActive ? 'text-blue-400' : ''}`
                }
                 // Mobil menüde tıklanınca kapanır
              
            >
              <li className='border border-amber-300 p-1 hover:bg-emerald-600 rounded-xl cursor-pointer'>
              RAPORLAR
              </li>
          </NavLink>
      

         
            <NavLink to='kullanıcılar'
               className={({ isActive }) =>
                  `hover:text-blue-300 ${isActive ? 'text-blue-400' : ''}`
                }>
             <li className='border border-amber-300 p-1 hover:bg-emerald-600 rounded-xl cursor-pointer'>
              KULLANICILAR
              </li>
          </NavLink>
        


         
            <NavLink to='ayarlar'
               className={({ isActive }) =>
                  `hover:text-blue-300 ${isActive ? 'text-blue-400' : ''}`
                }
                 // Mobil menüde tıklanınca kapanır
    
            >
              <li className='border border-amber-300 p-1 hover:bg-emerald-600 rounded-xl cursor-pointer'>
              AYARLAR 
              </li>
          </NavLink>
      
            
        </ul>
        
    </div>
  )
}

export default DashboardNavbar