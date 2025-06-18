import { supabase } from '../lib/supabase'
import { ChatSession, ChatMessage } from '../lib/database.types'

export interface ChatSessionWithMessages extends ChatSession {
  messages: ChatMessage[]
}

export class SupabaseChatService {
  
  /**
   * Get all chat sessions for the current user
   */
  static async getChatSessions(): Promise<ChatSession[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error getting chat sessions:', error)
      return []
    }
  }

  /**
   * Get a specific chat session with its messages
   */
  static async getChatSession(sessionId: string): Promise<ChatSessionWithMessages | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const [sessionResult, messagesResult] = await Promise.all([
        supabase
          .from('chat_sessions')
          .select('*')
          .eq('id', sessionId)
          .eq('user_id', user.id)
          .single(),
        supabase
          .from('chat_messages')
          .select('*')
          .eq('session_id', sessionId)
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })
      ])

      if (sessionResult.error) throw sessionResult.error
      if (messagesResult.error) throw messagesResult.error

      return {
        ...sessionResult.data,
        messages: messagesResult.data || []
      }
    } catch (error) {
      console.error('Error getting chat session:', error)
      return null
    }
  }

  /**
   * Create a new chat session
   */
  static async createChatSession(title?: string): Promise<ChatSession | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('chat_sessions')
        .insert([
          {
            user_id: user.id,
            title: title || `Chat ${new Date().toLocaleDateString()}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ])
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error creating chat session:', error)
      return null
    }
  }

  /**
   * Update a chat session
   */
  static async updateChatSession(
    sessionId: string, 
    updates: Partial<Pick<ChatSession, 'title'>>
  ): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { error } = await supabase
        .from('chat_sessions')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId)
        .eq('user_id', user.id)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error updating chat session:', error)
      return false
    }
  }

  /**
   * Delete a chat session and all its messages
   */
  static async deleteChatSession(sessionId: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      // Delete messages first (due to foreign key constraint)
      await supabase
        .from('chat_messages')
        .delete()
        .eq('session_id', sessionId)
        .eq('user_id', user.id)

      // Then delete the session
      const { error } = await supabase
        .from('chat_sessions')
        .delete()
        .eq('id', sessionId)
        .eq('user_id', user.id)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error deleting chat session:', error)
      return false
    }
  }

  /**
   * Add a message to a chat session
   */
  static async addMessage(
    sessionId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: Record<string, any>
  ): Promise<ChatMessage | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('chat_messages')
        .insert([
          {
            session_id: sessionId,
            user_id: user.id,
            role,
            content,
            metadata: metadata || null,
            created_at: new Date().toISOString(),
          },
        ])
        .select()
        .single()

      if (error) throw error

      // Update session's updated_at timestamp
      await supabase
        .from('chat_sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', sessionId)
        .eq('user_id', user.id)

      return data
    } catch (error) {
      console.error('Error adding message:', error)
      return null
    }
  }

  /**
   * Get messages for a specific session
   */
  static async getMessages(sessionId: string): Promise<ChatMessage[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error getting messages:', error)
      return []
    }
  }

  /**
   * Delete all chat data for the current user
   */
  static async clearAllChats(): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      // Delete all messages first
      await supabase
        .from('chat_messages')
        .delete()
        .eq('user_id', user.id)

      // Then delete all sessions
      const { error } = await supabase
        .from('chat_sessions')
        .delete()
        .eq('user_id', user.id)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error clearing all chats:', error)
      return false
    }
  }

  /**
   * Subscribe to real-time updates for chat sessions
   */
  static subscribeToSessions(
    userId: string,
    callback: (payload: any) => void
  ) {
    return supabase
      .channel('chat-sessions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_sessions',
          filter: `user_id=eq.${userId}`,
        },
        callback
      )
      .subscribe()
  }

  /**
   * Subscribe to real-time updates for messages in a specific session
   */
  static subscribeToMessages(
    sessionId: string,
    userId: string,
    callback: (payload: any) => void
  ) {
    return supabase
      .channel(`chat-messages-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_messages',
          filter: `session_id=eq.${sessionId}`,
        },
        callback
      )
      .subscribe()
  }
}