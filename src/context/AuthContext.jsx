// src/context/AuthContext.js

import { createContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      try {
        if (storedToken.split('.').length !== 3) throw new Error('Geçersiz token formatı');
        const decoded = jwtDecode(storedToken);
        setUser({
          email: decoded.email,
          role: decoded.role,
          restaurant_id: decoded.restaurant_id,
        });
        setToken(storedToken);
      } catch (err) {
        console.error('Token decode hatası:', err.message);
        localStorage.removeItem('token');
        setToken(null);
      }
    }
  }, []);

  const login = (userData, token) => {
    localStorage.setItem('token', token);
    setUser(userData);
    setToken(token);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
