import { useEffect, useState } from 'react';
import { hybridSyncService } from '../services/hybridSyncService';

interface SyncStatus {
  lastSync: string | null;
  inProgress: boolean;
  error: string | null;
}

export const useHybridSync = () => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    lastSync: null,
    inProgress: false,
    error: null
  });

  useEffect(() => {
    // Initialize sync service on app start
    const initializeSync = async () => {
      try {
        await hybridSyncService.initialize();
        updateSyncStatus();
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

  return {
    syncStatus: {
      ...syncStatus,
      lastSyncFormatted: formatLastSync(syncStatus.lastSync)
    },
    manualSync,
    isOnline: navigator.onLine
  };
};