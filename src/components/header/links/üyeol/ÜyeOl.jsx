import React from 'react'
import { NavLink } from 'react-router-dom'
const ÜyeOl = () => {
  return (
    <div>
      <NavLink to='/register'>
        <button className='h-full w-max  md:p-4 p-2 cursor-pointer bg-orange-700 rounded-2xl '>ÜYE OL </button>
      </NavLink>
    </div>
  )
}

export default ÜyeOl