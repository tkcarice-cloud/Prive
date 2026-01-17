import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import Navigation from '../components/Navigation';
import { 
  Shield, 
  User,
  Lock,
  Bell,
  CreditCard,
  LogOut
} from 'lucide-react';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

const Settings = () => {
  const { user, logout } = useAuth();
  const [notifications, setNotifications] = useState({
    messages: true,
    subscriptions: true,
    payments: true,
    marketing: false
  });

  const handleLogout = () => {
    logout();
    toast.success('Signed out successfully');
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
          <TabsList className="bg-zinc-900/50 border border-white/5 p-1 mb-6">
            <TabsTrigger 
              value="profile"
              className="data-[state=active]:bg-gold data-[state=active]:text-black"
            >
              <User className="w-4 h-4 mr-2" />
              Profile
            </TabsTrigger>
            <TabsTrigger 
              value="privacy"
              className="data-[state=active]:bg-gold data-[state=active]:text-black"
            >
              <Lock className="w-4 h-4 mr-2" />
              Privacy
            </TabsTrigger>
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
              <button className="btn-gold">Save Changes</button>
            </div>
          </TabsContent>

          <TabsContent value="privacy">
            <div className="glass p-6 space-y-6">
              <div className="flex items-center justify-between gap-2 text-emerald-400 mb-4">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  <span className="text-sm font-mono">Your Security Status</span>
                </div>
                <span className={`text-xs uppercase tracking-wider ${
                  user?.verification_status === 'verified' ? 'text-emerald-400' : 'text-amber-400'
                }`}>
                  {user?.verification_status || 'Not Verified'}
                </span>
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
                    <p className="text-sm text-white">Two-Factor Authentication</p>
                    <p className="text-xs text-zinc-500">Add an extra layer of security</p>
                  </div>
                  <Switch />
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
    </div>
  );
};

export default Settings;
