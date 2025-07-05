import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Loader2, ChevronRight, BarChart3, Target, Calendar, NotebookPen, CheckSquare, Clock, Code } from 'lucide-react';
import { geminiService } from '../../services/geminiService';
import { voiceService } from '../../services/voiceService';
// Using localStorage-first pattern instead of direct Supabase calls
import { useAuthContext } from '../AuthProvider';
import LifelyLogo from '../LifelyLogo';
import { getUserData, setUserData } from '../../utils/userStorage';

// Import the questions from VoiceMemoOnboarding
const ONBOARDING_QUESTIONS = [
  {
    id: 1,
    question: "What brought you here? What's going on in your life that made you look for a better way to stay organized?",
    focus: "Understanding your motivation and current pain points"
  },
  {
    id: 2,
    question: "What's your biggest challenge with staying on top of everything? Where do things usually fall through the cracks?",
    focus: "Identifying workflow gaps and problem areas"
  },
  {
    id: 3,
    question: "Walk me through what a typical day looks like for you right now.",
    focus: "Learning your current routine and schedule patterns"
  },
  {
    id: 4,
    question: "What would need to change for you to feel like you're actually in control of your schedule and tasks?",
    focus: "Defining your ideal productivity state"
  },
  {
    id: 5,
    question: "What are you working toward in the next few months that you don't want to lose track of?",
    focus: "Capturing important goals and projects"
  }
];

// Helper function to convert base64 to blob for transcription
const base64ToBlob = async (base64Data: string): Promise<Blob> => {
  const response = await fetch(base64Data);
  return response.blob();
};

interface DashboardData {
  categories: Array<{id: string; name: string; purpose: string; priority: number; icon: string; color: string}>;
  goals: Array<{id: string; title: string; category: string; timeline: string; priority: number}>;
  routines: Array<{id: string; title: string; frequency: string; time: string; category: string}>;
  todos: Array<{id: string; title: string; category: string; priority: number}>;
  events: Array<{id: string; title: string; category: string; date: string}>;
  notes: Array<{id: string; title: string; category: string; content: string}>;
  workStyle?: string;
  priorities?: string[];
  interests?: string[];
  personalInsights?: string[];
}

interface FunctionCall {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'executing' | 'completed' | 'error';
  code: string;
  result?: any;
  error?: string;
}

