import { useEffect, useState, useContext } from 'react';
import { Outlet, Navigate, useParams, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext.jsx';
import Navbar from '../../components/Navbar';

const Dashboard = () => {
  const { user, token, branches, selectedBranch, setSelectedBranch, package_type, updateUser, setBranches } = useContext(AuthContext);
  const { branchId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // Kullanıcı ve şube verilerini kontrol et
  useEffect(() => {
    const fetchBranches = async () => {
      if (!user || !token) {
        setErrorMessage('Kullanıcı veya token bilgisi eksik.');
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`http://localhost:5000/api/restaurant/${user.restaurant_id}/branches`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const errorData = await res.json();
          if (res.status === 401) {
            setErrorMessage('Oturumunuz sona erdi. Lütfen tekrar giriş yapın.');
            updateUser();
            navigate('/login');
            return;
          }
          throw new Error(errorData.message || 'Şubeler yüklenemedi.');
        }
        const data = await res.json();
        // X-New-Token kontrolü
        const newToken = res.headers.get('X-New-Token');
        if (newToken) {
          localStorage.setItem('token', newToken);
          updateUser();
        }
        // AuthContext'e şubeleri güncelle
        if (data.length && !branches.length) {
          setBranches(data);
          localStorage.setItem('branches', JSON.stringify(data));
          setSelectedBranch(data[0].id.toString()); // İlk şubeyi seç
        }
        setLoading(false);
      } catch (err) {
        setErrorMessage(err.message);
        setLoading(false);
      }
    };

    console.log('Fetching branches:', { user, branches, selectedBranch });
    fetchBranches();
  }, [user, token, branches, setSelectedBranch, navigate, updateUser, setBranches]);

  // Şube seçimi
  const handleBranchChange = (e) => {
    const newBranch = e.target.value;
    setSelectedBranch(newBranch);
    navigate(`/dashboard/${user.restaurant_id}/${newBranch}`);
  };

  // Kullanıcı giriş yapmamışsa login sayfasına yönlendir
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Yükleme durumu
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-gray-600">Yükleniyor...</div>
      </div>
    );
  }

  // Hata mesajı
  if (errorMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-red-100 text-red-600 p-4 rounded-md shadow-md max-w-md text-center">
          {errorMessage}
          <button
            className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            onClick={() => {
              setErrorMessage('');
              if (errorMessage.includes('Oturumunuz sona erdi')) {
                navigate('/login');
              }
            }}
          >
            Kapat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      {branches.length > 1 && (
        <div className="p-4 sm:pl-64">
          <label className="block text-sm font-medium mb-2">Şube Seç</label>
          <select
            value={selectedBranch || branchId || ''}
            onChange={handleBranchChange}
            className="w-full max-w-xs p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Şube Seçin</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id.toString()}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="pt-4 p-4 sm:pl-64">
        <Outlet context={{ restaurantId: user.restaurant_id, branchId: selectedBranch, package_type }} />
      </div>
    </div>
  );
};

export default Dashboard;

