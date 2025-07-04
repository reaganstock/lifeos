import React, { useEffect } from 'react';
import { useAuthContext } from '../AuthProvider';
import { supabase } from '../../lib/supabase';
import { Tables } from '../../types/supabase';

export function AuthCallback() {
  const { user, loading, initialized } = useAuthContext();

  useEffect(() => {
    const handleAuthCallback = async () => {
      console.log('🔐 Auth callback - checking user status...');
      
      if (!initialized || loading) {
        console.log('⏳ Waiting for auth to initialize...');
        return;
      }

      if (!user) {
        console.log('❌ No user found, redirecting to auth...');
        window.location.href = '/auth';
        return;
      }

      try {
        // Check if this is a new user by looking at their profile creation time
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('created_at, has_completed_onboarding')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error fetching profile:', error);
          // If profile doesn't exist, treat as new user
          console.log('👤 No profile found - treating as new user');
          const isDevelopment = process.env.NODE_ENV === 'development';
          if (isDevelopment) {
            window.location.href = '/onboarding';
          } else {
            window.location.href = 'https://app.lifely.dev/onboarding';
          }
          return;
        }

        // Check if user has completed onboarding - handle potential missing column gracefully
        const profileData = profile as any;
        const hasCompletedOnboarding = profileData?.has_completed_onboarding;
        if (hasCompletedOnboarding !== true) {
          console.log('🆕 User needs onboarding');
          const isDevelopment = process.env.NODE_ENV === 'development';
          if (isDevelopment) {
            window.location.href = '/onboarding';
          } else {
            window.location.href = 'https://app.lifely.dev/onboarding';
          }
          return;
        }

        // Existing user who has completed onboarding - go to dashboard
        console.log('✅ Returning user - redirecting to dashboard');
        const isDevelopment = process.env.NODE_ENV === 'development';
        if (isDevelopment) {
          window.location.href = '/dashboard';
        } else {
          window.location.href = 'https://app.lifely.dev/dashboard';
        }

      } catch (error) {
        console.error('Error in auth callback:', error);
        // Fallback to dashboard for existing users
        window.location.href = '/dashboard';
      }
    };

    handleAuthCallback();
  }, [user, loading, initialized]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-blue-100 to-purple-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Setting up your account...</p>
      </div>
    </div>
  );
}

export default AuthCallback;