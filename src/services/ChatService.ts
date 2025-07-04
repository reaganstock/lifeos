import { ChatMessage, ChatSession, ChatState, AIResponse, MessageVersion } from '../types/chat';
import { Item, Category } from '../types';
import { AIActions, getCurrentModel, forceResetToGemini } from '../services/aiActions';
import { geminiService } from '../services/geminiService';
import { SupabaseChatService } from './SupabaseChatService';
// import { supabase } from '../lib/supabase';

class ChatService {
  private state: ChatState = {
    sessions: [],
    currentSessionId: null,
    isProcessing: false
  };

  private listeners: Array<(state: ChatState) => void> = [];
  private aiActions = new AIActions(); // Create instance locally
  private readonly STORAGE_KEY = 'georgetownAI_chatSessions';
  private readonly CURRENT_SESSION_KEY = 'georgetownAI_currentSession';
  private messageCounter = 0; // Add counter to prevent duplicate IDs
  private isInitialized = false; // Add flag to prevent re-initialization

  // Generate unique message ID
  private generateMessageId(): string {
    this.messageCounter++;
    return `msg_${Date.now()}_${this.messageCounter}_${Math.random().toString(36).substring(2, 11)}`;
  }

  // Generate unique version ID
  private generateVersionId(): string {
    return `version_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  // Load sessions from Supabase - LAZY LOADING for performance
  private async loadFromSupabase(): Promise<void> {
    try {
      console.log('📂 ChatService: Loading sessions metadata only (FAST)...');
      
      const dbSessions = await SupabaseChatService.getChatSessions();
      console.log('📂 ChatService: Found sessions:', dbSessions.length);
      
      // PERFORMANCE FIX: Only load session metadata, not all messages
      this.state.sessions = dbSessions.map((dbSession: any) => {
        const session: ChatSession = {
          id: dbSession.id,
          title: dbSession.title || 'Untitled Chat',
          createdAt: new Date(dbSession.created_at || Date.now()),
          updatedAt: new Date(dbSession.updated_at || Date.now()),
          messages: [] // Load messages lazily when session is opened
        };
        
        return session;
      });
        
      console.log('✅ ChatService: Loaded and converted', this.state.sessions.length, 'sessions');
        
      // Set current session to the most recent one
      if (this.state.sessions.length > 0) {
        this.state.currentSessionId = this.state.sessions[0].id;
        console.log('✅ ChatService: Set current session:', this.state.currentSessionId);
      }
    } catch (error) {
      console.error('❌ ChatService: Error loading from Supabase:', error);
      this.state.sessions = [];
      this.state.currentSessionId = null;
    }
  }

  // PERFORMANCE FIX: Load messages for a specific session when needed
  private async loadSessionMessages(sessionId: string): Promise<void> {
    try {
      console.log(`📂 ChatService: Loading messages for session ${sessionId}...`);
      
      const sessionWithMessages = await SupabaseChatService.getChatSession(sessionId);
      
      // Find the session in our state and update its messages
      const sessionIndex = this.state.sessions.findIndex(s => s.id === sessionId);
      if (sessionIndex !== -1 && sessionWithMessages?.messages) {
        this.state.sessions[sessionIndex].messages = sessionWithMessages.messages.map((msg: any) => ({
          id: msg.id,
          role: msg.role,
          timestamp: new Date(msg.created_at || Date.now()),
          currentVersionIndex: 0,
          versions: [{
            id: `v_${msg.id}`,
            content: msg.content,
            timestamp: new Date(msg.created_at || Date.now())
          }]
        }));
        
        console.log(`✅ ChatService: Loaded ${sessionWithMessages.messages.length} messages for session ${sessionId}`);
        this.notifyListeners(); // Update UI
      }
    } catch (error) {
      console.error('Failed to load session messages:', error);
    }
  }

  // Helper method to safely parse dates
  private parseDate(dateString: any): Date | null {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  }

  // Clear corrupted storage and start fresh
  private clearCorruptedStorage(): void {
    console.warn('🧹 ChatService: Clearing corrupted storage');
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      localStorage.removeItem(this.CURRENT_SESSION_KEY);
    } catch (error) {
      console.error('❌ ChatService: Error clearing storage:', error);
    }
    this.state.sessions = [];
    this.state.currentSessionId = null;
  }

  // Save to Supabase (individual operations are handled by specific methods)
  private async saveToSupabase(): Promise<void> {
    // Individual session and message saves are handled by createSession, addMessage, etc.
    // This method is kept for interface compatibility but doesn't need to do bulk saves
    console.log('💾 ChatService: Supabase saves handled by individual operations');
  }

  // Initialize with a default session
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('⚠️ ChatService: Already initialized, skipping...');
      return;
    }

    console.log('🔄 ChatService: Initializing...');
    
    // Force reset to Gemini model to ensure we're using direct API
    forceResetToGemini();
    
    // Load existing sessions first
    await this.loadFromSupabase();
    
    console.log('📊 ChatService: Loaded', this.state.sessions.length, 'sessions');
    console.log('📊 ChatService: Current session ID:', this.state.currentSessionId);
    
    // Validate current session exists and is valid
    let currentSession = null;
    if (this.state.currentSessionId) {
      currentSession = this.state.sessions.find(s => s.id === this.state.currentSessionId);
    }
    
    // Create default session if no sessions exist OR current session is invalid
    if (this.state.sessions.length === 0 || !currentSession) {
      console.log('🆕 ChatService: Creating default session');
      const defaultSession = await this.createSession('Georgetown AI Assistant');
      this.state.currentSessionId = defaultSession.id;
    }
    
    console.log('✅ ChatService: Initialized with', this.state.sessions.length, 'sessions');
    console.log('✅ ChatService: Active session:', this.state.currentSessionId);
    
    this.isInitialized = true;
    this.notifyListeners();
  }

  // Create a new chat session
  async createSession(title: string = 'New Chat'): Promise<ChatSession> {
    try {
      const dbSession = await SupabaseChatService.createChatSession(title);
      if (!dbSession) {
        throw new Error('Failed to create session in Supabase');
      }

      const session: ChatSession = {
        id: dbSession.id,
        title: dbSession.title || title,
        messages: [],
        createdAt: new Date(dbSession.created_at || Date.now()),
        updatedAt: new Date(dbSession.updated_at || Date.now())
      };

      this.state.sessions.unshift(session);
      this.notifyListeners();
      return session;
    } catch (error) {
      console.error('Error creating session:', error);
      // Fallback to local session
    const session: ChatSession = {
      id: `session_${Date.now()}`,
      title,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.state.sessions.unshift(session);
    this.notifyListeners();
    return session;
    }
  }

  // Switch to a session
  switchToSession(sessionId: string): boolean {
    const session = this.state.sessions.find(s => s.id === sessionId);
    if (session) {
      this.state.currentSessionId = sessionId;
      this.notifyListeners();
      return true;
    }
    return false;
  }

  // Get current session
  getCurrentSession(): ChatSession | null {
    if (!this.state.currentSessionId) return null;
    return this.state.sessions.find(s => s.id === this.state.currentSessionId) || null;
  }

  // Add function call message to current session
  async addFunctionCallMessage(functionCall: {
    name: string;
    args: any;
    status?: 'pending' | 'executing' | 'completed' | 'failed';
    autoApproved?: boolean;
  }): Promise<ChatMessage> {
    let session = this.getCurrentSession();
    
    // Emergency session recovery
    if (!session) {
      console.warn('⚠️ No active session found, creating emergency session');
      const emergencySession = await this.createSession('Function Call Chat');
      this.state.currentSessionId = emergencySession.id;
      session = emergencySession;
    }

    // Create function call message
    const messageVersion: MessageVersion = {
      id: this.generateVersionId(),
      content: `Function call: ${functionCall.name}`,
      timestamp: new Date()
    };

    const message: ChatMessage = {
      id: this.generateMessageId(),
      role: 'function_call',
      versions: [messageVersion],
      currentVersionIndex: 0,
      timestamp: new Date(),
      functionCall: {
        name: functionCall.name,
        args: functionCall.args,
        status: functionCall.status || 'pending',
        autoApproved: functionCall.autoApproved || false
      }
    };

    session.messages.push(message);
    session.updatedAt = new Date();
    this.notifyListeners();
    return message;
  }

  // Update function call status and results
  updateFunctionCall(messageId: string, updates: {
    status?: 'pending' | 'executing' | 'completed' | 'failed';
    result?: any;
    aiFeedback?: string;
    autoApproved?: boolean;
  }): boolean {
    const session = this.getCurrentSession();
    if (!session) return false;

    const message = session.messages.find(m => m.id === messageId && m.role === 'function_call');
    if (!message || !message.functionCall) return false;

    // Update function call data
    Object.assign(message.functionCall, updates);
    
    session.updatedAt = new Date();
    this.notifyListeners();
    return true;
  }

  // Get pending function calls in current session
  getPendingFunctionCalls(): ChatMessage[] {
    const session = this.getCurrentSession();
    if (!session) return [];

    return session.messages.filter(m => 
      m.role === 'function_call' && 
      m.functionCall?.status === 'pending'
    );
  }

  // Intelligent auto-approve decision based on conversation context
  shouldAutoApprove(functionCallMessage: ChatMessage, autoApproveEnabled: boolean): boolean {
    if (!autoApproveEnabled || !functionCallMessage.functionCall) return false;

    const session = this.getCurrentSession();
    if (!session) return false;

    // Get recent messages for context
    const recentMessages = session.messages.slice(-10);
    
    // Check if user recently approved similar function calls
    const recentApprovals = recentMessages.filter(m => 
      m.role === 'function_call' && 
      m.functionCall?.autoApproved === true &&
      m.functionCall?.name === functionCallMessage.functionCall?.name
    );

    // Auto-approve if user has approved similar functions recently
    if (recentApprovals.length > 0) {
      console.log('🤖 Auto-approving based on recent similar approvals');
      return true;
    }

    // Auto-approve safe operations
    const safeFunctions = ['createItem', 'bulkCreateItems', 'updateItem', 'generateFullDaySchedule', 'copyRoutineFromPerson'];
    if (safeFunctions.includes(functionCallMessage.functionCall.name)) {
      console.log('🤖 Auto-approving safe operation:', functionCallMessage.functionCall.name);
      return true;
    }

    // Don't auto-approve destructive operations unless explicitly approved recently
    const destructiveFunctions = ['deleteItem', 'bulkDeleteItems'];
    if (destructiveFunctions.includes(functionCallMessage.functionCall.name)) {
      console.log('🛡️ Requiring manual approval for destructive operation');
      return false;
    }

    return false;
  }

  // Intelligent goal completion analysis for agentic mode
  shouldContinueAgentic(lastUserMessage: string, recentAIResponses: string[], functionResults: any[]): boolean {
    console.log('🤖 AGENTIC INTELLIGENCE: Analyzing if goal is achieved...');
    console.log('🤖 User request:', lastUserMessage);
    console.log('🤖 Recent AI responses:', recentAIResponses);
    console.log('🤖 Function results:', functionResults);

    const userIntent = lastUserMessage.toLowerCase().trim();
    
    // DELETION OPERATIONS: Stop immediately if we've already deleted everything
    const isDeletionRequest = userIntent.includes('clear') || userIntent.includes('delete') || userIntent.includes('remove');
    if (isDeletionRequest) {
      const deletionResults = functionResults.filter(r => r.function?.includes('delete') || r.function?.includes('bulkDelete'));
      
      // If we've attempted deletion multiple times, stop to prevent infinite loops
      if (deletionResults.length >= 2) {
        console.log('🛑 DELETION COMPLETE: Stopping to prevent infinite deletion loops');
        return false;
      }
      
      // If last deletion returned "no items found" or similar, stop
      const lastDeletion = deletionResults[deletionResults.length - 1];
      if (lastDeletion && lastDeletion.result?.message?.toLowerCase().includes('no items')) {
        console.log('🛑 DELETION COMPLETE: No more items to delete');
        return false;
      }
    }

    // Extract quantity requests (e.g., "100 goals", "50 todos", "20 events")
    const quantityMatch = userIntent.match(/(\d+)\s+(goals?|todos?|events?|notes?|routines?|items?)/);
    if (quantityMatch) {
      const requestedQuantity = parseInt(quantityMatch[1]);
      const itemType = quantityMatch[2];
      
      // Calculate total items created so far
      let totalCreated = 0;
      functionResults.forEach(result => {
        if (result.function?.includes('bulkCreate') && result.result?.itemsCreated) {
          totalCreated += result.result.itemsCreated;
        } else if (result.function?.includes('create') && result.success) {
          totalCreated += 1;
        }
      });
      
      console.log(`🔢 QUANTITY CHECK: User wants ${requestedQuantity} ${itemType}, created ${totalCreated} so far`);
      
      if (totalCreated >= requestedQuantity) {
        console.log(`🎯 QUANTITY GOAL ACHIEVED: Created ${totalCreated}/${requestedQuantity} ${itemType}`);
        return false;
      } else {
        console.log(`🔄 QUANTITY GOAL INCOMPLETE: Need ${requestedQuantity - totalCreated} more ${itemType}`);
        return true;
      }
    }

    // COMPLEX LIFE EVENTS: Recognize major life changes that need extensive planning
    const majorLifeEvents = [
      'moving to china', 'move to china', 'relocating to', 'international move',
      'changing countries', 'emigrating', 'studying abroad', 'working abroad',
      'new job', 'career change', 'starting business', 'getting married',
      'having baby', 'buying house', 'whole year', 'entire year', 'comprehensive plan'
    ];
    
    const isMajorLifeEvent = majorLifeEvents.some(event => userIntent.includes(event));
    if (isMajorLifeEvent) {
      // For major life events, continue until we've created a substantial number of items
      let totalCreated = 0;
      functionResults.forEach(result => {
        if (result.function?.includes('bulkCreate') && result.result?.itemsCreated) {
          totalCreated += result.result.itemsCreated;
        } else if (result.function?.includes('create') && result.success) {
          totalCreated += 1;
        }
      });
      
      // Major life events should have 30+ items minimum, but be flexible with bulk attempts
      const minimumItemsForLifeEvent = 30;
      
      // Check bulk creation attempts and success patterns
      const bulkCreateAttempts = functionResults.filter(r => r.function?.includes('bulkCreate')).length;
      const successfulBulkCreates = functionResults.filter(r => 
        r.function?.includes('bulkCreate') && r.success
      ).length;
      
      // Stop if we've achieved the minimum OR made multiple good attempts
      const shouldStop = totalCreated >= minimumItemsForLifeEvent || 
                        (bulkCreateAttempts >= 2 && successfulBulkCreates >= 1 && totalCreated >= 15) ||
                        bulkCreateAttempts >= 4;
      
      if (shouldStop) {
        console.log(`🎯 MAJOR LIFE EVENT COMPLETE: Created ${totalCreated} items (${successfulBulkCreates}/${bulkCreateAttempts} successful attempts) for major life change`);
        return false;
      } else {
        console.log(`🔄 MAJOR LIFE EVENT PLANNING: Created ${totalCreated}/${minimumItemsForLifeEvent} items so far (attempt ${bulkCreateAttempts})`);
        return true;
      }
    }

    // Special analysis for complex multi-step requests
    if (userIntent.includes('full day') || userIntent.includes('schedule')) {
      const hasScheduleResult = functionResults.some(r => 
        r.function?.includes('generateFullDaySchedule') || 
        r.result?.eventsCreated > 0
      );
      if (hasScheduleResult) {
        console.log('🎯 SCHEDULE GOAL ACHIEVED: Full day schedule was generated');
        return false;
      }
    }

    // Information/question requests should stop after one good response
    const isQuestion = /^(what|how|when|why|where|who|can you|could you|would you|tell me|explain|show me|list|display)/i.test(userIntent);
    if (isQuestion && (functionResults.length > 0 || recentAIResponses.some(resp => resp.length > 100))) {
      console.log('🎯 QUESTION ANSWERED: Information request fulfilled');
      return false;
    }

    // Single action requests that are complete
    const singleActionPatterns = [
      /^(create|add|make|generate)\s+(a|an|one)\s+/i,
      /^(update|modify|change|edit)\s+/i,
      /^(delete|remove)\s+/i
    ];
    
    for (const pattern of singleActionPatterns) {
      if (pattern.test(userIntent) && functionResults.length > 0 && functionResults[0].success) {
        console.log('🎯 SINGLE ACTION COMPLETED: Simple request fulfilled');
        return false;
      }
    }

    // FAILURE DETECTION: Stop if recent functions are failing
    const recentResults = functionResults.slice(-3); // Last 3 function calls
    const recentFailures = recentResults.filter(r => !r.success).length;
    
    if (recentFailures >= 2) {
      console.log('🛑 FAILURE STOP: Too many recent failures, stopping to prevent error loops');
      return false;
    }
    
    // Error pattern detection
    const hasErrorPatterns = functionResults.some(r => 
      r.result?.message?.includes('foreign key') ||
      r.result?.message?.includes('category_id_fkey') ||
      r.result?.message?.includes('Invalid category')
    );
    
    if (hasErrorPatterns) {
      console.log('🛑 ERROR PATTERN STOP: Database errors detected, stopping agentic mode');
      return false;
    }

    // Safety: Prevent infinite loops
    if (functionResults.length >= 10) {
      console.log('⚠️ SAFETY STOP: Too many function calls, stopping to prevent infinite loops');
      return false;
    }

    // Default: continue for complex/bulk requests
    console.log('🔄 CONTINUE: Complex goal still in progress, continuing agentic mode');
    return true;
  }

  // Add message to current session
  async addMessage(role: 'user' | 'assistant' | 'system', content: string): Promise<ChatMessage> {
    let session = this.getCurrentSession();
    
    // Emergency session recovery - create session if none exists
    if (!session) {
      console.warn('⚠️ No active session found, creating emergency session');
      const emergencySession = await this.createSession('Recovery Chat');
      this.state.currentSessionId = emergencySession.id;
      session = emergencySession;
    }

    // Save message to Supabase
    try {
      const dbMessage = await SupabaseChatService.addMessage(session.id, role, content);
      if (dbMessage) {
        const messageVersion: MessageVersion = {
          id: this.generateVersionId(),
          content,
          timestamp: new Date(dbMessage.created_at || Date.now())
        };

        const message: ChatMessage = {
          id: dbMessage.id,
          role,
          versions: [messageVersion],
          currentVersionIndex: 0,
          timestamp: new Date(dbMessage.created_at || Date.now())
        };

        session.messages.push(message);
        session.updatedAt = new Date();
        this.notifyListeners();
        return message;
      }
    } catch (error) {
      console.error('Error saving message to Supabase:', error);
    }

    // Fallback to local message if Supabase fails
    const messageVersion: MessageVersion = {
      id: this.generateVersionId(),
      content,
      timestamp: new Date()
    };

    const message: ChatMessage = {
      id: this.generateMessageId(),
      role,
      versions: [messageVersion],
      currentVersionIndex: 0,
      timestamp: new Date()
    };

    session.messages.push(message);
    session.updatedAt = new Date();
    this.notifyListeners();
    return message;
  }

  // Edit a message - creates a new version
  editMessage(messageId: string, newContent: string): boolean {
    const session = this.getCurrentSession();
    if (!session) return false;

    const message = session.messages.find(m => m.id === messageId);
    if (!message) return false;

    // Create new version
    const newVersion: MessageVersion = {
      id: this.generateVersionId(),
      content: newContent,
      timestamp: new Date()
    };

    message.versions.push(newVersion);
    message.currentVersionIndex = message.versions.length - 1;
    message.isEditing = false;
    session.updatedAt = new Date();
    
    // Remove all messages after the edited one (like ChatGPT)
    const messageIndex = session.messages.findIndex(m => m.id === messageId);
    if (messageIndex !== -1) {
      session.messages = session.messages.slice(0, messageIndex + 1);
    }

    this.notifyListeners();
    return true;
  }

  // Navigate to previous version of a message
  navigateToPreviousVersion(messageId: string): boolean {
    const session = this.getCurrentSession();
    if (!session) return false;

    const message = session.messages.find(m => m.id === messageId);
    if (!message || message.currentVersionIndex <= 0) return false;

    message.currentVersionIndex--;
    this.notifyListeners();
    return true;
  }

  // Navigate to next version of a message
  navigateToNextVersion(messageId: string): boolean {
    const session = this.getCurrentSession();
    if (!session) return false;

    const message = session.messages.find(m => m.id === messageId);
    if (!message || message.currentVersionIndex >= message.versions.length - 1) return false;

    message.currentVersionIndex++;
    this.notifyListeners();
    return true;
  }

  // Get version info for a message (e.g., "2/3")
  getVersionInfo(messageId: string): { current: number; total: number } | null {
    const session = this.getCurrentSession();
    if (!session) return null;

    const message = session.messages.find(m => m.id === messageId);
    if (!message) return null;

    return {
      current: message.currentVersionIndex + 1,
      total: message.versions.length
    };
  }

  // Get current content of a message
  getCurrentMessageContent(messageId: string): string | null {
    const session = this.getCurrentSession();
    if (!session) return null;

    const message = session.messages.find(m => m.id === messageId);
    if (!message) return null;

    return message.versions[message.currentVersionIndex].content;
  }

  // Start editing a message
  startEditing(messageId: string): boolean {
    const session = this.getCurrentSession();
    if (!session) return false;

    const message = session.messages.find(m => m.id === messageId);
    if (!message) return false;

    // Stop editing all other messages first
    session.messages.forEach(m => m.isEditing = false);
    message.isEditing = true;
    this.notifyListeners();
    return true;
  }

  // Cancel editing
  cancelEditing(messageId: string): boolean {
    const session = this.getCurrentSession();
    if (!session) return false;

    const message = session.messages.find(m => m.id === messageId);
    if (!message) return false;

    message.isEditing = false;
    this.notifyListeners();
    return true;
  }

  // Delete a session
  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      // Delete from Supabase first
      await SupabaseChatService.deleteChatSession(sessionId);
    } catch (error) {
      console.error('Error deleting session from Supabase:', error);
    }

    const index = this.state.sessions.findIndex(s => s.id === sessionId);
    if (index === -1) return false;

    this.state.sessions.splice(index, 1);
    
    // Switch to another session if we deleted the current one
    if (this.state.currentSessionId === sessionId) {
      this.state.currentSessionId = this.state.sessions.length > 0 ? this.state.sessions[0].id : null;
    }

    this.notifyListeners();
    return true;
  }

  // Set processing state
  setProcessing(isProcessing: boolean): void {
    this.state.isProcessing = isProcessing;
    this.notifyListeners();
  }

  // Process Georgetown-specific commands with AI
  async processGeorgetownCommand(
    message: string, 
    currentCategoryId?: string,
    allItems?: Item[],
    allCategories?: Category[],
    isAgenticMode?: boolean,
    isAskMode?: boolean,
    userContext?: string
  ): Promise<AIResponse> {
    try {
      // Get recent items for context
      try {
        await this.aiActions.getRecentItems(10, 7);
      } catch (error) {
        console.warn('Could not fetch recent items for context:', error);
        // Use provided items as fallback - handled by allItems parameter
      }

      // Get conversation history from current session
      const currentSession = this.getCurrentSession();
      const conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];
      
      if (currentSession && currentSession.messages.length > 0) {
        console.log('📚 Building conversation history from', currentSession.messages.length, 'messages');
        
        // Convert chat messages to conversation history (skip system messages)
        for (const msg of currentSession.messages) {
          if (msg.role !== 'system') {
            const currentContent = msg.versions[msg.currentVersionIndex].content;
            conversationHistory.push({
              role: msg.role as 'user' | 'assistant',
              content: currentContent
            });
          }
        }
        
        console.log('📚 Final conversation history length:', conversationHistory.length);
        console.log('📚 Last 3 messages:', conversationHistory.slice(-3));
      }

      // Check if the current model is a Gemini model (direct API)
      const currentModel = getCurrentModel();
      console.log('🔍 ChatService: Current model from getCurrentModel():', currentModel);
      
      const isGeminiModel = currentModel.startsWith('gemini-') || currentModel.includes('gemini');
      console.log('🔍 ChatService: Is Gemini model?', isGeminiModel);
      console.log('🔍 ChatService: Model starts with gemini-?', currentModel.startsWith('gemini-'));
      console.log('🔍 ChatService: Model includes gemini?', currentModel.includes('gemini'));
      
      let result: any;
      
      // Add error handling and authentication check
      try {
        if (isGeminiModel) {
          console.log('🧠 ChatService: ✅ ROUTING TO GEMINI DIRECT API for model:', currentModel);
          console.log('📂 Categories being passed to Gemini:', Array.isArray(allCategories) ? allCategories.map(c => ({ id: c.id, name: c.name })) : 'NOT AN ARRAY:', allCategories);
          result = await geminiService.processMessage(
            message, 
            allItems || [], 
            conversationHistory,
            Array.isArray(allCategories) ? allCategories : [],
            isAgenticMode || false,
            isAskMode || false,
            userContext || ''
          );
          console.log('✅ ChatService: Gemini Direct API result:', result);
        } else {
          console.log('🧠 ChatService: ❌ ROUTING TO OPENROUTER/AIActions for model:', currentModel);
          console.log('📂 Categories being passed to AIActions:', Array.isArray(allCategories) ? allCategories.map(c => ({ id: c.id, name: c.name })) : 'NOT AN ARRAY:', allCategories);
          result = await this.aiActions.processMessage(
            message, 
            allItems || [], 
            conversationHistory,
            allCategories || [],
            isAskMode || false,
            userContext || ''
          );
          console.log('✅ ChatService: AIActions result:', result);
        }

        // If result is null or undefined, create error response
        if (!result) {
          throw new Error('AI service returned null/undefined result');
        }

      } catch (error) {
        console.error('🔥 ChatService: AI Processing Error:', error);
        result = {
          success: false,
          response: "I'm having trouble processing your request right now. Please try again in a moment.",
          functionResults: [],
          itemsModified: false
        };
      }

      // Convert AI response to legacy format for compatibility
      const response: AIResponse = {
        success: result.success !== false, // Use result's success if available
        message: result.response || result.message || 'No response from AI',
        functionResults: result.functionResults || [],
        itemsModified: result.itemsModified || false,
        pendingFunctionCall: result.pendingFunctionCall, // Pass through pending function call
        thinkingContent: result.thinkingContent // Pass through thinking content for thinking models
      };

      console.log('📤 ChatService: Final response being returned:', response);

      // If items were modified, we need to handle the item creation for UI updates
      if (result.itemsModified && result.functionResults) {
        const createItemResult = result.functionResults.find((r: any) => r.function === 'createItem');
        if (createItemResult?.result) {
          response.itemCreated = {
            type: createItemResult.result.type,
            title: createItemResult.result.title,
            categoryId: createItemResult.result.categoryId,
            item: createItemResult.result // Include full item data
          };
        }
      }

      return response;

    } catch (error) {
      console.error('❌ ChatService: Gemini API error:', error);

      return {
        success: false,
        message: "I'm having trouble processing your request right now. Please try again in a moment."
      };
    }
  }

  // Legacy parsing method (kept as fallback)
  private parseItemCreationCommand(message: string, currentCategoryId?: string): AIResponse {
    const lowerMessage = message.toLowerCase();
    
    // Extract item type
    let itemType = 'todo'; // default
    if (lowerMessage.includes('goal')) itemType = 'goal';
    else if (lowerMessage.includes('routine')) itemType = 'routine';
    else if (lowerMessage.includes('event')) itemType = 'event';
    else if (lowerMessage.includes('note')) itemType = 'note';

    // Extract the title (everything after the type keyword)
    const typeKeywords = ['add', 'create', 'todo', 'goal', 'routine', 'event', 'note'];
    let title = message;
    
    for (const keyword of typeKeywords) {
      const index = lowerMessage.indexOf(keyword);
      if (index !== -1) {
        title = message.substring(index + keyword.length).replace(/^[:\s]+/, '').trim();
        break;
      }
    }

    if (!title) {
      return {
        success: false,
        message: "I couldn't extract a clear title from your request. Try something like 'add todo: study for SAT' or 'create goal: get into Georgetown'."
      };
    }

    return {
      success: true,
      message: `Perfect! I'll add "${title}" as a ${itemType} to help with your Life Success journey.`,
      itemCreated: {
        type: itemType,
        title,
        categoryId: currentCategoryId || 'mobile-apps'
      }
    };
  }

  // Subscribe to state changes
  subscribe(listener: (state: ChatState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // Get all sessions
  getAllSessions(): ChatSession[] {
    return [...this.state.sessions];
  }

  // Get current state
  getState(): ChatState {
    return { ...this.state };
  }

  // Reset initialization flag (for testing or force re-initialization)
  resetInitialization(): void {
    this.isInitialized = false;
  }

  // Notify listeners
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.state));
  }
}

export const chatService = new ChatService(); 