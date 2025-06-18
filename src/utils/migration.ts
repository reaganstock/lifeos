import { Item, Category } from '../types'
import { SupabaseDataActions } from '../hooks/useSupabaseData'

export interface MigrationResult {
  success: boolean
  categoriesMigrated: number
  itemsMigrated: number
  errors: string[]
}

export interface MigrationProgress {
  phase: 'checking' | 'categories' | 'items' | 'cleanup' | 'complete' | 'error'
  progress: number
  message: string
}

export interface LocalStorageData {
  categories: Category[]
  items: Item[]
  hasData: boolean
}

export class MigrationManager {
  private onProgress?: (progress: MigrationProgress) => void

  constructor(onProgress?: (progress: MigrationProgress) => void) {
    this.onProgress = onProgress
  }

  private reportProgress(phase: MigrationProgress['phase'], progress: number, message: string) {
    if (this.onProgress) {
      this.onProgress({ phase, progress, message })
    }
  }

  public detectLocalStorageData(): LocalStorageData {
    try {
      // Check multiple possible localStorage keys for items
      const possibleItemKeys = [
        'lifeStructureItems',
        'lifeOS-items', 
        'georgetownAI_items',
        'items'
      ];
      
      const possibleCategoryKeys = [
        'lifeStructureCategories',
        'lifeOS-categories',
        'categories'
      ];

      let items: Item[] = [];
      let categories: Category[] = [];

      // Try to find items from any possible key
      for (const key of possibleItemKeys) {
        const data = localStorage.getItem(key);
        if (data) {
          try {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed) && parsed.length > 0) {
              items = parsed;
              console.log(`📊 Migration: Found ${items.length} items in localStorage key: ${key}`);
              break; // Use the first valid items array found
            }
          } catch (error) {
            console.warn(`Error parsing localStorage key ${key}:`, error);
          }
        }
      }

