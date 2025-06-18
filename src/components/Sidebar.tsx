import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Home, Calendar, FileText, BowArrow, Settings, CheckSquare, RotateCcw, Star, FolderOpen, Upload, Edit3, Check, ChevronRight, ChevronLeft } from 'lucide-react';
import { Category } from '../types';

interface SidebarProps {
  currentView: string;
  onNavigateToCategory: (categoryId: string) => void;
  onNavigateToDashboard: () => void;
  onNavigateToGlobal: (view: string) => void;
  categories: Category[];
}

const Sidebar: React.FC<SidebarProps> = ({ 
  currentView, 
  onNavigateToCategory, 
  onNavigateToDashboard,
  onNavigateToGlobal,
  categories
}) => {
  const [logo, setLogo] = useState<string | null>(() => {
    return localStorage.getItem('lifeStructureLogo');
  });
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [customTitle, setCustomTitle] = useState(() => {
    return localStorage.getItem('lifeStructureTitle') || 'Life Structure';
  });
  const [customSubtitle, setCustomSubtitle] = useState(() => {
    return localStorage.getItem('lifeStructureSubtitle') || 'Georgetown Success';
  });
  
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('sidebarWidth');
    return saved ? parseInt(saved) : 256; // Default 256px (16rem)
  });
  const [isResizing, setIsResizing] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved === 'true';
  });
  const [autoHide, setAutoHide] = useState(() => {
    const saved = localStorage.getItem('sidebarAutoHide');
    return saved === 'true';
  });
  const [showSettings, setShowSettings] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const globalTabs = [
    { id: 'todos', label: 'Todos', icon: <CheckSquare className="w-5 h-5" />, color: 'text-green-600 dark:text-green-400' },
    { id: 'calendar', label: 'Calendar', icon: <Calendar className="w-5 h-5" />, color: 'text-blue-600 dark:text-blue-400' },
    { id: 'life-categories', label: 'Life Categories', icon: <FolderOpen className="w-5 h-5" />, color: 'text-purple-600 dark:text-purple-400' },
    { id: 'goals', label: 'Goals', icon: <BowArrow className="w-5 h-5" />, color: 'text-black dark:text-gray-300' },
    { id: 'routines', label: 'Routines', icon: <RotateCcw className="w-5 h-5" />, color: 'text-orange-600 dark:text-orange-400' },
    { id: 'notes', label: 'Notes', icon: <FileText className="w-5 h-5" />, color: 'text-yellow-600 dark:text-yellow-400' }
  ];

  // Get the top 3 highest priority categories (lowest priority numbers) from actual user categories
  const topPriorityCategories = categories
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3);

  // Resize handlers
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const handleResizeMouseMove = useCallback((e: MouseEvent) => {
    if (isResizing) {
      const newWidth = Math.max(200, Math.min(500, e.clientX));
      setSidebarWidth(newWidth);
      localStorage.setItem('sidebarWidth', newWidth.toString());
      
      // Dispatch custom event for immediate updates
      window.dispatchEvent(new CustomEvent('sidebarStateChanged', {
        detail: { collapsed: isCollapsed, width: newWidth }
      }));
    }
  }, [isResizing, isCollapsed]);

  const handleResizeMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMouseMove);
      document.addEventListener('mouseup', handleResizeMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleResizeMouseMove);
        document.removeEventListener('mouseup', handleResizeMouseUp);
      };
    }
  }, [isResizing, handleResizeMouseMove, handleResizeMouseUp]);

  // Double-click to open settings
  const handleDoubleClick = () => {
    setShowSettings(true);
  };

  // Toggle collapse
  const toggleCollapse = () => {
    const newCollapsed = !isCollapsed;
    setIsCollapsed(newCollapsed);
    localStorage.setItem('sidebarCollapsed', newCollapsed.toString());
    
    // Dispatch custom event to notify App component immediately
    window.dispatchEvent(new CustomEvent('sidebarStateChanged', {
      detail: { collapsed: newCollapsed, width: sidebarWidth }
    }));
  };

  // Auto-hide functionality
  useEffect(() => {
    if (autoHide && !isResizing) {
      const handleMouseLeave = () => {
        if (!showSettings) {
          setIsCollapsed(true);
          localStorage.setItem('sidebarCollapsed', 'true');
          // Dispatch custom event
          window.dispatchEvent(new CustomEvent('sidebarStateChanged', {
            detail: { collapsed: true, width: sidebarWidth }
          }));
        }
      };
      
      const handleMouseEnter = () => {
        setIsCollapsed(false);
        localStorage.setItem('sidebarCollapsed', 'false');
        // Dispatch custom event
        window.dispatchEvent(new CustomEvent('sidebarStateChanged', {
          detail: { collapsed: false, width: sidebarWidth }
        }));
      };

      const sidebar = sidebarRef.current;
      if (sidebar) {
        sidebar.addEventListener('mouseenter', handleMouseEnter);
        sidebar.addEventListener('mouseleave', handleMouseLeave);
        return () => {
          sidebar.removeEventListener('mouseenter', handleMouseEnter);
          sidebar.removeEventListener('mouseleave', handleMouseLeave);
        };
      }
    }
  }, [autoHide, isResizing, showSettings, sidebarWidth]);

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setLogo(result);
        localStorage.setItem('lifeStructureLogo', result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeLogo = () => {
    setLogo(null);
    localStorage.removeItem('lifeStructureLogo');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleTitleEdit = () => {
    if (isEditingTitle) {
      localStorage.setItem('lifeStructureTitle', customTitle);
      localStorage.setItem('lifeStructureSubtitle', customSubtitle);
    }
    setIsEditingTitle(!isEditingTitle);
  };

  const handleSaveAndExit = () => {
    localStorage.setItem('lifeStructureTitle', customTitle);
    localStorage.setItem('lifeStructureSubtitle', customSubtitle);
    setIsEditingTitle(false);
  };

  return (
    <>
      <div 
        ref={sidebarRef}
        className={`bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 backdrop-blur-xl border-r border-slate-200/60 dark:border-slate-700/60 h-screen fixed left-0 top-0 z-10 flex flex-col transition-all duration-500 ease-out ${
          isCollapsed ? 'hover:shadow-2xl hover:shadow-slate-500/20 dark:hover:shadow-slate-900/40' : 'shadow-xl shadow-slate-300/30 dark:shadow-slate-900/50'
        }`}
        style={{ 
          width: isCollapsed ? '60px' : `${sidebarWidth}px`,
          transition: isResizing ? 'none' : 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
        onDoubleClick={handleDoubleClick}
      >
        {isCollapsed ? (
          // Collapsed state - show ALL icons
          <div className="p-3 flex-1 overflow-y-auto">
            {/* Dashboard */}
            <button
              onClick={() => {
                onNavigateToDashboard();
                if (autoHide) setIsCollapsed(true);
              }}
              className={`w-full p-3 flex justify-center hover:bg-gradient-to-r hover:from-slate-100 hover:to-slate-50 dark:hover:from-slate-700 dark:hover:to-slate-800 rounded-xl transition-all duration-300 ease-out transform hover:scale-105 hover:shadow-lg hover:shadow-slate-300/30 dark:hover:shadow-slate-900/40 ${
                currentView === 'dashboard' ? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 shadow-md shadow-blue-200/40 dark:shadow-blue-900/20' : ''
              }`}
              title="Dashboard"
            >
              <Home className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
            
            {/* Global Tabs - ALL of them */}
            {globalTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  onNavigateToGlobal(tab.id);
                  if (autoHide) setIsCollapsed(true);
                }}
                className={`w-full p-3 flex justify-center hover:bg-gradient-to-r hover:from-slate-100 hover:to-slate-50 dark:hover:from-slate-700 dark:hover:to-slate-800 rounded-xl mt-2 transition-all duration-300 ease-out transform hover:scale-105 hover:shadow-lg hover:shadow-slate-300/30 dark:hover:shadow-slate-900/40 ${
                  currentView === tab.id ? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 shadow-md shadow-blue-200/40 dark:shadow-blue-900/20' : ''
                }`}
                title={tab.label}
              >
                {React.cloneElement(tab.icon, { className: `w-5 h-5 ${tab.color}` })}
              </button>
            ))}

            {/* Top Categories */}
            {topPriorityCategories.map((category) => (
              <button
                key={category.id}
                onClick={() => {
                  onNavigateToCategory(category.id);
                  if (autoHide) setIsCollapsed(true);
                }}
                className={`w-full p-3 flex justify-center hover:bg-gradient-to-r hover:from-slate-100 hover:to-slate-50 dark:hover:from-slate-700 dark:hover:to-slate-800 rounded-xl mt-2 transition-all duration-300 ease-out transform hover:scale-105 hover:shadow-lg hover:shadow-slate-300/30 dark:hover:shadow-slate-900/40 ${
                  currentView === category.id ? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 shadow-md shadow-blue-200/40 dark:shadow-blue-900/20' : ''
                }`}
                title={category.name}
              >
                <span className="text-lg">{category.icon}</span>
              </button>
            ))}

            {/* Settings */}
            <button
              onClick={() => {
                onNavigateToGlobal('settings');
                if (autoHide) setIsCollapsed(true);
              }}
              className={`w-full p-3 flex justify-center hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg mt-2 ${
                currentView === 'settings' ? 'bg-gray-100 dark:bg-gray-700' : ''
              }`}
              title="Settings"
            >
              <Settings className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>

            {/* Expand button at bottom */}
            {!autoHide && (
              <button
                onClick={toggleCollapse}
                className="w-full p-3 flex justify-center hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg mt-4 border-t border-gray-200 dark:border-gray-600"
                title="Expand sidebar"
              >
                <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              </button>
            )}
          </div>
        ) : (
          // Full sidebar content
          <>
            {/* Enhanced Header with Logo Upload */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <div className="flex items-center justify-between mb-4 group">
                <div className="flex items-center flex-1">
                  {/* Logo Section */}
                  <div className="relative mr-3">
                    {logo ? (
                      <div className="relative group/logo">
                        <img 
                          src={logo} 
                          alt="Logo" 
                          className="w-10 h-10 rounded-lg object-cover border-2 border-gray-200 dark:border-gray-600"
                        />
                        <button
                          onClick={removeLogo}
                          className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full opacity-0 group-hover/logo:opacity-100 transition-opacity duration-200 flex items-center justify-center text-xs"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-10 h-10 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center hover:border-blue-500 dark:hover:border-blue-400 transition-colors duration-200 group/upload"
                      >
                        <Upload className="w-4 h-4 text-gray-400 group-hover/upload:text-blue-500 dark:group-hover/upload:text-blue-400" />
                      </button>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </div>

                  {/* Title Section */}
                  <div className="flex-1 min-w-0">
                    {isEditingTitle ? (
                      <div className="space-y-1">
                        <input
                          type="text"
                          value={customTitle}
                          onChange={(e) => setCustomTitle(e.target.value)}
                          onBlur={handleSaveAndExit}
                          className="w-full text-lg font-bold bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white px-2 py-1 rounded border-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="App Title"
                          autoFocus
                        />
                        <input
                          type="text"
                          value={customSubtitle}
                          onChange={(e) => setCustomSubtitle(e.target.value)}
                          onBlur={handleSaveAndExit}
                          className="w-full text-sm bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded border-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Subtitle"
                        />
                      </div>
                    ) : (
                      <div>
                        <h1 className="text-lg font-bold text-gray-800 dark:text-white truncate">{customTitle}</h1>
                        <p className="text-sm text-gray-600 dark:text-gray-300 truncate">{customSubtitle}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Collapse button and Edit/Save Button */}
                <div className="flex items-center space-x-1">
                  {!autoHide && (
                    <button
                      onClick={toggleCollapse}
                      className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-all duration-200"
                      title="Collapse sidebar"
                    >
                      <ChevronLeft className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    </button>
                  )}
                  
                  <button
                    onClick={handleTitleEdit}
                    className={`p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-all duration-200 ${
                      isEditingTitle 
                        ? 'opacity-100 bg-green-100 hover:bg-green-200 dark:bg-green-900/50 dark:hover:bg-green-800/50' 
                        : 'opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    {isEditingTitle ? (
                      <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                    ) : (
                      <Edit3 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              {/* Logo Upload Helper Text */}
              {!logo && sidebarWidth > 220 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Click + to upload your logo • Double-click sidebar for settings
                </p>
              )}
            </div>

            {/* Navigation */}
            <nav className="p-4 flex-1 overflow-y-auto sidebar-scroll">
              {/* Dashboard */}
              <button
                onClick={onNavigateToDashboard}
                className={`w-full flex items-center px-4 py-3 rounded-xl mb-4 transition-all duration-300 ease-out transform hover:scale-[1.02] hover:shadow-lg hover:shadow-slate-300/30 dark:hover:shadow-slate-900/40 ${
                  currentView === 'dashboard' 
                    ? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-700 dark:text-blue-300 border-l-4 border-blue-500 shadow-md shadow-blue-200/40 dark:shadow-blue-900/20' 
                    : 'text-slate-700 dark:text-slate-300 hover:bg-gradient-to-r hover:from-slate-100 hover:to-slate-50 dark:hover:from-slate-700 dark:hover:to-slate-800'
                }`}
              >
                <Home className="w-5 h-5 mr-3" />
                Dashboard
              </button>

              {/* Global Tabs */}
              <div className="mb-6">
                {sidebarWidth > 200 && (
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                    Global Views
                  </h3>
                )}
                {globalTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => onNavigateToGlobal(tab.id)}
                    className={`w-full flex items-center px-4 py-3 rounded-xl mb-2 transition-all duration-300 ease-out transform hover:scale-[1.02] hover:shadow-lg hover:shadow-slate-300/30 dark:hover:shadow-slate-900/40 ${
                      currentView === tab.id
                        ? `${tab.id === 'todos' ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 text-green-900 dark:text-green-300 border-l-4 border-green-500 shadow-md shadow-green-200/40 dark:shadow-green-900/20' : 
                            tab.id === 'calendar' ? 'bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/30 dark:to-cyan-900/30 text-blue-900 dark:text-blue-300 border-l-4 border-blue-500 shadow-md shadow-blue-200/40 dark:shadow-blue-900/20' :
                            tab.id === 'life-categories' ? 'bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-900/30 dark:to-violet-900/30 text-purple-900 dark:text-purple-300 border-l-4 border-purple-500 shadow-md shadow-purple-200/40 dark:shadow-purple-900/20' :
                            tab.id === 'goals' ? 'bg-gradient-to-r from-slate-100 to-gray-100 dark:from-slate-800/50 dark:to-gray-800/50 text-slate-800 dark:text-slate-300 border-l-4 border-slate-700 shadow-md shadow-slate-200/40 dark:shadow-slate-900/20' :
                            tab.id === 'routines' ? 'bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/30 dark:to-amber-900/30 text-orange-900 dark:text-orange-300 border-l-4 border-orange-500 shadow-md shadow-orange-200/40 dark:shadow-orange-900/20' :
                            tab.id === 'notes' ? 'bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/30 dark:to-amber-900/30 text-yellow-900 dark:text-yellow-300 border-l-4 border-yellow-500 shadow-md shadow-yellow-200/40 dark:shadow-yellow-900/20' :
                            'bg-gradient-to-r from-slate-100 to-gray-100 dark:from-slate-700 dark:to-gray-700 text-slate-900 dark:text-white border-l-4 border-slate-500 dark:border-slate-400 shadow-md shadow-slate-200/40 dark:shadow-slate-900/20'}`
                        : 'text-slate-700 dark:text-slate-300 hover:bg-gradient-to-r hover:from-slate-100 hover:to-slate-50 dark:hover:from-slate-700 dark:hover:to-slate-800'
                    }`}
                  >
                    <span className={tab.color}>{tab.icon}</span>
                    {sidebarWidth > 200 && (
                      <span className="ml-3 text-sm font-medium truncate">{tab.label}</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Life Categories Quick Access - Top 3 Priority */}
              <div className="mb-6">
                {sidebarWidth > 200 && (
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                    Top Priority Categories
                  </h3>
                )}
                {topPriorityCategories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => onNavigateToCategory(category.id)}
                    className={`w-full flex items-center px-3 py-2 rounded-lg mb-1 transition-colors ${
                      currentView === category.id
                        ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-l-4 border-blue-500'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                    style={{
                      borderLeftColor: currentView === category.id ? category.color : 'transparent',
                      borderLeftWidth: currentView === category.id ? '4px' : '0px'
                    }}
                  >
                    <span className="text-lg mr-3 flex-shrink-0">{category.icon}</span>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-medium truncate">{category.name}</p>
                      <div className="flex items-center mt-1">
                        <span className="inline-block w-2 h-2 bg-red-400 rounded-full mr-1 flex-shrink-0"></span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          Priority {category.priority === 0 ? 'Foundation' : category.priority}
                        </span>
                        {category.priority <= 1 && (
                          <Star className="w-3 h-3 text-yellow-500 fill-current ml-1 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  </button>
                ))}
                
                {/* View All Categories Button */}
                {sidebarWidth > 200 ? (
                  <button
                    onClick={() => onNavigateToGlobal('life-categories')}
                    className="w-full text-center px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg mt-2 transition-colors"
                  >
                    View All Categories
                  </button>
                ) : (
                  <button
                    onClick={() => onNavigateToGlobal('life-categories')}
                    className="w-full flex justify-center px-3 py-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg mt-2 transition-colors"
                    title="View All Categories"
                  >
                    <FolderOpen className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Settings */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => onNavigateToGlobal('settings')}
                  className={`w-full flex items-center px-3 py-2 rounded-lg transition-colors ${
                    currentView === 'settings'
                      ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-white'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Settings className="w-5 h-5 mr-3" />
                  Settings
                </button>
              </div>
            </nav>
          </>
        )}
        
        {/* Resize Handle */}
        {!isCollapsed && (
          <div
            ref={resizeHandleRef}
            className="absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize bg-gray-300 dark:bg-gray-600 opacity-0 hover:opacity-100 transition-opacity duration-200"
            onMouseDown={handleResizeMouseDown}
            title="Drag to resize"
          >
            <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-1 h-8 bg-gray-400 dark:bg-gray-500 rounded-l-full"></div>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">Sidebar Settings</h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Auto-hide sidebar
                </label>
                <input
                  type="checkbox"
                  checked={autoHide}
                  onChange={(e) => {
                    setAutoHide(e.target.checked);
                    localStorage.setItem('sidebarAutoHide', e.target.checked.toString());
                  }}
                  className="rounded"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
                  Sidebar width: {sidebarWidth}px
                </label>
                <input
                  type="range"
                  min="200"
                  max="500"
                  value={sidebarWidth}
                  onChange={(e) => {
                    const newWidth = parseInt(e.target.value);
                    setSidebarWidth(newWidth);
                    localStorage.setItem('sidebarWidth', newWidth.toString());
                  }}
                  className="w-full"
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar; 