import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, ArrowRight, Target, Calendar, User, Sparkles } from 'lucide-react';
import LifelyLogo from '../LifelyLogo';
import { useAuthContext } from '../AuthProvider';
import { getUserData, setUserData, clearUserOnboardingData } from '../../utils/userStorage';
import { supabase } from '../../lib/supabase';

interface ExtractedData {
  categories: Array<{id?: string; name: string; purpose: string; priority: number; icon?: string; color?: string}>;
  goals: Array<{id?: string; title: string; category: string; timeline: string; priority?: number}>;
  routines: Array<{id?: string; title: string; frequency: string; time: string; category?: string}>;
  todos?: Array<{id?: string; title: string; category: string; priority?: number}>;
  events?: Array<{id?: string; title: string; category: string; date?: string}>;
  notes?: Array<{id?: string; title: string; category: string; content?: string}>;
  workStyle: string;
  priorities: string[];
  interests: string[];
  personalInsights: string[];
}

export default function OnboardingComplete() {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [isCreatingDashboard, setIsCreatingDashboard] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    
    // Load the ACTUAL dashboard data that was created (not just extracted data) - user-specific
    const categoriesData = getUserData(user.id, 'lifeStructureCategories', []);
    const itemsData = getUserData(user.id, 'lifeStructureItems', []);
    const extractedDataRaw = getUserData(user.id, 'lifely_extracted_data', null);
    
    // ENHANCED DEBUGGING: Log exactly what we're getting
    console.log('🔍 ONBOARDING COMPLETE DEBUG - Raw data loaded:');
    console.log('   User ID:', user.id);
    console.log('   User email:', user.email);
    console.log('   Categories data type:', typeof categoriesData, 'length:', categoriesData?.length);
    console.log('   Categories preview:', categoriesData?.slice(0, 2));
    console.log('   Items data type:', typeof itemsData, 'length:', itemsData?.length);
    console.log('   Items preview:', itemsData?.slice(0, 2));
    console.log('   Extracted data:', extractedDataRaw);
    
    // CRITICAL FIX: Show completion screen if we have categories, even if items are missing
    // Items might be created in a separate step or sync later
    if (categoriesData.length > 0) {
      const categories = categoriesData;
      const items = itemsData;
      
      // Remove duplicates and clean up categories
      const uniqueCategories = categories.reduce((acc: any[], category: any) => {
        // Check if category name already exists
        const existing = acc.find(c => c.name === category.name);
        if (!existing) {
          // Fix icon display - convert icon names to actual emojis
          const fixedCategory = {
            ...category,
            icon: getIconForCategory(category.icon),
            priority: category.priority || 0
          };
          acc.push(fixedCategory);
        }
        return acc;
      }, []);
      
      // Remove duplicate items (handle empty items array)
      const uniqueItems = items && items.length > 0 ? items.reduce((acc: any[], item: any) => {
        const existing = acc.find(i => i.title === item.title && i.type === item.type);
        if (!existing) {
          acc.push(item);
        }
        return acc;
      }, []) : [];
      
      // Also get extracted insights if available
      let workStyle = "Focused and goal-oriented";
      let personalInsights = [
        "You have a balanced approach to life management",
        "Your priorities align with long-term growth",
        "You value both productivity and personal development"
      ];
      
      if (extractedDataRaw && typeof extractedDataRaw === 'object' && extractedDataRaw !== null) {
        workStyle = (extractedDataRaw as any).workStyle || workStyle;
        personalInsights = (extractedDataRaw as any).personalInsights || personalInsights;
      }
      
      // Create dashboard data structure from ACTUAL created data
      const dashboardData = {
        categories: uniqueCategories,
        goals: uniqueItems.filter((item: any) => item.type === 'goal'),
        routines: uniqueItems.filter((item: any) => item.type === 'routine'),
        todos: uniqueItems.filter((item: any) => item.type === 'todo'),
        events: uniqueItems.filter((item: any) => item.type === 'event'),
        notes: uniqueItems.filter((item: any) => item.type === 'note'),
        workStyle: workStyle,
        priorities: uniqueCategories.map((c: any) => c.name),
        interests: uniqueCategories.map((c: any) => c.purpose || c.name),
        personalInsights: personalInsights
      };
      
      console.log('🎯 OnboardingComplete: Loaded ACTUAL dashboard data for user:', user.email);
      console.log('📊 Categories found:', uniqueCategories.length, uniqueCategories.map((c: any) => c.name));
      console.log('📝 Items found:', uniqueItems.length, 'by type:', {
        goals: uniqueItems.filter((i: any) => i.type === 'goal').length,
        routines: uniqueItems.filter((i: any) => i.type === 'routine').length,
        todos: uniqueItems.filter((i: any) => i.type === 'todo').length,
        events: uniqueItems.filter((i: any) => i.type === 'event').length,
        notes: uniqueItems.filter((i: any) => i.type === 'note').length
      });
      
      console.log('🔧 CRITICAL DEBUG: About to setExtractedData with:', dashboardData);
      setExtractedData(dashboardData);
      console.log('✅ CRITICAL DEBUG: setExtractedData called successfully');
    } else {
      console.error('❌ OnboardingComplete: No dashboard data found for user:', user.email);
      console.error('🔧 DEBUGGING: Categories data:', categoriesData);
      console.error('🔧 DEBUGGING: Items data:', itemsData);
      console.error('🔧 DEBUGGING: Extracted data:', extractedDataRaw);
      
      // CRITICAL FIX: Instead of infinite loading, try to navigate to dashboard anyway
      // This allows users to access the app even if onboarding data is incomplete
      console.log('🔄 No dashboard data found, but navigating to dashboard anyway to prevent infinite loading');
      setTimeout(() => {
        setExtractedData({
          categories: [],
          goals: [],
          routines: [],
          todos: [],
          events: [],
          notes: [],
          workStyle: "Getting started with life organization",
          priorities: [],
          interests: [],
          personalInsights: ["Welcome to your dashboard! You can start adding categories and items manually."]
        });
      }, 2000);
    }
  }, [user?.id]);

  const markOnboardingCompleteInSupabase = async (): Promise<boolean> => {
    if (!user?.id) {
      console.error('❌ No user ID found - cannot mark onboarding complete in Supabase');
      return false;
    }

    try {
      console.log('🎯 Marking onboarding complete in Supabase for user:', user.email);
      
      const { error } = await supabase
        .from('profiles')
        .update({ 
          has_completed_onboarding: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) {
        console.error('❌ Error updating onboarding status in Supabase:', error);
        return false;
      }

      console.log('✅ Onboarding completion status synced to Supabase successfully');
      return true;
    } catch (error) {
      console.error('❌ Exception marking onboarding complete in Supabase:', error);
      return false;
    }
  };

  const populateAIContextFromOnboarding = async (userId: string): Promise<void> => {
    console.log('🧠 Populating AI context from onboarding data...');
    
    try {
      // Get all onboarding data
      const onboardingData = getUserData(userId, 'lifely_onboarding_data', null);
      const conversationData = getUserData(userId, 'lifely_onboarding_conversation', null);
      const voiceMemoData = getUserData(userId, 'lifely_voice_memo_recording', null);
      const dashboardData = getUserData(userId, 'lifely_extracted_data', null);
      const categoriesData = getUserData(userId, 'lifeStructureCategories', []);
      // Remove unused itemsData to fix TypeScript warning
      // const itemsData = getUserData(userId, 'lifeStructureItems', []);
      const integrationsData = getUserData(userId, 'lifely_onboarding_integrations', []);
      
      let aiContext = {
        summary: '',
        workStyle: '',
        workingHours: '',
        priorities: [] as string[],
        interests: [] as string[],
        goals: [] as string[],
        preferredTools: [] as string[],
        personalInsights: [] as string[]
      };
      
      // Extract from voice memo transcription (PRIMARY SOURCE)
      if (voiceMemoData && typeof voiceMemoData === 'object' && (voiceMemoData as any).transcription) {
        console.log('🎙️ Extracting context from voice memo transcription');
        const transcription = (voiceMemoData as any).transcription;
        aiContext.summary = `From voice memo: ${transcription.substring(0, 400)}${transcription.length > 400 ? '...' : ''}`;
        
        // Extract specific mentions from transcription
        const lowerTranscription = transcription.toLowerCase();
        if (lowerTranscription.includes('catholic') || lowerTranscription.includes('faith')) {
          aiContext.personalInsights.push('Strong Catholic faith and spiritual practice');
        }
        if (lowerTranscription.includes('gym') || lowerTranscription.includes('fitness') || lowerTranscription.includes('workout')) {
          aiContext.personalInsights.push('Active in fitness and gym routines');
        }
        if (lowerTranscription.includes('app') || lowerTranscription.includes('mobile') || lowerTranscription.includes('development')) {
          aiContext.personalInsights.push('Mobile app development and technology focused');
        }
        if (lowerTranscription.includes('entrepreneur') || lowerTranscription.includes('business')) {
          aiContext.personalInsights.push('Entrepreneurial mindset and business interests');
        }
      }
      
      // Extract from conversation data (SECONDARY SOURCE)
      if (conversationData && typeof conversationData === 'object' && (conversationData as any).answers) {
        console.log('💬 Extracting context from conversation answers');
        const answers = (conversationData as any).answers.map((a: any) => a.answer).filter(Boolean).join(' ');
        if (!aiContext.summary && answers.length > 10) {
          aiContext.summary = `From onboarding conversation: ${answers.substring(0, 400)}${answers.length > 400 ? '...' : ''}`;
        }
      }
      
      // Extract from categories (priorities)
      if (categoriesData.length > 0) {
        console.log('📊 Extracting priorities from categories');
        aiContext.priorities = categoriesData
          .sort((a: any, b: any) => (a.priority || 0) - (b.priority || 0))
          .map((c: any) => c.name);
      }
      
      // Extract from dashboard data
      if (dashboardData && typeof dashboardData === 'object') {
        console.log('📋 Extracting context from dashboard data');
        if ((dashboardData as any).workStyle) aiContext.workStyle = (dashboardData as any).workStyle;
        if ((dashboardData as any).personalInsights) {
          aiContext.personalInsights = [...aiContext.personalInsights, ...(dashboardData as any).personalInsights];
        }
      }
      
      // Extract from onboarding basics
      if (onboardingData && typeof onboardingData === 'object') {
        console.log('📝 Extracting context from basic onboarding data');
        if ((onboardingData as any).role) {
          aiContext.workStyle = aiContext.workStyle || `${(onboardingData as any).role} focused`;
        }
        if ((onboardingData as any).goals) {
          aiContext.goals = Array.isArray((onboardingData as any).goals) ? (onboardingData as any).goals : [(onboardingData as any).goals];
        }
      }
      
      // Extract from integrations
      if (integrationsData.length > 0) {
        console.log('🔗 Extracting tools from integrations');
        aiContext.preferredTools = integrationsData.map((integration: string) => {
          // Convert integration IDs to readable names
          switch (integration) {
            case 'google-calendar': return 'Google Calendar';
            case 'microsoft-calendar': return 'Microsoft Calendar';
            case 'notion': return 'Notion';
            case 'onenote': return 'OneNote';
            case 'todoist': return 'Todoist';
            case 'youtube': return 'YouTube';
            default: return integration;
          }
        });
      }
      
      // Set reasonable defaults
      if (!aiContext.workStyle) {
        aiContext.workStyle = 'Focused and goal-oriented';
      }
      if (!aiContext.workingHours) {
        aiContext.workingHours = '9am-5pm (flexible)';
      }
      if (!aiContext.summary) {
        aiContext.summary = 'User completed onboarding with personalized life management categories and goals';
      }
      
      // Save the populated context
      setUserData(userId, 'lifely_user_context', aiContext);
      
      console.log('✅ AI context populated successfully:', {
        summaryLength: aiContext.summary.length,
        workStyle: aiContext.workStyle,
        prioritiesCount: aiContext.priorities.length,
        insightsCount: aiContext.personalInsights.length,
        toolsCount: aiContext.preferredTools.length
      });
      
    } catch (error) {
      console.error('❌ Error populating AI context:', error);
    }
  };

  const createDashboard = async () => {
    setIsCreatingDashboard(true);
    
    try {
      console.log('🚀 OnboardingComplete: Creating dashboard and syncing to Supabase...');
      
      // Trigger the hybrid sync service to ensure all onboarding data is synced to Supabase
      if (window && (window as any).hybridSyncService) {
        console.log('🔄 Triggering final sync to Supabase...');
        await (window as any).hybridSyncService.manualSync();
        console.log('✅ Final sync completed');
      }
      
      // Dispatch event to refresh data in the main app
      window.dispatchEvent(new CustomEvent('hybridSyncComplete'));
      window.dispatchEvent(new CustomEvent('onboardingComplete'));
      
      // Mark onboarding as complete (user-specific)
      if (!user?.id) {
        console.error('❌ No user ID found - cannot complete onboarding');
        return;
      }
      
      // Mark complete in localStorage (for immediate UI updates)
      setUserData(user.id, 'lifely_onboarding_completed', true);
      setUserData(user.id, 'lifely_onboarding_progress', '/dashboard');
      
      // DEBUGGING: Force set both formats to ensure compatibility
      localStorage.setItem(`lifely_onboarding_completed_user_${user.id}`, 'true');
      localStorage.setItem('lifely_onboarding_completed', 'true'); // Legacy format too
      
      console.log('🔧 FORCED COMPLETION FLAGS SET:', {
        userSpecific: localStorage.getItem(`lifely_onboarding_completed_user_${user.id}`),
        legacy: localStorage.getItem('lifely_onboarding_completed'),
        userStorageResult: getUserData(user.id, 'lifely_onboarding_completed', false)
      });
      
      // Mark complete in Supabase (for cross-device sync and data consistency)
      const supabaseSuccess = await markOnboardingCompleteInSupabase();
      if (!supabaseSuccess) {
        console.warn('⚠️ Failed to sync onboarding completion to Supabase, but continuing with localStorage');
      }
      
      // CRITICAL: Auto-populate AI context with onboarding data
      await populateAIContextFromOnboarding(user.id);
      
      // Clean up temporary onboarding data (but keep categories and items)
      clearUserOnboardingData(user.id);
      
      console.log('✅ Onboarding completed for user:', user.email);
      
      console.log('🎉 Dashboard creation complete! Navigating to main app...');
      
      // Force a data refresh event to ensure categories are loaded
      window.dispatchEvent(new CustomEvent('forceDataRefresh'));
      
      // Navigate to main app after a brief delay to show success
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
      
    } catch (error) {
      console.error('❌ Error creating dashboard:', error);
      setIsCreatingDashboard(false);
      // Still navigate even if sync fails, since data is in localStorage
      setTimeout(() => {
        navigate('/dashboard');
      }, 1000);
    }
  };

  const getIconForCategory = (iconName?: string) => {
    // If it's already an emoji, return it (simplified check)
    if (iconName && iconName.length <= 4 && iconName.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF]/)) {
      return iconName;
    }
    
    // Map AI-generated icon names to actual emojis that match the personalized categories
    const iconMap: Record<string, string> = {
      'graduation-cap': '🎓',
      'briefcase': '💼',
      'dumbbell': '💪',
      'brain': '🧠',
      'heart': '❤️',
      'user': '👤',
      'users': '👥',
      'book': '📚',
      'home': '🏠',
      'fitness': '💪',
      'target': '🎯',
      'dollar-sign': '💰',
      'calendar': '📅',
      'computer': '💻',
      'music': '🎵',
      'cross': '✝️',
      'church': '⛪',
      'speech-bubble': '🗣️',
      'balance': '⚖️',
      'scales': '⚖️',
      'sparkles': '✨',
      'star': '⭐'
    };
    
    return iconMap[iconName || ''] || iconName || '📋';
  };

  const getColorClass = (color?: string) => {
    // Map AI-generated color names to Tailwind gradient classes for theme consistency
    const colorMap: Record<string, string> = {
      'blue': 'from-blue-500 to-blue-600',
      'purple': 'from-purple-500 to-purple-600',
      'green': 'from-green-500 to-green-600',
      'red': 'from-red-500 to-red-600',
      'yellow': 'from-yellow-500 to-yellow-600',
      'indigo': 'from-indigo-500 to-indigo-600',
      'pink': 'from-pink-500 to-pink-600',
      'orange': 'from-orange-500 to-orange-600',
      'teal': 'from-teal-500 to-teal-600',
      'cyan': 'from-cyan-500 to-cyan-600'
    };
    
    return colorMap[color || ''] || 'from-gray-500 to-gray-600';
  };

  // ENHANCED DEBUGGING: Log render state
  console.log('🖥️ ONBOARDING COMPLETE RENDER DEBUG:');
  console.log('   extractedData exists:', !!extractedData);
  console.log('   extractedData preview:', extractedData ? {
    categories: extractedData.categories?.length || 0,
    goals: extractedData.goals?.length || 0,
    routines: extractedData.routines?.length || 0,
    todos: extractedData.todos?.length || 0
  } : 'null');

  if (!extractedData) {
    console.log('🔄 ONBOARDING COMPLETE: Still loading data, showing spinner...');
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-gray-900 dark:to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading your personalized dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-gray-900 dark:to-indigo-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 py-12">
        <div className="max-w-4xl mx-auto text-center px-8">
          <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <LifelyLogo size={48} />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            Your Personalized Dashboard is Ready!
          </h1>
          <p className="text-blue-100 text-lg max-w-2xl mx-auto">
            Based on your onboarding responses, we've created a custom life management system 
            that matches your unique goals, preferences, and lifestyle.
          </p>
        </div>
      </div>

      {/* Results Overview */}
      <div className="max-w-6xl mx-auto p-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <div className="bg-white/80 dark:bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center border border-slate-200 dark:border-white/20 shadow-lg">
            <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mb-2">
              {extractedData.categories?.length || 0}
            </div>
            <div className="text-slate-600 dark:text-slate-300">Life Categories</div>
          </div>
          
          <div className="bg-white/80 dark:bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center border border-slate-200 dark:border-white/20 shadow-lg">
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-2">
              {extractedData.goals?.length || 0}
            </div>
            <div className="text-slate-600 dark:text-slate-300">Personal Goals</div>
          </div>
          
          <div className="bg-white/80 dark:bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center border border-slate-200 dark:border-white/20 shadow-lg">
            <div className="text-3xl font-bold text-indigo-500 dark:text-indigo-300 mb-2">
              {extractedData.routines?.length || 0}
            </div>
            <div className="text-slate-600 dark:text-slate-300">Daily Routines</div>
          </div>
          
          <div className="bg-white/80 dark:bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center border border-slate-200 dark:border-white/20 shadow-lg">
            <div className="text-3xl font-bold text-purple-500 dark:text-purple-300 mb-2">
              {extractedData.todos?.length || 0}
            </div>
            <div className="text-slate-600 dark:text-slate-300">Action Items</div>
          </div>
        </div>

        {/* Categories Preview */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-3">
            <User className="w-6 h-6" />
            Your Life Categories
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(extractedData.categories || []).map((category, index) => (
              <div 
                key={category.id || index}
                className="bg-white/90 dark:bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-slate-200 dark:border-white/20 hover:bg-white dark:hover:bg-white/20 transition-all shadow-lg hover:shadow-xl"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: category.color }}>
                    {category.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-1">
                      {category.name}
                    </h3>
                    <p className="text-slate-600 dark:text-slate-300 text-sm mb-2">
                      {category.purpose || 'Personalized life category'}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 dark:text-slate-400">Priority:</span>
                      <div className="flex gap-1">
                        {Array.from({length: 5}).map((_, i) => (
                          <div 
                            key={i}
                            className={`w-2 h-2 rounded-full ${
                              i <= Math.min(category.priority || 0, 4) ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">({category.priority === 0 ? 'Foundation' : category.priority || 0})</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Goals Preview */}
        {(extractedData.goals?.length || 0) > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-3">
              <Target className="w-6 h-6" />
              Your Goals
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(extractedData.goals || []).slice(0, 4).map((goal, index) => (
                <div 
                  key={goal.id || index}
                  className="bg-white/90 dark:bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-slate-200 dark:border-white/20 shadow-lg"
                >
                  <div className="flex items-start gap-3 mb-2">
                    <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-lg">🎯</span>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
                      {goal.title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-4 text-sm ml-11">
                    <span className="bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 px-2 py-1 rounded">
                      {extractedData.categories?.find(cat => cat.id === goal.category)?.name || goal.category || 'Goal'}
                    </span>
                    <span className="text-slate-600 dark:text-slate-300">📅 {goal.timeline || 'Ongoing'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Routines Preview */}
        {(extractedData.routines?.length || 0) > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-3">
              <Calendar className="w-6 h-6" />
              Your Routines
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(extractedData.routines || []).slice(0, 6).map((routine, index) => (
                <div 
                  key={routine.id || index}
                  className="bg-white/90 dark:bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-slate-200 dark:border-white/20 shadow-lg"
                >
                  <h3 className="font-semibold text-slate-800 dark:text-white mb-1">
                    {routine.title}
                  </h3>
                  <div className="text-sm text-slate-600 dark:text-slate-300">
                    <div>{routine.frequency || 'Daily'}</div>
                    <div>{routine.time || 'Flexible timing'}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Personal Insights */}
        {(extractedData.personalInsights?.length || 0) > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-3">
              <Sparkles className="w-6 h-6" />
              Personal Insights
            </h2>
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-500/20 dark:to-blue-500/20 rounded-xl p-6 border border-blue-200 dark:border-blue-400/30 shadow-lg">
              <div className="space-y-3">
                {(extractedData.personalInsights || []).map((insight, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                    <p className="text-slate-700 dark:text-slate-200">{insight}</p>
                  </div>
                ))}
              </div>
              
              {extractedData.workStyle && (
                <div className="mt-6 p-4 bg-white/70 dark:bg-white/10 rounded-lg border border-slate-200 dark:border-white/20">
                  <h4 className="font-semibold text-slate-800 dark:text-white mb-2">Your Work Style:</h4>
                  <p className="text-slate-600 dark:text-slate-300">{extractedData.workStyle}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="text-center">
          <button
            onClick={createDashboard}
            disabled={isCreatingDashboard}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-12 py-4 rounded-xl font-semibold text-lg transition-all duration-300 hover:scale-105 hover:shadow-lg flex items-center gap-3 mx-auto disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreatingDashboard ? (
              <>
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Creating Your Dashboard...
              </>
            ) : (
              <>
                <span>🚀 Launch My Dashboard</span>
                <ArrowRight className="w-6 h-6" />
              </>
            )}
          </button>
          
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-4">
            Your personalized life management system is ready to go!
          </p>
        </div>
      </div>
    </div>
  );
}