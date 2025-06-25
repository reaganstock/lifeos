import { useEffect, useState } from 'react';
import { hybridSyncService } from '../services/hybridSyncService';
import { migrateNotesToLocalStorage, hasStoredAudio, getStoredAudioData } from '../utils/audioStorage';
import { migrateImagesToLocalStorage, hasStoredImages, getImageUrls } from '../utils/imageStorage';
import { Item } from '../types';

interface SyncStatus {
  lastSync: string | null;
  inProgress: boolean;
  error: string | null;
  rehydrated: boolean; // Track if post-refresh rehydration is complete
}

export const useHybridSync = () => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    lastSync: null,
    inProgress: false,
    error: null,
    rehydrated: false
  });

  useEffect(() => {
    // Initialize sync service on app start
    const initializeSync = async () => {
      try {
        await hybridSyncService.initialize();
        updateSyncStatus();
        
        // Make sync methods available globally for debugging
        (window as any).debugSync = {
          manualSync: () => hybridSyncService.manualSync(),
          diagnoseSync: () => hybridSyncService.diagnoseSync(),
          manualSyncWithDiagnostics: () => hybridSyncService.manualSyncWithDiagnostics(),
          forceReloadFromSupabase: async () => {
            console.log('🔄 Forcing reload from Supabase...');
            
            // SAFETY: Backup current localStorage first
            const currentItems = localStorage.getItem('lifeStructureItems');
            const currentCategories = localStorage.getItem('lifeStructureCategories');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            
            if (currentItems) {
              localStorage.setItem(`backup_items_${timestamp}`, currentItems);
              console.log(`💾 Backed up current items to: backup_items_${timestamp}`);
            }
            if (currentCategories) {
              localStorage.setItem(`backup_categories_${timestamp}`, currentCategories);
              console.log(`💾 Backed up current categories to: backup_categories_${timestamp}`);
            }
            
            // Clear sync metadata to trigger first-sync behavior
            localStorage.removeItem('lifeOS_sync_metadata');
            await hybridSyncService.manualSync();
            console.log('✅ Forced reload complete');
            
            // Add recovery function to window for emergency use
            (window as any).debugSync.recoverFromBackup = (backupTimestamp: string) => {
              const backupItems = localStorage.getItem(`backup_items_${backupTimestamp}`);
              const backupCategories = localStorage.getItem(`backup_categories_${backupTimestamp}`);
              
              if (backupItems) {
                localStorage.setItem('lifeStructureItems', backupItems);
                console.log('✅ Restored items from backup');
              }
              if (backupCategories) {
                localStorage.setItem('lifeStructureCategories', backupCategories);
                console.log('✅ Restored categories from backup');
              }
              
              // Trigger reload
              window.location.reload();
            };
            
            console.log(`🛟 Recovery available: window.debugSync.recoverFromBackup('${timestamp}')`);
          },
          safeSyncToSupabase: async () => {
            console.log('🔄 Safe sync: uploading all local data to Supabase first...');
            
            // Force upload ALL local items to Supabase (no content matching)
            const localItems = JSON.parse(localStorage.getItem('lifeStructureItems') || '[]');
            const localCategories = JSON.parse(localStorage.getItem('lifeStructureCategories') || '[]');
            
            console.log(`📤 Uploading ${localItems.length} items and ${localCategories.length} categories to Supabase...`);
            
            // This will force sync all local items regardless of content matching
            localStorage.setItem('force_upload_all', 'true');
            await hybridSyncService.manualSync();
            localStorage.removeItem('force_upload_all');
            
            console.log('✅ Safe sync complete - all local data preserved in Supabase');
          }
        };
        console.log('🔧 Debug sync methods available: window.debugSync (includes forceReloadFromSupabase)');
      } catch (error) {
        console.error('Failed to initialize sync:', error);
        setSyncStatus(prev => ({
          ...prev,
          error: 'Failed to initialize sync'
        }));
      }
    };

    initializeSync();

    // Poll sync status every 30 seconds for UI updates
    const statusInterval = setInterval(updateSyncStatus, 30000);

    return () => {
      clearInterval(statusInterval);
      hybridSyncService.stopPeriodicSync();
    };
  }, []);

  const updateSyncStatus = () => {
    const status = hybridSyncService.getSyncStatus();
    setSyncStatus(prev => ({
      ...prev,
      lastSync: status.lastSync,
      inProgress: status.inProgress
    }));
  };

  const manualSync = async () => {
    try {
      setSyncStatus(prev => ({ ...prev, error: null }));
      await hybridSyncService.manualSync();
      updateSyncStatus();
    } catch (error) {
      console.error('Manual sync failed:', error);
      setSyncStatus(prev => ({
        ...prev,
        error: 'Sync failed'
      }));
    }
  };

  // Rehydrate voice notes and images after refresh
  const rehydrateVoiceNotes = async (items: Item[]): Promise<Item[]> => {
    console.log('🔄 Starting voice note and image rehydration...');
    
    const rehydratedItems = await Promise.all(
      items.map(async (item) => {
        let updatedItem = { ...item };
        
        // Handle voice note rehydration
        if (item.type === 'voiceNote') {
          const audioStorageId = item.metadata?.audioStorageId || item.id;
          
          // Check if audio is stored locally
          if (hasStoredAudio(audioStorageId)) {
            const storedAudioData = getStoredAudioData(audioStorageId);
            if (storedAudioData) {
              console.log('✅ Rehydrated voice note from localStorage:', item.id);
              updatedItem = {
                ...updatedItem,
                attachment: storedAudioData.dataUrl,
                metadata: {
                  ...updatedItem.metadata,
                  audioStorageId: audioStorageId
                }
              };
            }
          } else if (item.attachment && !item.attachment.startsWith('blob:')) {
            console.log('🔗 Voice note has valid attachment URL:', item.id);
          } else {
            console.warn('⚠️ Voice note missing valid audio source:', item.id);
          }
        }
        
        // Handle image rehydration
        if (item.metadata?.hasImage) {
          const imageStorageId = item.metadata?.imageStorageId || item.id;
          
          // Check if images are stored locally
          if (hasStoredImages(imageStorageId)) {
            const storedImageUrls = getImageUrls(imageStorageId, item.metadata?.imageUrls);
            if (storedImageUrls.length > 0) {
              console.log('✅ Rehydrated images from localStorage:', item.id, `(${storedImageUrls.length} images)`);
              updatedItem = {
                ...updatedItem,
                metadata: {
                  ...updatedItem.metadata,
                  imageUrls: storedImageUrls,
                  imageStorageId: imageStorageId
                }
              };
            }
          } else if (item.metadata?.imageUrls && item.metadata.imageUrls.length > 0) {
            // Check if existing URLs are still valid (not blob URLs)
            const validUrls = item.metadata.imageUrls.filter(url => !url.startsWith('blob:'));
            if (validUrls.length > 0) {
              console.log('🔗 Note has valid image URLs:', item.id);
            } else {
              console.warn('⚠️ Note has invalid blob image URLs:', item.id);
            }
          }
        }
        
        return updatedItem;
      })
    );
    
    setSyncStatus(prev => ({ ...prev, rehydrated: true }));
    console.log('✅ Voice note and image rehydration complete');
    
    return rehydratedItems;
  };

  const formatLastSync = (lastSync: string | null): string => {
    if (!lastSync) return 'Never';
    
    const now = new Date();
    const syncTime = new Date(lastSync);
    const diffMs = now.getTime() - syncTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return syncTime.toLocaleDateString();
  };

  const manualSyncWithDiagnostics = async () => {
    try {
      setSyncStatus(prev => ({ ...prev, error: null }));
      await hybridSyncService.manualSyncWithDiagnostics();
      updateSyncStatus();
    } catch (error) {
      console.error('Manual sync with diagnostics failed:', error);
      setSyncStatus(prev => ({
        ...prev,
        error: 'Sync failed'
      }));
    }
  };

  return {
    syncStatus: {
      ...syncStatus,
      lastSyncFormatted: formatLastSync(syncStatus.lastSync)
    },
    manualSync,
    manualSyncWithDiagnostics,
    rehydrateVoiceNotes,
    isOnline: navigator.onLine
  };
};