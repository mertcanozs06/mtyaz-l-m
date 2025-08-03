import { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';

const PrivateRoute = ({ roles, children }) => {
  const { user } = useContext(AuthContext);

  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) {
    console.warn(`PrivateRoute: Kullanıcı rolü (${user.role}) yetkili değil`);
    return <Navigate to="/login" />;
  }

  return children;
};

export default PrivateRoute;
