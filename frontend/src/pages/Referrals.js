import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import Navigation from '../components/Navigation';
import { 
  Gift, 
  Users, 
  DollarSign, 
  Copy,
  TrendingUp,
  Award,
  Share2
} from 'lucide-react';
import { Input } from '../components/ui/input';
import { Progress } from '../components/ui/progress';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Referrals = () => {
  const { token } = useAuth();
  const [stats, setStats] = useState(null);
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReferralData();
  }, []);

  const fetchReferralData = async () => {
    try {
      const [statsRes, referralsRes] = await Promise.all([
        axios.get(`${API}/referral/stats`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/referral/list`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setStats(statsRes.data);
      setReferrals(referralsRes.data);
    } catch (error) {
      console.error('Error fetching referral data:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyReferralLink = () => {
    const link = `${window.location.origin}/register?ref=${stats?.referral_code}`;
    navigator.clipboard.writeText(link);
    toast.success('Referral link copied!');
  };

  const copyReferralCode = () => {
    navigator.clipboard.writeText(stats?.referral_code);
    toast.success('Referral code copied!');
  };

  const getTierIcon = (tier) => {
    switch (tier) {
      case 'platinum': return '💎';
      case 'gold': return '🥇';
      case 'silver': return '🥈';
      default: return '🥉';
    }
  };

  const getTierColor = (tier) => {
    switch (tier) {
      case 'platinum': return 'text-purple-400';
      case 'gold': return 'text-gold';
      case 'silver': return 'text-zinc-300';
      default: return 'text-amber-600';
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-obsidian flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-obsidian">
      <Navigation />
      
      <div className="max-w-4xl mx-auto px-4 pt-24 pb-16">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center gap-2 text-gold text-xs uppercase tracking-wider mb-4">
            <Gift className="w-4 h-4" />
            <span>Referral Program</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl text-white mb-2">
            Earn More by Sharing
          </h1>
          <p className="text-zinc-500">
            Invite friends and earn {stats?.current_bonus_percent}% of their earnings for {stats?.tier_bonuses?.bronze?.bonus_duration_months || 6} months
          </p>
        </div>

        {/* Referral Code Card */}
        <div className="glass p-6 mb-8 animate-fade-in delay-100">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="flex-1 text-center md:text-left">
              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Your Referral Code</p>
              <div className="flex items-center gap-3 justify-center md:justify-start">
                <code className="text-3xl font-mono text-gold tracking-wider">{stats?.referral_code}</code>
                <button 
                  onClick={copyReferralCode}
                  className="p-2 text-zinc-500 hover:text-white transition-colors"
                  data-testid="copy-code"
                >
                  <Copy className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={copyReferralLink}
                className="btn-gold flex items-center gap-2"
                data-testid="copy-link"
              >
                <Share2 className="w-4 h-4" />
                Copy Link
              </button>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-zinc-800/30">
            <p className="text-xs text-zinc-500 mb-1">Referral Link</p>
            <code className="text-sm text-zinc-300 break-all">
              {window.location.origin}/register?ref={stats?.referral_code}
            </code>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid sm:grid-cols-4 gap-4 mb-8 animate-fade-in delay-200">
          <div className="glass p-4 text-center">
            <Users className="w-5 h-5 text-gold mx-auto mb-2" />
            <p className="text-2xl font-display text-white">{stats?.total_referrals || 0}</p>
            <p className="text-xs text-zinc-500">Total Referrals</p>
          </div>
          <div className="glass p-4 text-center">
            <TrendingUp className="w-5 h-5 text-emerald-400 mx-auto mb-2" />
            <p className="text-2xl font-display text-white">{stats?.active_referrals || 0}</p>
            <p className="text-xs text-zinc-500">Active</p>
          </div>
          <div className="glass p-4 text-center">
            <DollarSign className="w-5 h-5 text-gold mx-auto mb-2" />
            <p className="text-2xl font-display text-white">{formatCurrency(stats?.total_earnings)}</p>
            <p className="text-xs text-zinc-500">Total Earned</p>
          </div>
          <div className="glass p-4 text-center">
            <Award className="w-5 h-5 text-gold mx-auto mb-2" />
            <p className="text-2xl font-display text-white">{stats?.current_bonus_percent}%</p>
            <p className="text-xs text-zinc-500">Bonus Rate</p>
          </div>
        </div>

        {/* Tier Progress */}
        <div className="glass p-6 mb-8 animate-fade-in delay-300">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-white flex items-center gap-2">
                <span className="text-lg">{getTierIcon(stats?.current_tier)}</span>
                <span className={`font-semibold capitalize ${getTierColor(stats?.current_tier)}`}>
                  {stats?.current_tier} Tier
                </span>
              </p>
              <p className="text-xs text-zinc-500">
                {stats?.current_bonus_percent}% bonus on referred earnings
              </p>
            </div>
            {stats?.next_tier && (
              <div className="text-right">
                <p className="text-xs text-zinc-500">Next: {stats?.next_tier}</p>
                <p className="text-sm text-gold">
                  {stats?.referrals_to_next_tier} more referrals
                </p>
              </div>
            )}
          </div>
          
          {stats?.next_tier && (
            <Progress 
              value={((stats?.total_referrals || 0) / ((stats?.total_referrals || 0) + stats?.referrals_to_next_tier)) * 100} 
              className="h-2 bg-zinc-800"
            />
          )}
          
          {/* Tier Breakdown */}
          <div className="grid grid-cols-4 gap-2 mt-6">
            {Object.entries(stats?.tier_bonuses || {}).map(([tier, config]) => (
              <div 
                key={tier}
                className={`p-3 text-center transition-colors ${
                  tier === stats?.current_tier ? 'bg-gold/10 border border-gold/30' : 'bg-zinc-800/30'
                }`}
              >
                <p className="text-lg mb-1">{getTierIcon(tier)}</p>
                <p className={`text-xs font-semibold capitalize ${
                  tier === stats?.current_tier ? 'text-gold' : 'text-zinc-400'
                }`}>
                  {tier}
                </p>
                <p className="text-xs text-zinc-500">{config.min_referrals}+ refs</p>
                <p className="text-sm text-white mt-1">{config.bonus_percent}%</p>
              </div>
            ))}
          </div>
        </div>

        {/* Referral List */}
        <div className="glass p-6 animate-fade-in delay-400">
          <h2 className="text-lg text-white mb-4">Your Referrals</h2>
          
          {referrals.length > 0 ? (
            <div className="space-y-3">
              {referrals.map((ref) => (
                <div key={ref.id} className="flex items-center justify-between p-3 bg-zinc-800/30">
                  <div>
                    <p className="text-sm text-white">
                      {ref.referred_user?.display_name || ref.referred_user?.username}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {ref.referred_user?.role === 'creator' ? 'Creator' : 'Member'} • 
                      Joined {new Date(ref.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gold">{formatCurrency(ref.total_bonus_earned)}</p>
                    <p className="text-xs text-zinc-500">
                      {new Date(ref.expires_at) > new Date() ? (
                        <span className="text-emerald-400">Active</span>
                      ) : (
                        <span className="text-zinc-600">Expired</span>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Gift className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
              <p className="text-zinc-500">No referrals yet</p>
              <p className="text-xs text-zinc-600 mt-1">Share your code to start earning!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Referrals;
