import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthContext } from '../components/AuthProvider'
import { Category, Item } from '../lib/database.types'
import { Item as LocalItem, Category as LocalCategory } from '../types'
import { categories as initialCategories } from '../data/initialData'

export interface SupabaseDataState {
  categories: LocalCategory[]
  items: LocalItem[]
  loading: boolean
  error: string | null
  initialized: boolean
}

export interface SupabaseDataActions {
  createCategory: (category: Omit<LocalCategory, 'id'>) => Promise<LocalCategory | null>
  updateCategory: (id: string, updates: Partial<LocalCategory>) => Promise<boolean>
  deleteCategory: (id: string) => Promise<boolean>
  createItem: (item: Omit<LocalItem, 'id'>) => Promise<LocalItem | null>
  updateItem: (id: string, updates: Partial<LocalItem>) => Promise<boolean>
  deleteItem: (id: string) => Promise<boolean>
  bulkCreateItems: (items: Omit<LocalItem, 'id'>[]) => Promise<LocalItem[]>
  bulkUpdateItems: (updates: { id: string; updates: Partial<LocalItem> }[]) => Promise<boolean>
  bulkDeleteItems: (ids: string[]) => Promise<boolean>
  refreshData: () => Promise<void>
}

// Helper functions to convert between database and local types
const dbCategoryToLocal = (dbCategory: Category): LocalCategory => ({
  id: dbCategory.id,
  name: dbCategory.name,
  icon: dbCategory.icon || '📁',
  color: dbCategory.color || '#3B82F6',
  priority: dbCategory.priority || 0,
  createdAt: new Date(dbCategory.created_at || ''),
  updatedAt: new Date(dbCategory.updated_at || ''),
})

const localCategoryToDb = (localCategory: Omit<LocalCategory, 'id'>, userId: string) => ({
  id: crypto.randomUUID(),
  name: localCategory.name,
  icon: localCategory.icon,
  color: localCategory.color,
  priority: localCategory.priority,
  user_id: userId,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
})

const dbItemToLocal = (dbItem: Item, reverseMapping?: Map<string, string>): LocalItem => ({
  id: dbItem.id,
  title: dbItem.title,
  text: dbItem.text || '',
  type: dbItem.type as LocalItem['type'],
  completed: dbItem.completed || false,
  categoryId: reverseMapping ? (reverseMapping.get(dbItem.category_id || '') || dbItem.category_id || '') : (dbItem.category_id || ''),
  createdAt: new Date(dbItem.created_at || ''),
  updatedAt: new Date(dbItem.updated_at || ''),
  dueDate: dbItem.due_date ? new Date(dbItem.due_date) : undefined,
  dateTime: dbItem.date_time ? new Date(dbItem.date_time) : undefined,
  attachment: dbItem.attachment || undefined,
  metadata: (dbItem.metadata as LocalItem['metadata']) || { priority: 'medium' },
})

