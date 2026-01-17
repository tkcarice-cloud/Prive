import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { Loader2, Shield, Eye, EyeOff } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/dashboard';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const user = await login(email, password);
      toast.success(`Welcome back, ${user.display_name || user.username}`);
      
      // Redirect based on role
      if (user.role === 'admin') {
        navigate('/admin');
      } else if (user.role === 'creator') {
        navigate('/creator-dashboard');
      } else {
        navigate(from);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-obsidian flex">
      {/* Left Side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          {/* Logo */}
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 bg-gold flex items-center justify-center">
              <span className="font-display text-black text-lg font-semibold">P</span>
            </div>
            <span className="font-display text-2xl text-white tracking-tight">PRIVÉ</span>
          </Link>

          <div>
            <h1 className="font-display text-3xl text-white mb-2">Welcome Back</h1>
            <p className="text-zinc-500">Sign in to your encrypted account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-zinc-400 text-xs uppercase tracking-wider">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="input-dark"
                data-testid="login-email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-zinc-400 text-xs uppercase tracking-wider">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-dark pr-10"
                  data-testid="login-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-gold w-full flex items-center justify-center gap-2"
              data-testid="login-submit"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Shield className="w-4 h-4" />
                  <span>Sign In Securely</span>
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-zinc-500">
            Don't have an account?{' '}
            <Link to="/register" className="text-gold hover:text-gold-hover transition-colors">
              Apply to Join
            </Link>
          </p>

          {/* Security Note */}
          <div className="flex items-center gap-2 text-xs text-emerald-400/70 justify-center">
            <Shield className="w-3.5 h-3.5" />
            <span className="font-mono">Secured with AES-256 encryption</span>
          </div>
        </div>
      </div>

      {/* Right Side - Visual */}
      <div className="hidden lg:block lg:w-1/2 relative">
        <div className="absolute inset-0 bg-gradient-to-l from-obsidian via-obsidian/80 to-transparent z-10" />
        <img
          src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=1200&q=80"
          alt="Secure Access"
          className="w-full h-full object-cover"
        />
        <div className="absolute bottom-16 left-16 right-16 z-20">
          <blockquote className="text-lg text-white/80 italic font-display">
            "Finally, a platform that respects both creators and patrons. 
            The encryption gives me peace of mind."
          </blockquote>
          <p className="mt-4 text-sm text-zinc-500">— Verified Elite Creator</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
