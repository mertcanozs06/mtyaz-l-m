import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const Payment = () => {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      // Handle payment callback or display payment form
      // For now, redirect to success or handle accordingly
      window.location.href = `${import.meta.env.VITE_FRONTEND_URL || 'http://localhost:5173'}/success`;
    } else {
      setError('Payment token not found');
      setLoading(false);
    }
  }, [searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Payment processing...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p>Payment completed successfully!</p>
    </div>
  );
};

export default Payment;
