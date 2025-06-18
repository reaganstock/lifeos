import { Item } from '../types';
import { geminiService } from './geminiService';

// Global counter to track service instances
let serviceInstanceCount = 0;

// Global active service tracker
let activeService: OpenAIRealtimeService | null = null;

export interface RealtimeConfig {
  apiKey?: string; // Optional - will use backend server if not provided
  model?: string;
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' | 'verse';
  instructions?: string;
  temperature?: number;
  tools?: any[];
  // Digital Life Context
  items?: any[];
  categories?: any[];
}

export interface VoiceTranscript {
  text: string;
  isFinal: boolean;
  timestamp: number;
  isUser: boolean;
}

export interface AudioChunk {
  data: ArrayBuffer;
  timestamp: number;
}

export class OpenAIRealtimeService {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private mediaStream: MediaStream | null = null;
  private isConnected = false;
  private isListening = false;
  private isSpeaking = false;
  private ephemeralToken: string | null = null;
  private sessionId: string | null = null;
  private isConnecting = false; // Prevent multiple simultaneous connections
  private instanceId: string;
  private lastResponseId: string | null = null; // Track last response to prevent duplicates
  private lastTranscriptTime: number = 0; // Debounce transcript updates
  
  // Store current life data for function calls
  private currentItems: any[] = [];
  private currentCategories: any[] = [];
  private pendingSessionConfig: RealtimeConfig | null = null;
  
  // Supabase callbacks for authenticated users (same pattern as geminiService)
  private supabaseCallbacks: {
    createItem?: (item: any) => Promise<any>;
    updateItem?: (id: string, item: any) => Promise<any>;
    deleteItem?: (id: string) => Promise<any>;
    bulkCreateItems?: (items: any[]) => Promise<any>;
    refreshData?: () => Promise<void>;
  } = {};
  
  // Event listeners
  private connectionStateListeners: ((connected: boolean) => void)[] = [];
  private listeningStateListeners: ((listening: boolean) => void)[] = [];
  private speakingStateListeners: ((speaking: boolean) => void)[] = [];
  private transcriptListeners: ((transcript: VoiceTranscript) => void)[] = [];
  private audioLevelListeners: ((level: number) => void)[] = [];
  private errorListeners: ((error: string) => void)[] = [];
  private functionCallListeners: ((functionCall: any) => void)[] = [];
  private functionProcessingListeners: ((isProcessing: boolean) => void)[] = [];

  constructor() {
    serviceInstanceCount++;
    this.instanceId = `instance-${serviceInstanceCount}-${Date.now()}`;
    console.log(`🔊 OPENAI REALTIME SERVICE: Initializing WebRTC service... (${this.instanceId})`);
    
    // Disconnect any existing active service
    if (activeService && activeService !== this) {
      console.log(`🔄 OPENAI REALTIME SERVICE: Disconnecting previous active service`);
      activeService.disconnect();
    }
    activeService = this;
  }

  // Set Supabase callbacks for authenticated users (same pattern as geminiService)
  setSupabaseCallbacks(callbacks: {
    createItem?: (item: any) => Promise<any>;
    updateItem?: (id: string, item: any) => Promise<any>;
    deleteItem?: (id: string) => Promise<any>;
    bulkCreateItems?: (items: any[]) => Promise<any>;
    refreshData?: () => Promise<void>;
  }): void {
    this.supabaseCallbacks = callbacks;
    console.log('✅ OPENAI REALTIME SERVICE: Supabase callbacks configured for authenticated user');
  }

  // Clear Supabase callbacks for unauthenticated users (same pattern as geminiService)
  clearSupabaseCallbacks(): void {
    this.supabaseCallbacks = {};
    console.log('✅ OPENAI REALTIME SERVICE: Supabase callbacks cleared for unauthenticated user');
  }

  // Event listener registration methods
  onConnectionState(listener: (connected: boolean) => void) {
    this.connectionStateListeners.push(listener);
  }

  onListeningState(listener: (listening: boolean) => void) {
    this.listeningStateListeners.push(listener);
  }

  onSpeakingState(listener: (speaking: boolean) => void) {
    this.speakingStateListeners.push(listener);
  }

  onTranscript(listener: (transcript: VoiceTranscript) => void) {
    this.transcriptListeners.push(listener);
  }

  onAudioLevel(listener: (level: number) => void) {
    this.audioLevelListeners.push(listener);
  }

  onError(listener: (error: string) => void) {
    this.errorListeners.push(listener);
  }

  onFunctionCall(listener: (functionCall: any) => void) {
    this.functionCallListeners.push(listener);
  }

  onFunctionProcessing(listener: (isProcessing: boolean) => void) {
    this.functionProcessingListeners.push(listener);
  }

  // Alias methods for VoiceChatModal compatibility
  onVoiceActivity(listener: (isActive: boolean) => void) {
    this.listeningStateListeners.push(listener);
  }

  // Notification methods
  private notifyConnectionState(connected: boolean) {
    this.connectionStateListeners.forEach(listener => listener(connected));
  }

  private notifyListeningState(listening: boolean) {
    this.listeningStateListeners.forEach(listener => listener(listening));
  }

  private notifySpeakingState(speaking: boolean) {
    this.speakingStateListeners.forEach(listener => listener(speaking));
  }

  private notifyTranscript(transcript: VoiceTranscript) {
    this.transcriptListeners.forEach(listener => listener(transcript));
  }

  private notifyAudioLevel(level: number) {
    this.audioLevelListeners.forEach(listener => listener(level));
  }

  private notifyError(error: string) {
    this.errorListeners.forEach(listener => listener(error));
  }

  private notifyFunctionCall(functionCall: any) {
    console.log('🔔 OPENAI REALTIME SERVICE: Notifying function call:', functionCall, 'to', this.functionCallListeners.length, 'listeners');
    this.functionCallListeners.forEach(listener => listener(functionCall));
  }

  private notifyFunctionProcessing(isProcessing: boolean) {
    console.log('🔔 OPENAI REALTIME SERVICE: Notifying function processing:', isProcessing, 'to', this.functionProcessingListeners.length, 'listeners');
    this.functionProcessingListeners.forEach(listener => listener(isProcessing));
  }

