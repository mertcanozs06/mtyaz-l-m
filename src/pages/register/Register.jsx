// src/pages/register/Register.jsx
import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import RegisterLogo from '../../components/register/register-logo/RegisterLogo';
import RegisterHeader from '../../components/register/register-header/RegisterHeader';
import RegisterBusınessAd from '../../components/register/register-işletme-adı/RegisterBusınessAd';
import RegisterRestaurantName from '../../components/register/register-restaurant-name/RegisterRestaurantName';
import RegisterEmail from '../../components/register/register-email/RegisterEmail';
import RegisterTel from '../../components/register/register-tel/RegisterTel';
import RegisterPassword from '../../components/register/register-password/RegisterPassword';
import RegisterPasswordRepeat from '../../components/register/register-password-repeat/RegisterPasswordRepeat';
import RegisterMetin from '../../components/register/register-metin/RegisterMetin';
import RegisterButton from '../../components/register/register-button/RegisterButton';
import RegisterBilgi from '../../components/register/register-bilgi/RegisterBilgi';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    email: '',
    password: '',
    repeatPassword: '',
    restaurantName: '',
    check: false,
    package_type: '', // Varsayılan değer yok, kullanıcı seçecek
  });
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useContext(AuthContext);
  const { socket } = useContext(SocketContext);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsLoading(true);

    // İstemci tarafı validasyon
    if (!formData.name || !formData.email || !formData.password || !formData.restaurantName || !formData.phone || !formData.address || !formData.package_type) {
      setErrorMessage('Tüm zorunlu alanları doldurunuz.');
      setIsLoading(false);
      return;
    }
    if (!formData.check) {
      setErrorMessage('Kullanım şartlarını kabul etmelisiniz.');
      setIsLoading(false);
      return;
    }
    if (formData.password !== formData.repeatPassword) {
      setErrorMessage('Şifreler uyuşmuyor.');
      setIsLoading(false);
      return;
    }
    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      setErrorMessage('Geçerli bir email adresi giriniz.');
      setIsLoading(false);
      return;
    }
    if (formData.password.length < 6) {
      setErrorMessage('Şifre en az 6 karakter olmalı.');
      setIsLoading(false);
      return;
    }
    if (!/^\+?\d{10,15}$/.test(formData.phone)) {
      setErrorMessage('Geçerli bir telefon numarası giriniz.');
      setIsLoading(false);
      return;
    }
    if (!['base', 'package2', 'premium'].includes(formData.package_type)) {
      setErrorMessage('Geçerli bir paket türü seçiniz.');
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone,
          address: formData.address,
          email: formData.email,
          password: formData.password,
          restaurantName: formData.restaurantName,
          package_type: formData.package_type,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          throw new Error('Bu email adresi zaten kullanımda.');
        }
        throw new Error(data.message || 'Kayıt olunamadı.');
      }

      const decoded = jwtDecode(data.token);
      login(
        {
          email: decoded.email,
          role: decoded.role,
          restaurant_id: decoded.restaurant_id,
          branch_id: decoded.branch_id,
          user_id: decoded.user_id,
          package_type: data.package_type,
        },
        data.token,
        data.branches
      );

      if (socket) {
        const restaurantId = decoded.restaurant_id;
        const branchId = decoded.branch_id;
        socket.emit('join_owner', { restaurantId, branchId });
      }

      setSuccessMessage('Kayıt başarılı! Dashboard’a yönlendiriliyorsunuz...');
      setTimeout(() => {
        navigate(`/dashboard/${decoded.restaurant_id}/${decoded.branch_id}`);
      }, 2000);
    } catch (err) {
      console.error('Register error:', err);
      setErrorMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-md p-10 bg-sky-500 text-white rounded-lg shadow-lg">
        <form onSubmit={handleSubmit}>
          {errorMessage && (
            <div className="bg-red-100 text-red-600 p-4 rounded mb-4 text-center">
              {errorMessage}
            </div>
          )}
          {successMessage && (
            <div className="bg-green-100 text-green-600 p-4 rounded mb-4 text-center">
              {successMessage}
            </div>
          )}
          <RegisterLogo />
          <RegisterHeader />
          <RegisterBusınessAd
            value={formData.name}
            onChange={handleChange}
            name="name"
            label="İşletme Sahibi Adı"
            disabled={isLoading}
          />
          <RegisterRestaurantName
            value={formData.restaurantName}
            onChange={handleChange}
            name="restaurantName"
            label="Restoran Adı"
            disabled={isLoading}
          />
          <RegisterEmail
            value={formData.email}
            onChange={handleChange}
            name="email"
            label="Email"
            disabled={isLoading}
          />
          <RegisterTel
            value={formData.phone}
            onChange={handleChange}
            name="phone"
            label="Telefon"
            disabled={isLoading}
          />
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Adres</label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              className="w-full p-2 rounded bg-white text-black disabled:bg-gray-200"
              placeholder="Restoran adresi"
              disabled={isLoading}
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Paket Türü</label>
            <select
              name="package_type"
              value={formData.package_type}
              onChange={handleChange}
              className="w-full p-2 rounded bg-white text-black disabled:bg-gray-200"
              disabled={isLoading}
            >
              <option value="" disabled>Seçiniz</option>
              <option value="base">Temel (1 Şube)</option>
              <option value="package2">Orta (25 Şube)</option>
              <option value="premium">Premium (Sınırsız)</option>
            </select>
          </div>
          <RegisterPassword
            value={formData.password}
            onChange={handleChange}
            name="password"
            label="Şifre"
            disabled={isLoading}
          />
          <RegisterPasswordRepeat
            value={formData.repeatPassword}
            onChange={handleChange}
            name="repeatPassword"
            label="Şifreyi Tekrarla"
            disabled={isLoading}
          />
          <RegisterMetin
            checked={formData.check}
            onChange={handleChange}
            name="check"
            label="Kullanım şartlarını kabul ediyorum"
            disabled={isLoading}
          />
          <RegisterButton disabled={isLoading} />
          <RegisterBilgi />
        </form>
      </div>
    </div>
  );
};

export default Register;
