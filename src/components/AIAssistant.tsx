import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  User, Send, Image, Plus, X, Minimize2, 
  Sun, Moon, ChevronLeft, ChevronRight, Edit3, 
  Zap, MessagesSquare, Mic, MicOff, ChevronDown, Sparkles, Square
} from 'lucide-react';
import { chatService } from '../services/ChatService';
import { voiceService } from '../services/voiceService';
import { ChatMessage, ChatSession } from '../types/chat';
import { Item, Category } from '../types';
import ModelSelector from './ModelSelector';
import { GeminiLiveService } from '../services/geminiLiveService';
import { openaiRealtimeService } from '../services/openaiRealtimeService';
import { geminiService } from '../services/geminiService';
import ContextAwareInput, { ContextAwareInputRef } from './ContextAwareInput';
import FunctionCallUI from './FunctionCallUI';

// Helper function to clean markdown formatting from messages
const cleanMarkdownFormatting = (text: string): string => {
  return text
    .replace(/#{1,6}\s*(.*)/g, '$1')   // Remove # ## ### headers
    .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove **bold** formatting
    .replace(/\*(.*?)\*/g, '$1')      // Remove *italic* formatting
    .replace(/`(.*?)`/g, '$1')        // Remove `code` formatting
    .replace(/~~(.*?)~~/g, '$1')      // Remove ~~strikethrough~~ formatting
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove [link](url) formatting
    .replace(/^\s*[-*+]\s+/gm, '')    // Remove bullet points
    .replace(/^\s*\d+\.\s+/gm, '')    // Remove numbered lists
    .replace(/\*\s*/g, '')            // Remove standalone asterisks
    .replace(/\*{2,}/g, '')           // Remove multiple asterisks
    .trim();
};

// Voice models and options
interface VoiceModel {
  id: string;
  name: string;
  provider: 'gemini' | 'openai';
  description: string;
}

const VOICE_MODELS: VoiceModel[] = [
  {
    id: 'gemini-2.5-flash-preview-native-audio-dialog',
    name: 'Gemini 2.5 Flash Native Audio',
    provider: 'gemini',
    description: 'Native audio model with distinct voices'
  },
  {
    id: 'gpt-4o-realtime-preview-2024-12-17',
    name: 'GPT-4o Realtime (Latest)',
    provider: 'openai',
    description: 'Latest OpenAI realtime model'
  },
  {
    id: 'gpt-4o-mini-realtime-preview',
    name: 'GPT-4o Mini Realtime',
    provider: 'openai',
    description: 'Faster, cost-effective realtime model'
  }
];

const GEMINI_VOICES = [
  { id: 'Zephyr', name: 'Zephyr', description: 'Bright' },
  { id: 'Puck', name: 'Puck', description: 'Upbeat' },
  { id: 'Charon', name: 'Charon', description: 'Informative' },
  { id: 'Kore', name: 'Kore', description: 'Firm' },
  { id: 'Fenrir', name: 'Fenrir', description: 'Excitable' },
  { id: 'Leda', name: 'Leda', description: 'Youthful' },
  { id: 'Orus', name: 'Orus', description: 'Firm' },
  { id: 'Aoede', name: 'Aoede', description: 'Breezy' },
  { id: 'Callirrhoe', name: 'Callirrhoe', description: 'Easy-going' },
  { id: 'Autonoe', name: 'Autonoe', description: 'Bright' },
  { id: 'Enceladus', name: 'Enceladus', description: 'Breathy' },
  { id: 'Iapetus', name: 'Iapetus', description: 'Clear' },
  { id: 'Umbriel', name: 'Umbriel', description: 'Easy-going' },
  { id: 'Algieba', name: 'Algieba', description: 'Smooth' },
  { id: 'Despina', name: 'Despina', description: 'Smooth' },
  { id: 'Erinome', name: 'Erinome', description: 'Clear' },
  { id: 'Algenib', name: 'Algenib', description: 'Gravelly' },
  { id: 'Rasalgethi', name: 'Rasalgethi', description: 'Informative' },
  { id: 'Laomedeia', name: 'Laomedeia', description: 'Upbeat' },
  { id: 'Achernar', name: 'Achernar', description: 'Soft' },
  { id: 'Alnilam', name: 'Alnilam', description: 'Firm' },
  { id: 'Schedar', name: 'Schedar', description: 'Even' },
  { id: 'Gacrux', name: 'Gacrux', description: 'Mature' },
  { id: 'Pulcherrima', name: 'Pulcherrima', description: 'Forward' },
  { id: 'Achird', name: 'Achird', description: 'Friendly' },
  { id: 'Zubenelgenubi', name: 'Zubenelgenubi', description: 'Casual' },
  { id: 'Vindemiatrix', name: 'Vindemiatrix', description: 'Gentle' },
  { id: 'Sadachbia', name: 'Sadachbia', description: 'Lively' },
  { id: 'Sadaltager', name: 'Sadaltager', description: 'Knowledgeable' },
  { id: 'Sulafat', name: 'Sulafat', description: 'Warm' },
];

const OPENAI_VOICES = [
  { id: 'alloy', name: 'Alloy', description: 'Balanced, neutral tone' },
  { id: 'ash', name: 'Ash', description: 'Expressive and dynamic' },
  { id: 'ballad', name: 'Ballad', description: 'Melodic and storytelling' },
  { id: 'coral', name: 'Coral', description: 'Warm and conversational' },
  { id: 'echo', name: 'Echo', description: 'Engaging and versatile' },
  { id: 'sage', name: 'Sage', description: 'Wise and thoughtful' },
  { id: 'shimmer', name: 'Shimmer', description: 'Gentle and soothing' },
  { id: 'verse', name: 'Verse', description: 'Confident and articulate' }
];

interface AIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  items: Item[];
  onAddItem: (item: Item) => void;
  onRefreshItems: () => void;
  currentView: string;
  // New props for sidebar mode
  isSidebarMode?: boolean;
  sidebarWidth?: number;
  isCollapsed?: boolean;
  onResize?: (width: number) => void;
  onToggleCollapse?: () => void;
  // Props for note editing context
  currentNoteContent?: string;
  currentNoteTitle?: string;
  onUpdateNoteContent?: (content: string) => void;
  onUpdateNoteTitle?: (title: string) => void;
  // Supabase operations for authenticated users
  supabaseCallbacks?: {
    createItem?: (item: any) => Promise<any>;
    updateItem?: (id: string, item: any) => Promise<any>;
    deleteItem?: (id: string) => Promise<any>;
    bulkCreateItems?: (items: any[]) => Promise<any>;
    createCategory?: (category: any) => Promise<any>;
    refreshData?: () => Promise<void>;
  };
}

