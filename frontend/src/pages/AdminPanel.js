import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import Navigation from '../components/Navigation';
import { 
  Shield, 
  Users,
  DollarSign,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Eye
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminPanel = () => {
  const { token } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [verifications, setVerifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [analyticsRes, verificationsRes] = await Promise.all([
        axios.get(`${API}/admin/analytics`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/admin/verifications?status=pending`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setAnalytics(analyticsRes.data);
      setVerifications(verificationsRes.data);
    } catch (error) {
      console.error('Error fetching admin data:', error);
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (verificationId) => {
    setProcessingId(verificationId);
    try {
      await axios.post(
        `${API}/admin/verifications/${verificationId}/approve`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Verification approved');
      setVerifications(verifications.filter(v => v.id !== verificationId));
    } catch (error) {
      toast.error('Failed to approve verification');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (verificationId) => {
    setProcessingId(verificationId);
    try {
      await axios.post(
        `${API}/admin/verifications/${verificationId}/reject`,
        { reason: 'Documents unclear or invalid' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Verification rejected');
      setVerifications(verifications.filter(v => v.id !== verificationId));
    } catch (error) {
      toast.error('Failed to reject verification');
    } finally {
      setProcessingId(null);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-obsidian flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gold animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-obsidian">
      <Navigation />
      
      <div className="max-w-6xl mx-auto px-4 pt-24 pb-16">
        <div className="mb-8 animate-fade-in">
          <div className="flex items-center gap-2 text-gold mb-2">
            <Shield className="w-5 h-5" />
            <span className="text-xs uppercase tracking-wider font-mono">Admin Panel</span>
          </div>
          <h1 className="font-display text-3xl text-white">Platform Management</h1>
        </div>

        {/* Stats Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate-fade-in delay-100">
          <div className="glass p-6">
            <Users className="w-5 h-5 text-gold mb-4" />
            <p className="text-2xl font-display text-white">{analytics?.total_users || 0}</p>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mt-1">Total Users</p>
          </div>
          <div className="glass p-6">
            <Shield className="w-5 h-5 text-emerald-400 mb-4" />
            <p className="text-2xl font-display text-white">{analytics?.verified_users || 0}</p>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mt-1">Verified Users</p>
          </div>
          <div className="glass p-6">
            <DollarSign className="w-5 h-5 text-gold mb-4" />
            <p className="text-2xl font-display text-white">{formatCurrency(analytics?.total_revenue)}</p>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mt-1">Total Revenue</p>
          </div>
          <div className="glass p-6">
            <AlertCircle className="w-5 h-5 text-amber-400 mb-4" />
            <p className="text-2xl font-display text-white">{analytics?.pending_verifications || 0}</p>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mt-1">Pending Reviews</p>
          </div>
        </div>

        <Tabs defaultValue="verifications" className="animate-fade-in delay-200">
          <TabsList className="bg-zinc-900/50 border border-white/5 p-1 mb-6">
            <TabsTrigger 
              value="verifications"
              className="data-[state=active]:bg-gold data-[state=active]:text-black"
            >
              Verification Queue
            </TabsTrigger>
            <TabsTrigger 
              value="analytics"
              className="data-[state=active]:bg-gold data-[state=active]:text-black"
            >
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="verifications">
            {verifications.length > 0 ? (
              <div className="space-y-4">
                {verifications.map((verification) => (
                  <div 
                    key={verification.id} 
                    className="glass p-6"
                    data-testid={`verification-${verification.id}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="bg-zinc-800">
                            {verification.user?.username?.charAt(0) || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-white font-medium">
                            {verification.user?.display_name || verification.user?.username}
                          </p>
                          <p className="text-xs text-zinc-500 font-mono">
                            @{verification.user?.username} • {verification.user?.email}
                          </p>
                          <p className="text-xs text-zinc-600 mt-1">
                            Submitted: {new Date(verification.submitted_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {verification.id_front_url && (
                          <a 
                            href={verification.id_front_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="btn-outline text-xs py-2 px-3 flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            View ID
                          </a>
                        )}
                        {verification.selfie_url && (
                          <a 
                            href={verification.selfie_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="btn-outline text-xs py-2 px-3 flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            View Selfie
                          </a>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 mt-4 pt-4 border-t border-white/5">
                      <button
                        onClick={() => handleApprove(verification.id)}
                        disabled={processingId === verification.id}
                        className="btn-gold text-xs py-2 px-4 flex items-center gap-2"
                        data-testid={`approve-${verification.id}`}
                      >
                        {processingId === verification.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <CheckCircle className="w-3 h-3" />
                        )}
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(verification.id)}
                        disabled={processingId === verification.id}
                        className="btn-outline text-xs py-2 px-4 flex items-center gap-2 text-red-400 border-red-400/30 hover:border-red-400/60"
                        data-testid={`reject-${verification.id}`}
                      >
                        <XCircle className="w-3 h-3" />
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass p-8 text-center">
                <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
                <h3 className="text-lg text-white mb-2">All caught up!</h3>
                <p className="text-sm text-zinc-500">No pending verifications to review.</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="analytics">
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="glass p-6">
                <h3 className="text-lg text-white mb-4">Platform Overview</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-zinc-800/30">
                    <span className="text-sm text-zinc-400">Total Users</span>
                    <span className="text-white font-mono">{analytics?.total_users || 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-zinc-800/30">
                    <span className="text-sm text-zinc-400">Total Creators</span>
                    <span className="text-white font-mono">{analytics?.total_creators || 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-zinc-800/30">
                    <span className="text-sm text-zinc-400">Active Subscriptions</span>
                    <span className="text-white font-mono">{analytics?.active_subscriptions || 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-zinc-800/30">
                    <span className="text-sm text-zinc-400">Verified Rate</span>
                    <span className="text-emerald-400 font-mono">
                      {analytics?.total_users 
                        ? ((analytics.verified_users / analytics.total_users) * 100).toFixed(1)
                        : 0}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="glass p-6">
                <h3 className="text-lg text-white mb-4">Revenue</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-zinc-800/30">
                    <span className="text-sm text-zinc-400">Total Revenue</span>
                    <span className="text-gold font-mono">{formatCurrency(analytics?.total_revenue)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-zinc-800/30">
                    <span className="text-sm text-zinc-400">Platform Earnings (25%)</span>
                    <span className="text-white font-mono">{formatCurrency(analytics?.platform_earnings)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-zinc-800/30">
                    <span className="text-sm text-zinc-400">Creator Payouts (75%)</span>
                    <span className="text-white font-mono">
                      {formatCurrency((analytics?.total_revenue || 0) - (analytics?.platform_earnings || 0))}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminPanel;
