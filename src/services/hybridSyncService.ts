import { Item, Category } from '../types';
import { supabaseService } from './supabaseService';

interface SyncMetadata {
  lastSyncTime: string;
  syncInProgress: boolean;
  conflicts: any[];
}

class HybridSyncService {
  private syncInterval: NodeJS.Timeout | null = null;
  private readonly SYNC_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
  private readonly STORAGE_KEYS = {
    ITEMS: 'lifeOS_items',
    CATEGORIES: 'lifeOS_categories', 
    SYNC_METADATA: 'lifeOS_sync_metadata'
  };

  /**
   * Initialize the hybrid sync service
   * - Sets up periodic polling
   * - Loads initial data from localStorage
   */
  async initialize(): Promise<void> {
    console.log('🔄 Initializing Hybrid Sync Service...');
    
    // Start periodic sync
    this.startPeriodicSync();
    
    // Check if we need an initial sync
    const metadata = this.getSyncMetadata();
    if (!metadata.lastSyncTime) {
      console.log('📋 No previous sync found, performing initial sync...');
      await this.performSync();
    }
  }

  /**
   * Start periodic polling every 1-2 hours
   */
  private startPeriodicSync(): void {
    this.syncInterval = setInterval(() => {
      console.log('⏰ Periodic sync triggered');
      this.performSync();
    }, this.SYNC_INTERVAL_MS);
  }

  /**
   * Stop periodic sync
   */
  stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Manual sync trigger (for immediate sync when needed)
   */
  async manualSync(): Promise<void> {
    console.log('🔧 Manual sync triggered');
    await this.performSync();
  }

  /**
   * Core sync logic
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

      // Get local data
      const localItems = this.getLocalItems();
      const localCategories = this.getLocalCategories();

      // Get remote data
      const remoteItems = await supabaseService.getItems();
      const remoteCategories = await supabaseService.getCategories();

      // Merge data with conflict resolution
      const mergedItems = this.mergeItems(localItems, remoteItems);
      const mergedCategories = this.mergeCategories(localCategories, remoteCategories);

      // Update both local and remote
      this.saveLocalItems(mergedItems);
      this.saveLocalCategories(mergedCategories);
      
      await this.pushToSupabase(mergedItems, mergedCategories);

      this.updateSyncMetadata({
        lastSyncTime: new Date().toISOString(),
        syncInProgress: false
      });

      console.log('✅ Sync completed successfully');
    } catch (error) {
      console.error('❌ Sync failed:', error);
      this.updateSyncMetadata({ syncInProgress: false });
    }
  }

  /**
   * Merge items with conflict resolution (last-write-wins)
   */
  private mergeItems(localItems: Item[], remoteItems: Item[]): Item[] {
    const merged = new Map<string, Item>();
    
    // Add all remote items first
    remoteItems.forEach(item => merged.set(item.id, item));
    
    // Overlay local items (prioritize local changes)
    localItems.forEach(localItem => {
      const remoteItem = merged.get(localItem.id);
      
      if (!remoteItem) {
        // New local item
        merged.set(localItem.id, localItem);
      } else {
        // Conflict resolution: use most recent updatedAt
        const localTime = new Date(localItem.updatedAt).getTime();
        const remoteTime = new Date(remoteItem.updatedAt).getTime();
        
        merged.set(localItem.id, localTime >= remoteTime ? localItem : remoteItem);
      }
    });
    
    return Array.from(merged.values());
  }

  /**
   * Merge categories with conflict resolution
   */
  private mergeCategories(localCategories: Category[], remoteCategories: Category[]): Category[] {
    const merged = new Map<string, Category>();
    
    // Add all remote categories first
    remoteCategories.forEach(category => merged.set(category.id, category));
    
    // Overlay local categories
    localCategories.forEach(localCategory => {
      const remoteCategory = merged.get(localCategory.id);
      
      if (!remoteCategory) {
        merged.set(localCategory.id, localCategory);
      } else {
        const localTime = new Date(localCategory.updatedAt).getTime();
        const remoteTime = new Date(remoteCategory.updatedAt).getTime();
        
        merged.set(localCategory.id, localTime >= remoteTime ? localCategory : remoteCategory);
      }
    });
    
    return Array.from(merged.values());
  }

  /**
   * Push merged data to Supabase (simplified for initial implementation)
   */
  private async pushToSupabase(items: Item[], categories: Category[]): Promise<void> {
    try {
      // For now, we'll use the existing migration approach
      // This handles conflicts by trying create and ignoring if already exists
      
      // Try to create categories (will skip if they exist)
      for (const category of categories) {
        try {
          await supabaseService.createCategory(category);
        } catch (error) {
          // Category likely already exists, skip
          console.log(`Category ${category.name} already exists, skipping`);
        }
      }
      
      // Try to create/update items
      for (const item of items) {
        try {
          // Try update first
          await supabaseService.updateItem(item.id, item);
        } catch (error) {
          // If update fails, try create
          try {
            const { id, createdAt, updatedAt, ...itemData } = item;
            await supabaseService.createItem(itemData);
          } catch (createError) {
            console.warn(`Failed to sync item ${item.id}:`, createError);
          }
        }
      }
    } catch (error) {
      console.error('❌ Failed to push to Supabase:', error);
      throw error;
    }
  }

  /**
   * localStorage operations
   */
  private getLocalItems(): Item[] {
    const stored = localStorage.getItem(this.STORAGE_KEYS.ITEMS);
    return stored ? JSON.parse(stored) : [];
  }

  private saveLocalItems(items: Item[]): void {
    localStorage.setItem(this.STORAGE_KEYS.ITEMS, JSON.stringify(items));
  }

  private getLocalCategories(): Category[] {
    const stored = localStorage.getItem(this.STORAGE_KEYS.CATEGORIES);
    return stored ? JSON.parse(stored) : [];
  }

  private saveLocalCategories(categories: Category[]): void {
    localStorage.setItem(this.STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
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
}

export const hybridSyncService = new HybridSyncService();