const localItemToDb = (localItem: Omit<LocalItem, 'id'>, userId: string, categoryMapping?: Map<string, string>) => {
  // Map category ID to database UUID if mapping exists
  const mappedCategoryId = categoryMapping ? (categoryMapping.get(localItem.categoryId) || localItem.categoryId) : localItem.categoryId
  
  console.log('🗂️ Category mapping:', {
    originalId: localItem.categoryId,
    mappedId: mappedCategoryId,
    hasMapping: categoryMapping?.has(localItem.categoryId) || false
  })
  
  return {
    title: localItem.title,
    text: localItem.text || '',
    type: localItem.type,
    completed: localItem.completed || false,
    category_id: mappedCategoryId,
    due_date: localItem.dueDate?.toISOString() || null,
    date_time: localItem.dateTime?.toISOString() || null,
    attachment: localItem.attachment || null,
    metadata: localItem.metadata ? JSON.parse(JSON.stringify(localItem.metadata, (key, value) => {
      // Convert Date objects to ISO strings for JSON storage
      if (value instanceof Date) {
        return value.toISOString();
      }
      return value;
    })) : null,
    user_id: userId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

export function useSupabaseData(): SupabaseDataState & SupabaseDataActions {
  const { user, initialized: authInitialized } = useAuthContext()
  const [categories, setCategories] = useState<LocalCategory[]>([])
  const [items, setItems] = useState<LocalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)
  const [categoryMapping, setCategoryMapping] = useState<Map<string, string>>(new Map())
  const [reverseMapping, setReverseMapping] = useState<Map<string, string>>(new Map())

  const fetchCategories = useCallback(async () => {
    if (!user) return []

    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
        .order('priority', { ascending: true })

      if (error) throw error
      
      const localCategories = (data || []).map(dbCategoryToLocal)
      
      // Build FLEXIBLE category mapping - works for any user's categories, not just hardcoded ones
      const mapping = new Map<string, string>()
      const reverse = new Map<string, string>()
      
      // Create legacy mappings based on ACTUAL user categories (not hardcoded assumptions)
      data?.forEach(dbCategory => {
        // Create a legacy-style ID from the category name (for backwards compatibility)
        const legacyId = dbCategory.name.toLowerCase()
          .replace(/[^a-z0-9\s]/g, '') // Remove special characters
          .replace(/\s+/g, '-') // Replace spaces with hyphens
          .substring(0, 20) // Limit length
        
        mapping.set(legacyId, dbCategory.id)
        reverse.set(dbCategory.id, legacyId)
        
        // Also map by exact name (case insensitive)
        mapping.set(dbCategory.name.toLowerCase(), dbCategory.id)
        
        // Create common aliases for typical category types
        const categoryName = dbCategory.name.toLowerCase()
        if (categoryName.includes('regulation') || categoryName.includes('personal') || categoryName.includes('self')) {
          mapping.set('personal', dbCategory.id)
          mapping.set('self-regulation', dbCategory.id)
        }
        if (categoryName.includes('gym') || categoryName.includes('fitness') || categoryName.includes('workout') || categoryName.includes('exercise')) {
          mapping.set('fitness', dbCategory.id)
          mapping.set('gym', dbCategory.id)
          mapping.set('workout', dbCategory.id)
        }
        if (categoryName.includes('app') || categoryName.includes('business') || categoryName.includes('work') || categoryName.includes('career')) {
          mapping.set('work', dbCategory.id)
          mapping.set('business', dbCategory.id)
        }
        if (categoryName.includes('social') || categoryName.includes('dating') || categoryName.includes('relationship')) {
          mapping.set('social', dbCategory.id)
          mapping.set('dating', dbCategory.id)
        }
        if (categoryName.includes('content') || categoryName.includes('creation') || categoryName.includes('study') || categoryName.includes('learning')) {
          mapping.set('content', dbCategory.id)
          mapping.set('study', dbCategory.id)
        }
      })
      
      console.log('🗂️ Category mapping built:', Object.fromEntries(mapping))
      setCategoryMapping(mapping)
      setReverseMapping(reverse)
      return localCategories
    } catch (err) {
      console.error('Error fetching categories:', err)
      setError('Failed to fetch categories')
      return []
    }
  }, [user])

  const fetchItems = useCallback(async () => {
    if (!user) return []

    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data || []).map(item => dbItemToLocal(item, reverseMapping))
    } catch (err) {
      console.error('Error fetching items:', err)
      setError('Failed to fetch items')
      return []
    }
  }, [user, reverseMapping])

  const createInitialCategories = useCallback(async () => {
    if (!user) return []

    console.log('🆕 New user detected, creating initial categories')
    
    // First ensure the profile exists
    try {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single()

      if (!existingProfile) {
        console.log('📝 Creating user profile first...')
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert([
            {
              id: user.id,
              email: user.email!,
              full_name: user.user_metadata?.full_name || '',
              avatar_url: user.user_metadata?.avatar_url || null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ])

        if (profileError) {
          console.error('Error creating profile:', profileError)
          return []
        }
      }
    } catch (err) {
      console.error('Error checking/creating profile:', err)
      return []
    }

    const createdCategories = []
    for (const category of initialCategories) {
      try {
        const { data, error } = await supabase
          .from('categories')
          .insert([localCategoryToDb({
            name: category.name,
            icon: category.icon,
            color: category.color,
            priority: category.priority,
            createdAt: new Date(),
            updatedAt: new Date()
          }, user.id)])
          .select()
          .single()

        if (error) throw error
        createdCategories.push(dbCategoryToLocal(data))
      } catch (err) {
        console.error('Error creating initial category:', err)
      }
    }
    return createdCategories
  }, [user])

  const refreshData = useCallback(async () => {
    if (!user) {
      console.log('⚠️ SUPABASE DATA: No user found during refresh, keeping existing data to prevent accidental clearing')
      setLoading(false)
      setInitialized(true)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const [fetchedCategories, fetchedItems] = await Promise.all([
        fetchCategories(),
        fetchItems(),
      ])

      // Initialize default categories for new users
      if (fetchedCategories.length === 0) {
        const createdCategories = await createInitialCategories()
        setCategories(createdCategories)
      } else {
        setCategories(fetchedCategories)
      }
      
      setItems(fetchedItems)
    } catch (err) {
      console.error('Error refreshing data:', err)
      setError('Failed to refresh data')
    }

    setLoading(false)
    setInitialized(true)
  }, [user, fetchCategories, fetchItems, createInitialCategories])

  // Initial data fetch
  useEffect(() => {
    if (authInitialized && !initialized) {
      refreshData()
    }
  }, [authInitialized, initialized]) // Remove refreshData from dependencies

  // Real-time subscriptions
  useEffect(() => {
    if (!user || !initialized) {
      console.log('⏳ Skipping realtime setup - user:', !!user, 'initialized:', initialized)
      return
    }

    console.log('🔄 Setting up realtime subscriptions for user:', user.id)

    const categoriesSubscription = supabase
      .channel(`categories-changes-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'categories',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('📁 Categories change detected:', payload.eventType, payload.new)
          // Refresh categories data
          supabase
            .from('categories')
            .select('*')
            .eq('user_id', user.id)
            .order('priority', { ascending: true })
            .then(({ data, error }) => {
              if (error) {
                console.error('❌ Error refreshing categories:', error)
              } else if (data) {
                console.log('✅ Categories updated via realtime:', data.length, 'categories')
                setCategories(data.map(dbCategoryToLocal))
              }
            })
        }
      )
      .subscribe((status) => {
        console.log('📁 Categories subscription status:', status)
      })

    const itemsSubscription = supabase
      .channel(`items-changes-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'items',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('📝 Items change detected:', payload.eventType, payload.new)
          // Refresh items data
          supabase
            .from('items')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .then(({ data, error }) => {
              if (error) {
                console.error('❌ Error refreshing items:', error)
              } else if (data) {
                console.log('✅ Items updated via realtime:', data.length, 'items')
                setItems(data.map(item => dbItemToLocal(item, reverseMapping)))
              }
            })
        }
      )
      .subscribe((status) => {
        console.log('📝 Items subscription status:', status)
      })

    return () => {
      console.log('🔄 Unsubscribing from realtime channels')
      categoriesSubscription.unsubscribe()
      itemsSubscription.unsubscribe()
    }
  }, [user?.id, initialized, reverseMapping])

  // Category operations
  const createCategory = async (category: Omit<LocalCategory, 'id'>): Promise<LocalCategory | null> => {
    if (!user) return null

    try {
      const { data, error } = await supabase
        .from('categories')
        .insert([localCategoryToDb(category, user.id)])
        .select()
        .single()

      if (error) throw error
      return dbCategoryToLocal(data)
    } catch (err) {
      console.error('Error creating category:', err)
      setError('Failed to create category')
      return null
    }
  }

  const updateCategory = async (id: string, updates: Partial<LocalCategory>): Promise<boolean> => {
    if (!user) return false

    try {
      const { error } = await supabase
        .from('categories')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) throw error
      return true
    } catch (err) {
      console.error('Error updating category:', err)
      setError('Failed to update category')
      return false
    }
  }

  const deleteCategory = async (id: string): Promise<boolean> => {
    if (!user) return false

    try {
      // First, count how many items will be affected
      const { data: itemCount, error: countError } = await supabase
        .from('items')
        .select('id', { count: 'exact' })
        .eq('category_id', id)
        .eq('user_id', user.id)

      if (countError) throw countError

      const affectedItemsCount = itemCount?.length || 0
      const categoryName = categories.find(cat => cat.id === id)?.name || 'Unknown Category'

      // Show warning with item count
      let confirmMessage = `Are you sure you want to delete the category "${categoryName}"?`
      
      if (affectedItemsCount > 0) {
        confirmMessage += `\n\n⚠️ WARNING: This will also delete ${affectedItemsCount} item${affectedItemsCount === 1 ? '' : 's'} (notes, todos, events, goals, routines) assigned to this category.\n\nThis action cannot be undone.`
      } else {
        confirmMessage += '\n\nThis action cannot be undone.'
      }

      // Show confirmation dialog
      const confirmed = window.confirm(confirmMessage)
      if (!confirmed) {
        return false
      }

      // If confirmed, delete the category (items will be cascade deleted by database foreign key)
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) throw error
      return true
    } catch (err) {
      console.error('Error deleting category:', err)
      setError('Failed to delete category')
      return false
    }
  }

  // Item operations
  const createItem = async (item: Omit<LocalItem, 'id'>): Promise<LocalItem | null> => {
    if (!user) return null

    try {
      console.log('🆕 Creating item:', {
        title: item.title,
        type: item.type,
        categoryId: item.categoryId,
        hasMapping: categoryMapping.has(item.categoryId)
      })
      
      const dbItem = localItemToDb(item, user.id, categoryMapping)
      console.log('🗄️ Database item data:', dbItem)
      
      const { data, error } = await supabase
        .from('items')
        .insert([dbItem])
        .select()
        .single()

      if (error) {
        console.error('❌ Supabase item creation error:', error)
        throw error
      }
      
      console.log('✅ Item created successfully:', data)
      return dbItemToLocal(data, reverseMapping)
    } catch (err: any) {
      console.error('❌ Error creating item:', err)
      const errorMessage = err?.message || err?.details || 'Failed to create item'
      setError(`Failed to create item: ${errorMessage}`)
      return null
    }
  }

  const updateItem = async (id: string, updates: Partial<LocalItem>): Promise<boolean> => {
    if (!user) return false

    try {
      const dbUpdates: any = {
        updated_at: new Date().toISOString(),
      }

      if (updates.title !== undefined) dbUpdates.title = updates.title
      if (updates.text !== undefined) dbUpdates.text = updates.text
      if (updates.completed !== undefined) dbUpdates.completed = updates.completed
      if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate?.toISOString()
      if (updates.metadata !== undefined) dbUpdates.metadata = updates.metadata

      const { error } = await supabase
        .from('items')
        .update(dbUpdates)
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) throw error
      return true
    } catch (err) {
      console.error('Error updating item:', err)
      setError('Failed to update item')
      return false
    }
  }

  const deleteItem = async (id: string): Promise<boolean> => {
    if (!user) return false

    try {
      const { error } = await supabase
        .from('items')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) throw error
      return true
    } catch (err) {
      console.error('Error deleting item:', err)
      setError('Failed to delete item')
      return false
    }
  }

  const bulkCreateItems = async (items: Omit<LocalItem, 'id'>[]): Promise<LocalItem[]> => {
    if (!user) return []

    try {
      console.log('📦 Bulk creating', items.length, 'items')
      const dbItems = items.map(item => localItemToDb(item, user.id, categoryMapping))
      
      console.log('🗄️ Database items data:', dbItems)
      
      const { data, error } = await supabase
        .from('items')
        .insert(dbItems)
        .select()

      if (error) {
        console.error('❌ Supabase bulk creation error:', error)
        throw error
      }
      
      console.log('✅ Bulk created', data?.length || 0, 'items successfully')
      return (data || []).map(item => dbItemToLocal(item, reverseMapping))
    } catch (err: any) {
      console.error('❌ Error bulk creating items:', err)
      const errorMessage = err?.message || err?.details || 'Failed to create items'
      setError(`Failed to create items: ${errorMessage}`)
      return []
    }
  }

  const bulkUpdateItems = async (updates: { id: string; updates: Partial<LocalItem> }[]): Promise<boolean> => {
    if (!user) return false

    try {
      const promises = updates.map(({ id, updates }) => updateItem(id, updates))
      const results = await Promise.all(promises)
      return results.every(result => result)
    } catch (err) {
      console.error('Error bulk updating items:', err)
      setError('Failed to update items')
      return false
    }
  }

  const bulkDeleteItems = async (ids: string[]): Promise<boolean> => {
    if (!user) return false

    try {
      const { error } = await supabase
        .from('items')
        .delete()
        .in('id', ids)
        .eq('user_id', user.id)

      if (error) throw error
      return true
    } catch (err) {
      console.error('Error bulk deleting items:', err)
      setError('Failed to delete items')
      return false
    }
  }

  return {
    categories,
    items,
    loading,
    error,
    initialized,
    createCategory,
    updateCategory,
    deleteCategory,
    createItem,
    updateItem,
    deleteItem,
    bulkCreateItems,
    bulkUpdateItems,
    bulkDeleteItems,
    refreshData,
  }
}