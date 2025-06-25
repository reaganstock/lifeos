import { Item, Category } from '../types';
import { supabaseService } from './supabaseService';

interface SyncMetadata {
  lastSyncTime: string;
  syncInProgress: boolean;
  conflicts: any[];
}

class HybridSyncService {
  private syncInterval: NodeJS.Timeout | null = null;
  private isInitialized: boolean = false; // Track initialization state
  private readonly SYNC_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes for better responsiveness
  private readonly STORAGE_KEYS = {
    ITEMS: 'lifeStructureItems',
    CATEGORIES: 'lifeStructureCategories', 
    SYNC_METADATA: 'lifeOS_sync_metadata'
  };

  /**
   * Initialize the hybrid sync service (idempotent)
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('🔄 Sync service already initialized, skipping...');
      return;
    }

    console.log('🔄 Initializing Hybrid Sync Service...');
    
    // Reset any stuck sync state from previous crashes
    this.resetSyncState();
    
    // Start initial sync and periodic sync
    await this.performSync();
    this.startPeriodicSync();
    
    this.isInitialized = true;
    console.log('✅ Hybrid Sync Service initialized successfully');
  }

  /**
   * Reset sync state if it's stuck
   */
  resetSyncState(): void {
    const metadata = this.getSyncMetadata();
    if (metadata.syncInProgress) {
      console.log('🔧 Resetting stuck sync state...');
      this.updateSyncMetadata({ syncInProgress: false });
    }
  }

