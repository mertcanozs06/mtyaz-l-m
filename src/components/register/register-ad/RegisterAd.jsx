import React from 'react'
import { useState } from 'react';
const RegisterAd = ({ name, value, onChange}) => {
  const [Ad , setAd] = useState(null);
 
  
  return (
     <div className='mb-3 w-full'>
        <input onChange={onChange} value={value} name={name}  className='w-full p-1.5 outline-none  border-b-2  ' type="text" placeholder="İsminizi ve Soyisminizi Giriniz" required />
    </div>
  )
}

export default RegisterAd