import { SecureAiService } from './secureAiService'
import { SupabaseItemService } from './SupabaseItemService'
import { SupabaseChatService } from './SupabaseChatService'
import { Item, Category } from '../types'

export interface GeminiResponse {
  success: boolean
  response: string
  functionResults?: any[]
  itemsModified?: boolean
  itemCreated?: any
}

/**
 * Supabase-integrated Gemini service that replaces localStorage with database operations
 * This replaces the old GeminiService that used localStorage
 */
export class SupabaseGeminiService {
  
  /**
   * Process a user message with AI and handle any item operations via Supabase
   */
  static async processMessage(
    userMessage: string,
    context: {
      items: Item[]
      categories: Category[]
      currentView?: string
      sessionId?: string
    }
  ): Promise<GeminiResponse> {
    try {
      // Get current model from global state, fallback to default
      const currentModel = (window as any).getCurrentModel?.() || 'gemini-2.5-flash-preview-05-20'
      const model = currentModel.startsWith('gemini-') ? currentModel : 'gemini-2.5-flash-preview-05-20'

      const systemPrompt = this.generateSystemPrompt(context.items, context.categories, context.currentView)
      
      const messages = [
        {
          role: 'system' as const,
          content: systemPrompt
        },
        {
          role: 'user' as const,
          content: userMessage
        }
      ]

      // Define available tools for item management
      const tools = [
        {
          name: 'create_items',
          description: 'Create one or multiple items (todos, events, notes, goals, routines)',
          parameters: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    text: { type: 'string' },
                    type: { type: 'string', enum: ['todo', 'event', 'note', 'goal', 'routine'] },
                    categoryId: { type: 'string' },
                    dueDate: { type: 'string', format: 'date-time' },
                    completed: { type: 'boolean' },
                    metadata: { type: 'object' }
                  },
                  required: ['title', 'type', 'categoryId']
                }
              }
            },
            required: ['items']
          }
        },
        {
          name: 'update_items',
          description: 'Update existing items',
          parameters: {
            type: 'object',
            properties: {
              updates: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    updates: { type: 'object' }
                  },
                  required: ['id', 'updates']
                }
              }
            },
            required: ['updates']
          }
        },
        {
          name: 'delete_items',
          description: 'Delete items by IDs',
          parameters: {
            type: 'object',
            properties: {
              ids: {
                type: 'array',
                items: { type: 'string' }
              }
            },
            required: ['ids']
          }
        }
      ]

      // Use SecureAiService for processing
      const response = await SecureAiService.processMessage(messages, model, { tools })

      let itemsModified = false
      let functionResults: any[] = []
      let itemCreated: any = null

      // Handle tool calls
      if (response.toolCalls && response.toolCalls.length > 0) {
        for (const toolCall of response.toolCalls) {
          try {
            const args = toolCall.function?.arguments ? JSON.parse(toolCall.function.arguments) : {}
            
            switch (toolCall.function?.name) {
              case 'create_items':
                if (args.items && Array.isArray(args.items)) {
                  const itemsToCreate = args.items.map((item: any) => ({
                    title: item.title,
                    text: item.text || '',
                    type: item.type,
                    categoryId: item.categoryId,
                    completed: item.completed || false,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
                    dateTime: item.metadata?.dateTime ? new Date(item.metadata.dateTime) : undefined,
                    attachment: item.metadata?.attachment,
                    metadata: item.metadata || { priority: 'medium' }
                  }))

                  console.log('🤖 AI attempting to create', itemsToCreate.length, 'items')
                  const createdItems = await SupabaseItemService.bulkCreateItems(itemsToCreate)
                  
                  if (createdItems.length > 0) {
                    itemsModified = true
                    itemCreated = createdItems[0] // For backward compatibility
                    functionResults.push({
                      function: 'create_items',
                      result: `Successfully created ${createdItems.length} items`
                    })
                    console.log('✅ AI function: Created', createdItems.length, 'items successfully')
                  } else {
                    functionResults.push({
                      function: 'create_items',
                      result: `Failed to create items - check database connection and permissions`
                    })
                    console.log('❌ AI function: Failed to create items')
                  }
                } else {
                  functionResults.push({
                    function: 'create_items',
                    result: `Invalid items array provided`
                  })
                }
                break

              case 'update_items':
                if (args.updates && Array.isArray(args.updates)) {
                  let updatedCount = 0
                  for (const update of args.updates) {
                    const success = await SupabaseItemService.updateItem(update.id, update.updates)
                    if (success) updatedCount++
                  }
                  if (updatedCount > 0) {
                    itemsModified = true
                    functionResults.push({
                      function: 'update_items',
                      result: `Updated ${updatedCount} items successfully`
                    })
                  }
                }
                break

              case 'delete_items':
                if (args.ids && Array.isArray(args.ids)) {
                  const success = await SupabaseItemService.bulkDeleteItems(args.ids)
                  if (success) {
                    itemsModified = true
                    functionResults.push({
                      function: 'delete_items',
                      result: `Deleted ${args.ids.length} items successfully`
                    })
                  }
                }
                break
            }
          } catch (error) {
            console.error('Error executing tool call:', error)
            functionResults.push({
              function: toolCall.function?.name,
              result: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            })
          }
        }
      }

      // Save conversation to chat history if sessionId provided
      if (context.sessionId) {
        await SupabaseChatService.addMessage(context.sessionId, 'user', userMessage)
        await SupabaseChatService.addMessage(
          context.sessionId, 
          'assistant', 
          response.content || 'No response',
          { functionResults, itemsModified }
        )
      }

      return {
        success: !response.error,
        response: response.content || response.error || 'No response from AI',
        functionResults,
        itemsModified,
        itemCreated
      }
    } catch (error) {
      console.error('Error in SupabaseGeminiService.processMessage:', error)
      return {
        success: false,
        response: `Error processing message: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Execute a confirmed function call
   */
  static async executeConfirmedFunction(
    functionCall: any,
    context: { items: Item[], categories: Category[] }
  ): Promise<GeminiResponse> {
    try {
      let itemsModified = false
      let functionResults: any[] = []
      let itemCreated: any = null

      const { name, arguments: args } = functionCall

      switch (name) {
        case 'create_items':
          const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args
          if (parsedArgs.items && Array.isArray(parsedArgs.items)) {
            const itemsToCreate = parsedArgs.items.map((item: any) => ({
              title: item.title,
              text: item.text || '',
              type: item.type,
              categoryId: item.categoryId,
              completed: item.completed || false,
              createdAt: new Date(),
              updatedAt: new Date(),
              dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
              metadata: item.metadata || { priority: 'medium' }
            }))

            const createdItems = await SupabaseItemService.bulkCreateItems(itemsToCreate)
            if (createdItems.length > 0) {
              itemsModified = true
              itemCreated = createdItems[0]
              functionResults.push({
                function: 'create_items',
                result: `Created ${createdItems.length} items successfully`
              })
            }
          }
          break

        // Add other function handlers as needed
        default:
          throw new Error(`Unknown function: ${name}`)
      }

      return {
        success: true,
        response: 'Function executed successfully',
        functionResults,
        itemsModified,
        itemCreated
      }
    } catch (error) {
      console.error('Error executing confirmed function:', error)
      return {
        success: false,
        response: `Error executing function: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Generate system prompt with current context
   */
  private static generateSystemPrompt(items: Item[], categories: Category[], currentView?: string): string {
    const categoryList = categories.map(cat => `${cat.name} (${cat.id}): ${cat.icon}`).join('\n')
    const recentItems = items.slice(0, 10).map(item => 
      `${item.type}: ${item.title} (${item.categoryId})`
    ).join('\n')

    return `You are a helpful AI assistant for a life management application called lifeOS AI. You help users organize their entire life through natural language commands.

CURRENT CONTEXT:
- View: ${currentView || 'dashboard'}
- Total items: ${items.length}

AVAILABLE CATEGORIES:
${categoryList}

RECENT ITEMS:
${recentItems}

CAPABILITIES:
You can create, update, and delete items (todos, events, notes, goals, routines) using the provided tools. Always:
1. Use appropriate category IDs from the list above
2. Set reasonable due dates for todos and events
3. Add helpful metadata like priority, location, duration
4. Create multiple related items when it makes sense
5. Be proactive in organizing user requests

RESPONSE STYLE:
- Be conversational and helpful
- Confirm what you've done
- Suggest related actions when appropriate
- Use emojis to make responses engaging

Remember: All data operations go through Supabase, ensuring data persistence and cross-device sync.`
  }
}