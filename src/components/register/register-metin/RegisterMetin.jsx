import React from 'react'
import { Link } from 'react-router-dom'
const RegisterMetin = ({ name, onChange, checked }) => {
  return (
    <div className='flex items-center  mb-5 '>
       <div className='flex items-center justify-between  gap-5'>
            <input 
            onChange={onChange} 
            name={name} 
            checked={checked} 
            type="checkbox"/>
            <span><Link to='/'>Kullanım Sözleşmesini</Link> ve <Link to='/'>Aydınlatma Metnini</Link> okudum kabul ediyorum.</span>
        </div>
    </div>
  )
}

export default RegisterMetin