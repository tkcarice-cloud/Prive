import { Link } from 'react-router-dom';
import { Shield, Lock, Eye, DollarSign, MessageSquare, Video } from 'lucide-react';
import Navigation from '../components/Navigation';

const Landing = () => {
  return (
    <div className="min-h-screen bg-obsidian relative overflow-hidden">
      <Navigation />
      
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center pt-16">
        {/* Background Elements */}
        <div className="absolute inset-0 noise-overlay" />
        <div className="absolute top-1/4 right-0 w-96 h-96 bg-gold/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-0 w-64 h-64 bg-emerald/5 rounded-full blur-3xl" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left Content */}
            <div className="space-y-8 animate-fade-in">
              <div className="inline-flex items-center gap-2 text-emerald-400 text-xs font-mono uppercase tracking-wider">
                <Shield className="w-4 h-4" />
                <span>End-to-End Encrypted</span>
              </div>
              
              <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl text-white leading-[1.1] tracking-tight">
                The Inner Circle of
                <span className="block text-gold">Creator Content</span>
              </h1>
              
              <p className="text-lg text-zinc-400 max-w-xl leading-relaxed">
                A luxury, privacy-first platform where verified creators and discerning patrons 
                connect through encrypted channels. Premium by design, exclusive by trust.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Link
                  to="/register"
                  data-testid="hero-join-btn"
                  className="btn-gold text-center"
                >
                  Apply to Join
                </Link>
                <Link
                  to="/discover"
                  data-testid="hero-discover-btn"
                  className="btn-outline text-center"
                >
                  Explore Creators
                </Link>
              </div>
              
              {/* Trust Indicators */}
              <div className="flex items-center gap-8 pt-8 border-t border-white/5">
                <div className="text-center">
                  <p className="text-2xl font-display text-white">75%</p>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Creator Revenue</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-display text-white">E2EE</p>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">All Messages</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-display text-white">ID+</p>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Verified Users</p>
                </div>
              </div>
            </div>
            
            {/* Right Visual */}
            <div className="relative hidden lg:block animate-fade-in delay-200">
              <div className="aspect-[4/5] relative">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-obsidian/50 to-obsidian z-10" />
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80"
                  alt="Premium Creator"
                  className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700"
                />
                {/* Floating Card */}
                <div className="absolute bottom-8 left-8 right-8 glass p-6 z-20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-gold/20 flex items-center justify-center">
                      <Lock className="w-5 h-5 text-gold" />
                    </div>
                    <div>
                      <p className="text-sm text-white">Verified Creator</p>
                      <p className="text-xs text-emerald-400 font-mono">ID Verified • Encrypted</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-zinc-500">
                    <span>Premium Tier</span>
                    <span className="text-gold">$29.99/mo</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Features Section */}
      <section className="py-32 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-xs text-gold uppercase tracking-widest mb-4">Why PRIVÉ</p>
            <h2 className="font-display text-4xl sm:text-5xl text-white">
              Premium by Every Measure
            </h2>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Shield,
                title: "Identity Verified",
                description: "Government ID + real-time selfie verification required for all users and creators."
              },
              {
                icon: Lock,
                title: "E2E Encrypted",
                description: "Messages, voice, and video calls are end-to-end encrypted. We never see your content."
              },
              {
                icon: DollarSign,
                title: "75% Revenue Share",
                description: "Industry-leading creator payouts. Keep more of what you earn."
              },
              {
                icon: Eye,
                title: "Privacy First",
                description: "Minimal data retention, no platform-side recording, creator-controlled availability."
              },
              {
                icon: MessageSquare,
                title: "Paid Messaging",
                description: "Monetize every interaction. Set your own rates for DMs and responses."
              },
              {
                icon: Video,
                title: "Private Calls",
                description: "Pay-per-minute voice and video calls with automatic billing."
              }
            ].map((feature, index) => (
              <div
                key={index}
                className="glass p-8 hover:border-gold/30 transition-all duration-300 group"
                data-testid={`feature-${index}`}
              >
                <div className="w-12 h-12 bg-zinc-900 flex items-center justify-center mb-6 group-hover:bg-gold/10 transition-colors">
                  <feature.icon className="w-6 h-6 text-gold" />
                </div>
                <h3 className="text-lg text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="py-32 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-gold/5 to-transparent" />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="font-display text-4xl sm:text-5xl text-white mb-6">
            Ready to Join the Inner Circle?
          </h2>
          <p className="text-lg text-zinc-400 mb-10">
            Whether you're a creator seeking premium tools or a patron seeking exclusive content, 
            PRIVÉ offers a verified, encrypted experience above all others.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/register?role=creator"
              data-testid="cta-creator-btn"
              className="btn-gold"
            >
              Apply as Creator
            </Link>
            <Link
              to="/register"
              data-testid="cta-member-btn"
              className="btn-outline"
            >
              Join as Member
            </Link>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="border-t border-white/5 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gold flex items-center justify-center">
                <span className="font-display text-black text-xs font-semibold">P</span>
              </div>
              <span className="font-display text-white">PRIVÉ</span>
            </div>
            <div className="flex items-center gap-6 text-xs text-zinc-500">
              <span>© 2025 PRIVÉ. All rights reserved.</span>
              <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
              <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
