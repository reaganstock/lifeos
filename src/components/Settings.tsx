import React, { useState, useEffect } from 'react';
import { Moon, Sun, LogOut, User, Database, Zap, Link, Brain, Edit3, Save, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuthContext } from './AuthProvider';
import IntegrationManager from './IntegrationManager';
import { Item } from '../types';
import { ImportResult } from '../services/integrations/types';

interface SettingsProps {
  items: Item[];
  setItems: React.Dispatch<React.SetStateAction<Item[]>>;
  categories?: Array<{ id: string; name: string; icon: string; color: string }>;
}

const Settings: React.FC<SettingsProps> = ({ items, setItems, categories = [] }) => {
  const { isDarkMode, toggleDarkMode } = useTheme();
  const { user, signOut } = useAuthContext();
  
  // Auto-approve setting state
  const [autoApprove, setAutoApprove] = useState(false);
  
  // Integration Manager state
  const [showIntegrationManager, setShowIntegrationManager] = useState(false);
  
  // Profile settings state
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [profileData, setProfileData] = useState({
    displayName: user?.email?.split('@')[0] || '',
    email: user?.email || '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: 'en',
    notifications: true
  });
  
  // Security settings state
  const [showSecuritySettings, setShowSecuritySettings] = useState(false);
  const [securitySettings, setSecuritySettings] = useState({
    twoFactorEnabled: false,
    sessionTimeout: 30, // minutes
    dataEncryption: true,
    activityLogging: true
  });
  
  // Data export/import state
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  
  // Help & Support state
  const [showHelpModal, setShowHelpModal] = useState(false);
  
  // User Context/Summary state
  const [showUserContext, setShowUserContext] = useState(false);
  const [userContext, setUserContext] = useState({
    summary: '',
    workStyle: '',
    priorities: [] as string[],
    interests: [] as string[],
    goals: [] as string[],
    preferredTools: [] as string[],
    workingHours: '',
    personalInsights: [] as string[]
  });
  
  // Load auto-approve setting from localStorage
  useEffect(() => {
    const savedAutoApprove = localStorage.getItem('georgetownAI_autoApprove');
    if (savedAutoApprove !== null) {
      setAutoApprove(JSON.parse(savedAutoApprove));
    }
  }, []);
  
  // Load user context from localStorage
  useEffect(() => {
    if (user?.id) {
      const savedContext = localStorage.getItem(`lifely_user_context_${user.id}`);
      if (savedContext) {
        try {
          const parsed = JSON.parse(savedContext);
          setUserContext(parsed);
        } catch (error) {
          console.error('Error parsing user context:', error);
        }
      } else {
        // Try to build initial context from onboarding data
        generateInitialUserContext();
      }
    }
  }, [user?.id]);
  
  // Generate initial user context from available data
  const generateInitialUserContext = () => {
    if (!user?.id) return;
    
    // Get onboarding data
    const onboardingData = localStorage.getItem(`lifely_onboarding_data_${user.id}`);
    const conversationData = localStorage.getItem(`lifely_onboarding_conversation_${user.id}`);
    const dashboardData = localStorage.getItem(`lifely_dashboard_data_${user.id}`);
    
    let initialContext = { ...userContext };
    
    // Extract from onboarding
    if (onboardingData) {
      try {
        const data = JSON.parse(onboardingData);
        if (data.role) initialContext.workStyle = `${data.role} focused`;
        if (data.goals) initialContext.goals = Array.isArray(data.goals) ? data.goals : [data.goals];
      } catch (e) {}
    }
    
    // Extract from conversation
    if (conversationData) {
      try {
        const data = JSON.parse(conversationData);
        if (data.answers) {
          const answers = data.answers.map((a: any) => a.answer).join(' ');
          if (answers.length > 10) {
            initialContext.summary = answers.substring(0, 200) + '...';
          }
        }
      } catch (e) {}
    }
    
    // Extract from dashboard data
    if (dashboardData) {
      try {
        const data = JSON.parse(dashboardData);
        if (data.workStyle) initialContext.workStyle = data.workStyle;
        if (data.priorities) initialContext.priorities = data.priorities;
        if (data.interests) initialContext.interests = data.interests;
        if (data.personalInsights) initialContext.personalInsights = data.personalInsights;
      } catch (e) {}
    }
    
    // Extract from categories
    if (categories.length > 0) {
      initialContext.priorities = categories.map(c => c.name);
    }
    
    setUserContext(initialContext);
  };
  
  // Save auto-approve setting to localStorage
  const toggleAutoApprove = () => {
    const newValue = !autoApprove;
    setAutoApprove(newValue);
    localStorage.setItem('georgetownAI_autoApprove', JSON.stringify(newValue));
    console.log('🤖 Auto-approve setting changed to:', newValue);
  };
  
  // Save user context to localStorage
  const saveUserContext = () => {
    if (!user?.id) return;
    
    localStorage.setItem(`lifely_user_context_${user.id}`, JSON.stringify(userContext));
    console.log('💾 User context saved:', userContext);
    alert('User context saved successfully!');
  };

  const handleSignOut = async () => {
    const confirmSignOut = window.confirm('Are you sure you want to sign out?');
    if (confirmSignOut) {
      const { error } = await signOut();
      if (error) {
        alert('Error signing out. Please try again.');
        console.error('Sign out error:', error);
      }
    }
  };

  // Profile settings functionality
  const handleProfileUpdate = () => {
    try {
      localStorage.setItem('lifely_profile', JSON.stringify(profileData));
      alert('Profile updated successfully!');
      setShowProfileSettings(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile. Please try again.');
    }
  };

  // Security settings functionality
  const handleSecurityUpdate = () => {
    try {
      localStorage.setItem('lifely_security', JSON.stringify(securitySettings));
      alert('Security settings updated successfully!');
      setShowSecuritySettings(false);
    } catch (error) {
      console.error('Error updating security settings:', error);
      alert('Failed to update security settings. Please try again.');
    }
  };

  // Data export functionality
  const handleDataExport = async () => {
    setIsExporting(true);
    setExportProgress(0);
    
    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setExportProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      // Get all data from localStorage
      const allData = {
        items: JSON.parse(localStorage.getItem('lifeStructureItems') || '[]'),
        categories: JSON.parse(localStorage.getItem('lifeStructureCategories') || '[]'),
        settings: {
          autoApprove: JSON.parse(localStorage.getItem('georgetownAI_autoApprove') || 'false'),
          profile: JSON.parse(localStorage.getItem('lifely_profile') || '{}'),
          security: JSON.parse(localStorage.getItem('lifely_security') || '{}')
        },
        chatSessions: JSON.parse(localStorage.getItem('georgetownAI_chatSessions') || '[]'),
        exportDate: new Date().toISOString(),
        version: '2.0'
      };

      // Create and download file
      const dataStr = JSON.stringify(allData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `lifely-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportProgress(100);
      setTimeout(() => {
        setIsExporting(false);
        setExportProgress(0);
        alert('Data exported successfully!');
      }, 500);

    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Failed to export data. Please try again.');
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  // Data import functionality
  const handleDataImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setIsImporting(true);
      try {
        const text = await file.text();
        const importedData = JSON.parse(text);

        // Validate data structure
        if (!importedData.items || !Array.isArray(importedData.items)) {
          throw new Error('Invalid backup file format');
        }

        const confirmImport = window.confirm(
          `This will replace all your current data with the backup from ${new Date(importedData.exportDate).toLocaleDateString()}. Are you sure?`
        );

        if (confirmImport) {
          // Import all data
          if (importedData.items) {
            localStorage.setItem('lifeStructureItems', JSON.stringify(importedData.items));
            setItems(importedData.items);
          }
          if (importedData.categories) {
            localStorage.setItem('lifeStructureCategories', JSON.stringify(importedData.categories));
          }
          if (importedData.settings) {
            if (importedData.settings.autoApprove !== undefined) {
              localStorage.setItem('georgetownAI_autoApprove', JSON.stringify(importedData.settings.autoApprove));
              setAutoApprove(importedData.settings.autoApprove);
            }
            if (importedData.settings.profile) {
              localStorage.setItem('lifely_profile', JSON.stringify(importedData.settings.profile));
              setProfileData(importedData.settings.profile);
            }
            if (importedData.settings.security) {
              localStorage.setItem('lifely_security', JSON.stringify(importedData.settings.security));
              setSecuritySettings(importedData.settings.security);
            }
          }
          if (importedData.chatSessions) {
            localStorage.setItem('georgetownAI_chatSessions', JSON.stringify(importedData.chatSessions));
          }

          alert('Data imported successfully! Please refresh the page to see all changes.');
        }
      } catch (error) {
        console.error('Error importing data:', error);
        alert('Failed to import data. Please check the file format and try again.');
      } finally {
        setIsImporting(false);
      }
    };
    input.click();
  };

  // Load saved settings on component mount
  useEffect(() => {
    try {
      const savedProfile = localStorage.getItem('lifely_profile');
      if (savedProfile) {
        setProfileData(JSON.parse(savedProfile));
      }

      const savedSecurity = localStorage.getItem('lifely_security');
      if (savedSecurity) {
        setSecuritySettings(JSON.parse(savedSecurity));
      }
    } catch (error) {
      console.error('Error loading saved settings:', error);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-lifeos-50 via-lifeos-100 to-lifeos-200 dark:from-lifeos-dark dark:via-gray-900 dark:to-lifeos-dark/80 relative overflow-hidden">
      {/* Ambient background effects similar to landing page */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-gradient-to-r from-lifeos-primary/10 to-lifeos-secondary/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/3 right-1/4 w-24 h-24 bg-gradient-to-r from-lifeos-secondary/10 to-lifeos-primary/10 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
        <div className="absolute top-1/2 right-1/3 w-16 h-16 bg-gradient-to-r from-lifeos-primary/10 to-lifeos-secondary/10 rounded-full blur-2xl animate-pulse" style={{animationDelay: '4s'}}></div>
      </div>
      <div className="p-6 max-w-4xl mx-auto relative z-10">
        {/* Header */}
        <div className="mb-8">
          <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-3xl border border-white/20 dark:border-gray-700/30 p-8 shadow-2xl hover:bg-white/80 dark:hover:bg-gray-800/80 hover:shadow-3xl hover:scale-[1.02] transition-all duration-500">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-lifeos-primary to-lifeos-secondary rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-lifeos-dark dark:text-white">Settings</h1>
                  <p className="text-lifeos-gray-400 dark:text-gray-300">Customize your Lifely experience</p>
                </div>
              </div>
              {user && (
                <div className="text-right">
                  <p className="text-sm font-medium text-lifeos-dark dark:text-white">{user.email}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Premium Account</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Settings Grid */}
        <div className="grid gap-8">
          {/* Appearance */}
          <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-3xl border border-white/20 dark:border-gray-700/30 p-8 shadow-2xl hover:bg-white/80 dark:hover:bg-gray-800/80 hover:shadow-3xl hover:scale-[1.02] transition-all duration-500 group cursor-pointer">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-lifeos-primary to-lifeos-secondary rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                {isDarkMode ? <Moon className="w-6 h-6 text-white" /> : <Sun className="w-6 h-6 text-white" />}
              </div>
              <h2 className="text-xl font-bold text-lifeos-dark dark:text-white group-hover:text-lifeos-primary transition-colors duration-300">Appearance</h2>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-lifeos-dark dark:text-white">Dark Mode</p>
                <p className="text-sm text-lifeos-gray-400 dark:text-gray-300">Toggle between light and dark themes</p>
              </div>
              <button
                onClick={toggleDarkMode}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isDarkMode ? 'bg-lifeos-primary' : 'bg-gray-200 dark:bg-gray-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isDarkMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* AI Assistant */}
          <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-3xl border border-white/20 dark:border-gray-700/30 p-8 shadow-2xl hover:bg-white/80 dark:hover:bg-gray-800/80 hover:shadow-3xl hover:scale-[1.02] transition-all duration-500 group cursor-pointer">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-lifeos-primary to-lifeos-secondary rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-xl font-bold text-lifeos-dark dark:text-white group-hover:text-lifeos-primary transition-colors duration-300">AI Assistant</h2>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium text-lifeos-dark dark:text-white">Auto-approve Functions</p>
                  <p className="text-sm text-lifeos-gray-400 dark:text-gray-300">Automatically execute safe AI function calls without manual approval</p>
                </div>
                <button
                  onClick={toggleAutoApprove}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    autoApprove ? 'bg-lifeos-primary' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      autoApprove ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <div className="bg-lifeos-50 dark:bg-lifeos-primary/20 rounded-lg p-3">
                <p className="text-xs text-lifeos-primary dark:text-lifeos-primary">
                  <strong>Note:</strong> When enabled, Lifely will automatically execute safe operations like creating items, updating content, and generating schedules. Destructive operations like deletions will still require manual approval.
                </p>
              </div>
            </div>
          </div>

          {/* User Context & Summary */}
          <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-3xl border border-white/20 dark:border-gray-700/30 p-8 shadow-2xl hover:bg-white/80 dark:hover:bg-gray-800/80 hover:shadow-3xl hover:scale-[1.02] transition-all duration-500 group cursor-pointer">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-lifeos-primary to-lifeos-secondary rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-xl font-bold text-lifeos-dark dark:text-white group-hover:text-lifeos-primary transition-colors duration-300">AI Context</h2>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium text-lifeos-dark dark:text-white">Personal Context Summary</p>
                  <p className="text-sm text-lifeos-gray-400 dark:text-gray-300">Help the AI understand you better with your personal context and preferences</p>
                </div>
                <button 
                  onClick={() => setShowUserContext(true)}
                  className="px-6 py-3 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 rounded-xl font-medium hover:from-lifeos-50 hover:to-lifeos-100 hover:text-lifeos-primary transition-all duration-300 hover:scale-105 hover:shadow-lg flex items-center space-x-2"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>Edit Context</span>
                </button>
              </div>
              {userContext.summary && (
                <div className="bg-lifeos-50 dark:bg-lifeos-primary/20 rounded-lg p-3">
                  <p className="text-xs text-lifeos-primary dark:text-lifeos-primary">
                    <strong>Current Summary:</strong> {userContext.summary.substring(0, 100)}...
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Account */}
          <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-3xl border border-white/20 dark:border-gray-700/30 p-8 shadow-2xl hover:bg-white/80 dark:hover:bg-gray-800/80 hover:shadow-3xl hover:scale-[1.02] transition-all duration-500 group cursor-pointer">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-lifeos-primary to-lifeos-secondary rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                <User className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-xl font-bold text-lifeos-dark dark:text-white group-hover:text-lifeos-primary transition-colors duration-300">Account</h2>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium text-lifeos-dark dark:text-white">Profile Settings</p>
                  <p className="text-sm text-lifeos-gray-400 dark:text-gray-300">Update your personal information</p>
                </div>
                <button 
                  onClick={() => setShowProfileSettings(true)}
                  className="px-6 py-3 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 rounded-xl font-medium hover:from-lifeos-50 hover:to-lifeos-100 hover:text-lifeos-primary transition-all duration-300 hover:scale-105 hover:shadow-lg"
                >
                  Configure
                </button>
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium text-lifeos-dark dark:text-white">Security & Privacy</p>
                  <p className="text-sm text-lifeos-gray-400 dark:text-gray-300">Manage your security settings</p>
                </div>
                <button 
                  onClick={() => setShowSecuritySettings(true)}
                  className="px-6 py-3 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 rounded-xl font-medium hover:from-lifeos-50 hover:to-lifeos-100 hover:text-lifeos-primary transition-all duration-300 hover:scale-105 hover:shadow-lg"
                >
                  Configure
                </button>
              </div>
            </div>
          </div>

          {/* Data & Sync */}
          <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-3xl border border-white/20 dark:border-gray-700/30 p-8 shadow-2xl hover:bg-white/80 dark:hover:bg-gray-800/80 hover:shadow-3xl hover:scale-[1.02] transition-all duration-500 group cursor-pointer">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-lifeos-primary to-lifeos-secondary rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                <Database className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-xl font-bold text-lifeos-dark dark:text-white group-hover:text-lifeos-primary transition-colors duration-300">Data & Sync</h2>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium text-lifeos-dark dark:text-white">Third-Party Integrations</p>
                  <p className="text-sm text-lifeos-gray-400 dark:text-gray-300">Connect Todoist, Google Calendar, Notion, YouTube & more</p>
                </div>
                <button 
                  onClick={() => setShowIntegrationManager(true)}
                  className="px-4 py-2 bg-gradient-to-r from-lifeos-primary to-lifeos-secondary text-white rounded-lg hover:from-lifeos-primary hover:to-lifeos-secondary transition-all duration-300 hover:scale-105 hover:shadow-lg flex items-center space-x-2"
                >
                  <Link className="w-4 h-4" />
                  <span>Manage</span>
                </button>
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium text-lifeos-dark dark:text-white">Export Data</p>
                  <p className="text-sm text-lifeos-gray-400 dark:text-gray-300">Download your data as backup</p>
                </div>
                <button 
                  onClick={handleDataExport}
                  disabled={isExporting}
                  className="px-6 py-3 bg-gradient-to-r from-lifeos-primary to-lifeos-secondary text-white rounded-xl font-medium hover:from-lifeos-primary hover:to-lifeos-secondary transition-all duration-300 hover:scale-105 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isExporting ? `Exporting... ${exportProgress}%` : 'Export'}
                </button>
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium text-lifeos-dark dark:text-white">Import Data</p>
                  <p className="text-sm text-lifeos-gray-400 dark:text-gray-300">Restore from backup file</p>
                </div>
                <button 
                  onClick={handleDataImport}
                  disabled={isImporting}
                  className="px-6 py-3 bg-gradient-to-r from-lifeos-primary to-lifeos-secondary text-white rounded-xl font-medium hover:from-lifeos-primary hover:to-lifeos-secondary transition-all duration-300 hover:scale-105 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isImporting ? 'Importing...' : 'Import'}
                </button>
              </div>
            </div>
          </div>

          {/* Sign Out */}
          {user && (
            <div className="bg-red-50/60 dark:bg-red-900/20 backdrop-blur-sm rounded-3xl border border-red-200/50 dark:border-red-700/30 p-8 shadow-2xl hover:bg-red-50/80 dark:hover:bg-red-900/30 hover:shadow-3xl hover:scale-[1.02] transition-all duration-500 group cursor-pointer">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                    <LogOut className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-lg text-lifeos-dark dark:text-white group-hover:text-red-600 transition-colors duration-300">Sign Out</p>
                    <p className="text-lifeos-gray-400 dark:text-gray-300">Sign out of your account</p>
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  className="px-8 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-medium hover:from-red-600 hover:to-red-700 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:-translate-y-0.5"
                >
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
          <div className="inline-flex items-center space-x-4 bg-white/60 backdrop-blur-sm rounded-3xl px-8 py-4 border border-white/20 shadow-xl hover:bg-white/80 hover:shadow-2xl hover:scale-105 transition-all duration-500 group cursor-pointer">
            <div className="w-6 h-6 bg-gradient-to-br from-lifeos-primary to-lifeos-secondary rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
              </svg>
            </div>
            <span className="text-sm text-lifeos-gray-400 dark:text-gray-300">Lifely v2.0</span>
            <button 
              onClick={() => setShowHelpModal(true)}
              className="text-sm font-medium text-lifeos-primary hover:text-lifeos-secondary transition-all duration-300 hover:scale-105 hover:translate-x-1"
            >
              Help & Support
            </button>
          </div>
        </div>
      </div>
      
      {/* Integration Manager Modal */}
      <IntegrationManager 
        isOpen={showIntegrationManager}
        onClose={() => setShowIntegrationManager(false)}
        categories={categories}
        onImport={(results: ImportResult[]) => {
          console.log('Integration import results:', results);
          // Reload items from localStorage to reflect the imported data
          const savedItems = localStorage.getItem('lifeStructureItems');
          if (savedItems) {
            try {
              const parsedItems = JSON.parse(savedItems);
              const refreshedItems = parsedItems.map((item: any) => ({
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
              setItems(refreshedItems);
              console.log('🔄 Refreshed React state with', refreshedItems.length, 'items from localStorage');
            } catch (error) {
              console.error('Error refreshing items from localStorage:', error);
            }
          }
        }}
      />

      {/* Profile Settings Modal */}
      {showProfileSettings && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <h3 className="text-2xl font-bold text-lifeos-dark dark:text-white mb-6">Profile Settings</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-lifeos-gray-400 dark:text-gray-300 mb-2">
                  Display Name
                </label>
                <input
                  type="text"
                  value={profileData.displayName}
                  onChange={(e) => setProfileData(prev => ({ ...prev, displayName: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-lifeos-dark dark:text-white focus:ring-2 focus:ring-lifeos-primary focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-lifeos-gray-400 dark:text-gray-300 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={profileData.email}
                  onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-lifeos-dark dark:text-white focus:ring-2 focus:ring-lifeos-primary focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-lifeos-gray-400 dark:text-gray-300 mb-2">
                  Timezone
                </label>
                <select
                  value={profileData.timezone}
                  onChange={(e) => setProfileData(prev => ({ ...prev, timezone: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-lifeos-dark dark:text-white focus:ring-2 focus:ring-lifeos-primary focus:border-transparent"
                >
                  <option value="America/New_York">Eastern Time</option>
                  <option value="America/Chicago">Central Time</option>
                  <option value="America/Denver">Mountain Time</option>
                  <option value="America/Los_Angeles">Pacific Time</option>
                  <option value="Europe/London">London</option>
                  <option value="Europe/Paris">Paris</option>
                  <option value="Asia/Tokyo">Tokyo</option>
                </select>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-lifeos-gray-400 dark:text-gray-300">Notifications</span>
                <button
                  onClick={() => setProfileData(prev => ({ ...prev, notifications: !prev.notifications }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    profileData.notifications ? 'bg-lifeos-primary' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      profileData.notifications ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
            
            <div className="flex space-x-3 mt-8">
              <button
                onClick={handleProfileUpdate}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-lifeos-primary to-lifeos-secondary text-white rounded-xl font-medium hover:from-lifeos-primary hover:to-lifeos-secondary transition-all duration-300 hover:scale-105 hover:shadow-lg"
              >
                Save Changes
              </button>
              <button
                onClick={() => setShowProfileSettings(false)}
                className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Context Modal */}
      {showUserContext && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-2xl w-full shadow-2xl max-h-[80vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-lifeos-dark dark:text-white mb-6 flex items-center space-x-2">
              <Brain className="w-6 h-6" />
              <span>AI Context & Summary</span>
            </h3>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-lifeos-gray-400 dark:text-gray-300 mb-2">
                  Personal Summary
                </label>
                <textarea
                  value={userContext.summary}
                  onChange={(e) => setUserContext({...userContext, summary: e.target.value})}
                  placeholder="Tell the AI about yourself, your role, current projects, and what you're working on..."
                  className="w-full p-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-lifeos-primary focus:border-transparent resize-none"
                  rows={4}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-lifeos-gray-400 dark:text-gray-300 mb-2">
                    Work Style
                  </label>
                  <input
                    type="text"
                    value={userContext.workStyle}
                    onChange={(e) => setUserContext({...userContext, workStyle: e.target.value})}
                    placeholder="e.g., Focused, Creative, Analytical..."
                    className="w-full p-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-lifeos-primary focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-lifeos-gray-400 dark:text-gray-300 mb-2">
                    Working Hours
                  </label>
                  <input
                    type="text"
                    value={userContext.workingHours}
                    onChange={(e) => setUserContext({...userContext, workingHours: e.target.value})}
                    placeholder="e.g., 9am-5pm EST, Flexible..."
                    className="w-full p-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-lifeos-primary focus:border-transparent"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-lifeos-gray-400 dark:text-gray-300 mb-2">
                  Current Priorities (one per line)
                </label>
                <textarea
                  value={userContext.priorities.join('\n')}
                  onChange={(e) => setUserContext({...userContext, priorities: e.target.value.split('\n').filter(p => p.trim())})}
                  placeholder="List your current main priorities..."
                  className="w-full p-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-lifeos-primary focus:border-transparent resize-none"
                  rows={3}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-lifeos-gray-400 dark:text-gray-300 mb-2">
                  Tools & Platforms You Use
                </label>
                <textarea
                  value={userContext.preferredTools.join('\n')}
                  onChange={(e) => setUserContext({...userContext, preferredTools: e.target.value.split('\n').filter(t => t.trim())})}
                  placeholder="e.g., Notion, Slack, Google Calendar..."
                  className="w-full p-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-lifeos-primary focus:border-transparent resize-none"
                  rows={2}
                />
              </div>
              
              <div className="bg-lifeos-50 dark:bg-lifeos-primary/20 rounded-lg p-4">
                <p className="text-sm text-lifeos-primary dark:text-lifeos-primary">
                  <strong>How this helps:</strong> This context will be available to the AI Assistant to provide more personalized and relevant suggestions. Your data stays private and is only used to enhance your experience.
                </p>
              </div>
            </div>
            
            <div className="flex space-x-3 mt-8">
              <button
                onClick={saveUserContext}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-lifeos-primary to-lifeos-secondary text-white rounded-xl font-medium hover:from-lifeos-primary hover:to-lifeos-secondary transition-all duration-300 hover:scale-105 hover:shadow-lg flex items-center justify-center space-x-2"
              >
                <Save className="w-4 h-4" />
                <span>Save Context</span>
              </button>
              <button
                onClick={() => setShowUserContext(false)}
                className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-300 flex items-center space-x-2"
              >
                <X className="w-4 h-4" />
                <span>Cancel</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Security Settings Modal */}
      {showSecuritySettings && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <h3 className="text-2xl font-bold text-lifeos-dark dark:text-white mb-6">Security & Privacy</h3>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-lifeos-dark dark:text-white">Two-Factor Authentication</p>
                  <p className="text-sm text-lifeos-gray-400 dark:text-gray-300">Add extra security to your account</p>
                </div>
                <button
                  onClick={() => setSecuritySettings(prev => ({ ...prev, twoFactorEnabled: !prev.twoFactorEnabled }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    securitySettings.twoFactorEnabled ? 'bg-lifeos-primary' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      securitySettings.twoFactorEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-lifeos-gray-400 dark:text-gray-300 mb-2">
                  Session Timeout (minutes)
                </label>
                <select
                  value={securitySettings.sessionTimeout}
                  onChange={(e) => setSecuritySettings(prev => ({ ...prev, sessionTimeout: parseInt(e.target.value) }))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-lifeos-dark dark:text-white focus:ring-2 focus:ring-lifeos-primary focus:border-transparent"
                >
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={240}>4 hours</option>
                  <option value={480}>8 hours</option>
                </select>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-lifeos-dark dark:text-white">Data Encryption</p>
                  <p className="text-sm text-lifeos-gray-400 dark:text-gray-300">Encrypt sensitive data locally</p>
                </div>
                <button
                  onClick={() => setSecuritySettings(prev => ({ ...prev, dataEncryption: !prev.dataEncryption }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    securitySettings.dataEncryption ? 'bg-lifeos-primary' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      securitySettings.dataEncryption ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-lifeos-dark dark:text-white">Activity Logging</p>
                  <p className="text-sm text-lifeos-gray-400 dark:text-gray-300">Log user actions for security</p>
                </div>
                <button
                  onClick={() => setSecuritySettings(prev => ({ ...prev, activityLogging: !prev.activityLogging }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    securitySettings.activityLogging ? 'bg-lifeos-primary' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      securitySettings.activityLogging ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
            
            <div className="flex space-x-3 mt-8">
              <button
                onClick={handleSecurityUpdate}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-lifeos-primary to-lifeos-secondary text-white rounded-xl font-medium hover:from-lifeos-primary hover:to-lifeos-secondary transition-all duration-300 hover:scale-105 hover:shadow-lg"
              >
                Save Changes
              </button>
              <button
                onClick={() => setShowSecuritySettings(false)}
                className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help & Support Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-lg w-full shadow-2xl">
            <h3 className="text-2xl font-bold text-lifeos-dark dark:text-white mb-6">Help & Support</h3>
            
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="p-4 bg-lifeos-50 dark:bg-lifeos-primary/10 rounded-xl">
                  <h4 className="font-semibold text-lifeos-dark dark:text-white mb-2">📚 Getting Started</h4>
                  <p className="text-sm text-lifeos-gray-400 dark:text-gray-300">
                    Check out our comprehensive guides to get the most out of Lifely.
                  </p>
                </div>
                
                <div className="p-4 bg-lifeos-50 dark:bg-lifeos-primary/10 rounded-xl">
                  <h4 className="font-semibold text-lifeos-dark dark:text-white mb-2">💬 Community Support</h4>
                  <p className="text-sm text-lifeos-gray-400 dark:text-gray-300">
                    Join our Discord community for tips, tricks, and peer support.
                  </p>
                </div>
                
                <div className="p-4 bg-lifeos-50 dark:bg-lifeos-primary/10 rounded-xl">
                  <h4 className="font-semibold text-lifeos-dark dark:text-white mb-2">🐛 Report Issues</h4>
                  <p className="text-sm text-lifeos-gray-400 dark:text-gray-300">
                    Found a bug? Report it on our GitHub repository or contact support.
                  </p>
                </div>
                
                <div className="p-4 bg-lifeos-50 dark:bg-lifeos-primary/10 rounded-xl">
                  <h4 className="font-semibold text-lifeos-dark dark:text-white mb-2">✨ Feature Requests</h4>
                  <p className="text-sm text-lifeos-gray-400 dark:text-gray-300">
                    Have an idea? We'd love to hear it! Submit feature requests through our feedback portal.
                  </p>
                </div>
              </div>
              
              <div className="flex flex-col space-y-3">
                <button className="w-full px-6 py-3 bg-gradient-to-r from-lifeos-primary to-lifeos-secondary text-white rounded-xl font-medium hover:from-lifeos-primary hover:to-lifeos-secondary transition-all duration-300 hover:scale-105 hover:shadow-lg">
                  Visit Documentation
                </button>
                <button className="w-full px-6 py-3 bg-gray-100 dark:bg-gray-700 text-lifeos-dark dark:text-white rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-300">
                  Contact Support
                </button>
              </div>
            </div>
            
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowHelpModal(false)}
                className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;