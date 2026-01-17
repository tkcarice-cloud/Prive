import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import axios from 'axios';
import Navigation from '../components/Navigation';
import { 
  Shield, 
  Camera, 
  CreditCard, 
  CheckCircle, 
  Loader2,
  Upload,
  AlertCircle
} from 'lucide-react';
import { Progress } from '../components/ui/progress';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Verification = () => {
  const { user, token, refreshUser, isVerified } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState(null);
  
  const [idFront, setIdFront] = useState(null);
  const [idBack, setIdBack] = useState(null);
  const [selfie, setSelfie] = useState(null);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);

  useEffect(() => {
    checkVerificationStatus();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (isVerified) {
      navigate('/dashboard');
    }
  }, [isVerified, navigate]);

  const checkVerificationStatus = async () => {
    try {
      const response = await axios.get(`${API}/verification/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVerificationStatus(response.data.status);
      if (response.data.status === 'pending') {
        setStep(4);
      }
    } catch (error) {
      console.error('Error checking verification status:', error);
    }
  };

  const handleFileUpload = (e, setter) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setter(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setCameraActive(true);
    } catch (error) {
      toast.error('Unable to access camera. Please allow camera permissions.');
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setSelfie(dataUrl);
      stopCamera();
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCameraActive(false);
  };

  const submitVerification = async () => {
    if (!idFront || !selfie) {
      toast.error('Please complete all verification steps');
      return;
    }

    setLoading(true);
    try {
      await axios.post(
        `${API}/verification/submit`,
        {
          id_type: 'government_id',
          id_front_url: idFront,
          id_back_url: idBack,
          selfie_url: selfie
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Verification submitted successfully!');
      await refreshUser();
      setStep(4);
      setVerificationStatus('pending');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Verification submission failed');
    } finally {
      setLoading(false);
    }
  };

  const progressValue = (step / 4) * 100;

  return (
    <div className="min-h-screen bg-obsidian">
      <Navigation />
      
      <div className="max-w-2xl mx-auto px-4 pt-24 pb-16">
        <div className="text-center mb-12 animate-fade-in">
          <div className="inline-flex items-center gap-2 text-emerald-400 text-xs font-mono uppercase tracking-wider mb-4">
            <Shield className="w-4 h-4" />
            <span>Identity Verification</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl text-white mb-4">
            Verify Your Identity
          </h1>
          <p className="text-zinc-500">
            Complete verification to access all features. Your data is encrypted and secure.
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <Progress value={progressValue} className="h-1 bg-zinc-800" />
          <div className="flex justify-between mt-2 text-xs text-zinc-500">
            <span className={step >= 1 ? 'text-gold' : ''}>ID Upload</span>
            <span className={step >= 2 ? 'text-gold' : ''}>Back of ID</span>
            <span className={step >= 3 ? 'text-gold' : ''}>Selfie</span>
            <span className={step >= 4 ? 'text-gold' : ''}>Complete</span>
          </div>
        </div>

        <div className="glass p-8 animate-fade-in delay-200">
          {/* Step 1: ID Front */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gold/10 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-gold" />
                </div>
                <div>
                  <h2 className="text-lg text-white">Government-Issued ID</h2>
                  <p className="text-xs text-zinc-500">Upload the front of your ID</p>
                </div>
              </div>

              {idFront ? (
                <div className="relative">
                  <img 
                    src={idFront} 
                    alt="ID Front" 
                    className="w-full h-48 object-cover border border-white/10"
                  />
                  <button
                    onClick={() => setIdFront(null)}
                    className="absolute top-2 right-2 p-2 bg-black/80 text-white text-xs"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <label className="block cursor-pointer">
                  <div className="border-2 border-dashed border-white/10 p-12 text-center hover:border-gold/50 transition-colors">
                    <Upload className="w-8 h-8 text-zinc-500 mx-auto mb-3" />
                    <p className="text-sm text-zinc-400">Click to upload or drag and drop</p>
                    <p className="text-xs text-zinc-600 mt-1">PNG, JPG up to 10MB</p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, setIdFront)}
                    className="hidden"
                    data-testid="upload-id-front"
                  />
                </label>
              )}

              <button
                onClick={() => setStep(2)}
                disabled={!idFront}
                className="btn-gold w-full disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="step1-next"
              >
                Continue
              </button>
            </div>
          )}

          {/* Step 2: ID Back */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gold/10 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-gold" />
                </div>
                <div>
                  <h2 className="text-lg text-white">Back of ID</h2>
                  <p className="text-xs text-zinc-500">Upload the back of your ID (optional)</p>
                </div>
              </div>

              {idBack ? (
                <div className="relative">
                  <img 
                    src={idBack} 
                    alt="ID Back" 
                    className="w-full h-48 object-cover border border-white/10"
                  />
                  <button
                    onClick={() => setIdBack(null)}
                    className="absolute top-2 right-2 p-2 bg-black/80 text-white text-xs"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <label className="block cursor-pointer">
                  <div className="border-2 border-dashed border-white/10 p-12 text-center hover:border-gold/50 transition-colors">
                    <Upload className="w-8 h-8 text-zinc-500 mx-auto mb-3" />
                    <p className="text-sm text-zinc-400">Click to upload or drag and drop</p>
                    <p className="text-xs text-zinc-600 mt-1">Optional but recommended</p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, setIdBack)}
                    className="hidden"
                    data-testid="upload-id-back"
                  />
                </label>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="btn-outline flex-1"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="btn-gold flex-1"
                  data-testid="step2-next"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Selfie */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gold/10 flex items-center justify-center">
                  <Camera className="w-5 h-5 text-gold" />
                </div>
                <div>
                  <h2 className="text-lg text-white">Real-Time Selfie</h2>
                  <p className="text-xs text-zinc-500">Take a photo to verify it's you</p>
                </div>
              </div>

              {selfie ? (
                <div className="relative">
                  <img 
                    src={selfie} 
                    alt="Selfie" 
                    className="w-full h-64 object-cover border border-white/10"
                  />
                  <button
                    onClick={() => setSelfie(null)}
                    className="absolute top-2 right-2 p-2 bg-black/80 text-white text-xs"
                  >
                    Retake
                  </button>
                </div>
              ) : cameraActive ? (
                <div className="relative">
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    className="w-full h-64 object-cover border border-white/10"
                  />
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3">
                    <button
                      onClick={capturePhoto}
                      className="btn-gold"
                      data-testid="capture-selfie"
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      Capture
                    </button>
                    <button
                      onClick={stopCamera}
                      className="btn-outline"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={startCamera}
                  className="w-full border-2 border-dashed border-white/10 p-12 text-center hover:border-gold/50 transition-colors"
                  data-testid="start-camera"
                >
                  <Camera className="w-8 h-8 text-zinc-500 mx-auto mb-3" />
                  <p className="text-sm text-zinc-400">Click to start camera</p>
                  <p className="text-xs text-zinc-600 mt-1">We'll take a quick photo</p>
                </button>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="btn-outline flex-1"
                >
                  Back
                </button>
                <button
                  onClick={submitVerification}
                  disabled={!selfie || loading}
                  className="btn-gold flex-1 flex items-center justify-center gap-2"
                  data-testid="submit-verification"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Shield className="w-4 h-4" />
                      <span>Submit for Review</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Pending/Complete */}
          {step === 4 && (
            <div className="text-center py-8">
              {verificationStatus === 'pending' ? (
                <>
                  <div className="w-16 h-16 bg-amber-500/10 flex items-center justify-center mx-auto mb-6">
                    <AlertCircle className="w-8 h-8 text-amber-400" />
                  </div>
                  <h2 className="font-display text-2xl text-white mb-2">Verification Pending</h2>
                  <p className="text-zinc-500 mb-8">
                    Your documents are being reviewed. This typically takes 1-24 hours.
                  </p>
                </>
              ) : verificationStatus === 'verified' ? (
                <>
                  <div className="w-16 h-16 bg-emerald-500/10 flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="w-8 h-8 text-emerald-400" />
                  </div>
                  <h2 className="font-display text-2xl text-white mb-2">Verification Complete</h2>
                  <p className="text-zinc-500 mb-8">
                    You now have full access to all PRIVÉ features.
                  </p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-red-500/10 flex items-center justify-center mx-auto mb-6">
                    <AlertCircle className="w-8 h-8 text-red-400" />
                  </div>
                  <h2 className="font-display text-2xl text-white mb-2">Verification Issue</h2>
                  <p className="text-zinc-500 mb-8">
                    Please resubmit your documents or contact support.
                  </p>
                  <button
                    onClick={() => setStep(1)}
                    className="btn-gold"
                  >
                    Try Again
                  </button>
                </>
              )}
              
              {verificationStatus === 'pending' && (
                <button
                  onClick={() => navigate('/dashboard')}
                  className="btn-outline"
                  data-testid="go-to-dashboard"
                >
                  Go to Dashboard
                </button>
              )}
            </div>
          )}
        </div>

        {/* Security Note */}
        <div className="mt-8 flex items-center justify-center gap-2 text-xs text-emerald-400/70">
          <Shield className="w-3.5 h-3.5" />
          <span className="font-mono">Your data is encrypted and never shared</span>
        </div>
      </div>
    </div>
  );
};

export default Verification;
