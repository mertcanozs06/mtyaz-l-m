import React from 'react'

const LoginEmail = ({ name, value, onChange }) => {
  return (
    <div className='mb-3 w-full'>
        <input  onChange={onChange} name={name} value={value} className='w-full p-1.5 outline-none  border-b-2  ' type="email" placeholder="E-Mailinizi  giriniz" required />
    </div>
  )
}

export default LoginEmail