  /**
   * Start periodic polling every 1 minute (testing)
   */
  private startPeriodicSync(): void {
    // AGGRESSIVE: Clear any existing timer first
    if (this.syncInterval) {
      console.log('🛑 Clearing existing sync timer before starting new one');
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    console.log(`🔄 Starting periodic sync every ${this.SYNC_INTERVAL_MS / 1000} seconds`);
    this.syncInterval = setInterval(() => {
      const now = new Date().toLocaleTimeString();
      console.log(`⏰ Periodic sync triggered at ${now} (timer ID: ${this.syncInterval})`);
      this.performSync();
    }, this.SYNC_INTERVAL_MS);
    
    console.log(`✅ Sync timer started with ID: ${this.syncInterval}`);
  }

  /**
   * Stop periodic sync
   */
  stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('🛑 Periodic sync stopped');
    }
    this.isInitialized = false; // Allow re-initialization
  }

  /**
   * Manual sync trigger (for immediate sync when needed)
   */
  async manualSync(): Promise<void> {
    console.log('🔧 Manual sync triggered');
    await this.performSync();
  }

  /**
   * Manual sync with detailed diagnostics (for debugging)
   */
  async manualSyncWithDiagnostics(): Promise<void> {
    console.log('🔧 Manual sync with diagnostics triggered');
    await this.diagnoseSync();
    await this.performSync();
  }

  /**
   * Core sync logic - simplified approach with aggressive first-time sync handling
   */
  private async performSync(): Promise<void> {
    const metadata = this.getSyncMetadata();
    
    if (metadata.syncInProgress) {
      console.log('⏸️ Sync already in progress, skipping...');
      return;
    }

    try {
      this.updateSyncMetadata({ syncInProgress: true });
      console.log('🚀 Starting sync...');

      // Get current data
      const localItems = this.getLocalItems();
      const remoteItems = await supabaseService.getItems();
      
      // Check if this is the first sync OR if there's a major ID mismatch (force reset)
      const isFirstSync = !metadata.lastSyncTime;
      
      // Only consider it an ID mismatch if MOST items don't match (not just a few new ones)
      // Use content-based matching instead of ID matching since local=timestamp, remote=UUID
      const remoteItemKeys = new Set(remoteItems.map(item => `${item.title}|${item.type}|${item.categoryId}`));
      const matchingItems = localItems.filter(local => {
        const localKey = `${local.title}|${local.type}|${local.categoryId}`;
        return remoteItemKeys.has(localKey);
      }).length;
      const matchPercentage = localItems.length > 0 ? matchingItems / localItems.length : 0;
      const hasContentMismatch = localItems.length > 0 && remoteItems.length > 0 && matchPercentage < 0.5;
      
      console.log(`🔍 Content Match Analysis: ${matchingItems}/${localItems.length} items match (${Math.round(matchPercentage * 100)}%)`);
      
      if (isFirstSync || hasContentMismatch) {
        // Check if there are very recent items that would be lost
        const now = new Date();
        const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
        const veryRecentItems = localItems.filter(item => new Date(item.createdAt) > oneMinuteAgo);
        
        if (veryRecentItems.length > 0 && !isFirstSync) {
          console.log(`⚠️ Skipping ID mismatch reset - would lose ${veryRecentItems.length} very recent items:`);
          veryRecentItems.forEach(item => {
            console.log(`  - "${item.title}" (${item.type}) - Created: ${item.createdAt}`);
          });
          console.log('🔄 Proceeding with regular sync instead...');
          
          // Continue with regular sync logic below
        } else {
          if (isFirstSync) {
            console.log('🆕 First sync detected - initializing localStorage with Supabase data...');
          } else {
            console.log('🔧 ID mismatch detected - resetting localStorage to match Supabase...');
          }
          
          // Get Supabase data (source of truth)
          const remoteCategories = await supabaseService.getCategories();
          console.log(`☁️ Supabase data: ${remoteItems.length} items, ${remoteCategories.length} categories`);
          
          // Replace localStorage with Supabase data (ensures ID matching)
          this.saveLocalItems(remoteItems);
          this.saveLocalCategories(remoteCategories);
          console.log('✅ localStorage reset with Supabase IDs - sync will work properly now');
          
          this.updateSyncMetadata({
            lastSyncTime: new Date().toISOString(),
            syncInProgress: false
          });

          // Dispatch custom event to notify App component
          window.dispatchEvent(new CustomEvent('hybridSyncComplete'));
          console.log('✅ Sync completed successfully');
          return; // Exit early after reset
        }
      }
      
      // Regular sync logic
      console.log('🔄 Regular sync - checking for new local items...');
      
      const localCategories = this.getLocalCategories();
      const remoteCategories = await supabaseService.getCategories();
      console.log(`📱 Local data: ${localItems.length} items, ${localCategories.length} categories`);
      console.log(`☁️ Remote data: ${remoteItems.length} items, ${remoteCategories.length} categories`);
      
      // Debug: Check for recent items in localStorage
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const recentLocalItems = localItems.filter(item => new Date(item.createdAt) > fiveMinutesAgo);
      if (recentLocalItems.length > 0) {
        console.log(`🕐 Found ${recentLocalItems.length} recent local items (last 5 minutes):`);
        recentLocalItems.forEach(item => {
          console.log(`  - "${item.title}" (${item.type}) - ID: ${item.id} - Created: ${item.createdAt}`);
        });
      }

      // Find items that exist in localStorage but not in Supabase (by content, not ID)
      // Use title + type + categoryId as the unique identifier since IDs don't match (local=timestamp, remote=UUID)
      const remoteItemKeysForSync = new Set(remoteItems.map(item => `${item.title}|${item.type}|${item.categoryId}`));
      const newLocalItems = localItems.filter(item => {
        const itemKey = `${item.title}|${item.type}|${item.categoryId}`;
        return !remoteItemKeysForSync.has(itemKey);
      });
      
      console.log(`📊 Found ${newLocalItems.length} new local items to sync to Supabase`);
      
      // Debug: Show what new items were found
      if (newLocalItems.length > 0) {
        console.log('🔍 New local items to sync:');
        newLocalItems.forEach(item => {
          console.log(`  - ${item.title} (${item.type}) - ID: ${item.id} - Created: ${item.createdAt}`);
        });
      } else {
        console.log('✅ No new items to sync - all local items already exist in Supabase');
      }

      // Push only new local items to Supabase
      if (newLocalItems.length > 0) {
        await this.pushNewItemsToSupabase(newLocalItems, localCategories);
        console.log(`📤 Successfully pushed ${newLocalItems.length} new items to Supabase`);
      }

      // Only update localStorage with remote data if no new local items were pushed
      // AND if local/remote counts match (to prevent overwriting new local data)
      if (newLocalItems.length === 0 && localItems.length === remoteItems.length) {
        // Get fresh data from Supabase to catch any external changes
        const finalRemoteItems = await supabaseService.getItems();
        const finalRemoteCategories = await supabaseService.getCategories();
        
        this.saveLocalItems(finalRemoteItems);
        this.saveLocalCategories(finalRemoteCategories);
        console.log(`💾 LocalStorage updated: ${finalRemoteItems.length} items, ${finalRemoteCategories.length} categories`);
      } else if (newLocalItems.length === 0 && localItems.length !== remoteItems.length) {
        console.log(`⚠️ Count mismatch detected! Local: ${localItems.length}, Remote: ${remoteItems.length}`);
        console.log(`💾 LocalStorage preserved to prevent data loss - manual sync may be needed`);
      } else {
        console.log(`💾 LocalStorage preserved to maintain new items - sync will update on next cycle`);
      }

      this.updateSyncMetadata({
        lastSyncTime: new Date().toISOString(),
        syncInProgress: false
      });

      // Dispatch custom event to notify App component
      window.dispatchEvent(new CustomEvent('hybridSyncComplete'));
      console.log('✅ Sync completed successfully');
    } catch (error) {
      console.error('❌ Sync failed:', error);
      this.updateSyncMetadata({ syncInProgress: false });
    }
  }

  /**
   * Push only new items to Supabase (simplified version)
   */
  private async pushNewItemsToSupabase(newItems: Item[], localCategories: Category[]): Promise<void> {
    try {
      console.log(`📤 Pushing ${newItems.length} new items to Supabase...`);

      // Handle categories first
      const existingCategories = await supabaseService.getCategories();
      const existingCategoryNames = new Set(existingCategories.map(cat => cat.name));
      const newCategories = localCategories.filter(cat => !existingCategoryNames.has(cat.name));
      
      // Create new categories
      for (const category of newCategories) {
        try {
          await supabaseService.createCategory(category);
          console.log(`✅ Created category: ${category.name}`);
        } catch (error) {
          console.warn(`⚠️ Failed to create category ${category.name}:`, error);
        }
      }

      // Create new items
      let itemsCreated = 0;
      for (const item of newItems) {
        try {
          // Remove local-only fields
          const { id, createdAt, updatedAt, ...itemData } = item;
          
          // Fix date fields
          const sanitizedData = {
            ...itemData,
            completed: item.completed || false,
            dueDate: item.dueDate ? (item.dueDate instanceof Date ? item.dueDate : new Date(item.dueDate)) : undefined,
            dateTime: item.dateTime ? (item.dateTime instanceof Date ? item.dateTime : new Date(item.dateTime)) : undefined
          };

          await supabaseService.createItem(sanitizedData);
          itemsCreated++;
          console.log(`✅ Created item: ${item.title} (${item.type})`);
        } catch (error) {
          console.error(`❌ Failed to create item "${item.title}":`, error);
        }
      }

      console.log(`📊 Successfully created ${itemsCreated}/${newItems.length} new items`);
      
    } catch (error) {
      console.error('❌ Failed to push new items to Supabase:', error);
      throw error;
    }
  }

  /**
   * localStorage operations
   */
  private getLocalItems(): Item[] {
    console.log(`🔍 SYNC SERVICE: Reading from localStorage key: "${this.STORAGE_KEYS.ITEMS}"`);
    
    // Force fresh read by checking storage directly (no caching)
    const stored = localStorage.getItem(this.STORAGE_KEYS.ITEMS);
    console.log(`🔍 SYNC SERVICE: Raw localStorage data length: ${stored ? stored.length : 0} characters`);
    
    if (stored) {
      const items = JSON.parse(stored);
      console.log(`📊 SYNC SERVICE: Found ${items.length} items in "${this.STORAGE_KEYS.ITEMS}"`);
      
      // Check for very recent items (last 30 seconds)
      const now = new Date();
      const thirtySecondsAgo = new Date(now.getTime() - 30 * 1000);
      const veryRecentItems = items.filter((item: any) => new Date(item.createdAt) > thirtySecondsAgo);
      
      if (veryRecentItems.length > 0) {
        console.log(`🆕 SYNC SERVICE: Found ${veryRecentItems.length} very recent items (last 30 seconds):`);
        veryRecentItems.forEach((item: any) => {
          console.log(`  - "${item.title}" (${item.type}) - Created: ${item.createdAt}`);
        });
      }
      
      if (items.length > 0) {
        console.log(`📋 SYNC SERVICE: Sample items: ${items.slice(0, 3).map((item: any) => `"${item.title}" (${item.type})`).join(', ')}`);
      }
      return items;
    } else {
      console.log(`❌ SYNC SERVICE: No data found in "${this.STORAGE_KEYS.ITEMS}"`);
      return [];
    }
  }

  private saveLocalItems(items: Item[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEYS.ITEMS, JSON.stringify(items));
    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        console.warn('⚠️ localStorage quota exceeded, attempting cleanup...');
        this.cleanupLocalStorage();
        // Try again after cleanup
        try {
          localStorage.setItem(this.STORAGE_KEYS.ITEMS, JSON.stringify(items));
          console.log('✅ Successfully saved items after cleanup');
        } catch (retryError) {
          console.error('❌ Failed to save items even after cleanup:', retryError);
          throw retryError;
        }
      } else {
        throw error;
      }
    }
  }

  private getLocalCategories(): Category[] {
    const stored = localStorage.getItem(this.STORAGE_KEYS.CATEGORIES);
    return stored ? JSON.parse(stored) : [];
  }

  private saveLocalCategories(categories: Category[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        console.warn('⚠️ localStorage quota exceeded for categories, attempting cleanup...');
        this.cleanupLocalStorage();
        // Try again after cleanup
        try {
          localStorage.setItem(this.STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
          console.log('✅ Successfully saved categories after cleanup');
        } catch (retryError) {
          console.error('❌ Failed to save categories even after cleanup:', retryError);
          throw retryError;
        }
      } else {
        throw error;
      }
    }
  }

  private getSyncMetadata(): SyncMetadata {
    const stored = localStorage.getItem(this.STORAGE_KEYS.SYNC_METADATA);
    return stored ? JSON.parse(stored) : {
      lastSyncTime: '',
      syncInProgress: false,
      conflicts: []
    };
  }

  private updateSyncMetadata(updates: Partial<SyncMetadata>): void {
    const current = this.getSyncMetadata();
    const updated = { ...current, ...updates };
    localStorage.setItem(this.STORAGE_KEYS.SYNC_METADATA, JSON.stringify(updated));
  }

  /**
   * Get sync status for UI
   */
  getSyncStatus(): { lastSync: string | null; inProgress: boolean } {
    const metadata = this.getSyncMetadata();
    return {
      lastSync: metadata.lastSyncTime || null,
      inProgress: metadata.syncInProgress
    };
  }

  /**
   * Comprehensive sync diagnostics - call this to debug sync issues
   */
  async diagnoseSync(): Promise<void> {
    console.log('🔍 SYNC DIAGNOSTICS STARTING...');
    
    try {
      // Get local data
      const localItems = this.getLocalItems();
      const localCategories = this.getLocalCategories();
      
      // Get remote data  
      const remoteItems = await supabaseService.getItems();
      const remoteCategories = await supabaseService.getCategories();
      
      console.log('📊 DATA COMPARISON:');
      console.log(`Local: ${localItems.length} items, ${localCategories.length} categories`);
      console.log(`Remote: ${remoteItems.length} items, ${remoteCategories.length} categories`);
      
      // Check for items in local but not remote
      const localItemIds = new Set(localItems.map(i => i.id));
      const remoteItemIds = new Set(remoteItems.map(i => i.id));
      
      const onlyLocal = localItems.filter(item => !remoteItemIds.has(item.id));
      const onlyRemote = remoteItems.filter(item => !localItemIds.has(item.id));
      
      console.log('🔍 MISSING DATA:');
      console.log(`Items only in LOCAL: ${onlyLocal.length}`);
      if (onlyLocal.length > 0) {
        console.log('Local-only items:', onlyLocal.map(i => `${i.title} (${i.type})`));
      }
      
      console.log(`Items only in REMOTE: ${onlyRemote.length}`);
      if (onlyRemote.length > 0) {
        console.log('Remote-only items:', onlyRemote.slice(0, 5).map(i => `${i.title} (${i.type})`));
      }
      
      // Check data by type
      const localByType = this.groupByType(localItems);
      const remoteByType = this.groupByType(remoteItems);
      
      console.log('📋 BY TYPE:');
      const allTypes = new Set([...Object.keys(localByType), ...Object.keys(remoteByType)]);
      allTypes.forEach(type => {
        const localCount = localByType[type]?.length || 0;
        const remoteCount = remoteByType[type]?.length || 0;
        console.log(`${type}: Local=${localCount}, Remote=${remoteCount}`);
      });
      
      // Check recent items
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      const recentLocal = localItems.filter(item => new Date(item.createdAt) > oneHourAgo);
      const recentRemote = remoteItems.filter(item => new Date(item.createdAt) > oneHourAgo);
      
      console.log('⏰ RECENT ITEMS (last hour):');
      console.log(`Local: ${recentLocal.length}, Remote: ${recentRemote.length}`);
      
      if (recentLocal.length > 0) {
        console.log('Recent local items:');
        recentLocal.forEach(item => {
          console.log(`- ${item.title} (${item.type}) at ${item.createdAt}`);
        });
      }
      
      console.log('🔍 SYNC DIAGNOSTICS COMPLETE');
      
    } catch (error) {
      console.error('❌ Diagnostics failed:', error);
    }
  }
  
  private groupByType(items: any[]): Record<string, any[]> {
    return items.reduce((acc, item) => {
      const type = item.type;
      if (!acc[type]) acc[type] = [];
      acc[type].push(item);
      return acc;
    }, {} as Record<string, any[]>);
  }

  /**
   * Clean up localStorage by removing old or unnecessary data
   */
  private cleanupLocalStorage(): void {
    try {
      console.log('🧹 Starting localStorage cleanup...');
      
      // Remove old chat sessions (keep only recent 10)
      const chatKeys = Object.keys(localStorage).filter(key => key.startsWith('chatSession_'));
      if (chatKeys.length > 10) {
        const keysToRemove = chatKeys.slice(0, chatKeys.length - 10);
        keysToRemove.forEach(key => {
          localStorage.removeItem(key);
          console.log(`🗑️ Removed old chat session: ${key}`);
        });
      }
      
      // Remove old audio storage (keep only recent 20)
      const audioKeys = Object.keys(localStorage).filter(key => key.startsWith('audio_'));
      if (audioKeys.length > 20) {
        const keysToRemove = audioKeys.slice(0, audioKeys.length - 20);
        keysToRemove.forEach(key => {
          localStorage.removeItem(key);
          console.log(`🗑️ Removed old audio: ${key}`);
        });
      }
      
      // Remove old image storage (keep only recent 10)
      const imageKeys = Object.keys(localStorage).filter(key => key.startsWith('image_'));
      if (imageKeys.length > 10) {
        const keysToRemove = imageKeys.slice(0, imageKeys.length - 10);
        keysToRemove.forEach(key => {
          localStorage.removeItem(key);
          console.log(`🗑️ Removed old image: ${key}`);
        });
      }
      
      console.log('✅ localStorage cleanup completed');
    } catch (error) {
      console.error('❌ Error during localStorage cleanup:', error);
    }
  }
}

export const hybridSyncService = new HybridSyncService();

// Expose for debugging
if (typeof window !== 'undefined') {
  (window as any).hybridSyncService = hybridSyncService;
}