// Gemini Live API Service - Official Implementation
// Based on: https://ai.google.dev/gemini-api/docs/live

import { GoogleGenAI, Modality, type Session, type LiveServerMessage } from '@google/genai';
import type { Blob as GenAIBlob } from '@google/genai';
import { geminiService } from './geminiService';
import { Item, Category } from '../types';

export interface GeminiLiveConfig {
  apiKey: string;
  model?: string;
  voice?: string;
  items?: Item[];
  categories?: Category[];
  onRefreshItems?: () => void;
}

export interface AudioData {
  data: string; // Base64 encoded audio
  mimeType: string;
}

export interface RealtimeInput {
  audio?: AudioData;
  text?: string;
}

export interface SetupMessage {
  setup: {
    model: string;
    generationConfig?: {
      responseModalities?: string[];
      speechConfig?: {
        voiceConfig?: {
          prebuiltVoiceConfig?: {
            voiceName?: string;
          };
        };
      };
    };
    systemInstruction?: {
      parts: Array<{ text: string }>;
    };
    tools?: any[];
  };
}

export interface VoiceTranscript {
  text: string;
  isFinal: boolean;
  timestamp: number;
  isUser: boolean;
}

export interface ServerMessage {
  setupComplete?: any;
  serverContent?: {
    modelTurn?: {
      parts: Array<{
        text?: string;
        inlineData?: {
          mimeType: string;
          data: string;
        };
      }>;
    };
    turnComplete?: boolean;
    interrupted?: boolean;
  };
  toolCall?: any;
  usageMetadata?: any;
}

// Helper functions for audio processing
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  try {
    console.log('🔄 base64ToArrayBuffer: Converting base64 of length:', base64.length);
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    console.log('🔄 base64ToArrayBuffer: Converted to ArrayBuffer of size:', bytes.buffer.byteLength);
    return bytes.buffer;
  } catch (error) {
    console.error('❌ base64ToArrayBuffer: Failed to decode base64:', error);
    throw error;
  }
}

export class GeminiLiveService {
  private client: GoogleGenAI | null = null;
  private session: Session | null = null;
  private isConnected = false;
  private isListening = false;
  private isSpeaking = false;
  private isSetupComplete = false;
  private currentItems: Item[] = [];
  private currentCategories: Category[] = [];
  private onRefreshItems?: () => void;
  
  // Rate limiting for function calls to prevent runaway execution
  private functionCallHistory: number[] = [];
  private readonly MAX_FUNCTION_CALLS_PER_MINUTE = 10;
  private lastFunctionCallTime = 0;
  private readonly MIN_FUNCTION_CALL_INTERVAL = 2000; // 2 seconds between calls
  private supabaseCallbacks: {
    createItem?: (item: any) => Promise<any>;
    updateItem?: (id: string, item: any) => Promise<any>;
    deleteItem?: (id: string) => Promise<any>;
    bulkCreateItems?: (items: any[]) => Promise<any>;
    refreshData?: () => Promise<void>;
  } = {};

  // Set Supabase callbacks for authenticated users
  setSupabaseCallbacks(callbacks: {
    createItem?: (item: any) => Promise<any>;
    updateItem?: (id: string, item: any) => Promise<any>;
    deleteItem?: (id: string) => Promise<any>;
    bulkCreateItems?: (items: any[]) => Promise<any>;
    refreshData?: () => Promise<void>;
  }): void {
    this.supabaseCallbacks = callbacks;
    // Forward callbacks to geminiService so it can use them when we delegate functions
    geminiService.setSupabaseCallbacks(callbacks);
    console.log('✅ GEMINI LIVE SERVICE: Supabase callbacks configured for authenticated user and forwarded to geminiService');
  }

  // Clear Supabase callbacks for unauthenticated users
  clearSupabaseCallbacks(): void {
    this.supabaseCallbacks = {};
    // Clear callbacks from geminiService as well
    geminiService.clearSupabaseCallbacks();
    console.log('✅ GEMINI LIVE SERVICE: Supabase callbacks cleared for unauthenticated user and from geminiService');
  }

  // CRITICAL FIX: Update context with current items and categories
  updateContext(items: Item[], categories: Category[]): void {
    console.log('🔄 GEMINI LIVE SERVICE: Updating context with', items.length, 'items and', categories.length, 'categories');
    this.currentItems = items;
    this.currentCategories = categories;
    
    // Forward to geminiService since we delegate function calls to it
    geminiService.processMessage('', items, []); // This updates geminiService's currentItems
    
    console.log('✅ GEMINI LIVE SERVICE: Context updated successfully');
  }
  
  // Add helper method to get stored items (same as other services)
  // EXECUTE FUNCTION DIRECTLY - SAME AS GEMINI SERVICE
  private async executeFunction(name: string, args: any): Promise<any> {
    console.log('🚀🚀🚀 GEMINI LIVE SERVICE: executeFunction called with:', { name, args });
    console.log('🚀🚀🚀 GEMINI LIVE SERVICE: Current items count before execution:', this.currentItems.length);
    console.log('🚀🚀🚀 GEMINI LIVE SERVICE: Current categories count:', this.currentCategories.length);
    console.log('🚀🚀🚀 GEMINI LIVE SERVICE: Args validation:', {
      argsType: typeof args,
      argsKeys: args ? Object.keys(args) : [],
      hasArgs: !!args
    });
    
    // Validate function exists
    const validFunctions = [
      'createItem', 'bulkCreateItems', 'updateItem', 'deleteItem', 
      'bulkUpdateItems', 'bulkDeleteItems', 'searchItems', 'consolidateItems',
      'removeAsterisks', 'executeMultipleUpdates', 'copyRoutineFromPerson',
      'generateFullDaySchedule', 'createCalendarFromNotes', 'bulkRescheduleEvents',
      'createRecurringEvent', 'createMultipleDateEvents', 'deleteRecurringEvent',
      'intelligentReschedule', 'createItemWithConflictOverride', 'createRecurringMultipleDays'
    ];
    
    if (!validFunctions.includes(name)) {
      console.error('❌ GEMINI LIVE SERVICE: Invalid function name:', name);
      throw new Error(`Function ${name} is not valid. Valid functions: ${validFunctions.join(', ')}`);
    }
    
    try {
      let result;
      switch (name) {
        case 'createItem':
          console.log('📝 GEMINI LIVE SERVICE: Executing createItem with args:', args);
          console.log('📝 GEMINI LIVE SERVICE: createItem validation - has title:', !!args?.title, 'has type:', !!args?.type);
          if (!args?.title || !args?.type) {
            throw new Error('createItem requires title and type arguments');
          }
          result = await this.createItem(args);
          break;
        case 'bulkCreateItems':
          console.log('📝 GEMINI LIVE SERVICE: Executing bulkCreateItems with args:', args);
          result = await this.bulkCreateItems(args);
          break;
        case 'updateItem':
          console.log('✏️ GEMINI LIVE SERVICE: Executing updateItem with args:', args);
          console.log('✏️ GEMINI LIVE SERVICE: updateItem validation - has itemId:', !!args?.itemId);
          if (!args?.itemId) {
            throw new Error('updateItem requires itemId argument');
          }
          result = await this.updateItem(args);
          break;
        case 'deleteItem':
          console.log('🗑️ GEMINI LIVE SERVICE: Executing deleteItem with args:', args);
          console.log('🗑️ GEMINI LIVE SERVICE: deleteItem validation - has itemId:', !!args?.itemId);
          if (!args?.itemId) {
            throw new Error('deleteItem requires itemId argument');
          }
          result = await this.deleteItem(args);
          break;
        case 'bulkUpdateItems':
          console.log('✏️ GEMINI LIVE SERVICE: Executing bulkUpdateItems with args:', args);
          result = await this.bulkUpdateItems(args);
          break;
        case 'bulkDeleteItems':
          console.log('🗑️ GEMINI LIVE SERVICE: Executing bulkDeleteItems with args:', args);
          result = await this.bulkDeleteItems(args);
          break;
        case 'searchItems':
          console.log('🔍 GEMINI LIVE SERVICE: Executing searchItems with args:', args);
          result = await this.searchItems(args);
          break;
        case 'consolidateItems':
          console.log('🔗 GEMINI LIVE SERVICE: Executing consolidateItems with args:', args);
          result = await this.consolidateItems(args.searchQuery, args.itemType);
          break;
        case 'removeAsterisks':
          console.log('✨ GEMINI LIVE SERVICE: Executing removeAsterisks with args:', args);
          result = await this.removeAsterisks(args.itemId);
          break;
        case 'executeMultipleUpdates':
          console.log('📋 GEMINI LIVE SERVICE: Executing executeMultipleUpdates with args:', args);
          result = await this.executeMultipleUpdates(args.updatesJson);
          break;
        case 'copyRoutineFromPerson':
          console.log('👤 GEMINI LIVE SERVICE: Executing copyRoutineFromPerson with args:', args);
          result = await this.copyRoutineFromPerson(args);
          break;
        case 'generateFullDaySchedule':
          console.log('📅 GEMINI LIVE SERVICE: Executing generateFullDaySchedule with args:', args);
          result = await this.generateFullDaySchedule(args);
          break;
        case 'createCalendarFromNotes':
          console.log('📓 GEMINI LIVE SERVICE: Executing createCalendarFromNotes with args:', args);
          result = await this.createCalendarFromNotes(args);
          break;
        case 'bulkRescheduleEvents':
          console.log('📆 GEMINI LIVE SERVICE: Executing bulkRescheduleEvents with args:', args);
          result = await this.bulkRescheduleEvents(args);
          break;
        case 'createRecurringEvent':
          console.log('🔄 GEMINI LIVE SERVICE: Executing createRecurringEvent with args:', args);
          result = await this.createRecurringEvent(args);
          break;
        case 'createMultipleDateEvents':
          console.log('📅 GEMINI LIVE SERVICE: Executing createMultipleDateEvents with args:', args);
          result = await this.createMultipleDateEvents(args);
          break;
        case 'deleteRecurringEvent':
          console.log('🗑️ GEMINI LIVE SERVICE: Executing deleteRecurringEvent with args:', args);
          result = await this.deleteRecurringEvent(args);
          break;
        case 'intelligentReschedule':
          console.log('🧠 GEMINI LIVE SERVICE: Executing intelligentReschedule with args:', args);
          result = await this.intelligentReschedule(args);
          break;
        case 'createItemWithConflictOverride':
          console.log('⚠️ GEMINI LIVE SERVICE: Executing createItemWithConflictOverride with args:', args);
          result = await this.createItemWithConflictOverride(args);
          break;
        case 'createRecurringMultipleDays':
          console.log('🔄 GEMINI LIVE SERVICE: Executing createRecurringMultipleDays with args:', args);
          result = await this.createRecurringMultipleDays(args);
          break;
        default:
          console.error('❌ GEMINI LIVE SERVICE: Unknown function name:', name);
          throw new Error(`Function ${name} not implemented`);
      }
      
      console.log('✅✅✅ GEMINI LIVE SERVICE: Function executed successfully:', { name, result });
      console.log('✅✅✅ GEMINI LIVE SERVICE: Current items count after execution:', this.currentItems.length);
      
      return result;
    } catch (error) {
      console.error('❌❌❌ GEMINI LIVE SERVICE: Function execution failed:', { name, args, error });
      throw error;
    }
  }

