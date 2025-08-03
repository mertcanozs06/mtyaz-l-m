import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode'; // 🔹 Bunu eklemeyi UNUTMA
import { AuthContext } from '../../context/AuthContext';

import LoginLogo from '../../components/login/login-logo/LoginLogo';
import LoginHeader from '../../components/login/login-header/LoginHeader';
import LoginEmail from '../../components/login/login-email/LoginEmail';
import LoginPassword from '../../components/login/login-password/LoginPassword';
import LoginDikkat from '../../components/login/login-dikkat/LoginDikkat';
import LoginButton from '../../components/login/login-button/LoginButton';
import LoginBilgi from '../../components/login/login-bilgi/LoginBilgi';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.message);

      const decoded = jwtDecode(data.token);
      console.log('Decoded token:', decoded); // ✅ Debug için geçici log

      login(
        {
          email: decoded.email,
          role: decoded.role,
          restaurant_id: decoded.restaurant_id,
        },
        data.token
      );

      // Rol bazlı yönlendirme
      if (decoded.role === 'waiter') {
        navigate(`/dashboard/${decoded.restaurant_id}/waiter`);
      } else if (decoded.role === 'kitchen') {
        navigate(`/dashboard/${decoded.restaurant_id}/kitchen`);
      } else {
        navigate(`/dashboard/${decoded.restaurant_id}`);
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('Giriş başarısız: ' + error.message);
    }
  };

  return (
    <div className="w-full min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md items-center justify-center p-10 text-white bg-sky-500">
        <form onSubmit={handleSubmit}>
          <LoginLogo />
          <LoginHeader />
          <LoginEmail
            value={formData.email}
            onChange={handleChange}
            name="email"
          />
          <LoginPassword
            value={formData.password}
            onChange={handleChange}
            name="password"
          />
          <LoginDikkat />
          <LoginButton />
          <LoginBilgi />
        </form>
      </div>
    </div>
  );
};

export default Login;
