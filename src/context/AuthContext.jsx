import { createContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        if (token.split('.').length !== 3) throw new Error('Geçersiz token formatı');
        const decoded = jwtDecode(token);
        setUser({
          email: decoded.email,
          role: decoded.role,
          restaurant_id: decoded.restaurant_id,
        });
      } catch (err) {
        console.error('Token decode hatası:', err.message);
        localStorage.removeItem('token');
      }
    }
  }, []);

  const login = (userData, token) => {
    localStorage.setItem('token', token);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};