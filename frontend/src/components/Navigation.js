import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Shield, 
  Home, 
  Compass, 
  MessageSquare, 
  Settings, 
  LogOut,
  User,
  LayoutDashboard,
  Lock
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';

const Navigation = () => {
  const { user, logout, isAuthenticated, isVerified, isCreator, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2" data-testid="nav-logo">
            <div className="w-8 h-8 bg-gold flex items-center justify-center">
              <span className="font-display text-black text-sm font-semibold">P</span>
            </div>
            <span className="font-display text-xl text-white tracking-tight">PRIVÉ</span>
          </Link>

          {/* Navigation Links */}
          {isAuthenticated && (
            <div className="hidden md:flex items-center gap-1">
              <Link
                to="/dashboard"
                data-testid="nav-dashboard"
                className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                  isActive('/dashboard') ? 'text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Home className="w-4 h-4" />
                <span>Home</span>
              </Link>
              <Link
                to="/discover"
                data-testid="nav-discover"
                className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                  isActive('/discover') ? 'text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Compass className="w-4 h-4" />
                <span>Discover</span>
              </Link>
              <Link
                to="/messages"
                data-testid="nav-messages"
                className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                  isActive('/messages') ? 'text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>Messages</span>
              </Link>
              {isCreator && (
                <Link
                  to="/creator-dashboard"
                  data-testid="nav-creator-dashboard"
                  className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                    isActive('/creator-dashboard') ? 'text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Studio</span>
                </Link>
              )}
              {isAdmin && (
                <Link
                  to="/admin"
                  data-testid="nav-admin"
                  className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                    isActive('/admin') ? 'text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  <span>Admin</span>
                </Link>
              )}
            </div>
          )}

          {/* Right Side */}
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                {/* Verification Status */}
                {!isVerified && (
                  <Link
                    to="/verify"
                    data-testid="nav-verify"
                    className="hidden sm:flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span className="uppercase tracking-wider">Verify</span>
                  </Link>
                )}
                {isVerified && (
                  <div className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-400">
                    <Shield className="w-3.5 h-3.5" />
                    <span className="uppercase tracking-wider font-mono">Verified</span>
                  </div>
                )}

                {/* User Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button 
                      className="flex items-center gap-2 outline-none"
                      data-testid="nav-user-menu"
                    >
                      <Avatar className="h-8 w-8 border border-white/10">
                        <AvatarImage src={user?.avatar_url} />
                        <AvatarFallback className="bg-zinc-800 text-zinc-400 text-xs">
                          {user?.username?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    align="end" 
                    className="w-56 bg-paper border-white/10"
                  >
                    <div className="px-3 py-2 border-b border-white/5">
                      <p className="text-sm text-white">{user?.display_name || user?.username}</p>
                      <p className="text-xs text-zinc-500 font-mono">@{user?.username}</p>
                    </div>
                    <DropdownMenuItem asChild>
                      <Link to="/settings" className="flex items-center gap-2" data-testid="menu-settings">
                        <Settings className="w-4 h-4" />
                        <span>Settings</span>
                      </Link>
                    </DropdownMenuItem>
                    {!isVerified && (
                      <DropdownMenuItem asChild>
                        <Link to="/verify" className="flex items-center gap-2 text-amber-400" data-testid="menu-verify">
                          <Lock className="w-4 h-4" />
                          <span>Verify Identity</span>
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator className="bg-white/5" />
                    <DropdownMenuItem 
                      onClick={handleLogout}
                      className="flex items-center gap-2 text-red-400 focus:text-red-400"
                      data-testid="menu-logout"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  to="/login"
                  data-testid="nav-login"
                  className="text-sm text-zinc-400 hover:text-white transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  data-testid="nav-register"
                  className="btn-gold text-xs py-2 px-4"
                >
                  Join Now
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
