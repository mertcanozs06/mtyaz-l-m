import React from 'react'
import { Link } from 'react-router-dom'
const LoginDikkat = () => {
  return (
    <div className='flex items-center justify-between mb-5 '>
        <div className='flex items-center gap-2'>
            <input type="checkbox"/>
            <h2>Beni Hatırla</h2>
        </div>

        <div>
            <Link to='/'><h2>Şifremi Unuttum</h2></Link>
        </div>
    </div>
  )
}

export default LoginDikkat