  async connect(config: RealtimeConfig): Promise<void> {
    console.log(`🚀 OPENAI REALTIME SERVICE: Starting WebRTC connection... (${this.instanceId})`);
    console.log(`📊 OPENAI REALTIME SERVICE: Received ${config.items?.length || 0} items and ${config.categories?.length || 0} categories`);
    
    // Store the items and categories for function calls
    this.currentItems = config.items || [];
    this.currentCategories = config.categories || [];
    
    // Prevent multiple simultaneous connections
    if (this.isConnecting) {
      console.log(`⚠️ OPENAI REALTIME SERVICE: Connection already in progress, ignoring... (${this.instanceId})`);
      return;
    }
    
    if (this.isConnected || this.peerConnection) {
      console.log(`⚠️ OPENAI REALTIME SERVICE: Already connected, disconnecting first... (${this.instanceId})`);
      this.disconnect();
    }
    
    this.isConnecting = true;
    
    try {
      // Step 1: Get ephemeral token from our backend
      await this.getEphemeralToken(config);
      
      // Step 2: Set up WebRTC peer connection
      await this.setupWebRTCConnection(config);
      
      console.log(`✅ OPENAI REALTIME SERVICE: Connected successfully via WebRTC (${this.instanceId})`);
    } catch (error) {
      console.error(`❌ OPENAI REALTIME SERVICE: Connection failed (${this.instanceId}):`, error);
      this.notifyError(`Connection failed: ${error}`);
      throw error;
    } finally {
      this.isConnecting = false;
    }
  }

