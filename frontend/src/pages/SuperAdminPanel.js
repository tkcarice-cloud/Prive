import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import Navigation from '../components/Navigation';
import { 
  Shield, 
  Settings, 
  Users,
  DollarSign,
  Key,
  Database,
  Lock,
  Eye,
  EyeOff,
  Save,
  RefreshCw,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Copy,
  Server,
  CreditCard,
  UserCheck,
  Link2,
  Gift
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
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
} from '../components/ui/dialog';
import { Avatar, AvatarFallback } from '../components/ui/avatar';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SuperAdminPanel = () => {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [users, setUsers] = useState([]);
  const [creators, setCreators] = useState([]);
  const [verifications, setVerifications] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [showSecrets, setShowSecrets] = useState({});
  const [initDialog, setInitDialog] = useState(false);
  const [superAdminCreds, setSuperAdminCreds] = useState(null);

  useEffect(() => {
    if (user?.role === 'super_admin') {
      fetchAllData();
    }
  }, [user]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      
      const [configRes, analyticsRes, usersRes, creatorsRes, verificationsRes, logsRes] = await Promise.all([
        axios.get(`${API}/super-admin/config`, { headers }).catch(() => ({ data: null })),
        axios.get(`${API}/super-admin/analytics`, { headers }).catch(() => ({ data: null })),
        axios.get(`${API}/super-admin/users?limit=100`, { headers }).catch(() => ({ data: { users: [] } })),
        axios.get(`${API}/super-admin/creators?limit=100`, { headers }).catch(() => ({ data: { creators: [] } })),
        axios.get(`${API}/super-admin/verifications`, { headers }).catch(() => ({ data: { verifications: [] } })),
        axios.get(`${API}/super-admin/audit-logs?limit=50`, { headers }).catch(() => ({ data: { logs: [] } }))
      ]);
      
      setConfig(configRes.data);
      setAnalytics(analyticsRes.data);
      setUsers(usersRes.data?.users || []);
      setCreators(creatorsRes.data?.creators || []);
      setVerifications(verificationsRes.data?.verifications || verificationsRes.data || []);
      setAuditLogs(logsRes.data?.logs || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const initializeSuperAdmin = async () => {
    try {
      const response = await axios.post(`${API}/super-admin/init`);
      setSuperAdminCreds(response.data.credentials);
      toast.success('Super Admin account created!');
    } catch (error) {
      if (error.response?.data?.detail === 'Super admin already exists') {
        toast.error('Super Admin already exists');
      } else {
        toast.error('Failed to initialize Super Admin');
      }
    }
  };

  const updateConfig = async (section, updates) => {
    setSaving(true);
    try {
      await axios.put(
        `${API}/super-admin/config`,
        { [section]: updates },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Configuration saved');
      fetchAllData();
    } catch (error) {
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const updateVerificationStatus = async (verificationId, status) => {
    try {
      await axios.put(
        `${API}/super-admin/verifications/${verificationId}`,
        { status },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Verification ${status}`);
      fetchAllData();
    } catch (error) {
      toast.error('Failed to update verification');
    }
  };

  const triggerPayout = async (creatorId, amount) => {
    try {
      const response = await axios.post(
        `${API}/super-admin/creators/${creatorId}/payout`,
        { amount },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.status === 'success') {
        toast.success(`Payout of $${amount} initiated`);
        fetchAllData();
      } else {
        toast.error(response.data.message || 'Payout failed');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Payout failed');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const toggleSecret = (key) => {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
  };

  // Show init dialog if not super admin
  if (user?.role !== 'super_admin') {
    return (
      <div className="min-h-screen bg-obsidian">
        <Navigation />
        <div className="max-w-lg mx-auto px-4 pt-24 text-center">
          <div className="glass p-8">
            <Shield className="w-16 h-16 text-gold mx-auto mb-4" />
            <h1 className="font-display text-2xl text-white mb-4">Super Admin Access Required</h1>
            <p className="text-zinc-500 mb-6">
              This area requires Super Administrator privileges.
            </p>
            <button
              onClick={() => setInitDialog(true)}
              className="btn-gold"
              data-testid="init-super-admin"
            >
              Initialize Super Admin
            </button>
          </div>
        </div>

        <Dialog open={initDialog} onOpenChange={setInitDialog}>
          <DialogContent className="bg-paper border-white/10 max-w-xl">
            <DialogHeader>
              <DialogTitle className="font-display text-xl text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                Initialize Super Administrator
              </DialogTitle>
              <DialogDescription className="text-zinc-500">
                This will create the SUPER_ADMIN account with full platform access. This can only be done once.
              </DialogDescription>
            </DialogHeader>
            
            {superAdminCreds ? (
              <div className="space-y-4 py-4">
                <div className="bg-emerald-500/10 border border-emerald-500/30 p-4">
                  <div className="flex items-center gap-2 text-emerald-400 mb-2">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-semibold">Account Created Successfully</span>
                  </div>
                  <p className="text-xs text-zinc-400">Save these credentials securely. They cannot be recovered.</p>
                </div>
                
                <div className="space-y-3">
                  <div className="bg-zinc-800/50 p-3">
                    <Label className="text-xs text-zinc-500">Email</Label>
                    <div className="flex items-center justify-between">
                      <code className="text-gold">{superAdminCreds.email}</code>
                      <button onClick={() => copyToClipboard(superAdminCreds.email)} className="text-zinc-500 hover:text-white">
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="bg-zinc-800/50 p-3">
                    <Label className="text-xs text-zinc-500">Password</Label>
                    <div className="flex items-center justify-between">
                      <code className="text-gold">{superAdminCreds.password}</code>
                      <button onClick={() => copyToClipboard(superAdminCreds.password)} className="text-zinc-500 hover:text-white">
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="bg-zinc-800/50 p-3">
                    <Label className="text-xs text-zinc-500">2FA Secret</Label>
                    <div className="flex items-center justify-between">
                      <code className="text-gold text-xs break-all">{superAdminCreds.totp_secret}</code>
                      <button onClick={() => copyToClipboard(superAdminCreds.totp_secret)} className="text-zinc-500 hover:text-white">
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="bg-zinc-800/50 p-3">
                    <Label className="text-xs text-zinc-500">Backup Codes</Label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {superAdminCreds.backup_codes.map((code, i) => (
                        <code key={i} className="text-xs text-gold bg-black/30 p-1 text-center">{code}</code>
                      ))}
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={() => {
                    setInitDialog(false);
                    window.location.href = '/login';
                  }}
                  className="btn-gold w-full"
                >
                  Go to Login
                </button>
              </div>
            ) : (
              <div className="py-4">
                <div className="bg-amber-500/10 border border-amber-500/30 p-4 mb-4">
                  <p className="text-sm text-amber-400">
                    ⚠️ This action is irreversible. The Super Admin has full control over all platform settings, users, and financial data.
                  </p>
                </div>
                <button
                  onClick={initializeSuperAdmin}
                  className="btn-gold w-full"
                  data-testid="confirm-init"
                >
                  Create Super Admin Account
                </button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

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
      
      <div className="max-w-7xl mx-auto px-4 pt-24 pb-16">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 animate-fade-in">
          <div>
            <div className="flex items-center gap-2 text-gold mb-2">
              <Shield className="w-5 h-5" />
              <span className="text-xs uppercase tracking-wider font-mono">Super Administrator</span>
            </div>
            <h1 className="font-display text-3xl text-white">System Control Panel</h1>
          </div>
          <button
            onClick={fetchAllData}
            className="btn-outline flex items-center gap-2"
            data-testid="refresh-data"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 animate-fade-in delay-100">
          <div className="glass p-4">
            <Users className="w-5 h-5 text-gold mb-2" />
            <p className="text-2xl font-display text-white">{analytics?.users?.total || 0}</p>
            <p className="text-xs text-zinc-500">Total Users</p>
          </div>
          <div className="glass p-4">
            <UserCheck className="w-5 h-5 text-emerald-400 mb-2" />
            <p className="text-2xl font-display text-white">{analytics?.users?.verified || 0}</p>
            <p className="text-xs text-zinc-500">Verified</p>
          </div>
          <div className="glass p-4">
            <DollarSign className="w-5 h-5 text-gold mb-2" />
            <p className="text-2xl font-display text-white">{formatCurrency(analytics?.revenue?.total)}</p>
            <p className="text-xs text-zinc-500">Total Revenue</p>
          </div>
          <div className="glass p-4">
            <Gift className="w-5 h-5 text-purple-400 mb-2" />
            <p className="text-2xl font-display text-white">{analytics?.referrals?.total || 0}</p>
            <p className="text-xs text-zinc-500">Referrals</p>
          </div>
        </div>

        <Tabs defaultValue="config" className="animate-fade-in delay-200">
          <TabsList className="bg-zinc-900/50 border border-white/5 p-1 mb-6 flex-wrap">
            <TabsTrigger value="config" className="data-[state=active]:bg-gold data-[state=active]:text-black">
              <Settings className="w-4 h-4 mr-2" />
              Configuration
            </TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-gold data-[state=active]:text-black">
              <Users className="w-4 h-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="creators" className="data-[state=active]:bg-gold data-[state=active]:text-black">
              <CreditCard className="w-4 h-4 mr-2" />
              Creators & Payouts
            </TabsTrigger>
            <TabsTrigger value="verifications" className="data-[state=active]:bg-gold data-[state=active]:text-black">
              <UserCheck className="w-4 h-4 mr-2" />
              Verifications
            </TabsTrigger>
            <TabsTrigger value="audit" className="data-[state=active]:bg-gold data-[state=active]:text-black">
              <Database className="w-4 h-4 mr-2" />
              Audit Log
            </TabsTrigger>
          </TabsList>

          {/* Configuration Tab */}
          <TabsContent value="config">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Storage Config */}
              <div className="glass p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Server className="w-5 h-5 text-gold" />
                  <h3 className="text-lg text-white">Storage Configuration</h3>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs text-zinc-500">Provider</Label>
                    <Select
                      value={config?.storage?.provider || 'local'}
                      onValueChange={(value) => updateConfig('storage', { provider: value })}
                    >
                      <SelectTrigger className="bg-black/50 border-white/10 text-white mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-paper border-white/10">
                        <SelectItem value="local">Local Storage (Demo)</SelectItem>
                        <SelectItem value="s3">AWS S3</SelectItem>
                        <SelectItem value="cloudinary">Cloudinary</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {config?.storage?.provider === 's3' && (
                    <>
                      <div>
                        <Label className="text-xs text-zinc-500">S3 Bucket</Label>
                        <Input
                          defaultValue={config?.storage?.s3_bucket}
                          onBlur={(e) => updateConfig('storage', { s3_bucket: e.target.value })}
                          className="input-dark mt-1"
                          placeholder="my-bucket"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-zinc-500">S3 Region</Label>
                        <Input
                          defaultValue={config?.storage?.s3_region}
                          onBlur={(e) => updateConfig('storage', { s3_region: e.target.value })}
                          className="input-dark mt-1"
                          placeholder="us-east-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-zinc-500">Access Key</Label>
                        <div className="relative">
                          <Input
                            type={showSecrets.s3_access ? 'text' : 'password'}
                            defaultValue={config?.storage?.s3_access_key}
                            onBlur={(e) => updateConfig('storage', { s3_access_key: e.target.value })}
                            className="input-dark mt-1 pr-10"
                            placeholder="AKIA..."
                          />
                          <button
                            onClick={() => toggleSecret('s3_access')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500"
                          >
                            {showSecrets.s3_access ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-zinc-500">Secret Key</Label>
                        <div className="relative">
                          <Input
                            type={showSecrets.s3_secret ? 'text' : 'password'}
                            defaultValue={config?.storage?.s3_secret_key}
                            onBlur={(e) => updateConfig('storage', { s3_secret_key: e.target.value })}
                            className="input-dark mt-1 pr-10"
                            placeholder="••••••••"
                          />
                          <button
                            onClick={() => toggleSecret('s3_secret')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500"
                          >
                            {showSecrets.s3_secret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Payment Config */}
              <div className="glass p-6">
                <div className="flex items-center gap-2 mb-4">
                  <CreditCard className="w-5 h-5 text-gold" />
                  <h3 className="text-lg text-white">Payment Configuration</h3>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs text-zinc-500">Provider</Label>
                    <Select
                      value={config?.payment?.provider || 'stripe_test'}
                      onValueChange={(value) => updateConfig('payment', { provider: value })}
                    >
                      <SelectTrigger className="bg-black/50 border-white/10 text-white mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-paper border-white/10">
                        <SelectItem value="stripe_test">Stripe Test Mode</SelectItem>
                        <SelectItem value="stripe_live">Stripe Live Mode</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label className="text-xs text-zinc-500">Test API Key</Label>
                    <div className="relative">
                      <Input
                        type={showSecrets.stripe_test ? 'text' : 'password'}
                        defaultValue={config?.payment?.stripe_test_key}
                        onBlur={(e) => updateConfig('payment', { stripe_test_key: e.target.value })}
                        className="input-dark mt-1 pr-10"
                        placeholder="sk_test_..."
                      />
                      <button
                        onClick={() => toggleSecret('stripe_test')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500"
                      >
                        {showSecrets.stripe_test ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-xs text-zinc-500">Live API Key</Label>
                    <div className="relative">
                      <Input
                        type={showSecrets.stripe_live ? 'text' : 'password'}
                        defaultValue={config?.payment?.stripe_live_key}
                        onBlur={(e) => updateConfig('payment', { stripe_live_key: e.target.value })}
                        className="input-dark mt-1 pr-10"
                        placeholder="sk_live_..."
                      />
                      <button
                        onClick={() => toggleSecret('stripe_live')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500"
                      >
                        {showSecrets.stripe_live ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-xs text-zinc-500">Platform Fee %</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      defaultValue={config?.payment?.platform_fee_percent || 25}
                      onBlur={(e) => updateConfig('payment', { platform_fee_percent: parseFloat(e.target.value) })}
                      className="input-dark mt-1"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-zinc-800/30">
                    <div>
                      <p className="text-sm text-white">Stripe Connect</p>
                      <p className="text-xs text-zinc-500">Enable creator payouts</p>
                    </div>
                    <Switch
                      checked={config?.payment?.stripe_connect_enabled}
                      onCheckedChange={(checked) => updateConfig('payment', { stripe_connect_enabled: checked })}
                    />
                  </div>
                </div>
              </div>

              {/* KYC Config */}
              <div className="glass p-6">
                <div className="flex items-center gap-2 mb-4">
                  <UserCheck className="w-5 h-5 text-gold" />
                  <h3 className="text-lg text-white">KYC/ID Verification</h3>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs text-zinc-500">Provider</Label>
                    <Select
                      value={config?.kyc?.provider || 'mock'}
                      onValueChange={(value) => updateConfig('kyc', { provider: value })}
                    >
                      <SelectTrigger className="bg-black/50 border-white/10 text-white mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-paper border-white/10">
                        <SelectItem value="mock">Mock (Demo)</SelectItem>
                        <SelectItem value="jumio">Jumio</SelectItem>
                        <SelectItem value="onfido">Onfido</SelectItem>
                        <SelectItem value="veriff">Veriff</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {config?.kyc?.provider === 'jumio' && (
                    <>
                      <div>
                        <Label className="text-xs text-zinc-500">Jumio API Key</Label>
                        <Input
                          type={showSecrets.jumio_key ? 'text' : 'password'}
                          defaultValue={config?.kyc?.jumio_api_key}
                          onBlur={(e) => updateConfig('kyc', { jumio_api_key: e.target.value })}
                          className="input-dark mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-zinc-500">Jumio API Secret</Label>
                        <Input
                          type="password"
                          defaultValue={config?.kyc?.jumio_api_secret}
                          onBlur={(e) => updateConfig('kyc', { jumio_api_secret: e.target.value })}
                          className="input-dark mt-1"
                        />
                      </div>
                    </>
                  )}
                  
                  {config?.kyc?.provider === 'onfido' && (
                    <div>
                      <Label className="text-xs text-zinc-500">Onfido API Key</Label>
                      <Input
                        type="password"
                        defaultValue={config?.kyc?.onfido_api_key}
                        onBlur={(e) => updateConfig('kyc', { onfido_api_key: e.target.value })}
                        className="input-dark mt-1"
                      />
                    </div>
                  )}
                  
                  {config?.kyc?.provider === 'veriff' && (
                    <>
                      <div>
                        <Label className="text-xs text-zinc-500">Veriff API Key</Label>
                        <Input
                          type="password"
                          defaultValue={config?.kyc?.veriff_api_key}
                          onBlur={(e) => updateConfig('kyc', { veriff_api_key: e.target.value })}
                          className="input-dark mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-zinc-500">Veriff API Secret</Label>
                        <Input
                          type="password"
                          defaultValue={config?.kyc?.veriff_api_secret}
                          onBlur={(e) => updateConfig('kyc', { veriff_api_secret: e.target.value })}
                          className="input-dark mt-1"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Referral Config */}
              <div className="glass p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Gift className="w-5 h-5 text-gold" />
                  <h3 className="text-lg text-white">Referral Program</h3>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-zinc-800/30">
                    <div>
                      <p className="text-sm text-white">Enable Referrals</p>
                      <p className="text-xs text-zinc-500">Allow users to refer others</p>
                    </div>
                    <Switch
                      checked={config?.referral?.enabled}
                      onCheckedChange={(checked) => updateConfig('referral', { enabled: checked })}
                    />
                  </div>
                  
                  <div>
                    <Label className="text-xs text-zinc-500">Creator Bonus %</Label>
                    <Input
                      type="number"
                      min="0"
                      max="50"
                      defaultValue={config?.referral?.creator_bonus_percent || 10}
                      onBlur={(e) => updateConfig('referral', { creator_bonus_percent: parseFloat(e.target.value) })}
                      className="input-dark mt-1"
                    />
                  </div>
                  
                  <div>
                    <Label className="text-xs text-zinc-500">User Bonus %</Label>
                    <Input
                      type="number"
                      min="0"
                      max="50"
                      defaultValue={config?.referral?.user_bonus_percent || 5}
                      onBlur={(e) => updateConfig('referral', { user_bonus_percent: parseFloat(e.target.value) })}
                      className="input-dark mt-1"
                    />
                  </div>
                  
                  <div>
                    <Label className="text-xs text-zinc-500">Bonus Duration (Months)</Label>
                    <Input
                      type="number"
                      min="1"
                      max="24"
                      defaultValue={config?.referral?.bonus_duration_months || 6}
                      onBlur={(e) => updateConfig('referral', { bonus_duration_months: parseInt(e.target.value) })}
                      className="input-dark mt-1"
                    />
                  </div>
                  
                  <div className="text-xs text-zinc-500 mt-2">
                    <p className="font-semibold text-white mb-2">Tiered Bonuses:</p>
                    <div className="space-y-1">
                      <p>🥉 Bronze: 1+ referrals = 5%</p>
                      <p>🥈 Silver: 5+ referrals = 7.5%</p>
                      <p>🥇 Gold: 10+ referrals = 10%</p>
                      <p>💎 Platinum: 25+ referrals = 12.5%</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Encryption Config */}
              <div className="glass p-6 lg:col-span-2">
                <div className="flex items-center gap-2 mb-4">
                  <Lock className="w-5 h-5 text-gold" />
                  <h3 className="text-lg text-white">E2EE Encryption</h3>
                </div>
                
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="flex items-center justify-between p-3 bg-zinc-800/30">
                    <div>
                      <p className="text-sm text-white">E2EE Enabled</p>
                      <p className="text-xs text-zinc-500">End-to-end encryption</p>
                    </div>
                    <Switch
                      checked={config?.encryption?.e2ee_enabled}
                      onCheckedChange={(checked) => updateConfig('encryption', { e2ee_enabled: checked })}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-zinc-800/30">
                    <div>
                      <p className="text-sm text-white">Use libsignal</p>
                      <p className="text-xs text-zinc-500">Signal Protocol (advanced)</p>
                    </div>
                    <Switch
                      checked={config?.encryption?.use_libsignal}
                      onCheckedChange={(checked) => updateConfig('encryption', { use_libsignal: checked })}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-zinc-800/30">
                    <div>
                      <p className="text-sm text-white">WebCrypto Fallback</p>
                      <p className="text-xs text-zinc-500">AES-GCM encryption</p>
                    </div>
                    <Switch
                      checked={config?.encryption?.fallback_webcrypto}
                      onCheckedChange={(checked) => updateConfig('encryption', { fallback_webcrypto: checked })}
                    />
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <div className="glass p-6">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left text-xs text-zinc-500 uppercase p-3">User</th>
                      <th className="text-left text-xs text-zinc-500 uppercase p-3">Email</th>
                      <th className="text-left text-xs text-zinc-500 uppercase p-3">Role</th>
                      <th className="text-left text-xs text-zinc-500 uppercase p-3">Status</th>
                      <th className="text-left text-xs text-zinc-500 uppercase p-3">2FA</th>
                      <th className="text-left text-xs text-zinc-500 uppercase p-3">Referrals</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-zinc-800 text-xs">
                                {u.username?.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-white text-sm">{u.username}</span>
                          </div>
                        </td>
                        <td className="p-3 text-sm text-zinc-400">{u.email}</td>
                        <td className="p-3">
                          <span className={`text-xs px-2 py-1 ${
                            u.role === 'super_admin' ? 'bg-gold/20 text-gold' :
                            u.role === 'admin' ? 'bg-purple-500/20 text-purple-400' :
                            u.role === 'creator' ? 'bg-emerald-500/20 text-emerald-400' :
                            'bg-zinc-700 text-zinc-400'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`text-xs ${
                            u.verification_status === 'verified' ? 'text-emerald-400' :
                            u.verification_status === 'pending' ? 'text-amber-400' :
                            'text-zinc-500'
                          }`}>
                            {u.verification_status || 'none'}
                          </span>
                        </td>
                        <td className="p-3">
                          {u.has_2fa ? (
                            <Shield className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <span className="text-xs text-zinc-600">—</span>
                          )}
                        </td>
                        <td className="p-3 text-sm text-zinc-400">{u.total_referrals || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* Creators Tab */}
          <TabsContent value="creators">
            <div className="glass p-6">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left text-xs text-zinc-500 uppercase p-3">Creator</th>
                      <th className="text-left text-xs text-zinc-500 uppercase p-3">Tier</th>
                      <th className="text-left text-xs text-zinc-500 uppercase p-3">Subscribers</th>
                      <th className="text-left text-xs text-zinc-500 uppercase p-3">Total Earnings</th>
                      <th className="text-left text-xs text-zinc-500 uppercase p-3">Pending Payout</th>
                      <th className="text-left text-xs text-zinc-500 uppercase p-3">Stripe</th>
                      <th className="text-left text-xs text-zinc-500 uppercase p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {creators.map((c) => (
                      <tr key={c.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-zinc-800 text-xs">
                                {c.display_name?.charAt(0) || 'C'}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-white text-sm">{c.display_name}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className={`text-xs px-2 py-1 ${
                            c.tier === 'elite' ? 'bg-amber-500/20 text-amber-400' :
                            c.tier === 'verified' ? 'bg-emerald-500/20 text-emerald-400' :
                            'bg-zinc-700 text-zinc-400'
                          }`}>
                            {c.tier}
                          </span>
                        </td>
                        <td className="p-3 text-sm text-white">{c.total_subscribers}</td>
                        <td className="p-3 text-sm text-gold">{formatCurrency(c.total_earnings)}</td>
                        <td className="p-3 text-sm text-white">{formatCurrency(c.pending_payout)}</td>
                        <td className="p-3">
                          {c.stripe_connect_id ? (
                            <span className="text-xs text-emerald-400">Connected</span>
                          ) : (
                            <span className="text-xs text-zinc-600">Not set</span>
                          )}
                        </td>
                        <td className="p-3">
                          {c.pending_payout > 0 && c.stripe_connect_id && (
                            <button
                              onClick={() => triggerPayout(c.id, c.pending_payout)}
                              className="text-xs text-gold hover:text-gold-hover"
                            >
                              Payout
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* Verifications Tab */}
          <TabsContent value="verifications">
            <div className="space-y-4">
              {verifications.length > 0 ? verifications.map((v) => (
                <div key={v.id} className="glass p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-zinc-800">
                          {v.user?.username?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-white">{v.user?.username}</p>
                        <p className="text-xs text-zinc-500">{v.user?.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2 py-1 ${
                        v.status === 'verified' ? 'bg-emerald-500/20 text-emerald-400' :
                        v.status === 'pending' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {v.status}
                      </span>
                      {v.status === 'pending' && (
                        <>
                          <button
                            onClick={() => updateVerificationStatus(v.id, 'verified')}
                            className="btn-gold text-xs py-1 px-3"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => updateVerificationStatus(v.id, 'rejected')}
                            className="btn-outline text-xs py-1 px-3 text-red-400"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )) : (
                <div className="glass p-8 text-center">
                  <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
                  <p className="text-zinc-500">No pending verifications</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Audit Log Tab */}
          <TabsContent value="audit">
            <div className="glass p-6">
              <div className="space-y-3">
                {auditLogs.length > 0 ? auditLogs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between p-3 bg-zinc-800/30">
                    <div>
                      <p className="text-sm text-white">{log.action}</p>
                      <p className="text-xs text-zinc-500">
                        {log.changes?.join(', ')}
                      </p>
                    </div>
                    <p className="text-xs text-zinc-600">
                      {new Date(log.timestamp).toLocaleString()}
                    </p>
                  </div>
                )) : (
                  <p className="text-center text-zinc-500">No audit logs</p>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SuperAdminPanel;
