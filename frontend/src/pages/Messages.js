import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import Navigation from '../components/Navigation';
import { 
  Shield, 
  Lock, 
  Send,
  Loader2,
  ArrowLeft
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Input } from '../components/ui/input';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Messages = () => {
  const { partnerId } = useParams();
  const { user, token, isVerified } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [partner, setPartner] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (partnerId) {
      fetchMessages();
    } else {
      fetchConversations();
    }
  }, [partnerId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchConversations = async () => {
    try {
      const response = await axios.get(`${API}/messages/conversations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConversations(response.data);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    try {
      const response = await axios.get(`${API}/messages/${partnerId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(response.data);
      
      // Get partner info
      if (response.data.length > 0) {
        const partnerMsg = response.data.find(m => m.sender_id === partnerId);
        if (partnerMsg) {
          // Fetch partner user info
          const userRes = await axios.get(`${API}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          // For now, use basic info
          setPartner({ id: partnerId, display_name: 'User' });
        }
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    if (!isVerified) {
      toast.error('Please verify your identity to send messages');
      return;
    }

    setSending(true);
    try {
      const response = await axios.post(
        `${API}/messages`,
        {
          recipient_id: partnerId,
          content: newMessage,
          is_paid: false
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setMessages([...messages, response.data]);
      setNewMessage('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  // Conversation List View
  if (!partnerId) {
    return (
      <div className="min-h-screen bg-obsidian">
        <Navigation />
        
        <div className="max-w-2xl mx-auto px-4 pt-24 pb-16">
          <div className="mb-8 animate-fade-in">
            <h1 className="font-display text-3xl text-white mb-2">Messages</h1>
            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <Shield className="w-4 h-4" />
              <span className="font-mono">End-to-End Encrypted</span>
            </div>
          </div>

          {!isVerified && (
            <div className="glass border-amber-500/30 p-4 mb-6 animate-fade-in">
              <div className="flex items-center gap-3">
                <Lock className="w-5 h-5 text-amber-400" />
                <div>
                  <p className="text-sm text-white">Verification Required</p>
                  <p className="text-xs text-zinc-500">Complete identity verification to send messages</p>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-gold animate-spin" />
            </div>
          ) : conversations.length > 0 ? (
            <div className="space-y-2 animate-fade-in delay-100">
              {conversations.map((conv) => (
                <Link
                  key={conv.partner?.id}
                  to={`/messages/${conv.partner?.id}`}
                  className="glass p-4 flex items-center gap-4 hover:border-gold/30 transition-colors block"
                  data-testid={`conversation-${conv.partner?.id}`}
                >
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={conv.partner?.avatar_url} />
                    <AvatarFallback className="bg-zinc-800">
                      {conv.partner?.display_name?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-white font-medium">
                        {conv.partner?.display_name || conv.partner?.username}
                      </p>
                      {conv.unread_count > 0 && (
                        <span className="bg-gold text-black text-xs px-2 py-0.5">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Lock className="w-3 h-3 text-emerald-400" />
                      <p className="text-xs text-zinc-500 truncate">
                        {conv.last_message?.content}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="glass p-8 text-center animate-fade-in delay-100">
              <Lock className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
              <h3 className="text-lg text-white mb-2">No conversations yet</h3>
              <p className="text-sm text-zinc-500">
                Start a conversation by visiting a creator's profile
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Chat View
  return (
    <div className="min-h-screen bg-obsidian flex flex-col">
      <Navigation />
      
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 pt-24 pb-4 flex flex-col">
        {/* Chat Header */}
        <div className="glass p-4 mb-4 flex items-center gap-4 animate-fade-in">
          <Link to="/messages" className="text-zinc-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-zinc-800">U</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="text-sm text-white">Conversation</p>
            <div className="flex items-center gap-1 text-xs text-emerald-400">
              <Lock className="w-3 h-3" />
              <span className="font-mono">Encrypted</span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 mb-4 animate-fade-in delay-100">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-gold animate-spin" />
            </div>
          ) : messages.length > 0 ? (
            <>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                  data-testid={`message-${msg.id}`}
                >
                  <div
                    className={`max-w-[80%] p-4 ${
                      msg.sender_id === user?.id
                        ? 'bg-gold/20 border border-gold/30'
                        : 'glass'
                    }`}
                  >
                    <p className="text-sm text-white">{msg.content}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Lock className="w-3 h-3 text-emerald-400" />
                      <span className="text-xs text-zinc-500">
                        {new Date(msg.created_at).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </>
          ) : (
            <div className="text-center py-8">
              <Lock className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
              <p className="text-sm text-zinc-500">Start an encrypted conversation</p>
            </div>
          )}
        </div>

        {/* Message Input */}
        <form onSubmit={sendMessage} className="glass p-4 animate-fade-in delay-200">
          <div className="flex items-center gap-3">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={isVerified ? "Type a message..." : "Verify identity to message"}
              disabled={!isVerified || sending}
              className="input-dark flex-1"
              data-testid="message-input"
            />
            <button
              type="submit"
              disabled={!isVerified || sending || !newMessage.trim()}
              className="btn-gold p-3 disabled:opacity-50"
              data-testid="send-message-btn"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="text-xs text-emerald-400/70 mt-2 flex items-center gap-1">
            <Shield className="w-3 h-3" />
            <span className="font-mono">Messages are end-to-end encrypted</span>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Messages;
