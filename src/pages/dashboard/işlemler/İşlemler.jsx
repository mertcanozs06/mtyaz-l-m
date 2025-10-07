import { useContext } from 'react';
import { useParams } from 'react-router-dom';
import { AuthContext } from '../../../context/AuthContext';

const İşlemler = () => {
  const { user, logout ,token } = useContext(AuthContext);
  const { restaurantid } = useParams();

  if (user.role !== 'admin') return null;

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">İşlemler</h2>
       
      </div>
      <p className="text-gray-500">Bu sekme henüz işlevsel değil. Gelecekte işlemler burada yer alacak.</p>
    </div>
  );
};

export default İşlemler;