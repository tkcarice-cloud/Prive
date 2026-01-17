import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { Loader2, Shield, Eye, EyeOff, User, Star } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

const Register = () => {
  const [searchParams] = useSearchParams();
  const initialRole = searchParams.get('role') === 'creator' ? 'creator' : 'user';
  
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState(initialRole);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email || !username || !password || !confirmPassword) {
      toast.error('Please fill in all fields');
      return;
    }
    
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      await register(email, username, password, role);
      toast.success('Account created! Please verify your identity.');
      navigate('/verify');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-obsidian flex">
      {/* Left Side - Visual */}
      <div className="hidden lg:block lg:w-1/2 relative">
        <div className="absolute inset-0 bg-gradient-to-r from-obsidian via-obsidian/80 to-transparent z-10" />
        <img
          src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1200&q=80"
          alt="Join PRIVÉ"
          className="w-full h-full object-cover"
        />
        <div className="absolute top-16 left-16 right-16 z-20">
          <h2 className="font-display text-4xl text-white mb-4">Join the Inner Circle</h2>
          <p className="text-zinc-400 leading-relaxed">
            Experience premium creator content through encrypted channels. 
            Verification required for access.
          </p>
        </div>
      </div>

      {/* Right Side - Form */}
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
            <h1 className="font-display text-3xl text-white mb-2">Create Account</h1>
            <p className="text-zinc-500">Start your verified journey</p>
          </div>

          {/* Role Selection */}
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setRole('user')}
              className={`p-4 border transition-all ${
                role === 'user' 
                  ? 'border-gold bg-gold/10' 
                  : 'border-white/10 hover:border-white/20'
              }`}
              data-testid="role-user"
            >
              <User className={`w-5 h-5 mx-auto mb-2 ${role === 'user' ? 'text-gold' : 'text-zinc-500'}`} />
              <p className={`text-sm ${role === 'user' ? 'text-white' : 'text-zinc-400'}`}>Member</p>
              <p className="text-xs text-zinc-600 mt-1">Access exclusive content</p>
            </button>
            <button
              type="button"
              onClick={() => setRole('creator')}
              className={`p-4 border transition-all ${
                role === 'creator' 
                  ? 'border-gold bg-gold/10' 
                  : 'border-white/10 hover:border-white/20'
              }`}
              data-testid="role-creator"
            >
              <Star className={`w-5 h-5 mx-auto mb-2 ${role === 'creator' ? 'text-gold' : 'text-zinc-500'}`} />
              <p className={`text-sm ${role === 'creator' ? 'text-white' : 'text-zinc-400'}`}>Creator</p>
              <p className="text-xs text-zinc-600 mt-1">Earn 75% revenue</p>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
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
                data-testid="register-email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="username" className="text-zinc-400 text-xs uppercase tracking-wider">
                Username
              </Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="your_username"
                className="input-dark"
                data-testid="register-username"
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
                  placeholder="Min. 8 characters"
                  className="input-dark pr-10"
                  data-testid="register-password"
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

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-zinc-400 text-xs uppercase tracking-wider">
                Confirm Password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="input-dark"
                data-testid="register-confirm-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-gold w-full flex items-center justify-center gap-2"
              data-testid="register-submit"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Shield className="w-4 h-4" />
                  <span>Create Secure Account</span>
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-zinc-500">
            Already have an account?{' '}
            <Link to="/login" className="text-gold hover:text-gold-hover transition-colors">
              Sign In
            </Link>
          </p>

          <p className="text-xs text-zinc-600 text-center">
            By creating an account, you agree to our Terms of Service and Privacy Policy. 
            Identity verification will be required for full access.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
