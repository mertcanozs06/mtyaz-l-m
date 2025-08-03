import React from 'react'

const RegisterRestaurantName = ({value , name ,  onChange}) => {
  return (
    <div className='mb-3 w-full'>
        <input type="text" placeholder='Restaurant İsmini Giriniz' className='w-full p-1.5 outline-none  border-b-2  ' value={value} onChange={onChange} name={name} required />
    </div>
  )
}

export default RegisterRestaurantName