import React, { useState, useEffect } from 'react';
import { X, Database, Upload, CheckCircle, AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';
import { MigrationProgress, createMigrationManager } from '../utils/migration';
import { SupabaseDataActions } from '../hooks/useSupabaseData';

interface MigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  supabaseActions: SupabaseDataActions;
  onMigrationComplete?: () => void;
}

export function MigrationModal({ 
  isOpen, 
  onClose, 
  supabaseActions, 
  onMigrationComplete 
}: MigrationModalProps) {
  const [progress, setProgress] = useState<MigrationProgress | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localStorageInfo, setLocalStorageInfo] = useState<{
    hasData: boolean;
    itemsCount: number;
    categoriesCount: number;
    keys: string[];
  }>({ hasData: false, itemsCount: 0, categoriesCount: 0, keys: [] });

  useEffect(() => {
    if (isOpen) {
      checkLocalStorageData();
    }
  }, [isOpen]);

  const checkLocalStorageData = () => {
    const migrationManager = createMigrationManager();
    const localData = migrationManager.detectLocalStorageData();
    
    // Get all relevant localStorage keys
    const relevantKeys = [
      'lifeStructureItems',
      'lifeStructureCategories', 
      'lifeOS-items',
      'lifeOS-categories',
      'georgetownAI_items',
      'georgetownAI_voiceModel',
      'georgetownAI_openaiVoice',
      'georgetownAI_geminiVoice',
      'sidebarWidth',
      'sidebarCollapsed',
      'aiSidebarWidth',
      'skipLanding',
      'lifeStructureLogo',
      'lifeStructureTitle',
      'lifeStructureSubtitle',
      'sidebarAutoHide',
      'darkMode'
    ].filter(key => localStorage.getItem(key) !== null);

    setLocalStorageInfo({
      hasData: localData.hasData || relevantKeys.length > 0,
      itemsCount: localData.items.length,
      categoriesCount: localData.categories.length,
      keys: relevantKeys
    });
  };

  const handleStartMigration = async () => {
    setIsRunning(true);
    setError(null);
    setCompleted(false);

    try {
      const migrationManager = createMigrationManager((progress) => {
        setProgress(progress);
      });

      const localData = migrationManager.detectLocalStorageData();
      
      if (!localData.hasData) {
        // Even if no structured data, clean up localStorage
        await cleanupLocalStorage();
        setCompleted(true);
        setProgress({
          phase: 'complete',
          progress: 100,
          message: 'LocalStorage cleaned up successfully!'
        });
        return;
      }

      const result = await migrationManager.migrateToSupabase(localData, supabaseActions);
      
      if (result.success) {
        // Additional cleanup for any remaining localStorage items
        await cleanupLocalStorage();
        setCompleted(true);
        setProgress({
          phase: 'complete',
          progress: 100,
          message: `Migration completed! ${result.itemsMigrated} items and ${result.categoriesMigrated} categories migrated.`
        });
        
        if (onMigrationComplete) {
          onMigrationComplete();
        }
      } else {
        setError(`Migration completed with ${result.errors.length} errors. Check console for details.`);
        console.error('Migration errors:', result.errors);
      }
    } catch (err) {
      setError(`Migration failed: ${err}`);
      console.error('Migration error:', err);
    } finally {
      setIsRunning(false);
    }
  };

  const cleanupLocalStorage = async () => {
    const keysToRemove = [
      'lifeStructureItems',
      'lifeStructureCategories', 
      'lifeOS-items',
      'lifeOS-categories',
      'georgetownAI_items',
      'georgetownAI_voiceModel',
      'georgetownAI_openaiVoice',
      'georgetownAI_geminiVoice',
      'sidebarWidth',
      'sidebarCollapsed',
      'aiSidebarWidth',
      'skipLanding',
      'lifeStructureLogo',
      'lifeStructureTitle',
      'lifeStructureSubtitle',
      'sidebarAutoHide',
      // Keep darkMode setting
    ];
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });
    
    // Set migration flag
    localStorage.setItem('lifeOS-migrated', 'true');
  };

  const handleClearLocalStorageOnly = async () => {
    if (window.confirm('This will clear all localStorage data without migrating to Supabase. Are you sure?')) {
      localStorage.clear();
      // Restore only essential settings
      localStorage.setItem('lifeOS-migrated', 'true');
      localStorage.setItem('skipLanding', 'true');
      
      setCompleted(true);
      setProgress({
        phase: 'complete',
        progress: 100,
        message: 'LocalStorage cleared successfully!'
      });
    }
  };

  const getProgressColor = () => {
    if (error) return 'bg-red-500';
    if (completed) return 'bg-green-500';
    if (progress?.phase === 'error') return 'bg-red-500';
    return 'bg-blue-500';
  };

  const getPhaseIcon = () => {
    if (error || progress?.phase === 'error') return <AlertTriangle className="w-5 h-5 text-red-500" />;
    if (completed || progress?.phase === 'complete') return <CheckCircle className="w-5 h-5 text-green-500" />;
    if (isRunning) return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
    return <Database className="w-5 h-5 text-gray-500" />;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <Database className="w-6 h-6 text-blue-500" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Data Migration
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isRunning}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Local Storage Status */}
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <h3 className="font-semibold text-gray-800 dark:text-white mb-2">
              Local Storage Status
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Items found:</span>
                <span className="font-medium text-gray-800 dark:text-white">
                  {localStorageInfo.itemsCount}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Categories found:</span>
                <span className="font-medium text-gray-800 dark:text-white">
                  {localStorageInfo.categoriesCount}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Storage keys:</span>
                <span className="font-medium text-gray-800 dark:text-white">
                  {localStorageInfo.keys.length}
                </span>
              </div>
            </div>
            
            {localStorageInfo.keys.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-blue-600 dark:text-blue-400 hover:underline">
                  View storage keys
                </summary>
                <div className="mt-2 max-h-32 overflow-y-auto">
                  {localStorageInfo.keys.map(key => (
                    <div key={key} className="text-xs text-gray-500 dark:text-gray-400 py-1">
                      {key}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>

          {/* Progress */}
          {progress && (
            <div className="mb-6">
              <div className="flex items-center space-x-3 mb-2">
                {getPhaseIcon()}
                <span className="font-medium text-gray-800 dark:text-white">
                  {progress.message}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${getProgressColor()}`}
                  style={{ width: `${progress.progress}%` }}
                />
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {progress.progress}% complete
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            {!completed && !isRunning && (
              <>
                <button
                  onClick={handleStartMigration}
                  disabled={isRunning}
                  className="w-full flex items-center justify-center space-x-3 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  <Upload className="w-5 h-5" />
                  <span>
                    {localStorageInfo.hasData 
                      ? 'Migrate to Supabase & Clean Up' 
                      : 'Clean Up LocalStorage'
                    }
                  </span>
                </button>
                
                <button
                  onClick={handleClearLocalStorageOnly}
                  disabled={isRunning}
                  className="w-full flex items-center justify-center space-x-3 py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-5 h-5" />
                  <span>Clear LocalStorage Only</span>
                </button>
              </>
            )}

            {completed && (
              <button
                onClick={() => {
                  onClose();
                  window.location.reload();
                }}
                className="w-full flex items-center justify-center space-x-3 py-3 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                <CheckCircle className="w-5 h-5" />
                <span>Complete & Reload</span>
              </button>
            )}
          </div>

          {/* Info */}
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="text-sm text-blue-600 dark:text-blue-400">
              <strong>What this does:</strong>
              <ul className="mt-2 space-y-1 list-disc list-inside">
                <li>Migrates your data from localStorage to Supabase</li>
                <li>Clears all localStorage keys to prevent conflicts</li>
                <li>Ensures your app uses only Supabase for data storage</li>
                <li>Creates a backup before cleaning up</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 