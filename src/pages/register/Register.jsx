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
import {  createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from '../../qrmenusistem'


const Register = () => {

  const [formData, setFormData] = useState({
    businessAd: '',
    ad: '',
    email: '',
    tel: '',
    password: '',
    repeatPassword: '',
    check: false,
  });

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
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      console.log('Kullanıcı oluşturuldu:', userCredential.user);
    } catch (error) {
      console.error('Hata:', error.code, error.message);
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