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

const localItemToDb = (localItem: Omit<LocalItem, 'id'>, userId: string, categoryMapping?: Map<string, string>) => ({
  title: localItem.title,
  text: localItem.text,
  type: localItem.type,
  completed: localItem.completed,
  category_id: categoryMapping ? (categoryMapping.get(localItem.categoryId) || localItem.categoryId) : localItem.categoryId,
  due_date: localItem.dueDate?.toISOString(),
  date_time: localItem.dateTime?.toISOString(),
  attachment: localItem.attachment,
  metadata: localItem.metadata ? JSON.parse(JSON.stringify(localItem.metadata, (key, value) => {
    // Convert Date objects to ISO strings for JSON storage
    if (value instanceof Date) {
      return value.toISOString();
    }
    return value;
  })) : null,
  user_id: userId,
})

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
      
      // Build category mapping from legacy IDs to UUIDs and reverse
      const mapping = new Map<string, string>()
      const reverse = new Map<string, string>()
      const nameToLegacyId: Record<string, string> = {
        'Self-Regulation': 'self-regulation',
        'Gym/Calisthenics': 'gym-calisthenics', 
        'Mobile Apps/AI/Entrepreneurship': 'mobile-apps',
        'Catholicism': 'catholicism',
        'Social/Charisma/Dating': 'social-charisma',
        'Content Creation': 'content'
      }
      
      data?.forEach(dbCategory => {
        const legacyId = nameToLegacyId[dbCategory.name]
        if (legacyId) {
          mapping.set(legacyId, dbCategory.id)
          reverse.set(dbCategory.id, legacyId)
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
      setCategories([])
      setItems([])
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
    if (!user || !initialized) return

    const categoriesSubscription = supabase
      .channel('categories-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'categories',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Directly fetch and update categories without depending on fetchCategories function
          supabase
            .from('categories')
            .select('*')
            .eq('user_id', user.id)
            .order('priority', { ascending: true })
            .then(({ data }) => {
              if (data) {
                setCategories(data.map(dbCategoryToLocal))
              }
            })
        }
      )
      .subscribe()

    const itemsSubscription = supabase
      .channel('items-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'items',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Directly fetch and update items without depending on fetchItems function
          supabase
            .from('items')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .then(({ data }) => {
              if (data) {
                setItems(data.map(item => dbItemToLocal(item, reverseMapping)))
              }
            })
        }
      )
      .subscribe()

    return () => {
      categoriesSubscription.unsubscribe()
      itemsSubscription.unsubscribe()
    }
  }, [user?.id, initialized, reverseMapping]) // Use user.id instead of user object

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
      const { data, error } = await supabase
        .from('items')
        .insert([localItemToDb(item, user.id, categoryMapping)])
        .select()
        .single()

      if (error) throw error
      return dbItemToLocal(data, reverseMapping)
    } catch (err) {
      console.error('Error creating item:', err)
      setError('Failed to create item')
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
      const dbItems = items.map(item => localItemToDb(item, user.id, categoryMapping))
      
      const { data, error } = await supabase
        .from('items')
        .insert(dbItems)
        .select()

      if (error) throw error
      return (data || []).map(item => dbItemToLocal(item, reverseMapping))
    } catch (err) {
      console.error('Error bulk creating items:', err)
      setError('Failed to create items')
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