const AIAssistant: React.FC<AIAssistantProps> = ({
  isOpen,
  onClose,
  categories,
  items,
  onAddItem,
  onRefreshItems,
  currentView,
  // New props for sidebar mode
  isSidebarMode,
  sidebarWidth,
  isCollapsed,
  onResize,
  onToggleCollapse,
  // Props for note editing context
  currentNoteContent,
  currentNoteTitle,
  onUpdateNoteContent,
  onUpdateNoteTitle,
  // Supabase operations
  supabaseCallbacks
}) => {
  
  // Configure AI services with Supabase callbacks for authenticated users
  useEffect(() => {
    if (supabaseCallbacks) {
      console.log('✅ AIAssistant: Configuring geminiService with Supabase callbacks for authenticated user');
      geminiService.setSupabaseCallbacks(supabaseCallbacks);
      console.log('✅ AIAssistant: Configuring openaiRealtimeService with Supabase callbacks for authenticated user');
      openaiRealtimeService.setSupabaseCallbacks(supabaseCallbacks);
    } else {
      console.log('✅ AIAssistant: Clearing geminiService Supabase callbacks for unauthenticated user');
      geminiService.clearSupabaseCallbacks();
      console.log('✅ AIAssistant: Clearing openaiRealtimeService Supabase callbacks for unauthenticated user');
      openaiRealtimeService.clearSupabaseCallbacks();
    }
  }, [supabaseCallbacks]);

  // IMMEDIATE DEBUG - Check what props we're getting
  useEffect(() => {
    console.log('🚨 AIAssistant PROPS DEBUG:');
    console.log('🚨 currentNoteContent:', currentNoteContent);
    console.log('🚨 currentNoteTitle:', currentNoteTitle);
    console.log('🚨 onUpdateNoteContent exists?', !!onUpdateNoteContent);
    console.log('🚨 onUpdateNoteTitle exists?', !!onUpdateNoteTitle);
    console.log('🚨 currentView:', currentView);
    console.log('🚨 isSidebarMode:', isSidebarMode);
    console.log('🚨 supabaseCallbacks exists?', !!supabaseCallbacks);
  }, [currentNoteContent, currentNoteTitle, onUpdateNoteContent, onUpdateNoteTitle, currentView, isSidebarMode, supabaseCallbacks]);

  const [inputMessage, setInputMessage] = useState('');
  const [showSessions, setShowSessions] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isAgenticMode, setIsAgenticMode] = useState(false);
  
  // Function calling states
  const [isProcessingFunction, setIsProcessingFunction] = useState(false);
  const [functionResult, setFunctionResult] = useState<string | null>(null);
  const [pendingFunctionCalls, setPendingFunctionCalls] = useState<Array<{
    id: string;
    name: string;
    args: any;
    completed?: boolean;
    result?: any;
  }>>([]);
  
  // AI processing states
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [isCallingFunction, setIsCallingFunction] = useState(false);
  const [currentFunctionName, setCurrentFunctionName] = useState<string | null>(null);
  const [agenticLoopCount, setAgenticLoopCount] = useState(0);
  const [maxAgenticLoops] = useState(15); // Allow more cycles for comprehensive life setup
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const [autoApprove, setAutoApprove] = useState(false);
  const [originalUserIntent, setOriginalUserIntent] = useState<string | null>(null);
  const [agenticRequestType, setAgenticRequestType] = useState<'deletion' | 'creation' | 'planning' | 'research' | 'optimization' | null>(null);
  
  // Clear pending function calls when component mounts (new conversation)
  useEffect(() => {
    setPendingFunctionCalls([]);
    setAgenticLoopCount(0);
    setIsAIThinking(false);
    setIsCallingFunction(false);
    setCurrentFunctionName(null);
    
    // Load auto-approve preference
    const savedAutoApprove = localStorage.getItem('aiAssistantAutoApprove');
    if (savedAutoApprove === 'true') {
      setAutoApprove(true);
    }
  }, []);
  
  // Save auto-approve preference
  useEffect(() => {
    localStorage.setItem('aiAssistantAutoApprove', autoApprove.toString());
  }, [autoApprove]);
  
  // Function call approval/rejection handlers
  const handleApproveFunctionCall = async (functionCallId: string) => {
    const functionCall = pendingFunctionCalls.find(fc => fc.id === functionCallId);
    if (!functionCall) return;

    try {
      setIsCallingFunction(true);
      setCurrentFunctionName(functionCall.name);
      
      const result = await geminiService.executeFunctionWithContext(
        functionCall.name,
        functionCall.args,
        items,
        categories
      );

      if (result.success) {
        // Add visual feedback about what was actually changed
        if (result.functionResults && result.functionResults.length > 0) {
          const funcResult = result.functionResults[0];
          let feedback = '';
          
          if (funcResult.function === 'deleteItem' && funcResult.result?.item) {
            feedback = `✅ Deleted ${funcResult.result.item.type}: "${funcResult.result.item.title}"`;
          } else if (funcResult.function === 'createItem' && funcResult.result?.items?.length > 0) {
            const item = funcResult.result.items[0];
            feedback = `✅ Created ${item.type}: "${item.title}" in ${item.categoryId}`;
          } else if (funcResult.function === 'bulkCreateItems' && funcResult.result?.items?.length > 0) {
            const items = funcResult.result.items;
            feedback = `✅ Created ${items.length} items: ${items.map((item: any) => `${item.type}: "${item.title}"`).slice(0, 3).join(', ')}${items.length > 3 ? '...' : ''}`;
          } else {
            feedback = `✅ ${result.message || 'Action completed successfully'}`;
          }
          
          await chatService.addMessage('system', feedback);
        }
        
        // Trigger data refresh
        if (result.itemsModified) {
          onRefreshItems();
        }
        
        // Intelligent agentic mode continuation after function execution
        if (isAgenticMode) {
          console.log('🤖 Agentic mode: Evaluating continuation after function execution');
          
          // Check if this was a delete operation
          const wasDeleteOperation = result.functionResults?.some((fr: any) => 
            fr.function === 'deleteItem' || fr.function === 'bulkDeleteItems'
          );
          
          const currentIntent = agenticRequestType || 'creation';
          const shouldContinue = shouldContinueAgentic(currentIntent, items.length, result.message || '');
          
          if (shouldContinue) {
            setTimeout(() => {
              continueAgenticMode(result.message || 'Function executed successfully', wasDeleteOperation);
            }, 500);
          } else {
            console.log('🎯 Function execution completed the agentic goal');
            setIsAgenticMode(false);
            setOriginalUserIntent(null);
            setAgenticRequestType(null);
          }
        }
      } else {
        await chatService.addMessage('system', `❌ **Function failed**: ${result.message || 'Unknown error'}`);
      }

      // Keep the function call visible but mark as completed
      setPendingFunctionCalls(prev => prev.map(fc => 
        fc.id === functionCallId 
          ? { ...fc, completed: true, result: result } 
          : fc
      ));
    } catch (error) {
      console.error('Function execution error:', error);
      await chatService.addMessage('system', `❌ **Function error**: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsCallingFunction(false);
      setCurrentFunctionName(null);
    }
  };

  const handleRejectFunctionCall = async (functionCallId: string) => {
    setPendingFunctionCalls(prev => prev.filter(fc => fc.id !== functionCallId));
    await chatService.addMessage('system', '❌ **Function cancelled** by user');
  };
  
  // Stop agentic mode and clear all pending operations with proper cleanup
  const stopAgenticMode = () => {
    setIsAgenticMode(false);
    setPendingFunctionCalls([]);
    setAgenticLoopCount(0);
    setIsAIThinking(false);
    setIsCallingFunction(false);
    setCurrentFunctionName(null);
    setOriginalUserIntent(null);
    setAgenticRequestType(null);
    console.log('🛑 Agentic mode stopped and all pending operations cleared');
    
    // Provide user feedback about completion
    setTimeout(() => {
      chatService.addMessage('system', '✨ Agentic mode completed. Switched back to Ask mode.');
    }, 100);
  };

  // Intelligent user intent classification system for robust agentic behavior
  const classifyUserIntent = (message: string): 'deletion' | 'creation' | 'planning' | 'research' | 'optimization' | 'lifestyle_change' | 'goal_setting' | 'organization' => {
    const lowerMessage = message.toLowerCase();
    
    // Deletion patterns (comprehensive)
    if (lowerMessage.includes('delete') || lowerMessage.includes('clear') || lowerMessage.includes('remove') ||
        lowerMessage.includes('clean up') || lowerMessage.includes('get rid of') || lowerMessage.includes('eliminate')) {
      return 'deletion';
    }
    
    // Lifestyle change patterns (major life events)
    if (lowerMessage.includes('getting married') || lowerMessage.includes('preparing to get married') ||
        lowerMessage.includes('move to') || lowerMessage.includes('moving to') || lowerMessage.includes('relocating') ||
        lowerMessage.includes('new job') || lowerMessage.includes('starting a new') || lowerMessage.includes('becoming a')) {
      return 'lifestyle_change';
    }
    
    // Planning patterns (comprehensive)
    if (lowerMessage.includes('plan') || lowerMessage.includes('organize') || lowerMessage.includes('prepare') || 
        lowerMessage.includes('wedding') || lowerMessage.includes('trip') || lowerMessage.includes('project') ||
        lowerMessage.includes('schedule') || lowerMessage.includes('setup') || lowerMessage.includes('set up')) {
      return 'planning';
    }
    
    // Goal setting patterns
    if (lowerMessage.includes('goal') || lowerMessage.includes('achieve') || lowerMessage.includes('accomplish') ||
        lowerMessage.includes('succeed') || lowerMessage.includes('target') || lowerMessage.includes('milestone')) {
      return 'goal_setting';
    }
    
    // Research patterns
    if (lowerMessage.includes('research') || lowerMessage.includes('learn') || lowerMessage.includes('study') || 
        lowerMessage.includes('find out') || lowerMessage.includes('investigate') || lowerMessage.includes('explore')) {
      return 'research';
    }
    
    // Organization patterns
    if (lowerMessage.includes('organize') || lowerMessage.includes('structure') || lowerMessage.includes('categorize') ||
        lowerMessage.includes('sort') || lowerMessage.includes('arrange') || lowerMessage.includes('manage')) {
      return 'organization';
    }
    
    // Optimization patterns  
    if (lowerMessage.includes('improve') || lowerMessage.includes('optimize') || lowerMessage.includes('better') || 
        lowerMessage.includes('enhance') || lowerMessage.includes('upgrade') || lowerMessage.includes('refine')) {
      return 'optimization';
    }
    
    // Default to creation for most requests
    return 'creation';
  };
  
  // Advanced context tracking for agentic persistence
  const trackAgenticContext = (userMessage: string, intent: string) => {
    if (!originalUserIntent) {
      setOriginalUserIntent(userMessage);
      setAgenticRequestType(intent as any);
      console.log('🧠 Agentic context initialized:', { intent, message: userMessage.substring(0, 50) + '...' });
    }
  };
  
  // Intelligent continuation logic based on request type and dashboard state
  const shouldContinueAgentic = (intent: string, totalItems: number, response: string): boolean => {
    const lowerResponse = response.toLowerCase();
    
    // Stop conditions based on intent
    switch (intent) {
      case 'deletion':
        return totalItems > 0; // Continue until all deleted
      case 'lifestyle_change':
      case 'planning':
        return totalItems < 50 && !lowerResponse.includes('complete'); // Build comprehensive system
      case 'goal_setting':
        return totalItems < 20 && !lowerResponse.includes('goals set'); // Create goal framework
      case 'organization':
        return !lowerResponse.includes('organized') && !lowerResponse.includes('structured');
      case 'research':
        return !lowerResponse.includes('research complete') && totalItems < 15;
      case 'optimization':
        return !lowerResponse.includes('optimized') && !lowerResponse.includes('improved');
      default: // creation
        return totalItems < 30; // Build solid foundation
    }
  };
  
  // Enhanced agentic mode continuation with intelligent context awareness
  const continueAgenticMode = async (previousResponse: string, wasDeleteOperation: boolean = false) => {
    if (!isAgenticMode || agenticLoopCount >= maxAgenticLoops) {
      console.log('🛑 Agentic mode stopping: max loops reached or disabled');
      setAgenticLoopCount(0);
      setOriginalUserIntent(null);
      setAgenticRequestType(null);
      return;
    }
    
    // Use original intent for smarter continuation logic
    const currentIntent = agenticRequestType || 'creation';
    const totalItems = items.length;
    
    // Intelligent stopping based on intent and context
    if (!shouldContinueAgentic(currentIntent, totalItems, previousResponse)) {
      console.log('🎯 Agentic mode completing: intent fulfilled', { intent: currentIntent, totalItems });
      await chatService.addMessage('assistant', 'Task completed! I\'ve finished setting up your comprehensive life management system.');
      setIsAgenticMode(false);
      setAgenticLoopCount(0);
      setOriginalUserIntent(null);
      setAgenticRequestType(null);
      return;
    }
    
    // Special handling for delete operations
    if (wasDeleteOperation && currentIntent === 'deletion') {
      if (totalItems === 0) {
        console.log('🛑 Deletion complete: dashboard is empty');
        setAgenticLoopCount(0);
        setOriginalUserIntent(null);
        setAgenticRequestType(null);
        return;
      }
    }

    try {
      setAgenticLoopCount(prev => prev + 1);
      setIsAIThinking(true);

      // Get current item distribution for smarter continuation
      const itemsByCategory = items.reduce((acc: any, item) => {
        acc[item.categoryId] = (acc[item.categoryId] || 0) + 1;
        return acc;
      }, {});
      
      const totalItems = items.length;
      const categoriesWithItems = Object.keys(itemsByCategory).length;
      
      // Check if user wants deletion or creation based on dashboard state
      if (totalItems === 0) {
        // If dashboard is empty, user likely wanted deletion and got it - STOP
        console.log('🛑 Dashboard is empty - stopping agentic mode');
        setAgenticLoopCount(0);
        return;
      }
      
      // Generate contextually intelligent prompt based on original user intent
      const originalRequest = originalUserIntent || 'comprehensive life setup';
      const agenticPrompt = `AGENTIC CONTINUATION - MAINTAINING ORIGINAL INTENT

ORIGINAL USER REQUEST: "${originalRequest}"
REQUEST TYPE: ${currentIntent}
Previous action: "${previousResponse}"

CURRENT DASHBOARD STATE:
- Total items: ${totalItems}
- Active categories: ${categoriesWithItems}/${categories.length}
- Items by category: ${JSON.stringify(itemsByCategory)}

INTELLIGENT CONTINUATION BASED ON INTENT:
${currentIntent === 'deletion' ? 
  '- DELETION MODE: Continue removing items until dashboard is clean'
  : currentIntent === 'lifestyle_change' ?
  '- LIFESTYLE CHANGE: Build comprehensive system for major life transition'
  : currentIntent === 'planning' ?
  '- PLANNING MODE: Create detailed plans and organizational structures'
  : currentIntent === 'goal_setting' ?
  '- GOAL SETTING: Establish clear objectives and tracking systems'
  : currentIntent === 'research' ?
  '- RESEARCH MODE: Gather information and create knowledge systems'
  : currentIntent === 'optimization' ?
  '- OPTIMIZATION MODE: Improve and refine existing systems'
  : '- CREATION MODE: Build foundational life management system'}

CONTEXT-AWARE EXECUTION:
1. Stay true to the original user intent: "${originalRequest}"
2. Build systematically toward that specific goal
3. Create diverse, practical items that serve the original purpose
4. Use appropriate function calls for the request type
5. Focus on underrepresented categories that align with the intent

COMPLETION CRITERIA FOR ${currentIntent.toUpperCase()}:
${currentIntent === 'deletion' ? 
  '- Say "AGENTIC_COMPLETE" when all unwanted items are removed'
  : currentIntent === 'lifestyle_change' ?
  '- Complete when comprehensive system is built for the life transition (40+ relevant items)'
  : currentIntent === 'planning' ?
  '- Complete when detailed plans and structures are in place (25+ organized items)'
  : '- Complete when dashboard comprehensively supports the original goal'}

Execute the next logical action that directly serves the original user intent.`;

      // Process the agentic prompt
      const response = await chatService.processGeorgetownCommand(
        agenticPrompt,
        categories.find(cat => cat.id === currentView)?.id,
        items,
        categories,
        true // Always agentic mode for continuation
      );

      // Handle function calls from agentic mode
      if (response.pendingFunctionCall) {
        console.log('🤖 Agentic mode: Function call received:', response.pendingFunctionCall);
        
        // Add AI response first (without agentic mode prefix)
        await chatService.addMessage('assistant', response.message);
        
        // Show the visual UI for user approval
        const functionCallId = Date.now().toString();
        const newFunctionCall = {
          id: functionCallId,
          name: response.pendingFunctionCall.name,
          args: response.pendingFunctionCall.args
        };
        
        console.log('🔍 DEBUG: Adding agentic function call to pending state:', newFunctionCall);
        setPendingFunctionCalls(prev => {
          const updated = [...prev, newFunctionCall];
          console.log('🔍 DEBUG: Updated pending function calls:', updated);
          return updated;
        });
        
        // Auto-approve if enabled
        if (autoApprove) {
          console.log('🔄 Auto-approving function call:', newFunctionCall.name);
          setTimeout(() => {
            handleApproveFunctionCall(functionCallId);
          }, 1000); // Brief delay to show the UI
        }
        
      } else if (!response.success || response.message.includes('Error processing message')) {
        console.log('🤖 Agentic mode stopping due to error:', response.message);
        await chatService.addMessage('assistant', 'Encountered an issue. Switching back to default mode.');
        setIsAgenticMode(false);
        setAgenticLoopCount(0);
      } else if (response.message.includes('AGENTIC_COMPLETE')) {
        await chatService.addMessage('assistant', 'Task finished! Switching back to default mode.');
        setIsAgenticMode(false);
        setAgenticLoopCount(0);
      } else {
        // No function call and no completion - continue the loop
        await chatService.addMessage('assistant', response.message);
        
        setTimeout(() => {
          continueAgenticMode(response.message);
        }, 2000);
      }
    } catch (error) {
      console.error('Agentic mode error:', error);
      await chatService.addMessage('assistant', 'Encountered an issue. Switching back to default mode.');
      setIsAgenticMode(false);
      setAgenticLoopCount(0);
    } finally {
      setIsAIThinking(false);
    }
  };

  // Smart intent detection - only use function calling when necessary
  const needsFunctionCalling = (transcript: string): boolean => {
    const lowerTranscript = transcript.toLowerCase();
    
    // Action verbs that suggest function calling
    const actionVerbs = [
      'create', 'add', 'make', 'schedule', 'book', 'set', 'update', 'change', 'edit', 'modify',
      'delete', 'remove', 'cancel', 'move', 'reschedule', 'mark', 'complete', 'finish',
      'find', 'search', 'show', 'list', 'get', 'copy', 'generate', 'bulk'
    ];
    
    // Conversational phrases that should NOT trigger functions
    const conversationalPhrases = [
      'how are you', 'what do you think', 'can you explain', 'tell me about',
      'what is', 'how does', 'why', 'thank you', 'thanks', 'okay', 'ok',
      'yes', 'no', 'maybe', 'i think', 'i feel', 'hello', 'hi', 'hey'
    ];
    
    // Check for conversational phrases first
    if (conversationalPhrases.some(phrase => lowerTranscript.includes(phrase))) {
      return false;
    }
    
    // Check for action verbs - simplified to just check for the verb
    return actionVerbs.some(verb => lowerTranscript.includes(verb));
  };

  // Determine if agentic mode should continue based on AI response (Claude Code methodology)
  const needsAgenticContinuation = (response: string): boolean => {
    const lowerResponse = response.toLowerCase();
    
    // Simple greetings and conversational responses should not continue
    const simpleResponses = [
      'hello', 'hi', 'how can i help', 'what can i do', 'how are you',
      'nice to meet you', 'good morning', 'good afternoon', 'good evening'
    ];
    
    // If response is too short or just a greeting, don't continue
    if (response.length < 20 || simpleResponses.some(phrase => lowerResponse.includes(phrase))) {
      return false;
    }
    
    // CLARIFICATION-FIRST INDICATORS (should continue to get more info)
    const clarificationIndicators = [
      'could you tell me', 'what is your', 'do you want', 'would you prefer',
      'a few questions', 'to help you better', 'what timeline', 'what budget',
      'which areas', 'what type of', 'how would you like', 'what are your priorities'
    ];
    
    // EXECUTION INDICATORS (actively working on multi-step tasks)
    const executionIndicators = [
      'created', 'added', 'set up', 'scheduled', 'planned', 'building',
      'next step', 'continuing with', 'working on', 'now creating',
      'step 1', 'step 2', 'first', 'then', 'proceeding to'
    ];
    
    // PLANNING INDICATORS (outlining approach before execution)
    const planningIndicators = [
      "here's my plan", "i'll start by", "my approach", "the strategy",
      "first i'll", "then i'll", "here's how", "let me outline"
    ];
    
    // In agentic mode, continue more aggressively - look for any signs of multi-step work
    const agenticContinueIndicators = [
      ...clarificationIndicators,
      ...executionIndicators, 
      ...planningIndicators,
      // Additional aggressive continuation patterns
      'created', 'added', 'i can', 'i will', 'let me', 'next', 'also', 'then',
      'would you like', 'should i', 'furthermore', 'additionally', 'moreover'
    ];
    
    return agenticContinueIndicators.some(indicator => lowerResponse.includes(indicator));
  };
  
  // Get short confirmation message instead of verbose response
  const getShortConfirmation = (result: any): string => {
    if (result.functionResults && result.functionResults.length > 0) {
      const successCount = result.functionResults.filter((r: any) => r.success !== false).length;
      return successCount > 0 ? `✅ Done! (${successCount} action${successCount > 1 ? 's' : ''})` : '❌ Failed';
    }
    return result.success ? '✅ Done!' : '❌ Failed';
  };
  
  // Inject function results back into voice context for natural conversation
  const injectResultIntoVoiceContext = async (result: any) => {
    try {
      if (!currentVoiceServiceRef.current) return;
      
      // Create a context message that the AI can reference
      const contextMessage = {
        role: 'assistant',
        content: `[FUNCTION EXECUTED] ${result.response}`,
        timestamp: Date.now()
      };
      
      // Store in a conversation context that voice services can access
      if (currentVoiceServiceRef.current.addToContext) {
        await currentVoiceServiceRef.current.addToContext(contextMessage);
      }
      
      console.log('📤 Injected function result into voice context:', contextMessage);
    } catch (error) {
      console.error('❌ Error injecting result into voice context:', error);
    }
  };
  
  // Smart voice message processing - only use functions when needed
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const processVoiceMessage = useCallback(async (transcript: string) => {
    if (!transcript.trim()) return;
    
    try {
      // Smart intent detection - don't run functions for conversational messages
      if (!needsFunctionCalling(transcript)) {
        console.log('💬 Conversational message detected, skipping function calling:', transcript);
        return;
      }
      
      setIsProcessingFunction(true);
      console.log('🎯 Action message detected, processing with function calling:', transcript);
      
      // Process message through Gemini service with function calling
      const result = await geminiService.processMessage(transcript, items, []);
      
      console.log('✅ Function calling result:', result);
      
      if (result.success) {
        // For voice mode, inject the result back into the conversation context
        if (currentVoiceServiceRef.current) {
          await injectResultIntoVoiceContext(result);
        }
        
        // Show brief confirmation, not full result
        setFunctionResult(getShortConfirmation(result));
        
        // Auto-dismiss after 3 seconds for successful actions
        if (result.success && !result.response.includes('Error')) {
          setTimeout(() => {
            setFunctionResult(null);
          }, 3000);
        }
        
        // If items were modified, refresh the UI
        if (result.itemsModified) {
          console.log('✅ Items were modified, calling onRefreshItems');
          onRefreshItems();
        }
      } else {
        console.error('❌ Function calling failed:', result);
        setFunctionResult(`Error: ${result.response}`);
      }
    } catch (error) {
      console.error('❌ Error processing voice message:', error);
      setFunctionResult(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessingFunction(false);
    }
  }, [items, onRefreshItems]);
  
  // Real-time subscriptions handle data updates - custom event listener removed to prevent duplicate refreshes
  
  // Voice mode states with persistence
  const [selectedVoiceModel, setSelectedVoiceModel] = useState<VoiceModel>(() => {
    try {
      const saved = localStorage.getItem('georgetownAI_voiceModel');
      if (saved) {
        const savedModel = JSON.parse(saved);
        const foundModel = VOICE_MODELS.find(m => m.id === savedModel.id && m.provider === savedModel.provider);
        return foundModel || VOICE_MODELS[0];
      }
    } catch (error) {
      console.warn('Failed to load saved voice model:', error);
    }
    return VOICE_MODELS[0];
  });
  
  const [selectedOpenAIVoice, setSelectedOpenAIVoice] = useState(() => {
    try {
      const saved = localStorage.getItem('georgetownAI_openaiVoice');
      if (saved) {
        const savedVoice = JSON.parse(saved);
        const foundVoice = OPENAI_VOICES.find(v => v.id === savedVoice.id);
        return foundVoice || OPENAI_VOICES[0];
      }
    } catch (error) {
      console.warn('Failed to load saved OpenAI voice:', error);
    }
    return OPENAI_VOICES[0];
  });
  
  const [selectedGeminiVoice, setSelectedGeminiVoice] = useState(() => {
    try {
      const saved = localStorage.getItem('georgetownAI_geminiVoice');
      if (saved) {
        const savedVoice = JSON.parse(saved);
        const foundVoice = GEMINI_VOICES.find(v => v.id === savedVoice.id);
        return foundVoice || GEMINI_VOICES[0];
      }
    } catch (error) {
      console.warn('Failed to load saved Gemini voice:', error);
    }
    return GEMINI_VOICES[0];
  });
  const [isVoiceConnected, setIsVoiceConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [voiceActivity, setVoiceActivity] = useState(0);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showVoicePicker, setShowVoicePicker] = useState(false);
  
  // Chat state
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [allSessions, setAllSessions] = useState<ChatSession[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [pendingFunctionCall, setPendingFunctionCall] = useState<any>(null);
  
  // Sidebar-specific state
  const [isResizing, setIsResizing] = useState(false);
  
  // Voice recording state (for transcription)
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  // Drag and drop state
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<ContextAwareInputRef>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);
  
  // Voice mode refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number>();
  const currentVoiceServiceRef = useRef<any>(null);

  // Theme colors
  const themeColors = {
    primary: isDarkMode ? '#1a1b23' : '#ffffff',
    secondary: isDarkMode ? '#2a2d37' : '#f8fafc',
    accent: '#6366f1',
    text: isDarkMode ? '#e2e8f0' : '#1e293b',
    muted: isDarkMode ? '#64748b' : '#94a3b8',
    border: isDarkMode ? '#374151' : '#e2e8f0',
    glass: isDarkMode ? 'rgba(26, 27, 35, 0.8)' : 'rgba(255, 255, 255, 0.8)',
  };

  // Initialize and subscribe to chat service
  useEffect(() => {
    const initializeChat = async () => {
      await chatService.initialize();
    
    const unsubscribe = chatService.subscribe((state) => {
      setCurrentSession(chatService.getCurrentSession());
      setAllSessions(chatService.getAllSessions());
      setIsProcessing(state.isProcessing);
    });

    return unsubscribe;
    };

    let unsubscribe: (() => void) | undefined;
    initializeChat().then((unsub) => {
      unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession?.messages]);

  // DISABLED: Real-time context updates were causing continuous screen refreshing
  // Voice services will get context at connection time only to prevent refresh loops

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current && !isCollapsed && !isVoiceMode) {
      inputRef.current.focus();
    }
  }, [isOpen, isCollapsed, isVoiceMode]);

  // Cleanup voice service on unmount
  useEffect(() => {
    return () => {
      voiceService.cleanup();
      disconnectVoiceService();
    };
  }, []);

  // Persist agentic mode state
  useEffect(() => {
    const savedAgenticMode = localStorage.getItem('aiAssistantAgenticMode');
    if (savedAgenticMode === 'true') {
      setIsAgenticMode(true);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('aiAssistantAgenticMode', isAgenticMode.toString());
  }, [isAgenticMode]);

  // Voice mode canvas animation
  const drawVoiceOrb = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const baseRadius = Math.min(width, height) / 3;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Calculate activity-based scaling (no activity when muted)
    const voiceTime = Date.now() * 0.003; // Slightly faster breathing effect
    
    // Enhanced breathing effect when connected but not actively listening  
    const breathingActivity = isVoiceConnected && !isMuted && !isListening && voiceActivity < 0.1 
      ? 0.2 + Math.sin(voiceTime) * 0.15 + Math.sin(voiceTime * 1.3) * 0.05 // More complex breathing pattern
      : 0;
    
    const currentActivity = isMuted ? 0 : Math.max(voiceActivity, breathingActivity, isListening ? 0.3 : 0);
    const radius = baseRadius * (1 + currentActivity * 0.3);
    
    // Create gradient background
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    gradient.addColorStop(0, `rgba(147, 51, 234, ${0.8 + currentActivity * 0.2})`);
    gradient.addColorStop(0.6, `rgba(124, 58, 237, ${0.6 + currentActivity * 0.2})`);
    gradient.addColorStop(1, `rgba(88, 28, 135, ${0.3 + currentActivity * 0.2})`);
    
    // Draw main orb
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Add waterfall particles
    const particleCount = 15 + Math.floor(currentActivity * 25);
    const time = Date.now() * 0.001;
    
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2 + time * 0.5;
      const distance = radius * 0.3 + Math.sin(time * 2 + i) * radius * 0.2;
      const x = centerX + Math.cos(angle) * distance;
      const y = centerY + Math.sin(angle) * distance + Math.sin(time * 3 + i) * 10;
      const size = 1 + currentActivity * 2 + Math.sin(time * 4 + i) * 0.5;
      const opacity = 0.4 + currentActivity * 0.6;
      
      ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Glass effect
    const glassGradient = ctx.createRadialGradient(
      centerX - radius * 0.3, centerY - radius * 0.3, 0,
      centerX, centerY, radius
    );
    glassGradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
    glassGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
    glassGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = glassGradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
    
    animationRef.current = requestAnimationFrame(drawVoiceOrb);
  }, [voiceActivity, isSpeaking, isListening, isMuted]);

  // Audio analysis for voice activity detection
  const setupAudioAnalysis = useCallback(async () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const audioContext = audioContextRef.current;
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
          channelCount: 1
        } 
      });
      const source = audioContext.createMediaStreamSource(stream);
      
      analyserRef.current = audioContext.createAnalyser();
      analyserRef.current.fftSize = 512; // Higher resolution for better voice detection
      analyserRef.current.smoothingTimeConstant = 0.7; // Slightly more responsive
      
      source.connect(analyserRef.current);
      
      const analyzeAudio = () => {
        if (!analyserRef.current) return;
        
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / dataArray.length);
        const activity = Math.min(rms / 128, 1);
        
        setVoiceActivity(activity);
        requestAnimationFrame(analyzeAudio);
      };
      
      analyzeAudio();
    } catch (error) {
      console.error('Failed to setup audio analysis:', error);
    }
  }, []);

  // Voice service management
  const connectVoiceService = useCallback(async () => {
    try {
      console.log('🚀 CONNECTING VOICE SERVICE...');
      console.log('📊 Selected model:', selectedVoiceModel);
      console.log('📊 Items count:', items?.length || 0);
      console.log('📊 Categories count:', categories?.length || 0);
      
      const provider = selectedVoiceModel.provider;
      console.log('🎯 Provider:', provider);
      
      // Check API keys first
      if (provider === 'gemini') {
        const geminiApiKey = process.env.REACT_APP_GEMINI_API_KEY;
        if (!geminiApiKey) {
          throw new Error('Gemini API key not found. Please add REACT_APP_GEMINI_API_KEY to your .env file.');
        }
        console.log('🔑 GEMINI API Key found:', geminiApiKey.substring(0, 20) + '...');
      } else {
        const openaiApiKey = process.env.REACT_APP_OPENAI_API_KEY;
        console.log('🔑 OPENAI API Key check:', openaiApiKey ? 'Found' : 'Not found (will try backend server)');
      }
      
      // Set a timeout to prevent infinite connecting state
      let hasTimedOut = false;
      const connectionTimeout = setTimeout(() => {
        if (!hasTimedOut) {
          hasTimedOut = true;
          console.error('❌ CONNECTION TIMEOUT - Taking too long to connect');
          setIsVoiceConnected(false);
          setIsVoiceMode(false);
          alert('Voice connection timed out. Please try again.');
        }
      }, 5000); // 5 second timeout - faster response for better UX
      
      if (provider === 'gemini') {
        currentVoiceServiceRef.current = new GeminiLiveService();
        
        // Configure with Supabase callbacks if available
        if (supabaseCallbacks && typeof currentVoiceServiceRef.current.setSupabaseCallbacks === 'function') {
          console.log('✅ AIAssistant: Configuring GeminiLiveService with Supabase callbacks');
          currentVoiceServiceRef.current.setSupabaseCallbacks(supabaseCallbacks);
        }
        
        // Set up event handlers
        currentVoiceServiceRef.current.onConnectionState((connected: boolean) => {
          console.log('🔗 GEMINI VOICE: Connection state changed:', connected);
          if (!hasTimedOut) {
            hasTimedOut = true;
            clearTimeout(connectionTimeout);
          }
          setIsVoiceConnected(connected);
          if (!connected) {
            setIsListening(false);
            setIsSpeaking(false);
          }
        });

        currentVoiceServiceRef.current.onTranscript((transcript: any) => {
          console.log('📝 GEMINI VOICE: Transcript received:', transcript);
          if (transcript.text && transcript.text.trim()) {
            // Only show AI responses in live transcription, not user speech
            if (!transcript.isUser) {
              setCurrentTranscript(transcript.text);
            }
            // Note: Function calling is handled by Gemini Live Service itself
          }
        });
        
        currentVoiceServiceRef.current.onListeningState((listening: boolean) => {
          console.log('🎤 GEMINI VOICE: Listening state:', listening);
          setIsListening(listening);
        });

        // Hook up speaking state if available
        if (typeof currentVoiceServiceRef.current.onSpeakingState === 'function') {
          currentVoiceServiceRef.current.onSpeakingState((speaking: boolean) => {
            console.log('🗣️ GEMINI VOICE: Speaking state:', speaking);
            setIsSpeaking(speaking);
          });
        }

        currentVoiceServiceRef.current.onAudioLevel((level: number) => {
          setVoiceActivity(level);
        });

        currentVoiceServiceRef.current.onError((error: string) => {
          console.error('❌ GEMINI VOICE: Error:', error);
          if (!hasTimedOut) {
            hasTimedOut = true;
            clearTimeout(connectionTimeout);
          }
          setIsVoiceConnected(false);
          setIsVoiceMode(false);
        });

        // Listen for function calls from Gemini Live Service
        if (typeof currentVoiceServiceRef.current.onFunctionCall === 'function') {
          currentVoiceServiceRef.current.onFunctionCall((functionCall: any) => {
            console.log('🔧 GEMINI VOICE: Function call detected:', functionCall);
            setIsProcessingFunction(true);
            setFunctionResult('Processing...');
            
            // Auto-dismiss after 3 seconds
            setTimeout(() => {
              setIsProcessingFunction(false);
              setFunctionResult('✅ Done!');
              setTimeout(() => setFunctionResult(null), 2000);
              // Real-time subscriptions handle data updates - no manual refresh needed
            }, 1000);
          });
        }
        
        console.log('🔗 CONNECTING GEMINI with config:', {
          model: selectedVoiceModel.id,
          voice: selectedGeminiVoice.id,
          hasApiKey: !!process.env.REACT_APP_GEMINI_API_KEY,
          itemsCount: items?.length || 0,
          categoriesCount: categories?.length || 0
        });
        
        await currentVoiceServiceRef.current.connect({
          model: selectedVoiceModel.id,
          voice: selectedGeminiVoice.id,
          apiKey: process.env.REACT_APP_GEMINI_API_KEY!,
          items,
          categories,
          onRefreshItems
        });
        
        // Ensure AudioContext is resumed and microphone access for Gemini
        if (window.AudioContext || (window as any).webkitAudioContext) {
          console.log('🔊 Ensuring AudioContext and microphone access for Gemini...');
          
          // Request microphone permission explicitly for Gemini
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 16000,
                channelCount: 1
              } 
            });
            console.log('🎤 Microphone access granted for Gemini');
            
            // Stop the test stream immediately
            stream.getTracks().forEach(track => track.stop());
            
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            if (audioContext.state === 'suspended') {
              await audioContext.resume();
              console.log('✅ AudioContext resumed');
            }
            audioContext.close(); // Close temporary context
          } catch (error) {
            console.error('❌ Microphone access failed for Gemini:', error);
            throw new Error('Microphone access required for Gemini voice chat');
          }
        }
      } else {
        currentVoiceServiceRef.current = openaiRealtimeService;
        
        // Configure Supabase callbacks for authenticated users
        if (supabaseCallbacks && typeof currentVoiceServiceRef.current.setSupabaseCallbacks === 'function') {
          console.log('✅ AIAssistant: Configuring OpenAI Realtime Service with Supabase callbacks');
          currentVoiceServiceRef.current.setSupabaseCallbacks(supabaseCallbacks);
        }
        
        // Set up event handlers
        currentVoiceServiceRef.current.onConnectionState((connected: boolean) => {
          console.log('🔗 OPENAI VOICE: Connection state changed:', connected);
          if (!hasTimedOut) {
            hasTimedOut = true;
            clearTimeout(connectionTimeout);
          }
          setIsVoiceConnected(connected);
          if (!connected) {
            setIsListening(false);
            setIsSpeaking(false);
          }
        });
        
        currentVoiceServiceRef.current.onTranscript((transcript: any) => {
          console.log('📝 OPENAI VOICE: Transcript received:', transcript);
          if (transcript.text && transcript.text.trim()) {
            // Only show AI responses in live transcription, not user speech
            if (!transcript.isUser) {
              setCurrentTranscript(transcript.text);
            }
            // Note: Function calling is handled by OpenAI Realtime Service itself
          }
        });

        currentVoiceServiceRef.current.onListeningState((listening: boolean) => {
          console.log('🎤 OPENAI VOICE: Listening state:', listening);
          setIsListening(listening);
        });

        // Hook up speaking state if available
        if (typeof currentVoiceServiceRef.current.onSpeakingState === 'function') {
          currentVoiceServiceRef.current.onSpeakingState((speaking: boolean) => {
            console.log('🗣️ OPENAI VOICE: Speaking state:', speaking);
            setIsSpeaking(speaking);
          });
        }

        currentVoiceServiceRef.current.onAudioLevel((level: number) => {
          setVoiceActivity(level);
        });

        currentVoiceServiceRef.current.onError((error: string) => {
          console.error('❌ OPENAI VOICE: Error:', error);
          if (!hasTimedOut) {
            hasTimedOut = true;
            clearTimeout(connectionTimeout);
          }
          setIsVoiceConnected(false);
          setIsVoiceMode(false);
        });

        // Listen for function calls from OpenAI Realtime Service
        if (typeof currentVoiceServiceRef.current.onFunctionCall === 'function') {
          currentVoiceServiceRef.current.onFunctionCall((functionCall: any) => {
            console.log('🔧 OPENAI VOICE: Function call detected:', functionCall);
            setIsProcessingFunction(true);
            setFunctionResult('Processing...');
            
            // Auto-dismiss after 3 seconds
            setTimeout(() => {
              setIsProcessingFunction(false);
              setFunctionResult('✅ Done!');
              setTimeout(() => setFunctionResult(null), 2000);
              // Real-time subscriptions handle data updates - no manual refresh needed
            }, 1000);
          });
        }

        // Listen for function processing state from OpenAI Realtime Service
        if (typeof currentVoiceServiceRef.current.onFunctionProcessing === 'function') {
          currentVoiceServiceRef.current.onFunctionProcessing((isProcessing: boolean) => {
            console.log('🔧 OPENAI VOICE: Function processing state:', isProcessing);
            setIsProcessingFunction(isProcessing);
            if (isProcessing) {
              setFunctionResult('Processing...');
            }
          });
        }
        
        console.log('🔗 CONNECTING OPENAI with config:', {
          model: selectedVoiceModel.id,
          voice: selectedOpenAIVoice.id,
          hasApiKey: !!process.env.REACT_APP_OPENAI_API_KEY,
          itemsCount: items?.length || 0,
          categoriesCount: categories?.length || 0
        });
        
        await currentVoiceServiceRef.current.connect({
          model: selectedVoiceModel.id,
          voice: selectedOpenAIVoice.id,
          apiKey: process.env.REACT_APP_OPENAI_API_KEY,
          items,
          categories,
          onRefreshItems
        });
      }
      
      // Set up audio analysis
      await setupAudioAnalysis();
      
      // If no connection state event comes within 5 seconds, assume connected
      setTimeout(() => {
        if (!isVoiceConnected && currentVoiceServiceRef.current && !hasTimedOut) {
          console.log('🔄 No connection event received, manually setting connected state');
          hasTimedOut = true;
          clearTimeout(connectionTimeout);
          setIsVoiceConnected(true);
        }
      }, 5000);
      
      console.log('🎤 Connection initiated, waiting for connection state...');
      
    } catch (error) {
      console.error('Failed to connect voice service:', error);
      setIsVoiceConnected(false);
      setIsVoiceMode(false);
      setIsListening(false);
      setIsSpeaking(false);
      // Show user-friendly error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Voice connection failed: ${errorMessage}`);
    }
  }, [selectedVoiceModel, selectedOpenAIVoice, selectedGeminiVoice, items, categories, onRefreshItems, setupAudioAnalysis]);

  const disconnectVoiceService = useCallback(async () => {
    console.log('🔌 DISCONNECTING VOICE SERVICE...');
    if (!currentVoiceServiceRef.current) {
      console.warn('⚠️ Disconnect called but no service active.');
      return;
    }
    
    // Immediately stop all voice activities
    const service = currentVoiceServiceRef.current;
    currentVoiceServiceRef.current = null; // Prevent race conditions
    
    try {
      await service.disconnect();
    } catch (error) {
      console.warn('⚠️ Error during service.disconnect():', error);
    }
    
    // Clean up audio context
    if (audioContextRef.current) {
      try {
        await audioContextRef.current.close();
        audioContextRef.current = null;
      } catch (error) {
        console.warn('⚠️ Error closing audio context:', error);
      }
    }
    
    // Cancel animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = undefined;
    }
    
    // Reset all states immediately
    setIsVoiceConnected(false);
    setVoiceActivity(0);
    setIsListening(false);
    setIsSpeaking(false);
    setIsMuted(false);
    setCurrentTranscript('');
    
    console.log('✅ VOICE SERVICE DISCONNECTED');
  }, []);

  // Toggle voice mode with comprehensive error handling
  const toggleVoiceMode = useCallback(async () => {
    console.log('🎙️ TOGGLE VOICE MODE - Current state:', isVoiceMode);
    console.log('🎙️ Current voice selections:', {
      model: selectedVoiceModel,
      openaiVoice: selectedOpenAIVoice,
      geminiVoice: selectedGeminiVoice
    });
    console.log('🎙️ Current connection state:', {
      isVoiceConnected,
      hasService: !!currentVoiceServiceRef.current
    });
    
    // Prevent multiple rapid clicks
    if (currentVoiceServiceRef.current && !isVoiceMode) {
      console.log('⚠️ Voice service already exists, cleaning up first...');
      await disconnectVoiceService();
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    if (isVoiceMode) {
      // Exit voice mode
      console.log('🔚 EXITING VOICE MODE...');
      try {
        disconnectVoiceService();
        setIsVoiceMode(false);
        console.log('✅ VOICE MODE EXITED SUCCESSFULLY');
      } catch (error) {
        console.error('❌ ERROR EXITING VOICE MODE:', error);
        // Force reset even if there's an error
        setIsVoiceMode(false);
        setIsVoiceConnected(false);
        setIsListening(false);
        setIsSpeaking(false);
      }
    } else {
      // Enter voice mode
      console.log('🎤 ENTERING VOICE MODE...');
      
      // Validate voice selections before connecting
      if (selectedVoiceModel.provider === 'openai' && !selectedOpenAIVoice.id) {
        console.error('❌ No OpenAI voice selected');
        alert('Please select an OpenAI voice before starting voice mode');
        return;
      }
      
      if (selectedVoiceModel.provider === 'gemini' && !selectedGeminiVoice.id) {
        console.error('❌ No Gemini voice selected');
        alert('Please select a Gemini voice before starting voice mode');
        return;
      }
      
      try {
        setIsVoiceMode(true);
        await connectVoiceService();
        console.log('✅ VOICE MODE ACTIVATED SUCCESSFULLY');
      } catch (error) {
        console.error('❌ FAILED TO ACTIVATE VOICE MODE:', error);
        console.error('❌ Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          selectedModel: selectedVoiceModel,
          selectedOpenAIVoice: selectedOpenAIVoice,
          selectedGeminiVoice: selectedGeminiVoice
        });
        
        setIsVoiceMode(false);
        setIsVoiceConnected(false);
        
        // Show user-friendly error with more details
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        alert(`Failed to activate voice mode: ${errorMessage}\n\nCheck console for more details.`);
      }
    }
  }, [isVoiceConnected, isMuted, connectVoiceService, disconnectVoiceService, selectedVoiceModel, selectedOpenAIVoice, selectedGeminiVoice]);

  // Start canvas animation when voice mode is active
  useEffect(() => {
    if (isVoiceMode && canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = 200;
      canvas.height = 200;
      drawVoiceOrb();
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isVoiceMode, drawVoiceOrb]);

  // Auto-start listening when voice service connects (simplified)
  useEffect(() => {
    if (isVoiceConnected && currentVoiceServiceRef.current && !isMuted) {
      console.log('🎤 VOICE CONNECTED - Auto-starting listening...');
      const timeoutId = setTimeout(async () => {
        if (currentVoiceServiceRef.current && isVoiceConnected && !isMuted) {
          try {
            await currentVoiceServiceRef.current.startListening();
            console.log('✅ Auto-start listening successful');
          } catch (error) {
            console.error('❌ Failed to auto-start listening:', error);
          }
        }
      }, 1000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [isVoiceConnected, isMuted]);

  // Handle provider switching (Gemini ↔ OpenAI) - requires full reconnection
  useEffect(() => {
    if (isVoiceMode && isVoiceConnected && currentVoiceServiceRef.current) {
      console.log('🔄 Provider/model changed, disconnecting and reconnecting...');
      
      // Disconnect the current service cleanly
      disconnectVoiceService();
      
      // Reconnect after a short delay to ensure all cleanup is complete
      const reconnectTimeout = setTimeout(() => {
        // Ensure we are still in voice mode before reconnecting
        if (isVoiceMode && isOpen && !isCollapsed) {
          connectVoiceService();
        }
      }, 1000); // 1 second delay for provider switching

      return () => clearTimeout(reconnectTimeout);
    }
  }, [selectedVoiceModel.id]); // Reconnect when voice model (provider) changes

  // Handle voice switching within the same provider (Gemini voices only)
  useEffect(() => {
    // Only act if we are in voice mode, connected, and the provider is Gemini
    if (isVoiceMode && isVoiceConnected && selectedVoiceModel.provider === 'gemini' && currentVoiceServiceRef.current) {
      console.log('🔄 Gemini voice changed, reconnecting service...');
      
      // Disconnect the current service cleanly
      disconnectVoiceService();
      
      // Reconnect after a shorter delay for same-provider voice switching
      const reconnectTimeout = setTimeout(() => {
        // Ensure we are still in voice mode before reconnecting
        if (isVoiceMode && isOpen && !isCollapsed) {
          connectVoiceService();
        }
      }, 500); // 500ms delay for voice switching within same provider

      return () => clearTimeout(reconnectTimeout);
    }
  }, [selectedGeminiVoice.id]); // Dependency on the voice ID ensures this runs only on voice change

  // Handle OpenAI voice switching within the same provider
  useEffect(() => {
    // Only act if we are in voice mode, connected, and the provider is OpenAI
    if (isVoiceMode && isVoiceConnected && selectedVoiceModel.provider === 'openai' && currentVoiceServiceRef.current) {
      console.log('🔄 OpenAI voice changed, reconnecting service...');
      
      // Disconnect the current service cleanly
      disconnectVoiceService();
      
      // Reconnect after a shorter delay for same-provider voice switching
      const reconnectTimeout = setTimeout(() => {
        // Ensure we are still in voice mode before reconnecting
        if (isVoiceMode && isOpen && !isCollapsed) {
          connectVoiceService();
        }
      }, 500); // 500ms delay for voice switching within same provider

      return () => clearTimeout(reconnectTimeout);
    }
  }, [selectedOpenAIVoice.id]); // Dependency on the voice ID ensures this runs only on voice change

  // Cleanup on unmount to prevent multiple instances
  useEffect(() => {
    return () => {
      console.log('🧹 COMPONENT UNMOUNTING - Cleaning up voice service...');
      if (currentVoiceServiceRef.current) {
        disconnectVoiceService();
      }
    };
  }, [disconnectVoiceService]);

  // Persist voice model selection
  useEffect(() => {
    try {
      localStorage.setItem('georgetownAI_voiceModel', JSON.stringify(selectedVoiceModel));
    } catch (error) {
      console.warn('Failed to save voice model:', error);
    }
  }, [selectedVoiceModel]);

  // Persist OpenAI voice selection
  useEffect(() => {
    try {
      localStorage.setItem('georgetownAI_openaiVoice', JSON.stringify(selectedOpenAIVoice));
    } catch (error) {
      console.warn('Failed to save OpenAI voice:', error);
    }
  }, [selectedOpenAIVoice]);

  // Persist Gemini voice selection
  useEffect(() => {
    try {
      localStorage.setItem('georgetownAI_geminiVoice', JSON.stringify(selectedGeminiVoice));
    } catch (error) {
      console.warn('Failed to save Gemini voice:', error);
    }
  }, [selectedGeminiVoice]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showModeDropdown && !(event.target as Element)?.closest('.mode-dropdown')) {
        setShowModeDropdown(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showModeDropdown]);

  // Note: Textarea resize handling is now handled internally by ContextAwareInput component

  // Sidebar resize handlers
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const handleResizeMouseMove = useCallback((e: MouseEvent) => {
    if (isResizing && onResize) {
      const newWidth = window.innerWidth - e.clientX;
      const maxWidth = window.innerWidth / 2; // Limit to half screen width
      const constrainedWidth = Math.min(Math.max(newWidth, 300), maxWidth); // Min 300px, max half screen
      onResize(constrainedWidth);
    }
  }, [isResizing, onResize]);

  const handleResizeMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMouseMove);
      document.addEventListener('mouseup', handleResizeMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleResizeMouseMove);
        document.removeEventListener('mouseup', handleResizeMouseUp);
      };
    }
  }, [isResizing, handleResizeMouseMove, handleResizeMouseUp]);

  // Voice recording functions
  const startVoiceRecording = async () => {
    try {
      setIsRecording(true);
      setRecordingDuration(0);
      await voiceService.startRecording();
      
      // Start duration counter
      const interval = setInterval(() => {
        if (voiceService.getRecordingState()) {
          setRecordingDuration(voiceService.getCurrentDuration());
        } else {
          clearInterval(interval);
        }
      }, 100);
    } catch (error) {
      console.error('Error starting voice recording:', error);
      setIsRecording(false);
    }
  };

  const stopVoiceRecording = async () => {
    try {
      const recording = await voiceService.stopRecording();
      setIsRecording(false);
      
      // Start transcription
      setIsTranscribing(true);
      const currentCategoryId = categories.find(cat => cat.id === currentView)?.id;
      const transcriptionResult = await voiceService.transcribeWithContext(recording.blob, currentCategoryId);
      
      // Set the transcribed text in the input
      setInputMessage(transcriptionResult.text);
      setIsTranscribing(false);
      
      // Focus the input for editing if needed
      if (inputRef.current) {
        inputRef.current.focus();
      }
      
    } catch (error) {
      console.error('Error with voice recording/transcription:', error);
      setIsRecording(false);
      setIsTranscribing(false);
    }
  };

  const handleVoiceButtonClick = () => {
    if (isRecording) {
      stopVoiceRecording();
    } else {
      startVoiceRecording();
    }
  };

  const handleSendMessage = async () => {
    let messageToSend = inputMessage.trim();
    const hasImages = selectedImages.length > 0;
    
    if (!messageToSend && !hasImages) return;

    // Process @mentions: enhance @ItemName with ID lookup for AI precision
    const processedMessage = messageToSend.replace(/@([^\s]+)/g, (match, itemName) => {
      // Find the item by name to get the ID
      const foundItem = items.find(item => 
        item.title.toLowerCase() === itemName.toLowerCase() ||
        item.title.toLowerCase().replace(/[^a-z0-9]/g, '') === itemName.toLowerCase().replace(/[^a-z0-9]/g, '')
      );
      
      if (foundItem) {
        // For AI, provide both name and ID for precision
        return `@${foundItem.title} (ID: ${foundItem.id})`;
      }
      
      // If no item found, keep original mention
      return match;
    });

    // COMPREHENSIVE DEBUG - Let's see what's actually happening
    console.log('🐛 COMPREHENSIVE DEBUG - handleSendMessage');
    console.log('🐛 original messageToSend:', messageToSend);
    console.log('🐛 processed messageToSend:', processedMessage);
    console.log('🐛 currentNoteContent:', currentNoteContent);
    console.log('🐛 currentNoteContent type:', typeof currentNoteContent);
    console.log('🐛 currentNoteContent !== undefined?', currentNoteContent !== undefined);
    console.log('🐛 onUpdateNoteContent exists?', !!onUpdateNoteContent);
    console.log('🐛 currentNoteTitle:', currentNoteTitle);

    // Note editing patterns - DEPRECATED, keeping for legacy support only
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const noteEditingPatterns = [
      /^(add to my note|write to my note|append to note|add to note|write to note|append note|note add|note write|note append)(.*)$/i,
      /^(replace my note|rewrite my note|replace note|rewrite note|note replace|note rewrite)(.*)$/i,
      /^(prepend to my note|add to beginning|prepend note|note prepend)(.*)$/i,
      /^write (.+)/i,
      /^add (.+)/i,
      /^create (.+)/i,
      /^generate (.+)/i,
      /^make (.+)/i,
      /^draft (.+)/i,
      /^compose (.+)/i,
      /^append (.+)/i,
      /^insert (.+)/i
    ];

    // Simple check: are we in fullscreen note mode?
    if (currentNoteContent !== undefined) {
      console.log('🐛 FULLSCREEN NOTE MODE DETECTED!');
      console.log('🐛 Note content length:', currentNoteContent.length);
      console.log('🐛 Note title:', currentNoteTitle);
      console.log('🐛 User message:', messageToSend);
    } else {
      console.log('🐛 REGULAR CHAT MODE - currentNoteContent is undefined');
    }
    
    setInputMessage('');
    setSelectedImages([]);
    setIsRecording(false);
    
    chatService.setProcessing(true);
    setIsAIThinking(true);
    
    try {
      // Emergency session check - ensure we have an active session
      let currentSession = chatService.getCurrentSession();
      if (!currentSession) {
        console.warn('⚠️ No active session found in handleSendMessage, reinitializing...');
        await chatService.initialize();
        currentSession = chatService.getCurrentSession();
        
        // If still no session, force create one
        if (!currentSession) {
          console.error('❌ Still no session after initialize, force creating...');
                  const emergencySession = await chatService.createSession('Emergency Chat');
          chatService.switchToSession(emergencySession.id);
        }
      }
    
      // Add user message (store original with @mentions for display, send processed to AI)
      await chatService.addMessage('user', messageToSend);

      // In fullscreen note mode, handle everything as normal chat but with note context
      if (currentNoteContent !== undefined && onUpdateNoteContent) {
        // We're in fullscreen note mode - provide note context but don't disable item management
        const noteContext = currentNoteTitle ? `Current note title: "${currentNoteTitle}"\n` : '';
        const contentContext = `Current note content (${currentNoteContent.length} characters):\n${currentNoteContent}\n\n`;
        const wordCount = currentNoteContent.split(' ').filter(w => w.trim()).length;
        
        // Enhanced message with note context and special instructions
        let processMessage = `FULLSCREEN NOTE MODE CONTEXT:
${noteContext}${contentContext}Word count: ${wordCount} words.

CRITICAL RESTRICTIONS FOR FULLSCREEN NOTE MODE:
- You are ONLY allowed to help with the current note shown above
- DO NOT create any new notes, todos, goals, routines, or events
- DO NOT edit any other items except the current note
- DO NOT use createItem, bulkCreateItems, or any creation functions
- ONLY use updateItem if specifically asked to modify THIS current note
- Focus exclusively on discussing, analyzing, or improving the current note content
- If asked to create other items, politely decline and suggest they exit fullscreen mode

You can:
1. Answer questions about the current note content
2. Suggest improvements to the current note
3. Analyze or summarize the current note
4. Help brainstorm ideas related to the current note content
5. ONLY modify THIS note if explicitly requested (using updateItem)

User message: ${processedMessage}`;

        console.log('🔧 Fullscreen note mode - processing message:', processMessage);

        const response = await chatService.processGeorgetownCommand(
          processMessage, 
          categories.find(cat => cat.id === currentView)?.id,
          items,
          categories,
          isAgenticMode
        );

        console.log('🔧 Fullscreen note mode - got response:', response);
        console.log('🔧 Response success:', response.success);
        console.log('🔧 Response message:', response.message);

        // Check if there's a pending function call
        if (response.pendingFunctionCall) {
          // For Cursor-like experience: AI response and function call should appear together
          const functionCallId = Date.now().toString();
          const newFunctionCall = {
            id: functionCallId,
            name: response.pendingFunctionCall.name,
            args: response.pendingFunctionCall.args
          };
          
          // Add AI response with function call immediately following
          let aiResponse = response.message;
          if (hasImages) {
            aiResponse = `I can see the image${selectedImages.length > 1 ? 's' : ''} you uploaded. ${aiResponse}`;
          }
          await chatService.addMessage('assistant', aiResponse);
          
          // Immediately show function call UI
          console.log('🔍 DEBUG: Adding function call to pending state:', newFunctionCall);
          setPendingFunctionCalls(prev => {
            const updated = [...prev, newFunctionCall];
            console.log('🔍 DEBUG: Updated pending function calls:', updated);
            return updated;
          });
          
          // Auto-approve logic
          console.log('🔍 DEBUG: Auto-approve enabled?', autoApprove);
          if (autoApprove) {
            console.log('🔄 Auto-approving function call:', newFunctionCall.name, 'with ID:', functionCallId);
            setTimeout(() => {
              console.log('🔄 Executing auto-approval for:', functionCallId);
              handleApproveFunctionCall(functionCallId);
            }, 1000);
          } else {
            console.log('⏸️ Auto-approve disabled, waiting for manual approval');
          }
        } else {
          // In note mode, if AI modified items, check if it was the current note
          if (response.itemsModified) {
            // Real-time subscriptions handle updates - no manual refresh needed
            // The note content will be updated through the normal item update flow
            
            // SAFE FIX: Add a small delay to allow localStorage to be updated, then trigger note refresh
            // This mimics how the working AI Summary and AI Improve functions work
            setTimeout(() => {
              try {
                const storedItems = JSON.parse(localStorage.getItem('georgetownAI_items') || '[]');
                const currentNote = storedItems.find((item: any) => 
                  item.type === 'note' && 
                  ((currentNoteTitle && item.title === currentNoteTitle) ||
                   (currentNoteContent && item.text && item.text.includes(currentNoteContent.substring(0, 50))))
                );
                
                if (currentNote && currentNote.text !== currentNoteContent) {
                  console.log('🔧 SAFE UPDATE: Refreshing note content after AI modification');
                  onUpdateNoteContent?.(currentNote.text);
                  if (currentNote.title !== currentNoteTitle) {
                    onUpdateNoteTitle?.(currentNote.title);
                  }
                }
              } catch (error) {
                console.error('🔧 Safe update error:', error);
              }
            }, 200); // Small delay to ensure localStorage is updated
          }

          // Add AI response with image acknowledgment if needed
          let aiResponse = response.message;
          if (hasImages) {
            aiResponse = `I can see the image${selectedImages.length > 1 ? 's' : ''} you uploaded. ${response.message}`;
          }
          
          console.log('🔧 Adding AI response to chat:', aiResponse);
          await chatService.addMessage('assistant', aiResponse);
        }
      } else {
        // Regular chat processing (not in note mode)
        const currentCategoryId = categories.find(cat => cat.id === currentView)?.id;
        
        // Initialize agentic context tracking for new agentic requests
        if (isAgenticMode && agenticLoopCount === 0) {
          const userIntent = classifyUserIntent(processedMessage);
          trackAgenticContext(processedMessage, userIntent);
          console.log('🚀 Starting new agentic session:', { intent: userIntent, message: processedMessage.substring(0, 50) + '...' });
        }
        
        // For now, we'll process text normally. In a real app, you'd send images to your AI service
        let processMessage = processedMessage;
        if (hasImages && !messageToSend) {
          processMessage = "I've uploaded some images. Can you help me with them?";
        }
        
        console.log('🔄 AIAssistant: Calling chatService.processGeorgetownCommand with:', {
          message: processMessage,
          categoryId: currentCategoryId,
          itemsCount: items?.length || 0,
          agenticMode: isAgenticMode,
          agenticContext: { intent: agenticRequestType, originalRequest: originalUserIntent }
        });

        // Check if this looks like a function call command
        const needsFunction = needsFunctionCalling(processMessage);
        if (needsFunction) {
          setIsAIThinking(false);
          setIsCallingFunction(true);
          setCurrentFunctionName('Processing Request');
        }

        const response = await chatService.processGeorgetownCommand(
          processMessage, 
          currentCategoryId,
          items,
          categories,
          isAgenticMode
        );

        console.log('📥 AIAssistant: Received response from chatService:', response);

        // Check if function was called based on response
        if (response.functionResults && response.functionResults.length > 0) {
          setIsCallingFunction(false);
          const functionName = response.functionResults[0].function;
          setCurrentFunctionName(`Executed: ${functionName}`);
          
          // Show function result briefly
          setTimeout(() => {
            setCurrentFunctionName(null);
          }, 2000);
        }

        // Check if there's a pending function call
        if (response.pendingFunctionCall) {
          if (isAgenticMode) {
            // In agentic mode, show visual function call UI and let user approve
            console.log('🤖 Agentic mode: Showing function call UI for user review:', response.pendingFunctionCall);
            
            // Add AI response first
            let aiResponse = response.message;
            if (hasImages) {
              aiResponse = `I can see the image${selectedImages.length > 1 ? 's' : ''} you uploaded. ${aiResponse}`;
            }
            await chatService.addMessage('assistant', aiResponse);
            
            // Show the visual UI (no auto-execution)
            const functionCallId = Date.now().toString();
            const newFunctionCall = {
              id: functionCallId,
              name: response.pendingFunctionCall.name,
              args: response.pendingFunctionCall.args
            };
            
            console.log('🔍 DEBUG: Adding function call to pending state:', newFunctionCall);
            console.log('🔍 DEBUG: Function call args:', JSON.stringify(response.pendingFunctionCall.args, null, 2));
            
            setPendingFunctionCalls(prev => {
              const updated = [...prev, newFunctionCall];
              console.log('🔍 DEBUG: Updated pending function calls:', updated);
              return updated;
            });
            
            // Auto-approve if enabled
            if (autoApprove) {
              console.log('🔄 Auto-approving function call:', newFunctionCall.name);
              setTimeout(() => {
                handleApproveFunctionCall(functionCallId);
              }, 1000); // Brief delay to show the UI
            }
          } else {
            // Normal mode: show visual function call UI
            const functionCallId = Date.now().toString();
            setPendingFunctionCalls(prev => [...prev, {
              id: functionCallId,
              name: response.pendingFunctionCall.name,
              args: response.pendingFunctionCall.args
            }]);
            
            // Add AI response with function call preview
            let aiResponse = response.message;
            if (hasImages) {
              aiResponse = `I can see the image${selectedImages.length > 1 ? 's' : ''} you uploaded. ${response.message}`;
            }
            
            await chatService.addMessage('assistant', aiResponse);
          }
        } else {
          // Handle item creation (legacy support)
          if (response.itemCreated && !response.itemCreated.item) {
            const newItem: Item = {
              id: `item_${Date.now()}`,
              title: response.itemCreated.title,
              text: response.itemCreated.title,
              type: response.itemCreated.type as any,
              categoryId: response.itemCreated.categoryId,
              completed: false,
              createdAt: new Date(),
              updatedAt: new Date(),
              metadata: {
                priority: 'medium',
                aiGenerated: true
              }
            };

            onAddItem(newItem);
            
            // Add system message about item creation
            await chatService.addMessage('system', `✅ Created ${response.itemCreated.type}: "${response.itemCreated.title}"`);
          }

          // If items were modified, refresh the UI
          if (response.itemsModified) {
            console.log('✅ Items modified, calling onRefreshItems');
            onRefreshItems();
          }

          // Add AI response with image acknowledgment if needed
          let aiResponse = response.message;
          if (hasImages) {
            aiResponse = `I can see the image${selectedImages.length > 1 ? 's' : ''} you uploaded. ${response.message}`;
          }
          
          console.log('💬 AIAssistant: Adding AI response to chat:', aiResponse);
          await chatService.addMessage('assistant', aiResponse);
          console.log('✅ AIAssistant: AI response added successfully');
          
          // Intelligent agentic mode continuation based on intent and context
          if (isAgenticMode) {
            const currentIntent = agenticRequestType || 'creation';
            const shouldContinue = shouldContinueAgentic(currentIntent, items.length, aiResponse);
            
            if (shouldContinue) {
              console.log('🧠 Continuing agentic mode:', { intent: currentIntent, itemCount: items.length });
              setTimeout(() => {
                continueAgenticMode(aiResponse);
              }, 1000);
            } else {
              console.log('🎯 Agentic mode naturally completing based on intent fulfillment');
              setIsAgenticMode(false);
              setOriginalUserIntent(null);
              setAgenticRequestType(null);
            }
          }
        }
      }
      
    } catch (error) {
      console.error('AI processing error:', error);
      await chatService.addMessage('assistant', "I had trouble processing that request. Could you try rephrasing it?");
    } finally {
      chatService.setProcessing(false);
      setIsAIThinking(false);
      setIsCallingFunction(false);
      setCurrentFunctionName(null);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const createNewSession = async () => {
    const newSession = await chatService.createSession('New Chat');
    chatService.switchToSession(newSession.id);
    setShowSessions(false);
  };

  const switchSession = (sessionId: string) => {
    chatService.switchToSession(sessionId);
    setShowSessions(false);
  };

  const startEditing = (messageId: string) => {
    chatService.startEditing(messageId);
  };

  const submitEdit = async (messageId: string, newContent: string) => {
    chatService.editMessage(messageId, newContent);
    
    // Re-process if it's a user message
    const message = currentSession?.messages.find(m => m.id === messageId);
    if (message?.role === 'user') {
      chatService.setProcessing(true);
      
      try {
        const currentCategoryId = categories.find(cat => cat.id === currentView)?.id;
        
        const response = await chatService.processGeorgetownCommand(
          newContent, 
          currentCategoryId,
          items,
          categories,
          false // Voice mode is always Ask mode, not Agent mode
        );

        // Handle item creation
        if (response.itemCreated && !response.itemCreated.item) {
          const newItem: Item = {
            id: `item_${Date.now()}`,
            title: response.itemCreated.title,
            text: response.itemCreated.title,
            type: response.itemCreated.type as any,
            categoryId: response.itemCreated.categoryId,
            completed: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            metadata: {
              priority: 'medium',
              aiGenerated: true
            }
          };

          onAddItem(newItem);
          await chatService.addMessage('system', `✅ Created ${response.itemCreated.type}: "${response.itemCreated.title}"`);
        }

        // If items were modified, refresh the UI
        if (response.itemsModified) {
          console.log('✅ Items modified, calling onRefreshItems');
          onRefreshItems();
        }

        await chatService.addMessage('assistant', response.message);
        
      } catch (error) {
        console.error('Re-processing error:', error);
        await chatService.addMessage('assistant', "I had trouble processing your updated request. Could you try rephrasing it?");
      } finally {
        chatService.setProcessing(false);
      }
    }
  };

  const cancelEdit = (messageId: string) => {
    chatService.cancelEditing(messageId);
  };

  // Version navigation
  const navigateVersion = (messageId: string, direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      chatService.navigateToPreviousVersion(messageId);
    } else {
      chatService.navigateToNextVersion(messageId);
    }
  };

  // Handle image selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newImages = Array.from(e.target.files);
      setSelectedImages(prev => [...prev, ...newImages]);
    }
  };

  // Remove selected image
  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  // Note: Function confirmation removed - Gemini now executes immediately like OpenRouter

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev + 1);
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev - 1);
    if (dragCounter === 1) {
      setIsDragOver(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    setDragCounter(0);

    const files = Array.from(e.dataTransfer.files);
    // Support more image formats
    const imageFiles = files.filter(file => {
      const type = file.type.toLowerCase();
      const name = file.name.toLowerCase();
      return type.startsWith('image/') || 
             name.endsWith('.jpg') || 
             name.endsWith('.jpeg') || 
             name.endsWith('.png') || 
             name.endsWith('.gif') || 
             name.endsWith('.webp') || 
             name.endsWith('.bmp') || 
             name.endsWith('.svg');
    });
    
    if (imageFiles.length > 0) {
      setSelectedImages(prev => [...prev, ...imageFiles]);
      
      // Focus the input area after dropping images
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <style>{`
        @keyframes scaleUpDown {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.5); }
        }
      `}</style>
      <div 
        ref={panelRef}
        className={`fixed top-0 right-0 h-screen z-40 shadow-2xl transition-all duration-300 ease-in-out ${
          isCollapsed ? 'rounded-l-full' : 'rounded-l-2xl'
        }`}
      style={{
        width: isCollapsed ? '60px' : `${sidebarWidth || 420}px`,
        background: isDarkMode 
          ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%)'
          : 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.95) 100%)',
        backdropFilter: 'blur(20px)',
        border: `1px solid ${themeColors.border}`,
        borderRight: 'none'
      }}
    >
      {isCollapsed ? (
        // Minimized floating button
        <div 
          className="w-full h-full flex items-center justify-center cursor-pointer hover:scale-110 transition-transform"
          onClick={() => onToggleCollapse?.()}
        >
          <Sparkles className={`w-8 h-8 ${isDarkMode ? 'text-white' : 'text-gray-800'}`} />
        </div>
      ) : (
        // Full panel
        <div className="flex flex-col h-full">
          {/* Custom Header with Glassmorphism - Hidden in Voice Mode */}
          {!isVoiceMode && (
          <div 
            className="flex items-center justify-between p-4 border-b relative overflow-hidden"
            style={{ borderColor: themeColors.border }}
          >
            <div className="flex items-center space-x-3 relative z-10">
              <div className="relative">
                <div className="p-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 shadow-lg">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
              </div>
              <div>
                <h2 className={`font-bold text-lg ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                  Life AI
                </h2>
                <p className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  Personal Agent
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 relative z-10">
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className={`p-2 rounded-lg transition-all hover:scale-110 ${
                  isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                }`}
                title="Toggle Theme"
              >
                {isDarkMode ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4 text-gray-600" />}
              </button>
              
              
              <button
                onClick={createNewSession}
                className={`p-2 rounded-lg transition-all hover:scale-110 ${
                  isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                }`}
                title="New Chat"
              >
                <Plus className={`w-4 h-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`} />
              </button>
              
              <button
                onClick={() => setShowSessions(!showSessions)}
                className={`p-2 rounded-lg transition-all hover:scale-110 ${
                  isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                }`}
                title="Chat History"
              >
                <MessagesSquare className={`w-4 h-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`} />
              </button>
              
              <button
                onClick={() => onToggleCollapse?.()}
                className={`p-2 rounded-lg transition-all hover:scale-110 ${
                  isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                }`}
                title="Minimize"
              >
                <Minimize2 className={`w-4 h-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`} />
              </button>
              
              <button
                onClick={onClose}
                className={`p-2 rounded-lg transition-all hover:scale-110 ${
                  isDarkMode ? 'hover:bg-red-700' : 'hover:bg-red-100'
                }`}
                title="Close"
              >
                <X className={`w-4 h-4 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`} />
              </button>
            </div>
          </div>
          )}

          {/* Context Info - Hidden in Voice Mode */}
          {!isVoiceMode && (
          <div 
            className="px-4 py-3 border-b text-sm relative overflow-visible"
            style={{ borderColor: themeColors.border, color: themeColors.text }}
          >
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center space-x-2">
                <Zap className="w-4 h-4 text-indigo-500" />
                <span>Current: <span className="font-semibold text-indigo-600">
                  {(() => {
                    // Find category name from ID, or use view name directly
                    const category = categories.find(cat => cat.id === currentView);
                    if (category) return category.name;
                    
                    // Handle special views
                    switch (currentView) {
                      case 'dashboard': return 'Dashboard';
                      case 'todos': return 'Global Todos';
                      case 'calendar': return 'Calendar';
                      case 'goals': return 'Global Goals';
                      case 'routines': return 'Global Routines';
                      case 'notes': return 'Global Notes';
                      case 'settings': return 'Settings';
                      case 'life-categories': return 'Life Categories';
                      default: return currentView;
                    }
                  })()}
                </span></span>
                
                {/* Agentic Mode Indicator */}
                {isAgenticMode && (
                  <div className="flex items-center space-x-1">
                    <div className="w-1 h-1 bg-purple-500 rounded-full animate-pulse"></div>
                    <span className="text-xs font-medium text-purple-600 bg-purple-100/50 px-2 py-0.5 rounded-full">
                      ∞ Agent
                    </span>
                  </div>
                )}
              </div>
              
              {/* AI Model Selector */}
              <div className="flex items-center space-x-3">
                <ModelSelector className="w-48" />
              </div>
            </div>
          </div>
          )}

                    {/* Session History with Glassmorphism - Hidden in Voice Mode */}
          {!isVoiceMode && showSessions && (
            <div 
              className="border-b max-h-48 overflow-y-auto backdrop-blur-sm scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-transparent hover:scrollbar-thumb-gray-500"
              style={{ 
                borderColor: themeColors.border,
                backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.5)' : 'rgba(248, 250, 252, 0.5)'
              }}
            >
              <div className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className={`text-xs font-bold ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                    Chat History ({allSessions.length})
                  </h3>
                  <button
                    onClick={async () => {
                      const newSession = await chatService.createSession(`Chat ${allSessions.length + 1}`);
                      chatService.switchToSession(newSession.id);
                    }}
                    className={`text-xs px-2 py-1 rounded transition-all hover:scale-105 ${
                      isDarkMode 
                        ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    + New
                  </button>
                </div>
                <div className="space-y-1">
                  {allSessions.map((session) => (
                    <div
                      key={session.id}
                      className={`p-2 rounded-lg text-xs cursor-pointer transition-all transform hover:scale-[1.02] ${
                        session.id === currentSession?.id 
                          ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md' 
                          : isDarkMode 
                            ? 'bg-gray-700/50 text-gray-200 hover:bg-gray-600/50'
                            : 'bg-white/50 text-gray-600 hover:bg-gray-50/80 shadow-sm'
                      }`}
                      onClick={() => switchSession(session.id)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-medium truncate flex-1 text-xs">{session.title}</div>
                        {session.id === currentSession?.id && (
                          <span className="text-xs bg-white/20 px-1 py-0.5 rounded text-xs">Active</span>
                        )}
                      </div>
                      <div className={`text-xs ${session.id === currentSession?.id ? 'text-gray-200' : 'text-gray-500'}`}>
                        {session.messages.length} msgs • {session.updatedAt.toLocaleDateString()}
                      </div>
                      {session.messages.length > 0 && (
                        <div className={`text-xs mt-1 truncate ${
                          session.id === currentSession?.id ? 'text-gray-300' : 'text-gray-400'
                        }`}>
                          {session.messages[session.messages.length - 1]?.versions[0]?.content.substring(0, 40)}...
                        </div>
                      )}
                    </div>
                  ))}
                  {allSessions.length === 0 && (
                    <div className={`text-center py-3 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      No chat sessions yet. Start a conversation!
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Messages or Voice Mode */}
          {isVoiceMode ? (
            /* Voice Mode Interface */
            <div className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-hidden" 
                 style={{ 
                   background: isDarkMode 
                     ? 'radial-gradient(ellipse at center, rgba(99, 102, 241, 0.03) 0%, rgba(15, 23, 42, 0.8) 70%)'
                     : 'radial-gradient(ellipse at center, rgba(99, 102, 241, 0.02) 0%, rgba(255, 255, 255, 0.9) 70%)'
                 }}>
              
              {/* Ambient Background Effects */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {/* Floating orbs */}
                <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-gradient-to-r from-purple-400/10 to-indigo-400/10 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-1/3 right-1/4 w-24 h-24 bg-gradient-to-r from-indigo-400/10 to-purple-400/10 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
                <div className="absolute top-1/2 right-1/3 w-16 h-16 bg-gradient-to-r from-purple-300/10 to-pink-300/10 rounded-full blur-2xl animate-pulse" style={{animationDelay: '4s'}}></div>
              </div>
              
              {/* Model Selection */}
              <div className="w-full max-w-sm mb-8 space-y-4 relative z-10">
                {/* Voice Model Selector */}
                <div className="relative">
                  <button
                    onClick={() => setShowModelPicker(!showModelPicker)}
                    className={`w-full p-4 rounded-2xl border transition-all duration-300 flex items-center justify-between group hover:scale-[1.02] ${
                      isDarkMode 
                        ? 'bg-gray-900/60 border-gray-700/50 text-white hover:bg-gray-800/70 backdrop-blur-xl'
                        : 'bg-white/60 border-gray-200/50 text-gray-800 hover:bg-white/80 backdrop-blur-xl'
                    }`}
                    style={{
                      boxShadow: isDarkMode 
                        ? '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                        : '0 8px 32px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.8)'
                    }}
                  >
                    <div className="text-left">
                      <div className="font-semibold text-sm tracking-wide">{selectedVoiceModel.name}</div>
                      <div className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {selectedVoiceModel.description}
                      </div>
                    </div>
                    <ChevronDown className={`w-5 h-5 transition-all duration-300 ${showModelPicker ? 'rotate-180' : ''} group-hover:scale-110`} />
                  </button>
                  
                  {showModelPicker && (
                    <div className={`absolute top-full left-0 right-0 mt-2 rounded-2xl border shadow-2xl z-50 backdrop-blur-xl animate-in slide-in-from-top-2 duration-200 ${
                      isDarkMode ? 'bg-gray-900/80 border-gray-700/50' : 'bg-white/80 border-gray-200/50'
                    }`}
                    style={{
                      boxShadow: isDarkMode 
                        ? '0 20px 60px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                        : '0 20px 60px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.8)'
                    }}>
                      <div className="p-3">
                        <div className={`text-xs font-semibold px-4 py-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} tracking-wider uppercase`}>
                          Gemini Models
                        </div>
                        {VOICE_MODELS.filter(m => m.provider === 'gemini').map((model) => (
                          <button
                            key={model.id}
                            onClick={() => {
                              console.log('🔄 Switching to Gemini model:', model.name);
                              // If switching providers or models, disconnect first
                              if (isVoiceMode && isVoiceConnected && selectedVoiceModel.id !== model.id) {
                                console.log('🔌 Provider/model switch detected, will reconnect automatically');
                              }
                              setSelectedVoiceModel(model);
                              setShowModelPicker(false);
                            }}
                            className={`w-full p-4 rounded-xl transition-all duration-200 text-left hover:scale-[1.02] ${
                              selectedVoiceModel.id === model.id 
                                ? isDarkMode 
                                  ? 'bg-purple-900/40 border border-purple-500/30' 
                                  : 'bg-purple-50/60 border border-purple-200/50'
                                : isDarkMode 
                                  ? 'hover:bg-gray-800/60' 
                                  : 'hover:bg-gray-50/60'
                            }`}
                          >
                            <div className={`font-semibold text-sm ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                              {model.name}
                            </div>
                            <div className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              {model.description}
                            </div>
                          </button>
                        ))}
                        
                        <div className={`text-xs font-semibold px-4 py-3 mt-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} tracking-wider uppercase`}>
                          OpenAI Models
                        </div>
                        {VOICE_MODELS.filter(m => m.provider === 'openai').map((model) => (
                          <button
                            key={model.id}
                            onClick={() => {
                              console.log('🔄 Switching to OpenAI model:', model.name);
                              // If switching providers or models, disconnect first
                              if (isVoiceMode && isVoiceConnected && selectedVoiceModel.id !== model.id) {
                                console.log('🔌 Provider/model switch detected, will reconnect automatically');
                              }
                              setSelectedVoiceModel(model);
                              setShowModelPicker(false);
                            }}
                            className={`w-full p-4 rounded-xl transition-all duration-200 text-left hover:scale-[1.02] ${
                              selectedVoiceModel.id === model.id 
                                ? isDarkMode 
                                  ? 'bg-purple-900/40 border border-purple-500/30' 
                                  : 'bg-purple-50/60 border border-purple-200/50'
                                : isDarkMode 
                                  ? 'hover:bg-gray-800/60' 
                                  : 'hover:bg-gray-50/60'
                            }`}
                          >
                            <div className={`font-semibold text-sm ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                              {model.name}
                            </div>
                            <div className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              {model.description}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Voice Selector (for both Gemini and OpenAI) */}
                <div className="relative">
                  <button
                    onClick={() => setShowVoicePicker(!showVoicePicker)}
                    className={`w-full p-4 rounded-2xl border transition-all duration-300 flex items-center justify-between group hover:scale-[1.02] ${
                      isDarkMode 
                        ? 'bg-gray-900/60 border-gray-700/50 text-white hover:bg-gray-800/70 backdrop-blur-xl'
                        : 'bg-white/60 border-gray-200/50 text-gray-800 hover:bg-white/80 backdrop-blur-xl'
                    }`}
                    style={{
                      boxShadow: isDarkMode 
                        ? '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                        : '0 8px 32px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.8)'
                    }}
                  >
                    <div className="text-left">
                      <div className="font-semibold text-sm tracking-wide">
                        {selectedVoiceModel.provider === 'openai' ? selectedOpenAIVoice.name : selectedGeminiVoice.name}
                      </div>
                      <div className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {selectedVoiceModel.provider === 'openai' ? selectedOpenAIVoice.description : selectedGeminiVoice.description}
                      </div>
                    </div>
                    <ChevronDown className={`w-5 h-5 transition-all duration-300 ${showVoicePicker ? 'rotate-180' : ''} group-hover:scale-110`} />
                  </button>
                  
                  {showVoicePicker && (
                    <div className={`absolute top-full left-0 right-0 mt-2 rounded-2xl border shadow-2xl z-50 backdrop-blur-xl animate-in slide-in-from-top-2 duration-200 ${
                      isDarkMode ? 'bg-gray-900/80 border-gray-700/50' : 'bg-white/80 border-gray-200/50'
                    }`}
                    style={{
                      boxShadow: isDarkMode 
                        ? '0 20px 60px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                        : '0 20px 60px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.8)'
                    }}>
                      <div className="p-3 max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-transparent hover:scrollbar-thumb-gray-500">
                        {selectedVoiceModel.provider === 'openai' ? (
                          // OpenAI Voices - Grid Layout
                          <>
                            <div className={`text-xs font-semibold px-2 py-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} tracking-wider uppercase`}>
                              OpenAI Voices
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {OPENAI_VOICES.map((voice) => (
                                <button
                                  key={voice.id}
                                  onClick={() => {
                                    console.log('🔄 Switching to OpenAI voice:', voice.name);
                                    if (isVoiceMode && isVoiceConnected && selectedOpenAIVoice.id !== voice.id) {
                                      console.log('🎵 Voice change will trigger reconnection');
                                    }
                                    setSelectedOpenAIVoice(voice);
                                    setShowVoicePicker(false);
                                  }}
                                  className={`p-3 rounded-lg transition-all duration-200 text-left hover:scale-[1.02] ${
                                    selectedOpenAIVoice.id === voice.id 
                                      ? isDarkMode 
                                        ? 'bg-purple-900/40 border border-purple-500/30' 
                                        : 'bg-purple-50/60 border border-purple-200/50'
                                      : isDarkMode 
                                        ? 'hover:bg-gray-800/60' 
                                        : 'hover:bg-gray-50/60'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="min-w-0 flex-1">
                                      <div className={`font-semibold text-xs ${isDarkMode ? 'text-white' : 'text-gray-800'} truncate`}>
                                        {voice.name}
                                      </div>
                                      <div className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} truncate`}>
                                        {voice.description}
                                      </div>
                                    </div>
                                    {selectedOpenAIVoice.id === voice.id && (
                                      <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse ml-2 flex-shrink-0"></div>
                                    )}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </>
                        ) : (
                          // Gemini Voices - Grid Layout
                          <>
                            <div className={`text-xs font-semibold px-2 py-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} tracking-wider uppercase`}>
                              Gemini Live Voices
                            </div>
                            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-transparent hover:scrollbar-thumb-gray-500">
                              {GEMINI_VOICES.map((voice) => (
                                <button
                                  key={voice.id}
                                  onClick={() => {
                                    console.log('🔄 Switching to Gemini voice:', voice.name);
                                    if (isVoiceMode && isVoiceConnected && selectedGeminiVoice.id !== voice.id) {
                                      console.log('🎵 Voice change will trigger reconnection');
                                    }
                                    setSelectedGeminiVoice(voice);
                                    setShowVoicePicker(false);
                                  }}
                                  className={`p-3 rounded-lg transition-all duration-200 text-left hover:scale-[1.02] ${
                                    selectedGeminiVoice.id === voice.id 
                                      ? isDarkMode 
                                        ? 'bg-purple-900/40 border border-purple-500/30' 
                                        : 'bg-purple-50/60 border border-purple-200/50'
                                      : isDarkMode 
                                        ? 'hover:bg-gray-800/60' 
                                        : 'hover:bg-gray-50/60'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="min-w-0 flex-1">
                                      <div className={`font-semibold text-xs ${isDarkMode ? 'text-white' : 'text-gray-800'} truncate`}>
                                        {voice.name}
                                      </div>
                                      <div className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} truncate`}>
                                        {voice.description}
                                      </div>
                                    </div>
                                    {selectedGeminiVoice.id === voice.id && (
                                      <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse ml-2 flex-shrink-0"></div>
                                    )}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Voice Orb */}
              <div className="relative mb-10 group">
                {/* Outer glow rings - Enhanced for function calling */}
                <div className="absolute inset-0 rounded-full animate-pulse" 
                     style={{
                       background: `radial-gradient(circle, rgba(147, 51, 234, ${
                         isProcessingFunction ? 0.4 : isMuted ? 0.05 : 0.1 + Math.max(voiceActivity, isSpeaking ? 0.3 : 0, isListening ? 0.2 : 0) * 0.3
                       }) 0%, transparent 70%)`,
                       transform: isProcessingFunction ? 'scale(2.2)' : 'scale(1.8)',
                       filter: 'blur(20px)',
                       transition: 'all 0.3s ease'
                     }}>
                </div>
                <div className="absolute inset-0 rounded-full animate-pulse" 
                     style={{
                       background: `radial-gradient(circle, rgba(99, 102, 241, ${
                         isProcessingFunction ? 0.6 : isMuted ? 0.08 : 0.15 + Math.max(voiceActivity, isSpeaking ? 0.4 : 0, isListening ? 0.25 : 0) * 0.4
                       }) 0%, transparent 60%)`,
                       transform: isProcessingFunction ? 'scale(1.8)' : 'scale(1.4)',
                       filter: 'blur(15px)',
                       animationDelay: '0.5s',
                       transition: 'all 0.3s ease'
                     }}>
                </div>
                
                {/* Function processing ring */}
                {isProcessingFunction && (
                  <div className="absolute inset-0 rounded-full animate-spin" 
                       style={{
                         background: 'conic-gradient(from 0deg, rgba(59, 130, 246, 0.8) 0%, transparent 50%, rgba(59, 130, 246, 0.8) 100%)',
                         transform: 'scale(1.1)',
                         filter: 'blur(2px)'
                       }}>
                  </div>
                )}
                
                <canvas
                  ref={canvasRef}
                  className="rounded-full relative z-10 transition-all duration-500 group-hover:scale-105"
                  style={{
                    filter: `drop-shadow(0 0 40px rgba(147, 51, 234, ${isMuted ? 0.2 : 0.4 + Math.max(voiceActivity, isSpeaking ? 0.6 : 0, isListening ? 0.4 : 0) * 0.5}))`,
                    boxShadow: isDarkMode 
                      ? `0 0 60px rgba(147, 51, 234, ${isMuted ? 0.15 : 0.3 + Math.max(voiceActivity, isSpeaking ? 0.5 : 0, isListening ? 0.3 : 0) * 0.4}), inset 0 0 20px rgba(255, 255, 255, 0.1)`
                      : `0 0 60px rgba(147, 51, 234, ${isMuted ? 0.1 : 0.2 + Math.max(voiceActivity, isSpeaking ? 0.4 : 0, isListening ? 0.2 : 0) * 0.3}), inset 0 0 20px rgba(255, 255, 255, 0.8)`
                  }}
                />
              </div>

              {/* Status and Connection Info */}
              <div className="text-center mb-8 relative z-10">
                <div className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {selectedVoiceModel.provider === 'openai' ? `${selectedOpenAIVoice.name} Voice` : `${selectedGeminiVoice.name} Voice`}
                </div>
                <div className="flex items-center justify-center mt-2 space-x-2">
                  <div className={`w-2 h-2 rounded-full ${
                    isVoiceConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                  }`}></div>
                  <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    {isVoiceConnected ? 'Connected' : 'Disconnected'} • {selectedVoiceModel.provider.toUpperCase()}
                  </span>
                </div>
                {!isVoiceConnected && (
                  <div className={`text-xs mt-1 ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                    {isVoiceMode ? 'Connecting...' : 'Not connected'}
                  </div>
                )}
                
                {/* Function Calling Status */}
                {isProcessingFunction && (
                  <div className="flex items-center justify-center mt-3 space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                    <span className={`text-xs ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                      Processing life command...
                    </span>
                  </div>
                )}
              </div>
              
              {/* Function Result Display - Minimal */}
              {functionResult && !isProcessingFunction && (
                <div className="mb-4 relative z-10 animate-in slide-in-from-bottom-2 duration-200">
                  <div className={`px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between ${
                    functionResult.includes('Error') || functionResult.includes('❌')
                      ? isDarkMode 
                        ? 'bg-red-900/40 text-red-300 border border-red-700/30'
                        : 'bg-red-50/80 text-red-600 border border-red-200/50'
                      : isDarkMode 
                        ? 'bg-green-900/40 text-green-300 border border-green-700/30'
                        : 'bg-green-50/80 text-green-600 border border-green-200/50'
                  }`}>
                    <span className="truncate">{functionResult}</span>
                    <button
                      onClick={() => setFunctionResult(null)}
                      className="ml-2 opacity-60 hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}

              {/* Controls */}
              <div className="flex items-center space-x-6 relative z-10">
                {/* Mute Button */}
                <button
                  onClick={async () => {
                    if (currentVoiceServiceRef.current) {
                      try {
                        if (isMuted) {
                          console.log('🎤 UNMUTING - Starting listening...');
                          setIsMuted(false);
                          await currentVoiceServiceRef.current.startListening();
                        } else {
                          console.log('🔇 MUTING - Stopping listening...');
                          currentVoiceServiceRef.current.stopListening();
                          setIsMuted(true);
                        }
                      } catch (error) {
                        console.error('❌ Error toggling mute:', error);
                      }
                    } else {
                      setIsMuted(!isMuted);
                    }
                  }}
                  className={`p-4 rounded-2xl transition-all duration-300 transform hover:scale-110 active:scale-95 ${
                    isMuted
                      ? 'bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg'
                      : isDarkMode
                        ? 'bg-gray-800/60 hover:bg-gray-700/70 text-gray-300 backdrop-blur-xl border border-gray-700/50'
                        : 'bg-white/60 hover:bg-white/80 text-gray-600 backdrop-blur-xl border border-gray-200/50'
                  }`}
                  style={{
                    boxShadow: isMuted 
                      ? '0 8px 32px rgba(239, 68, 68, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                      : isDarkMode 
                        ? '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                        : '0 8px 32px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.8)'
                  }}
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                </button>

                {/* Exit Voice Mode */}
                <button
                  onClick={toggleVoiceMode}
                  className={`p-4 rounded-2xl transition-all duration-300 transform hover:scale-110 active:scale-95 ${
                    isDarkMode
                      ? 'bg-gray-800/60 hover:bg-gray-700/70 text-gray-300 backdrop-blur-xl border border-gray-700/50'
                      : 'bg-white/60 hover:bg-white/80 text-gray-600 backdrop-blur-xl border border-gray-200/50'
                  }`}
                  style={{
                    boxShadow: isDarkMode 
                      ? '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                      : '0 8px 32px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.8)'
                  }}
                  title="Exit Voice Mode"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>



              {/* Live Transcription */}
              {currentTranscript && (
                <div className="w-full max-w-md mt-8 relative z-10 animate-in slide-in-from-bottom-4 duration-300">
                  <div className={`p-6 rounded-2xl border backdrop-blur-xl ${
                    isDarkMode 
                      ? 'bg-gray-900/60 border-gray-700/50 text-gray-200'
                      : 'bg-white/60 border-gray-200/50 text-gray-700'
                  }`}
                  style={{
                    boxShadow: isDarkMode 
                      ? '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                      : '0 8px 32px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.8)'
                  }}>
                    <div className={`text-xs font-semibold mb-3 tracking-wider uppercase ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Live Transcription
                    </div>
                    <div className="text-sm leading-relaxed">{currentTranscript}</div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Regular Chat Interface */
          <div 
            className="flex-1 overflow-y-auto p-4 space-y-4 relative scroll-smooth scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-transparent hover:scrollbar-thumb-gray-500"
            style={{ 
              backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.3)' : 'rgba(255, 255, 255, 0.3)',
              scrollBehavior: 'smooth'
            }}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {/* Drag and Drop Overlay */}
            {isDragOver && (
              <div className="absolute inset-0 z-50 bg-blue-500/20 backdrop-blur-sm border-2 border-dashed border-blue-500 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <Image className="w-12 h-12 text-blue-500 mx-auto mb-2" />
                  <p className="text-blue-600 font-semibold">Drop images here to analyze</p>
                  <p className="text-blue-500 text-sm">Supports JPG, PNG, GIF, WebP</p>
                </div>
              </div>
            )}

            {/* Neural network background pattern */}
            <div className="absolute inset-0 opacity-5 pointer-events-none">
              <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="neural" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
                    <circle cx="25" cy="25" r="2" fill="currentColor"/>
                    <circle cx="75" cy="75" r="2" fill="currentColor"/>
                    <line x1="25" y1="25" x2="75" y2="75" stroke="currentColor" strokeWidth="0.5"/>
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#neural)"/>
              </svg>
            </div>

            {!currentSession || currentSession.messages.length === 0 ? (
              <div className="flex items-center justify-center h-full relative z-10">
                <div className="text-center">
                  <div className="relative mb-6">
                    <Sparkles className={`w-16 h-16 mx-auto ${isDarkMode ? 'text-gray-400' : 'text-gray-400'}`} />
                  </div>
                  <h3 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                    Life AI Assistant
                  </h3>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    Ready to help you organize and optimize your life!
                  </p>
                  <div className="mt-4 flex justify-center space-x-2">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <div className="w-2 h-2 bg-pink-500 rounded-full"></div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative z-10">
                {currentSession.messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    onEdit={submitEdit}
                    onStartEdit={startEditing}
                    onCancelEdit={cancelEdit}
                    onNavigateVersion={navigateVersion}
                    isDarkMode={isDarkMode}
                  />
                ))}
              </div>
            )}
            
            {/* Function Call UIs */}
            {pendingFunctionCalls.map((functionCall) => (
              <div key={functionCall.id} className="flex justify-start relative z-10 mb-4">
                <div className="flex items-start space-x-3 w-full max-w-4xl">
                  <div className="p-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 shadow-lg">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <FunctionCallUI
                      functionCall={functionCall}
                      onApprove={() => handleApproveFunctionCall(functionCall.id)}
                      onReject={() => handleRejectFunctionCall(functionCall.id)}
                      isDarkMode={isDarkMode}
                      autoApprove={autoApprove}
                      onAutoApproveChange={setAutoApprove}
                    />
                  </div>
                </div>
              </div>
            ))}
            
            {isProcessing && (
              <div className="flex justify-start relative z-10">
                <div className="flex items-start space-x-3">
                  <div className="p-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 shadow-lg">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div 
                    className="p-4 rounded-2xl backdrop-blur-sm border shadow-lg"
                    style={{ 
                      backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.8)',
                      borderColor: themeColors.border
                    }}
                  >
                    <div className="flex items-center space-x-3">
                      {/* Thinking indicator */}
                      {isAIThinking && (
                        <div className={`w-2 h-2 rounded-full animate-bounce ${isDarkMode ? 'bg-gray-200' : 'bg-gray-700'}`} 
                             style={{
                               animation: 'bounce 1s infinite, scaleUpDown 1.5s infinite'
                             }}>
                        </div>
                      )}
                      
                      {/* Function call indicator */}
                      {isCallingFunction && (
                        <div className="flex items-center space-x-2">
                          <div className={`px-2 py-1 rounded-lg text-xs font-medium ${
                            isDarkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
                          }`}>
                            🔧 {currentFunctionName || 'Function'}
                          </div>
                        </div>
                      )}
                      
                      {/* Fallback processing indicator */}
                      {!isAIThinking && !isCallingFunction && (
                        <div className={`w-2 h-2 rounded-full animate-bounce ${isDarkMode ? 'bg-gray-200' : 'bg-gray-700'}`} 
                             style={{
                               animation: 'bounce 1s infinite, scaleUpDown 1.5s infinite'
                             }}>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
          )}

          {/* Input Area with Photo Upload - Hidden in Voice Mode */}
          {!isVoiceMode && (
          <div 
            className="border-t p-4 backdrop-blur-sm"
            style={{ 
              borderColor: themeColors.border,
              backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.8)' : 'rgba(255, 255, 255, 0.8)'
            }}
          >
            {/* Note Editing Commands Helper */}
            {currentNoteContent !== undefined && (
              <div className={`mb-3 p-3 rounded-lg border-l-4 border-blue-500 ${
                isDarkMode ? 'bg-blue-900/20 text-blue-200' : 'bg-blue-50 text-blue-700'
              }`}>
                <div className="text-xs font-medium mb-1">📝 Live Note Editing Commands:</div>
                <div className="text-xs opacity-80">
                  <div className="mb-1"><strong>Add content:</strong> "add to my note...", "write about...", "include...", "generate..."</div>
                  <div className="mb-1"><strong>Simple commands:</strong> "add [topic]", "write [content]", "create list", "summarize"</div>
                  <div><strong>Advanced:</strong> "replace note with...", "add to beginning..." - Updates happen instantly!</div>
                </div>
              </div>
            )}

            {/* Selected Images Preview */}
            {selectedImages.length > 0 && (
              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    {selectedImages.length} image{selectedImages.length > 1 ? 's' : ''} selected
                  </span>
                  <button
                    onClick={() => {
                      setSelectedImages([]);
                    }}
                    className="text-xs text-red-500 hover:text-red-600"
                  >
                    Clear all
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedImages.map((image, index) => (
                    <div key={`${image.name}-${index}`} className="relative">
                      <img
                        src={URL.createObjectURL(image)}
                        alt={`Upload ${index + 1}`}
                        className="w-16 h-16 object-cover rounded-lg border-2 border-gray-300"
                      />
                      <button
                        onClick={() => removeImage(index)}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600"
                      >
                        ×
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white text-xs p-1 rounded-b-lg truncate">
                        {image.name.length > 10 ? image.name.substring(0, 8) + '...' : image.name}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-end space-x-2">
              <div className="flex-1 relative">
                <ContextAwareInput
                  ref={inputRef}
                  value={inputMessage}
                  onChange={setInputMessage}
                  onKeyPress={handleKeyPress}
                  placeholder={currentNoteContent !== undefined 
                    ? "Ask about your note or say 'write to my note about...' to add content. Use @ to mention items."
                    : "Ask me anything or tell me what to add. Use @ to mention items..."
                  }
                  rows={1}
                  className={`w-full px-5 py-4 pr-24 rounded-2xl border-2 transition-all duration-300 focus:ring-4 text-sm backdrop-blur-xl resize-none ${
                    isDarkMode 
                      ? 'bg-gray-900/60 border-gray-700/50 text-white placeholder-gray-400 focus:border-purple-500 focus:ring-purple-500/30 hover:bg-gray-900/70'
                      : 'bg-white/60 border-gray-200/50 text-gray-800 placeholder-gray-500 focus:border-purple-500 focus:ring-purple-500/30 hover:bg-white/70'
                  }`}
                  style={{
                    minHeight: '56px',
                    maxHeight: 'calc(24vh - 100px)', // 24% of viewport height minus header/footer space
                    lineHeight: '1.5',
                    wordWrap: 'break-word',
                    whiteSpace: 'pre-wrap',
                    boxShadow: isDarkMode 
                      ? '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                      : '0 8px 32px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.8)'
                  }}
                  items={items}
                  isDarkMode={isDarkMode}
                />
                
                {/* Input Icons */}
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex space-x-2 z-50">
                  {/* Voice Transcription Button */}
                  <button
                    onClick={handleVoiceButtonClick}
                    disabled={isTranscribing}
                    className={`p-2.5 rounded-xl transition-all duration-200 hover:scale-110 active:scale-95 backdrop-blur-sm ${
                      isRecording 
                        ? 'text-red-500 bg-red-500/10 border border-red-500/20 animate-pulse shadow-lg' 
                        : isTranscribing
                          ? 'text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 shadow-lg'
                          : isDarkMode 
                            ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 border border-gray-600/30' 
                            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100/50 border border-gray-200/30'
                    }`}
                    style={{
                      boxShadow: isRecording || isTranscribing 
                        ? '0 4px 16px rgba(0, 0, 0, 0.1)'
                        : isDarkMode 
                          ? '0 2px 8px rgba(0, 0, 0, 0.2)'
                          : '0 2px 8px rgba(0, 0, 0, 0.05)'
                    }}
                    title={isRecording ? `Recording... ${recordingDuration.toFixed(1)}s` : isTranscribing ? 'Transcribing...' : 'Voice to Text'}
                  >
                    {isTranscribing ? (
                      <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                      </svg>
                    )}
                  </button>
                  
                  {/* Photo Upload */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className={`p-2.5 rounded-xl transition-all duration-200 hover:scale-110 active:scale-95 backdrop-blur-sm border ${
                      isDarkMode 
                        ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 border-gray-600/30' 
                        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100/50 border-gray-200/30'
                    }`}
                    style={{
                      boxShadow: isDarkMode 
                        ? '0 2px 8px rgba(0, 0, 0, 0.2)'
                        : '0 2px 8px rgba(0, 0, 0, 0.05)'
                    }}
                    title="Upload Photo"
                  >
                    <Image className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              {/* Voice Chat/Send/Stop Button */}
              {isAIThinking || isProcessing ? (
                // Stop Button (shows when AI is thinking/processing)
                <button
                  onClick={() => {
                    if (isAgenticMode) {
                      stopAgenticMode();
                    }
                    setIsAIThinking(false);
                    chatService.setProcessing(false);
                  }}
                  className={`w-14 h-14 rounded-2xl shadow-xl border flex items-center justify-center transition-all duration-300 transform hover:scale-110 active:scale-95 group relative overflow-hidden bg-gradient-to-br from-red-500 via-red-600 to-red-700 border-red-400/50`}
                  style={{
                    boxShadow: '0 12px 40px rgba(239, 68, 68, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                  }}
                  title="Stop AI Processing"
                >
                  <Square className="w-4 h-4 text-white fill-current" />
                </button>
              ) : inputMessage.trim() === '' ? (
                // Voice Chat Button (for real-time conversation)
                <button
                  onClick={toggleVoiceMode}
                  className={`w-14 h-14 rounded-2xl shadow-xl border flex items-center justify-center transition-all duration-300 transform hover:scale-110 active:scale-95 group relative overflow-hidden ${
                    isVoiceMode 
                      ? 'bg-gradient-to-br from-purple-500 via-purple-600 to-indigo-600 border-purple-400/50'
                      : isDarkMode
                        ? 'bg-gradient-to-br from-gray-800/80 via-gray-700/80 to-gray-800/80 border-gray-600/50 hover:from-purple-900/60 hover:via-purple-800/60 hover:to-indigo-900/60 backdrop-blur-xl'
                        : 'bg-gradient-to-br from-white/80 via-gray-50/80 to-white/80 border-gray-200/50 hover:from-purple-50/80 hover:via-purple-100/80 hover:to-indigo-50/80 backdrop-blur-xl'
                  }`}
                  style={{
                    boxShadow: isVoiceMode 
                      ? '0 12px 40px rgba(147, 51, 234, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                      : isDarkMode 
                        ? '0 12px 40px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                        : '0 12px 40px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.8)'
                  }}
                  title={isVoiceMode ? 'Voice Chat Active' : 'Start Voice Chat'}
                >
                  {/* Background glow effect */}
                  <div className={`absolute inset-0 rounded-2xl transition-opacity duration-300 ${
                    isVoiceMode 
                      ? 'bg-gradient-to-r from-purple-400/20 to-indigo-400/20 opacity-100'
                      : 'bg-gradient-to-r from-purple-400/10 to-indigo-400/10 opacity-0 group-hover:opacity-100'
                   }`}></div>
                    
                    <div className="flex items-center justify-center relative z-10">
                      <div className="w-7 h-7 relative">
                        {isVoiceMode ? (
                          // Active voice chat indicator (white sound waves)
                          <div className="absolute inset-0 flex items-center justify-center space-x-0.5">
                            <div className="w-0.5 h-2.5 bg-white rounded-full animate-pulse shadow-sm"></div>
                            <div className="w-0.5 h-5 bg-white rounded-full animate-pulse shadow-sm" style={{animationDelay: '0.1s'}}></div>
                            <div className="w-0.5 h-3.5 bg-white rounded-full animate-pulse shadow-sm" style={{animationDelay: '0.2s'}}></div>
                            <div className="w-0.5 h-6 bg-white rounded-full animate-pulse shadow-sm" style={{animationDelay: '0.3s'}}></div>
                            <div className="w-0.5 h-3 bg-white rounded-full animate-pulse shadow-sm" style={{animationDelay: '0.4s'}}></div>
                          </div>
                        ) : (
                          // Normal sound waves for voice chat
                          <div className="absolute inset-0 flex items-center justify-center space-x-0.5">
                          <div className={`w-0.5 h-2.5 rounded-full animate-pulse ${
                            isDarkMode ? 'bg-gradient-to-t from-purple-400 to-purple-300' : 'bg-gradient-to-t from-purple-600 to-purple-500'
                          }`}></div>
                          <div className={`w-0.5 h-5 rounded-full animate-pulse ${
                            isDarkMode ? 'bg-gradient-to-t from-purple-300 to-indigo-300' : 'bg-gradient-to-t from-purple-500 to-indigo-400'
                          }`} style={{animationDelay: '0.1s'}}></div>
                          <div className={`w-0.5 h-3.5 rounded-full animate-pulse ${
                            isDarkMode ? 'bg-gradient-to-t from-purple-400 to-purple-300' : 'bg-gradient-to-t from-purple-600 to-purple-500'
                          }`} style={{animationDelay: '0.2s'}}></div>
                          <div className={`w-0.5 h-6 rounded-full animate-pulse ${
                            isDarkMode ? 'bg-gradient-to-t from-purple-300 to-indigo-300' : 'bg-gradient-to-t from-purple-500 to-indigo-400'
                          }`} style={{animationDelay: '0.3s'}}></div>
                          <div className={`w-0.5 h-3 rounded-full animate-pulse ${
                            isDarkMode ? 'bg-gradient-to-t from-purple-400 to-purple-300' : 'bg-gradient-to-t from-purple-600 to-purple-500'
                          }`} style={{animationDelay: '0.4s'}}></div>
                          </div>
                        )}
                      </div>
                    </div>
                </button>
              ) : (
                // Send Button (appears when typing)
                <button
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim() || isProcessing}
                  className="w-14 h-14 bg-gradient-to-br from-indigo-500 via-purple-600 to-purple-700 text-white rounded-2xl hover:from-indigo-600 hover:via-purple-700 hover:to-purple-800 disabled:opacity-50 transition-all duration-300 transform hover:scale-110 active:scale-95 disabled:hover:scale-100 shadow-xl flex items-center justify-center relative overflow-hidden group"
                  style={{
                    boxShadow: '0 12px 40px rgba(99, 102, 241, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                  }}
                  title="Send Message"
                >
                  {/* Background glow effect */}
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-indigo-400/20 to-purple-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  
                  <Send className="w-6 h-6 relative z-10 transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-200" />
                </button>
              )}
            </div>
            
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageSelect}
              className="hidden"
            />
            
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center space-x-3">
                {/* Mode Dropdown - Bottom Left */}
                <div className="relative mode-dropdown">
                  <button
                    onClick={() => setShowModeDropdown(!showModeDropdown)}
                    className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm transition-all ${
                      isDarkMode ? 'hover:bg-gray-700 text-white border border-gray-600' : 'hover:bg-gray-100 text-gray-700 border border-gray-300'
                    }`}
                  >
                    <span>∞</span>
                    <span>{isAgenticMode ? 'Agent' : 'Ask'}</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  
                  {showModeDropdown && (
                    <div className={`absolute bottom-full left-0 mb-1 w-32 rounded-lg border shadow-lg z-50 ${
                      isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'
                    }`}>
                      <button
                        onClick={() => {
                          stopAgenticMode();
                          setShowModeDropdown(false);
                        }}
                        className={`w-full px-3 py-2 text-left text-sm transition-all flex items-center space-x-2 ${
                          !isAgenticMode
                            ? isDarkMode ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'
                            : isDarkMode ? 'hover:bg-gray-700 text-white' : 'hover:bg-gray-100 text-gray-700'
                        }`}
                      >
                        <span>💬</span>
                        <span>Ask</span>
                        {!isAgenticMode && <span className="ml-auto">✓</span>}
                      </button>
                      <button
                        onClick={() => {
                          setIsAgenticMode(true);
                          setShowModeDropdown(false);
                        }}
                        className={`w-full px-3 py-2 text-left text-sm transition-all flex items-center space-x-2 ${
                          isAgenticMode
                            ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white'
                            : isDarkMode ? 'hover:bg-gray-700 text-white' : 'hover:bg-gray-100 text-gray-700'
                        }`}
                      >
                        <span>∞</span>
                        <span>Agent</span>
                        {isAgenticMode && <span className="ml-auto">✓</span>}
                      </button>
                    </div>
                  )}
                </div>
              </div>
              
              <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Enter to send • Shift+Enter for new line • 🎤 Voice to text • 📷 Upload photos • 🎤 Voice chat
                {isTranscribing && (
                  <div className="flex items-center space-x-2 mt-1 text-yellow-600">
                    <div className="w-3 h-3 border border-yellow-600 border-t-transparent rounded-full animate-spin"></div>
                    <span>Transcribing voice...</span>
                  </div>
                )}
                {isVoiceMode && (
                  <div className="flex items-center space-x-2 mt-1 text-purple-600">
                    <div className="w-3 h-3 bg-purple-600 rounded-full animate-pulse"></div>
                    <span>Voice chat active</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          )}

          {/* Resize Handle */}
          <div
            ref={resizeHandleRef}
            className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize bg-gray-300 dark:bg-gray-600 opacity-0 hover:opacity-100 transition-opacity duration-200"
            onMouseDown={handleResizeMouseDown}
            title="Drag to resize"
          >
            <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1 h-8 bg-gray-400 dark:bg-gray-500 rounded-full"></div>
          </div>
        </div>
      )}
    </div>
    </>
  );
};

// Enhanced Message Bubble Component
const MessageBubble: React.FC<{
  message: ChatMessage;
  onEdit: (messageId: string, newContent: string) => void;
  onStartEdit: (messageId: string) => void;
  onCancelEdit: (messageId: string) => void;
  onNavigateVersion: (messageId: string, direction: 'prev' | 'next') => void;
  isDarkMode: boolean;
}> = ({ message, onEdit, onStartEdit, onCancelEdit, onNavigateVersion, isDarkMode }) => {
  const currentVersion = message.versions[message.currentVersionIndex];
  const [editContent, setEditContent] = useState(currentVersion.content);
  const versionInfo = chatService.getVersionInfo(message.id);

  // Update edit content when version changes
  useEffect(() => {
    setEditContent(currentVersion.content);
  }, [currentVersion.content]);

  const handleSubmitEdit = () => {
    onEdit(message.id, editContent);
  };

  if (message.role === 'system') {
    return (
      <div className="flex justify-center mb-4">
        <div 
          className="rounded-2xl p-4 max-w-[90%] backdrop-blur-sm border shadow-lg"
          style={{
            backgroundColor: isDarkMode ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.1)',
            borderColor: isDarkMode ? 'rgba(34, 197, 94, 0.3)' : 'rgba(34, 197, 94, 0.2)'
          }}
        >
          <div className="text-green-600 text-sm font-semibold flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>{cleanMarkdownFormatting(currentVersion.content)}</span>
          </div>
        </div>
      </div>
    );
  }

  const isUser = message.role === 'user';

  return (
    <div className={`flex items-start space-x-3 mb-6 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
      <div className="relative">
        <div 
          className={`p-2 rounded-xl shadow-lg ${
            isUser 
              ? 'bg-gradient-to-br from-indigo-500 to-purple-600' 
              : 'bg-gradient-to-br from-gray-600 to-gray-700'
          }`}
        >
          {isUser ? <User className="w-5 h-5 text-white" /> : <Sparkles className="w-5 h-5 text-white" />}
        </div>
      </div>
      
      <div className="flex-1 max-w-[80%]">
        <div 
          className={`rounded-2xl p-4 backdrop-blur-sm border shadow-lg ${
            isUser 
              ? 'rounded-tr-md' 
              : 'rounded-tl-md'
          }`}
          style={{
            backgroundColor: isUser 
              ? isDarkMode 
                ? 'rgba(99, 102, 241, 0.2)' 
                : 'rgba(99, 102, 241, 0.1)'
              : isDarkMode 
                ? 'rgba(55, 65, 81, 0.8)' 
                : 'rgba(255, 255, 255, 0.8)',
            borderColor: isDarkMode ? 'rgba(99, 102, 241, 0.3)' : 'rgba(99, 102, 241, 0.2)'
          }}
        >
          {message.isEditing ? (
            <div className="space-y-3">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className={`w-full p-3 border-2 rounded-xl text-sm backdrop-blur-sm ${
                  isDarkMode 
                    ? 'bg-gray-800 bg-opacity-50 border-gray-600 text-white'
                    : 'bg-white bg-opacity-50 border-gray-300 text-gray-800'
                }`}
                rows={3}
                autoFocus
              />
              <div className="flex space-x-2">
                <button
                  onClick={handleSubmitEdit}
                  className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl text-xs hover:from-green-600 hover:to-emerald-700 transition-all transform hover:scale-105 shadow-lg"
                >
                  Save
                </button>
                <button
                  onClick={() => onCancelEdit(message.id)}
                  className="px-4 py-2 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-xl text-xs hover:from-gray-600 hover:to-gray-700 transition-all transform hover:scale-105 shadow-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div 
              className={`whitespace-pre-wrap text-sm leading-relaxed ${
                isDarkMode ? 'text-gray-100' : 'text-gray-800'
              }`}
            >
              {cleanMarkdownFormatting(currentVersion.content)}
            </div>
          )}
          
          <div className={`flex items-center justify-between mt-3 text-xs ${
            isDarkMode ? 'text-gray-400' : 'text-gray-500'
          }`}>
            <span className="flex items-center space-x-1">
              <div className="w-1 h-1 bg-indigo-500 rounded-full"></div>
              <span>{currentVersion.timestamp.toLocaleTimeString()}</span>
            </span>
            
            <div className="flex items-center space-x-2">
              {/* Version navigation - only show if there are multiple versions */}
              {versionInfo && versionInfo.total > 1 && (
                <div className="flex items-center space-x-1 bg-black bg-opacity-10 rounded-lg px-2 py-1">
                  <button
                    onClick={() => onNavigateVersion(message.id, 'prev')}
                    disabled={versionInfo.current <= 1}
                    className="p-1 hover:bg-black hover:bg-opacity-20 rounded disabled:opacity-50 transition-all"
                    title="Previous version"
                  >
                    <ChevronLeft className="w-3 h-3" />
                  </button>
                  <span className="text-xs font-mono px-1">
                    {versionInfo.current}/{versionInfo.total}
                  </span>
                  <button
                    onClick={() => onNavigateVersion(message.id, 'next')}
                    disabled={versionInfo.current >= versionInfo.total}
                    className="p-1 hover:bg-black hover:bg-opacity-20 rounded disabled:opacity-50 transition-all"
                    title="Next version"
                  >
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              )}
              
              {/* Edit button - only for user messages */}
              {isUser && !message.isEditing && (
                <button
                  onClick={() => onStartEdit(message.id)}
                  className="p-1 hover:bg-black hover:bg-opacity-20 rounded opacity-70 hover:opacity-100 transition-all transform hover:scale-110"
                  title="Edit message"
                >
                  <Edit3 className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant; 