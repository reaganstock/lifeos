import React from 'react';
import { Cloud, CloudOff, Loader2, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useHybridSync } from '../hooks/useHybridSync';

const SyncStatusIndicator: React.FC = () => {
  const { syncStatus, manualSync, isOnline } = useHybridSync();

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

  return (
    <div className="flex items-center space-x-2 text-sm">
      {/* Sync Status Icon */}
      <div className={`${getSyncColor()} transition-colors`}>
        {getSyncIcon()}
      </div>
      
      {/* Status Text */}
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
  );
};

export default SyncStatusIndicator;