  // ALL FUNCTION IMPLEMENTATIONS - IDENTICAL TO GEMINI SERVICE
  private async createItem(args: any) {
    // Use geminiService's createItem implementation
    return await geminiService.executeFunctionWithContext('createItem', args, this.currentItems, this.currentCategories);
  }

  private async bulkCreateItems(args: any) {
    return await geminiService.executeFunctionWithContext('bulkCreateItems', args, this.currentItems, this.currentCategories);
  }

  private async updateItem(args: any) {
    console.log('✏️🔄 GEMINI LIVE SERVICE: updateItem delegating to geminiService with context:', {
      argsReceived: args,
      currentItemsCount: this.currentItems.length,
      currentCategoriesCount: this.currentCategories.length,
      sampleItems: this.currentItems.slice(0, 3).map(item => ({ id: item.id, title: item.title, type: item.type }))
    });
    
    try {
      const result = await geminiService.executeFunctionWithContext('updateItem', args, this.currentItems, this.currentCategories);
      
      console.log('✏️✅ GEMINI LIVE SERVICE: updateItem result from geminiService:', result);
      console.log('✏️✅ GEMINI LIVE SERVICE: updateItem success status:', result?.success);
      
      return result;
    } catch (error) {
      console.error('✏️❌ GEMINI LIVE SERVICE: updateItem failed with error:', error);
      throw error;
    }
  }

  private async deleteItem(args: any) {
    console.log('🗑️🔄 GEMINI LIVE SERVICE: deleteItem delegating to geminiService with context:', {
      argsReceived: args,
      currentItemsCount: this.currentItems.length,
      currentCategoriesCount: this.currentCategories.length
    });
    
    const result = await geminiService.executeFunctionWithContext('deleteItem', args, this.currentItems, this.currentCategories);
    
    console.log('🗑️✅ GEMINI LIVE SERVICE: deleteItem result from geminiService:', result);
    return result;
  }

  private async bulkUpdateItems(args: any) {
    return await geminiService.executeFunctionWithContext('bulkUpdateItems', args, this.currentItems, this.currentCategories);
  }

  private async bulkDeleteItems(args: any) {
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

  private getStoredItems(): Item[] {
    try {
      const savedItems = localStorage.getItem('lifeStructureItems');
      console.log('📊 GEMINI LIVE SERVICE: getStoredItems - localStorage key exists:', !!savedItems);
      if (!savedItems) {
        console.log('📊 GEMINI LIVE SERVICE: No saved items found in localStorage');
        return [];
      }
      
      const parsedItems = JSON.parse(savedItems);
      console.log('📊 GEMINI LIVE SERVICE: Parsed', parsedItems.length, 'items from localStorage');
      console.log('📊 GEMINI LIVE SERVICE: Sample items:', parsedItems.slice(0, 3).map((item: any) => ({ id: item.id, title: item.title, type: item.type })));
      
      const processedItems = parsedItems.map((item: any) => ({
        ...item,
        createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
        updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
        dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
        dateTime: item.dateTime ? new Date(item.dateTime) : undefined
      }));
      
      console.log('📊 GEMINI LIVE SERVICE: Returning', processedItems.length, 'processed items');
      return processedItems;
    } catch (error) {
      console.error('❌ GEMINI LIVE SERVICE: Error loading items from localStorage:', error);
      return [];
    }
  }
  
  // Audio system
  private audioContext: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private micSourceNode: MediaStreamAudioSourceNode | null = null;
  private audioWorkletNode: AudioWorkletNode | null = null;
  private audioQueue: Int16Array[] = [];
  private isPlaying = false;
  private nextPlayTime = 0; // Time-based scheduling for seamless playback
  
  // Constants
  private readonly TARGET_SAMPLE_RATE = 16000; // Gemini expects 16kHz PCM
  private readonly WORKLET_BUFFER_SIZE = 4096;
  private readonly PLAYBACK_SAMPLE_RATE = 24000; // Output is 24kHz as per documentation
  
  // Event listeners
  private connectionStateListeners: ((connected: boolean) => void)[] = [];
  private listeningStateListeners: ((listening: boolean) => void)[] = [];
  private speakingStateListeners: ((speaking: boolean) => void)[] = [];
  private transcriptListeners: ((transcript: VoiceTranscript) => void)[] = [];
  private audioLevelListeners: ((level: number) => void)[] = [];
  private errorListeners: ((error: string) => void)[] = [];
  private functionCallListeners: ((functionCall: any) => void)[] = [];

  constructor() {
    console.log('🎤 GEMINI LIVE SERVICE: Initializing...');
    this.handleMessage = this.handleMessage.bind(this);
  }

  // Event listener registration
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

  // Event notification methods
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
    this.functionCallListeners.forEach(listener => listener(functionCall));
  }

