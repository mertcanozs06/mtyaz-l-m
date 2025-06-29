import React from 'react'
import { useState  } from 'react'
import { useNavigate } from 'react-router-dom'
import LoginLogo from '../../components/login/login-logo/LoginLogo'
import LoginHeader from '../../components/login/login-header/LoginHeader'
import LoginEmail from '../../components/login/login-email/LoginEmail'
import LoginPassword from '../../components/login/login-password/LoginPassword'
import LoginDikkat from '../../components/login/login-dikkat/LoginDikkat'
import LoginButton from '../../components/login/login-button/LoginButton'
import LoginBilgi from '../../components/login/login-bilgi/LoginBilgi'
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
const Login = () => {
   
  const [formData, setFormData] = useState({
      email: '',
      password: '',
    });
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    
     // Handle input changes
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };


   // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
   
   setError(null);
  try {
    const auth = getAuth();
    const userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password)
    const userId = userCredential.user.uid;
    console.log('User ID:', userId);
   navigate(`/dashboard/${userId}`);
   console.log('Navigate çağrıldı');
    
  } catch (error) {
     const errorCode = error.code ;
     const errorMessage = error.message;
  }

    console.log('Form submitted:', formData);
    // TODO: Send data to API or perform other actions
  };
  
  return (
  <div className='w-full min-h-screen flex items-center justify-center'>
      <div className='w-full max-w-md items-center justify-center p-10 text-white bg-sky-500'>
        <form onSubmit={handleSubmit}>
            <LoginLogo/>   
            <LoginHeader/>
            <LoginEmail
            value={formData.email}
            onChange={handleChange}
            name='email'
            />
            <LoginPassword
            value={formData.password}
            onChange={handleChange}
            name='password'
            />
            <LoginDikkat/>
            <LoginButton/>
            <LoginBilgi/>
        </form>
        </div>
    </div>
  )
}

export default Login