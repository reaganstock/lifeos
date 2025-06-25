import React, { useState, useEffect } from 'react';
import { Moon, Sun, Settings as SettingsIcon, LogOut, User, Shield, Database, Bell, Globe, HelpCircle, Zap, Link } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuthContext } from './AuthProvider';
import IntegrationManager from './IntegrationManager';
import { Item } from '../types';

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
  
  // Load auto-approve setting from localStorage
  useEffect(() => {
    const savedAutoApprove = localStorage.getItem('georgetownAI_autoApprove');
    if (savedAutoApprove !== null) {
      setAutoApprove(JSON.parse(savedAutoApprove));
    }
  }, []);
  
  // Save auto-approve setting to localStorage
  const toggleAutoApprove = () => {
    const newValue = !autoApprove;
    setAutoApprove(newValue);
    localStorage.setItem('georgetownAI_autoApprove', JSON.stringify(newValue));
    console.log('🤖 Auto-approve setting changed to:', newValue);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-gray-900 dark:via-slate-900 dark:to-indigo-950/30">
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-lg border border-white/30 dark:border-gray-700/30 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <SettingsIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
                  <p className="text-gray-600 dark:text-gray-300">Customize your Life Structure experience</p>
                </div>
              </div>
              {user && (
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{user.email}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Premium Account</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Settings Grid */}
        <div className="grid gap-6">
          {/* Appearance */}
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-lg border border-white/30 dark:border-gray-700/30 p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                {isDarkMode ? <Moon className="w-4 h-4 text-purple-600 dark:text-purple-400" /> : <Sun className="w-4 h-4 text-purple-600 dark:text-purple-400" />}
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Appearance</h2>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Dark Mode</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">Toggle between light and dark themes</p>
              </div>
              <button
                onClick={toggleDarkMode}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isDarkMode ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
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
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-lg border border-white/30 dark:border-gray-700/30 p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                <Zap className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">AI Assistant</h2>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Auto-approve Functions</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Automatically execute safe AI function calls without manual approval</p>
                </div>
                <button
                  onClick={toggleAutoApprove}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    autoApprove ? 'bg-purple-600' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      autoApprove ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  <strong>Note:</strong> When enabled, the AI will automatically execute safe operations like creating items, updating content, and generating schedules. Destructive operations like deletions will still require manual approval.
                </p>
              </div>
            </div>
          </div>

          {/* Account */}
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-lg border border-white/30 dark:border-gray-700/30 p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Account</h2>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Profile Settings</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Update your personal information</p>
                </div>
                <button className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                  Configure
                </button>
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Security & Privacy</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Manage your security settings</p>
                </div>
                <button className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                  Configure
                </button>
              </div>
            </div>
          </div>

          {/* Data & Sync */}
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-lg border border-white/30 dark:border-gray-700/30 p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                <Database className="w-4 h-4 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Data & Sync</h2>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Third-Party Integrations</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Connect Todoist, Google Calendar, Notion, YouTube & more</p>
                </div>
                <button 
                  onClick={() => setShowIntegrationManager(true)}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-colors flex items-center space-x-2"
                >
                  <Link className="w-4 h-4" />
                  <span>Manage</span>
                </button>
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Export Data</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Download your data as backup</p>
                </div>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  Export
                </button>
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Import Data</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Restore from backup file</p>
                </div>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  Import
                </button>
              </div>
            </div>
          </div>

          {/* Sign Out */}
          {user && (
            <div className="bg-red-50 dark:bg-red-900/20 backdrop-blur-xl rounded-2xl shadow-lg border border-red-200 dark:border-red-800/30 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                    <LogOut className="w-4 h-4 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Sign Out</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Sign out of your account</p>
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center space-x-3 bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-xl px-4 py-3 border border-white/30 dark:border-gray-700/30">
            <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <SettingsIcon className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-300">Life Structure v2.0</span>
            <button className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
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
        onImport={(results) => {
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
    </div>
  );
};

export default Settings;