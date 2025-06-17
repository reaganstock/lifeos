import { ChatMessage, ChatSession, ChatState, AIResponse, MessageVersion } from '../types/chat';
import { Item, Category } from '../types';
import { AIActions, getCurrentModel, forceResetToGemini } from '../services/aiActions';
import { geminiService } from '../services/geminiService';

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

  // Generate unique message ID
  private generateMessageId(): string {
    this.messageCounter++;
    return `msg_${Date.now()}_${this.messageCounter}_${Math.random().toString(36).substring(2, 11)}`;
  }

  // Generate unique version ID
  private generateVersionId(): string {
    return `version_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  // Load sessions from localStorage
  private loadFromStorage(): void {
    try {
      const savedSessions = localStorage.getItem(this.STORAGE_KEY);
      const savedCurrentSessionId = localStorage.getItem(this.CURRENT_SESSION_KEY);
      
      console.log('📂 ChatService: Loading from storage...');
      console.log('📂 ChatService: Found sessions data:', !!savedSessions);
      console.log('📂 ChatService: Found current session ID:', savedCurrentSessionId);
      
      if (savedSessions) {
        const parsedSessions = JSON.parse(savedSessions);
        
        // Validate sessions data structure
        if (!Array.isArray(parsedSessions)) {
          console.warn('⚠️ ChatService: Invalid sessions data structure, resetting');
          this.clearCorruptedStorage();
          return;
        }
        
        // Convert date strings back to Date objects with validation
        this.state.sessions = parsedSessions
          .filter((session: any) => {
            // Validate session structure
            return session && 
                   typeof session.id === 'string' && 
                   typeof session.title === 'string' && 
                   Array.isArray(session.messages);
          })
          .map((session: any) => ({
          ...session,
            createdAt: this.parseDate(session.createdAt) || new Date(),
            updatedAt: this.parseDate(session.updatedAt) || new Date(),
            messages: Array.isArray(session.messages) ? session.messages
              .filter((message: any) => {
                // Validate message structure
                return message && 
                       typeof message.id === 'string' && 
                       Array.isArray(message.versions);
              })
              .map((message: any) => ({
            ...message,
                timestamp: this.parseDate(message.timestamp) || new Date(),
                currentVersionIndex: Math.max(0, Math.min(message.currentVersionIndex || 0, (message.versions || []).length - 1)),
                versions: Array.isArray(message.versions) ? message.versions
                  .filter((version: any) => version && typeof version.content === 'string')
                  .map((version: any) => ({
              ...version,
                    timestamp: this.parseDate(version.timestamp) || new Date()
                  })) : []
              })) : []
        }));
        
        console.log('✅ ChatService: Loaded and validated', this.state.sessions.length, 'sessions');
        
        // Restore current session if it exists and is valid
        if (savedCurrentSessionId && this.state.sessions.find(s => s.id === savedCurrentSessionId)) {
          this.state.currentSessionId = savedCurrentSessionId;
          console.log('✅ ChatService: Restored current session:', savedCurrentSessionId);
        } else if (savedCurrentSessionId) {
          console.warn('⚠️ ChatService: Current session ID not found in sessions, will create new one');
        }
      }
    } catch (error) {
      console.error('❌ ChatService: Error loading from localStorage:', error);
      this.clearCorruptedStorage();
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

  // Save sessions to localStorage
  private saveToStorage(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.state.sessions));
      if (this.state.currentSessionId) {
        localStorage.setItem(this.CURRENT_SESSION_KEY, this.state.currentSessionId);
      }
    } catch (error) {
      console.error('Error saving chat sessions to localStorage:', error);
    }
  }

  // Initialize with a default session
  initialize(): void {
    console.log('🔄 ChatService: Initializing...');
    
    // Force reset to Gemini model to ensure we're using direct API
    forceResetToGemini();
    
    // Load existing sessions first
    this.loadFromStorage();
    
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
      const defaultSession = this.createSession('Georgetown AI Assistant');
      this.state.currentSessionId = defaultSession.id;
      this.saveToStorage();
    }
    
    console.log('✅ ChatService: Initialized with', this.state.sessions.length, 'sessions');
    console.log('✅ ChatService: Active session:', this.state.currentSessionId);
    
    this.notifyListeners();
  }

  // Create a new chat session
  createSession(title: string = 'New Chat'): ChatSession {
    const session: ChatSession = {
      id: `session_${Date.now()}`,
      title,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.state.sessions.unshift(session);
    this.saveToStorage();
    this.notifyListeners();
    return session;
  }

  // Switch to a session
  switchToSession(sessionId: string): boolean {
    const session = this.state.sessions.find(s => s.id === sessionId);
    if (session) {
      this.state.currentSessionId = sessionId;
      this.saveToStorage();
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

  // Add message to current session
  addMessage(role: 'user' | 'assistant' | 'system', content: string): ChatMessage {
    let session = this.getCurrentSession();
    
    // Emergency session recovery - create session if none exists
    if (!session) {
      console.warn('⚠️ No active session found, creating emergency session');
      const emergencySession = this.createSession('Recovery Chat');
      this.state.currentSessionId = emergencySession.id;
      session = emergencySession;
      this.saveToStorage();
    }

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
    this.saveToStorage();
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

    this.saveToStorage();
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
  deleteSession(sessionId: string): boolean {
    const index = this.state.sessions.findIndex(s => s.id === sessionId);
    if (index === -1) return false;

    this.state.sessions.splice(index, 1);
    
    // Switch to another session if we deleted the current one
    if (this.state.currentSessionId === sessionId) {
      this.state.currentSessionId = this.state.sessions.length > 0 ? this.state.sessions[0].id : null;
    }

    this.saveToStorage();
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
    allCategories?: Category[]
  ): Promise<AIResponse> {
    try {
      // Get recent items for context
      let recentItems: Item[] = [];
      try {
        recentItems = await this.aiActions.getRecentItems(10, 7);
      } catch (error) {
        console.warn('Could not fetch recent items for context:', error);
        // Use provided items as fallback
        recentItems = allItems?.slice(0, 10) || [];
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
      
      if (isGeminiModel) {
        console.log('🧠 ChatService: ✅ ROUTING TO GEMINI DIRECT API for model:', currentModel);
        result = await geminiService.processMessage(
          message, 
          allItems || [], 
          conversationHistory
        );
        console.log('✅ ChatService: Gemini Direct API result:', result);
      } else {
        console.log('🧠 ChatService: ❌ ROUTING TO OPENROUTER/AIActions for model:', currentModel);
        result = await this.aiActions.processMessage(
        message, 
        allItems || [], 
        conversationHistory
      );
        console.log('✅ ChatService: AIActions result:', result);
      }

      // Convert AI response to legacy format for compatibility
      const response: AIResponse = {
        success: true,
        message: result.response,
        functionResults: result.functionResults,
        itemsModified: result.itemsModified,
        pendingFunctionCall: result.pendingFunctionCall // Pass through pending function call
      };

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
        message: `🔧 Gemini 2.5 Flash encountered an error: ${(error as Error).message}. The direct Gemini API integration is working but needs your attention!`
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
      message: `Perfect! I'll add "${title}" as a ${itemType} to help with your Georgetown success journey.`,
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

  // Notify listeners
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.state));
  }
}

export const chatService = new ChatService(); 