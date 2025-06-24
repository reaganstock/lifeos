import React from 'react';
import { Cloud, CloudOff, Loader2, RefreshCw, Wifi, WifiOff, HardDrive } from 'lucide-react';
import { useHybridSync } from '../hooks/useHybridSync';
import { getStorageInfo } from '../utils/imageStorage';
import { getStoredAudioData } from '../utils/audioStorage';

const SyncStatusIndicator: React.FC = () => {
  const { syncStatus, manualSync, isOnline } = useHybridSync();
  const storageInfo = getStorageInfo();

  const getSyncIcon = () => {
    if (!isOnline) return <WifiOff className="w-4 h-4" />;
    if (syncStatus.inProgress) return <Loader2 className="w-4 h-4 animate-spin" />;
    if (syncStatus.error) return <CloudOff className="w-4 h-4" />;
    return <Cloud className="w-4 h-4" />;
  };

  const getSyncColor = () => {
    if (!isOnline) return 'text-gray-500';
    if (syncStatus.inProgress) return 'text-blue-500';
    if (syncStatus.error) return 'text-red-500';
    return 'text-green-500';
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getStorageColor = () => {
    const usage = storageInfo.totalSize / (8 * 1024 * 1024); // 8MB max
    if (usage > 0.8) return 'text-red-500';
    if (usage > 0.6) return 'text-yellow-500';
    return 'text-green-500';
  };

  return (
    <div className="flex items-center space-x-4 text-sm">
      {/* Sync Status */}
      <div className="flex items-center space-x-2">
      <div className={`${getSyncColor()} transition-colors`}>
        {getSyncIcon()}
      </div>
      
      <div className="flex items-center space-x-2">
        {!isOnline ? (
          <span className="text-gray-500">Offline</span>
        ) : syncStatus.inProgress ? (
          <span className="text-blue-600">Syncing...</span>
        ) : syncStatus.error ? (
          <span className="text-red-600">Sync failed</span>
        ) : (
          <span className="text-gray-600">
            Last sync: {syncStatus.lastSyncFormatted}
          </span>
        )}
        
        {/* Manual Sync Button */}
        {isOnline && !syncStatus.inProgress && (
          <button
            onClick={manualSync}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            title="Sync now"
          >
            <RefreshCw className="w-3 h-3 text-gray-500 hover:text-blue-500" />
          </button>
          )}
        </div>
      </div>

      {/* Storage Status */}
      <div className="flex items-center space-x-2 border-l border-gray-200 pl-4">
        <div className={`${getStorageColor()} transition-colors`}>
          <HardDrive className="w-4 h-4" />
        </div>
        <span className="text-gray-600 text-xs">
          {formatBytes(storageInfo.totalSize)} used
        </span>
        {storageInfo.totalImages > 0 && (
          <span className="text-gray-500 text-xs">
            ({storageInfo.totalImages} files)
          </span>
        )}
      </div>
    </div>
  );
};

export default SyncStatusIndicator;