import { Outlet } from 'react-router-dom';
import Navbar from '../../components/Navbar';

const Dashboard = () => {
  return (
    <div>
      <Navbar />
      <Outlet />
    </div>
  );
};

export default Dashboard;