import { supabase } from '../lib/supabase'
import { SecureAiService } from './secureAiService'
import { Item as LocalItem } from '../types'

/**
 * Service for AI-powered item operations using Supabase instead of localStorage
 * This replaces the localStorage-based operations in aiActions.ts and geminiService.ts
 */
export class SupabaseItemService {
  
  /**
   * Get all items for the current user from Supabase
   */
  static async getAllItems(): Promise<LocalItem[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Convert database items to local format
      return (data || []).map(dbItem => ({
        id: dbItem.id,
        title: dbItem.title,
        text: dbItem.text || '',
        type: dbItem.type as LocalItem['type'],
        completed: dbItem.completed || false,
        categoryId: dbItem.category_id || '',
        createdAt: new Date(dbItem.created_at || ''),
        updatedAt: new Date(dbItem.updated_at || ''),
        dueDate: dbItem.due_date ? new Date(dbItem.due_date) : undefined,
        dateTime: dbItem.date_time ? new Date(dbItem.date_time) : undefined,
        attachment: dbItem.attachment || undefined,
        metadata: (dbItem.metadata as LocalItem['metadata']) || { priority: 'medium' },
      }))
    } catch (error) {
      console.error('Error getting items from Supabase:', error)
      return []
    }
  }

  /**
   * Create a new item via Supabase
   */
  static async createItem(item: Omit<LocalItem, 'id'>): Promise<LocalItem | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('items')
        .insert([{
          title: item.title,
          text: item.text,
          type: item.type,
          completed: item.completed || false,
          category_id: item.categoryId,
          due_date: item.dueDate?.toISOString(),
          date_time: item.dateTime?.toISOString(),
          attachment: item.attachment,
          metadata: item.metadata ? JSON.parse(JSON.stringify(item.metadata, (key, value) => {
            if (value instanceof Date) {
              return value.toISOString()
            }
            return value
          })) : null,
          user_id: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }])
        .select()
        .single()

      if (error) throw error

      // Convert back to local format
      return {
        id: data.id,
        title: data.title,
        text: data.text || '',
        type: data.type as LocalItem['type'],
        completed: data.completed || false,
        categoryId: data.category_id || '',
        createdAt: new Date(data.created_at || ''),
        updatedAt: new Date(data.updated_at || ''),
        dueDate: data.due_date ? new Date(data.due_date) : undefined,
        dateTime: data.date_time ? new Date(data.date_time) : undefined,
        attachment: data.attachment || undefined,
        metadata: (data.metadata as LocalItem['metadata']) || { priority: 'medium' },
      }
    } catch (error) {
      console.error('Error creating item:', error)
      return null
    }
  }

  /**
   * Update an existing item via Supabase
   */
  static async updateItem(id: string, updates: Partial<LocalItem>): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const dbUpdates: any = {
        updated_at: new Date().toISOString(),
      }

      if (updates.title !== undefined) dbUpdates.title = updates.title
      if (updates.text !== undefined) dbUpdates.text = updates.text
      if (updates.completed !== undefined) dbUpdates.completed = updates.completed
      if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate?.toISOString()
      if (updates.dateTime !== undefined) dbUpdates.date_time = updates.dateTime?.toISOString()
      if (updates.attachment !== undefined) dbUpdates.attachment = updates.attachment
      if (updates.metadata !== undefined) {
        dbUpdates.metadata = updates.metadata ? JSON.parse(JSON.stringify(updates.metadata, (key, value) => {
          if (value instanceof Date) {
            return value.toISOString()
          }
          return value
        })) : null
      }

      const { error } = await supabase
        .from('items')
        .update(dbUpdates)
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error updating item:', error)
      return false
    }
  }

  /**
   * Delete an item via Supabase
   */
  static async deleteItem(id: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { error } = await supabase
        .from('items')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error deleting item:', error)
      return false
    }
  }

  /**
   * Bulk create items via Supabase
   */
  static async bulkCreateItems(items: Omit<LocalItem, 'id'>[]): Promise<LocalItem[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const dbItems = items.map(item => ({
        title: item.title,
        text: item.text,
        type: item.type,
        completed: item.completed || false,
        category_id: item.categoryId,
        due_date: item.dueDate?.toISOString(),
        date_time: item.dateTime?.toISOString(),
        attachment: item.attachment,
        metadata: item.metadata ? JSON.parse(JSON.stringify(item.metadata, (key, value) => {
          if (value instanceof Date) {
            return value.toISOString()
          }
          return value
        })) : null,
        user_id: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }))

      const { data, error } = await supabase
        .from('items')
        .insert(dbItems)
        .select()

      if (error) throw error

      // Convert back to local format
      return (data || []).map(dbItem => ({
        id: dbItem.id,
        title: dbItem.title,
        text: dbItem.text || '',
        type: dbItem.type as LocalItem['type'],
        completed: dbItem.completed || false,
        categoryId: dbItem.category_id || '',
        createdAt: new Date(dbItem.created_at || ''),
        updatedAt: new Date(dbItem.updated_at || ''),
        dueDate: dbItem.due_date ? new Date(dbItem.due_date) : undefined,
        dateTime: dbItem.date_time ? new Date(dbItem.date_time) : undefined,
        attachment: dbItem.attachment || undefined,
        metadata: (dbItem.metadata as LocalItem['metadata']) || { priority: 'medium' },
      }))
    } catch (error) {
      console.error('Error bulk creating items:', error)
      return []
    }
  }

  /**
   * Bulk delete items via Supabase
   */
  static async bulkDeleteItems(ids: string[]): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { error } = await supabase
        .from('items')
        .delete()
        .in('id', ids)
        .eq('user_id', user.id)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error bulk deleting items:', error)
      return false
    }
  }

  /**
   * Process AI command with secure service and update Supabase
   */
  static async processAICommand(
    command: string,
    context: {
      items: LocalItem[]
      categories: any[]
      currentView?: string
    }
  ): Promise<{
    success: boolean
    response: string
    itemsModified?: boolean
  }> {
    try {
      const messages = [
        {
          role: 'system' as const,
          content: `You are a life management AI assistant. You can create, update, and manage todos, events, notes, goals, and routines. Current context: ${JSON.stringify(context, null, 2)}`
        },
        {
          role: 'user' as const,
          content: command
        }
      ]

      // Use SecureAiService instead of direct API calls
      const response = await SecureAiService.processMessage(
        messages,
        'gemini-2.5-flash-preview-05-20',
        {
          tools: [
            {
              name: 'create_item',
              description: 'Create a new item (todo, event, note, goal, or routine)',
              parameters: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  text: { type: 'string' },
                  type: { type: 'string', enum: ['todo', 'event', 'note', 'goal', 'routine'] },
                  categoryId: { type: 'string' },
                  dueDate: { type: 'string', format: 'date-time' },
                  metadata: { type: 'object' }
                },
                required: ['title', 'type', 'categoryId']
              }
            },
            {
              name: 'update_item',
              description: 'Update an existing item',
              parameters: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  updates: { type: 'object' }
                },
                required: ['id', 'updates']
              }
            },
            {
              name: 'delete_item',
              description: 'Delete an item',
              parameters: {
                type: 'object',
                properties: {
                  id: { type: 'string' }
                },
                required: ['id']
              }
            }
          ]
        }
      )

      let itemsModified = false

      // Handle tool calls if any
      if (response.toolCalls && response.toolCalls.length > 0) {
        for (const toolCall of response.toolCalls) {
          const args = toolCall.function?.arguments ? JSON.parse(toolCall.function.arguments) : {}
          
          switch (toolCall.function?.name) {
            case 'create_item':
              const newItem = await this.createItem({
                title: args.title,
                text: args.text || '',
                type: args.type,
                categoryId: args.categoryId,
                completed: false,
                createdAt: new Date(),
                updatedAt: new Date(),
                dueDate: args.dueDate ? new Date(args.dueDate) : undefined,
                metadata: args.metadata || { priority: 'medium' }
              })
              if (newItem) itemsModified = true
              break

            case 'update_item':
              const updated = await this.updateItem(args.id, args.updates)
              if (updated) itemsModified = true
              break

            case 'delete_item':
              const deleted = await this.deleteItem(args.id)
              if (deleted) itemsModified = true
              break
          }
        }
      }

      return {
        success: !response.error,
        response: response.content || response.error || 'No response',
        itemsModified
      }
    } catch (error) {
      console.error('Error processing AI command:', error)
      return {
        success: false,
        response: 'Failed to process command'
      }
    }
  }
}