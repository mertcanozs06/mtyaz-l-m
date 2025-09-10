import React, { useState } from 'react'
import RegisterLogo from '../../components/register/register-logo/RegisterLogo'
import RegisterHeader from '../../components/register/register-header/RegisterHeader'
import RegisterBusınessAd from '../../components/register/register-işletme-adı/RegisterBusınessAd'
import RegisterAd from '../../components/register/register-ad/RegisterAd'
import RegisterTel from '../../components/register/register-tel/RegisterTel'
import RegisterEmail from '../../components/register/register-email/RegisterEmail'
import LoginPassword from '../../components/login/login-password/LoginPassword'
import RegisterPassword from '../../components/register/register-password/RegisterPassword'
import RegisterPasswordRepeat from '../../components/register/register-password-repeat/RegisterPasswordRepeat'
import RegisterMetin from '../../components/register/register-metin/RegisterMetin'
import RegisterButton from '../../components/register/register-button/RegisterButton'
import RegisterBilgi from '../../components/register/register-bilgi/RegisterBilgi'
import RegisterRestaurantName from '../../components/register/register-restaurant-name/RegisterRestaurantName'
import { useNavigate } from 'react-router-dom'



const Register = () => {
 
  const [formData, setFormData] = useState({
    businessAd: '',
    ad: '',
    email: '',
    tel: '',
    password: '',
    repeatPassword: '',
    check: false,
    restaurantName:''
  });
  const navigate = useNavigate();

   // Handle input changes
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

   // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    // Basic validation
    if (formData.password !== formData.repeatPassword) {
      alert('Şifreler Uyuşmuyor! Lütfen Doğru Şifre Giriniz...');
      return;
    }
    try {
      const res = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({restaurantName: formData.restaurantName, email : formData.email, password : formData.password

         }),
      });
      const data = await res.json();
      console.log('Server response:', data);
      if (!res.ok) throw new Error(data.message);
       alert('Kayıt Başarılı bir şekilde oluştu.')
    } catch (err) {
      alert('Kayıt olunamadı: ' + err.message);
    }
   // Add more validation as needed (e.g., email format, required fields)
    console.log('Form submitted:', formData);
    // TODO: Send data to API or perform other actions
  };

 
  return (
    <div className='w-full min-h-screen flex items-center justify-center'>
      <div  className='w-full max-w-md items-center justify-center p-10 text-white bg-sky-500'>
        <form  onSubmit={handleSubmit}>
            <RegisterLogo/>   
            <RegisterHeader/>
            <RegisterBusınessAd 
            value={formData.businessAd}
            onChange={handleChange}
            name="businessAd"
            />
            <RegisterAd 
            value={formData.ad} 
            onChange={handleChange} 
            name="ad"/>
            <RegisterEmail
            value={formData.email}
            onChange={handleChange}
            name="email"
            />

            <RegisterRestaurantName
             value={formData.restaurantName}
             onChange={handleChange}
             name="restaurantName"           
            />

            
            <RegisterTel
            value={formData.tel}
            onChange={handleChange}
            name="tel"/>
            <RegisterPassword
            value={formData.password}
            onChange={handleChange}
            name="password"
            />
            <RegisterPasswordRepeat
            value={formData.repeatPassword}
            onChange={handleChange}
            name="repeatPassword"
            />
            <RegisterMetin
            checked={formData.check}
            onChange={handleChange}
            name="check"
            />
            <RegisterButton/>
            <RegisterBilgi/>
        </form>
      </div>
    </div>
  )
}

export default Register