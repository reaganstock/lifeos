import React from 'react';
import { Moon, Sun, Settings as SettingsIcon, Palette, Bell, Shield, User } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface BaseSettingItem {
  id: string;
  label: string;
  description: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}

interface ToggleSettingItem extends BaseSettingItem {
  type: 'toggle';
  value: boolean;
  onChange: () => void;
}

interface ButtonSettingItem extends BaseSettingItem {
  type: 'button';
  onClick: () => void;
}

type SettingItem = ToggleSettingItem | ButtonSettingItem;

interface SettingsSection {
  title: string;
  icon: React.ReactNode;
  items: SettingItem[];
}

const Settings: React.FC = () => {
  const { isDarkMode, toggleDarkMode } = useTheme();

  const settingsSections: SettingsSection[] = [
    {
      title: 'Appearance',
      icon: <Palette className="w-5 h-5" />,
      items: [
        {
          id: 'dark-mode',
          label: 'Dark Mode',
          description: 'Switch between light and dark themes',
          type: 'toggle',
          value: isDarkMode,
          onChange: toggleDarkMode,
          icon: isDarkMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />
        }
      ]
    },
    {
      title: 'Notifications',
      icon: <Bell className="w-5 h-5" />,
      items: [
        {
          id: 'push-notifications',
          label: 'Push Notifications',
          description: 'Receive notifications for important updates',
          type: 'toggle',
          value: true,
          onChange: () => {},
          disabled: true
        }
      ]
    },
    {
      title: 'Privacy & Security',
      icon: <Shield className="w-5 h-5" />,
      items: [
        {
          id: 'data-sync',
          label: 'Data Synchronization',
          description: 'Sync your data across devices',
          type: 'toggle',
          value: false,
          onChange: () => {},
          disabled: true
        }
      ]
    },
    {
      title: 'Account',
      icon: <User className="w-5 h-5" />,
      items: [
        {
          id: 'profile',
          label: 'Profile Settings',
          description: 'Manage your profile information',
          type: 'button',
          onClick: () => {},
          disabled: true
        }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900 transition-colors duration-300">
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 dark:border-gray-700/30 p-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center">
                <SettingsIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Settings</h1>
                <p className="text-gray-600 dark:text-gray-300 mt-1">
                  Customize your Life Structure experience
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Settings Sections */}
        <div className="space-y-6">
          {settingsSections.map((section) => (
            <div
              key={section.title}
              className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/30 dark:border-gray-700/30 overflow-hidden"
            >
              {/* Section Header */}
              <div className="bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-700 dark:to-blue-800 p-4 border-b border-gray-200/50 dark:border-gray-600/50">
                <div className="flex items-center space-x-3">
                  <div className="text-blue-600 dark:text-blue-400">
                    {section.icon}
                  </div>
                  <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                    {section.title}
                  </h2>
                </div>
              </div>

              {/* Section Items */}
              <div className="p-6 space-y-4">
                {section.items.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-4 rounded-xl transition-all duration-300 ${
                      item.disabled 
                        ? 'bg-gray-50/50 dark:bg-gray-700/50 opacity-60' 
                        : 'bg-gray-50/50 dark:bg-gray-700/50 hover:bg-gray-100/50 dark:hover:bg-gray-600/50'
                    }`}
                  >
                    <div className="flex items-center space-x-4">
                      {item.icon && (
                        <div className="text-gray-600 dark:text-gray-300">
                          {item.icon}
                        </div>
                      )}
                      <div>
                        <h3 className="font-semibold text-gray-800 dark:text-white">
                          {item.label}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {item.description}
                        </p>
                        {item.disabled && (
                          <span className="text-xs text-gray-500 dark:text-gray-500 italic">
                            Coming soon
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Control */}
                    <div>
                      {item.type === 'toggle' && (
                        <button
                          onClick={item.onChange}
                          disabled={item.disabled}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 ${
                            item.value
                              ? 'bg-gradient-to-r from-blue-500 to-cyan-500'
                              : 'bg-gray-300 dark:bg-gray-600'
                          } ${item.disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ${
                              item.value ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      )}

                      {item.type === 'button' && (
                        <button
                          onClick={item.onClick}
                          disabled={item.disabled}
                          className={`px-4 py-2 rounded-xl font-semibold transition-all duration-300 ${
                            item.disabled
                              ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-500 cursor-not-allowed'
                              : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white transform hover:scale-105 shadow-lg'
                          }`}
                        >
                          Configure
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center">
          <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl shadow-lg border border-white/30 dark:border-gray-700/30 p-6">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
              Life Structure v1.0
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Built for Georgetown success • More customization options coming soon
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings; 