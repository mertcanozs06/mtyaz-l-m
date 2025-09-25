import { Outlet } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../../context/AuthContext.jsx';
import Navbar from '../../components/Navbar';

const Dashboard = () => {
  const { user } = useContext(AuthContext);

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className={`pt-4 p-4 ${user?.role === 'admin' ? 'sm:pl-64' : ''}`}>
        <Outlet />
      </div>
    </div>
  );
};

export default Dashboard;