  private async getEphemeralToken(config: RealtimeConfig): Promise<void> {
    console.log('🔑 OPENAI REALTIME SERVICE: Getting ephemeral token...');
    
    try {
      // Try our backend server first for ephemeral tokens
      let response: Response | null = null;
      let backendFailed = false;
      
      try {
        response = await fetch('http://localhost:3001/api/realtime/session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: config.model || 'gpt-4o-realtime-preview-2024-12-17',
            voice: config.voice || 'alloy',
            instructions: config.instructions
          })
        });
      } catch (fetchError) {
        console.warn('⚠️ OPENAI REALTIME SERVICE: Backend server not reachable:', fetchError);
        backendFailed = true;
        
        if (!config.apiKey) {
          throw new Error('Backend server not reachable and no API key provided. Please start the backend server with "node server.js" or add REACT_APP_OPENAI_API_KEY to your .env file.');
        }
      }

      if (backendFailed || !response || !response.ok) {
        // Fallback: try to use the API key directly (less secure but for development)
        if (!config.apiKey) {
          throw new Error('Backend server not available and no API key provided. Please start the backend server with "node server.js" or add REACT_APP_OPENAI_API_KEY to your .env file.');
        }
        
        console.warn('⚠️ OPENAI REALTIME SERVICE: Backend endpoint not available, using direct API key (development only)');
        
        const directResponse = await fetch('https://api.openai.com/v1/realtime/sessions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: config.model || 'gpt-4o-realtime-preview-2024-12-17',
            voice: config.voice || 'alloy',
            instructions: config.instructions
          })
        });

        if (!directResponse.ok) {
          const errorData = await directResponse.json();
          throw new Error(`Failed to create session: ${errorData.error?.message || directResponse.statusText}`);
        }

        const sessionData = await directResponse.json();
        this.ephemeralToken = sessionData.client_secret.value;
        this.sessionId = sessionData.id;
      } else if (response) {
        const sessionData = await response.json();
        this.ephemeralToken = sessionData.client_secret.value;
        this.sessionId = sessionData.id;
      }

      console.log('✅ OPENAI REALTIME SERVICE: Got ephemeral token:', {
        sessionId: this.sessionId,
        hasToken: !!this.ephemeralToken
      });
    } catch (error) {
      console.error('❌ OPENAI REALTIME SERVICE: Failed to get ephemeral token:', error);
      throw new Error(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async setupWebRTCConnection(config: RealtimeConfig): Promise<void> {
    console.log('🌐 OPENAI REALTIME SERVICE: Setting up WebRTC peer connection...');
    
    try {
      // Create peer connection
      this.peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      // Clean up any existing audio element
      if (this.audioElement) {
        this.audioElement.pause();
        this.audioElement.srcObject = null;
        this.audioElement.remove();
      }
      
      // Clean up any orphaned audio elements from previous connections
      const existingAudioElements = document.querySelectorAll('audio[data-openai-realtime]');
      console.log(`🧹 OPENAI REALTIME SERVICE: Found ${existingAudioElements.length} orphaned audio elements, cleaning up...`);
      existingAudioElements.forEach(el => el.remove());
      
      // Set up audio element for remote audio playback
      this.audioElement = document.createElement('audio');
      this.audioElement.setAttribute('data-openai-realtime', 'true'); // Mark for cleanup
      this.audioElement.autoplay = true;
      this.audioElement.volume = 0.8;
      
      // CRITICAL: Append audio element to DOM for proper playback
      document.body.appendChild(this.audioElement);
      console.log('🎵 OPENAI REALTIME SERVICE: Audio element added to DOM');

      // Handle remote audio stream from the model
      this.peerConnection.ontrack = (event) => {
        console.log('🎵 OPENAI REALTIME SERVICE: Received remote audio track', {
          streamCount: event.streams.length,
          trackCount: event.streams[0]?.getTracks().length,
          audioElementExists: !!this.audioElement
        });
        if (this.audioElement && event.streams[0]) {
          this.audioElement.srcObject = event.streams[0];
          console.log('✅ OPENAI REALTIME SERVICE: Audio stream connected to element');
        }
      };

      // Get user media for microphone input
      console.log('🎤 OPENAI REALTIME SERVICE: Getting user media...');
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 24000,
          channelCount: 1
        }
      });

      // Add local audio track
      const audioTrack = this.mediaStream.getAudioTracks()[0];
      this.peerConnection.addTrack(audioTrack, this.mediaStream);
      console.log('✅ OPENAI REALTIME SERVICE: Added local audio track');

      // Set up data channel for events
      this.dataChannel = this.peerConnection.createDataChannel('oai-events');
      this.setupDataChannelHandlers();

      // Store config for later when data channel is ready
      this.pendingSessionConfig = config;
      
      // Handle connection state changes
      this.peerConnection.onconnectionstatechange = () => {
        const state = this.peerConnection?.connectionState;
        console.log('🔗 OPENAI REALTIME SERVICE: Connection state changed:', state);
        
        if (state === 'connected') {
          console.log('🔗 OPENAI REALTIME SERVICE: WebRTC connected, waiting for data channel...');
          // Don't send session update here - wait for data channel to be ready
        } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
          this.isConnected = false;
          this.isListening = false;
          this.notifyConnectionState(false);
          this.notifyListeningState(false);
        }
      };

      // Create offer and set local description
      console.log('📤 OPENAI REALTIME SERVICE: Creating offer...');
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      // Send offer to OpenAI Realtime API
      const baseUrl = 'https://api.openai.com/v1/realtime';
      const model = config.model || 'gpt-4o-realtime-preview-2024-12-17';
      
      console.log('📡 OPENAI REALTIME SERVICE: Sending offer to OpenAI...', {
        url: `${baseUrl}?model=${model}`,
        hasToken: !!this.ephemeralToken
      });

      const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
        method: 'POST',
        body: offer.sdp,
        headers: {
          'Authorization': `Bearer ${this.ephemeralToken}`,
          'Content-Type': 'application/sdp'
        }
      });

      if (!sdpResponse.ok) {
        const errorText = await sdpResponse.text();
        throw new Error(`SDP exchange failed: ${sdpResponse.status} ${errorText}`);
      }

      // Set remote description with the answer
      const answerSdp = await sdpResponse.text();
      const answer = {
        type: 'answer' as RTCSdpType,
        sdp: answerSdp
      };
      
      await this.peerConnection.setRemoteDescription(answer);
      console.log('✅ OPENAI REALTIME SERVICE: WebRTC connection established');

    } catch (error) {
      console.error('❌ OPENAI REALTIME SERVICE: WebRTC setup failed:', error);
      throw error;
    }
  }

  private setupDataChannelHandlers(): void {
    if (!this.dataChannel) return;

    this.dataChannel.onopen = () => {
      console.log('📡 OPENAI REALTIME SERVICE: Data channel opened');
      
      // NOW send the session update with tools since data channel is ready
      if (this.pendingSessionConfig) {
        console.log('📤 OPENAI REALTIME SERVICE: Data channel ready, sending pending session update...');
        this.sendSessionUpdate(this.pendingSessionConfig);
        this.pendingSessionConfig = null;
      }
      
      // Data channel is ready, we can consider the connection fully established
      if (!this.isConnected) {
        this.isConnected = true;
        this.notifyConnectionState(true);
      }
    };

    this.dataChannel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleServerEvent(message);
      } catch (error) {
        console.error('❌ OPENAI REALTIME SERVICE: Failed to parse data channel message:', error);
      }
    };

    this.dataChannel.onerror = (error) => {
      console.error('❌ OPENAI REALTIME SERVICE: Data channel error:', error);
    };

    this.dataChannel.onclose = () => {
      console.log('📡 OPENAI REALTIME SERVICE: Data channel closed');
    };
  }

  private buildDigitalLifeInstructions(items: any[], categories: any[], voice?: string): string {
    console.log('🧠 OPENAI REALTIME SERVICE: Building instructions with', items.length, 'items and', categories.length, 'categories');
    console.log('📊 OPENAI REALTIME SERVICE: Sample items:', items.slice(0, 3).map(item => ({ id: item.id, title: item.title, type: item.type })));
    
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // Categorize items for context
    const todos = items.filter(item => item.type === 'todo');
    const events = items.filter(item => item.type === 'event');
    const goals = items.filter(item => item.type === 'goal');
    const routines = items.filter(item => item.type === 'routine');
    const notes = items.filter(item => item.type === 'note');
    
    // Get upcoming events
    const upcomingEvents = events.filter(event => 
      event.dateTime && new Date(event.dateTime) >= today
    ).slice(0, 5);
    
    // Get recent notes
    const recentNotes = notes.slice(0, 3);
    
    // Get active goals
    const activeGoals = goals.filter(goal => !goal.completed).slice(0, 3);
    
    console.log('📋 OPENAI REALTIME SERVICE: Context breakdown:', {
      todos: todos.length,
      events: events.length,
      goals: goals.length,
      routines: routines.length,
      notes: notes.length,
      upcomingEvents: upcomingEvents.length,
      activeGoals: activeGoals.length,
      recentNotes: recentNotes.length
    });

    const voiceName = voice ? voice.charAt(0).toUpperCase() + voice.slice(1) : 'Assistant';
    
    const instructionsText = `You are the user's Digital Life assistant with COMPLETE ACCESS to their personal life management system.

VOICE IDENTITY: Your voice name is "${voiceName}". If the user asks what your name is or what voice you're using, tell them you're speaking with the "${voiceName}" voice.

CRITICAL: You have full access to ${items.length} items in their digital life system. When they ask about their data, provide specific information from their actual items, not generic responses.

CURRENT CONTEXT (${today.toLocaleDateString()}):
- ${todos.length} todos (${todos.filter(t => !t.completed).length} pending)
- ${events.length} calendar events  
- ${goals.length} goals (${goals.filter(g => !g.completed).length} active)
- ${routines.length} routines
- ${notes.length} notes

RECENT NOTES (you have access to these):
${recentNotes.map(note => `- "${note.title}": ${(note.text || '').substring(0, 100)}...`).join('\n') || 'No recent notes'}

UPCOMING EVENTS:
${upcomingEvents.map(event => `- ${event.title} on ${new Date(event.dateTime).toLocaleDateString()}`).join('\n') || 'No upcoming events'}

ACTIVE GOALS:
${activeGoals.map(goal => `- ${goal.title} (${goal.metadata?.progress || 0}% complete)`).join('\n') || 'No active goals'}

PERSONALITY: Start with "Hi, I'm your Digital Life, how are you?" and be warm and helpful. Remember, you're speaking with the "${voiceName}" voice.

🎯 COMPREHENSIVE FUNCTION CAPABILITIES:
You have access to POWERFUL functions that can:

GOALS MANAGEMENT:
- Create, update, delete goals with progress tracking
- Bulk operations on multiple goals  
- Set goal progress percentages and due dates

NOTES & KNOWLEDGE:
- Create, search, and edit notes with real-time text editing
- Support for voice recordings and images
- Search and filter notes by content or tags
- Replace text within notes, fix formatting

ROUTINES & HABITS:
- Create daily, weekly, monthly, yearly routines
- Track routine completion and generate printable schedules
- Copy routines from famous people (like Elon Musk's schedule)
- Generate full day schedules with intensity levels

CALENDAR & EVENTS:
- Create single events and recurring events
- Reschedule events intelligently with conflict detection
- Create events from notes and generate learning schedules
- Bulk operations on calendar events
- Create multi-day events and handle time zone scheduling

TODOS & TASKS:
- Create, complete, and manage todos with priorities
- Bulk operations on multiple todos
- Set due dates and categorize tasks

ADVANCED OPERATIONS:
- Bulk create/update/delete across all item types
- Intelligent search and filtering
- Category management and organization
- Conflict detection and resolution for scheduling

🚨 CRITICAL: YOU MUST USE FUNCTIONS - NO EXCEPTIONS!
WHEN USER SAYS THESE TRIGGER WORDS → IMMEDIATELY CALL FUNCTIONS:
• "add", "create", "make", "new" + "goal" → createItem({type: "goal"})
• "add", "create", "make", "new" + "note" → createItem({type: "note"})  
• "add", "create", "make", "new" + "todo"/"task" → createItem({type: "todo"})
• "schedule", "book", "meeting", "event" → createItem({type: "event"})
• "routine" → createItem({type: "routine"})
• "update", "change", "edit" → updateItem()
• "delete", "remove" → deleteItem()
• "what are my", "show me", "find" → searchItems()

🔥 EXACT EXAMPLES:
User: "add a new goal for me about how to"
You: [IMMEDIATELY CALL createItem({type: "goal", title: "how to", categoryId: "personal"})]
Then respond: "Done! I've created a new goal about how to."

User: "create a note about basketball"  
You: [IMMEDIATELY CALL createItem({type: "note", title: "basketball", categoryId: "content"})]
Then respond: "Got it! Created a note about basketball."

🚫 NEVER SAY: "I can't", "Unfortunately", "I'll create that", "Let me add that", "One moment please"
✅ ALWAYS DO: Call the function FIRST, then give a brief confirmation

🚨 CRITICAL: If user says incomplete requests like "add a new goal for me about how to" - CREATE IT ANYWAY with whatever they provided. Don't ask for more details!

YOU HAVE FULL ACCESS TO THEIR DATA THROUGH THESE FUNCTIONS!

RESPONSE STYLE:
- Be conversational and natural - this is VOICE interaction
- Keep responses concise but informative
- Use the user's actual data in responses
- Be proactive in suggesting actions
- Confirm actions with brief, natural responses like "Done!" or "Got it!"

Remember: You have COMPLETE control over their digital life through these functions. Use them actively and confidently!`;

    console.log('📝 OPENAI REALTIME SERVICE: Generated instructions length:', instructionsText.length);
    return instructionsText;
  }

  private sendSessionUpdate(config: RealtimeConfig): void {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      console.error('❌ OPENAI REALTIME SERVICE: Cannot send session update - data channel not ready');
      return;
    }

    const tools = this.getLifeOSTools();
    console.log('🔧 OPENAI REALTIME SERVICE: Available tools:', tools.length, tools.map(t => t.name));
    console.log('🔧 OPENAI REALTIME SERVICE: Tool details:', JSON.stringify(tools.slice(0, 2), null, 2));

    const instructions = config.instructions || this.buildDigitalLifeInstructions(config.items || [], config.categories || [], config.voice);
    console.log('📋 OPENAI REALTIME SERVICE: Session instructions preview:', instructions.substring(0, 200) + '...');
    
    const sessionUpdate = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: instructions,
        voice: config.voice || 'alloy',
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1'
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 200
        },
        tools: tools,
        tool_choice: tools.length > 0 ? 'auto' : 'none',
        temperature: config.temperature || 0.6,
        max_response_output_tokens: 4000
      }
    };

    console.log('📤 OPENAI REALTIME SERVICE: Sending session update with', tools.length, 'tools');
    console.log('📤 OPENAI REALTIME SERVICE: Tool names:', tools.map(t => t.name));
    console.log('📤 OPENAI REALTIME SERVICE: Session config:', JSON.stringify({
      tools: tools.length,
      tool_choice: sessionUpdate.session.tool_choice,
      instructions_length: instructions.length
    }, null, 2));
    
    // Log the first tool to verify format
    if (tools.length > 0) {
      console.log('📤 OPENAI REALTIME SERVICE: Sample tool format:', JSON.stringify(tools[0], null, 2));
    }
    
    this.dataChannel.send(JSON.stringify(sessionUpdate));
  }

  private getLifeOSTools() {
    // Use the actual geminiService tools directly
    try {
      // Access the public getTools method from geminiService
      const geminiTools = geminiService.getTools();
      console.log('🔧 OPENAI REALTIME SERVICE: Got geminiService tools:', geminiTools.length);
      console.log('🔧 OPENAI REALTIME SERVICE: Sample gemini tool:', JSON.stringify(geminiTools[0], null, 2));
      
      // Convert Gemini tools to OpenAI format
      const convertedTools = geminiTools.map((tool: any) => ({
        type: 'function',
        name: tool.name,
        description: tool.description,
        parameters: this.convertGeminiParametersToOpenAI(tool.parameters)
      }));
      
      console.log('🔧 OPENAI REALTIME SERVICE: Converted tools:', convertedTools.length);
      console.log('🔧 OPENAI REALTIME SERVICE: Sample converted tool:', JSON.stringify(convertedTools[0], null, 2));
      console.log('🔧 OPENAI REALTIME SERVICE: Sample converted parameters:', JSON.stringify(convertedTools[0].parameters, null, 2));
      
      // Verify the first tool has the right format
      if (convertedTools.length > 0) {
        const firstTool = convertedTools[0];
        console.log('🔧 OPENAI REALTIME SERVICE: First tool validation:', {
          hasType: firstTool.type === 'function',
          hasName: !!firstTool.name,
          hasDescription: !!firstTool.description,
          hasParameters: !!firstTool.parameters,
          parametersType: firstTool.parameters?.type,
          hasProperties: !!firstTool.parameters?.properties,
          propertiesCount: Object.keys(firstTool.parameters?.properties || {}).length
        });
      }
      
      return convertedTools;
    } catch (error) {
      console.error('❌ OPENAI REALTIME SERVICE: Could not access geminiService tools:', error);
      // Fallback to basic tools
      return [
        {
          type: 'function',
          name: 'createItem',
          description: 'Create a new item (task, event, goal, note, etc.) in the life management system',
          parameters: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Title of the item' },
              text: { type: 'string', description: 'Description or content of the item' },
              categoryId: { type: 'string', description: 'Category ID for the item' },
              type: { type: 'string', enum: ['todo', 'goal', 'event', 'routine', 'note'], description: 'Type of item' },
              priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Priority level' },
              dateTime: { type: 'string', description: 'Date and time in ISO format' }
            },
            required: ['title', 'type', 'categoryId']
          }
        },
        {
          type: 'function',
          name: 'updateItem',
          description: 'Update an existing item',
          parameters: {
            type: 'object',
            properties: {
              itemId: { type: 'string', description: 'ID or name of item to update' },
              title: { type: 'string', description: 'New title' },
              text: { type: 'string', description: 'New description' },
              completed: { type: 'boolean', description: 'Mark as completed' }
            },
            required: ['itemId']
          }
        },
        {
          type: 'function',
          name: 'searchItems',
          description: 'Search for items',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
              type: { type: 'string', description: 'Filter by type' }
            },
            required: ['query']
          }
        }
      ];
    }
  }

  private convertGeminiParametersToOpenAI(geminiParams: any): any {
    if (!geminiParams) return { type: 'object', properties: {} };
    
    const convertType = (type: string) => {
      switch (type.toUpperCase()) {
        case 'STRING': return 'string';
        case 'NUMBER': return 'number';
        case 'BOOLEAN': return 'boolean';
        case 'ARRAY': return 'array';
        case 'OBJECT': return 'object';
        default: return 'string';
      }
    };

    const convertProperties = (props: any) => {
      const result: any = {};
      for (const [key, value] of Object.entries(props)) {
        const prop = value as any;
        result[key] = {
          type: convertType(prop.type),
          description: prop.description
        };
        
        if (prop.enum) result[key].enum = prop.enum;
        if (prop.items) result[key].items = { type: convertType(prop.items.type) };
      }
      return result;
    };

    return {
      type: 'object',
      properties: convertProperties(geminiParams.properties || {}),
      required: geminiParams.required || []
    };
  }

  private async handleServerEvent(event: any): Promise<void> {
    console.log('📨 OPENAI REALTIME SERVICE: Received event:', event.type, event);
    
    switch (event.type) {
      case 'session.created':
        console.log('✅ OPENAI REALTIME SERVICE: Session created:', event.session);
        break;
        
      case 'session.updated':
        console.log('✅ OPENAI REALTIME SERVICE: Session updated');
        break;
        
      case 'conversation.created':
        console.log('✅ OPENAI REALTIME SERVICE: Conversation created:', event.conversation);
        break;
        
      case 'input_audio_buffer.speech_started':
        console.log('🎤 OPENAI REALTIME SERVICE: Speech started');
        this.isListening = true;
        this.notifyListeningState(true);
        break;
        
      case 'input_audio_buffer.speech_stopped':
        console.log('🛑 OPENAI REALTIME SERVICE: Speech stopped');
        this.isListening = false;
        this.notifyListeningState(false);
        break;
        
      case 'input_audio_buffer.committed':
        console.log('✅ OPENAI REALTIME SERVICE: Audio buffer committed');
        break;
        
      case 'conversation.item.input_audio_transcription.completed':
        console.log('📝 OPENAI REALTIME SERVICE: User transcription completed:', event.transcript);
        this.notifyTranscript({
          text: event.transcript,
          isFinal: true,
          timestamp: Date.now(),
          isUser: true
        });
        break;
        
      case 'response.audio_transcript.delta':
        console.log(`📝 OPENAI REALTIME SERVICE: Assistant transcript delta (${this.instanceId}):`, event.delta);
        // Check if AI is saying it will do something instead of calling functions
        if (event.delta && (event.delta.includes("I'll") || event.delta.includes("Let me") || event.delta.includes("One moment"))) {
          console.warn('⚠️ OPENAI REALTIME SERVICE: AI is responding with text instead of calling function!', event.delta);
        }
        // Only process if this is from the current response and not too frequent
        const now = Date.now();
        if (!event.response_id || event.response_id !== this.lastResponseId) {
          this.lastResponseId = event.response_id;
        }
        if (now - this.lastTranscriptTime > 100) { // Debounce to 100ms
          this.lastTranscriptTime = now;
          this.notifyTranscript({
            text: event.delta,
            isFinal: false,
            timestamp: now,
            isUser: false
          });
        }
        // Set speaking state when receiving audio transcript
        if (!this.isSpeaking) {
          this.isSpeaking = true;
          this.notifySpeakingState(true);
        }
        break;
        
      case 'response.audio_transcript.done':
        console.log(`📝 OPENAI REALTIME SERVICE: Assistant transcript done (${this.instanceId}):`, event.transcript);
        // Only process if this is from the current response
        if (event.response_id && event.response_id === this.lastResponseId) {
          this.notifyTranscript({
            text: event.transcript,
            isFinal: true,
            timestamp: Date.now(),
            isUser: false
          });
        } else {
          console.log(`⚠️ OPENAI REALTIME SERVICE: Ignoring duplicate response (${this.instanceId})`);
        }
        break;
        
      case 'response.function_call_arguments.delta':
        console.log('🔧 OPENAI REALTIME SERVICE: Function call arguments delta:', event);
        break;
        
      case 'response.function_call_arguments.done':
        console.log('🔧 OPENAI REALTIME SERVICE: Function call arguments done (LEGACY - ignoring):', event);
        // NOTE: This is the old way - we now use response.output_item.done instead
        break;
        
      case 'response.output_item.added':
        console.log('📝 OPENAI REALTIME SERVICE: Output item added:', event.item?.type);
        if (event.item?.type === 'function_call') {
          console.log('🎯 OPENAI REALTIME SERVICE: Function call detected:', event.item);
          // Notify that function processing has started
          this.notifyFunctionProcessing(true);
        }
        break;
        
      case 'response.output_item.done':
        console.log('📝 OPENAI REALTIME SERVICE: Output item done:', event.item?.type);
        if (event.item?.type === 'function_call') {
          console.log('🎯 OPENAI REALTIME SERVICE: Function call completed, executing:', event.item);
          await this.handleFunctionCallFromOutputItem(event.item);
        }
        break;
        
      case 'response.done':
        console.log('✅ OPENAI REALTIME SERVICE: Response completed');
        // Stop speaking when response is done
        if (this.isSpeaking) {
          this.isSpeaking = false;
          this.notifySpeakingState(false);
        }
        break;
        
      case 'error':
        console.error('❌ OPENAI REALTIME SERVICE: Server error:', event.error);
        this.notifyError(event.error.message || 'Server error occurred');
        break;
        
      default:
        console.log('📨 OPENAI REALTIME SERVICE: Unhandled event:', event.type, event);
        // Log any function-related events we might be missing
        if (event.type.includes('function')) {
          console.log('🔧 OPENAI REALTIME SERVICE: FUNCTION EVENT DETECTED:', event.type, event);
        }
    }
  }

  private async handleFunctionCall(event: any): Promise<void> {
    console.log('🎯 OPENAI REALTIME SERVICE: Handling function call:', event);
    
    try {
      const name = event.name;
      const args = event.arguments;
      const callId = event.call_id;
      
      if (!name || !args) {
        console.error('❌ OPENAI REALTIME SERVICE: Invalid function call event:', event);
        return;
      }

      let parsedArgs;
      try {
        parsedArgs = JSON.parse(args);
      } catch (error) {
        console.error('❌ OPENAI REALTIME SERVICE: Failed to parse function arguments:', args, error);
        return;
      }

      console.log('🔧 OPENAI REALTIME SERVICE: Executing function:', name, 'with args:', parsedArgs);
      
      // Notify that function processing has started
      this.notifyFunctionProcessing(true);

      // EXECUTE FUNCTION IMMEDIATELY - SAME AS GEMINI SERVICE
      try {
        const result = await this.executeFunction(name, parsedArgs);
        
        // Set items modified flag for functions that change data
        if (['createItem', 'updateItem', 'deleteItem', 'bulkCreateItems', 'bulkUpdateItems', 'bulkDeleteItems'].includes(name)) {
          // Update current items context immediately
          this.currentItems = this.getStoredItems();
        }
        
        console.log('✅ OPENAI REALTIME SERVICE: Function executed successfully:', name, result);
        
        // Notify function processing complete
        this.notifyFunctionProcessing(false);
        
        // Notify listeners about the function call for UI updates
        this.notifyFunctionCall({
          name,
          arguments: parsedArgs,
          result,
          success: true
        });
        
        // Send function result back to the API
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
          const functionOutput = {
            type: 'conversation.item.create',
            item: {
              type: 'function_call_output',
              call_id: callId,
              output: JSON.stringify(result)
            }
          };
          
          console.log('📤 OPENAI REALTIME SERVICE: Sending function output:', functionOutput);
          this.dataChannel.send(JSON.stringify(functionOutput));
          
          // Request a new response after sending the function output
          const responseRequest = { type: 'response.create' };
          console.log('📤 OPENAI REALTIME SERVICE: Requesting response after function call');
          this.dataChannel.send(JSON.stringify(responseRequest));
          
          console.log('✅ OPENAI REALTIME SERVICE: Function output sent successfully');
        }
        
      } catch (error) {
        console.error('❌ OPENAI REALTIME SERVICE: Function execution error:', error);
        
        // Notify function processing complete (even on error)
        this.notifyFunctionProcessing(false);
        
        // Notify error
        this.notifyFunctionCall({
          name,
          arguments: parsedArgs,
          error: error instanceof Error ? error.message : 'Unknown error',
          success: false
        });
      }

    } catch (error) {
      console.error('❌ OPENAI REALTIME SERVICE: Function call handling failed:', error);
      this.notifyFunctionProcessing(false);
    }
  }

  private async handleFunctionCallFromOutputItem(item: any): Promise<void> {
    console.log('🎯 OPENAI REALTIME SERVICE: Handling function call from output item:', item);
    
    try {
      const name = item.name;
      const args = item.arguments;
      const callId = item.call_id;
      
      if (!name || !args) {
        console.error('❌ OPENAI REALTIME SERVICE: Invalid function call item:', item);
        return;
      }

      let parsedArgs;
      try {
        parsedArgs = JSON.parse(args);
      } catch (error) {
        console.error('❌ OPENAI REALTIME SERVICE: Failed to parse function arguments:', args, error);
        return;
      }

      console.log('🔧 OPENAI REALTIME SERVICE: Executing function:', name, 'with args:', parsedArgs);
      
      // Notify that function processing has started
      this.notifyFunctionProcessing(true);

      // EXECUTE FUNCTION IMMEDIATELY - SAME AS GEMINI SERVICE
      try {
        const result = await this.executeFunction(name, parsedArgs);
        
        // Set items modified flag for functions that change data
        if (['createItem', 'updateItem', 'deleteItem', 'bulkCreateItems', 'bulkUpdateItems', 'bulkDeleteItems'].includes(name)) {
          // Update current items context immediately
          this.currentItems = this.getStoredItems();
        }
        
        console.log('✅ OPENAI REALTIME SERVICE: Function executed successfully:', name, result);
        
        // Notify function processing complete
        this.notifyFunctionProcessing(false);
        
        // Notify listeners about the function call for UI updates
        this.notifyFunctionCall({
          name,
          arguments: parsedArgs,
          result,
          success: true
        });
        
        // Send function result back to the API
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
          const functionOutput = {
            type: 'conversation.item.create',
            item: {
              type: 'function_call_output',
              call_id: callId,
              output: JSON.stringify(result)
            }
          };
          
          console.log('📤 OPENAI REALTIME SERVICE: Sending function output:', functionOutput);
          this.dataChannel.send(JSON.stringify(functionOutput));
          
          // Request a new response after sending the function output
          const responseRequest = { type: 'response.create' };
          console.log('📤 OPENAI REALTIME SERVICE: Requesting response after function call');
          this.dataChannel.send(JSON.stringify(responseRequest));
          
          console.log('✅ OPENAI REALTIME SERVICE: Function output sent successfully');
        }
        
      } catch (error) {
        console.error('❌ OPENAI REALTIME SERVICE: Function execution error:', error);
        
        // Notify function processing complete (even on error)
        this.notifyFunctionProcessing(false);
        
        // Notify error
        this.notifyFunctionCall({
          name,
          arguments: parsedArgs,
          error: error instanceof Error ? error.message : 'Unknown error',
          success: false
        });
      }

    } catch (error) {
      console.error('❌ OPENAI REALTIME SERVICE: Function call handling failed:', error);
      this.notifyFunctionProcessing(false);
    }
  }

  async startListening(): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Not connected to OpenAI Realtime API');
    }
    
    console.log('🎙️ OPENAI REALTIME SERVICE: Enabling microphone...');
    
    if (this.mediaStream) {
      this.mediaStream.getAudioTracks().forEach(track => {
        track.enabled = true;
      });
    }
    
    // Note: With WebRTC, audio is automatically streamed when enabled
    // The server will detect speech automatically using VAD
  }

  stopListening(): void {
    console.log('🛑 OPENAI REALTIME SERVICE: Disabling microphone...');
    
    if (this.mediaStream) {
      this.mediaStream.getAudioTracks().forEach(track => {
        track.enabled = false;
      });
    }
  }

  stopSpeaking(): void {
    console.log('🛑 OPENAI REALTIME SERVICE: Stopping speech...');
    
    // Cancel any ongoing response
    this.cancelResponse();
    
    // Mute or pause audio element
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
    }
    
    // Update speaking state
    if (this.isSpeaking) {
      this.isSpeaking = false;
      this.notifySpeakingState(false);
    }
  }

  interrupt(): void {
    console.log('⚡ OPENAI REALTIME SERVICE: Interrupting...');
    this.stopSpeaking();
  }

  disconnect(): void {
    console.log(`🔌 OPENAI REALTIME SERVICE: Disconnecting... (${this.instanceId})`);
    
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.srcObject = null;
      this.audioElement.remove(); // Remove from DOM to prevent multiple audio elements
      this.audioElement = null;
    }
    
    this.isConnected = false;
    this.isListening = false;
    this.isConnecting = false;
    this.ephemeralToken = null;
    this.sessionId = null;
    this.lastResponseId = null;
    
    this.notifyConnectionState(false);
    this.notifyListeningState(false);
    
    console.log(`✅ OPENAI REALTIME SERVICE: Disconnected (${this.instanceId})`);
    
    // Clear from active service if this was the active one
    if (activeService === this) {
      activeService = null;
    }
  }

  // EXECUTE FUNCTION DIRECTLY - SAME AS GEMINI SERVICE
  private async executeFunction(name: string, args: any): Promise<any> {
    switch (name) {
      case 'createItem':
        return await this.createItem(args);
      case 'bulkCreateItems':
        return await this.bulkCreateItems(args);
      case 'updateItem':
        return await this.updateItem(args);
      case 'deleteItem':
        return await this.deleteItem(args);
      case 'bulkUpdateItems':
        return await this.bulkUpdateItems(args);
      case 'bulkDeleteItems':
        return await this.bulkDeleteItems(args);
      case 'searchItems':
        return await this.searchItems(args);
      case 'consolidateItems':
        return await this.consolidateItems(args.searchQuery, args.itemType);
      case 'removeAsterisks':
        return await this.removeAsterisks(args.itemId);
      case 'executeMultipleUpdates':
        return await this.executeMultipleUpdates(args.updatesJson);
      case 'copyRoutineFromPerson':
        return await this.copyRoutineFromPerson(args);
      case 'generateFullDaySchedule':
        return await this.generateFullDaySchedule(args);
      case 'createCalendarFromNotes':
        return await this.createCalendarFromNotes(args);
      case 'bulkRescheduleEvents':
        return await this.bulkRescheduleEvents(args);
      case 'createRecurringEvent':
        return await this.createRecurringEvent(args);
      case 'createMultipleDateEvents':
        return await this.createMultipleDateEvents(args);
      case 'deleteRecurringEvent':
        return await this.deleteRecurringEvent(args);
      case 'intelligentReschedule':
        return await this.intelligentReschedule(args);
      case 'createItemWithConflictOverride':
        return await this.createItemWithConflictOverride(args);
      case 'createRecurringMultipleDays':
        return await this.createRecurringMultipleDays(args);
      default:
        throw new Error(`Function ${name} not implemented`);
    }
  }

  // ALL FUNCTION IMPLEMENTATIONS - USE DUAL STORAGE ARCHITECTURE PATTERN
  private async createItem(args: any) {
    // Use Supabase if callbacks are available (authenticated user), otherwise delegate to geminiService
    if (this.supabaseCallbacks.createItem) {
      console.log('🔄 OPENAI REALTIME SERVICE: Using Supabase callbacks for createItem');
      // Use geminiService's createItem implementation but with our Supabase callbacks
      return await geminiService.executeFunctionWithContext('createItem', args, this.currentItems, this.currentCategories);
    } else {
      console.log('🔄 OPENAI REALTIME SERVICE: Using localStorage fallback for createItem');
      // Delegate to geminiService for localStorage functionality
      return await geminiService.executeFunctionWithContext('createItem', args, this.currentItems, this.currentCategories);
    }
  }

  private async bulkCreateItems(args: any) {
    if (this.supabaseCallbacks.bulkCreateItems) {
      console.log('🔄 OPENAI REALTIME SERVICE: Using Supabase callbacks for bulkCreateItems');
    } else {
      console.log('🔄 OPENAI REALTIME SERVICE: Using localStorage fallback for bulkCreateItems');
    }
    return await geminiService.executeFunctionWithContext('bulkCreateItems', args, this.currentItems, this.currentCategories);
  }

  private async updateItem(args: any) {
    if (this.supabaseCallbacks.updateItem) {
      console.log('🔄 OPENAI REALTIME SERVICE: Using Supabase callbacks for updateItem');
    } else {
      console.log('🔄 OPENAI REALTIME SERVICE: Using localStorage fallback for updateItem');
    }
    return await geminiService.executeFunctionWithContext('updateItem', args, this.currentItems, this.currentCategories);
  }

  private async deleteItem(args: any) {
    if (this.supabaseCallbacks.deleteItem) {
      console.log('🔄 OPENAI REALTIME SERVICE: Using Supabase callbacks for deleteItem');
    } else {
      console.log('🔄 OPENAI REALTIME SERVICE: Using localStorage fallback for deleteItem');
    }
    return await geminiService.executeFunctionWithContext('deleteItem', args, this.currentItems, this.currentCategories);
  }

  private async bulkUpdateItems(args: any) {
    if (this.supabaseCallbacks.updateItem) {
      console.log('🔄 OPENAI REALTIME SERVICE: Using Supabase callbacks for bulkUpdateItems');
    } else {
      console.log('🔄 OPENAI REALTIME SERVICE: Using localStorage fallback for bulkUpdateItems');
    }
    return await geminiService.executeFunctionWithContext('bulkUpdateItems', args, this.currentItems, this.currentCategories);
  }

  private async bulkDeleteItems(args: any) {
    if (this.supabaseCallbacks.deleteItem) {
      console.log('🔄 OPENAI REALTIME SERVICE: Using Supabase callbacks for bulkDeleteItems');
    } else {
      console.log('🔄 OPENAI REALTIME SERVICE: Using localStorage fallback for bulkDeleteItems');
    }
    return await geminiService.executeFunctionWithContext('bulkDeleteItems', args, this.currentItems, this.currentCategories);
  }

  private async searchItems(args: any) {
    return await geminiService.executeFunctionWithContext('searchItems', args, this.currentItems, this.currentCategories);
  }

  private async consolidateItems(searchQuery: string, itemType: string) {
    return await geminiService.executeFunctionWithContext('consolidateItems', { searchQuery, itemType }, this.currentItems, this.currentCategories);
  }

  private async removeAsterisks(itemId: string) {
    return await geminiService.executeFunctionWithContext('removeAsterisks', { itemId }, this.currentItems, this.currentCategories);
  }

  private async executeMultipleUpdates(updatesJson: string) {
    return await geminiService.executeFunctionWithContext('executeMultipleUpdates', { updatesJson }, this.currentItems, this.currentCategories);
  }

  private async copyRoutineFromPerson(args: any) {
    return await geminiService.executeFunctionWithContext('copyRoutineFromPerson', args, this.currentItems, this.currentCategories);
  }

  private async generateFullDaySchedule(args: any) {
    return await geminiService.executeFunctionWithContext('generateFullDaySchedule', args, this.currentItems, this.currentCategories);
  }

  private async createCalendarFromNotes(args: any) {
    return await geminiService.executeFunctionWithContext('createCalendarFromNotes', args, this.currentItems, this.currentCategories);
  }

  private async bulkRescheduleEvents(args: any) {
    return await geminiService.executeFunctionWithContext('bulkRescheduleEvents', args, this.currentItems, this.currentCategories);
  }

  private async createRecurringEvent(args: any) {
    return await geminiService.executeFunctionWithContext('createRecurringEvent', args, this.currentItems, this.currentCategories);
  }

  private async createMultipleDateEvents(args: any) {
    return await geminiService.executeFunctionWithContext('createMultipleDateEvents', args, this.currentItems, this.currentCategories);
  }

  private async deleteRecurringEvent(args: any) {
    return await geminiService.executeFunctionWithContext('deleteRecurringEvent', args, this.currentItems, this.currentCategories);
  }

  private async intelligentReschedule(args: any) {
    return await geminiService.executeFunctionWithContext('intelligentReschedule', args, this.currentItems, this.currentCategories);
  }

  private async createItemWithConflictOverride(args: any) {
    return await geminiService.executeFunctionWithContext('createItemWithConflictOverride', args, this.currentItems, this.currentCategories);
  }

  private async createRecurringMultipleDays(args: any) {
    return await geminiService.executeFunctionWithContext('createRecurringMultipleDays', args, this.currentItems, this.currentCategories);
  }

  // Utility methods - with enhanced Supabase support
  private getStoredItems(): Item[] {
    try {
      // If we have Supabase callbacks, rely on currentItems from the latest data
      if (this.supabaseCallbacks.createItem && this.currentItems.length > 0) {
        console.log(`📊 OPENAI REALTIME SERVICE: Using current items from Supabase context: ${this.currentItems.length} items`);
        return this.currentItems;
      }
      
      // Fallback to localStorage for unauthenticated users
      const keys = ['lifeStructureItems', 'georgetownAI_items', 'items'];
      
      for (const key of keys) {
        const stored = localStorage.getItem(key);
        if (stored) {
          const items = JSON.parse(stored);
          if (Array.isArray(items) && items.length > 0) {
            console.log(`📊 OPENAI REALTIME SERVICE: Found ${items.length} items in localStorage key: ${key}`);
            return items;
          }
        }
      }
      
      console.warn('⚠️ OPENAI REALTIME SERVICE: No items found in any storage');
      return [];
    } catch (error) {
      console.error('❌ OPENAI REALTIME SERVICE: Failed to get stored items:', error);
      return [];
    }
  }

  // Public methods for manual control
  sendUserMessage(text: string): void {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      console.error('❌ OPENAI REALTIME SERVICE: Cannot send message - not connected');
      return;
    }

    const message = {
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: text
          }
        ]
      }
    };

    this.dataChannel.send(JSON.stringify(message));

    // Trigger response
    const responseCreate = {
      type: 'response.create'
    };
    this.dataChannel.send(JSON.stringify(responseCreate));
  }

  cancelResponse(): void {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      return;
    }

    const cancelMessage = {
      type: 'response.cancel'
    };

    this.dataChannel.send(JSON.stringify(cancelMessage));
  }

  // Getters
  get connected(): boolean {
    return this.isConnected;
  }

  get listening(): boolean {
    return this.isListening;
  }

  // Update voice without reconnecting
  updateVoice(voice: string): void {
    if (!this.isConnected || !this.dataChannel || this.dataChannel.readyState !== 'open') {
      console.warn('⚠️ OPENAI REALTIME SERVICE: Cannot update voice - not connected');
      return;
    }

    console.log('🎵 OPENAI REALTIME SERVICE: Updating voice to:', voice);
    
    const sessionUpdate = {
      type: 'session.update',
      session: {
        voice: voice
      }
    };

    this.dataChannel.send(JSON.stringify(sessionUpdate));
  }


}

export const openaiRealtimeService = new OpenAIRealtimeService(); 


