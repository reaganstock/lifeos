import { useAuthContext } from '../components/AuthProvider'
import { useSupabaseData } from './useSupabaseData'
import { SupabaseGeminiService, GeminiResponse } from '../services/SupabaseGeminiService'
import { SupabaseChatService } from '../services/SupabaseChatService'
import { Item, Category } from '../types'

/**
 * Hook that provides AI services with automatic Supabase integration
 * This replaces direct usage of geminiService and aiActions
 */
export function useAIService() {
  const { user } = useAuthContext()
  const { items, categories, refreshData } = useSupabaseData()

  /**
   * Process an AI message with automatic data refresh
   */
  const processMessage = async (
    message: string,
    context?: {
      currentView?: string
      sessionId?: string
    }
  ): Promise<GeminiResponse> => {
    if (!user) {
      return {
        success: false,
        response: 'Please sign in to use AI features'
      }
    }

    const result = await SupabaseGeminiService.processMessage(message, {
      items,
      categories,
      currentView: context?.currentView,
      sessionId: context?.sessionId
    })

    // Refresh data if items were modified
    if (result.itemsModified) {
      await refreshData()
      
      // Trigger custom event for real-time updates (compatibility with existing code)
      window.dispatchEvent(new CustomEvent('itemsModified', {
        detail: { source: 'ai-service' }
      }))
    }

    return result
  }

  /**
   * Execute a confirmed function call
   */
  const executeConfirmedFunction = async (
    functionCall: any
  ): Promise<GeminiResponse> => {
    if (!user) {
      return {
        success: false,
        response: 'Please sign in to use AI features'
      }
    }

    const result = await SupabaseGeminiService.executeConfirmedFunction(functionCall, {
      items,
      categories
    })

    // Refresh data if items were modified
    if (result.itemsModified) {
      await refreshData()
      
      // Trigger custom event for real-time updates
      window.dispatchEvent(new CustomEvent('itemsModified', {
        detail: { source: 'ai-service' }
      }))
    }

    return result
  }

  /**
   * Chat service methods
   */
  const chatService = {
    getSessions: () => SupabaseChatService.getChatSessions(),
    getSession: (id: string) => SupabaseChatService.getChatSession(id),
    createSession: (title?: string) => SupabaseChatService.createChatSession(title),
    updateSession: (id: string, updates: any) => SupabaseChatService.updateChatSession(id, updates),
    deleteSession: (id: string) => SupabaseChatService.deleteChatSession(id),
    addMessage: (sessionId: string, role: 'user' | 'assistant' | 'system', content: string, metadata?: any) => 
      SupabaseChatService.addMessage(sessionId, role, content, metadata),
    getMessages: (sessionId: string) => SupabaseChatService.getMessages(sessionId),
    clearAllChats: () => SupabaseChatService.clearAllChats(),
  }

  return {
    // AI processing
    processMessage,
    executeConfirmedFunction,
    
    // Chat management
    chatService,
    
    // Data context
    items,
    categories,
    user,
    isAuthenticated: !!user,
    
    // Utilities
    refreshData
  }
}

/**
 * Legacy compatibility hook for components still using the old pattern
 * This provides the same interface as the old localStorage-based services
 */
export function useLegacyAIService() {
  const aiService = useAIService()

  // Provide the same interface as the old GeminiService for backward compatibility
  return {
    processMessage: async (
      message: string,
      items: Item[],
      categories: Category[],
      currentView?: string
    ): Promise<GeminiResponse> => {
      return aiService.processMessage(message, { currentView })
    },
    
    executeConfirmedFunction: async (
      functionCall: any,
      items: Item[],
      categories: Category[]
    ): Promise<GeminiResponse> => {
      return aiService.executeConfirmedFunction(functionCall)
    },

    // Chat service compatibility
    getChatHistory: aiService.chatService.getSessions,
    saveChatMessage: aiService.chatService.addMessage,
    
    // Data access
    getCurrentItems: () => aiService.items,
    getCurrentCategories: () => aiService.categories,
    
    // Refresh trigger
    triggerRefresh: aiService.refreshData
  }
}