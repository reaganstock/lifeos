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
import OnboardingProcessing from './components/onboarding/OnboardingProcessing';
import OnboardingProcessingNew from './components/onboarding/OnboardingProcessingNew';
import OnboardingComplete from './components/onboarding/OnboardingComplete';
import OnboardingConversation from './components/onboarding/OnboardingConversation';
import VoiceMemoOnboarding from './components/onboarding/VoiceMemoOnboarding';
import SignInRequired from './components/SignInRequired';
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

function AppContent() {
  const { user, loading: authLoading, initialized: authInitialized } = useAuthContext();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    categories: supabaseCategories,
    loading: dataLoading,
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

  // Legacy localStorage state for unauthenticated users or migration
  const [localItems, setLocalItems] = useState<Item[]>(() => {
    const savedItems = localStorage.getItem('lifeStructureItems');
    if (savedItems) {
      try {
        const parsedItems = JSON.parse(savedItems);
        return parsedItems.map((item: any) => ({
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
      } catch (error) {
        console.error('Error parsing saved items:', error);
        return [];
      }
    }
    return [];
  });

  // localStorage categories state (localStorage-first pattern)
  const [localCategories, setLocalCategories] = useState<any[]>(() => {
    const savedCategories = localStorage.getItem('lifeStructureCategories');
    if (savedCategories) {
      try {
        const parsedCategories = JSON.parse(savedCategories);
        return parsedCategories.map((category: any) => ({
          ...category,
          createdAt: category.createdAt ? new Date(category.createdAt) : new Date(),
          updatedAt: category.updatedAt ? new Date(category.updatedAt) : new Date()
        }));
      } catch (error) {
        console.error('Error parsing saved categories:', error);
        return [];
      }
    }
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
  
  // Check onboarding completion status
  const isOnboardingCompleted = localStorage.getItem('lifely_onboarding_completed') === 'true';
  const onboardingProgress = localStorage.getItem('lifely_onboarding_progress') || '/onboarding';
  
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
            
            // Clean up URL and redirect back to app
            window.history.replaceState({}, document.title, '/');
            
            // Set a flag to auto-connect when user opens integration manager
            sessionStorage.setItem('notion_auto_connect', 'true');
            
          } else if (isGoogleCallback) {
            console.log('🔗 Processing Google Calendar OAuth callback...');
            
            const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID!;
            const clientSecret = process.env.REACT_APP_GOOGLE_CLIENT_SECRET!;
            const redirectUri = `https://app.lifely.dev/oauth/callback`;
            
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
            
            // Clean up URL and redirect back to app
            window.history.replaceState({}, document.title, '/');
            
            // Set a flag to auto-connect when user opens integration manager
            sessionStorage.setItem('google_auto_connect', 'true');

          } else if (isMicrosoftCallback) {
            console.log('🔗 Processing Microsoft Calendar OAuth callback...');
            console.log('🔑 Using client ID:', process.env.REACT_APP_MICROSOFT_CLIENT_ID?.substring(0, 8) + '...');
            console.log('🕐 Code received at:', new Date().toISOString());
            
            const clientId = process.env.REACT_APP_MICROSOFT_CLIENT_ID!;
            const redirectUri = `https://app.lifely.dev/oauth/callback`;
            
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
            
            // Clean up URL and redirect back to app
            window.history.replaceState({}, document.title, '/');
            
            // Set a flag to auto-connect when user opens integration manager
            sessionStorage.setItem('microsoft_auto_connect', 'true');
            
          } else if (isOneNoteCallback) {
            console.log('🔗 Processing OneNote OAuth callback...');
            console.log('🔑 Using client ID:', process.env.REACT_APP_MICROSOFT_CLIENT_ID?.substring(0, 8) + '...');
            console.log('🕐 Code received at:', new Date().toISOString());
            
            const clientId = process.env.REACT_APP_MICROSOFT_CLIENT_ID!;
            const redirectUri = `https://app.lifely.dev/oauth/callback`;
            
            console.log('🔄 Starting OneNote token exchange immediately (PKCE flow - no client secret)...');
            // Exchange code for access token using PKCE (no client secret for SPA)
            const tokenResponse = await IntegrationManager.exchangeOneNoteCode(code, clientId, '', redirectUri);
            console.log('✅ OneNote token exchange successful');
            
            // Store the access token temporarily
            sessionStorage.setItem('onenote_access_token', tokenResponse.access_token);
            sessionStorage.setItem('onenote_refresh_token', tokenResponse.refresh_token);
            
            showNotification('✅ Successfully connected to OneNote', 'success');
            
            // Clean up URL and redirect back to app
            window.history.replaceState({}, document.title, '/');
            
            // Set a flag to auto-connect when user opens integration manager
            sessionStorage.setItem('onenote_auto_connect', 'true');
            
          } else if (isGeneralMicrosoftCallback) {
            // For general Microsoft OAuth, default to Microsoft Calendar for backward compatibility
            console.log('🔗 Processing general Microsoft OAuth callback (defaulting to Calendar)...');
            console.log('🔑 Using client ID:', process.env.REACT_APP_MICROSOFT_CLIENT_ID?.substring(0, 8) + '...');
            console.log('🕐 Code received at:', new Date().toISOString());
            
            const clientId = process.env.REACT_APP_MICROSOFT_CLIENT_ID!;
            const redirectUri = `https://app.lifely.dev/oauth/callback`;
            
            console.log('🔄 Starting token exchange immediately (PKCE flow - no client secret)...');
            // Exchange code for access token using PKCE (no client secret for SPA)
            const tokenResponse = await IntegrationManager.exchangeMicrosoftCode(code, clientId, '', redirectUri);
            console.log('✅ Microsoft Calendar token exchange successful');
            
            // Store the access token temporarily
            sessionStorage.setItem('microsoft_access_token', tokenResponse.access_token);
            sessionStorage.setItem('microsoft_refresh_token', tokenResponse.refresh_token);
            
            showNotification('✅ Successfully connected to Microsoft Calendar', 'success');
            
            // Clean up URL and redirect back to app
            window.history.replaceState({}, document.title, '/');
            
            // Set a flag to auto-connect when user opens integration manager
            sessionStorage.setItem('microsoft_auto_connect', 'true');
            
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
          
          // Clean up URL even on error
          window.history.replaceState({}, document.title, '/');
        }
      }
    };

    handleOAuthCallback();
  }, []);

  // ALWAYS use localStorage as primary data source for perfect UX
  const items = localItems;
  const categories = localCategories;
  
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

  // Save localStorage items (primary data source for all users)
  useEffect(() => {
    localStorage.setItem('lifeStructureItems', JSON.stringify(localItems));
    console.log('💾 Saved', localItems.length, 'items to localStorage');
  }, [localItems]);

  // Save localStorage categories (primary data source for all users)
  useEffect(() => {
    localStorage.setItem('lifeStructureCategories', JSON.stringify(localCategories));
    console.log('💾 Saved', localCategories.length, 'categories to localStorage');
  }, [localCategories]);

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

  // Listen for localStorage changes from sync service
  useEffect(() => {
    const handleStorageSync = () => {
      console.log('🔄 Sync detected - reloading localStorage data...');
      const savedItems = localStorage.getItem('lifeStructureItems');
      if (savedItems) {
        try {
          const parsedItems = JSON.parse(savedItems);
          const formattedItems = parsedItems.map((item: any) => ({
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
          
          console.log(`📊 Loaded ${formattedItems.length} items from localStorage after sync`);
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
    
    return () => {
      window.removeEventListener('storage', handleStorageSync);
      window.removeEventListener('hybridSyncComplete', handleStorageSync);
      window.removeEventListener('forceDataRefresh', handleStorageSync);
    };
  }, []);

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
            {isOnboardingCompleted ? (
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
              // Redirect to onboarding progress if not completed
              <>
                <Route path="/" element={<Navigate to={onboardingProgress} replace />} />
                <Route path="/dashboard" element={<Navigate to={onboardingProgress} replace />} />
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
            categories={supabaseCategories}
            items={items}
            onAddItem={handleAddItem}
            onRefreshItems={user ? refreshData : () => {}}
            currentView={currentView}
            isSidebarMode={true}
            sidebarWidth={aiSidebarWidth}
            isCollapsed={isAiSidebarCollapsed}
            onResize={setAiSidebarWidth}
            onToggleCollapse={() => setIsAiSidebarCollapsed(!isAiSidebarCollapsed)}
            // Pass Supabase operations for authenticated users
            supabaseCallbacks={user ? {
              createItem,
              updateItem,
              deleteItem,
              bulkCreateItems,
              createCategory,
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