  async connect(config: GeminiLiveConfig): Promise<void> {
    try {
      console.log('🚀 GEMINI LIVE SERVICE: Connecting with config:', {
        hasApiKey: !!config.apiKey,
        model: config.model || 'gemini-2.0-flash-live-001',
        itemsCount: config.items?.length || 0,
        categoriesCount: config.categories?.length || 0
      });
      
      console.log('🔑 GEMINI LIVE SERVICE: API Key preview:', config.apiKey?.substring(0, 20) + '...');

      // Store context
      this.currentItems = config.items || [];
      this.currentCategories = config.categories || [];
      this.onRefreshItems = config.onRefreshItems;

      // Initialize the GoogleGenAI client
      this.client = new GoogleGenAI({
        apiKey: config.apiKey,
        apiVersion: 'v1beta'  // Changed from v1alpha to v1beta
      });

      // Build system instructions with life data context
      const systemInstructions = this.buildLifeInstructions(config.voice);
      console.log('📋 GEMINI LIVE SERVICE: System instructions preview:', systemInstructions.substring(0, 200) + '...');

      // Reset state
      this.isSetupComplete = false;
      this.isConnected = false;

      // Get tools for the session - CRITICAL: Enable function calling
      const tools = this.getGeminiTools();
      console.log('🔧🔧🔧 GEMINI LIVE SERVICE: Available tools:', tools.length, 'tool sets');
      console.log('🔧🔧🔧 GEMINI LIVE SERVICE: First few tools:', tools[0]?.functionDeclarations?.slice(0, 3).map(t => t.name) || []);
      console.log('🔧🔧🔧 GEMINI LIVE SERVICE: ALL TOOLS:', tools[0]?.functionDeclarations?.map(t => t.name) || []);
      console.log('🔧🔧🔧 GEMINI LIVE SERVICE: Tools structure sample:', JSON.stringify(tools[0]?.functionDeclarations?.[0], null, 2) || 'No tools');

      // Use the speech_config object as per user's latest instruction
      const sessionConfig: any = {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: config.voice || 'Kore' // Set voice via speech_config
            }
          }
        },
        // CRITICAL: Add system instructions and tools
        systemInstruction: {
          parts: [{ text: systemInstructions }]
        },
        tools: tools // Enable function calling
      };
      
      console.log('🎵 GEMINI LIVE SERVICE: Using voice:', config.voice || 'Kore');
      
      // Create the session - use the model from working example
      const modelName = config.model || 'gemini-2.5-flash-preview-native-audio-dialog';
      console.log('🚀🚀🚀 GEMINI LIVE SERVICE: Connecting with model:', modelName);
      console.log('📋📋📋 GEMINI LIVE SERVICE: Session config (FULL):', JSON.stringify(sessionConfig, null, 2));
      console.log('🔧🔧🔧 GEMINI LIVE SERVICE: Tools count in session config:', sessionConfig.tools?.length || 0);
      console.log('🔧🔧🔧 GEMINI LIVE SERVICE: Function declarations count:', sessionConfig.tools?.[0]?.functionDeclarations?.length || 0);
      
      try {
        this.session = await this.client.live.connect({
          model: modelName,
          config: sessionConfig,
          callbacks: {
          onopen: () => {
            console.log('✅ GEMINI LIVE SERVICE: WebSocket connected');
            this.isConnected = true;
            this.notifyConnectionState(true);
          },
          onmessage: (message: LiveServerMessage) => {
            this.handleServerMessage(message);
          },
          onerror: (error: ErrorEvent) => {
            console.error('❌ GEMINI LIVE SERVICE: WebSocket error:', error);
            this.notifyError(`WebSocket error: ${error.message}`);
            this.cleanupAfterError();
          },
          onclose: (event: CloseEvent) => {
            console.log('🔌 GEMINI LIVE SERVICE: WebSocket closed:', event.code, event.reason);
            this.isConnected = false;
            this.isSetupComplete = false;
            this.notifyConnectionState(false);
            this.cleanupAfterError();
          }
        }
      });
      
        console.log('✅ GEMINI LIVE SERVICE: Connected successfully');
        
        // Initialize audio system proactively
        console.log('🔊 GEMINI LIVE SERVICE: Initializing audio system proactively...');
        try {
          await this.initializeAudioSystem();
          console.log('✅ GEMINI LIVE SERVICE: Audio system initialized');
        } catch (audioError) {
          console.warn('⚠️ GEMINI LIVE SERVICE: Failed to initialize audio system proactively:', audioError);
        }
      } catch (connectError) {
        console.error('❌ GEMINI LIVE SERVICE: Failed to connect to live API:', connectError);
        this.notifyError(`Failed to connect: ${connectError}`);
        throw connectError;
      }

    } catch (error) {
      console.error('❌ GEMINI LIVE SERVICE: Connection failed:', error);
      this.notifyError(`Connection failed: ${error}`);
      throw error;
    }
  }

  private handleServerMessage(message: LiveServerMessage) {
    // COMPREHENSIVE DEBUG LOGGING FOR FUNCTION CALLS
    console.log('📨📨📨 GEMINI LIVE SERVICE: =======MESSAGE HANDLER START=======');
    console.log('📨📨📨 GEMINI LIVE SERVICE: Raw message structure keys:', Object.keys(message));
    console.log('📨📨📨 GEMINI LIVE SERVICE: Full message JSON:', JSON.stringify(message, null, 2));
    
    // Log message type for debugging
    const messageTypes = [];
    if (message.setupComplete) messageTypes.push('setupComplete');
    if (message.serverContent) messageTypes.push('serverContent');
    if (message.toolCall) messageTypes.push('toolCall');
    if ((message as any).toolCalls) messageTypes.push('toolCalls');
    if ((message as any).tool_call) messageTypes.push('tool_call');
    if ((message as any).functionCall) messageTypes.push('functionCall');
    if ((message as any).functionCalls) messageTypes.push('functionCalls');
    console.log('📨📨📨 GEMINI LIVE SERVICE: Detected message types:', messageTypes);
    
    // Check if this is a function call related message
    const hasFunctionCalls = messageTypes.some(type => type.includes('tool') || type.includes('function'));
    if (hasFunctionCalls) {
      console.log('🎯🎯🎯 GEMINI LIVE SERVICE: FUNCTION CALL DETECTED IN MESSAGE!');
    } else {
      console.log('📝 GEMINI LIVE SERVICE: Regular message (no function calls detected)');
    }

    // Handle setup complete - this is critical for the connection to be ready
    if (message.setupComplete) {
      console.log('🎯 GEMINI LIVE SERVICE: Setup complete - connection is now ready');
      this.isSetupComplete = true;
      
      // Now we can start listening if we haven't already
      if (!this.isListening) {
        console.log('🎤 GEMINI LIVE SERVICE: Starting to listen after setup complete');
        this.startListening().catch(error => {
          console.error('❌ GEMINI LIVE SERVICE: Failed to start listening after setup:', error);
          this.notifyError(`Failed to start listening: ${error}`);
        });
      }
    }

    // Handle server content (text and audio responses)
    if (message.serverContent) {
      const { modelTurn, turnComplete, interrupted } = message.serverContent;

      if (modelTurn?.parts) {
        for (const part of modelTurn.parts) {
          // Handle text response
          if (part.text) {
            console.log('💬 GEMINI LIVE SERVICE: Received text:', part.text);
            this.notifyTranscript({
              text: part.text,
              isFinal: !!turnComplete,
              timestamp: Date.now(),
              isUser: false
            });
          }

          // Handle audio response - matching the working example format
          if (part.inlineData?.data && typeof part.inlineData.data === 'string') {
            console.log('🔊 GEMINI LIVE SERVICE: Received audio data', {
              mimeType: part.inlineData.mimeType || 'unknown',
              dataLength: part.inlineData.data.length,
              dataType: typeof part.inlineData.data
            });
            
            // Set speaking state when receiving audio
            if (!this.isSpeaking) {
              this.isSpeaking = true;
              this.notifySpeakingState(true);
            }
            
            try {
              // Decode base64 audio data
              const audioBuffer = base64ToArrayBuffer(part.inlineData.data);
              console.log('🎵 GEMINI LIVE SERVICE: Decoded audio buffer size:', audioBuffer.byteLength, 'bytes');
              
              if (audioBuffer.byteLength === 0) {
                console.error('❌ GEMINI LIVE SERVICE: Decoded audio buffer is empty');
                continue;
              }
              
              this.enqueueAudio(audioBuffer);
            } catch (error) {
              console.error('❌ GEMINI LIVE SERVICE: Failed to decode audio:', error);
            }
          } else if (part.inlineData?.data) {
            console.warn('❌ GEMINI LIVE SERVICE: Received inlineData.data that is not a string. Type:', typeof part.inlineData.data);
          }
        }
      }

      if (interrupted) {
        console.log('⏸️ GEMINI LIVE SERVICE: Model was interrupted');
      }
      
      // Stop speaking when turn is complete
      if (message.serverContent?.turnComplete && this.isSpeaking) {
        // Add a small delay to ensure audio finishes playing
        setTimeout(() => {
          if (this.isSpeaking) {
            this.isSpeaking = false;
            this.notifySpeakingState(false);
          }
        }, 500);
      }
    }

    // Handle tool calls - CHECK ALL POSSIBLE FORMATS WITH DETAILED LOGGING
    console.log('🔍🔍🔍 GEMINI LIVE SERVICE: Checking for function calls in message...');
    console.log('🔍🔍🔍 GEMINI LIVE SERVICE: message.toolCall exists:', !!message.toolCall);
    console.log('🔍🔍🔍 GEMINI LIVE SERVICE: message.toolCalls exists:', !!(message as any).toolCalls);
    console.log('🔍🔍🔍 GEMINI LIVE SERVICE: message.tool_call exists:', !!(message as any).tool_call);
    console.log('🔍🔍🔍 GEMINI LIVE SERVICE: message.functionCall exists:', !!(message as any).functionCall);
    console.log('🔍🔍🔍 GEMINI LIVE SERVICE: message.functionCalls exists:', !!(message as any).functionCalls);
    
    if (message.toolCall || (message as any).toolCalls || (message as any).tool_call || (message as any).functionCall || (message as any).functionCalls) {
      const toolCallData = message.toolCall || (message as any).toolCalls || (message as any).tool_call || (message as any).functionCall || (message as any).functionCalls;
      console.log('🎯🎯🎯 GEMINI LIVE SERVICE: FOUND FUNCTION CALL AT TOP LEVEL!');
      console.log('🔧🔧🔧 GEMINI LIVE SERVICE: Tool call data:', toolCallData);
      console.log('🔧🔧🔧 GEMINI LIVE SERVICE: Tool call data keys:', Object.keys(toolCallData || {}));
      this.handleFunctionCall(toolCallData);
    } else {
      console.log('❌ GEMINI LIVE SERVICE: No function calls found at top level');
    }
    
    // ALSO CHECK INSIDE SERVER CONTENT FOR FUNCTION CALLS WITH DETAILED LOGGING
    console.log('🔍🔍🔍 GEMINI LIVE SERVICE: Checking serverContent for function calls...');
    if (message.serverContent && message.serverContent.modelTurn) {
      const modelTurn = message.serverContent.modelTurn;
      console.log('🔍🔍🔍 GEMINI LIVE SERVICE: modelTurn exists, parts count:', modelTurn.parts?.length || 0);
      
      if (modelTurn.parts) {
        for (let i = 0; i < modelTurn.parts.length; i++) {
          const part = modelTurn.parts[i];
          console.log(`🔍🔍🔍 GEMINI LIVE SERVICE: Checking part ${i}:`, Object.keys(part));
          console.log(`🔍🔍🔍 GEMINI LIVE SERVICE: Part ${i} functionCall exists:`, !!(part as any).functionCall);
          console.log(`🔍🔍🔍 GEMINI LIVE SERVICE: Part ${i} toolCall exists:`, !!(part as any).toolCall);
          
          // Check if this part contains function calls
          if ((part as any).functionCall || (part as any).toolCall) {
            const functionCallData = (part as any).functionCall || (part as any).toolCall;
            console.log('🎯🎯🎯 GEMINI LIVE SERVICE: FOUND FUNCTION CALL IN SERVER CONTENT!');
            console.log('🎯🎯🎯 GEMINI LIVE SERVICE: Function call data:', functionCallData);
            this.handleFunctionCall({ functionCalls: [functionCallData] });
          }
        }
      }
    } else {
      console.log('❌ GEMINI LIVE SERVICE: No serverContent or modelTurn found');
    }
  }

  private buildLifeInstructions(voice?: string): string {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const nextWeekStr = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    // Get existing events for conflict detection
    const existingEvents = this.currentItems.filter(item => item.type === 'event');
    const upcomingEvents = existingEvents.filter(event => 
      event.dateTime && new Date(event.dateTime) >= today
    ).slice(0, 10); // Show next 10 events for context

    const voiceName = voice ? voice.charAt(0).toUpperCase() + voice.slice(1) : 'Assistant';
    
    return `You are an AI assistant for lifeOS, a comprehensive life management system. 

CURRENT DATE/TIME CONTEXT - CRITICAL:
Today is: ${today.toLocaleDateString()} (${today.toISOString().split('T')[0]})
Current time: ${today.toLocaleString()}
When user says "today" or "TODAY", use: ${todayStr}
When user says "tomorrow", use: ${new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]}

CRITICAL CONFLICT DETECTION:
Before creating ANY appointment or event, you MUST check for existing events at the same time/date.
Current upcoming events:
${upcomingEvents.map(event => `- ${event.title} on ${event.dateTime ? new Date(event.dateTime).toLocaleDateString() : 'unknown date'} at ${event.dateTime ? new Date(event.dateTime).toLocaleTimeString() : 'unknown time'}`).join('\n')}

If user requests an appointment that conflicts with existing events, you MUST:
1. Alert them about the conflict
2. Suggest alternative times
3. Ask for confirmation before creating

ENHANCED ALL-DAY EVENT DETECTION:
Detect all-day events from these patterns:
- "all day" or "all-day" in title/description
- "conference" without specific time
- "festival", "fair", "retreat" 
- Events that span entire days by nature
- When user says "schedule for the whole day"

For all-day events:
- Set dateTime to start of day (00:00:00)
- Set startTime to 00:00:00
- Set endTime to 23:59:59
- Add metadata: { isAllDay: true }

SMART CATEGORY MAPPING - CRITICAL:
Map user categories to closest existing category:
- "dating" → "social-charisma" (closest match for social/relationship activities)
- "fitness" → "gym-calisthenics" 
- "work" → "mobile-apps" (if tech context) or "content"
- "personal" → "self-regulation"
- "education" → "content" or "mobile-apps"
- "health" → "self-regulation"
- "spiritual" → "catholicism"
- "social" → "social-charisma"

NEVER create new categories - always map to existing ones!

ENHANCED DATE/TIME PARSING:
Current date: ${todayStr}
- "20th" → ${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-20
- "tomorrow" → ${new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
- "next week" → ${nextWeekStr} (same day of week)
- "next Tuesday" → Calculate actual next Tuesday date

TIME PARSING RULES:
- "10am" or "10:00" → "10:00:00"
- "2pm" or "2:00 PM" → "14:00:00" 
- "7:00" → "07:00:00" (morning unless context suggests evening)
- "all day" → Use dateTime with 00:00:00, set isAllDay: true
- "9 to 11" or "9-11" → startTime: "09:00:00", endTime: "11:00:00"
- "from 2pm to 4pm" → startTime: "14:00:00", endTime: "16:00:00"

SMART EVENT DEFAULTS:
- If no endTime specified and specific time given → Add appropriate duration
- Default appointment duration: 30 minutes
- Default meeting duration: 1 hour
- Default social event duration: 2 hours
- Default workout duration: 1 hour

CATEGORY INTELLIGENCE:
- Doctor/dentist/medical → "self-regulation"
- Workout/gym/exercise → "gym-calisthenics" 
- Meeting/work/client → "mobile-apps" (if dev context) or "content"
- Church/mass/prayer → "catholicism"
- Party/dinner/social → "social-charisma"
- Default fallback → "self-regulation"

ISO FORMAT EXAMPLES:
- June 20th at 2pm → dateTime: "${today.getFullYear()}-06-20T14:00:00", startTime: "${today.getFullYear()}-06-20T14:00:00", endTime: "${today.getFullYear()}-06-20T15:00:00"
- All day June 20th → dateTime: "${today.getFullYear()}-06-20T00:00:00", isAllDay: true, startTime: "${today.getFullYear()}-06-20T00:00:00", endTime: "${today.getFullYear()}-06-20T23:59:59"
- Tomorrow at 10am → dateTime: "${new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]}T10:00:00"

RESCHEDULING LOGIC - CRITICAL:
- "reschedule to next week" → Find event, update dateTime to same day next week (${nextWeekStr})
- "move to 4pm" → Keep same date, change time to 16:00:00
- "reschedule appointment to the 24th" → Change date to ${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-24, keep same time
- "reschedule to June 24th" → Use ${today.getFullYear()}-06-24 with original time
- USER SAYS "for the 20th" → ALWAYS use ${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-20
- USER SAYS "20th" → ALWAYS use ${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-20

RECURRING EVENTS - CRITICAL:
For recurring events like "weekly team meeting every Monday":
- Set isRecurring: true
- Set recurrencePattern: "weekly" 
- Set recurrenceInterval: 1
- Set recurrenceEndDate if specified
- Create initial event, system will handle recurrence

EXAMPLES:
- "Create doctor appointment for the 20th at 10am" → CHECK FOR CONFLICTS FIRST, then createItem with type: "event", dateTime: "${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-20T10:00:00"
- "doctor appointment next Tuesday 10am" → createItem with type: "event", dateTime: "CALCULATE_NEXT_TUESDAY_10AM"
- "lunch with John from 12 to 1" → createItem with startTime: "TODAY_12PM", endTime: "TODAY_13PM"
- "weekly team meeting every Monday 9am" → createItem with isRecurring: true, recurrencePattern: "weekly"
- "conference call in Conference Room A" → createItem with location: "Conference Room A"
- "Zoom meeting" → createItem with location: "Zoom"
- "all day conference tomorrow" → createItem with dateTime: "${new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]}T00:00:00", isAllDay: true
- "birthday party at 123 Main St" → createItem with location: "123 Main St"

ADVANCED OPERATIONS - CRITICAL:
- "Copy Steph Curry's routine" → copyRoutineFromPerson with personName: "Steph Curry"
- "Fill my calendar for next week" → generateFullDaySchedule with date range
- "Schedule learning from my notes for 45 days" → createCalendarFromNotes
- "Push all events back 1 week" → bulkRescheduleEvents with timeShift: "+1 week"
- "Change category to dating" → updateItem with newCategoryId: "social-charisma" (map to closest existing category!)

MULTIPLE DATE SCHEDULING - CRITICAL:
- "Schedule gym sessions for Monday, Wednesday, Friday" → createMultipleDateEvents with dates: ["2024-06-10", "2024-06-12", "2024-06-14"]
- "Book meetings for next week" → createMultipleDateEvents with multiple date strings
- "Create workout events for the whole week" → createMultipleDateEvents with 7 consecutive dates

RECURRING MULTIPLE DAYS - CRITICAL:
- "Schedule team meetings every Tuesday and Thursday at 3 PM for the next month" → createRecurringMultipleDays with daysOfWeek: ["tuesday", "thursday"], time: "15:00"
- "Weekly standup every Monday and Wednesday at 9 AM" → createRecurringMultipleDays with daysOfWeek: ["monday", "wednesday"], time: "09:00"
- "Gym sessions every Monday, Wednesday, Friday at 6 AM" → createRecurringMultipleDays with daysOfWeek: ["monday", "wednesday", "friday"], time: "06:00"

RECURRING EVENT DELETION - CRITICAL:
- When deleting recurring events, ALWAYS use deleteRecurringEvent instead of deleteItem
- This will ask user if they want to delete just one occurrence or all occurrences
- "Delete my daily workout" → deleteRecurringEvent with eventId: "daily workout"
- "Remove recurring meeting" → deleteRecurringEvent with eventId: "recurring meeting"

INTELLIGENT RESCHEDULING - CRITICAL:
The intelligentReschedule function MOVES existing events to new times, it does NOT create duplicates.
- "Cancel my workout and reschedule intelligently" → intelligentReschedule with canceledEventId: "workout"
- "I missed my morning workout, reschedule it" → intelligentReschedule with canceledEventId: "morning workout"  
- "Cancel meeting and shift other work events" → intelligentReschedule with canceledEventId: "meeting"
- This function finds the existing event, removes it, and creates an updated version at a new time
- The result is ONE event moved to a better time, NOT two events

FUZZY EVENT MATCHING - CRITICAL:
When user refers to events by description, use fuzzy matching:
- "morning workout" → Find events with "workout" in title scheduled in morning (5-12 AM)
- "afternoon meeting" → Find events with "meeting" in title scheduled in afternoon (12-17 PM)
- "evening dinner" → Find events with "dinner" in title scheduled in evening (17-23 PM)
- "my workout" → Find events in gym-calisthenics category with workout-related terms
- "team meeting" → Find events with "team" and "meeting" in title
- "doctor appointment" → Find events with "doctor" or "appointment" in title

CONFLICT RESOLUTION - CRITICAL:
When conflicts are detected:
1. If user says "create anyway", "override", "double-book" → Use createItemWithConflictOverride
2. If user chooses option 3 from conflict dialog → Use createItemWithConflictOverride
3. If user says "Create anyway (double-booked)" → Use createItemWithConflictOverride
4. NEVER get stuck in conflict resolution loops - always provide clear next steps

RESCHEDULING OPERATIONS - CRITICAL:
- "move my 3pm meeting to 4pm" → updateItem with startTime: "SAME_DATE_16:00:00"
- "reschedule dentist to next week" → updateItem with dateTime: "NEXT_WEEK_SAME_DAY_SAME_TIME"
- "reschedule appointment to the 24th" → updateItem with dateTime: "${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-24T[KEEP_ORIGINAL_TIME]"

INTELLIGENT TEXT EDITING - CRITICAL:
Be SMART about editing vs. rewriting. Choose the right approach:

1. SMALL EDITS (use replaceText):
- "change X to Y" → updateItem with replaceText: "X|Y"
- "fix the spacing" → updateItem with replaceText: "bad spacing|good spacing"
- "edit this word" → updateItem with replaceText: "oldword|newword"
- "remove duplicates" → updateItem with replaceText: "duplicate text|"

2. FORMATTING FIXES (use replaceText for specific issues):
- "fix the line breaks" → updateItem with replaceText: "text without breaks|text\nwith\nproper\nbreaks"
- "add bullet points" → updateItem with replaceText: "item1 item2|• item1\n• item2"
- "remove extra spaces" → updateItem with replaceText: "text  with   spaces|text with spaces"

3. CONTENT ADDITIONS (use appendText or prependText):
- "add this to the end" → updateItem with appendText: "new content"
- "add this to the beginning" → updateItem with prependText: "new content"

4. COMPLETE REWRITES (use text - ONLY when user asks for complete rewrite):
- "rewrite this note" → updateItem with text: "completely new content"
- "start over" → updateItem with text: "new content"

FORMATTING PRESERVATION:
- KEEP bullet points (-), numbered lists, line breaks
- KEEP proper spacing and structure
- ONLY remove excessive formatting (*****, ###, ---)
- When fixing formatting, use replaceText to target specific issues

INTELLIGENCE RULES:
- If user says "fix spacing" → updateItem with fixFormatting: true
- If user says "clean up" → updateItem with fixFormatting: true  
- If user says "organize this" → updateItem with fixFormatting: true
- If user says "remove duplicates" → updateItem with fixFormatting: true
- If user says "fix formatting" → updateItem with fixFormatting: true
- For specific word changes → use replaceText: "old|new"
- For adding content → use appendText or prependText
- NEVER completely rewrite unless explicitly asked

CRITICAL BULK OPERATIONS GUIDANCE:
- "all my daily routines" → Use type: "routine", filterByFrequency: "daily" (NOT frequency: "daily")
- "all weekly routines" → Use type: "routine", filterByFrequency: "weekly" (NOT frequency: "weekly")
- "all monthly routines" → Use type: "routine", filterByFrequency: "monthly" (NOT frequency: "monthly")
- "all my gym routines" → Use type: "routine", categoryId: "gym-calisthenics"

NEVER CONFUSE FILTERING WITH UPDATING:
- filterByFrequency = find existing routines with that frequency
- frequency = change routine frequency to that value

MULTI-STEP OPERATIONS - CRITICAL:
When user says "Create X and [do action]", you MUST make TWO separate function calls:

STEP 1: createItem with basic creation parameters (title, type, categoryId, frequency, duration, text)
STEP 2: updateItem with the created item's title and the action parameters

MULTIPLE DIFFERENT OPERATIONS - CRITICAL:
When user asks to apply DIFFERENT changes to multiple items, you MUST make SEPARATE updateItem calls:

- "Change note A to title X and note B to title Y" → TWO separate updateItem calls
- "Move one note to social-charisma and another to content" → TWO separate updateItem calls  
- "Edit each note to have different titles and categories" → SEPARATE updateItem call for EACH note

NEVER use bulkUpdateItems when items need DIFFERENT changes - only use it when applying SAME change to multiple items!

EXAMPLES:
- "Create a workout routine for 30 minutes daily and mark it complete for today"
  → Step 1: createItem(type: "routine", title: "Workout Routine", frequency: "daily", duration: 30, categoryId: "gym-calisthenics")  
  → Step 2: updateItem(itemId: "Workout Routine", completedToday: true)

- "Change note A to 'Where's Waldo' in social-charisma and note B to 'Where's Waldo' in content"
  → Step 1: updateItem(itemId: "note A", title: "Where's Waldo", text: "Where's Waldo...", newCategoryId: "social-charisma")
  → Step 2: updateItem(itemId: "note B", title: "Where's Waldo", text: "Where's Waldo...", newCategoryId: "content")

NEVER try to include completion status in createItem - ALWAYS use updateItem for the second action!

CONVERSATIONAL RESPONSES: You WILL receive detailed results showing exactly what was changed.
- You HAVE ACCESS to the specific item names that were modified
- You CAN and SHOULD tell the user which items were changed
- Share counts, warnings, and specific details
- Be conversational and helpful, not robotic
- For note updates: Mention what specific content was changed
- For category moves: Confirm "Moved [Note Title] from [old category] to [new category]"
- For content updates: Summarize what was added/changed
- Example: "I moved 2 items to self-regulation: Pack fishing gear and Go fishing at the lake. Both are now in the right category!"
- Example: "Updated your workout note with new exercises including push-ups, pull-ups, and planks"
- NEVER just say "huh?" or give unclear responses

SMART ITEM FINDING - NEVER ask for exact titles, always try to find items:
- "Change workout session to new name" → updateItem with itemId: "workout session", title: "new name"
- "Mark planche training complete" → updateItem with itemId: "planche training", completed: true
- "Delete workout session 1" → deleteItem with itemId: "workout session 1"
- "Delete my last note" → bulkDeleteItems with count: 1, type: "note", selection: "newest"
- "Delete the most recent todo" → bulkDeleteItems with count: 1, type: "todo", selection: "newest"
- "Set my React goal deadline to end of July" → updateItem with itemId: "React", dueDate: END OF JULY from above
- "Update my React goal progress" → updateItem with itemId: "React", progress: 90
- "Change all fishing todos to high priority" → bulkUpdateItems with searchTerm: "fishing", priority: "high"

EXACT ID HANDLING - When user provides specific IDs:
- "add workout tips to 1749880804964_tv8aza7z4" → updateItem with itemId: "1749880804964_tv8aza7z4", appendText: "workout tips content"
- "update 1749880804964_tv8aza7z4 with new info" → updateItem with itemId: "1749880804964_tv8aza7z4", appendText: "new info"
- "delete 1749880804964_tv8aza7z4" → deleteItem with itemId: "1749880804964_tv8aza7z4"
- ALWAYS use the exact ID provided by the user, don't question what it refers to unless there's a clear mismatch

SMART NOTE EDITING - PRESERVE existing content, don't rewrite everything:
- "Add workout tips to my fitness note" → updateItem with itemId: "fitness", appendText: "\\n\\nWorkout Tips:\\n- Stay hydrated\\n- Proper form is key"
- "Update my recipe note with cooking time" → updateItem with itemId: "recipe", appendText: "\\n\\nCooking Time: 45 minutes"
- "Add thoughts to depression note" → updateItem with itemId: "depression", appendText: "\\n\\nNew thoughts: [content]"
- "Put update at top of project note" → updateItem with itemId: "project", prependText: "UPDATE: [content]\\n\\n"
- Only use 'text' parameter for COMPLETE rewrites when user explicitly asks to "rewrite" or "replace all content"

NOTES CONTENT RULES - ABSOLUTELY CRITICAL:
- ALWAYS create notes with meaningful, detailed text content
- NEVER EVER use asterisks (*), bullet points (•), or ANY markdown formatting in note text
- NO symbols: No *, •, **, ##, ---, or any formatting symbols
- Use PLAIN TEXT ONLY with line breaks for organization
- When updating notes, provide complete, well-written content WITHOUT any symbols
- For "workout plan note" → Include actual exercises, sets, reps in plain text
- For "cooking recipe note" → Include ingredients, instructions, tips in plain text
- For "programming study note" → Include concepts, examples, resources in plain text
- Make note content genuinely useful, not placeholder text
- VIOLATION OF THIS RULE = CRITICAL ERROR

CONSOLIDATION FUNCTIONALITY:
When user asks to "consolidate", "merge", or "combine" duplicate items:
1. Use searchItems to find and read all the items to be merged
2. Analyze their content and combine intelligently, removing duplicates
3. Create ONE new comprehensive item with all the combined content
4. Delete the old duplicate items using bulkDeleteItems
5. Confirm what was consolidated and how many duplicates were removed

Example: "consolidate my workout notes" → 
Step 1: searchItems with query: "workout", type: "note"
Step 2: createItem with combined content from all found notes
Step 3: bulkDeleteItems to remove the old duplicate notes
Step 4: Confirm "Consolidated 4 workout notes into 1 comprehensive note"

MULTIPLE DIFFERENT UPDATES - USE executeMultipleUpdates:
When user wants DIFFERENT changes to multiple items, use executeMultipleUpdates instead of separate calls:

"Edit each note to change their title and beginning content to where's waldo and one category should be social-charisma and the other content" → 
executeMultipleUpdates with updatesJson: [
  {"itemId": "first note", "title": "Where's Waldo - Social", "text": "Where's Waldo content...", "newCategoryId": "social-charisma"},
  {"itemId": "second note", "title": "Where's Waldo - Content", "text": "Where's Waldo content...", "newCategoryId": "content"}
]

CURRENT ITEMS CONTEXT (${this.currentItems.length} total):
${this.currentItems.length > 0 ? this.currentItems.slice(0, 20).map(item => {
  const dueInfo = item.dueDate ? ` (due: ${item.dueDate.toLocaleDateString()})` : '';
  const completedInfo = item.completed ? ' ✓' : '';
  const progressInfo = item.metadata?.progress ? ` (${item.metadata.progress}%)` : '';
  
  // Add content preview for notes to provide better context
  let contentPreview = '';
  if (item.type === 'note' && item.text) {
    const preview = item.text.length > 100 ? item.text.substring(0, 100) + '...' : item.text;
    contentPreview = ` | Content: "${preview}"`;
  }
  
  return `• ID: ${item.id} | ${item.type.toUpperCase()}: "${item.title}"${dueInfo}${completedInfo}${progressInfo} [${item.categoryId}]${contentPreview}`;
}).join('\n') : 'No items yet'}${this.currentItems.length > 20 ? `\n... and ${this.currentItems.length - 20} more items` : ''}

CRITICAL ID-TO-ITEM MAPPING:
Each item above shows its exact ID and title. When users provide an ID, use the EXACT mapping from above.
NEVER assume what an ID refers to - always check the context above.
Examples:
- User says "add workout tips to 1749880804964_tv8aza7z4" → Look up ID 1749880804964_tv8aza7z4 in the context above to see what item it actually is
- If ID 1749880804964_tv8aza7z4 maps to "Healthy Breakfast Ideas" → That's what it is, don't assume it's something else
- If user corrects you about what an ID refers to → Accept their correction and proceed

NOTES CONTENT AWARENESS:
You have access to the full content of all notes above. When users ask about notes, reference their actual content.
Examples:
- "What did I write about depression?" → Look at depression-related notes and summarize their content
- "What are my thoughts on fitness?" → Find fitness notes and quote/reference their content
- "Add to my recipe note that it takes 45 minutes" → Use appendText to add cooking time without losing existing recipe content

PERSONALITY: You are warm, helpful, and proactive. Greet the user with "Hi, I'm your Digital Life, how are you?" when they first connect. Remember, you're speaking with the "${voiceName}" voice.

🚨 CRITICAL RULE - READ THIS FIRST:
ONLY call functions when user wants to CREATE, MODIFY, or DELETE something.
NEVER call functions for questions, inquiries, or informational requests.
You have full access to all user data in the context above.

✅ FUNCTION CALLS FOR ACTIONS ONLY:
- User: "create a todo" → CALL createItem with type="todo"
- User: "add a goal" → CALL createItem with type="goal"  
- User: "schedule meeting" → CALL createItem with type="event"
- User: "update my goal" → CALL updateItem with itemId and changes
- User: "delete that todo" → CALL deleteItem with itemId
- User: "mark complete" → CALL updateItem with completed=true

❌ NO FUNCTION CALLS FOR QUESTIONS:
- User: "what are my notes?" → ANSWER from context above, DO NOT call functions
- User: "tell me about my goals" → ANSWER from context above, DO NOT call functions
- User: "how many todos do I have?" → COUNT from context above, DO NOT call functions
- User: "what did I write about X?" → ANSWER from note content above, DO NOT call functions

🎯 AVAILABLE FUNCTIONS (use only for CREATE/UPDATE/DELETE):
- createItem, updateItem, deleteItem, bulkCreateItems
- searchItems ONLY for complex filtering tasks, NOT for simple questions
- Bulk operations, scheduling, conflict detection

VOICE RESPONSE PATTERN FOR ACTIONS:
1. Acknowledge request: "Creating that todo..."
2. Call the function IMMEDIATELY 
3. Confirm with result: "Created todo: [title]"

VOICE RESPONSE PATTERN FOR QUESTIONS:
1. Answer directly from context: "You have 5 todos. Here they are..."
2. NO function calls needed for informational requests

YOU HAVE COMPLETE ACCESS to their data through the context above. Use it to answer questions without calling functions!`;
  }

  private getGeminiTools() {
    // Get tools from the existing geminiService - this ensures we have ALL 20+ functions
    const geminiTools = geminiService.getTools();
    console.log('🔧🔧🔧 GEMINI LIVE SERVICE: Retrieved', geminiTools.length, 'tools from geminiService');
    console.log('🔧🔧🔧 GEMINI LIVE SERVICE: Tool names:', geminiTools.map(t => t.name));
    console.log('🔧🔧🔧 GEMINI LIVE SERVICE: Sample tool structure:', JSON.stringify(geminiTools[0], null, 2));
    
    // Check if we have all expected functions
    const expectedFunctions = [
      'createItem', 'updateItem', 'deleteItem', 'bulkCreateItems', 'bulkUpdateItems', 'bulkDeleteItems',
      'searchItems', 'consolidateItems', 'removeAsterisks', 'executeMultipleUpdates'
    ];
    const missingFunctions = expectedFunctions.filter(func => !geminiTools.find(tool => tool.name === func));
    if (missingFunctions.length > 0) {
      console.warn('⚠️⚠️⚠️ GEMINI LIVE SERVICE: Missing expected functions:', missingFunctions);
    } else {
      console.log('✅✅✅ GEMINI LIVE SERVICE: All expected functions are available');
    }
    
    // Convert to Live API format: [{functionDeclarations: [...]}]
    return [{
      functionDeclarations: geminiTools
    }];
  }

  private async handleFunctionCall(toolCallData: any): Promise<void> {
    try {
      // Rate limiting check
      const now = Date.now();
      if (now - this.lastFunctionCallTime < this.MIN_FUNCTION_CALL_INTERVAL) {
        console.warn('⚠️ GEMINI LIVE SERVICE: Function call rate limited - too soon after last call');
        return;
      }
      
      // Clean old function calls from history (older than 1 minute)
      this.functionCallHistory = this.functionCallHistory.filter(time => now - time < 60000);
      
      // Check if we're hitting the rate limit
      if (this.functionCallHistory.length >= this.MAX_FUNCTION_CALLS_PER_MINUTE) {
        console.error('❌ GEMINI LIVE SERVICE: Function call rate limit exceeded! Blocking call.');
        return;
      }
      
      // Add this call to history
      this.functionCallHistory.push(now);
      this.lastFunctionCallTime = now;
      
      console.log('🔧🔧🔧 GEMINI LIVE SERVICE: =======FUNCTION CALL HANDLER START=======');
      console.log('🔧🔧🔧 GEMINI LIVE SERVICE: Function calls in last minute:', this.functionCallHistory.length);
      console.log('🔧🔧🔧 GEMINI LIVE SERVICE: Handling function call:', toolCallData);
      console.log('🔧🔧🔧 GEMINI LIVE SERVICE: Tool call data keys:', Object.keys(toolCallData || {}));
      console.log('🔧🔧🔧 GEMINI LIVE SERVICE: Tool call data structure:', JSON.stringify(toolCallData, null, 2));
      console.log('🔧🔧🔧 GEMINI LIVE SERVICE: Session exists:', !!this.session);
      console.log('🔧🔧🔧 GEMINI LIVE SERVICE: Current items before function call:', this.currentItems.length);
      
      this.notifyFunctionCall(toolCallData);

      // HANDLE MULTIPLE POSSIBLE FORMATS FOR FUNCTION CALLS
      let functionCalls = [];
      
      // Format 1: { functionCalls: [...] }
      if (toolCallData && toolCallData.functionCalls && Array.isArray(toolCallData.functionCalls)) {
        functionCalls = toolCallData.functionCalls;
        console.log('🔍 GEMINI LIVE SERVICE: Using functionCalls array format, count:', functionCalls.length);
      }
      // Format 2: { function_calls: [...] }
      else if (toolCallData && toolCallData.function_calls && Array.isArray(toolCallData.function_calls)) {
        functionCalls = toolCallData.function_calls;
        console.log('🔍 GEMINI LIVE SERVICE: Using function_calls array format, count:', functionCalls.length);
      }
      // Format 3: Direct function call object
      else if (toolCallData && toolCallData.name) {
        functionCalls = [toolCallData];
        console.log('🔍 GEMINI LIVE SERVICE: Using direct function call format, name:', toolCallData.name);
      }
      // Format 4: Array of function calls
      else if (Array.isArray(toolCallData)) {
        functionCalls = toolCallData;
        console.log('🔍 GEMINI LIVE SERVICE: Using array format, count:', functionCalls.length);
      }
      else {
        console.error('❌❌❌ GEMINI LIVE SERVICE: Unknown function call format. Data type:', typeof toolCallData);
        console.error('❌❌❌ GEMINI LIVE SERVICE: Tool call data:', toolCallData);
        console.error('❌❌❌ GEMINI LIVE SERVICE: FUNCTION CALLS WILL NOT BE EXECUTED!');
        return;
      }
      
      console.log('📊📊📊 GEMINI LIVE SERVICE: Found', functionCalls.length, 'function calls to execute');
      console.log('📊📊📊 GEMINI LIVE SERVICE: Function calls details:', functionCalls.map((fc: any) => ({ name: fc.name, hasArgs: !!fc.args })));
      
      if (functionCalls.length === 0) {
        console.warn('⚠️⚠️⚠️ GEMINI LIVE SERVICE: No function calls found in tool call data - NO FUNCTIONS WILL BE EXECUTED!');
        return;
      }
        
        const responses = [];
        
      for (const functionCall of functionCalls) {
        console.log('⚡⚡⚡ GEMINI LIVE SERVICE: About to execute function:', functionCall.name);
        console.log('⚡⚡⚡ GEMINI LIVE SERVICE: Function args:', JSON.stringify(functionCall.args, null, 2));
        
        // AUDIO FEEDBACK: Play function execution sound
        this.playFunctionExecutionSound();
        
        try {
          // EXECUTE FUNCTION DIRECTLY
          console.log('🚀🚀🚀 GEMINI LIVE SERVICE: Calling executeFunction now...');
          const result = await this.executeFunction(functionCall.name, functionCall.args || {});
          
          // AUDIO FEEDBACK: Play success sound
          this.playFunctionSuccessSound();
          
          console.log('✅✅✅ GEMINI LIVE SERVICE: Function executed successfully:', functionCall.name);
          console.log('✅✅✅ GEMINI LIVE SERVICE: Function result:', result);
            
            responses.push({
            id: functionCall.id || `func_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              name: functionCall.name,
              response: result
            });
            
          // Update current items context immediately after function execution - EXPANDED LIST
          const dataModifyingFunctions = [
            'createItem', 'updateItem', 'deleteItem', 
            'bulkCreateItems', 'bulkUpdateItems', 'bulkDeleteItems',
            'consolidateItems', 'removeAsterisks', 'executeMultipleUpdates',
            'copyRoutineFromPerson', 'generateFullDaySchedule', 'createCalendarFromNotes',
            'bulkRescheduleEvents', 'createRecurringEvent', 'createMultipleDateEvents',
            'deleteRecurringEvent', 'intelligentReschedule', 'createItemWithConflictOverride',
            'createRecurringMultipleDays'
          ];
          
          if (dataModifyingFunctions.includes(functionCall.name)) {
            const oldItemsCount = this.currentItems.length;
            this.currentItems = this.getStoredItems();
            const newItemsCount = this.currentItems.length;
            console.log('🔄🔄🔄 GEMINI LIVE SERVICE: Updated items context. Old count:', oldItemsCount, 'New count:', newItemsCount);
            
            // ENHANCED UI REFRESH: Multiple notification methods
            console.log('🔄🔄🔄 GEMINI LIVE SERVICE: Triggering UI refresh via multiple methods for function:', functionCall.name);
            
            // Method 1: Direct callback
            if (this.onRefreshItems) {
              console.log('🔄 GEMINI LIVE SERVICE: Calling onRefreshItems callback');
              this.onRefreshItems();
            } else {
              console.warn('⚠️ GEMINI LIVE SERVICE: No onRefreshItems callback available');
            }
            
            // Method 2: Trigger localStorage event to ensure all components update
            console.log('🔄 GEMINI LIVE SERVICE: Triggering localStorage event for real-time updates');
            window.dispatchEvent(new StorageEvent('storage', {
              key: 'lifeStructureItems',
              newValue: localStorage.getItem('lifeStructureItems'),
              storageArea: localStorage
            }));
            
            // Method 3: Multiple delayed triggers for maximum reliability
            setTimeout(() => {
              console.log('🔄 GEMINI LIVE SERVICE: Delayed UI refresh trigger #1');
              if (this.onRefreshItems) {
                this.onRefreshItems();
              }
              
              // Trigger another storage event
              window.dispatchEvent(new StorageEvent('storage', {
                key: 'lifeStructureItems',
                newValue: localStorage.getItem('lifeStructureItems'),
                storageArea: localStorage
              }));
            }, 50);
            
            // Method 4: Even more aggressive refresh
            setTimeout(() => {
              console.log('🔄 GEMINI LIVE SERVICE: Delayed UI refresh trigger #2');
              if (this.onRefreshItems) {
                this.onRefreshItems();
              }
              
              // Force a different storage event
              window.dispatchEvent(new Event('lifeStructureItemsChanged'));
              
              // Trigger storage event again
              window.dispatchEvent(new StorageEvent('storage', {
                key: 'lifeStructureItems',
                newValue: localStorage.getItem('lifeStructureItems'),
                storageArea: localStorage
              }));
            }, 200);
            
            // Method 5: Final aggressive refresh
            setTimeout(() => {
              console.log('🔄 GEMINI LIVE SERVICE: Final aggressive UI refresh');
              if (this.onRefreshItems) {
                this.onRefreshItems();
              }
              
              // Update context again
              this.currentItems = this.getStoredItems();
              console.log('🔄 GEMINI LIVE SERVICE: Final items count:', this.currentItems.length);
            }, 500);
            
            console.log('✅ GEMINI LIVE SERVICE: UI refresh methods triggered');
            }
            
          } catch (error) {
          console.error('❌❌❌ GEMINI LIVE SERVICE: Function execution failed:', functionCall.name, error);
          console.error('❌❌❌ GEMINI LIVE SERVICE: Error details:', error);
          
          // AUDIO FEEDBACK: Play error sound
          this.playFunctionErrorSound();
          
          const errorResult = {
            success: false,
            function: functionCall.name,
            result: {
              message: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            }
          };
          
            responses.push({
            id: functionCall.id || `func_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              name: functionCall.name,
            response: errorResult
            });
          }
        }

        // Send tool responses back to the session
        if (this.session && responses.length > 0) {
        console.log('📤📤📤 GEMINI LIVE SERVICE: Sending', responses.length, 'tool responses back to session');
        console.log('📤📤📤 GEMINI LIVE SERVICE: Tool responses structure:', JSON.stringify(responses, null, 2));
        
        try {
          console.log('📤📤📤 GEMINI LIVE SERVICE: About to call session.sendToolResponse...');
          await this.session.sendToolResponse({
            functionResponses: responses
          });
          console.log('✅✅✅ GEMINI LIVE SERVICE: Tool responses sent successfully to Live API!');
        } catch (responseError) {
          console.error('❌ GEMINI LIVE SERVICE: Failed to send tool responses:', responseError);
        }
      } else {
        console.warn('⚠️ GEMINI LIVE SERVICE: No session available or no responses to send');
      }
      
    } catch (error) {
      console.error('❌ GEMINI LIVE SERVICE: Error handling function call:', error);
      this.notifyError(`Function call error: ${error}`);
    }
  }

  private enqueueAudio(audioArrayBuffer: ArrayBuffer): void {
    console.log('🎧 GEMINI LIVE SERVICE: Enqueuing audio, queue length before:', this.audioQueue.length);
    const int16Array = new Int16Array(audioArrayBuffer);
    this.audioQueue.push(int16Array);
    console.log('🎧 GEMINI LIVE SERVICE: Queue length after:', this.audioQueue.length, 'isPlayingAudio:', this.isPlaying);
    if (!this.isPlaying) {
      this.playNextInQueue();
    }
  }

  private playNextInQueue() {
    if (this.audioQueue.length === 0 || !this.audioContext) {
      if (this.audioQueue.length === 0) {
        this.isPlaying = false;
        if (this.speakingStateListeners.length > 0) this.speakingStateListeners[0](false);
        console.log('[GEMINI LIVE SERVICE] Audio queue empty, playback stopped.');
      }
      return;
    }
    
    // Ensure the audio context is running and set the initial play time
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    if (this.nextPlayTime < this.audioContext.currentTime) {
      this.nextPlayTime = this.audioContext.currentTime;
      console.log(`[GEMINI LIVE SERVICE] Resetting nextPlayTime to current context time: ${this.nextPlayTime}`);
    }

    const audioData = this.audioQueue.shift()!;
    
    // 1. Convert Int16 to Float32
    const float32Array = new Float32Array(audioData.length);
    for (let i = 0; i < audioData.length; i++) {
      float32Array[i] = audioData[i] / 32768.0;
    }

    // 2. Create AudioBuffer
    const audioBuffer = this.audioContext.createBuffer(1, float32Array.length, this.PLAYBACK_SAMPLE_RATE);
    audioBuffer.copyToChannel(float32Array, 0);

    // 3. Create and schedule AudioBufferSourceNode
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);
    
    // Precisely schedule the start time
    source.start(this.nextPlayTime);
    console.log(`[GEMINI LIVE SERVICE] Scheduled audio chunk to play at: ${this.nextPlayTime.toFixed(4)}s (duration: ${audioBuffer.duration.toFixed(4)}s)`);
    
    // Update the time for the next chunk
    this.nextPlayTime += audioBuffer.duration;

    // The 'onended' event is now used to trigger the next item in the queue
    source.onended = () => {
      // Continue playing if there are more items in the queue
      this.playNextInQueue();
    };

    // If playback isn't active, start it.
    if (!this.isPlaying) {
      this.isPlaying = true;
      if (this.speakingStateListeners.length > 0) this.speakingStateListeners[0](true);
      console.log('[GEMINI LIVE SERVICE] Starting audio playback...');
      this.playNextInQueue();
    }
  }

  private async initializeAudioSystem(): Promise<boolean> {
    console.log('[GEMINI LIVE SERVICE] Initializing audio system...');
    
    if (!this.audioContext) {
      try {
        // Create audio context with the correct playback sample rate
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate: this.PLAYBACK_SAMPLE_RATE // Use 24kHz for playback
        });
        console.log(`[GEMINI LIVE SERVICE] AudioContext initialized. Sample Rate: ${this.audioContext.sampleRate}, State: ${this.audioContext.state}`);
        
        // Always try to resume, especially important for browsers that require user gesture
        if (this.audioContext.state === 'suspended') {
          console.log('[GEMINI LIVE SERVICE] AudioContext is suspended, attempting to resume...');
          await this.audioContext.resume();
          console.log('[GEMINI LIVE SERVICE] AudioContext resumed successfully');
        }

        // Try to add audio worklet for processing input audio (completely optional)
        try {
          await this.addAudioWorklet();
          console.log('[GEMINI LIVE SERVICE] Audio worklet added successfully');
        } catch (workletError) {
          console.warn('[GEMINI LIVE SERVICE] Audio worklet not available, continuing without it:', workletError);
          // This is completely fine - we can function without the worklet
          // The worklet is only used for input audio processing
        }
      } catch (error) {
        console.error('[GEMINI LIVE SERVICE] Failed to initialize AudioContext:', error);
        return false;
      }
    } else if (this.audioContext.state === 'suspended') {
      try {
        console.log('[GEMINI LIVE SERVICE] Existing AudioContext is suspended, resuming...');
        await this.audioContext.resume();
        console.log('[GEMINI LIVE SERVICE] Existing AudioContext resumed');
      } catch (error) {
        console.error('[GEMINI LIVE SERVICE] Failed to resume AudioContext:', error);
        return false;
      }
    }

    console.log(`[GEMINI LIVE SERVICE] Audio system ready. State: ${this.audioContext?.state}`);
    return true;
  }

  private async addAudioWorklet(): Promise<void> {
    if (!this.audioContext) {
      console.warn('[GEMINI LIVE SERVICE] No audio context available for worklet');
      return;
    }

    // Check if AudioWorklet is supported
    if (!this.audioContext.audioWorklet) {
      console.warn('[GEMINI LIVE SERVICE] AudioWorklet not supported in this browser');
      return;
    }

    const workletCode = `
      class AudioProcessor extends AudioWorkletProcessor {
        constructor(options) {
          super();
          this.sampleRate = sampleRate;
          this.targetSampleRate = options.processorOptions?.targetSampleRate || 16000;
          this.bufferSize = options.processorOptions?.bufferSize || 4096;
          
          const minInternalBufferSize = Math.ceil(this.bufferSize * (this.sampleRate / this.targetSampleRate)) + 128;
          this._internalBuffer = new Float32Array(Math.max(minInternalBufferSize, this.bufferSize * 2));
          this._internalBufferIndex = 0;
          this.isProcessing = false;
          this.lastSendTime = currentTime;
          this.MAX_BUFFER_AGE_SECONDS = 0.5;
          this.resampleRatio = this.sampleRate / this.targetSampleRate;
          
          console.log('[AUDIO PROCESSOR] Initialized with sample rate:', this.sampleRate, 'target:', this.targetSampleRate);
        }

        process(inputs, outputs, parameters) {
          const inputChannel = inputs[0] && inputs[0][0];
          if (inputChannel && inputChannel.length > 0) {
            if (this._internalBufferIndex + inputChannel.length <= this._internalBuffer.length) {
              this._internalBuffer.set(inputChannel, this._internalBufferIndex);
              this._internalBufferIndex += inputChannel.length;
            }
          }

          const minInputSamplesForOneOutputBuffer = Math.floor(this.bufferSize * this.resampleRatio);
          const shouldSendByTime = (currentTime - this.lastSendTime > this.MAX_BUFFER_AGE_SECONDS && this._internalBufferIndex > 0);
          const shouldSendByFill = (this._internalBufferIndex >= minInputSamplesForOneOutputBuffer);

          if ((shouldSendByFill || shouldSendByTime) && !this.isProcessing) {
            this.sendResampledBuffer();
          }

          return true;
        }

        sendResampledBuffer() {
          if (this._internalBufferIndex === 0 || this.isProcessing) return;
          
          this.isProcessing = true;
          this.lastSendTime = currentTime;
          
          const outputBuffer = new Float32Array(this.bufferSize);
          let outputIndex = 0;
          let consumedInputSamples = 0;

          for (let i = 0; i < this.bufferSize; i++) {
            const P = i * this.resampleRatio;
            const K = Math.floor(P);
            const T = P - K;

            if (K + 1 < this._internalBufferIndex) {
              outputBuffer[outputIndex++] = this._internalBuffer[K] * (1 - T) + this._internalBuffer[K + 1] * T;
            } else if (K < this._internalBufferIndex) {
              outputBuffer[outputIndex++] = this._internalBuffer[K];
            } else {
              break;
            }
            consumedInputSamples = K + 1;
          }

          const finalOutputBuffer = outputBuffer.slice(0, outputIndex);
          if (finalOutputBuffer.length === 0) {
            this.isProcessing = false;
            return;
          }

          const pcmData = new Int16Array(finalOutputBuffer.length);
          for (let i = 0; i < finalOutputBuffer.length; i++) {
            const sample = Math.max(-1, Math.min(1, finalOutputBuffer[i]));
            pcmData[i] = sample * 32767;
          }

          try {
          this.port.postMessage({ pcmData: pcmData.buffer }, [pcmData.buffer]);
          } catch (error) {
            console.warn('[AUDIO PROCESSOR] Failed to post message:', error);
          }

          if (consumedInputSamples > 0 && consumedInputSamples <= this._internalBufferIndex) {
            this._internalBuffer.copyWithin(0, consumedInputSamples, this._internalBufferIndex);
            this._internalBufferIndex -= consumedInputSamples;
          } else {
            this._internalBufferIndex = 0;
          }

          this.isProcessing = false;
        }
      }
      
      try {
      registerProcessor('audio-processor', AudioProcessor);
        console.log('[AUDIO PROCESSOR] Registered successfully');
      } catch (error) {
        console.error('[AUDIO PROCESSOR] Failed to register:', error);
      }
    `;

    let workletURL: string | null = null;
    
    try {
      const blob = new Blob([workletCode], { type: 'application/javascript' });
      workletURL = URL.createObjectURL(blob);
      
      console.log('[GEMINI LIVE SERVICE] Adding audio worklet module...');
      await this.audioContext.audioWorklet.addModule(workletURL);
      console.log('[GEMINI LIVE SERVICE] Audio worklet module added successfully');
      
    } catch (error) {
      console.error('[GEMINI LIVE SERVICE] Failed to add AudioWorklet module:', error);
      
      // More specific error handling
      if (error instanceof Error) {
        if (error.message.includes('SecurityError')) {
          console.error('[GEMINI LIVE SERVICE] Security error loading worklet - this might be due to CORS or context issues');
        } else if (error.message.includes('SyntaxError')) {
          console.error('[GEMINI LIVE SERVICE] Syntax error in worklet code');
        }
      }
      
      throw error;
    } finally {
      // Always clean up the URL
      if (workletURL) {
        URL.revokeObjectURL(workletURL);
      }
    }
  }

  async startListening(): Promise<void> {
    try {
      console.log('🎙️ GEMINI LIVE SERVICE: Starting to listen...');
      console.log('🔍 GEMINI LIVE SERVICE: Connection state:', {
        hasSession: !!this.session,
        isSetupComplete: this.isSetupComplete,
        isConnected: this.isConnected,
        isListening: this.isListening
      });
      
      if (!this.session || !this.isSetupComplete) {
        throw new Error('Not connected to Gemini Live API or setup not complete');
      }

      // Initialize audio system
      console.log('🔧 GEMINI LIVE SERVICE: Initializing audio system...');
      const audioSystemReady = await this.initializeAudioSystem();
      if (!audioSystemReady || !this.audioContext) {
        throw new Error('Audio system failed to initialize');
      }

      // Get user media
      console.log('🎤 GEMINI LIVE SERVICE: Requesting microphone access...');
      this.micStream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          channelCount: 1,
          sampleRate: this.TARGET_SAMPLE_RATE,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      console.log('✅ GEMINI LIVE SERVICE: Microphone access granted');

      // Set up audio processing chain
      this.micSourceNode = this.audioContext.createMediaStreamSource(this.micStream);
      
      // Try to create audio worklet node (optional)
      try {
      this.audioWorkletNode = new AudioWorkletNode(this.audioContext, 'audio-processor', {
        processorOptions: {
          targetSampleRate: this.TARGET_SAMPLE_RATE,
          bufferSize: this.WORKLET_BUFFER_SIZE
        }
      });

      // Handle processed audio data
      this.audioWorkletNode.port.onmessage = (event) => {
        if (event.data.debug) {
          console.log('[AUDIO WORKLET]', event.data.debug);
          return;
        }
        
        if (event.data.pcmData && this.session && this.isListening) {
          const pcmArrayBuffer = event.data.pcmData as ArrayBuffer;
          if (pcmArrayBuffer.byteLength === 0) return;

          console.log('🎵 GEMINI LIVE SERVICE: Sending audio data:', pcmArrayBuffer.byteLength, 'bytes');
          
          const base64AudioData = arrayBufferToBase64(pcmArrayBuffer);
          const audioMediaBlob: GenAIBlob = {
            data: base64AudioData,
            mimeType: `audio/pcm;rate=${this.TARGET_SAMPLE_RATE}`
          };

          if (this.session && this.isListening) {
            this.session.sendRealtimeInput({ media: audioMediaBlob });
          }
        }
      };

      // Connect audio nodes
      this.micSourceNode.connect(this.audioWorkletNode);
        console.log('✅ GEMINI LIVE SERVICE: Audio worklet connected successfully');
        
      } catch (workletError) {
        console.warn('⚠️ GEMINI LIVE SERVICE: Audio worklet not available, using fallback method:', workletError);
        
        // Fallback: Use ScriptProcessorNode for older browsers or when worklet fails
        // Note: This is deprecated but still works
        const scriptProcessor = this.audioContext.createScriptProcessor(this.WORKLET_BUFFER_SIZE, 1, 1);
        
        scriptProcessor.onaudioprocess = (event) => {
          if (!this.session || !this.isListening) return;
          
          const inputBuffer = event.inputBuffer;
          const inputData = inputBuffer.getChannelData(0);
          
          // Simple conversion to Int16 PCM
          const pcmData = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            const sample = Math.max(-1, Math.min(1, inputData[i]));
            pcmData[i] = sample * 32767;
          }
          
          const base64AudioData = arrayBufferToBase64(pcmData.buffer);
          const audioMediaBlob: GenAIBlob = {
            data: base64AudioData,
            mimeType: `audio/pcm;rate=${this.TARGET_SAMPLE_RATE}`
          };

          if (this.session && this.isListening) {
            this.session.sendRealtimeInput({ media: audioMediaBlob });
          }
        };
        
        this.micSourceNode.connect(scriptProcessor);
        scriptProcessor.connect(this.audioContext.destination);
        console.log('✅ GEMINI LIVE SERVICE: Fallback audio processing connected');
      }
      
      this.isListening = true;
      this.notifyListeningState(true);
      
      console.log('✅ GEMINI LIVE SERVICE: Started listening');
    } catch (error) {
      console.error('❌ GEMINI LIVE SERVICE: Failed to start listening:', error);
      this.notifyError(`Failed to start listening: ${error}`);
      this.cleanupAudioNodes();
      throw error;
    }
  }

  stopListening(): void {
    console.log('🛑 GEMINI LIVE SERVICE: Stopping listening...');
    
    this.isListening = false;
    this.notifyListeningState(false);
    this.cleanupAudioNodes();
    
    console.log('✅ GEMINI LIVE SERVICE: Stopped listening');
  }

  stopSpeaking(): void {
    console.log('🛑 GEMINI LIVE SERVICE: Stopping speech...');
    
    // Clear audio queue immediately
    this.audioQueue = [];
    this.isPlaying = false;
    
    // Properly stop audio context instead of just suspending
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        // Stop all audio source nodes
        this.audioContext.suspend();
      } catch (error) {
        console.warn('⚠️ GEMINI LIVE SERVICE: Error stopping audio context:', error);
      }
    }
    
    // Update speaking state
    if (this.isSpeaking) {
      this.isSpeaking = false;
      this.notifySpeakingState(false);
    }
  }

  interrupt(): void {
    console.log('⚡ GEMINI LIVE SERVICE: Interrupting...');
    
    // Stop speaking and clear audio queue
    this.stopSpeaking();
    
    // Send interrupt message to session if available
    if (this.session) {
      try {
        // Send proper interrupt signal to Gemini Live API
        this.session.sendClientContent({
          turns: [],
          turnComplete: true
        });
        
        console.log('✅ GEMINI LIVE SERVICE: Interrupt signals sent successfully');
      } catch (error) {
        console.warn('⚠️ GEMINI LIVE SERVICE: Error sending interrupt:', error);
      }
    }
  }

  private cleanupAudioNodes(): void {
    if (this.audioWorkletNode) {
      this.audioWorkletNode.port.onmessage = null;
      this.audioWorkletNode.disconnect();
      this.audioWorkletNode = null;
    }
    
    if (this.micSourceNode) {
      this.micSourceNode.disconnect();
      this.micSourceNode = null;
    }
    
    if (this.micStream) {
      this.micStream.getTracks().forEach(track => track.stop());
      this.micStream = null;
    }
    
    console.log('[GEMINI LIVE SERVICE] Audio nodes cleaned up');
  }

  private cleanupAfterError(): void {
    console.log('[GEMINI LIVE SERVICE] Cleaning up after error/close');
    
    this.stopListening();
    this.audioQueue = [];
    this.isPlaying = false;
    this.isSetupComplete = false;
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  // AUDIO FEEDBACK METHODS
  private playFunctionExecutionSound(): void {
    try {
      // Create a subtle audio cue when function starts
      if (this.audioContext) {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        // Subtle ascending tone (400Hz to 600Hz)
        oscillator.frequency.setValueAtTime(400, this.audioContext.currentTime);
        oscillator.frequency.linearRampToValueAtTime(600, this.audioContext.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.1);
        
        console.log('🔊 GEMINI LIVE SERVICE: Playing function execution sound');
      }
    } catch (error) {
      console.warn('⚠️ GEMINI LIVE SERVICE: Could not play function execution sound:', error);
    }
  }

  private playFunctionSuccessSound(): void {
    try {
      // Create a success audio cue
      if (this.audioContext) {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        // Success tone (C5 - E5 - G5 chord)
        oscillator.frequency.setValueAtTime(523, this.audioContext.currentTime); // C5
        oscillator.frequency.setValueAtTime(659, this.audioContext.currentTime + 0.05); // E5
        oscillator.frequency.setValueAtTime(784, this.audioContext.currentTime + 0.1); // G5
        
        gainNode.gain.setValueAtTime(0.08, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.15);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.15);
        
        console.log('✅ GEMINI LIVE SERVICE: Playing function success sound');
      }
    } catch (error) {
      console.warn('⚠️ GEMINI LIVE SERVICE: Could not play function success sound:', error);
    }
  }

  private playFunctionErrorSound(): void {
    try {
      // Create an error audio cue
      if (this.audioContext) {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        // Error tone (descending)
        oscillator.frequency.setValueAtTime(400, this.audioContext.currentTime);
        oscillator.frequency.linearRampToValueAtTime(200, this.audioContext.currentTime + 0.2);
        
        gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.2);
        
        console.log('❌ GEMINI LIVE SERVICE: Playing function error sound');
      }
    } catch (error) {
      console.warn('⚠️ GEMINI LIVE SERVICE: Could not play function error sound:', error);
    }
  }

  async disconnect(): Promise<void> {
    console.log('🔌 GEMINI LIVE SERVICE: Disconnecting...');
    
    this.stopListening();
    
    if (this.session) {
      this.session.close();
      this.session = null;
    }
    
    this.cleanupAfterError();
    
    this.isConnected = false;
    this.notifyConnectionState(false);
    
    console.log('✅ GEMINI LIVE SERVICE: Disconnected');
  }

  async sendUserMessage(text: string): Promise<void> {
    if (!this.session) {
      throw new Error('Not connected to Gemini Live API');
    }

    console.log('💬 GEMINI LIVE SERVICE: Sending user message:', text);
    
    // Add user message to transcript
    this.notifyTranscript({
      text,
      isFinal: true,
      timestamp: Date.now(),
      isUser: true
    });

    // Send text message to the session
    await this.session.sendClientContent({
      turns: [{
        role: 'user',
        parts: [{ text }]
      }],
      turnComplete: true
    });
  }

  get connected(): boolean {
    return this.isConnected && this.isSetupComplete;
  }

  get listening(): boolean {
    return this.isListening;
  }

  private handleMessage(message: any) {
    if (message.data) {
      const newAudio = new Int16Array(message.data);
      
      this.audioQueue.push(newAudio);
      
      // If playback isn't active, start it.
      if (!this.isPlaying) {
        this.isPlaying = true;
        if (this.speakingStateListeners.length > 0) this.speakingStateListeners[0](true);
        console.log('[GEMINI LIVE SERVICE] Starting audio playback...');
        this.playNextInQueue();
      }
    } else if (message.serverContent) {
      if (message.serverContent.inputTranscription) {
        // FIX: Call notifyTranscript instead of onTranscript to prevent infinite recursion
        this.notifyTranscript({
          text: message.serverContent.inputTranscription.transcript || message.serverContent.inputTranscription,
          isFinal: message.serverContent.inputTranscription.isFinal || true,
          timestamp: Date.now(),
          isUser: true
        });
      }
    } else {
      console.log('[GEMINI LIVE SERVICE] Received non-audio, non-transcript message:', message);
    }
  }
}

export const geminiLiveService = new GeminiLiveService(); 