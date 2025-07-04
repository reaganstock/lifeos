import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthContext } from '../components/AuthProvider'
import { Category, Item } from '../lib/database.types'
import { Item as LocalItem, Category as LocalCategory } from '../types'
// Removed initialCategories import - users create their own categories

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
  ensureProfileExists: () => Promise<boolean>
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
  
  // Use refs to track subscription state and prevent multiple subscriptions
  const subscriptionsActive = useRef(false)
  const currentUserId = useRef<string | null>(null)

  // Helper function to build category mappings from data
  const buildCategoryMappings = useCallback((data: any[]) => {
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
    return { mapping, reverse }
  }, [])

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
      
      // Build category mappings
      buildCategoryMappings(data || [])
      
      return localCategories
    } catch (err) {
      console.error('Error fetching categories:', err)
      
      // Check if it's a network connectivity issue
      if (err instanceof Error && (err.message.includes('NetworkError') || err.message.includes('Failed to fetch') || err.message.includes('ERR_NAME_NOT_RESOLVED'))) {
        console.warn('🌐 Network connectivity issue detected - app will work in offline mode with localStorage')
        setError('Working offline - network connectivity issue')
      } else {
        setError('Failed to fetch categories')
      }
      return []
    }
  }, [user, buildCategoryMappings])

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
      
      // Check if it's a network connectivity issue
      if (err instanceof Error && (err.message.includes('NetworkError') || err.message.includes('Failed to fetch') || err.message.includes('ERR_NAME_NOT_RESOLVED'))) {
        console.warn('🌐 Network connectivity issue detected - app will work in offline mode with localStorage')
        setError('Working offline - network connectivity issue')
      } else {
        setError('Failed to fetch items')
      }
      return []
    }
  }, [user, reverseMapping])

  const ensureProfileExists = useCallback(async (): Promise<boolean> => {
    if (!user) return false

    try {
      console.log('🔍 Checking if profile exists for user:', user.id)
      
      const { data: existingProfile, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single()

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = not found
        console.error('❌ Error checking profile:', checkError)
        return false
      }

      if (!existingProfile) {
        console.log('📝 Profile not found, creating profile for user:', user.email)
        
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert([
            {
              id: user.id,
              email: user.email!,
              full_name: user.user_metadata?.full_name || '',
              avatar_url: user.user_metadata?.avatar_url || null,
              has_completed_onboarding: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ], {
            onConflict: 'id',
            ignoreDuplicates: false
          })

        if (profileError) {
          console.error('❌ Error creating profile:', profileError)
          return false
        }
        
        console.log('✅ Profile created successfully for user:', user.email)
      } else {
        console.log('✅ Profile already exists for user:', user.email)
      }
      
      return true
    } catch (err) {
      console.error('❌ Exception in ensureProfileExists:', err)
      return false
    }
  }, [user])

  const createInitialCategories = useCallback(async () => {
    if (!user) return []

    console.log('🆕 New user detected, creating initial categories')
    
    // First ensure the profile exists
    const profileCreated = await ensureProfileExists()
    if (!profileCreated) {
      console.error('❌ Could not create/verify profile, cannot create categories')
      return []
    }

    // Check if user already has categories from onboarding (localStorage first approach)
    const localCategories = localStorage.getItem('lifeStructureCategories')
    if (localCategories) {
      try {
        const parsedCategories = JSON.parse(localCategories)
        console.log('📂 Found categories from onboarding in localStorage:', parsedCategories.length)
        
        // Sync these categories to Supabase if they don't exist there yet
        const createdCategories: LocalCategory[] = []
        for (const category of parsedCategories) {
          try {
            const { data, error } = await supabase
              .from('categories')
              .upsert([
                {
                  id: category.id,
                  name: category.name,
                  icon: category.icon || '📁',
                  color: category.color || '#3B82F6',
                  priority: category.priority || 0,
                  user_id: user.id,
                  created_at: new Date(category.createdAt || Date.now()).toISOString(),
                  updated_at: new Date(category.updatedAt || Date.now()).toISOString(),
                }
              ], {
                onConflict: 'id',
                ignoreDuplicates: false
              })
              .select()

            if (error) {
              console.error('❌ Error syncing category to Supabase:', error)
              continue
            }

            if (data && data[0]) {
              createdCategories.push({
                id: data[0].id,
                name: data[0].name,
                icon: data[0].icon || '📁',
                color: data[0].color || '#3B82F6',
                priority: data[0].priority || 0,
                createdAt: new Date(data[0].created_at || new Date()),
                updatedAt: new Date(data[0].updated_at || new Date())
              })
              console.log('✅ Synced category to Supabase:', data[0].name)
            }
          } catch (categoryError) {
            console.error('❌ Error creating category:', categoryError)
          }
        }
        
        console.log('🎉 Successfully synced', createdCategories.length, 'categories from onboarding to Supabase')
        return createdCategories
      } catch (parseError) {
        console.error('❌ Error parsing localStorage categories:', parseError)
      }
    }

    // If no categories from onboarding, create default ones
    console.log('📂 No onboarding categories found, creating default categories')
    const defaultCategories = [
      { name: 'Personal Growth', icon: '🧠', color: '#8B5CF6', priority: 1 },
      { name: 'Work & Career', icon: '💼', color: '#3B82F6', priority: 2 },
      { name: 'Health & Fitness', icon: '💪', color: '#EF4444', priority: 3 },
      { name: 'Relationships', icon: '👥', color: '#10B981', priority: 4 }
    ]

    const createdCategories: LocalCategory[] = []
    for (const categoryData of defaultCategories) {
      try {
        const categoryId = `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const { data, error } = await supabase
          .from('categories')
          .insert([
            {
              id: categoryId,
              name: categoryData.name,
              icon: categoryData.icon,
              color: categoryData.color,
              priority: categoryData.priority,
              user_id: user.id,
            }
          ])
          .select()

        if (error) {
          console.error('❌ Error creating default category:', error)
          continue
        }

        if (data && data[0]) {
          createdCategories.push({
            id: data[0].id,
            name: data[0].name,
            icon: data[0].icon || '📁',
            color: data[0].color || '#3B82F6',
            priority: data[0].priority || 0,
            createdAt: new Date(data[0].created_at || new Date()),
            updatedAt: new Date(data[0].updated_at || new Date())
          })
          console.log('✅ Created default category:', data[0].name)
        }
      } catch (categoryError) {
        console.error('❌ Error creating category:', categoryError)
      }
    }

    console.log('🎉 Created', createdCategories.length, 'default categories')
    return createdCategories
  }, [user, ensureProfileExists, supabase])

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
      let fetchedCategories = await fetchCategories()
      
      // 🆕 AUTO-CREATE INITIAL CATEGORIES for new users
      if (fetchedCategories.length === 0) {
        console.log('📂 New user detected - creating initial categories automatically')
        const createdCategories = await createInitialCategories()
        if (createdCategories.length > 0) {
          // Refresh to get proper mappings built
          fetchedCategories = await fetchCategories()
        }
      }
      
      const fetchedItems = await fetchItems()

      // Set categories and items
      setCategories(fetchedCategories)
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

  // Real-time subscriptions - prevent multiple subscriptions
  useEffect(() => {
    // Don't set up subscriptions if user not available or not initialized
    if (!user || !initialized) {
      console.log('⏳ Skipping realtime setup - user:', !!user, 'initialized:', initialized)
      return
    }

    // Don't set up subscriptions if already active for this user
    if (subscriptionsActive.current && currentUserId.current === user.id) {
      console.log('⏳ Skipping realtime setup - subscriptions already active for user:', user.id)
      return
    }

    // Clean up any existing subscriptions before creating new ones
    if (subscriptionsActive.current) {
      console.log('🧹 Cleaning up existing subscriptions before creating new ones')
      supabase.removeAllChannels()
      subscriptionsActive.current = false
    }

    console.log('🔄 Setting up realtime subscriptions for user:', user.id)
    
    let categoriesSubscription: any = null
    let itemsSubscription: any = null

    try {
      categoriesSubscription = supabase
        .channel(`categories-changes-${user.id}-${Date.now()}`) // Add timestamp to ensure uniqueness
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
            // Refresh categories data AND rebuild mappings for real-time consistency
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
                  const localCategories = data.map(dbCategoryToLocal)
                  setCategories(localCategories)
                  
                  // 🔄 CRITICAL: Rebuild category mappings for real-time consistency
                  buildCategoryMappings(data)
                }
              })
          }
        )
        .subscribe((status) => {
          console.log('📁 Categories subscription status:', status)
        })

      itemsSubscription = supabase
        .channel(`items-changes-${user.id}-${Date.now()}`) // Add timestamp to ensure uniqueness
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
            // Refresh items data - get current reverseMapping at time of update
            const currentReverseMapping = reverseMapping
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
                  setItems(data.map(item => dbItemToLocal(item, currentReverseMapping)))
                }
              })
          }
        )
        .subscribe((status) => {
          console.log('📝 Items subscription status:', status)
        })

      // Mark subscriptions as active
      subscriptionsActive.current = true
      currentUserId.current = user.id

    } catch (error) {
      console.error('❌ Error setting up subscriptions:', error)
    }

    return () => {
      console.log('🔄 Unsubscribing from realtime channels for user:', currentUserId.current)
      if (categoriesSubscription) {
        categoriesSubscription.unsubscribe()
      }
      if (itemsSubscription) {
        itemsSubscription.unsubscribe()
      }
      subscriptionsActive.current = false
      currentUserId.current = null
    }
  }, [user?.id, initialized]) // Removed reverseMapping dependency to prevent re-subscriptions

  // Category operations
  const createCategory = async (category: Omit<LocalCategory, 'id'>): Promise<LocalCategory | null> => {
    if (!user) return null

    try {
      console.log('🎯 Creating category with data:', category)
      console.log('🎯 User ID:', user.id)
      
      // CRITICAL: Ensure profile exists before creating category
      const profileExists = await ensureProfileExists()
      if (!profileExists) {
        console.error('❌ Cannot create category - profile creation failed')
        setError('Profile verification failed. Please try again.')
        return null
      }
      
      // Check if a category with this name already exists for this user
      const { data: existingCategories, error: checkError } = await supabase
        .from('categories')
        .select('name')
        .eq('user_id', user.id)
        .eq('name', category.name)
      
      if (checkError) {
        console.error('🚨 Error checking existing categories:', checkError)
      } else if (existingCategories && existingCategories.length > 0) {
        console.warn('⚠️ Category with this name already exists:', category.name)
        setError(`A category named "${category.name}" already exists`)
        return null
      }
      
      const dbCategory = localCategoryToDb(category, user.id)
      console.log('🎯 Database category object:', dbCategory)
      
      const { data, error } = await supabase
        .from('categories')
        .insert([dbCategory])
        .select()
        .single()

      if (error) {
        console.error('🚨 Supabase error details:', error)
        console.error('🚨 Error code:', error.code)
        console.error('🚨 Error message:', error.message)
        console.error('🚨 Error details:', error.details)
        
        // Provide more user-friendly error messages
        if (error.code === '23505') {  // Unique constraint violation
          setError('A category with this name or details already exists')
        } else if (error.code === '23514') {  // Check constraint violation
          setError('Invalid category data provided')
        } else {
          setError(`Database error: ${error.message}`)
        }
        return null
      }
      
      console.log('✅ Category created successfully in DB:', data)
      const newCategory = dbCategoryToLocal(data)
      
      // Optimistically update local state immediately
      setCategories(prev => [...prev, newCategory].sort((a, b) => a.priority - b.priority))
      
      // Also rebuild mappings immediately
      const { data: allCategoriesData } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
      if (allCategoriesData) {
        buildCategoryMappings(allCategoriesData)
      }
      
      return newCategory
    } catch (err) {
      console.error('Error creating category:', err)
      setError(`Failed to create category: ${err instanceof Error ? err.message : 'Unknown error'}`)
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
      
      // Optimistically update local state immediately
      setCategories(prev => prev.map(cat => 
        cat.id === id ? { ...cat, ...updates, updatedAt: new Date() } : cat
      ).sort((a, b) => a.priority - b.priority))
      
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
      
      // Optimistically update local state immediately
      setCategories(prev => prev.filter(cat => cat.id !== id))
      setItems(prev => prev.filter(item => item.categoryId !== id))
      
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
      const newItem = dbItemToLocal(data, reverseMapping)
      
      // Optimistically update local state immediately
      setItems(prev => [newItem, ...prev])
      
      return newItem
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
      
      // Optimistically update local state immediately
      setItems(prev => prev.map(item => 
        item.id === id ? { ...item, ...updates, updatedAt: new Date() } : item
      ))
      
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
      
      // Optimistically update local state immediately
      setItems(prev => prev.filter(item => item.id !== id))
      
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
      const newItems = (data || []).map(item => dbItemToLocal(item, reverseMapping))
      
      // Optimistically update local state immediately
      setItems(prev => [...newItems, ...prev])
      
      return newItems
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
      
      // Optimistically update local state immediately
      setItems(prev => prev.filter(item => !ids.includes(item.id)))
      
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
    ensureProfileExists,
  }
}