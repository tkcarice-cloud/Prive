import { useNavigate } from 'react-router-dom';
import { XCircle } from 'lucide-react';

const PaymentCancel = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-obsidian flex items-center justify-center px-4">
      <div className="glass p-12 text-center max-w-md w-full animate-fade-in">
        <div className="w-16 h-16 bg-red-500/10 flex items-center justify-center mx-auto mb-6">
          <XCircle className="w-10 h-10 text-red-400" />
        </div>
        <h1 className="font-display text-2xl text-white mb-2">Payment Cancelled</h1>
        <p className="text-zinc-500 mb-6">
          Your payment was cancelled. No charges were made to your account.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="btn-gold"
            data-testid="try-again-btn"
          >
            Try Again
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="btn-outline"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentCancel;
