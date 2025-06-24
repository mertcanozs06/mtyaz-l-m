import React from 'react'
import { NavLink } from 'react-router-dom'
const GirişYap = () => {
  return (
    <div>
      <NavLink to='/login'>
        <button className='h-full w-max md:p-4 p-2 cursor-pointer bg-orange-700 rounded-2xl '>GİRİŞ YAP</button>
      </NavLink>
    </div>
  )
}

export default GirişYap