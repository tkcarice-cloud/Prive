import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import Navigation from '../components/Navigation';
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  Image,
  Plus,
  Loader2,
  Eye,
  EyeOff
} from 'lucide-react';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CreatorDashboard = () => {
  const { token } = useAuth();
  const [earnings, setEarnings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEarnings, setShowEarnings] = useState(false);
  const [postDialog, setPostDialog] = useState(false);
  const [posting, setPosting] = useState(false);
  
  const [newPost, setNewPost] = useState({
    title: '',
    description: '',
    content_type: 'subscription',
    price: '',
    media_urls: []
  });

  useEffect(() => {
    fetchEarnings();
  }, []);

  const fetchEarnings = async () => {
    try {
      const response = await axios.get(`${API}/earnings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEarnings(response.data);
    } catch (error) {
      console.error('Error fetching earnings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async () => {
    if (!newPost.title) {
      toast.error('Please enter a title');
      return;
    }

    setPosting(true);
    try {
      await axios.post(
        `${API}/content`,
        {
          ...newPost,
          price: newPost.content_type === 'ppv' ? parseFloat(newPost.price) : null
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Content posted successfully!');
      setPostDialog(false);
      setNewPost({
        title: '',
        description: '',
        content_type: 'subscription',
        price: '',
        media_urls: []
      });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create post');
    } finally {
      setPosting(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  return (
    <div className="min-h-screen bg-obsidian">
      <Navigation />
      
      <div className="max-w-6xl mx-auto px-4 pt-24 pb-16">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 animate-fade-in">
          <div>
            <h1 className="font-display text-3xl text-white mb-2">Creator Studio</h1>
            <p className="text-zinc-500">Manage your content and earnings</p>
          </div>
          <Dialog open={postDialog} onOpenChange={setPostDialog}>
            <DialogTrigger asChild>
              <button className="btn-gold flex items-center gap-2" data-testid="new-post-btn">
                <Plus className="w-4 h-4" />
                <span>New Post</span>
              </button>
            </DialogTrigger>
            <DialogContent className="bg-paper border-white/10 max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-display text-xl text-white">Create New Post</DialogTitle>
                <DialogDescription className="text-zinc-500">
                  Share content with your subscribers
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label className="text-zinc-400 text-xs uppercase">Title</Label>
                  <Input
                    value={newPost.title}
                    onChange={(e) => setNewPost({...newPost, title: e.target.value})}
                    placeholder="Give your post a title"
                    className="input-dark mt-1"
                    data-testid="post-title"
                  />
                </div>
                <div>
                  <Label className="text-zinc-400 text-xs uppercase">Description</Label>
                  <Textarea
                    value={newPost.description}
                    onChange={(e) => setNewPost({...newPost, description: e.target.value})}
                    placeholder="What's this post about?"
                    className="input-dark mt-1 min-h-[100px] resize-none"
                    data-testid="post-description"
                  />
                </div>
                <div>
                  <Label className="text-zinc-400 text-xs uppercase">Content Type</Label>
                  <Select 
                    value={newPost.content_type}
                    onValueChange={(value) => setNewPost({...newPost, content_type: value})}
                  >
                    <SelectTrigger className="bg-black/50 border-white/10 text-white mt-1" data-testid="content-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-paper border-white/10">
                      <SelectItem value="free">Free - Anyone can view</SelectItem>
                      <SelectItem value="subscription">Subscribers Only</SelectItem>
                      <SelectItem value="ppv">Pay-Per-View</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newPost.content_type === 'ppv' && (
                  <div>
                    <Label className="text-zinc-400 text-xs uppercase">Price ($)</Label>
                    <Input
                      type="number"
                      min="0.99"
                      step="0.01"
                      value={newPost.price}
                      onChange={(e) => setNewPost({...newPost, price: e.target.value})}
                      placeholder="9.99"
                      className="input-dark mt-1"
                      data-testid="post-price"
                    />
                  </div>
                )}
                <div>
                  <Label className="text-zinc-400 text-xs uppercase">Media URL (optional)</Label>
                  <Input
                    value={newPost.media_urls[0] || ''}
                    onChange={(e) => setNewPost({...newPost, media_urls: e.target.value ? [e.target.value] : []})}
                    placeholder="https://example.com/image.jpg"
                    className="input-dark mt-1"
                    data-testid="media-url"
                  />
                </div>
                <button
                  onClick={handleCreatePost}
                  disabled={posting}
                  className="btn-gold w-full flex items-center justify-center gap-2"
                  data-testid="create-post-btn"
                >
                  {posting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Create Post</span>
                    </>
                  )}
                </button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-gold animate-spin" />
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate-fade-in delay-100">
              <div className="glass p-6">
                <div className="flex items-center justify-between mb-4">
                  <DollarSign className="w-5 h-5 text-gold" />
                  <button 
                    onClick={() => setShowEarnings(!showEarnings)}
                    className="text-zinc-500 hover:text-white"
                  >
                    {showEarnings ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-2xl font-display text-white">
                  {showEarnings ? formatCurrency(earnings?.total_earnings) : '••••••'}
                </p>
                <p className="text-xs text-zinc-500 uppercase tracking-wider mt-1">Total Earnings</p>
              </div>
              
              <div className="glass p-6">
                <Users className="w-5 h-5 text-gold mb-4" />
                <p className="text-2xl font-display text-white">{earnings?.total_subscribers || 0}</p>
                <p className="text-xs text-zinc-500 uppercase tracking-wider mt-1">Subscribers</p>
              </div>
              
              <div className="glass p-6">
                <TrendingUp className="w-5 h-5 text-gold mb-4" />
                <p className="text-2xl font-display text-white">
                  {showEarnings ? formatCurrency(earnings?.pending_payout) : '••••••'}
                </p>
                <p className="text-xs text-zinc-500 uppercase tracking-wider mt-1">Pending Payout</p>
              </div>
              
              <div className="glass p-6">
                <Image className="w-5 h-5 text-gold mb-4" />
                <p className="text-2xl font-display text-white">75%</p>
                <p className="text-xs text-zinc-500 uppercase tracking-wider mt-1">Revenue Share</p>
              </div>
            </div>

            {/* Earnings Breakdown */}
            <div className="grid lg:grid-cols-2 gap-6 animate-fade-in delay-200">
              <div className="glass p-6">
                <h2 className="text-lg text-white mb-6">Earnings by Type</h2>
                <div className="space-y-4">
                  {Object.entries(earnings?.earnings_by_type || {}).map(([type, amount]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className="text-sm text-zinc-400 capitalize">{type}</span>
                      <span className="text-white font-mono">
                        {showEarnings ? formatCurrency(amount) : '••••'}
                      </span>
                    </div>
                  ))}
                  {Object.keys(earnings?.earnings_by_type || {}).length === 0 && (
                    <p className="text-sm text-zinc-500">No earnings yet</p>
                  )}
                </div>
              </div>

              <div className="glass p-6">
                <h2 className="text-lg text-white mb-6">Monthly Earnings</h2>
                <div className="space-y-3">
                  {(earnings?.monthly_earnings || []).map((month) => (
                    <div key={month.month} className="flex items-center justify-between">
                      <span className="text-sm text-zinc-400">{month.month}</span>
                      <span className="text-white font-mono">
                        {showEarnings ? formatCurrency(month.earnings) : '••••'}
                      </span>
                    </div>
                  ))}
                  {(earnings?.monthly_earnings || []).length === 0 && (
                    <p className="text-sm text-zinc-500">No data available</p>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Tips */}
            <div className="glass p-6 mt-6 animate-fade-in delay-300">
              <h2 className="text-lg text-white mb-4">Creator Tips</h2>
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="bg-zinc-800/30 p-4">
                  <h3 className="text-sm text-gold mb-2">Post Regularly</h3>
                  <p className="text-xs text-zinc-500">
                    Consistent posting keeps subscribers engaged and reduces churn.
                  </p>
                </div>
                <div className="bg-zinc-800/30 p-4">
                  <h3 className="text-sm text-gold mb-2">Engage via DMs</h3>
                  <p className="text-xs text-zinc-500">
                    Paid messages are a significant revenue stream. Respond promptly.
                  </p>
                </div>
                <div className="bg-zinc-800/30 p-4">
                  <h3 className="text-sm text-gold mb-2">Offer Exclusives</h3>
                  <p className="text-xs text-zinc-500">
                    PPV content and private calls command premium prices.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CreatorDashboard;
