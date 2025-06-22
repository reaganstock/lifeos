import React, { useState, useEffect } from 'react';
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
import { AuthModal } from './components/AuthModal';
import { AuthProvider, useAuthContext } from './components/AuthProvider';
import { ThemeProvider } from './contexts/ThemeContext';
// Removed initialData import - users create their own categories
import { useSupabaseData } from './hooks/useSupabaseData';
import { shouldShowMigration, createMigrationManager, MigrationProgress } from './utils/migration';
import { Item } from './types';
import './App.css';

function AppContent() {
  const { user, loading: authLoading, initialized: authInitialized } = useAuthContext();
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
    refreshData
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

  const [currentView, setCurrentView] = useState<string>(() => {
    const hasSkipped = localStorage.getItem('skipLanding') === 'true';
    console.log('🎯 App initialization - skipLanding flag:', hasSkipped);
    return hasSkipped ? 'dashboard' : 'landing';
  });
  
  const [showAuthModal, setShowAuthModal] = useState(false);
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

  // ALWAYS use localStorage as primary data source for perfect UX
  const items = localItems;
  
  // Create a setItems function that prioritizes localStorage (no automatic Supabase sync)
  const setItems = (updater: React.SetStateAction<Item[]>) => {
    console.log('💾 setItems called - using localStorage for instant UX');
    setLocalItems(updater);
    
    // Note: Supabase sync will happen through:
    // 1. Manual "Update" button clicks (when user explicitly saves)
    // 2. Hourly background sync (for cross-device sync)
    // This ensures perfect real-time UX with correct category colors immediately
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
      refreshData
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

  // Show auth modal if user is not authenticated (except on landing)
  useEffect(() => {
    if (authInitialized && !user && !showLanding) {
      setShowAuthModal(true);
    }
  }, [authInitialized, user, showLanding]);

  // Save localStorage items (primary data source for all users)
  useEffect(() => {
    localStorage.setItem('lifeStructureItems', JSON.stringify(localItems));
    console.log('💾 Saved', localItems.length, 'items to localStorage');
  }, [localItems]);

  // Global keyboard shortcuts
  useEffect(() => {
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
  }, []);

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
    setCurrentView(categoryId);
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
  };

  const handleNavigateToGlobal = (view: string) => {
    setCurrentView(view);
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

    // Show loading while data is being fetched (for authenticated users)
    if (user && (!dataInitialized || dataLoading)) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading your data...</p>
          </div>
        </div>
      );
    }

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

    // CRITICAL: Block access if user is not authenticated
    if (!user) {
      return (
        <div className="flex items-center justify-center h-full bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-blue-900">
          <div className="text-center max-w-md mx-auto p-8">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Authentication Required</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6 text-lg">
              Please sign in to access Life Structure and manage your goals, tasks, and routines.
            </p>
            <button
              onClick={() => setShowAuthModal(true)}
              className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
            >
              Sign In to Continue
            </button>
          </div>
        </div>
      );
    }

    switch (currentView) {
      case 'dashboard':
        return <Dashboard onNavigateToCategory={handleNavigateToCategory} items={items} categories={supabaseCategories} />;
      
      case 'todos':
        return <GlobalTodos items={items} setItems={setItems} categories={supabaseCategories} />;
      case 'calendar':
        return <GlobalCalendar items={items} setItems={setItems} categories={supabaseCategories} />;
      case 'life-categories':
        return <LifeCategoriesManager onNavigateToCategory={handleNavigateToCategory} />;
      case 'goals':
        return <GlobalGoals items={items} setItems={setItems} categories={supabaseCategories} />;
      case 'routines':
        return <GlobalRoutines items={items} setItems={setItems} categories={supabaseCategories} />;
      case 'notes':
        return <GlobalNotes items={items} setItems={setItems} categories={supabaseCategories} />;
      case 'settings':
        return <Settings />;
      
      default:
        return (
          <CategoryPage 
            categoryId={currentView} 
            onBack={handleBackToDashboard}
            items={items}
            setItems={setItems}
            categories={supabaseCategories}
            isGlobalAIAssistantOpen={showAIAssistant}
          />
        );
    }
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
        {/* Main Left Sidebar */}
        <Sidebar 
          currentView={currentView}
          onNavigateToCategory={handleNavigateToCategory}
          onNavigateToDashboard={handleBackToDashboard}
          onNavigateToGlobal={handleNavigateToGlobal}
          categories={supabaseCategories}
        />
        
        {/* Main Content Area */}
        <div 
          className="flex-1 h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-blue-900 transition-all duration-300 ease-in-out overflow-auto"
          style={{
            marginLeft: isMainSidebarCollapsed ? '60px' : `${mainSidebarWidth}px`,
            marginRight: showAIAssistant && !isAiSidebarCollapsed ? `${aiSidebarWidth}px` : '0px',
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

        {/* Global AI Assistant */}
        {showAIAssistant && (
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

        {/* Authentication Modal */}
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
        />

        {/* Migration Modal */}
        {showMigrationModal && (
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