      // Try to find categories from any possible key
      for (const key of possibleCategoryKeys) {
        const data = localStorage.getItem(key);
        if (data) {
          try {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed) && parsed.length > 0) {
              categories = parsed;
              console.log(`📊 Migration: Found ${categories.length} categories in localStorage key: ${key}`);
              break; // Use the first valid categories array found
            }
          } catch (error) {
            console.warn(`Error parsing localStorage key ${key}:`, error);
          }
        }
      }

      // Convert date strings back to Date objects
      const processedItems = items.map(item => ({
        ...item,
        createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
        updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
        dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
        dateTime: item.dateTime ? new Date(item.dateTime) : undefined,
        metadata: item.metadata ? {
          ...item.metadata,
          startTime: item.metadata.startTime ? new Date(item.metadata.startTime) : undefined,
          endTime: item.metadata.endTime ? new Date(item.metadata.endTime) : undefined,
        } : undefined,
      }));

      return {
        categories,
        items: processedItems,
        hasData: categories.length > 0 || processedItems.length > 0,
      }
    } catch (error) {
      console.error('Error detecting localStorage data:', error)
      return {
        categories: [],
        items: [],
        hasData: false,
      }
    }
  }

  public async migrateToSupabase(
    localData: LocalStorageData,
    supabaseActions: SupabaseDataActions
  ): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: false,
      categoriesMigrated: 0,
      itemsMigrated: 0,
      errors: [],
    }

    try {
      this.reportProgress('checking', 0, 'Preparing migration...')

      if (!localData.hasData) {
        this.reportProgress('complete', 100, 'No data to migrate')
        result.success = true
        return result
      }

      // Step 1: Migrate categories
      this.reportProgress('categories', 20, `Migrating ${localData.categories.length} categories...`)
      
      const categoryMapping: Record<string, string> = {}
      
      for (let i = 0; i < localData.categories.length; i++) {
        const category = localData.categories[i]
        try {
          const newCategory = await supabaseActions.createCategory({
            name: category.name,
            icon: category.icon,
            color: category.color,
            priority: category.priority,
            createdAt: category.createdAt || new Date(),
            updatedAt: category.updatedAt || new Date(),
          })

          if (newCategory) {
            categoryMapping[category.id] = newCategory.id
            result.categoriesMigrated++
          } else {
            result.errors.push(`Failed to migrate category: ${category.name}`)
          }
        } catch (error) {
          result.errors.push(`Error migrating category ${category.name}: ${error}`)
        }

        const progress = 20 + Math.floor((i + 1) / localData.categories.length * 30)
        this.reportProgress('categories', progress, `Migrated ${i + 1}/${localData.categories.length} categories`)
      }

      // Step 2: Migrate items
      this.reportProgress('items', 50, `Migrating ${localData.items.length} items...`)

      const itemsToMigrate = localData.items.map(item => ({
        ...item,
        categoryId: categoryMapping[item.categoryId] || item.categoryId,
      }))

      // Migrate in batches of 50 for better performance
      const batchSize = 50
      const batches = []
      for (let i = 0; i < itemsToMigrate.length; i += batchSize) {
        batches.push(itemsToMigrate.slice(i, i + batchSize))
      }

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i]
        try {
          const migratedItems = await supabaseActions.bulkCreateItems(batch)
          result.itemsMigrated += migratedItems.length

          if (migratedItems.length !== batch.length) {
            result.errors.push(`Batch ${i + 1}: Expected ${batch.length} items, migrated ${migratedItems.length}`)
          }
        } catch (error) {
          result.errors.push(`Error migrating batch ${i + 1}: ${error}`)
        }

        const progress = 50 + Math.floor((i + 1) / batches.length * 40)
        this.reportProgress('items', progress, `Migrated ${Math.min((i + 1) * batchSize, itemsToMigrate.length)}/${itemsToMigrate.length} items`)
      }

      // Step 3: Cleanup (only if migration was successful)
      if (result.errors.length === 0) {
        this.reportProgress('cleanup', 90, 'Migration successful! Cleaning up...')
        await this.createBackupAndCleanup(localData)
        result.success = true
      } else {
        this.reportProgress('error', 90, `Migration completed with ${result.errors.length} errors`)
      }

      this.reportProgress('complete', 100, 'Migration complete!')

    } catch (error) {
      result.errors.push(`Migration failed: ${error}`)
      this.reportProgress('error', 0, 'Migration failed!')
    }

    return result
  }

  private async createBackupAndCleanup(localData: LocalStorageData): Promise<void> {
    try {
      // Create a backup of the original data
      const backup = {
        timestamp: new Date().toISOString(),
        data: localData,
        allLocalStorageKeys: Object.keys(localStorage)
      }
      localStorage.setItem('lifeOS-migration-backup', JSON.stringify(backup))

      // Clear all possible localStorage keys that could contain items or app data
      const keysToRemove = [
        // Items data keys
        'lifeStructureItems',
        'lifeOS-items',
        'georgetownAI_items',
        'items',
        
        // Categories data keys  
        'lifeStructureCategories',
        'lifeOS-categories',
        'categories',
        
        // Other app data that should be synced from Supabase
        'lifeStructure_backup',
        'georgetownAI_voiceModel',
        'georgetownAI_openaiVoice',
        'georgetownAI_geminiVoice',
        
        // UI state that should be reset
        'sidebarWidth',
        'sidebarCollapsed',
        'aiSidebarWidth',
        'sidebarAutoHide',
        'lifeStructureLogo',
        'lifeStructureTitle',
        'lifeStructureSubtitle'
      ];

      keysToRemove.forEach(key => {
        if (localStorage.getItem(key)) {
          console.log(`🧹 Migration cleanup: Removing localStorage key: ${key}`);
          localStorage.removeItem(key);
        }
      });

      // Set flags to indicate migration is complete and skip landing
      localStorage.setItem('lifeOS-migrated', 'true')
      localStorage.setItem('skipLanding', 'true')

      console.log('✅ Migration cleanup completed successfully');

    } catch (error) {
      console.error('Error during cleanup:', error)
      throw new Error('Failed to cleanup localStorage after migration')
    }
  }

  public isAlreadyMigrated(): boolean {
    return localStorage.getItem('lifeOS-migrated') === 'true'
  }

  public getBackupData(): LocalStorageData | null {
    try {
      const backupStr = localStorage.getItem('lifeOS-migration-backup')
      if (!backupStr) return null

      const backup = JSON.parse(backupStr)
      return backup.data
    } catch (error) {
      console.error('Error reading backup data:', error)
      return null
    }
  }

  public restoreFromBackup(): boolean {
    try {
      const backupData = this.getBackupData()
      if (!backupData) return false

      localStorage.setItem('lifeOS-items', JSON.stringify(backupData.items))
      localStorage.setItem('lifeOS-categories', JSON.stringify(backupData.categories))
      localStorage.removeItem('lifeOS-migrated')
      localStorage.removeItem('lifeOS-migration-backup')

      return true
    } catch (error) {
      console.error('Error restoring from backup:', error)
      return false
    }
  }

  public clearMigrationFlags(): void {
    localStorage.removeItem('lifeOS-migrated')
    localStorage.removeItem('lifeOS-migration-backup')
  }
}

// Utility functions for components
export function shouldShowMigration(): boolean {
  const migrationManager = new MigrationManager()
  
  if (migrationManager.isAlreadyMigrated()) {
    return false
  }

  const localData = migrationManager.detectLocalStorageData()
  return localData.hasData
}

export function createMigrationManager(onProgress?: (progress: MigrationProgress) => void): MigrationManager {
  return new MigrationManager(onProgress)
}