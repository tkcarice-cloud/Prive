import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import Navigation from '../components/Navigation';
import { 
  Shield, 
  Search,
  Star,
  Filter
} from 'lucide-react';
import { Input } from '../components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Discover = () => {
  const { token } = useAuth();
  const [creators, setCreators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState('all');

  useEffect(() => {
    fetchCreators();
  }, [tierFilter]);

  const fetchCreators = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (tierFilter && tierFilter !== 'all') {
        params.append('tier', tierFilter);
      }
      params.append('limit', '50');
      
      const response = await axios.get(`${API}/discover?${params.toString()}`);
      setCreators(response.data);
    } catch (error) {
      console.error('Error fetching creators:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCreators = creators.filter(creator => 
    creator.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    creator.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getTierBadge = (tier) => {
    switch (tier) {
      case 'elite':
        return <span className="badge-elite">Elite</span>;
      case 'verified':
        return <span className="badge-verified">Verified</span>;
      default:
        return <span className="badge-standard">Standard</span>;
    }
  };

  return (
    <div className="min-h-screen bg-obsidian">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 pt-24 pb-16">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <h1 className="font-display text-3xl sm:text-4xl text-white mb-2">
            Discover Creators
          </h1>
          <p className="text-zinc-500">Find verified creators in the inner circle</p>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8 animate-fade-in delay-100">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input
              type="text"
              placeholder="Search creators..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-dark pl-10"
              data-testid="search-input"
            />
          </div>
          <Select value={tierFilter} onValueChange={setTierFilter}>
            <SelectTrigger className="w-full sm:w-48 bg-black/50 border-white/10 text-white" data-testid="tier-filter">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filter by tier" />
            </SelectTrigger>
            <SelectContent className="bg-paper border-white/10">
              <SelectItem value="all">All Tiers</SelectItem>
              <SelectItem value="elite">Elite</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="standard">Standard</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Creators Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredCreators.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-fade-in delay-200">
            {filteredCreators.map((creator) => (
              <Link
                key={creator.id}
                to={`/creator/${creator.id}`}
                className="card-creator group"
                data-testid={`creator-card-${creator.id}`}
              >
                {/* Cover Image */}
                <div className="aspect-[3/2] relative overflow-hidden">
                  {creator.cover_url ? (
                    <img 
                      src={creator.cover_url} 
                      alt={creator.display_name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-900" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  
                  {/* Tier Badge */}
                  <div className="absolute top-3 right-3">
                    {getTierBadge(creator.tier)}
                  </div>
                </div>

                {/* Creator Info */}
                <div className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar className="h-12 w-12 border-2 border-white/10">
                      <AvatarImage src={creator.avatar_url} />
                      <AvatarFallback className="bg-zinc-800 text-gold">
                        {creator.display_name?.charAt(0) || 'C'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm text-white font-medium truncate">
                          {creator.display_name}
                        </p>
                        {creator.verification_status === 'verified' && (
                          <Shield className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 font-mono">@{creator.username}</p>
                    </div>
                  </div>

                  {creator.bio && (
                    <p className="text-xs text-zinc-400 line-clamp-2 mb-3">
                      {creator.bio}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-white/5">
                    <div className="flex items-center gap-1 text-xs text-zinc-500">
                      <Star className="w-3.5 h-3.5" />
                      <span>{creator.total_subscribers || 0} subscribers</span>
                    </div>
                    <span className="text-gold font-semibold text-sm">
                      ${creator.subscription_price}/mo
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 glass">
            <Search className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
            <h3 className="text-lg text-white mb-2">No creators found</h3>
            <p className="text-sm text-zinc-500">
              Try adjusting your search or filters
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Discover;
