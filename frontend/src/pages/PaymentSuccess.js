import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { CheckCircle, Loader2 } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [status, setStatus] = useState('checking');
  const [attempts, setAttempts] = useState(0);
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (sessionId && token) {
      pollPaymentStatus();
    }
  }, [sessionId, token]);

  const pollPaymentStatus = async () => {
    const maxAttempts = 5;
    
    if (attempts >= maxAttempts) {
      setStatus('timeout');
      return;
    }

    try {
      const response = await axios.get(`${API}/payments/status/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.payment_status === 'paid') {
        setStatus('success');
        setTimeout(() => navigate('/dashboard'), 3000);
      } else if (response.data.status === 'expired') {
        setStatus('expired');
      } else {
        setAttempts(prev => prev + 1);
        setTimeout(pollPaymentStatus, 2000);
      }
    } catch (error) {
      console.error('Error checking payment status:', error);
      setAttempts(prev => prev + 1);
      setTimeout(pollPaymentStatus, 2000);
    }
  };

  return (
    <div className="min-h-screen bg-obsidian flex items-center justify-center px-4">
      <div className="glass p-12 text-center max-w-md w-full animate-fade-in">
        {status === 'checking' && (
          <>
            <Loader2 className="w-16 h-16 text-gold mx-auto mb-6 animate-spin" />
            <h1 className="font-display text-2xl text-white mb-2">Processing Payment</h1>
            <p className="text-zinc-500">Please wait while we confirm your payment...</p>
          </>
        )}
        
        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-emerald-500/10 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-emerald-400" />
            </div>
            <h1 className="font-display text-2xl text-white mb-2">Payment Successful!</h1>
            <p className="text-zinc-500 mb-6">Thank you for your purchase. Redirecting...</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="btn-gold"
              data-testid="go-dashboard-btn"
            >
              Go to Dashboard
            </button>
          </>
        )}
        
        {status === 'expired' && (
          <>
            <h1 className="font-display text-2xl text-white mb-2">Payment Expired</h1>
            <p className="text-zinc-500 mb-6">The payment session has expired. Please try again.</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="btn-outline"
            >
              Return to Dashboard
            </button>
          </>
        )}
        
        {status === 'timeout' && (
          <>
            <h1 className="font-display text-2xl text-white mb-2">Verification Timeout</h1>
            <p className="text-zinc-500 mb-6">
              We couldn't verify your payment. If you were charged, please check your email for confirmation.
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              className="btn-outline"
            >
              Return to Dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default PaymentSuccess;
