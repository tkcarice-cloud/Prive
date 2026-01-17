import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import Navigation from '../components/Navigation';
import { 
  Shield, 
  Lock, 
  MessageSquare, 
  Phone,
  Video,
  Heart,
  Grid,
  DollarSign,
  Star,
  Loader2
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CreatorProfile = () => {
  const { creatorId } = useParams();
  const navigate = useNavigate();
  const { user, token, isVerified, isAuthenticated } = useAuth();
  
  const [creator, setCreator] = useState(null);
  const [content, setContent] = useState([]);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [tipDialog, setTipDialog] = useState(false);
  const [tipAmount, setTipAmount] = useState('5');
  const [tipping, setTipping] = useState(false);

  useEffect(() => {
    fetchCreatorData();
  }, [creatorId]);

  const fetchCreatorData = async () => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const [creatorRes, contentRes] = await Promise.all([
        axios.get(`${API}/creators/${creatorId}`),
        axios.get(`${API}/content/creator/${creatorId}`, { headers })
      ]);
      
      setCreator(creatorRes.data);
      setContent(contentRes.data);
      
      // Check subscription status
      if (token) {
        const subsRes = await axios.get(`${API}/subscriptions`, { headers });
        const sub = subsRes.data.find(s => s.creator_id === creatorId);
        setIsSubscribed(!!sub);
      }
    } catch (error) {
      console.error('Error fetching creator:', error);
      toast.error('Creator not found');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (!isVerified) {
      toast.error('Please verify your identity first');
      navigate('/verify');
      return;
    }

    setSubscribing(true);
    try {
      const response = await axios.post(
        `${API}/payments/checkout`,
        {
          payment_type: 'subscription',
          creator_id: creatorId,
          origin_url: window.location.origin
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      window.location.href = response.data.checkout_url;
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to initiate subscription');
    } finally {
      setSubscribing(false);
    }
  };

  const handleTip = async () => {
    if (!isVerified) {
      toast.error('Please verify your identity first');
      return;
    }

    const amount = parseFloat(tipAmount);
    if (isNaN(amount) || amount < 1) {
      toast.error('Minimum tip is $1');
      return;
    }

    setTipping(true);
    try {
      const response = await axios.post(
        `${API}/payments/checkout`,
        {
          payment_type: 'tip',
          creator_id: creatorId,
          amount: amount,
          origin_url: window.location.origin
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      window.location.href = response.data.checkout_url;
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to process tip');
    } finally {
      setTipping(false);
      setTipDialog(false);
    }
  };

  const handleMessage = () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (!isVerified) {
      toast.error('Please verify your identity first');
      navigate('/verify');
      return;
    }
    navigate(`/messages/${creator.user_id}`);
  };

  const getTierBadge = (tier) => {
    switch (tier) {
      case 'elite':
        return <span className="badge-elite">Elite Creator</span>;
      case 'verified':
        return <span className="badge-verified">Verified Creator</span>;
      default:
        return <span className="badge-standard">Creator</span>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-obsidian flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gold animate-spin" />
      </div>
    );
  }

  if (!creator) {
    return (
      <div className="min-h-screen bg-obsidian">
        <Navigation />
        <div className="max-w-4xl mx-auto px-4 pt-24 text-center">
          <h1 className="font-display text-2xl text-white">Creator not found</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-obsidian">
      <Navigation />
      
      {/* Cover Image */}
      <div className="h-64 sm:h-80 relative">
        {creator.cover_url ? (
          <img 
            src={creator.cover_url} 
            alt={creator.display_name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/50 to-transparent" />
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-20 relative z-10 pb-16">
        {/* Profile Header */}
        <div className="flex flex-col sm:flex-row items-start gap-6 mb-8 animate-fade-in">
          <Avatar className="h-32 w-32 border-4 border-obsidian shadow-xl">
            <AvatarImage src={creator.avatar_url} />
            <AvatarFallback className="bg-zinc-800 text-gold text-3xl font-display">
              {creator.display_name?.charAt(0) || 'C'}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="font-display text-3xl text-white">{creator.display_name}</h1>
              {creator.verification_status === 'verified' && (
                <Shield className="w-6 h-6 text-emerald-400" />
              )}
            </div>
            <p className="text-zinc-500 font-mono mb-2">@{creator.username}</p>
            <div className="flex items-center gap-3 mb-4">
              {getTierBadge(creator.tier)}
              {creator.is_online && (
                <span className="flex items-center gap-1 text-xs text-emerald-400">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  Online
                </span>
              )}
            </div>
            {creator.bio && (
              <p className="text-zinc-400 text-sm leading-relaxed max-w-xl">{creator.bio}</p>
            )}
          </div>
        </div>

        {/* Stats & Actions */}
        <div className="glass p-6 mb-8 animate-fade-in delay-100">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-8">
              <div className="text-center">
                <p className="text-2xl font-display text-white">{creator.total_subscribers || 0}</p>
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Subscribers</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-display text-gold">${creator.subscription_price}</p>
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Per Month</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-display text-white">{content.length}</p>
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Posts</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {isSubscribed ? (
                <button className="btn-outline flex items-center gap-2" disabled>
                  <Heart className="w-4 h-4 fill-current" />
                  <span>Subscribed</span>
                </button>
              ) : (
                <button 
                  onClick={handleSubscribe}
                  disabled={subscribing}
                  className="btn-gold flex items-center gap-2"
                  data-testid="subscribe-btn"
                >
                  {subscribing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Star className="w-4 h-4" />
                      <span>Subscribe ${creator.subscription_price}/mo</span>
                    </>
                  )}
                </button>
              )}
              <button 
                onClick={() => setTipDialog(true)}
                className="btn-outline flex items-center gap-2"
                data-testid="tip-btn"
              >
                <DollarSign className="w-4 h-4" />
                <span>Tip</span>
              </button>
              <button 
                onClick={handleMessage}
                className="btn-outline p-3"
                data-testid="message-btn"
              >
                <MessageSquare className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Content Tabs */}
        <Tabs defaultValue="posts" className="animate-fade-in delay-200">
          <TabsList className="bg-zinc-900/50 border border-white/5 p-1 mb-6">
            <TabsTrigger 
              value="posts" 
              className="data-[state=active]:bg-gold data-[state=active]:text-black"
            >
              <Grid className="w-4 h-4 mr-2" />
              Posts
            </TabsTrigger>
            <TabsTrigger 
              value="about"
              className="data-[state=active]:bg-gold data-[state=active]:text-black"
            >
              About
            </TabsTrigger>
          </TabsList>

          <TabsContent value="posts">
            {content.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {content.map((post) => (
                  <div 
                    key={post.id} 
                    className="card-creator aspect-square relative group"
                    data-testid={`content-${post.id}`}
                  >
                    {post.is_unlocked && post.media_urls?.length > 0 ? (
                      <img 
                        src={post.media_urls[0]} 
                        alt={post.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                        <Lock className="w-8 h-8 text-zinc-600" />
                      </div>
                    )}
                    
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="absolute bottom-4 left-4 right-4">
                        <p className="text-sm text-white truncate">{post.title}</p>
                        {!post.is_unlocked && post.content_type === 'ppv' && (
                          <p className="text-xs text-gold mt-1">Unlock for ${post.price}</p>
                        )}
                      </div>
                    </div>
                    
                    {post.content_type !== 'free' && !post.is_unlocked && (
                      <div className="absolute top-3 right-3">
                        <Lock className="w-4 h-4 text-gold" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass p-8 text-center">
                <Grid className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                <p className="text-zinc-500">No content yet</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="about">
            <div className="glass p-6 space-y-6">
              <div>
                <h3 className="text-sm text-zinc-400 uppercase tracking-wider mb-2">Bio</h3>
                <p className="text-white">{creator.bio || 'No bio available'}</p>
              </div>
              <div>
                <h3 className="text-sm text-zinc-400 uppercase tracking-wider mb-2">Pricing</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-zinc-800/50 p-4">
                    <p className="text-xs text-zinc-500">Subscription</p>
                    <p className="text-lg text-gold">${creator.subscription_price}/mo</p>
                  </div>
                  <div className="bg-zinc-800/50 p-4">
                    <p className="text-xs text-zinc-500">Message</p>
                    <p className="text-lg text-gold">${creator.message_price}</p>
                  </div>
                  <div className="bg-zinc-800/50 p-4">
                    <p className="text-xs text-zinc-500">Call Rate</p>
                    <p className="text-lg text-gold">${creator.call_rate_per_minute}/min</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-emerald-400">
                <Shield className="w-4 h-4" />
                <span className="font-mono">End-to-End Encrypted Communications</span>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Tip Dialog */}
      <Dialog open={tipDialog} onOpenChange={setTipDialog}>
        <DialogContent className="bg-paper border-white/10">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-white">
              Send a Tip to {creator.display_name}
            </DialogTitle>
            <DialogDescription className="text-zinc-500">
              Show your appreciation with a tip. 75% goes directly to the creator.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-4 gap-2">
              {['5', '10', '25', '50'].map((amount) => (
                <button
                  key={amount}
                  onClick={() => setTipAmount(amount)}
                  className={`p-3 border transition-colors ${
                    tipAmount === amount 
                      ? 'border-gold bg-gold/10 text-gold' 
                      : 'border-white/10 text-zinc-400 hover:border-white/30'
                  }`}
                >
                  ${amount}
                </button>
              ))}
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Custom Amount</label>
              <Input
                type="number"
                min="1"
                value={tipAmount}
                onChange={(e) => setTipAmount(e.target.value)}
                className="input-dark"
                data-testid="tip-amount-input"
              />
            </div>
            <button
              onClick={handleTip}
              disabled={tipping}
              className="btn-gold w-full flex items-center justify-center gap-2"
              data-testid="send-tip-btn"
            >
              {tipping ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <DollarSign className="w-4 h-4" />
                  <span>Send ${tipAmount} Tip</span>
                </>
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CreatorProfile;
