import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import Navigation from '../components/Navigation';
import { 
  Shield, 
  Lock, 
  MessageSquare, 
  Heart,
  Compass,
  AlertCircle
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Dashboard = () => {
  const { user, token, isVerified, isCreator } = useAuth();
  const [feed, setFeed] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [feedRes, subsRes] = await Promise.all([
        axios.get(`${API}/content/feed?limit=20`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: [] })),
        axios.get(`${API}/subscriptions`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: [] }))
      ]);
      setFeed(feedRes.data);
      setSubscriptions(subsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-obsidian">
      <Navigation />
      
      <div className="max-w-6xl mx-auto px-4 pt-24 pb-16">
        {/* Welcome Header */}
        <div className="mb-8 animate-fade-in">
          <h1 className="font-display text-3xl text-white mb-2">
            Welcome back, {user?.display_name || user?.username}
          </h1>
          <p className="text-zinc-500">Your private dashboard</p>
        </div>

        {/* Verification Warning */}
        {!isVerified && (
          <div className="glass border-amber-500/30 p-4 mb-8 flex items-center gap-4 animate-fade-in">
            <div className="w-10 h-10 bg-amber-500/10 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-white">Complete identity verification</p>
              <p className="text-xs text-zinc-500">Unlock messaging, payments, and premium content</p>
            </div>
            <Link to="/verify" className="btn-gold text-xs py-2 px-4" data-testid="verify-cta">
              Verify Now
            </Link>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="glass p-4 text-center">
                <p className="text-2xl font-display text-white">{subscriptions.length}</p>
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Subscriptions</p>
              </div>
              <div className="glass p-4 text-center">
                <div className="flex items-center justify-center gap-1 text-emerald-400">
                  <Shield className="w-4 h-4" />
                  <span className="text-lg font-mono">{isVerified ? 'Yes' : 'No'}</span>
                </div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Verified</p>
              </div>
              <div className="glass p-4 text-center">
                <div className="flex items-center justify-center gap-1 text-gold">
                  <Lock className="w-4 h-4" />
                  <span className="text-lg font-mono">E2EE</span>
                </div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Encrypted</p>
              </div>
            </div>

            {/* Content Feed */}
            <div className="space-y-4">
              <h2 className="text-lg text-white flex items-center gap-2">
                <Heart className="w-5 h-5 text-gold" />
                Your Feed
              </h2>
              
              {loading ? (
                <div className="glass p-8 text-center">
                  <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-zinc-500">Loading your feed...</p>
                </div>
              ) : feed.length > 0 ? (
                <div className="space-y-4">
                  {feed.map((content) => (
                    <div key={content.id} className="glass p-4" data-testid={`feed-item-${content.id}`}>
                      <div className="flex items-center gap-3 mb-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-zinc-800">C</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm text-white">{content.title}</p>
                          <p className="text-xs text-zinc-500">{new Date(content.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      {content.is_unlocked ? (
                        content.media_urls?.length > 0 && (
                          <img 
                            src={content.media_urls[0]} 
                            alt={content.title}
                            className="w-full h-64 object-cover"
                          />
                        )
                      ) : (
                        <div className="relative">
                          <div className="w-full h-64 bg-zinc-800 flex items-center justify-center">
                            <Lock className="w-8 h-8 text-zinc-600" />
                          </div>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <button className="btn-gold text-xs">
                              Unlock for ${content.price}
                            </button>
                          </div>
                        </div>
                      )}
                      {content.description && (
                        <p className="text-sm text-zinc-400 mt-3">{content.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="glass p-8 text-center">
                  <Compass className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                  <h3 className="text-lg text-white mb-2">Your feed is empty</h3>
                  <p className="text-sm text-zinc-500 mb-6">
                    Subscribe to creators to see their content here
                  </p>
                  <Link to="/discover" className="btn-gold" data-testid="discover-btn">
                    Discover Creators
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Active Subscriptions */}
            <div className="glass p-6">
              <h3 className="text-sm text-white uppercase tracking-wider mb-4">
                Active Subscriptions
              </h3>
              {subscriptions.length > 0 ? (
                <div className="space-y-3">
                  {subscriptions.map((sub) => (
                    <Link
                      key={sub.id}
                      to={`/creator/${sub.creator_id}`}
                      className="flex items-center gap-3 p-2 hover:bg-white/5 transition-colors"
                      data-testid={`subscription-${sub.id}`}
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={sub.creator?.avatar_url} />
                        <AvatarFallback className="bg-zinc-800">
                          {sub.creator?.display_name?.charAt(0) || 'C'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">
                          {sub.creator?.display_name}
                        </p>
                        <p className="text-xs text-zinc-500">
                          ${sub.price}/month
                        </p>
                      </div>
                      {sub.creator?.verification_status === 'verified' && (
                        <Shield className="w-4 h-4 text-emerald-400" />
                      )}
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-500">No active subscriptions</p>
              )}
            </div>

            {/* Quick Actions */}
            <div className="glass p-6">
              <h3 className="text-sm text-white uppercase tracking-wider mb-4">
                Quick Actions
              </h3>
              <div className="space-y-2">
                <Link
                  to="/discover"
                  className="flex items-center gap-3 p-3 hover:bg-white/5 transition-colors"
                  data-testid="quick-discover"
                >
                  <Compass className="w-5 h-5 text-gold" />
                  <span className="text-sm text-zinc-300">Discover Creators</span>
                </Link>
                <Link
                  to="/messages"
                  className="flex items-center gap-3 p-3 hover:bg-white/5 transition-colors"
                  data-testid="quick-messages"
                >
                  <MessageSquare className="w-5 h-5 text-gold" />
                  <span className="text-sm text-zinc-300">Messages</span>
                </Link>
                {isCreator && (
                  <Link
                    to="/creator-dashboard"
                    className="flex items-center gap-3 p-3 hover:bg-white/5 transition-colors"
                    data-testid="quick-studio"
                  >
                    <Lock className="w-5 h-5 text-gold" />
                    <span className="text-sm text-zinc-300">Creator Studio</span>
                  </Link>
                )}
              </div>
            </div>

            {/* Encryption Status */}
            <div className="glass p-6 border-emerald-500/20">
              <div className="flex items-center gap-2 text-emerald-400 mb-3">
                <Shield className="w-5 h-5" />
                <span className="text-sm font-mono uppercase tracking-wider">Secure Session</span>
              </div>
              <p className="text-xs text-zinc-500">
                All communications are end-to-end encrypted. 
                PRIVÉ cannot access your messages or calls.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
