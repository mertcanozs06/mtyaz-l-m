import React from 'react'

const RegisterPassword = ({ name, value, onChange }) => {
  return (
    <div className='mb-5 w-full' >
        <input onChange={onChange} value={value} name={name} className='w-full p-1.5 outline-none  border-b-2  ' type="password" placeholder='Şifrenizi giriniz' required />
    </div>
  )
}

export default RegisterPassword