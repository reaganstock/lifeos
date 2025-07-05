import React, { useEffect } from 'react';
import { useAuthContext } from '../AuthProvider';
import { supabase } from '../../lib/supabase';
import { Tables } from '../../types/supabase';
import { getUserData } from '../../utils/userStorage';

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
        console.log('🔍 Checking onboarding completion for user:', user.email);
        
        // CRITICAL FIX: Use same localStorage-first logic as App.tsx for consistency
        
        // Step 1: Check localStorage first (primary source of truth)
        const localCompleted = getUserData(user.id, 'lifely_onboarding_completed', false);
        console.log('📊 Local completion status:', localCompleted);
        
        if (localCompleted) {
          console.log('✅ User completed onboarding (localStorage confirmed) - redirect to dashboard');
          window.location.href = '/dashboard';
          return;
        }
        
        // Step 2: Check if user has dashboard data (indicates completed onboarding)
        const localCategories = getUserData(user.id, 'lifeStructureCategories', []);
        const localItems = getUserData(user.id, 'lifeStructureItems', []);
        console.log('📊 Dashboard data check:', { 
          categories: localCategories.length, 
          items: localItems.length 
        });
        
        if (localCategories.length > 0 || localItems.length > 0) {
          console.log('✅ User has dashboard data - redirect to dashboard');
          window.location.href = '/dashboard';
          return;
        }
        
        // Step 3: Fallback to Supabase categories check
        const { data: categories, error: categoriesError } = await supabase
          .from('categories')
          .select('id')
          .eq('user_id', user.id)
          .limit(1);
          
        if (!categoriesError && categories && categories.length > 0) {
          console.log('✅ User has Supabase categories - redirect to dashboard');
          window.location.href = '/dashboard';
          return;
        }
        
        // If we reach here, user needs onboarding
        console.log('🆕 New user needs onboarding - redirect to onboarding');
        window.location.href = '/onboarding';

      } catch (error) {
        console.error('Error in auth callback:', error);
        // Conservative fallback - if there's an error, assume new user needs onboarding
        console.log('❌ Error during auth callback, defaulting to onboarding for safety');
        window.location.href = '/onboarding';
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