import { supabase } from '../lib/supabase'
import { Item, Category } from '../types'
import type { 
  Profile, 
  Category as DbCategory, 
  Item as DbItem,
  CategoryInsert,
  ItemInsert 
} from '../lib/database.types'

export class SupabaseService {
  // Expose supabase client for direct access when needed
  getSupabase() {
    return supabase;
  }

  // Direct access to supabase client
  get supabase() {
    return supabase;
  }

  // ========== AUTHENTICATION ==========
  
  async signUp(email: string, password: string, fullName?: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName || '',
        },
      },
    })
    
    if (error) throw error
    return data
  }

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    
    if (error) throw error
    return data
  }

  async signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  async getCurrentSession() {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) throw error
    return session
  }

  async getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) throw error
    return user
  }

  // ========== PROFILE MANAGEMENT ==========
  
  async createOrUpdateProfile(userId: string, profileData: Partial<Profile>) {
    const { data, error } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        email: profileData.email || '',
        full_name: profileData.full_name,
        avatar_url: profileData.avatar_url,
        updated_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  async getProfile(userId?: string) {
    const user = userId || (await this.getCurrentUser())?.id
    if (!user) throw new Error('No user found')

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user)
      .single()
    
    if (error) throw error
    return data
  }

  // ========== EDGE FUNCTION CALLS ==========
  
  private async callEdgeFunction(action: string, data: any = {}) {
    const session = await this.getCurrentSession()
    if (!session) throw new Error('User not authenticated')

    const { data: result, error } = await supabase.functions.invoke('lifeOS-ai-core', {
      body: { action, data },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    })

    if (error) throw error
    if (result?.error) throw new Error(result.error)
    
    return result
  }

  // ========== ITEMS MANAGEMENT ==========
  
  async createItem(itemData: Omit<Item, 'id' | 'createdAt' | 'updatedAt'>): Promise<Item> {
    try {
      const result = await this.callEdgeFunction('createItem', {
        type: itemData.type,
        title: itemData.title,
        text: itemData.text,
        categoryId: itemData.categoryId,
        dueDate: itemData.dueDate?.toISOString(),
        dateTime: itemData.dateTime?.toISOString(),
        metadata: itemData.metadata,
        attachment: itemData.attachment
      })
      
      return this.convertItemFromDb(result.item)
    } catch (error) {
      console.warn('⚠️ Edge Function failed, using direct Supabase for createItem:', error);
      return this.createItemDirect(itemData);
    }
  }

  // Direct Supabase fallback for creating items
  async createItemDirect(itemData: Omit<Item, 'id' | 'createdAt' | 'updatedAt'>): Promise<Item> {
    try {
      const dbItem: Omit<DbItem, 'id'> = {
        type: itemData.type,
        title: itemData.title,
        text: itemData.text || null,
        category_id: itemData.categoryId || null,
        completed: itemData.completed || false,
        due_date: itemData.dueDate ? itemData.dueDate.toISOString() : null,
        date_time: itemData.dateTime ? itemData.dateTime.toISOString() : null,
        attachment: itemData.attachment || null,
        metadata: JSON.parse(JSON.stringify(itemData.metadata || {})),
        // Audio-related fields for voice notes
        audio_duration: itemData.metadata?.audioDuration || null,
        audio_public_url: itemData.metadata?.audioPublicUrl || null,
        audio_storage_path: itemData.metadata?.audioStoragePath || null,
        user_id: null, // Will be set by RLS
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await this.supabase
        .from('items')
        .insert([dbItem])
        .select()
        .single();

      if (error) {
        console.error('❌ Direct Supabase createItem error:', error);
        throw error;
      }

      return this.convertItemFromDb(data);
    } catch (error) {
      console.error('❌ Direct Supabase createItem failed:', error);
      throw error;
    }
  }

  async getItems(options?: {
    type?: string
    categoryId?: string
    completed?: boolean
    limit?: number
    offset?: number
  }): Promise<Item[]> {
    try {
      const result = await this.callEdgeFunction('getItems', options)
      return result.items.map((item: DbItem) => this.convertItemFromDb(item))
    } catch (error) {
      console.warn('⚠️ Edge Function failed, using direct Supabase for getItems:', error);
      return this.getItemsDirect(options);
    }
  }

  // Direct Supabase fallback for when Edge Functions fail
  async getItemsDirect(options?: {
    type?: string
    categoryId?: string
    completed?: boolean
    limit?: number
    offset?: number
  }): Promise<Item[]> {
    try {
      let query = this.supabase
        .from('items')
        .select('*')
        .order('created_at', { ascending: false });

      if (options?.type) {
        query = query.eq('type', options.type);
      }
      if (options?.categoryId) {
        query = query.eq('category_id', options.categoryId);
      }
      if (options?.completed !== undefined) {
        query = query.eq('completed', options.completed);
      }
      if (options?.limit) {
        query = query.limit(options.limit);
      }
      if (options?.offset) {
        query = query.range(options.offset, (options.offset + (options.limit || 100)) - 1);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Direct Supabase getItems error:', error);
        throw error;
      }

      return (data || []).map((item: DbItem) => this.convertItemFromDb(item));
    } catch (error) {
      console.error('❌ Direct Supabase getItems failed:', error);
      throw error;
    }
  }

  async updateItem(itemId: string, updates: Partial<Item>): Promise<Item> {
    const result = await this.callEdgeFunction('updateItem', {
      itemId,
      updates: {
        ...updates,
        dueDate: updates.dueDate?.toISOString(),
        dateTime: updates.dateTime?.toISOString()
      }
    })
    
    return this.convertItemFromDb(result.item)
  }

  async deleteItem(itemId: string): Promise<boolean> {
    await this.callEdgeFunction('deleteItem', { itemId })
    return true
  }

  async searchItems(query: string, options?: {
    type?: string
    categoryId?: string
    limit?: number
  }): Promise<Item[]> {
    const result = await this.callEdgeFunction('searchItems', {
      query,
      searchType: options?.type,
      searchCategory: options?.categoryId
    })
    
    return result.items.map((item: DbItem) => this.convertItemFromDb(item))
  }

  async bulkCreateItems(items: Omit<Item, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<Item[]> {
    const result = await this.callEdgeFunction('bulkCreateItems', {
      items: items.map(item => ({
        type: item.type,
        title: item.title,
        text: item.text,
        categoryId: item.categoryId,
        dueDate: item.dueDate?.toISOString(),
        dateTime: item.dateTime?.toISOString(),
        metadata: item.metadata,
        attachment: item.attachment,
        completed: item.completed
      }))
    })
    
    return result.items.map((item: DbItem) => this.convertItemFromDb(item))
  }

  // ========== CATEGORIES MANAGEMENT ==========
  
  async getCategories(): Promise<Category[]> {
    const result = await this.callEdgeFunction('getCategories')
    return result.categories.map((cat: DbCategory) => this.convertCategoryFromDb(cat))
  }

  async createCategory(categoryData: Omit<Category, 'createdAt' | 'updatedAt'>): Promise<Category> {
    const result = await this.callEdgeFunction('createCategory', {
      id: categoryData.id,
      name: categoryData.name,
      icon: categoryData.icon,
      color: categoryData.color,
      priority: categoryData.priority
    })
    
    return this.convertCategoryFromDb(result.category)
  }

  // ========== REAL-TIME SUBSCRIPTIONS ==========
  
  subscribeToUserItems(callback: (payload: any) => void) {
    return supabase
      .channel('user-items')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'items',
          filter: `user_id=eq.${supabase.auth.getUser().then(({ data }) => data.user?.id)}`,
        },
        callback
      )
      .subscribe()
  }

  subscribeToUserCategories(callback: (payload: any) => void) {
    return supabase
      .channel('user-categories')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'categories',
          filter: `user_id=eq.${supabase.auth.getUser().then(({ data }) => data.user?.id)}`,
        },
        callback
      )
      .subscribe()
  }

  // ========== TYPE CONVERTERS ==========
  
  private convertItemFromDb(dbItem: DbItem): Item {
    return {
      id: dbItem.id,
      type: dbItem.type as Item['type'],
      title: dbItem.title,
      text: dbItem.text || '',
      categoryId: dbItem.category_id || '',
      completed: dbItem.completed || false,
      createdAt: new Date(dbItem.created_at || ''),
      updatedAt: new Date(dbItem.updated_at || ''),
      dueDate: dbItem.due_date ? new Date(dbItem.due_date) : undefined,
      dateTime: dbItem.date_time ? new Date(dbItem.date_time) : undefined,
      attachment: dbItem.attachment || undefined,
      metadata: typeof dbItem.metadata === 'string' 
        ? JSON.parse(dbItem.metadata) 
        : (dbItem.metadata || {})
    }
  }

  private convertCategoryFromDb(dbCategory: DbCategory): Category {
    return {
      id: dbCategory.id,
      name: dbCategory.name,
      icon: dbCategory.icon || '',
      color: dbCategory.color || '',
      priority: dbCategory.priority || 0,
      createdAt: new Date(dbCategory.created_at || ''),
      updatedAt: new Date(dbCategory.updated_at || '')
    }
  }

  // ========== AUDIO UPLOAD UTILITIES ==========
  
  /**
   * Upload audio blob to Supabase Storage and return permanent URL
   */
  async uploadAudioFile(audioBlob: Blob, fileName: string, userId?: string): Promise<{
    storagePath: string;
    publicUrl: string;
  }> {
    try {
      const user = userId || (await this.getCurrentUser())?.id
      if (!user) throw new Error('No user found for audio upload')

      // Generate unique filename with timestamp
      const timestamp = Date.now()
      const fileExtension = this.getAudioFileExtension(audioBlob.type)
      const uniqueFileName = `${user}/${timestamp}_${fileName}.${fileExtension}`
      
      console.log('🎵 Uploading audio file:', uniqueFileName, 'Size:', audioBlob.size, 'bytes')

      // Upload to voice-recordings bucket
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('voice-recordings')
        .upload(uniqueFileName, audioBlob, {
          contentType: audioBlob.type,
          cacheControl: '3600',
          upsert: false // Don't overwrite if exists
        })

      if (uploadError) {
        console.error('❌ Audio upload failed:', uploadError)
        throw new Error(`Audio upload failed: ${uploadError.message}`)
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('voice-recordings')
        .getPublicUrl(uniqueFileName)

      if (!urlData?.publicUrl) {
        throw new Error('Failed to get public URL for uploaded audio')
      }

      console.log('✅ Audio uploaded successfully:', urlData.publicUrl)

      return {
        storagePath: uniqueFileName,
        publicUrl: urlData.publicUrl
      }
    } catch (error) {
      console.error('❌ Audio upload error:', error)
      throw error
    }
  }

  /**
   * Delete audio file from storage
   */
  async deleteAudioFile(storagePath: string): Promise<boolean> {
    try {
      const { error } = await supabase.storage
        .from('voice-recordings')
        .remove([storagePath])

      if (error) {
        console.error('❌ Audio deletion failed:', error)
        throw new Error(`Audio deletion failed: ${error.message}`)
      }

      console.log('✅ Audio file deleted:', storagePath)
      return true
    } catch (error) {
      console.error('❌ Audio deletion error:', error)
      throw error
    }
  }

  /**
   * Validate if audio URL is accessible
   */
  async validateAudioUrl(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { method: 'HEAD' })
      return response.ok
    } catch (error) {
      console.warn('⚠️ Audio URL validation failed:', url, error)
      return false
    }
  }

  /**
   * Get file extension from MIME type
   */
  private getAudioFileExtension(mimeType: string): string {
    const mimeToExt: { [key: string]: string } = {
      'audio/wav': 'wav',
      'audio/mp3': 'mp3',
      'audio/mpeg': 'mp3',
      'audio/mp4': 'mp4',
      'audio/webm': 'webm',
      'audio/ogg': 'ogg'
    }
    
    return mimeToExt[mimeType] || 'wav'
  }

  /**
   * Create or update voice note with audio upload
   */
  async createVoiceNoteWithAudio(noteData: {
    title: string;
    transcription: string;
    audioBlob: Blob;
    duration: number;
    categoryId?: string;
    confidence?: number;
    language?: string;
  }): Promise<Item> {
    try {
      console.log('🎵 Creating voice note with audio upload...')

      // Upload audio file first
      const { storagePath, publicUrl } = await this.uploadAudioFile(
        noteData.audioBlob,
        noteData.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()
      )

      // Create the voice note item with audio references
      const voiceNoteItem = await this.createItem({
        type: 'voiceNote',
        title: noteData.title,
        text: noteData.transcription,
        categoryId: noteData.categoryId || '',
        attachment: publicUrl, // Store URL in attachment field for backward compatibility
        metadata: {
          audioStoragePath: storagePath,
          audioPublicUrl: publicUrl,
          audioDuration: noteData.duration,
          confidence: noteData.confidence,
          language: noteData.language,
          isVoiceNote: true
        }
      })

      console.log('✅ Voice note created successfully:', voiceNoteItem.id)
      return voiceNoteItem
    } catch (error) {
      console.error('❌ Voice note creation failed:', error)
      throw error
    }
  }

  // ========== MIGRATION UTILITIES ==========
  
  async migrateFromLocalStorage() {
    try {
      // Get existing data from localStorage
      const itemsData = localStorage.getItem('lifeStructureItems')
      const categoriesData = localStorage.getItem('lifeStructureCategories')
      
      const items: Item[] = itemsData ? JSON.parse(itemsData) : []
      const categories: Category[] = categoriesData ? JSON.parse(categoriesData) : []

      console.log(`🔄 Starting migration: ${categories.length} categories, ${items.length} items`)

      // Migrate categories first
      for (const category of categories) {
        try {
          await this.createCategory(category)
          console.log(`✅ Migrated category: ${category.name}`)
        } catch (error) {
          console.warn(`⚠️ Category already exists: ${category.name}`)
        }
      }

      // Migrate items in batches
      const batchSize = 10
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize).map(item => {
          const { createdAt, updatedAt, ...itemData } = item
          return itemData
        })
        try {
          await this.bulkCreateItems(batch)
          console.log(`✅ Migrated items batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(items.length / batchSize)}`)
        } catch (error) {
          console.error('❌ Error migrating batch:', error)
          // Try individual items in this batch
          for (const item of items.slice(i, i + batchSize)) {
            try {
              const { createdAt, updatedAt, ...itemData } = item
              await this.createItem(itemData)
            } catch (itemError) {
              console.warn(`⚠️ Failed to migrate item: ${item.title}`)
            }
          }
        }
      }

      // Create backup
      const backupData = {
        items,
        categories,
        timestamp: new Date().toISOString(),
        version: '1.0'
      }
      localStorage.setItem('lifeStructure_backup', JSON.stringify(backupData))
      
      console.log('✅ Migration completed successfully')
      return true
    } catch (error) {
      console.error('❌ Migration failed:', error)
      throw error
    }
  }
}

// Export singleton instance
export const supabaseService = new SupabaseService() 