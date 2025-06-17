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
import { ThemeProvider } from './contexts/ThemeContext';
import { categories as initialCategories, initialItems } from './data/initialData';
import { Item, Category } from './types';
import { APIKeyChecker } from './services/apiKeyChecker';
import './App.css';

function App() {
  const [currentView, setCurrentView] = useState<string>(() => {
    // Always start with landing unless explicitly skipped
    const hasSkipped = localStorage.getItem('skipLanding') === 'true';
    console.log('🎯 App initialization - skipLanding flag:', hasSkipped);
    return hasSkipped ? 'dashboard' : 'landing';
  });
  
  const showLanding = currentView === 'landing';
  const [items, setItems] = useState<Item[]>(() => {
    // Load from localStorage or use initial data
    const savedItems = localStorage.getItem('lifeStructureItems');
    if (savedItems) {
      try {
        const parsedItems = JSON.parse(savedItems);
        // Convert date strings back to Date objects
        return parsedItems.map((item: any) => ({
          ...item,
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
          dueDate: item.dueDate ? (() => {
            const date = new Date(item.dueDate);
            return isNaN(date.getTime()) ? undefined : date;
          })() : undefined,
          dateTime: item.dateTime ? (() => {
            const date = new Date(item.dateTime);
            return isNaN(date.getTime()) ? undefined : date;
          })() : undefined,
          metadata: {
            ...item.metadata,
            eventDate: item.metadata?.eventDate ? (() => {
              const date = new Date(item.metadata.eventDate);
              return isNaN(date.getTime()) ? undefined : date;
            })() : undefined
          }
        }));
      } catch (error) {
        console.error('Error parsing saved items:', error);
        return initialItems;
      }
    }
    return initialItems;
  });

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



  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input, textarea, or contenteditable
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
        return;
      }

      // Press 'i' to toggle AI Assistant globally
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

  // Save to localStorage whenever items change
  useEffect(() => {
    localStorage.setItem('lifeStructureItems', JSON.stringify(items));
  }, [items]);

  // Listen for sidebar width changes and AI item modifications
  useEffect(() => {
    const handleStorageChange = (e?: StorageEvent) => {
      // Handle sidebar changes
      const savedWidth = localStorage.getItem('sidebarWidth');
      const savedCollapsed = localStorage.getItem('sidebarCollapsed');
      if (savedWidth) setMainSidebarWidth(parseInt(savedWidth));
      if (savedCollapsed) setIsMainSidebarCollapsed(savedCollapsed === 'true');
      
      // Handle AI item modifications - CRITICAL for real-time updates!
      if (!e || e.key === 'lifeStructureItems') {
        console.log('🔄 Storage change detected for lifeStructureItems, refreshing...');
        handleRefreshItems();
      }
    };

    const handleSidebarEvent = (event: CustomEvent) => {
      const { collapsed, width } = event.detail;
      setIsMainSidebarCollapsed(collapsed);
      setMainSidebarWidth(width);
    };

    const handleItemsModified = () => {
      console.log('🔔 Received itemsModified event from Gemini service!');
      handleRefreshItems();
    };

    // Listen for storage events from other tabs AND same tab modifications
    window.addEventListener('storage', handleStorageChange);
    
    // Listen for custom sidebar events for immediate updates
    window.addEventListener('sidebarStateChanged', handleSidebarEvent as EventListener);
    
    // Listen for real-time AI modifications - CRITICAL for instant updates!
    window.addEventListener('itemsModified', handleItemsModified as EventListener);
    
    // Check immediately on mount - multiple times to ensure sync
    handleStorageChange();
    setTimeout(handleStorageChange, 100);
    setTimeout(handleStorageChange, 500);
    
    // Also check less frequently for backup (every 5 seconds) to catch any missed updates
    const interval = setInterval(() => {
      handleStorageChange();
    }, 5000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('sidebarStateChanged', handleSidebarEvent as EventListener);
      window.removeEventListener('itemsModified', handleItemsModified as EventListener);
      clearInterval(interval);
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

  const handleAddItem = (item: Item) => {
    setItems(prevItems => [...prevItems, item]);
  };


  const handleRefreshItems = () => {
    console.log('🔄 handleRefreshItems called - refreshing from localStorage');
    
    // Force re-read from localStorage in case AI modified items directly
    const savedItems = localStorage.getItem('lifeStructureItems');
    if (savedItems) {
      try {
        const parsedItems = JSON.parse(savedItems);
        console.log('📦 Parsed items from localStorage:', parsedItems.length, 'items');
        
        // Check if items have actually changed to prevent unnecessary re-renders
        const currentItemsString = JSON.stringify(items);
        const newItemsString = JSON.stringify(parsedItems);
        
        if (currentItemsString === newItemsString) {
          console.log('⏭️ Items unchanged, skipping re-render');
          return;
        }
        
        const refreshedItems = parsedItems.map((item: any) => ({
          ...item,
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
          dueDate: item.dueDate ? (() => {
            const date = new Date(item.dueDate);
            return isNaN(date.getTime()) ? undefined : date;
          })() : undefined,
          dateTime: item.dateTime ? (() => {
            const date = new Date(item.dateTime);
            return isNaN(date.getTime()) ? undefined : date;
          })() : undefined,
          metadata: {
            ...item.metadata,
            eventDate: item.metadata?.eventDate ? (() => {
              const date = new Date(item.metadata.eventDate);
              return isNaN(date.getTime()) ? undefined : date;
            })() : undefined
          }
        }));
        
        console.log('✅ Setting refreshed items to state:', refreshedItems.length, 'items');
        setItems(refreshedItems);
        
        // Force re-render by triggering a state change
        setTimeout(() => {
          console.log('🔄 Double-checking refresh after 100ms');
          const doubleCheckItems = localStorage.getItem('lifeStructureItems');
          if (doubleCheckItems && doubleCheckItems !== savedItems) {
            console.log('📦 Items changed during refresh, updating again');
            const newParsedItems = JSON.parse(doubleCheckItems);
            const newRefreshedItems = newParsedItems.map((item: any) => ({
              ...item,
              createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
              updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
              dueDate: item.dueDate ? (() => {
                const date = new Date(item.dueDate);
                return isNaN(date.getTime()) ? undefined : date;
              })() : undefined,
              dateTime: item.dateTime ? (() => {
                const date = new Date(item.dateTime);
                return isNaN(date.getTime()) ? undefined : date;
              })() : undefined,
              metadata: {
                ...item.metadata,
                eventDate: item.metadata?.eventDate ? (() => {
                  const date = new Date(item.metadata.eventDate);
                  return isNaN(date.getTime()) ? undefined : date;
                })() : undefined
              }
            }));
            setItems(newRefreshedItems);
          }
        }, 100);
        
      } catch (error) {
        console.error('❌ Error refreshing items:', error);
      }
    } else {
      console.log('⚠️ No saved items found in localStorage');
    }
  };


  const hideNotification = () => {
    setNotification(prev => ({ ...prev, isVisible: false }));
  };


  // Redirect to the HTML landing page
  useEffect(() => {
    if (showLanding) {
      console.log('🚀 Redirecting to landing.html');
      // Add a small delay to ensure the component is ready
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
      // This should never render since we redirect above
      return null;
    }

    switch (currentView) {
      case 'dashboard':
        return <Dashboard onNavigateToCategory={handleNavigateToCategory} items={items} />;
      
      // Global Views
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
        return <GlobalNotes 
          items={items} 
          setItems={setItems} 
        />;
      
      // Settings
      case 'settings':
        return <Settings />;
      
      // Category views
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
            scrollbarWidth: 'none', /* Firefox */
            msOverflowStyle: 'none', /* IE and Edge */
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
            categories={categories}
            items={items}
            onAddItem={handleAddItem}
            onRefreshItems={handleRefreshItems}
            currentView={currentView}
            isSidebarMode={true}
            sidebarWidth={aiSidebarWidth}
            isCollapsed={isAiSidebarCollapsed}
            onResize={setAiSidebarWidth}
            onToggleCollapse={() => setIsAiSidebarCollapsed(!isAiSidebarCollapsed)}
          />
        )}


      </div>
    </ThemeProvider>
  );
}

export default App; 