export default function OnboardingProcessingNew() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuthContext();
  // Note: We're using localStorage-first pattern, so no direct Supabase calls needed
  const [currentStep, setCurrentStep] = useState(0);
  const [functionCalls, setFunctionCalls] = useState<FunctionCall[]>([]);
  const [selectedFunction, setSelectedFunction] = useState<FunctionCall | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [creatingDatabase, setCreatingDatabase] = useState(false);
  const [hasStartedProcessing, setHasStartedProcessing] = useState(false);

  const steps = [
    { title: 'Analyzing Context', description: 'Processing your uploaded files and preferences' },
    { title: 'AI Personalization', description: 'Creating your tailored dashboard with Gemini Agent' },
    { title: 'Finalizing Data', description: 'Preparing categories, goals, and tasks' },
    { title: 'Building Dashboard', description: 'Assembling your personalized interface' }
  ];

  const processOnboardingData = async () => {
    try {
      if (!user?.id) {
        throw new Error('No authenticated user found');
      }
      
      // Get ALL onboarding data (user-specific)
      const onboardingType = getUserData(user.id, 'lifely_onboarding_type', null);
      
      // 1. Get initial onboarding data (role, source, goals)
      const initialData = getUserData(user.id, 'lifely_onboarding_data', null);
      
      // 2. Get conversation/voice memo responses  
      let conversationText = '';
      
      // ENHANCED DEBUGGING: Track conversation data extraction
      console.log('🔍 DEBUG: Onboarding type detected:', onboardingType);
      
      if (onboardingType === 'conversation') {
        const convData = getUserData(user.id, 'lifely_onboarding_conversation', null);
        
        console.log('🔍 DEBUG: Raw conversation data from localStorage:', convData);
        console.log('🔍 DEBUG: Conversation data type:', typeof convData);
        console.log('🔍 DEBUG: Has answers property:', !!(convData && typeof convData === 'object' && (convData as any).answers));
        
        if (convData && typeof convData === 'object' && (convData as any).answers) {
          const answers = (convData as any).answers;
          console.log('🔍 DEBUG: Number of answers found:', answers.length);
          console.log('🔍 DEBUG: Sample answers:', answers.slice(0, 2));
          
          conversationText = answers.map((answer: any) => 
            `Q: ${answer.question}\\nA: ${answer.answer}`
          ).join('\\n\\n');
          
          console.log('🔍 DEBUG: Formatted conversation text length:', conversationText.length);
          console.log('🔍 DEBUG: Conversation text preview:', conversationText.substring(0, 200) + '...');
        } else {
          console.warn('⚠️ DEBUG: No valid conversation data found');
        }
      } else if (onboardingType === 'voice_memo') {
        // CRITICAL FIX: Use actual Whisper transcription instead of placeholder text
        const voiceMemoData = getUserData(user.id, 'lifely_voice_memo_recording', null);
        
        if (voiceMemoData && typeof voiceMemoData === 'object') {
          const memoData = voiceMemoData as any;
          
          // Check if we already have a transcription
          if (memoData.transcription) {
            console.log('✅ Using existing voice memo transcription');
            conversationText = `VOICE MEMO TRANSCRIPTION (90% WEIGHT - PRIMARY CONTEXT):\n"${memoData.transcription}"\n\nQUESTIONS ANSWERED IN VOICE MEMO:\n${ONBOARDING_QUESTIONS.map(q => `${q.id}. ${q.question}`).join('\n')}`;
          } else if (memoData.audioData) {
            console.log('🎙️ Voice memo found - transcribing with Whisper...');
            try {
              // Convert base64 audio data back to blob for transcription
              const audioBlob = await base64ToBlob(memoData.audioData);
              
              // Transcribe using OpenAI Whisper with context about onboarding questions
              const transcriptionResult = await voiceService.transcribeWithContext(
                audioBlob, 
                'life-organization'
              );
              
              if (transcriptionResult.text) {
                console.log('✅ Voice memo transcribed successfully');
                // Save transcription for future use
                const updatedMemoData = { ...memoData, transcription: transcriptionResult.text };
                setUserData(user.id, 'lifely_voice_memo_recording', updatedMemoData);
                
                conversationText = `VOICE MEMO TRANSCRIPTION (90% WEIGHT - PRIMARY CONTEXT):\n"${transcriptionResult.text}"\n\nQUESTIONS ANSWERED IN VOICE MEMO:\n${ONBOARDING_QUESTIONS.map(q => `${q.id}. ${q.question}`).join('\n')}`;
              } else {
                throw new Error('No transcription text returned');
              }
            } catch (transcriptionError) {
              console.error('❌ Voice memo transcription failed:', transcriptionError);
              conversationText = `VOICE MEMO RECORDED (90% WEIGHT - PRIMARY CONTEXT):\nUser recorded a ${Math.floor(memoData.duration || 0)} second voice memo answering the following questions:\n${ONBOARDING_QUESTIONS.map(q => `${q.id}. ${q.question}`).join('\n')}\n\nNote: Transcription failed - using fallback context.`;
            }
          }
        }
        
        if (!conversationText) {
          conversationText = 'Voice memo responses about life organization and goals (transcription pending)';
        }
      }
      
      // 3. Get document context (enhanced extraction)
      const documents = getUserData(user.id, 'lifely_onboarding_documents', []);
      let documentContext = '';
      if (documents.length > 0) {
        documentContext = documents.map((doc: any) => {
          if (doc.type === 'youtube') {
            return `YOUTUBE VIDEO CONTEXT:\nTitle/URL: ${doc.name || 'YouTube content'}\nContent: ${doc.content}`;
          } else if (doc.type === 'text') {
            return `USER-ADDED NOTE:\n"${doc.content}"`;
          } else {
            // For files, include more context and key details
            const content = doc.content || '';
            const preview = content.length > 1000 ? content.substring(0, 1000) + '...' : content;
            return `UPLOADED DOCUMENT: "${doc.name}"\nContent: ${preview}\n[Document provides context about user's current work/projects/interests]`;
          }
        }).join('\\n\\n');
        
        // Add a summary note about the documents
        documentContext += `\n\nDOCUMENT SUMMARY: User uploaded ${documents.length} file(s) which likely contain details about their current projects, workflows, interests, or professional context. Extract specific details from these documents to create personalized categories.`;
      }
      
      // Build complete context with PROPER WEIGHTING
      // CRITICAL: 5 conversation questions = 90% weight, initial 4 questions = 10% weight
      let fullContext = '';
      
      // PRIMARY CONTEXT (90% weight): Conversation/Voice Memo responses
      if (conversationText) {
        fullContext += `PRIMARY PERSONALIZATION CONTEXT (90% WEIGHT - MOST IMPORTANT):\\n`;
        fullContext += `Based on detailed 5-question conversation/voice memo:\\n`;
        fullContext += `${conversationText}\\n\\n`;
        fullContext += `INSTRUCTION: Use this conversation context as the PRIMARY source for all personalization decisions. This represents the user's actual detailed responses and should drive 90% of the dashboard creation.\\n\\n`;
      }
      
      // SECONDARY CONTEXT (90% weight): File uploads and documents  
      if (documentContext) {
        fullContext += `SECONDARY PERSONALIZATION CONTEXT (HIGH WEIGHT - VERY IMPORTANT):\\n`;
        fullContext += `User-uploaded files and documents:\\n`;
        fullContext += `${documentContext}\\n\\n`;
        fullContext += `INSTRUCTION: Extract specific details from these documents to create highly personalized categories and content. These files contain real context about the user's work and interests.\\n\\n`;
      }
      
      // MINIMAL CONTEXT (10% weight): Initial basic questions
      if (initialData && typeof initialData === 'object') {
        const data = initialData as any;
        fullContext += `BASIC BACKGROUND INFO (10% WEIGHT - MINIMAL INFLUENCE):\\n`;
        fullContext += `Role: ${data.role || 'Not specified'}\\n`;
        fullContext += `How they found us: ${data.source || 'Not specified'}\\n`;
        fullContext += `Selected goals: ${data.goals?.join(', ') || 'None'}\\n`;
        fullContext += `INSTRUCTION: Use this only as basic background - do NOT let this override the detailed conversation responses above.\\n\\n`;
      }
      
      // 4. Get connected integrations context
      const connectedIntegrations = getUserData(user.id, 'lifely_onboarding_integrations', []);
      if (connectedIntegrations.length > 0) {
        fullContext += `CONNECTED INTEGRATIONS:\\n`;
        fullContext += `User has connected: ${connectedIntegrations.join(', ')}\\n`;
        fullContext += `This indicates they use these tools for: ${connectedIntegrations.map((int: string) => {
          switch(int) {
            case 'google-calendar': return 'Google Calendar for scheduling';
            case 'microsoft-calendar': return 'Microsoft Calendar for scheduling';
            case 'notion': return 'Notion for notes and project management';
            case 'onenote': return 'OneNote for note-taking';
            case 'todoist': return 'Todoist for task management';
            case 'youtube': return 'YouTube for content creation/consumption';
            default: return int;
          }
        }).join(', ')}\\n\\n`;
      }

      // Analyze context richness for the agent
      const contextRichness = {
        hasConversation: conversationText.length > 0,
        hasDocuments: documents.length > 0,
        hasInitialData: !!initialData,
        hasIntegrations: connectedIntegrations.length > 0,
        totalContextLength: fullContext.length
      };
      
      let contextQuality = 'minimal';
      if (contextRichness.hasConversation && contextRichness.hasDocuments && contextRichness.hasIntegrations) {
        contextQuality = 'rich';
      } else if (contextRichness.hasConversation || (contextRichness.hasDocuments && contextRichness.hasIntegrations)) {
        contextQuality = 'moderate';
      }
      
      // Add context quality assessment to help the agent
      fullContext += `\n\nCONTEXT QUALITY ASSESSMENT:
- Input richness: ${contextQuality}
- Has conversation responses: ${contextRichness.hasConversation}
- Has uploaded documents: ${contextRichness.hasDocuments} (${documents.length} files)
- Has connected integrations: ${contextRichness.hasIntegrations} (${connectedIntegrations.join(', ') || 'none'})
- Onboarding type: ${onboardingType || 'unknown'}

PERSONALIZATION GUIDANCE:
${contextQuality === 'rich' ? 'Create highly specific, detailed personalization using all available context.' :
  contextQuality === 'moderate' ? 'Create targeted personalization focusing on the strongest available signals.' :
  'Create foundational personalization around whatever specific details are available, avoiding generic categories.'}`;

      // CRITICAL DEBUG: Show what context we're working with
      console.log('📋 COMPREHENSIVE ONBOARDING ANALYSIS:');
      console.log('- Context quality:', contextQuality);
      console.log('- Onboarding type:', onboardingType);
      console.log('- Conversation length:', conversationText.length);
      console.log('- Documents uploaded:', documents.length);
      console.log('- Connected integrations:', connectedIntegrations.length);
      console.log('- Total context length:', fullContext.length);
      console.log('- Context preview:', fullContext.substring(0, 500) + '...');
      
      // CRITICAL DEBUG: Show the FULL CONTEXT being sent to AI
      console.log('🎯 FULL CONTEXT BEING SENT TO AI:');
      console.log('=====================================');
      console.log(fullContext);
      console.log('=====================================');
      
      // CRITICAL DEBUG: Check if conversation text contains user's specific mentions
      if (conversationText) {
        console.log('🔍 CONVERSATION CONTENT ANALYSIS:');
        console.log('- Contains "catholic":', conversationText.toLowerCase().includes('catholic'));
        console.log('- Contains "workout":', conversationText.toLowerCase().includes('workout'));
        console.log('- Contains "fitness":', conversationText.toLowerCase().includes('fitness'));
        console.log('- Contains "faith":', conversationText.toLowerCase().includes('faith'));
        console.log('- Contains "gym":', conversationText.toLowerCase().includes('gym'));
        console.log('- Contains "prayer":', conversationText.toLowerCase().includes('prayer'));
        console.log('- Actual conversation text:');
        console.log(conversationText);
      } else {
        console.error('❌ NO CONVERSATION TEXT FOUND - This is why AI creates generic categories!');
      }
      
      if (!fullContext.trim()) {
        console.warn('⚠️ No onboarding context found - creating basic context for new user');
        fullContext = `USER PROFILE: New user seeking life organization and productivity improvement. Looking to establish better systems for managing tasks, goals, and daily routines.

CONTEXT QUALITY ASSESSMENT:
- Input richness: minimal
- Has conversation responses: false
- Has uploaded documents: false (0 files)
- Has connected integrations: false (none)
- Onboarding type: unknown

PERSONALIZATION GUIDANCE:
Create foundational categories focused on general productivity and life organization.`;
      }

      // Step 1: Analyze responses
      setCurrentStep(0);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 2: Create comprehensive dashboard using Gemini Agent
      setCurrentStep(1);
      const agentFunction: FunctionCall = {
        id: 'agent-personalization',
        name: 'createPersonalizedDashboard',
        description: 'Generate comprehensive personalized dashboard using AI agent',
        status: 'executing',
        code: `const dashboard = await geminiAgent.createPersonalizedDashboard({
  userContext: fullContext,
  includeCategories: true,
  includeGoals: true,
  includeRoutines: true,
  includeTodos: true,
  includeNotes: true,
  includeEvents: true
});
return comprehensiveDashboard;`
      };

      setFunctionCalls([agentFunction]);

      // Execute single agent call for everything
      const categoriesResult = await createCategories(fullContext);
      
      // Update function as completed
      setFunctionCalls(prev => prev.map(fc => ({ ...fc, status: 'completed', result: categoriesResult })));

      // Step 3: Finalize dashboard (agent already created everything)
      setCurrentStep(2);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Step 4: Assemble final data
      setCurrentStep(3);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const finalData = {
        categories: categoriesResult.categories,
        goals: categoriesResult.goals,
        routines: categoriesResult.routines,
        todos: categoriesResult.todos,
        events: categoriesResult.events,
        notes: categoriesResult.notes,
        // Use AI-generated insights from categoriesResult, with fallbacks
        workStyle: categoriesResult.workStyle || "Focused and goal-oriented",
        priorities: categoriesResult.categories.map((c: any) => c.name),
        interests: categoriesResult.categories.map((c: any) => c.purpose || c.name),
        personalInsights: categoriesResult.personalInsights || [
          "You have a balanced approach to life management",
          "Your priorities align with long-term growth", 
          "You value both productivity and personal development"
        ]
      };

      setDashboardData(finalData);
      
      setFunctionCalls(prev => prev.map(fc => 
        fc.id === 'agent-personalization' ? { ...fc, status: 'completed', result: finalData } : fc
      ));

      setIsComplete(true);

      // Create real categories and items in Supabase
      console.log('🎯 About to call createRealDashboardData with:', finalData);
      try {
        await createRealDashboardData(finalData);
        console.log('✅ createRealDashboardData completed successfully');
      } catch (databaseError) {
        console.error('❌ createRealDashboardData failed:', databaseError);
        // Continue with navigation even if database creation fails
      }
      
      // Save data for the completion screen (user-specific)
      setUserData(user.id, 'lifely_extracted_data', finalData);
      // Note: Don't set lifely_onboarding_completed here - let OnboardingComplete do it
      
      // Navigate to OnboardingComplete to show results and finalize setup
      setTimeout(() => {
        navigate('/onboarding/complete');
      }, 2000);

    } catch (error) {
      console.error('Processing error:', error);
    }
  };

  useEffect(() => {
    // Start processing when auth is ready (localStorage-first pattern)
    if (!authLoading && user && !hasStartedProcessing) {
      console.log('🚀 Starting onboarding processing - user authenticated');
      setHasStartedProcessing(true);
      processOnboardingData();
    } else if (!authLoading && !user) {
      console.error('❌ No user found - redirecting to auth');
      navigate('/auth');
    } else {
      console.log('⏳ Waiting for auth...', { authLoading, user: !!user, hasStartedProcessing });
    }
  }, [authLoading, user, navigate]); // REMOVED hasStartedProcessing and processOnboardingData to prevent infinite loop

  const createRealDashboardData = async (dashboardData: DashboardData) => {
    try {
      if (!user?.id) {
        throw new Error('No authenticated user found');
      }
      
      setCreatingDatabase(true);
      console.log('🚀 Creating real dashboard data using localStorage-first pattern...', dashboardData);
      
      // FOLLOW HYBRID SYNC PATTERN: LocalStorage first, then sync to Supabase
      
      // Step 1: Create categories in user-specific localStorage (with timestamp IDs like hybrid sync)
      const existingCategories = getUserData(user.id, 'lifeStructureCategories', []);
      const newCategories: any[] = [];
      const categoryMapping = new Map<string, string>();
      
      // Track used emojis to ensure uniqueness across all categories
      const usedEmojis = new Set<string>();
      
      // Add existing category emojis to tracking set
      existingCategories.forEach((cat: any) => {
        if (cat.icon) usedEmojis.add(cat.icon);
      });
      
      for (const category of dashboardData.categories) {
        // Check if category already exists (by name)
        const existingCategory = existingCategories.find((c: any) => c.name.toLowerCase() === category.name.toLowerCase());
        
        if (existingCategory) {
          // Use existing category
          categoryMapping.set(category.id, (existingCategory as any).id);
          categoryMapping.set(category.name.toLowerCase(), (existingCategory as any).id);
          console.log('✅ Using existing category:', category.name, 'with ID:', (existingCategory as any).id);
        } else {
          // Create new category with timestamp ID (like hybrid sync pattern)
          const newCategoryId = `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          // Smart emoji selection system that ensures unique and contextually appropriate icons
          const selectSmartEmoji = (categoryName: string, categoryPurpose: string, usedEmojis: Set<string>) => {
            // If it's already an emoji, check if it's unique
            if (categoryName && /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(categoryName)) {
              if (!usedEmojis.has(categoryName)) {
                usedEmojis.add(categoryName);
                return categoryName;
              }
            }
            
            // Comprehensive contextual emoji mapping
            const contextualEmojiMap: Record<string, string[]> = {
              // Work & Business
              business: ['💼', '🏢', '📈', '💰', '🎯'],
              work: ['💼', '🏢', '👨‍💼', '📊', '💻'],
              career: ['🚀', '📈', '🎯', '💼', '🌟'],
              entrepreneur: ['🚀', '💡', '💰', '🎯', '📈'],
              startup: ['🚀', '💡', '⚡', '🎯', '📱'],
              finance: ['💰', '💸', '📊', '💳', '🏦'],
              
              // Health & Fitness
              health: ['🏥', '💊', '🩺', '❤️', '🧬'],
              fitness: ['💪', '🏋️', '🏃', '⚽', '🎾'],
              gym: ['💪', '🏋️', '🏃‍♂️', '⚽', '🥊'],
              wellness: ['🧘', '🌿', '💚', '☮️', '🌸'],
              nutrition: ['🥗', '🍎', '🥑', '🌱', '💚'],
              
              // Education & Learning
              education: ['🎓', '📚', '✏️', '🔬', '🧠'],
              academic: ['🎓', '📚', '✏️', '🏫', '📝'],
              study: ['📚', '✏️', '📝', '🔍', '💡'],
              learning: ['🧠', '📚', '💡', '🔍', '📖'],
              research: ['🔬', '🔍', '📊', '📈', '🧪'],
              
              // Technology & Development
              technology: ['💻', '⚙️', '🔧', '💾', '🌐'],
              development: ['💻', '⚙️', '🔧', '📱', '🖥️'],
              coding: ['💻', '⌨️', '🖥️', '📱', '⚙️'],
              software: ['💻', '📱', '🖥️', '💾', '⚙️'],
              design: ['🎨', '🖌️', '✏️', '🌈', '📐'],
              
              // Creative & Arts
              creative: ['🎨', '🖌️', '✨', '🌈', '🎭'],
              art: ['🎨', '🖌️', '🖼️', '✏️', '🌈'],
              music: ['🎵', '🎶', '🎸', '🎹', '🎤'],
              writing: ['✏️', '📝', '📖', '📄', '✍️'],
              content: ['📹', '📸', '📱', '🎬', '📺'],
              
              // Personal & Lifestyle
              personal: ['👤', '🌟', '💫', '🦋', '🌱'],
              lifestyle: ['🌟', '☀️', '🌸', '🦋', '💫'],
              hobby: ['🎨', '🎮', '📚', '🎵', '⚽'],
              travel: ['✈️', '🌍', '🏖️', '🗺️', '🎒'],
              family: ['👨‍👩‍👧‍👦', '❤️', '🏠', '👶', '🤗'],
              
              // Spiritual & Religious
              spiritual: ['🙏', '☮️', '🕊️', '✨', '🌟'],
              religious: ['🙏', '⛪', '✝️', '☮️', '🕊️'],
              catholic: ['✝️', '⛪', '🙏', '📿', '🕊️'],
              faith: ['🙏', '✨', '🌟', '☮️', '🕊️'],
              
              // Organization & Productivity
              organization: ['📋', '📊', '🗂️', '📅', '⚡'],
              productivity: ['⚡', '🎯', '📈', '🚀', '⚙️'],
              planning: ['📅', '📋', '🗂️', '📊', '🎯'],
              goals: ['🎯', '🏆', '🌟', '🚀', '📈'],
              
              // Social & Community
              social: ['👥', '🤝', '💬', '🌐', '🎉'],
              community: ['👥', '🤝', '🌍', '🏘️', '💬'],
              networking: ['🤝', '🌐', '📱', '💬', '👥'],
              
              // Sports & Activities
              sports: ['⚽', '🏀', '🎾', '🏈', '⚾'],
              gaming: ['🎮', '🕹️', '🎯', '🏆', '⚡'],
              outdoor: ['🌲', '🏔️', '🌊', '☀️', '🦅']
            };
            
            // Analyze category name and purpose for context
            const categoryText = `${categoryName} ${categoryPurpose || ''}`.toLowerCase();
            
            // Find matching emoji groups based on keywords
            let candidateEmojis: string[] = [];
            
            for (const [keyword, emojis] of Object.entries(contextualEmojiMap)) {
              if (categoryText.includes(keyword)) {
                candidateEmojis.push(...emojis);
              }
            }
            
            // If no contextual matches, use general mapping
            if (candidateEmojis.length === 0) {
              const generalMap: Record<string, string> = {
                'graduation-cap': '🎓', 'briefcase': '💼', 'dumbbell': '💪',
                'brain': '🧠', 'heart': '❤️', 'user': '👤', 'book': '📚',
                'home': '🏠', 'target': '🎯', 'dollar-sign': '💰',
                'calendar': '📅', 'computer': '💻', 'music': '🎵'
              };
              
              const categoryNameLower = categoryName.toLowerCase();
              for (const [key, emoji] of Object.entries(generalMap)) {
                if (categoryNameLower.includes(key) || categoryText.includes(key)) {
                  candidateEmojis.push(emoji);
                }
              }
            }
            
            // Select first unique emoji from candidates
            for (const emoji of candidateEmojis) {
              if (!usedEmojis.has(emoji)) {
                usedEmojis.add(emoji);
                console.log('✨ Selected contextual emoji:', emoji, 'for category:', categoryName);
                return emoji;
              }
            }
            
            // Fallback to unique emojis if no contextual match
            const fallbackEmojis = ['📁', '📂', '🗂️', '📋', '📊', '📈', '⭐', '💫', '🌟', '✨', '🔹', '🔸', '🟢', '🟡', '🟠', '🔴'];
            for (const emoji of fallbackEmojis) {
              if (!usedEmojis.has(emoji)) {
                usedEmojis.add(emoji);
                console.log('📁 Using fallback emoji:', emoji, 'for category:', categoryName);
                return emoji;
              }
            }
            
            // Ultimate fallback
            return '📋';
          };
          
          // Convert AI color names to hex colors for consistent theming
          const convertColorToHex = (colorName: string) => {
            const colorMap: Record<string, string> = {
              'blue': '#3B82F6',
              'purple': '#8B5CF6',
              'green': '#10B981',
              'red': '#EF4444',
              'yellow': '#F59E0B',
              'indigo': '#6366F1',
              'pink': '#EC4899',
              'orange': '#F97316',
              'teal': '#14B8A6',
              'cyan': '#06B6D4'
            };
            return colorMap[colorName] || colorName || '#3B82F6';
          };
          
          const newCategory = {
            id: newCategoryId,
            name: category.name,
            icon: selectSmartEmoji(category.name, category.purpose, usedEmojis),
            color: convertColorToHex(category.color),
            priority: category.priority || 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          
          newCategories.push(newCategory);
          categoryMapping.set(category.id, newCategoryId);
          categoryMapping.set(category.name.toLowerCase(), newCategoryId);
          console.log('✅ Created new category:', category.name, 'with ID:', newCategoryId);
        }
      }
      
      // Save updated categories to user-specific localStorage
      const allCategories = [...existingCategories, ...newCategories];
      setUserData(user.id, 'lifeStructureCategories', allCategories);
      console.log('💾 Saved', allCategories.length, 'categories to user-specific localStorage for', user.email);
      
      // Step 2: Create items in user-specific localStorage (with timestamp IDs like hybrid sync)
      const existingItems = getUserData(user.id, 'lifeStructureItems', []);
      const newItems: any[] = [];
      
      // Helper function to find category ID
      const findCategoryId = (categoryRef: string) => {
        return categoryMapping.get(categoryRef) || 
               categoryMapping.get(categoryRef.toLowerCase()) ||
               allCategories.find((c: any) => c.name.toLowerCase().includes(categoryRef.toLowerCase()))?.id;
      };

      // Create todos
      dashboardData.todos?.forEach(todo => {
        const categoryId = findCategoryId(todo.category);
        if (categoryId) {
          const itemId = `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          newItems.push({
            id: itemId,
            title: todo.title,
            text: '',
            type: 'todo',
            completed: false,
            categoryId: categoryId,
            metadata: { 
              priority: (todo.priority && todo.priority > 3 ? 'high' : todo.priority && todo.priority > 1 ? 'medium' : 'low'),
              aiGenerated: true
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          console.log('✅ Created todo:', todo.title);
        } else {
          console.warn('⚠️ Could not find category for todo:', todo.title, 'category ref:', todo.category);
        }
      });
      
      // Create events  
      dashboardData.events?.forEach(event => {
        const categoryId = findCategoryId(event.category);
        if (categoryId) {
          const itemId = `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          newItems.push({
            id: itemId,
            title: event.title,
            text: '',
            type: 'event',
            completed: false,
            categoryId: categoryId,
            dateTime: event.date ? new Date(event.date).toISOString() : new Date().toISOString(),
            metadata: { 
              priority: 'medium',
              aiGenerated: true
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          console.log('✅ Created event:', event.title);
        } else {
          console.warn('⚠️ Could not find category for event:', event.title, 'category ref:', event.category);
        }
      });
      
      // Create notes
      dashboardData.notes?.forEach(note => {
        const categoryId = findCategoryId(note.category);
        if (categoryId) {
          const itemId = `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          newItems.push({
            id: itemId,
            title: note.title,
            text: note.content || '',
            type: 'note',
            completed: false,
            categoryId: categoryId,
            metadata: { 
              priority: 'medium',
              aiGenerated: true
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          console.log('✅ Created note:', note.title);
        } else {
          console.warn('⚠️ Could not find category for note:', note.title, 'category ref:', note.category);
        }
      });
      
      // Create goals
      dashboardData.goals?.forEach(goal => {
        const categoryId = findCategoryId(goal.category);
        if (categoryId) {
          const itemId = `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          newItems.push({
            id: itemId,
            title: goal.title,
            text: `Timeline: ${goal.timeline}`,
            type: 'goal',
            completed: false,
            categoryId: categoryId,
            metadata: { 
              priority: (goal.priority && goal.priority > 3 ? 'high' : goal.priority && goal.priority > 1 ? 'medium' : 'low'),
              timeline: goal.timeline,
              aiGenerated: true
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          console.log('✅ Created goal:', goal.title);
        } else {
          console.warn('⚠️ Could not find category for goal:', goal.title, 'category ref:', goal.category);
        }
      });
      
      // Create routines
      dashboardData.routines?.forEach(routine => {
        const categoryId = findCategoryId(routine.category);
        if (categoryId) {
          const itemId = `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          newItems.push({
            id: itemId,
            title: routine.title,
            text: `${routine.frequency} at ${routine.time}`,
            type: 'routine',
            completed: false,
            categoryId: categoryId,
            metadata: { 
              priority: 'medium',
              frequency: routine.frequency,
              time: routine.time,
              aiGenerated: true
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          console.log('✅ Created routine:', routine.title);
        } else {
          console.warn('⚠️ Could not find category for routine:', routine.title, 'category ref:', routine.category);
        }
      });
      
      // Save all items to user-specific localStorage (existing + new)
      const allItems = [...existingItems, ...newItems];
      setUserData(user.id, 'lifeStructureItems', allItems);
      console.log('💾 Saved', allItems.length, 'items to user-specific localStorage for', user.email, '(', newItems.length, 'new items)');
      
      // Trigger a manual sync to push to Supabase immediately
      console.log('🔄 Triggering manual sync to push data to Supabase...');
      if (window && (window as any).hybridSyncService) {
        try {
          await (window as any).hybridSyncService.manualSync();
          console.log('✅ Manual sync completed - data should now be in Supabase');
        } catch (syncError) {
          console.warn('⚠️ Manual sync failed, but data is safe in localStorage:', syncError);
        }
      } else {
        console.warn('⚠️ HybridSyncService not available, data saved to localStorage only');
      }
      
      // Force refresh the data in the app
      window.dispatchEvent(new CustomEvent('hybridSyncComplete'));
      
      console.log('🎉 Dashboard data creation process completed!');
      console.log('📊 Summary:', {
        categoriesCreated: newCategories.length,
        itemsCreated: newItems.length,
        totalCategories: allCategories.length,
        totalItems: allItems.length
      });
      
    } catch (error) {
      console.error('❌ Error creating dashboard data:', error);
    } finally {
      setCreatingDatabase(false);
    }
  };

  // Step 1: Analyze user profile and extract key themes
  const analyzeProfile = async (fullContext: string) => {
    // Enhanced prompt specifically for file upload scenarios
    const prompt = `IMPORTANT: You must respond with ONLY pure JSON. Do not use function calls. Do not use markdown formatting.

You are analyzing a user's life context from documents, uploads, and any available profile data. Even if they didn't answer detailed questions, extract meaningful life themes from whatever context is available.

Context to analyze: "${fullContext}"

INSTRUCTIONS:
1. Look for ANY mentions of: work/business, hobbies, goals, current projects, interests, skills, challenges
2. If documents mention specific tools/apps they use, infer their workflow preferences
3. Extract concrete details like company names, project names, specific interests, locations, technologies
4. If minimal context, focus on creating categories around what IS mentioned
5. Avoid generic categories - make them specific to any concrete details found

Return ONLY pure JSON (no markdown, no function calls):
{
  "themes": ["specific_work_area", "specific_interest", "mentioned_goal_area", "tool_workflow"],
  "specificDetails": {
    "businessName": "extracted company/project name or null",
    "toolsUsed": ["specific tools mentioned"],
    "interests": ["specific interests found"],
    "currentProjects": ["any projects mentioned"],
    "skillAreas": ["technical or professional skills mentioned"],
    "location": "if mentioned",
    "personalValues": "any values/beliefs mentioned"
  },
  "personality": "inferred from writing style and content focus",
  "contextQuality": "rich|moderate|minimal",
  "primaryFocus": "the main area of focus detected"
}`;
    
    const result = await geminiService.processMessage(prompt, [], [], [], false, false);
    // Clean markdown formatting before parsing JSON
    const cleanResponse = result.response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleanResponse);
  };

  // Step 2: Create personalized categories based on analysis
  const createPersonalizedCategories = async (analysis: any) => {
    // Build context quality assessment
    const contextQuality = analysis.contextQuality || 'minimal';
    const primaryFocus = analysis.primaryFocus || 'general productivity';
    
    const prompt = `IMPORTANT: You must respond with ONLY pure JSON. Do not use function calls. Do not use markdown formatting.

Create 4-6 personalized life categories for this user based on their ${contextQuality} context:

Analysis Results:
- Themes: ${analysis.themes.join(', ')}
- Primary Focus: ${primaryFocus}
- Specific Details: ${JSON.stringify(analysis.specificDetails)}
- Personality: ${analysis.personality}
- Context Quality: ${contextQuality}

CATEGORY CREATION RULES:
1. If businessName exists: Create specific business category with exact name
2. If toolsUsed mentioned: Create workflow/productivity category around those tools
3. If currentProjects exist: Create project-specific categories
4. If skillAreas mentioned: Create skill development categories
5. For minimal context: Focus on the primary theme detected and build around it
6. Always include at least one personal development/health category
7. Use specific names, never generic ones like "Work" or "Personal"

Examples of GOOD categories for file-only context:
- "Notion Workspace Organization" (if Notion mentioned)
- "Frontend Development Projects" (if coding mentioned)
- "Content Creation Pipeline" (if creating content)
- "Real Estate Investment Research" (if property mentioned)

Return ONLY pure JSON (no markdown, no function calls):
{
  "categories": [
    {"id": "specific-work-area", "name": "Actual Specific Name Based on Context", "purpose": "Clear purpose from their context", "priority": 9, "icon": "relevant-icon", "color": "blue"},
    {"id": "detected-interest", "name": "Their Actual Interest Area", "purpose": "Based on what they mentioned", "priority": 8, "icon": "relevant-icon", "color": "green"}
  ]
}`;
    
    const result = await geminiService.processMessage(prompt, [], [], [], false, false);
    // Clean markdown formatting before parsing JSON
    const cleanResponse = result.response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleanResponse);
  };

  // Step 3: Create specific goals for each category
  const createGoalsForCategories = async (categories: any[], analysis: any) => {
    const goals = [];
    const contextQuality = analysis.contextQuality || 'minimal';
    
    for (const category of categories) {
      const prompt = `IMPORTANT: You must respond with ONLY pure JSON. Do not use function calls. Do not use markdown formatting.

Create 2-3 specific, actionable goals for "${category.name}" category based on ${contextQuality} context.

Available Context:
- User Details: ${JSON.stringify(analysis.specificDetails)}
- Category Purpose: ${category.purpose}
- Primary Focus: ${analysis.primaryFocus}
- Tools Used: ${analysis.specificDetails.toolsUsed?.join(', ') || 'none specified'}
- Current Projects: ${analysis.specificDetails.currentProjects?.join(', ') || 'none specified'}

GOAL CREATION RULES:
1. If specific projects mentioned: Create goals around completing/improving them
2. If tools mentioned: Create goals around mastering/optimizing those tools
3. If business mentioned: Create revenue/growth goals with realistic numbers
4. For minimal context: Create foundational goals that make sense for the category
5. Make timelines realistic (1-3 months for specific tasks, 3-6 months for major goals)
6. Include both process goals (habits) and outcome goals (results)

PRIORITY SYSTEM (use logical values):
- priority: 5 = Critical/Urgent goals that require immediate attention
- priority: 4 = High importance goals that are key to success
- priority: 3 = Medium importance goals that support progress
- priority: 2 = Low importance goals that are nice to have
- priority: 1 = Optional goals for future consideration

Return ONLY pure JSON (no markdown, no function calls):
{
  "goals": [
    {"id": "goal-${Date.now()}-1", "title": "Specific goal based on their context", "category": "${category.id}", "timeline": "realistic timeframe", "priority": 4}
  ]
}`;
      
      const result = await geminiService.processMessage(prompt, [], [], [], false, false);
      // Clean markdown formatting before parsing JSON
      const cleanResponse = result.response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const categoryGoals = JSON.parse(cleanResponse);
      goals.push(...categoryGoals.goals);
    }
    
    return goals;
  };

  // Step 4: Create routines for each category
  const createRoutinesForCategories = async (categories: any[], analysis: any) => {
    const routines = [];
    
    for (const category of categories) {
      const prompt = `IMPORTANT: You must respond with ONLY pure JSON. Do not use function calls. Do not use markdown formatting.

Create 1-2 daily/weekly routines for "${category.name}" category.
User context: ${JSON.stringify(analysis.specificDetails)}

ROUTINE CREATION RULES:
1. Always include specific time in HH:MM format (e.g., "08:00", "14:30", "20:00")
2. Always include duration in minutes (15-120 minutes typical)
3. Make routines SPECIFIC and actionable
4. Choose realistic times based on category (morning for fitness, evening for reflection, etc.)
5. Set reasonable durations for the activity type

Return ONLY pure JSON (no markdown, no function calls):
{
  "routines": [
    {"id": "routine-${Date.now()}-1", "title": "Specific routine name", "frequency": "daily", "time": "08:00", "duration": 30, "category": "${category.id}"}
  ]
}`;
      
      const result = await geminiService.processMessage(prompt, [], [], [], false, false);
      // Clean markdown formatting before parsing JSON
      const cleanResponse = result.response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const categoryRoutines = JSON.parse(cleanResponse);
      routines.push(...categoryRoutines.routines);
    }
    
    return routines;
  };

  // Step 5: Create todos and immediate actions
  const createTodosForCategories = async (categories: any[], analysis: any) => {
    const todos = [];
    const contextQuality = analysis.contextQuality || 'minimal';
    
    for (const category of categories) {
      const prompt = `IMPORTANT: You must respond with ONLY pure JSON. Do not use function calls. Do not use markdown formatting.

Create 2-3 immediate, actionable todos for "${category.name}" category based on ${contextQuality} context.

Available Context:
- User Details: ${JSON.stringify(analysis.specificDetails)}
- Category Purpose: ${category.purpose}
- Tools Used: ${analysis.specificDetails.toolsUsed?.join(', ') || 'none specified'}
- Current Projects: ${analysis.specificDetails.currentProjects?.join(', ') || 'none specified'}
- Skill Areas: ${analysis.specificDetails.skillAreas?.join(', ') || 'none specified'}

TODO CREATION RULES:
1. Create immediate actions that can be done THIS WEEK
2. If specific tools mentioned: Create todos around organizing/optimizing those tools
3. If projects mentioned: Create next steps for those specific projects
4. If minimal context: Create foundational/setup todos for the category
5. Make them specific and actionable (not vague like "improve X")
6. Focus on quick wins that build momentum

PRIORITY SYSTEM (use logical values):
- priority: 5 = Critical/Urgent tasks that must be done immediately
- priority: 4 = High importance tasks that are key to progress
- priority: 3 = Medium importance tasks that support goals
- priority: 2 = Low importance tasks that are nice to complete
- priority: 1 = Optional tasks for when time permits

Examples of GOOD todos for file-only context:
- "Set up project tracking board in Notion"
- "Review and organize current client files"
- "Schedule 30-min planning session for [specific project]"
- "Research top 3 tools for [mentioned workflow]"

Return ONLY pure JSON (no markdown, no function calls):
{
  "todos": [
    {"id": "todo-${Date.now()}-1", "title": "Specific actionable task", "category": "${category.id}", "priority": 3}
  ]
}`;
      
      const result = await geminiService.processMessage(prompt, [], [], [], false, false);
      // Clean markdown formatting before parsing JSON
      const cleanResponse = result.response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const categoryTodos = JSON.parse(cleanResponse);
      todos.push(...categoryTodos.todos);
    }
    
    return todos;
  };

  // Step 6: Create reference notes for each category
  const createNotesForCategories = async (categories: any[], analysis: any) => {
    const notes = [];
    const contextQuality = analysis.contextQuality || 'minimal';
    
    for (const category of categories) {
      const prompt = `IMPORTANT: You must respond with ONLY pure JSON. Do not use function calls. Do not use markdown formatting.

Create 1-2 useful reference notes for "${category.name}" category based on ${contextQuality} context.

Available Context:
- User Details: ${JSON.stringify(analysis.specificDetails)}
- Category Purpose: ${category.purpose}
- Tools Used: ${analysis.specificDetails.toolsUsed?.join(', ') || 'none specified'}
- Current Projects: ${analysis.specificDetails.currentProjects?.join(', ') || 'none specified'}

NOTES CREATION RULES:
1. Create knowledge/reference notes that will be useful long-term
2. If specific tools mentioned: Create notes about optimizing those tools
3. If projects mentioned: Create planning/strategy notes for those projects
4. Include actionable insights, templates, or best practices
5. Make content substantial enough to be valuable reference material

Examples of GOOD notes for file-only context:
- "Project Management Best Practices" with specific workflow tips
- "Weekly Review Template" for the user's specific situation
- "Key Resources for [Their Skill Area]" with relevant links/strategies

Return ONLY pure JSON (no markdown, no function calls):
{
  "notes": [
    {"id": "note-${Date.now()}-1", "title": "Useful reference title", "category": "${category.id}", "content": "Detailed content that provides real value"}
  ]
}`;
      
      const result = await geminiService.processMessage(prompt, [], [], [], false, false);
      // Clean markdown formatting before parsing JSON
      const cleanResponse = result.response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const categoryNotes = JSON.parse(cleanResponse);
      notes.push(...categoryNotes.notes);
    }
    
    return notes;
  };

  // Step 7: Create calendar events for each category
  const createEventsForCategories = async (categories: any[], analysis: any) => {
    const events = [];
    const contextQuality = analysis.contextQuality || 'minimal';
    const connectedIntegrations = getUserData(user?.id || '', 'lifely_onboarding_integrations', []);
    const hasCalendarIntegration = connectedIntegrations.some((int: string) => int.includes('calendar'));
    
    for (const category of categories) {
      const prompt = `IMPORTANT: You must respond with ONLY pure JSON. Do not use function calls. Do not use markdown formatting.

Create 1-2 relevant calendar events/milestones for "${category.name}" category based on ${contextQuality} context.

Available Context:
- User Details: ${JSON.stringify(analysis.specificDetails)}
- Category Purpose: ${category.purpose}
- Has Calendar Integration: ${hasCalendarIntegration}
- Connected Integrations: ${connectedIntegrations.join(', ') || 'none'}

EVENTS CREATION RULES:
1. Create realistic events that make sense for the category
2. If calendar integration connected: Create recurring review/planning sessions
3. If projects mentioned: Create milestone/deadline events
4. Set dates 1-7 days in the future for immediate relevance
5. Focus on planning, review, or key milestone events

Examples of GOOD events for file-only context:
- "Weekly [Category] Planning Session" (recurring)
- "[Specific Project] Milestone Review"
- "Monthly [Skill Area] Progress Check"

Return ONLY pure JSON (no markdown, no function calls):
{
  "events": [
    {"id": "event-${Date.now()}-1", "title": "Specific event title", "category": "${category.id}", "date": "${new Date(Date.now() + Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000).toISOString()}"}
  ]
}`;
      
      const result = await geminiService.processMessage(prompt, [], [], [], false, false);
      // Clean markdown formatting before parsing JSON
      const cleanResponse = result.response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const categoryEvents = JSON.parse(cleanResponse);
      events.push(...categoryEvents.events);
    }
    
    return events;
  };

  // Main orchestration function using Gemini Agent Mode
  const createCategories = async (fullContext: string) => {
    try {
      if (!user?.id) {
        throw new Error('No authenticated user found for dashboard creation');
      }
      
      console.log('🤖 Using Gemini Agent Mode for comprehensive dashboard creation...');
      
      // Initialize function calls tracking to show user what's happening
      const setupFunctionCalls = [
        {
          id: 'analyze-context',
          name: 'analyzeUserContext',
          description: 'Analyzing your conversation responses and uploaded files',
          status: 'executing' as const,
          code: `analyzeUserContext({\n  conversationData: user.responses,\n  uploadedFiles: user.documents,\n  primaryWeight: 0.9,\n  secondaryWeight: 0.1\n})`
        },
        {
          id: 'create-categories',
          name: 'createPersonalizedCategories',
          description: 'Creating life categories based on your specific interests',
          status: 'pending' as const,
          code: `createPersonalizedCategories({\n  userInterests: context.interests,\n  currentProjects: context.projects,\n  goals: context.goals,\n  workStyle: context.workStyle\n})`
        },
        {
          id: 'generate-goals',
          name: 'generateActionableGoals',
          description: 'Setting up goals tailored to your timeline and priorities',
          status: 'pending' as const,
          code: `generateActionableGoals({\n  categories: createdCategories,\n  userTimeline: context.timeline,\n  specificProjects: context.projects\n})`
        },
        {
          id: 'create-routines',
          name: 'createDailyRoutines',
          description: 'Building daily and weekly routines that fit your schedule',
          status: 'pending' as const,
          code: `createDailyRoutines({\n  categories: createdCategories,\n  preferredTimes: context.schedule,\n  workingHours: context.workingHours\n})`
        },
        {
          id: 'generate-todos',
          name: 'generateImmediateTodos',
          description: 'Creating immediate action items for this week',
          status: 'pending' as const,
          code: `generateImmediateTodos({\n  categories: createdCategories,\n  currentProjects: context.projects,\n  quickWins: context.quickWins\n})`
        },
        {
          id: 'setup-resources',
          name: 'setupResourcesAndNotes',
          description: 'Adding helpful resources and reference materials',
          status: 'pending' as const,
          code: `setupResourcesAndNotes({\n  categories: createdCategories,\n  userTools: context.tools,\n  bestPractices: context.bestPractices\n})`
        }
      ];
      
      // Set initial function calls
      setFunctionCalls(setupFunctionCalls);
      setSelectedFunction(setupFunctionCalls[0]);
      
      // Simulate function execution progression
      let currentFunctionIndex = 0;
      
      const progressFunction = async (index: number) => {
        if (index >= setupFunctionCalls.length) return;
        
        // Update current function to executing
        setFunctionCalls(prev => 
          prev.map((func, i) => 
            i === index ? { ...func, status: 'executing' } : func
          )
        );
        
        // Wait a bit to show execution
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
        
        // Mark as completed and move to next
        setFunctionCalls(prev => 
          prev.map((func, i) => 
            i === index ? { ...func, status: 'completed', result: i === 0 ? 'Context analyzed' : `${func.name} completed` } : 
            i === index + 1 ? { ...func, status: 'executing' } : func
          )
        );
        
        // Auto-select next function
        if (index + 1 < setupFunctionCalls.length) {
          setSelectedFunction(setupFunctionCalls[index + 1]);
        }
        
        // Continue to next function
        setTimeout(() => progressFunction(index + 1), 500);
      };
      
      // Start the progression
      progressFunction(0);
      
      // Update the prompt for function calling instead of JSON return
      const functionCallingPrompt = `You are a life management AI agent creating a comprehensive, personalized dashboard. You MUST use the available functions to actually create categories and items, not just return JSON.

USER CONTEXT:
${fullContext}

INSTRUCTIONS:
1. First analyze the context to understand the user's specific needs, projects, and interests
2. Create 4-6 specific categories using createCategory function calls
3. For each category, create 2-3 goals using createItem function calls  
4. For each category, create 1-2 routines using createItem function calls
5. Create useful todos and notes using createItem function calls

CRITICAL REQUIREMENTS:
- Use ACTUAL FUNCTION CALLS - call createCategory and createItem functions multiple times
- Create categories first, then items for each category
- Use specific names based on user context, not generic terms
- For goals: Use bow and arrow emoji 🎯 
- For routines: Include specific time (HH:MM) and duration in minutes
- Make everything highly personalized to their mentioned interests/projects

START BY CREATING CATEGORIES, then create items for each category.`;

      // Use proper function calling instead of agent mode
      const result = await geminiService.processMessage(
        functionCallingPrompt, 
        [], // No existing items for onboarding
        [], // No conversation history 
        [], // No existing categories
        false, // Use function calling, not agent mode
        false // Not ask mode
      );
      
      console.log('🤖 Function calling response:', result.response);
      console.log('🔧 Function results:', result.functionResults);
      
      // The function calls will have created the actual items, so we need to get them from localStorage
      const createdCategories = getUserData(user.id, 'lifeStructureCategories', []);
      const createdItems = getUserData(user.id, 'lifeStructureItems', []);
      
      // Organize the created items by type
      const agentResult = {
        categories: createdCategories,
        goals: createdItems.filter((item: any) => item.type === 'goal'),
        routines: createdItems.filter((item: any) => item.type === 'routine'),
        todos: createdItems.filter((item: any) => item.type === 'todo'),
        notes: createdItems.filter((item: any) => item.type === 'note'),
        events: createdItems.filter((item: any) => item.type === 'event'),
        workStyle: "Focused and goal-oriented",
        personalInsights: [
          "You have a balanced approach to life management",
          "Your priorities align with long-term growth",
          "You value both productivity and personal development"
        ]
      };
      
      console.log('✅ Function calling created comprehensive dashboard:', {
        categories: agentResult.categories?.length || 0,
        goals: agentResult.goals?.length || 0,
        routines: agentResult.routines?.length || 0,
        todos: agentResult.todos?.length || 0,
        notes: agentResult.notes?.length || 0,
        events: agentResult.events?.length || 0
      });
      
      return agentResult;
      
    } catch (error) {
      console.error('❌ Gemini Agent dashboard creation failed:', error);
      
      // Intelligent fallback system for all onboarding scenarios
      console.log('🤖 Creating intelligent fallback dashboard based on available context...');
      
      // Analyze context for keywords and themes
      const contextLower = fullContext.toLowerCase();
      const hasBusinessContext = contextLower.includes('business') || contextLower.includes('company') || contextLower.includes('startup') || contextLower.includes('revenue') || contextLower.includes('entrepreneur');
      const hasDevContext = contextLower.includes('code') || contextLower.includes('dev') || contextLower.includes('programming') || contextLower.includes('app') || contextLower.includes('software');
      const hasContentContext = contextLower.includes('content') || contextLower.includes('youtube') || contextLower.includes('writing') || contextLower.includes('blog') || contextLower.includes('creator');
      const hasDesignContext = contextLower.includes('design') || contextLower.includes('figma') || contextLower.includes('ui') || contextLower.includes('ux') || contextLower.includes('creative');
      const hasStudentContext = contextLower.includes('student') || contextLower.includes('university') || contextLower.includes('college') || contextLower.includes('study') || contextLower.includes('academic');
      const hasFitnessContext = contextLower.includes('fitness') || contextLower.includes('workout') || contextLower.includes('gym') || contextLower.includes('health') || contextLower.includes('exercise');
      const hasFinanceContext = contextLower.includes('finance') || contextLower.includes('investment') || contextLower.includes('money') || contextLower.includes('budget') || contextLower.includes('financial');
      
      // Check for specific tools/platforms mentioned
      const hasNotionContext = contextLower.includes('notion');
      const fallbackConnectedIntegrations = getUserData(user?.id || '', 'lifely_onboarding_integrations', []);
      const hasCalendarContext = fallbackConnectedIntegrations.some((int: string) => int.includes('calendar'));
      const hasProductivityTools = contextLower.includes('productivity') || contextLower.includes('task') || contextLower.includes('organization');
      
      let fallbackCategories = [];
      
      // Create context-aware categories
      if (hasBusinessContext) {
        fallbackCategories.push({ 
          id: 'business-growth', 
          name: hasNotionContext ? 'Business Operations & Planning' : 'Business Development', 
          purpose: 'Scale business activities and achieve growth goals', 
          priority: 9, 
          icon: 'briefcase', 
          color: 'blue' 
        });
      }
      if (hasDevContext) {
        fallbackCategories.push({ 
          id: 'development-projects', 
          name: 'Development & Engineering', 
          purpose: 'Build, code, and ship software projects', 
          priority: 8, 
          icon: 'computer', 
          color: 'green' 
        });
      }
      if (hasContentContext) {
        fallbackCategories.push({ 
          id: 'content-strategy', 
          name: 'Content Creation & Strategy', 
          purpose: 'Create valuable content and grow audience', 
          priority: 7, 
          icon: 'video', 
          color: 'red' 
        });
      }
      if (hasDesignContext) {
        fallbackCategories.push({ 
          id: 'design-creative', 
          name: 'Design & Creative Work', 
          purpose: 'Create beautiful and functional designs', 
          priority: 6, 
          icon: 'palette', 
          color: 'purple' 
        });
      }
      if (hasStudentContext) {
        fallbackCategories.push({ 
          id: 'academic-success', 
          name: 'Academic Excellence', 
          purpose: 'Excel in studies and achieve academic goals', 
          priority: 9, 
          icon: 'graduation-cap', 
          color: 'indigo' 
        });
      }
      if (hasFitnessContext) {
        fallbackCategories.push({ 
          id: 'fitness-health', 
          name: 'Fitness & Health', 
          purpose: 'Maintain physical fitness and overall wellbeing', 
          priority: 8, 
          icon: 'dumbbell', 
          color: 'orange' 
        });
      }
      if (hasFinanceContext) {
        fallbackCategories.push({ 
          id: 'financial-growth', 
          name: 'Financial Management', 
          purpose: 'Manage finances and build wealth', 
          priority: 7, 
          icon: 'dollar-sign', 
          color: 'green' 
        });
      }
      
      // Always include productivity/organization if tools are mentioned or minimal context
      if (hasProductivityTools || hasNotionContext || hasCalendarContext || fallbackCategories.length === 0) {
        fallbackCategories.push({ 
          id: 'productivity-systems', 
          name: hasNotionContext ? 'Notion Workspace & Systems' : 'Productivity & Organization', 
          purpose: 'Optimize workflows and organize life effectively', 
          priority: 6, 
          icon: 'settings', 
          color: 'gray' 
        });
      }
      
      // Always include personal development
      fallbackCategories.push({ 
        id: 'personal-development', 
        name: 'Personal Growth & Development', 
        purpose: 'Continuous learning and self-improvement', 
        priority: 5, 
        icon: 'brain', 
        color: 'pink' 
      });
      
      // If still no specific context, use general productive categories
      if (fallbackCategories.length <= 1) {
        fallbackCategories = [
          { id: 'goal-achievement', name: 'Goal Achievement', purpose: 'Set and accomplish meaningful goals', priority: 9, icon: 'target', color: 'blue' },
          { id: 'skill-building', name: 'Skill Development', purpose: 'Learn new skills and grow professionally', priority: 8, icon: 'book', color: 'green' },
          { id: 'life-organization', name: 'Life Organization', purpose: 'Create structure and systems for daily life', priority: 7, icon: 'calendar', color: 'purple' },
          { id: 'personal-wellness', name: 'Personal Wellness', purpose: 'Maintain physical and mental wellbeing', priority: 6, icon: 'heart', color: 'pink' }
        ];
      }
      
      return {
        categories: fallbackCategories,
        goals: fallbackCategories.slice(0, 3).map((cat, idx) => ({
          id: `goal-fallback-${idx + 1}`,
          title: cat.name === 'Business Operations' ? 'Streamline business processes and grow revenue' :
                 cat.name === 'Development Projects' ? 'Complete current development project' :
                 cat.name === 'Content Creation' ? 'Build consistent content creation workflow' :
                 cat.name === 'Academic Excellence' ? 'Achieve excellent academic performance' :
                 cat.name === 'Productivity & Focus' ? 'Optimize daily productivity systems' :
                 `Establish strong foundation for ${cat.name.toLowerCase()}`,
          category: cat.id,
          timeline: '2-3 months',
          priority: cat.priority > 7 ? 5 : 4
        })),
        routines: fallbackCategories.slice(0, 2).map((cat, idx) => ({
          id: `routine-fallback-${idx + 1}`,
          title: cat.name === 'Business Operations' ? 'Daily business review and planning' :
                 cat.name === 'Development Projects' ? 'Daily coding session' :
                 cat.name === 'Content Creation' ? 'Daily content creation time' :
                 cat.name === 'Academic Excellence' ? 'Daily study and review session' :
                 cat.name === 'Health & Wellness' ? 'Morning wellness routine' :
                 `Daily ${cat.name.toLowerCase()} session`,
          frequency: 'daily',
          time: cat.name.includes('Health') ? 'morning' : 'evening',
          category: cat.id
        })),
        todos: fallbackCategories.slice(0, 4).map((cat, idx) => ({
          id: `todo-fallback-${idx + 1}`,
          title: cat.name === 'Business Operations' ? 'Review and organize current business processes' :
                 cat.name === 'Development Projects' ? 'Set up development environment and plan next sprint' :
                 cat.name === 'Content Creation' ? 'Plan this week\'s content topics and schedule' :
                 cat.name === 'Academic Excellence' ? 'Organize study materials and create study schedule' :
                 cat.name === 'Personal Systems' ? 'Set up task management and organization system' :
                 cat.name === 'Health & Wellness' ? 'Plan weekly fitness and wellness activities' :
                 `Set up basic organization for ${cat.name.toLowerCase()}`,
          category: cat.id,
          priority: cat.priority > 7 ? 4 : 3
        })),
        events: [
          { id: 'event-1', title: 'Study group session', category: 'academics', date: new Date(Date.now() + 86400000).toISOString() },
          { id: 'event-2', title: 'Business development call', category: 'business', date: new Date(Date.now() + 172800000).toISOString() }
        ],
        notes: [
          { id: 'note-1', title: 'Academic success strategies', category: 'academics', content: 'Focus on active recall, spaced repetition, and consistent study habits for better retention.' },
          { id: 'note-2', title: 'Business growth insights', category: 'business', content: 'Key areas: client acquisition, service delivery excellence, and systematic follow-up processes.' }
        ],
        workStyle: "Focused and goal-oriented with a balanced approach to academics and business growth",
        personalInsights: [
          "You demonstrate strong ambition across both academic and professional domains",
          "Your focus on health and fitness shows a holistic approach to success",
          "You value systematic approaches and consistent habits for long-term growth"
        ]
      };
    }
  };

  const getStepIcon = (index: number) => {
    if (index < currentStep) return <CheckCircle className="w-6 h-6 text-green-500" />;
    if (index === currentStep) return <Loader2 className="w-6 h-6 text-lifeos-primary animate-spin" />;
    return <div className="w-6 h-6 bg-gray-300 rounded-full" />;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'categories': return <span className="text-lg">📁</span>;
      case 'goals': return <span className="text-lg">🎯</span>;  // Bow and arrow target as requested
      case 'routines': return <span className="text-lg">⏰</span>;
      case 'todos': return <span className="text-lg">✅</span>;
      case 'events': return <span className="text-lg">📅</span>;
      case 'notes': return <span className="text-lg">📝</span>;
      case 'workStyle': return <span className="text-lg">🧠</span>;
      case 'priorities': return <span className="text-lg">🎯</span>;
      case 'interests': return <span className="text-lg">💡</span>;
      case 'personalInsights': return <span className="text-lg">✨</span>;
      default: return <span className="text-lg">📋</span>;
    }
  };

  // Show loading state while waiting for auth
  if (authLoading || !user) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-lifeos-50 via-lifeos-100 to-lifeos-200 font-sans flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-lifeos-primary to-lifeos-secondary rounded-2xl flex items-center justify-center shadow-xl mx-auto mb-6">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
          <h2 className="text-2xl font-bold text-lifeos-dark mb-2">
            {!user ? 'Checking Authentication...' : 'Initializing Dashboard...'}
          </h2>
          <p className="text-lifeos-gray-400">
            {authLoading && 'Verifying your account'}
            {!authLoading && !user && 'Please sign in to continue'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-lifeos-50 via-lifeos-100 to-lifeos-200 font-sans">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-6">
            <LifelyLogo size={64} />
            <span className="text-3xl font-bold text-lifeos-dark">Lifely</span>
          </div>
          <h1 className="text-4xl font-bold text-lifeos-dark mb-4">Building Your Dashboard</h1>
          <p className="text-lifeos-gray-400 text-lg">Creating a personalized life management system just for you</p>
          {user && (
            <p className="text-lifeos-primary text-sm mt-2">✅ Authenticated as {user.email}</p>
          )}
        </div>

        {/* Progress Steps */}
        <div className="mb-12">
          <div className="flex items-center justify-center space-x-8">
            {steps.map((step, index) => (
              <div key={index} className="flex items-center">
                <div className="flex flex-col items-center">
                  {getStepIcon(index)}
                  <span className={`text-sm mt-2 ${index <= currentStep ? 'text-lifeos-primary' : 'text-gray-400'}`}>
                    {step.title}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <ChevronRight className={`w-6 h-6 mx-4 ${index < currentStep ? 'text-green-500' : 'text-gray-300'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Function Calls - Cursor Style */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Function List */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg">
            <h3 className="text-xl font-semibold text-lifeos-dark mb-6 flex items-center gap-2">
              <Code className="w-6 h-6 text-lifeos-primary" />
              AI Function Execution
            </h3>
            <div className="space-y-3">
              {functionCalls.map((func) => (
                <div
                  key={func.id}
                  onClick={() => setSelectedFunction(func)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 hover:shadow-md ${
                    selectedFunction?.id === func.id
                      ? 'border-lifeos-primary bg-lifeos-primary/5'
                      : 'border-gray-200 hover:border-lifeos-primary/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {func.status === 'executing' && <Loader2 className="w-5 h-5 text-lifeos-primary animate-spin" />}
                      {func.status === 'completed' && <CheckCircle className="w-5 h-5 text-green-500" />}
                      {func.status === 'pending' && <div className="w-5 h-5 bg-gray-300 rounded-full" />}
                      {func.status === 'error' && <div className="w-5 h-5 bg-red-500 rounded-full" />}
                      <div>
                        <p className="font-medium text-lifeos-dark">{func.name}</p>
                        <p className="text-sm text-lifeos-gray-400">{func.description}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Function Details */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg">
            {selectedFunction ? (
              <>
                <h3 className="text-xl font-semibold text-lifeos-dark mb-4">{selectedFunction.name}</h3>
                <p className="text-lifeos-gray-400 mb-6">{selectedFunction.description}</p>
                
                {/* Code Block */}
                <div className="bg-gray-900 rounded-xl p-4 mb-6">
                  <pre className="text-green-400 text-sm font-mono whitespace-pre-wrap">
                    {selectedFunction.code}
                  </pre>
                </div>

                {/* Result */}
                {selectedFunction.result && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <h4 className="font-medium text-green-800 mb-2">Result:</h4>
                    <p className="text-green-700 text-sm">
                      Created {Array.isArray(selectedFunction.result) ? selectedFunction.result.length : 'N/A'} items
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <Code className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-lifeos-gray-400">Click on a function to see its implementation</p>
              </div>
            )}
          </div>
        </div>

        {/* Dashboard Preview */}
        {dashboardData && (
          <div className="mt-12 bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg">
            <h3 className="text-xl font-semibold text-lifeos-dark mb-6">Live Dashboard Preview</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(dashboardData).map(([type, items], index) => (
                <div key={`dashboard-${type}-${index}`} className="bg-gradient-to-br from-lifeos-primary/10 to-lifeos-secondary/10 border border-lifeos-primary/20 rounded-xl p-4 text-center hover:scale-105 transition-transform">
                  <div className="w-10 h-10 bg-gradient-to-r from-lifeos-primary to-lifeos-secondary rounded-lg flex items-center justify-center mx-auto mb-2">
                    {getTypeIcon(type)}
                  </div>
                  <div className="text-2xl font-bold text-lifeos-primary">{Array.isArray(items) ? items.length : 0}</div>
                  <div className="text-sm text-lifeos-gray-400 capitalize">{type}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Success State */}
        {isComplete && (
          <div className="mt-8 text-center animate-in fade-in">
            {creatingDatabase ? (
              <div className="inline-flex items-center gap-2 bg-blue-100 border border-blue-200 px-6 py-3 rounded-full">
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                <span className="text-blue-700 font-semibold">Creating Real Categories & Items...</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 bg-green-100 border border-green-200 px-6 py-3 rounded-full">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-green-700 font-semibold">Dashboard Created Successfully!</span>
              </div>
            )}
            <p className="text-lifeos-gray-400 text-sm mt-2">
              {creatingDatabase ? 'Saving to your account...' : 'Redirecting to your new dashboard...'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}