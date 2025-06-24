import React from 'react'
import { useState } from 'react';
const RegisterBusınessAd = ({ name, value, onChange }) =>{
  const [BusinessAd , setBusinessAd ] = useState(null);

  
  return (
     <div className='mb-3 w-full'>
        <input  onChange={onChange} value={value} name={name}    className='w-full p-1.5 outline-none  border-b-2  ' type="text" placeholder="İşletmenizin Adını Giriniz" required />
    </div>
  )
}

export default RegisterBusınessAd