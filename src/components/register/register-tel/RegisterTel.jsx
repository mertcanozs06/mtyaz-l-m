import React from 'react'

const RegisterTel = ({ name, value, onChange }) => {
  return (
    <div className='mb-3 w-full'>
        <input onChange={onChange} value={value} name={name} className='w-full p-1.5 outline-none  border-b-2  ' type="tel" placeholder="Telefon Numaranızı Giriniz" required />
    </div>
  )
}

export default RegisterTel