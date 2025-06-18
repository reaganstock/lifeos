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
import { MigrationModal } from './components/MigrationModal';
import { AuthProvider, useAuthContext } from './components/AuthProvider';
import { ThemeProvider } from './contexts/ThemeContext';
import { categories as initialCategories, initialItems } from './data/initialData';
import { useSupabaseData } from './hooks/useSupabaseData';
import { shouldShowMigration, createMigrationManager, MigrationProgress } from './utils/migration';
import { Item, Category } from './types';
import './App.css';

function AppContent() {
  const { user, loading: authLoading, initialized: authInitialized } = useAuthContext();
  const {
    categories: supabaseCategories,
    items: supabaseItems,
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
        return initialItems;
      }
    }
    return initialItems;
  });

  const [currentView, setCurrentView] = useState<string>(() => {
    const hasSkipped = localStorage.getItem('skipLanding') === 'true';
    console.log('🎯 App initialization - skipLanding flag:', hasSkipped);
    return hasSkipped ? 'dashboard' : 'landing';
  });
  
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  
  const showLanding = currentView === 'landing';
  const [categories] = useState<Category[]>(initialCategories);
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

  // Current items (either from localStorage or Supabase)
  const items = user ? supabaseItems : localItems;
  
  // Create a setItems function that works with both localStorage and Supabase
  const setItems = user 
    ? (updater: React.SetStateAction<Item[]>) => {
        // For authenticated users, the real-time subscriptions will handle updates
        // We don't need to manually call setItems since Supabase operations
        // trigger real-time updates automatically
        console.log('🔄 setItems called for authenticated user - operations handled by individual CRUD functions');
        
        // If this is being called, it means some component is trying to update items directly
        // Instead, components should use the individual CRUD operations from useSupabaseData
        console.warn('⚠️ Direct setItems call detected for authenticated user. Consider using CRUD operations instead.');
      }
    : setLocalItems; // Use localStorage for unauthenticated users

  // Check for migration on authentication
  useEffect(() => {
    if (user && dataInitialized && shouldShowMigration()) {
      setShowMigrationModal(true);
    }
  }, [user, dataInitialized]);

  // Show auth modal if user is not authenticated (except on landing)
  useEffect(() => {
    if (authInitialized && !user && !showLanding) {
      setShowAuthModal(true);
    }
  }, [authInitialized, user, showLanding]);

  // Save localStorage items for unauthenticated users
  useEffect(() => {
    if (!user) {
      localStorage.setItem('lifeStructureItems', JSON.stringify(localItems));
    }
  }, [localItems, user]);

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
        console.log('🆕 Creating item via Supabase:', item.title);
        const newItem = await createItem(item);
        if (newItem) {
          showNotification('Item created successfully', 'success');
          // No need to manually refresh - real-time subscriptions will handle the update
        } else {
          showNotification('Failed to create item', 'error');
        }
      } catch (error) {
        console.error('Error creating item:', error);
        showNotification('Failed to create item', 'error');
      }
    } else {
      // For unauthenticated users, use localStorage
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

    switch (currentView) {
      case 'dashboard':
        return <Dashboard onNavigateToCategory={handleNavigateToCategory} items={items} />;
      
      case 'todos':
        return <GlobalTodos items={items} setItems={setItems} />;
      case 'calendar':
        return <GlobalCalendar items={items} setItems={setItems} />;
      case 'life-categories':
        return <LifeCategoriesManager onNavigateToCategory={handleNavigateToCategory} />;
      case 'goals':
        return <GlobalGoals items={items} setItems={setItems} />;
      case 'routines':
        return <GlobalRoutines items={items} setItems={setItems} />;
      case 'notes':
        return <GlobalNotes items={items} setItems={setItems} />;
      case 'settings':
        return <Settings onOpenMigrationModal={() => setShowMigrationModal(true)} />;
      
      default:
        return (
          <CategoryPage 
            categoryId={currentView} 
            onBack={handleBackToDashboard}
            items={items}
            setItems={setItems}
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
            categories={user ? supabaseCategories : categories}
            items={items}
            onAddItem={handleAddItem}
            onRefreshItems={user ? refreshData : () => {}}
            currentView={currentView}
            isSidebarMode={true}
            sidebarWidth={aiSidebarWidth}
            isCollapsed={isAiSidebarCollapsed}
            onResize={setAiSidebarWidth}
            onToggleCollapse={() => setIsAiSidebarCollapsed(!isAiSidebarCollapsed)}
          />
        )}

        {/* Authentication Modal */}
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
        />

        {/* Migration Modal */}
        {showMigrationModal && (
          <MigrationModal
            isOpen={showMigrationModal}
            onClose={() => setShowMigrationModal(false)}
            supabaseActions={{
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
            }}
            onMigrationComplete={() => {
              showNotification('Migration completed successfully!', 'success');
              refreshData();
            }}
          />
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