import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import CategoryPage from './components/CategoryPage';
import Sidebar from './components/Sidebar';
import GlobalTodos from './components/GlobalTodos';
import GlobalCalendar from './components/GlobalCalendar';
import LifeCategoriesManager from './components/LifeCategoriesManager';
import GlobalGoals from './components/GlobalGoals';
import GlobalRoutines from './components/GlobalRoutines';
import GlobalNotes from './components/GlobalNotes';
import Settings from './components/Settings';
import Notification from './components/Notification';
import AIAssistant from './components/AIAssistant';
import AuthScreen from './components/onboarding/AuthScreen';
import AuthCallback from './components/onboarding/AuthCallback';
import Onboarding from './components/onboarding/Onboarding';
import DocumentUpload from './components/onboarding/DocumentUpload';
import IntegrationsSetup from './components/onboarding/IntegrationsSetup';
// import OnboardingProcessing from './components/onboarding/OnboardingProcessing';
import OnboardingProcessingNew from './components/onboarding/OnboardingProcessingNew';
import OnboardingComplete from './components/onboarding/OnboardingComplete';
import OnboardingConversation from './components/onboarding/OnboardingConversation';
import VoiceMemoOnboarding from './components/onboarding/VoiceMemoOnboarding';
import OAuthCallback from './components/onboarding/OAuthCallback';
// import SignInRequired from './components/SignInRequired';
import { AuthProvider, useAuthContext } from './components/AuthProvider';
import { ThemeProvider } from './contexts/ThemeContext';
// Removed initialData import - users create their own categories
import { useSupabaseData } from './hooks/useSupabaseData';
import { shouldShowMigration, createMigrationManager, MigrationProgress } from './utils/migration';
import { Item } from './types';
import './App.css';
import { useHybridSync } from './hooks/useHybridSync';
import { cleanupOldAudio } from './utils/audioStorage';
import { cleanupOldImages } from './utils/imageStorage';
import { IntegrationManager } from './services/integrations/IntegrationManager';
import { getUserData, setUserData } from './utils/userStorage';
import { supabase } from './lib/supabase';

