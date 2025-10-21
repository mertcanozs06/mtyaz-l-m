import { useContext, useState, useEffect } from 'react';
import { Navigate, useParams, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';

const PrivateRoute = ({ roles, allowedPackages, children }) => {
  const { user, branches, package_type, token, logout } = useContext(AuthContext);
  const { restaurantId, branchId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(true);

  // Kullanıcı ve şube verilerini kontrol et
  useEffect(() => {
    const checkAuthorization = async () => {
      if (!user || !token) {
        setErrorMessage('Giriş yapmanız gerekiyor.');
        setLoading(false);
        return;
      }

      // Restoran ID kontrolü
      if (restaurantId && user.restaurant_id !== parseInt(restaurantId)) {
        setErrorMessage('Bu restorana erişim yetkiniz yok.');
        setLoading(false);
        return;
      }

      // Şube kontrolü
      if (branchId && !branches.some((b) => b.id === parseInt(branchId))) {
        setErrorMessage('Bu şubeye erişim yetkiniz yok.');
        setLoading(false);
        return;
      }

      // Rol kontrolü
      if (roles && !roles.includes(user.role)) {
        setErrorMessage(`Yetkisiz erişim: ${user.role} rolü bu sayfaya erişemez.`);
        setLoading(false);
        return;
      }

      // Paket kontrolü
      if (allowedPackages && !allowedPackages.includes(package_type)) {
        setErrorMessage(`Bu özellik ${allowedPackages.join(', ')} paketlerinde kullanılabilir.`);
        setLoading(false);
        return;
      }

      setLoading(false);
    };

    if (branches && branches.length > 0) {
      checkAuthorization();
    } else {
      setLoading(false);
    }
  }, [user, branches, package_type, token, restaurantId, branchId, roles, allowedPackages]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-gray-600">Yükleniyor...</div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-red-100 text-red-600 p-4 rounded-md shadow-md max-w-md text-center">
          {errorMessage}
          <button
            className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            onClick={() => {
              if (errorMessage.includes('Giriş yapmanız gerekiyor')) {
                logout();
                navigate('/login');
              } else {
                navigate('/dashboard');
              }
            }}
          >
            {errorMessage.includes('Giriş yapmanız gerekiyor') ? 'Giriş Sayfasına Dön' : 'Geri Dön'}
          </button>
        </div>
      </div>
    );
  }

  return children;
};

export default PrivateRoute;
