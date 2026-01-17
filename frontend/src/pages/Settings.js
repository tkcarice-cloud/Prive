import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import Navigation from '../components/Navigation';
import { 
  Shield, 
  User,
  Lock,
  Bell,
  CreditCard,
  LogOut,
  Loader2,
  Key,
  Copy,
  CheckCircle
} from 'lucide-react';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Settings = () => {
  const { user, token, logout, refreshUser } = useAuth();
  const [notifications, setNotifications] = useState({
    messages: true,
    subscriptions: true,
    payments: true,
    marketing: false
  });
  
  // 2FA State
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [twoFAData, setTwoFAData] = useState(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [loading2FA, setLoading2FA] = useState(false);
  const [disableCode, setDisableCode] = useState('');
  const [showDisable2FA, setShowDisable2FA] = useState(false);

  // Stripe Connect State
  const [stripeStatus, setStripeStatus] = useState(null);
  const [loadingStripe, setLoadingStripe] = useState(false);

  useEffect(() => {
    if (user?.role === 'creator') {
      fetchStripeStatus();
    }
  }, [user]);

  const fetchStripeStatus = async () => {
    try {
      const response = await axios.get(`${API}/creator/stripe-connect/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStripeStatus(response.data);
    } catch (error) {
      console.error('Error fetching Stripe status:', error);
    }
  };

  const handleLogout = () => {
    logout();
    toast.success('Signed out successfully');
  };

  const setup2FA = async () => {
    setLoading2FA(true);
    try {
      const response = await axios.post(`${API}/auth/2fa/setup`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTwoFAData(response.data);
      setShow2FASetup(true);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to setup 2FA');
    } finally {
      setLoading2FA(false);
    }
  };

  const confirm2FA = async () => {
    if (!verifyCode || verifyCode.length !== 6) {
      toast.error('Please enter a 6-digit code');
      return;
    }

    setLoading2FA(true);
    try {
      await axios.post(`${API}/auth/2fa/confirm`, 
        { totp_code: verifyCode },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('2FA enabled successfully!');
      setShow2FASetup(false);
      setTwoFAData(null);
      setVerifyCode('');
      refreshUser();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid code');
    } finally {
      setLoading2FA(false);
    }
  };

  const disable2FA = async () => {
    if (!disableCode || disableCode.length !== 6) {
      toast.error('Please enter a 6-digit code');
      return;
    }

    setLoading2FA(true);
    try {
      await axios.post(`${API}/auth/2fa/disable`, 
        { totp_code: disableCode },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('2FA disabled');
      setShowDisable2FA(false);
      setDisableCode('');
      refreshUser();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid code');
    } finally {
      setLoading2FA(false);
    }
  };

  const setupStripeConnect = async () => {
    setLoadingStripe(true);
    try {
      // First, create account if not exists
      if (!stripeStatus?.connected) {
        await axios.post(`${API}/creator/stripe-connect/setup`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      // Get onboarding link
      const response = await axios.post(`${API}/creator/stripe-connect/onboard`, {
        return_url: `${window.location.origin}/settings`,
        refresh_url: `${window.location.origin}/settings`
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      window.location.href = response.data.onboarding_url;
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to setup payouts');
    } finally {
      setLoadingStripe(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="min-h-screen bg-obsidian">
      <Navigation />
      
      <div className="max-w-3xl mx-auto px-4 pt-24 pb-16">
        <div className="mb-8 animate-fade-in">
          <h1 className="font-display text-3xl text-white mb-2">Settings</h1>
          <p className="text-zinc-500">Manage your account preferences</p>
        </div>

        <Tabs defaultValue="profile" className="animate-fade-in delay-100">
          <TabsList className="bg-zinc-900/50 border border-white/5 p-1 mb-6 flex-wrap">
            <TabsTrigger 
              value="profile"
              className="data-[state=active]:bg-gold data-[state=active]:text-black"
            >
              <User className="w-4 h-4 mr-2" />
              Profile
            </TabsTrigger>
            <TabsTrigger 
              value="security"
              className="data-[state=active]:bg-gold data-[state=active]:text-black"
            >
              <Lock className="w-4 h-4 mr-2" />
              Security
            </TabsTrigger>
            {user?.role === 'creator' && (
              <TabsTrigger 
                value="payouts"
                className="data-[state=active]:bg-gold data-[state=active]:text-black"
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Payouts
              </TabsTrigger>
            )}
            <TabsTrigger 
              value="notifications"
              className="data-[state=active]:bg-gold data-[state=active]:text-black"
            >
              <Bell className="w-4 h-4 mr-2" />
              Notifications
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <div className="glass p-6 space-y-6">
              <div>
                <Label className="text-zinc-400 text-xs uppercase">Email</Label>
                <Input
                  value={user?.email || ''}
                  disabled
                  className="input-dark mt-1 opacity-60"
                />
              </div>
              <div>
                <Label className="text-zinc-400 text-xs uppercase">Username</Label>
                <Input
                  value={user?.username || ''}
                  disabled
                  className="input-dark mt-1 opacity-60"
                />
              </div>
              <div>
                <Label className="text-zinc-400 text-xs uppercase">Display Name</Label>
                <Input
                  defaultValue={user?.display_name || ''}
                  className="input-dark mt-1"
                  placeholder="Your display name"
                />
              </div>
              <div>
                <Label className="text-zinc-400 text-xs uppercase">Bio</Label>
                <textarea
                  defaultValue={user?.bio || ''}
                  className="input-dark mt-1 w-full min-h-[100px] resize-none p-3"
                  placeholder="Tell us about yourself..."
                />
              </div>
              <div>
                <Label className="text-zinc-400 text-xs uppercase">Your Referral Code</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    value={user?.referral_code || ''}
                    disabled
                    className="input-dark opacity-80 font-mono"
                  />
                  <button
                    onClick={() => copyToClipboard(user?.referral_code)}
                    className="btn-outline p-3"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <button className="btn-gold">Save Changes</button>
            </div>
          </TabsContent>

          <TabsContent value="security">
            <div className="glass p-6 space-y-6">
              <div className="flex items-center justify-between gap-2 text-emerald-400 mb-4">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  <span className="text-sm font-mono">Security Status</span>
                </div>
                <span className={`text-xs uppercase tracking-wider ${
                  user?.verification_status === 'verified' ? 'text-emerald-400' : 'text-amber-400'
                }`}>
                  {user?.verification_status || 'Not Verified'}
                </span>
              </div>

              {/* 2FA Section */}
              <div className="p-4 bg-zinc-800/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white flex items-center gap-2">
                      <Key className="w-4 h-4 text-gold" />
                      Two-Factor Authentication
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">
                      {user?.has_2fa 
                        ? 'Your account is protected with 2FA' 
                        : 'Add an extra layer of security to your account'}
                    </p>
                  </div>
                  {user?.has_2fa ? (
                    <button
                      onClick={() => setShowDisable2FA(true)}
                      className="btn-outline text-xs py-2 px-4 text-red-400 border-red-400/30"
                    >
                      Disable
                    </button>
                  ) : (
                    <button
                      onClick={setup2FA}
                      disabled={loading2FA}
                      className="btn-gold text-xs py-2 px-4"
                      data-testid="setup-2fa"
                    >
                      {loading2FA ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enable 2FA'}
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-zinc-800/30">
                  <div>
                    <p className="text-sm text-white">End-to-End Encryption</p>
                    <p className="text-xs text-zinc-500">All messages and calls are encrypted</p>
                  </div>
                  <span className="text-xs text-emerald-400 font-mono">ENABLED</span>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-zinc-800/30">
                  <div>
                    <p className="text-sm text-white">Hide Online Status</p>
                    <p className="text-xs text-zinc-500">Don't show when you're active</p>
                  </div>
                  <Switch />
                </div>
              </div>
            </div>
          </TabsContent>

          {user?.role === 'creator' && (
            <TabsContent value="payouts">
              <div className="glass p-6 space-y-6">
                <div className="flex items-center gap-2 mb-4">
                  <CreditCard className="w-5 h-5 text-gold" />
                  <h3 className="text-lg text-white">Stripe Connect</h3>
                </div>

                {stripeStatus?.connected ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/30">
                      <div className="flex items-center gap-2 text-emerald-400 mb-2">
                        <CheckCircle className="w-5 h-5" />
                        <span className="font-semibold">Connected</span>
                      </div>
                      <p className="text-xs text-zinc-400">
                        Your Stripe account is linked for payouts.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-zinc-800/30">
                        <p className="text-xs text-zinc-500">Charges Enabled</p>
                        <p className={`text-sm ${stripeStatus?.charges_enabled ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {stripeStatus?.charges_enabled ? 'Yes' : 'Pending'}
                        </p>
                      </div>
                      <div className="p-4 bg-zinc-800/30">
                        <p className="text-xs text-zinc-500">Payouts Enabled</p>
                        <p className={`text-sm ${stripeStatus?.payouts_enabled ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {stripeStatus?.payouts_enabled ? 'Yes' : 'Pending'}
                        </p>
                      </div>
                    </div>

                    {!stripeStatus?.details_submitted && (
                      <button
                        onClick={setupStripeConnect}
                        disabled={loadingStripe}
                        className="btn-gold w-full flex items-center justify-center gap-2"
                      >
                        {loadingStripe ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Complete Onboarding'
                        )}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CreditCard className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                    <h3 className="text-lg text-white mb-2">Setup Payouts</h3>
                    <p className="text-sm text-zinc-500 mb-6">
                      Connect your Stripe account to receive payouts for your earnings.
                    </p>
                    <button
                      onClick={setupStripeConnect}
                      disabled={loadingStripe}
                      className="btn-gold flex items-center justify-center gap-2 mx-auto"
                      data-testid="setup-stripe"
                    >
                      {loadingStripe ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <CreditCard className="w-4 h-4" />
                          Connect Stripe
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </TabsContent>
          )}

          <TabsContent value="notifications">
            <div className="glass p-6 space-y-4">
              {[
                { key: 'messages', label: 'New Messages', desc: 'Get notified when you receive messages' },
                { key: 'subscriptions', label: 'Subscription Updates', desc: 'New subscribers and renewals' },
                { key: 'payments', label: 'Payment Confirmations', desc: 'Tips, purchases, and payouts' },
                { key: 'marketing', label: 'Marketing Emails', desc: 'Platform updates and promotions' }
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between p-4 bg-zinc-800/30">
                  <div>
                    <p className="text-sm text-white">{item.label}</p>
                    <p className="text-xs text-zinc-500">{item.desc}</p>
                  </div>
                  <Switch 
                    checked={notifications[item.key]}
                    onCheckedChange={(checked) => setNotifications({...notifications, [item.key]: checked})}
                  />
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Danger Zone */}
        <div className="glass p-6 mt-8 border-red-500/20 animate-fade-in delay-200">
          <h3 className="text-sm text-red-400 uppercase tracking-wider mb-4">Danger Zone</h3>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors"
            data-testid="logout-btn"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out of Account</span>
          </button>
        </div>
      </div>

      {/* 2FA Setup Dialog */}
      <Dialog open={show2FASetup} onOpenChange={setShow2FASetup}>
        <DialogContent className="bg-paper border-white/10 max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-white flex items-center gap-2">
              <Key className="w-5 h-5 text-gold" />
              Setup Two-Factor Authentication
            </DialogTitle>
            <DialogDescription className="text-zinc-500">
              Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)
            </DialogDescription>
          </DialogHeader>

          {twoFAData && (
            <div className="space-y-4 py-4">
              <div className="flex justify-center">
                <img 
                  src={twoFAData.qr_code} 
                  alt="2FA QR Code"
                  className="w-48 h-48"
                />
              </div>

              <div className="bg-zinc-800/50 p-3">
                <Label className="text-xs text-zinc-500">Manual Entry Key</Label>
                <div className="flex items-center justify-between mt-1">
                  <code className="text-xs text-gold break-all">{twoFAData.secret}</code>
                  <button onClick={() => copyToClipboard(twoFAData.secret)} className="text-zinc-500 hover:text-white">
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="bg-zinc-800/50 p-3">
                <Label className="text-xs text-zinc-500">Backup Codes (save these!)</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {twoFAData.backup_codes.map((code, i) => (
                    <code key={i} className="text-xs text-zinc-300 bg-black/30 p-1 text-center">{code}</code>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs text-zinc-500">Enter Code to Verify</Label>
                <Input
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="input-dark mt-1 text-center text-2xl font-mono tracking-widest"
                  data-testid="2fa-code-input"
                />
              </div>

              <button
                onClick={confirm2FA}
                disabled={loading2FA || verifyCode.length !== 6}
                className="btn-gold w-full flex items-center justify-center gap-2"
                data-testid="confirm-2fa"
              >
                {loading2FA ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Enable 2FA'
                )}
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Disable 2FA Dialog */}
      <Dialog open={showDisable2FA} onOpenChange={setShowDisable2FA}>
        <DialogContent className="bg-paper border-white/10 max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-white">Disable 2FA</DialogTitle>
            <DialogDescription className="text-zinc-500">
              Enter your current 2FA code to disable two-factor authentication.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Input
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="input-dark text-center text-2xl font-mono tracking-widest"
            />

            <button
              onClick={disable2FA}
              disabled={loading2FA || disableCode.length !== 6}
              className="btn-outline w-full text-red-400 border-red-400/30"
            >
              {loading2FA ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Disable 2FA'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Settings;