function AppContent() {
  const { user, loading: authLoading, initialized: authInitialized } = useAuthContext();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    categories: _supabaseCategories,
    loading: _dataLoading,
    error: dataError,
    initialized: dataInitialized,
    createCategory,
    updateCategory,
    deleteCategory,
    createItem,
    updateItem,
    deleteItem,
    bulkCreateItems,
    bulkUpdateItems,
    bulkDeleteItems,
    refreshData,
    ensureProfileExists
  } = useSupabaseData();

  // User-specific localStorage state to prevent data contamination
  const [localItems, setLocalItems] = useState<Item[]>(() => {
    // Don't load any data until user is initialized to prevent contamination
    return [];
  });

  // User-specific localStorage categories state to prevent data contamination
  const [localCategories, setLocalCategories] = useState<any[]>(() => {
    // Don't load any data until user is initialized to prevent contamination
    return [];
  });

  // Get current view from URL path
  const getCurrentView = () => {
    const path = location.pathname;
    if (path === '/' || path === '/dashboard') return 'dashboard';
    if (path.startsWith('/category/')) return path.split('/')[2];
    return path.substring(1); // Remove leading slash
  };
  
  const currentView = getCurrentView();
  
  // Check if we're in onboarding or auth flows
  const isOnboardingFlow = location.pathname.startsWith('/onboarding') || location.pathname.startsWith('/auth');
  
  // Check onboarding completion status (user-specific) - hybrid localStorage + Supabase
  const [isOnboardingCompleted, setIsOnboardingCompleted] = useState(false);
  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(true); // CRITICAL: Prevent redirect until check completes
  const [onboardingProgress, setOnboardingProgress] = useState('/onboarding');
  
  // CRITICAL FIX: Onboarding completion detection that properly persists across refreshes
  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!user?.id) {
        console.log('⏳ No user ID yet, waiting...');
        setIsOnboardingCompleted(false);
        setIsCheckingOnboarding(true); // Keep checking until user ID is available
        return;
      }
      
      console.log('🔍 Checking onboarding status for user:', user.email);
      
      // ALWAYS check localStorage first - this is the source of truth
      const localCompleted = getUserData(user.id, 'lifely_onboarding_completed', false);
      const localProgress = getUserData(user.id, 'lifely_onboarding_progress', '/onboarding');
      
      console.log('📊 Local storage check:', { localCompleted, localProgress });
      
      if (localCompleted) {
        console.log('✅ User completed onboarding (localStorage confirmed):', user.email);
        setIsOnboardingCompleted(true);
        setIsCheckingOnboarding(false); // CRITICAL: Stop checking, user is completed
        setOnboardingProgress(localProgress);
        return;
      }
      
      // ENHANCED: Also check if user has dashboard data (indicates completed onboarding)
      const localCategories = getUserData(user.id, 'lifeStructureCategories', []);
      const localItems = getUserData(user.id, 'lifeStructureItems', []);
      
      if (localCategories.length > 0 || localItems.length > 0) {
        console.log('✅ Found dashboard data - user has completed onboarding:', user.email);
        console.log('📊 Dashboard stats:', { 
          categories: localCategories.length, 
          items: localItems.length 
        });
        
        // Auto-mark as completed since they have data
        setUserData(user.id, 'lifely_onboarding_completed', true);
        setIsOnboardingCompleted(true);
        setIsCheckingOnboarding(false); // CRITICAL: Stop checking, user has data
        setOnboardingProgress('/dashboard');
        return;
      }
      
      // Only check Supabase if localStorage doesn't have completion flag or data
      // Wait for data to initialize before checking Supabase
      if (!dataInitialized) {
        console.log('⏳ Waiting for data initialization...');
        setIsOnboardingCompleted(false);
        setIsCheckingOnboarding(true); // Keep checking until data is initialized
        setOnboardingProgress('/onboarding');
        return;
      }
      
      // Fallback: Check Supabase categories
      try {
        const { data: categories, error } = await supabase
          .from('categories')
          .select('id')
          .eq('user_id', user.id)
          .limit(1);
          
        if (!error && categories && categories.length > 0) {
          console.log('✅ Existing user with Supabase categories - skip onboarding:', user.email);
          setUserData(user.id, 'lifely_onboarding_completed', true);
          setIsOnboardingCompleted(true);
          setIsCheckingOnboarding(false); // CRITICAL: Stop checking, user has Supabase data
        } else {
          console.log('📝 New user - needs onboarding:', user.email);
          setUserData(user.id, 'lifely_onboarding_progress', '/onboarding');
          setOnboardingProgress('/onboarding');
          setIsOnboardingCompleted(false);
          setIsCheckingOnboarding(false); // CRITICAL: Stop checking, decision made
        }
      } catch (error) {
        console.warn('⚠️ Error checking Supabase categories, using localStorage state:', error);
        setIsOnboardingCompleted(false);
        setIsCheckingOnboarding(false); // CRITICAL: Stop checking even on error
      }
    };
    
    checkOnboardingStatus();
  }, [user?.id, user?.email, dataInitialized]);
  
  // Listen for onboarding completion events
  useEffect(() => {
    const handleOnboardingComplete = () => {
      if (user?.id) {
        console.log('🎉 Onboarding complete event received for user:', user.email);
        setIsOnboardingCompleted(true);
        setIsCheckingOnboarding(false); // CRITICAL: Stop checking when onboarding completes
        // Force a small delay to ensure data is saved
        setTimeout(() => {
          const verified = getUserData(user.id, 'lifely_onboarding_completed', false);
          console.log('✅ Verified onboarding completion in localStorage:', verified);
        }, 100);
      }
    };
    
    window.addEventListener('onboardingComplete', handleOnboardingComplete);
    return () => window.removeEventListener('onboardingComplete', handleOnboardingComplete);
  }, [user?.id, user?.email]);
  
  // Removed showAuthModal - now using AuthScreen directly
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState<MigrationProgress | null>(null);
  
  const showLanding = currentView === 'landing';
  const [notification, setNotification] = useState({
    isVisible: false,
    message: '',
    type: 'success' as 'success' | 'error' | 'info'
  });
  const [mainSidebarWidth, setMainSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('sidebarWidth');
    return saved ? parseInt(saved) : 256;
  });
  const [isMainSidebarCollapsed, setIsMainSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved === 'true';
  });

  // AI Assistant state
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [aiSidebarWidth, setAiSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('aiSidebarWidth');
    return saved ? Math.min(parseInt(saved), window.innerWidth / 2) : Math.min(400, window.innerWidth / 2);
  });
  const [isAiSidebarCollapsed, setIsAiSidebarCollapsed] = useState(false);

  // Load user-specific data when user changes
  useEffect(() => {
    if (user?.id) {
      console.log('🔄 Loading user-specific data for:', user.email);
      
      // Update onboarding state for this user
      const userCompleted = getUserData(user.id, 'lifely_onboarding_completed', false);
      const userProgress = getUserData(user.id, 'lifely_onboarding_progress', '/onboarding');
      setIsOnboardingCompleted(userCompleted);
      setOnboardingProgress(userProgress);
      
      // Load user-specific items
      const userItems = getUserData(user.id, 'lifeStructureItems', []);
      const formattedItems = userItems.map((item: any) => ({
        ...item,
        createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
        updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
        dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
        dateTime: item.dateTime ? new Date(item.dateTime) : undefined,
        metadata: {
          ...item.metadata,
          eventDate: item.metadata?.eventDate ? new Date(item.metadata.eventDate) : undefined
        }
      }));
      setLocalItems(formattedItems);
      
      // Load user-specific categories
      const userCategories = getUserData(user.id, 'lifeStructureCategories', []);
      const formattedCategories = userCategories.map((category: any) => ({
        ...category,
        createdAt: category.createdAt ? new Date(category.createdAt) : new Date(),
        updatedAt: category.updatedAt ? new Date(category.updatedAt) : new Date()
      }));
      setLocalCategories(formattedCategories);
      
      console.log(`📊 Loaded ${formattedItems.length} items and ${formattedCategories.length} categories for user ${user.email}`);
      
      // CRITICAL FIX: Expose user data utilities to window for geminiService access
      (window as any).currentUser = user;
      (window as any).userStorageUtils = { getUserData, setUserData };
      console.log('🔧 Exposed user data utilities to window for geminiService');
    } else {
      // Clear data when no user
      setLocalItems([]);
      setLocalCategories([]);
      setIsOnboardingCompleted(false);
      setOnboardingProgress('/onboarding');
      
      // Clear window exposure when no user
      (window as any).currentUser = null;
      (window as any).userStorageUtils = null;
    }
  }, [user?.id, user?.email]);

  // OAuth callback handling
  useEffect(() => {
    const handleOAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      
      if (code) {
        // Prevent duplicate processing
        const processedKey = `oauth_processed_${code.substring(0, 10)}`;
        if (sessionStorage.getItem(processedKey)) {
          console.log('🔗 OAuth code already processed, skipping...');
          return;
        }
        
        // Mark as being processed
        sessionStorage.setItem(processedKey, 'true');
        
        console.log('🔗 OAuth callback detected with code:', code.substring(0, 10) + '...');
        console.log('🕐 Processing at:', new Date().toISOString());
        
        try {
          // Determine which provider based on URL or state
          const isNotionCallback = window.location.pathname.includes('/auth/notion/callback') || 
                                 window.location.search.includes('notion');
          const isGoogleCallback = window.location.pathname.includes('/auth/google/callback') || 
                                 window.location.search.includes('google') ||
                                 state?.includes('google');
          const isMicrosoftCallback = window.location.search.includes('microsoft') ||
                                    state?.includes('microsoft');
          const isOneNoteCallback = window.location.search.includes('onenote') ||
                                  state?.includes('onenote');
          // General Microsoft OAuth for cases where we can't distinguish between Calendar and OneNote
          const isGeneralMicrosoftCallback = (code && !isNotionCallback && !isGoogleCallback && !isMicrosoftCallback && !isOneNoteCallback &&
                                           (code.startsWith('M.') || code.includes('microsoftonline') || urlParams.get('session_state')));
          
          if (isNotionCallback) {
            console.log('🔗 Processing Notion OAuth callback...');
            
            // Exchange code for access token
            const tokenResponse = await IntegrationManager.exchangeNotionCode(code);
            console.log('✅ Notion token exchange successful:', {
              workspace: tokenResponse.workspace_name,
              bot_id: tokenResponse.bot_id
            });
            
            // SECURITY NOTE: Temporary storage for integration setup only
            // These tokens should be moved to the backend integration service
            // and cleared after successful database storage
            sessionStorage.setItem('notion_access_token', tokenResponse.access_token);
            sessionStorage.setItem('notion_workspace', tokenResponse.workspace_name);
            
            // Auto-clear tokens after 5 minutes for security
            setTimeout(() => {
              sessionStorage.removeItem('notion_access_token');
              sessionStorage.removeItem('notion_workspace');
            }, 5 * 60 * 1000);
            
            showNotification(`✅ Successfully connected to Notion workspace: ${tokenResponse.workspace_name}`, 'success');
            
            // Clean up URL params only (don't change page)
            const currentPath = window.location.pathname;
            window.history.replaceState({}, document.title, currentPath);
            
            // Set a flag to auto-connect when user opens integration manager
            sessionStorage.setItem('notion_auto_connect', 'true');
            
          } else if (isGoogleCallback) {
            console.log('🔗 Processing Google Calendar OAuth callback...');
            
            const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID!;
            const clientSecret = process.env.REACT_APP_GOOGLE_CLIENT_SECRET!;
            const redirectUri = `${window.location.origin}/oauth/callback`;
            
            // Exchange code for access token
            const tokenResponse = await IntegrationManager.exchangeGoogleCode(code, clientId, clientSecret, redirectUri);
            console.log('✅ Google Calendar token exchange successful');
            
            // SECURITY NOTE: Temporary storage for integration setup only
            sessionStorage.setItem('google_access_token', tokenResponse.access_token);
            sessionStorage.setItem('google_refresh_token', tokenResponse.refresh_token);
            
            // Auto-clear tokens after 5 minutes for security
            setTimeout(() => {
              sessionStorage.removeItem('google_access_token');
              sessionStorage.removeItem('google_refresh_token');
            }, 5 * 60 * 1000);
            
            showNotification('✅ Successfully connected to Google Calendar', 'success');
            
            // Clean up URL params only (don't change page)
            const currentPath = window.location.pathname;
            window.history.replaceState({}, document.title, currentPath);
            
            // Set a flag to auto-connect when user opens integration manager
            sessionStorage.setItem('google_auto_connect', 'true');

          } else if (isMicrosoftCallback) {
            console.log('🔗 Processing Microsoft Calendar OAuth callback...');
            console.log('🔑 Using client ID:', process.env.REACT_APP_MICROSOFT_CLIENT_ID?.substring(0, 8) + '...');
            console.log('🕐 Code received at:', new Date().toISOString());
            
            const clientId = process.env.REACT_APP_MICROSOFT_CLIENT_ID!;
            const redirectUri = `${window.location.origin}/oauth/callback`;
            
            console.log('🔄 Starting token exchange immediately (PKCE flow - no client secret)...');
            // Exchange code for access token using PKCE (no client secret for SPA)
            const tokenResponse = await IntegrationManager.exchangeMicrosoftCode(code, clientId, '', redirectUri);
            console.log('✅ Microsoft Calendar token exchange successful');
            
            // SECURITY NOTE: Temporary storage for integration setup only
            sessionStorage.setItem('microsoft_access_token', tokenResponse.access_token);
            sessionStorage.setItem('microsoft_refresh_token', tokenResponse.refresh_token);
            
            // Auto-clear tokens after 5 minutes for security
            setTimeout(() => {
              sessionStorage.removeItem('microsoft_access_token');
              sessionStorage.removeItem('microsoft_refresh_token');
            }, 5 * 60 * 1000);
            
            showNotification('✅ Successfully connected to Microsoft Calendar', 'success');
            
            // Set a flag to auto-connect when user opens integration manager
            sessionStorage.setItem('microsoft_auto_connect', 'true');
            
            // Navigate back to integrations screen for onboarding flow
            // Note: OAuthCallback component will handle navigation
            
          } else if (isOneNoteCallback) {
            console.log('🔗 Processing OneNote OAuth callback...');
            console.log('🔑 Using client ID:', process.env.REACT_APP_MICROSOFT_CLIENT_ID?.substring(0, 8) + '...');
            console.log('🕐 Code received at:', new Date().toISOString());
            
            const clientId = process.env.REACT_APP_MICROSOFT_CLIENT_ID!;
            const redirectUri = `${window.location.origin}/oauth/callback`;
            
            console.log('🔄 Starting OneNote token exchange immediately (PKCE flow - no client secret)...');
            // Exchange code for access token using PKCE (no client secret for SPA)
            const tokenResponse = await IntegrationManager.exchangeOneNoteCode(code, clientId, '', redirectUri);
            console.log('✅ OneNote token exchange successful');
            
            // Store the access token temporarily
            sessionStorage.setItem('onenote_access_token', tokenResponse.access_token);
            sessionStorage.setItem('onenote_refresh_token', tokenResponse.refresh_token);
            
            showNotification('✅ Successfully connected to OneNote', 'success');
            
            // Set a flag to auto-connect when user opens integration manager
            sessionStorage.setItem('onenote_auto_connect', 'true');
            
            // Navigate back to integrations screen for onboarding flow
            // Note: OAuthCallback component will handle navigation
            
          } else if (isGeneralMicrosoftCallback) {
            // For general Microsoft OAuth, default to Microsoft Calendar for backward compatibility
            console.log('🔗 Processing general Microsoft OAuth callback (defaulting to Calendar)...');
            console.log('🔑 Using client ID:', process.env.REACT_APP_MICROSOFT_CLIENT_ID?.substring(0, 8) + '...');
            console.log('🕐 Code received at:', new Date().toISOString());
            
            const clientId = process.env.REACT_APP_MICROSOFT_CLIENT_ID!;
            const redirectUri = `${window.location.origin}/oauth/callback`;
            
            console.log('🔄 Starting token exchange immediately (PKCE flow - no client secret)...');
            // Exchange code for access token using PKCE (no client secret for SPA)
            const tokenResponse = await IntegrationManager.exchangeMicrosoftCode(code, clientId, '', redirectUri);
            console.log('✅ Microsoft Calendar token exchange successful');
            
            // Store the access token temporarily
            sessionStorage.setItem('microsoft_access_token', tokenResponse.access_token);
            sessionStorage.setItem('microsoft_refresh_token', tokenResponse.refresh_token);
            
            showNotification('✅ Successfully connected to Microsoft Calendar', 'success');
            
            // Set a flag to auto-connect when user opens integration manager
            sessionStorage.setItem('microsoft_auto_connect', 'true');
            
            // Navigate back to integrations screen for onboarding flow
            // Note: OAuthCallback component will handle navigation
            
          } else {
            console.log('🔗 Unknown OAuth provider in callback');
          }
          
        } catch (error) {
          console.error('❌ OAuth callback failed:', error);
          console.error('🕐 Error occurred at:', new Date().toISOString());
          
          // Clean up the processed flag on error so it can be retried
          const processedKey = `oauth_processed_${code.substring(0, 10)}`;
          sessionStorage.removeItem(processedKey);
          
          showNotification(`❌ Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
          
          // Navigate back to integrations screen even on error
          navigate('/onboarding/integrations');
        }
      }
    };

    handleOAuthCallback();
  }, []);

  // ALWAYS use localStorage as primary data source for perfect UX
  const items = localItems;
  const categories = localCategories;
  
  // Debug categories state
  console.log('🔍 DEBUG - App.tsx categories state:', {
    categoriesCount: categories.length,
    localCategoriesCount: localCategories.length,
    categoriesPreview: categories.slice(0, 2).map(c => ({ id: c.id, name: c.name, icon: c.icon })),
    userId: user?.id,
    isOnboardingCompleted
  });
  
  // Create a setItems function that prioritizes localStorage (no automatic Supabase sync)
  const setItems = (updater: React.SetStateAction<Item[]>) => {
    console.log('💾 setItems called - using localStorage for instant UX');
    setLocalItems(updater);
    
    // Note: Supabase sync will happen through:
    // 1. Manual "Update" button clicks (when user explicitly saves)
    // 2. Hourly background sync (for cross-device sync)
    // This ensures perfect real-time UX with correct category colors immediately
  };

  // Create a setCategories function that prioritizes localStorage (no automatic Supabase sync)
  const setCategories = (updater: React.SetStateAction<any[]>) => {
    console.log('💾 setCategories called - using localStorage for instant UX');
    setLocalCategories(updater);
  };

  // Check for migration on authentication
  useEffect(() => {
    if (user && dataInitialized && shouldShowMigration()) {
      setShowMigrationModal(true);
    }
  }, [user, dataInitialized]);

  // Migration handler
  const handleMigration = async () => {
    const migrationManager = createMigrationManager((progress) => {
      setMigrationProgress(progress);
    });

    const localData = migrationManager.detectLocalStorageData();
    
    if (!localData.hasData) {
      setShowMigrationModal(false);
      return;
    }

    const result = await migrationManager.migrateToSupabase(localData, {
      createCategory,
      updateCategory,
      deleteCategory,
      createItem,
      updateItem,
      deleteItem,
      bulkCreateItems,
      bulkUpdateItems,
      bulkDeleteItems,
      refreshData,
      ensureProfileExists
    });

    if (result.success) {
      showNotification('Migration completed successfully!', 'success');
      await refreshData();
    } else {
      showNotification(`Migration completed with ${result.errors.length} errors`, 'error');
    }

    setShowMigrationModal(false);
    setMigrationProgress(null);
  };

  // Auth is now handled by direct AuthScreen rendering, no modal needed

  // Save user-specific localStorage items
  useEffect(() => {
    if (user?.id) {
      setUserData(user.id, 'lifeStructureItems', localItems);
      console.log('💾 Saved', localItems.length, 'items to user-specific localStorage for', user.email);
    }
  }, [localItems, user?.id]);

  // Save user-specific localStorage categories
  useEffect(() => {
    if (user?.id) {
      setUserData(user.id, 'lifeStructureCategories', localCategories);
      console.log('💾 Saved', localCategories.length, 'categories to user-specific localStorage for', user.email);
    }
  }, [localCategories, user?.id]);

  // Global keyboard shortcuts - only for authenticated users who are not in onboarding
  useEffect(() => {
    if (!user || isOnboardingFlow) return; // Don't enable keyboard shortcuts during onboarding
    
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
        return;
      }

      if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        setShowAIAssistant(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [user, isOnboardingFlow]);

  // Save AI sidebar width to localStorage
  useEffect(() => {
    localStorage.setItem('aiSidebarWidth', aiSidebarWidth.toString());
  }, [aiSidebarWidth]);

  // Listen for sidebar width changes
  useEffect(() => {
    const handleStorageChange = () => {
      const savedWidth = localStorage.getItem('sidebarWidth');
      const savedCollapsed = localStorage.getItem('sidebarCollapsed');
      if (savedWidth) setMainSidebarWidth(parseInt(savedWidth));
      if (savedCollapsed) setIsMainSidebarCollapsed(savedCollapsed === 'true');
    };

    const handleSidebarEvent = (event: CustomEvent) => {
      const { collapsed, width } = event.detail;
      setIsMainSidebarCollapsed(collapsed);
      setMainSidebarWidth(width);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('sidebarStateChanged', handleSidebarEvent as EventListener);
    handleStorageChange();

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('sidebarStateChanged', handleSidebarEvent as EventListener);
    };
  }, []);

  const handleNavigateToCategory = (categoryId: string) => {
    navigate(`/category/${categoryId}`);
  };

  const handleBackToDashboard = () => {
    navigate('/dashboard');
  };

  const handleNavigateToGlobal = (view: string) => {
    navigate(`/${view}`);
  };

  const handleAddItem = async (item: Item) => {
    if (user) {
      try {
        const result = await createItem(item);
        if (result) {
          await refreshData();
          showNotification('Item created successfully', 'success');
        } else {
          showNotification('Failed to create item', 'error');
        }
      } catch (error) {
        console.error('Error creating item:', error);
        showNotification('Failed to create item', 'error');
      }
    } else {
      setLocalItems(prevItems => [...prevItems, item]);
      showNotification('Item created', 'success');
    }
  };

  const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
    setNotification({
      isVisible: true,
      message,
      type
    });
  };

  const hideNotification = () => {
    setNotification(prev => ({ ...prev, isVisible: false }));
  };

  // Redirect to the HTML landing page
  useEffect(() => {
    if (showLanding) {
      console.log('🚀 Redirecting to landing.html');
      const timeout = setTimeout(() => {
        window.location.href = '/landing.html';
      }, 100);
      return () => clearTimeout(timeout);
    } else {
      console.log('✅ Showing React app, current view:', currentView);
    }
  }, [showLanding, currentView]);

  const { rehydrateVoiceNotes, syncStatus } = useHybridSync();

  // Listen for localStorage changes from sync service (user-specific)
  useEffect(() => {
    const handleStorageSync = () => {
      if (!user?.id) return;
      
      console.log('🔄 Sync detected - reloading user-specific localStorage data...');
      const userItems = getUserData(user.id, 'lifeStructureItems', []);
      if (userItems.length > 0) {
        try {
          const formattedItems = userItems.map((item: any) => ({
            ...item,
            createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
            updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
            dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
            dateTime: item.dateTime ? new Date(item.dateTime) : undefined,
            metadata: {
              ...item.metadata,
              eventDate: item.metadata?.eventDate ? new Date(item.metadata.eventDate) : undefined
            }
          }));
          
          console.log(`📊 Loaded ${formattedItems.length} items from user-specific localStorage after sync for ${user.email}`);
          setLocalItems(formattedItems);
        } catch (error) {
          console.error('Error parsing synced items:', error);
        }
      }
    };

    // Listen for storage events (sync updates)
    window.addEventListener('storage', handleStorageSync);
    
    // Also listen for custom sync events
    window.addEventListener('hybridSyncComplete', handleStorageSync);
    
    // Listen for immediate AI function refresh events
    window.addEventListener('forceDataRefresh', handleStorageSync);
    
    // Listen for onboarding completion to update state immediately
    const handleOnboardingComplete = () => {
      if (user?.id) {
        console.log('🎉 Onboarding completion event detected, updating app state');
        const completed = getUserData(user.id, 'lifely_onboarding_completed', false);
        setIsOnboardingCompleted(completed);
        
        // CRITICAL: Reload categories and items from localStorage after onboarding
        // Add a small delay to ensure localStorage is fully written
        setTimeout(() => {
          const userCategories = getUserData(user.id, 'lifeStructureCategories', []);
          const userItems = getUserData(user.id, 'lifeStructureItems', []);
          
          console.log('🔄 Reloading categories after onboarding:', userCategories.length, userCategories);
          console.log('🔄 Reloading items after onboarding:', userItems.length);
          
          // Format and set categories
          const formattedCategories = userCategories.map((category: any) => ({
            ...category,
            createdAt: category.createdAt ? new Date(category.createdAt) : new Date(),
            updatedAt: category.updatedAt ? new Date(category.updatedAt) : new Date()
          }));
          
          console.log('✅ Setting categories state:', formattedCategories.length, formattedCategories);
          setLocalCategories(formattedCategories);
          
          // Format and set items
          const formattedItems = userItems.map((item: any) => ({
            ...item,
            createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
            updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
            dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
            dateTime: item.dateTime ? new Date(item.dateTime) : undefined,
            metadata: {
              ...item.metadata,
              eventDate: item.metadata?.eventDate ? new Date(item.metadata.eventDate) : undefined
            }
          }));
          setLocalItems(formattedItems);
          
          // Force a re-render by updating a dummy state
          setIsOnboardingCompleted(true);
        }, 500);
        
        // Force refresh data to get new categories/items from Supabase too
        if (refreshData) {
          refreshData();
        }
      }
    };
    window.addEventListener('onboardingComplete', handleOnboardingComplete);
    
    return () => {
      window.removeEventListener('storage', handleStorageSync);
      window.removeEventListener('hybridSyncComplete', handleStorageSync);
      window.removeEventListener('forceDataRefresh', handleStorageSync);
      window.removeEventListener('onboardingComplete', handleOnboardingComplete);
    };
  }, [user?.id]);

  // Add this useEffect to handle post-refresh rehydration
  useEffect(() => {
    const handleVoiceNoteRehydration = async () => {
      if (items.length > 0 && !syncStatus.rehydrated) {
        console.log('🔄 App: Starting voice note rehydration after refresh...');
        const rehydratedItems = await rehydrateVoiceNotes(items);
        setItems(rehydratedItems);
      }
    };

    handleVoiceNoteRehydration();
  }, [items, syncStatus.rehydrated, rehydrateVoiceNotes]);

  // Add periodic audio and image cleanup (run once every hour)
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      console.log('🧹 Running periodic media cleanup...');
      cleanupOldAudio(7 * 24 * 60 * 60 * 1000); // Clean up audio older than 7 days
      cleanupOldImages(7 * 24 * 60 * 60 * 1000); // Clean up images older than 7 days
    }, 60 * 60 * 1000); // Run every hour

    // Run cleanup on app start as well
    cleanupOldAudio(7 * 24 * 60 * 60 * 1000);
    cleanupOldImages(7 * 24 * 60 * 60 * 1000);

    return () => clearInterval(cleanupInterval);
  }, []);

  const renderMainContent = () => {
    if (showLanding) {
      return null;
    }

    // Show loading while authentication is initializing
    if (!authInitialized || authLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Initializing...</p>
          </div>
        </div>
      );
    }

    // For localStorage-first approach: Show UI immediately, let Supabase sync in background
    // No blocking data loading - localStorage provides instant experience

    // Show error if data loading failed
    if (user && dataError) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="text-red-600 dark:text-red-400 mb-4">Failed to load data: {dataError}</p>
            <button
              onClick={refreshData}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    // Use React Router for navigation
    return (
      <Routes>
        <Route path="/auth" element={<AuthScreen />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        
        {/* OAuth Integration Callbacks - process and redirect to integrations */}
        <Route path="/oauth/callback" element={<OAuthCallback />} />
        <Route path="/auth/notion/callback" element={<OAuthCallback />} />
        <Route path="/auth/google/callback" element={<OAuthCallback />} />
        <Route path="/auth/microsoft/callback" element={<OAuthCallback />} />
        {user ? (
          // Authenticated routes
          <>
            {/* Onboarding Routes */}
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/onboarding/conversation" element={<OnboardingConversation />} />
            <Route path="/onboarding/voice-memo" element={<VoiceMemoOnboarding />} />
            <Route path="/onboarding/documents" element={<DocumentUpload />} />
            <Route path="/onboarding/integrations" element={<IntegrationsSetup />} />
            <Route path="/onboarding/processing" element={<OnboardingProcessingNew />} />
            <Route path="/onboarding/complete" element={<OnboardingComplete />} />
            
            {/* Main App Routes - Only accessible after onboarding completion */}
            {isCheckingOnboarding ? (
              // Show loading spinner while checking onboarding status to prevent premature redirects
              <Route path="*" element={
                <div className="min-h-screen bg-gradient-to-br from-lifeos-50 via-lifeos-100 to-lifeos-200 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 border-4 border-lifeos-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-lifeos-gray-600">Loading your dashboard...</p>
                  </div>
                </div>
              } />
            ) : isOnboardingCompleted ? (
              <>
                <Route path="/" element={<Dashboard onNavigateToCategory={handleNavigateToCategory} items={items} categories={categories} />} />
                <Route path="/dashboard" element={<Dashboard onNavigateToCategory={handleNavigateToCategory} items={items} categories={categories} />} />
                <Route path="/todos" element={<GlobalTodos items={items} setItems={setItems} categories={categories} />} />
                <Route path="/calendar" element={<GlobalCalendar items={items} setItems={setItems} categories={categories} />} />
                <Route path="/life-categories" element={<LifeCategoriesManager onNavigateToCategory={handleNavigateToCategory} categories={categories} setCategories={setCategories} />} />
                <Route path="/goals" element={<GlobalGoals items={items} setItems={setItems} categories={categories} />} />
                <Route path="/routines" element={<GlobalRoutines items={items} setItems={setItems} categories={categories} />} />
                <Route path="/notes" element={<GlobalNotes items={items} setItems={setItems} categories={categories} />} />
                <Route path="/settings" element={<Settings items={items} setItems={setItems} categories={categories} />} />
                <Route path="/category/:categoryId" element={
                  <CategoryPage 
                    categoryId={location.pathname.split('/')[2]} 
                    onBack={() => navigate('/dashboard')}
                    items={items}
                    setItems={setItems}
                    categories={categories}
                    isGlobalAIAssistantOpen={showAIAssistant}
                  />
                } />
              </>
            ) : (
              // Redirect ALL routes to onboarding progress if not completed - NO BYPASS
              <>
                <Route path="/" element={<Navigate to={onboardingProgress} replace />} />
                <Route path="/dashboard" element={<Navigate to={onboardingProgress} replace />} />
                <Route path="/todos" element={<Navigate to={onboardingProgress} replace />} />
                <Route path="/calendar" element={<Navigate to={onboardingProgress} replace />} />
                <Route path="/life-categories" element={<Navigate to={onboardingProgress} replace />} />
                <Route path="/goals" element={<Navigate to={onboardingProgress} replace />} />
                <Route path="/routines" element={<Navigate to={onboardingProgress} replace />} />
                <Route path="/notes" element={<Navigate to={onboardingProgress} replace />} />
                <Route path="/settings" element={<Navigate to={onboardingProgress} replace />} />
                <Route path="/category/:categoryId" element={<Navigate to={onboardingProgress} replace />} />
                <Route path="*" element={<Navigate to={onboardingProgress} replace />} />
              </>
            )}
          </>
        ) : (
          // Unauthenticated routes - redirect to auth automatically
          <>
            <Route path="/" element={<Navigate to="/auth" replace />} />
            <Route path="*" element={<Navigate to="/auth" replace />} />
          </>
        )}
      </Routes>
    );
  };

  if (showLanding) {
    return (
      <ThemeProvider>
        <div className="App min-h-screen">
          {renderMainContent()}
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <div className="App flex h-screen">
        {/* Only show sidebar and AI assistant for authenticated users who are not in onboarding */}
        {user && !isOnboardingFlow && (
          <>
            {/* Main Left Sidebar */}
            <Sidebar 
              currentView={currentView}
              onNavigateToCategory={handleNavigateToCategory}
              onNavigateToDashboard={handleBackToDashboard}
              onNavigateToGlobal={handleNavigateToGlobal}
              categories={categories}
            />
          </>
        )}
        
        {/* Main Content Area */}
        <div 
          className="flex-1 h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-blue-900 transition-all duration-300 ease-in-out overflow-auto"
          style={{
            marginLeft: user && !isOnboardingFlow ? (isMainSidebarCollapsed ? '60px' : `${mainSidebarWidth}px`) : '0px',
            marginRight: user && !isOnboardingFlow && showAIAssistant && !isAiSidebarCollapsed ? `${aiSidebarWidth}px` : '0px',
            transition: 'margin 0.3s ease-in-out',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {renderMainContent()}
        </div>

        {/* Notification */}
        <Notification
          type={notification.type}
          message={notification.message}
          isVisible={notification.isVisible}
          onClose={hideNotification}
        />

        {/* Global AI Assistant - Only for authenticated users who are not in onboarding */}
        {user && !isOnboardingFlow && showAIAssistant && (
          <AIAssistant
            isOpen={showAIAssistant}
            onClose={() => setShowAIAssistant(false)}
            categories={categories} // Use hybrid categories instead of just Supabase
            items={items}
            onAddItem={handleAddItem}
            onRefreshItems={user ? refreshData : () => {}}
            currentView={currentView}
            isSidebarMode={true}
            sidebarWidth={aiSidebarWidth}
            isCollapsed={isAiSidebarCollapsed}
            onResize={setAiSidebarWidth}
            onToggleCollapse={() => setIsAiSidebarCollapsed(!isAiSidebarCollapsed)}
            // Pass hybrid operations that work with localStorage-first → Supabase sync
            supabaseCallbacks={user ? {
              createItem: async (item: any) => {
                // Create in localStorage first for instant UX
                const newItem = {
                  ...item,
                  id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                };
                setItems(prev => [newItem, ...prev]);
                
                // Try Supabase sync, but don't fail if it's not available
                try {
                  const supabaseResult = await createItem(item);
                  if (supabaseResult) {
                    // Update localStorage with Supabase ID
                    setItems(prev => prev.map(i => i.id === newItem.id ? { ...i, id: supabaseResult.id } : i));
                  }
                  return supabaseResult || newItem;
                } catch (error) {
                  console.warn('⚠️ Supabase createItem failed, using localStorage-only:', error);
                  return newItem;
                }
              },
              updateItem: async (id: string, updates: any) => {
                // Update localStorage first
                setItems(prev => prev.map(item => 
                  item.id === id ? { ...item, ...updates, updatedAt: new Date().toISOString() } : item
                ));
                
                // Try Supabase sync
                try {
                  return await updateItem(id, updates);
                } catch (error) {
                  console.warn('⚠️ Supabase updateItem failed, using localStorage-only:', error);
                  return true;
                }
              },
              deleteItem: async (id: string) => {
                // Remove from localStorage first
                setItems(prev => prev.filter(item => item.id !== id));
                
                // Try Supabase sync
                try {
                  return await deleteItem(id);
                } catch (error) {
                  console.warn('⚠️ Supabase deleteItem failed, using localStorage-only:', error);
                  return true;
                }
              },
              bulkCreateItems: async (items: any[]) => {
                // Create in localStorage first
                const newItems = items.map(item => ({
                  ...item,
                  id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                }));
                setItems(prev => [...newItems, ...prev]);
                
                // Try Supabase sync
                try {
                  const supabaseResult = await bulkCreateItems(items);
                  if (supabaseResult && supabaseResult.length > 0) {
                    // Update localStorage with Supabase IDs
                    setItems(prev => prev.map((item, index) => {
                      const correspondingSupabaseItem = supabaseResult[index];
                      return correspondingSupabaseItem ? { ...item, id: correspondingSupabaseItem.id } : item;
                    }));
                  }
                  return supabaseResult || newItems;
                } catch (error) {
                  console.warn('⚠️ Supabase bulkCreateItems failed, using localStorage-only:', error);
                  return newItems;
                }
              },
              createCategory: async (category: any) => {
                // Create in localStorage first
                const newCategory = {
                  ...category,
                  id: `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                };
                setCategories(prev => [...prev, newCategory]);
                
                // Try Supabase sync
                try {
                  const supabaseResult = await createCategory(category);
                  if (supabaseResult) {
                    // Update localStorage with Supabase ID
                    setCategories(prev => prev.map(c => c.id === newCategory.id ? { ...c, id: supabaseResult.id } : c));
                  }
                  return supabaseResult || newCategory;
                } catch (error) {
                  console.warn('⚠️ Supabase createCategory failed, using localStorage-only:', error);
                  return newCategory;
                }
              },
              refreshData
            } : undefined}
          />
        )}

        {/* Authentication is now handled by AuthScreen directly - no modal needed */}

        {/* Migration Modal - Only for authenticated users */}
        {user && showMigrationModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Migrate Your Data
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                We found existing data in your browser. Would you like to migrate it to your Supabase account for cross-device sync?
              </p>
              
              {migrationProgress && (
                <div className="mb-4">
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                    <span>{migrationProgress.message}</span>
                    <span>{migrationProgress.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${migrationProgress.progress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={handleMigration}
                  disabled={!!migrationProgress}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-lg"
                >
                  {migrationProgress ? 'Migrating...' : 'Migrate Data'}
                </button>
                <button
                  onClick={() => setShowMigrationModal(false)}
                  disabled={!!migrationProgress}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg"
                >
                  Skip
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ThemeProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;