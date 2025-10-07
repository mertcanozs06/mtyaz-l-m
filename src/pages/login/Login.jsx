// src/pages/login/Login.jsx
import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
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
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useContext(AuthContext);
  const { socket } = useContext(SocketContext);
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
    setErrorMessage('');
    setSuccessMessage('');
    setIsLoading(true);

    if (!formData.email || !formData.password) {
      setErrorMessage('E-posta ve şifre alanlarını doldurunuz.');
      setIsLoading(false);
      return;
    }
    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      setErrorMessage('Geçerli bir email adresi giriniz.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403 && data.message.includes('Ücretsiz deneme süreniz sona erdi')) {
          setErrorMessage('Ücretsiz deneme süreniz sona erdi. Kayıt sayfasına yönlendiriliyorsunuz...');
          setTimeout(() => navigate('/register'), 3000);
          return;
        }
        throw new Error(data.message || 'Giriş başarısız.');
      }

      if (!data.branches || data.branches.length === 0) {
        throw new Error('Bu restorana ait şube bulunamadı.');
      }

      const decoded = jwtDecode(data.token);
      const branchId = decoded.branch_id || data.branches[0].id;

      // AuthContext'e kullanıcıyı aktar
      login(
        {
          email: decoded.email,
          role: decoded.role,
          restaurant_id: decoded.restaurant_id,
          branch_id: branchId,
          user_id: decoded.user_id,
          package_type: data.package_type,
        },
        data.token,
        data.branches
      );

      // Socket odalarına katılım
      if (socket) {
        const restaurantId = decoded.restaurant_id;

        if (decoded.role === 'admin') {
          socket.emit('join_admin', { restaurantId, branchId });
        } else if (decoded.role === 'owner') {
          socket.emit('join_owner', { restaurantId, branchId });
        } else if (decoded.role === 'waiter') {
          socket.emit('join-restaurant', { restaurantId, branchId });
        } else if (decoded.role === 'kitchen') {
          socket.emit('join_kitchen', { restaurantId, branchId });
        }
      }

      setSuccessMessage('Giriş başarılı! Yönlendiriliyorsunuz...');
      setTimeout(() => {
        if (decoded.role === 'waiter') {
          navigate(`/dashboard/${decoded.restaurant_id}/${branchId}/waiter`);
        } else if (decoded.role === 'kitchen') {
          navigate(`/dashboard/${decoded.restaurant_id}/${branchId}/kitchen`);
        } else {
          navigate(`/dashboard/${decoded.restaurant_id}/${branchId}`);
        }
      }, 2000);
    } catch (error) {
      console.error('Login error:', error);
      setErrorMessage(`Giriş başarısız: ${error.message}`);
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
          <LoginLogo />
          <LoginHeader />
          <LoginEmail
            value={formData.email}
            onChange={handleChange}
            name="email"
            disabled={isLoading}
          />
          <LoginPassword
            value={formData.password}
            onChange={handleChange}
            name="password"
            disabled={isLoading}
          />
          <LoginDikkat />
          <LoginButton disabled={isLoading} />
          <LoginBilgi />
        </form>
      </div>
    </div>
  );
};

export default Login;
