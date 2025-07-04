import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export default function OAuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // Small delay to allow the main OAuth handler in App.tsx to process first
    const timer = setTimeout(() => {
      console.log('🔗 OAuth callback component - redirecting to integrations');
      navigate('/onboarding/integrations', { replace: true });
    }, 1000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-lifeos-50 via-lifeos-100 to-lifeos-200 font-sans flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-lifeos-primary to-lifeos-secondary rounded-2xl flex items-center justify-center shadow-xl mx-auto mb-6">
          <Loader2 className="w-8 h-8 text-white animate-spin" />
        </div>
        <h2 className="text-2xl font-bold text-lifeos-dark mb-2">
          Processing Integration
        </h2>
        <p className="text-lifeos-gray-400">
          Connecting your account and returning to setup...
        </p>
      </div>
    </div>
  );
}