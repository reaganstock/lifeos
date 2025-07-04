import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Loader2, ChevronRight, BarChart3, Target, Calendar, NotebookPen, CheckSquare, Clock, Code } from 'lucide-react';
import { geminiService } from '../../services/geminiService';
// Using localStorage-first pattern instead of direct Supabase calls
import { useAuthContext } from '../AuthProvider';
import LifelyLogo from '../LifelyLogo';
import { getUserData, setUserData } from '../../utils/userStorage';

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
    { title: 'Analyzing Responses', description: 'Processing your onboarding data' },
    { title: 'Creating Categories', description: 'Building your life organization structure' },
    { title: 'Generating Content', description: 'Creating goals, tasks, and routines' },
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
      if (onboardingType === 'conversation') {
        const convData = getUserData(user.id, 'lifely_onboarding_conversation', null);
        if (convData && typeof convData === 'object' && (convData as any).answers) {
          conversationText = (convData as any).answers.map((answer: any) => 
            `Q: ${answer.question}\\nA: ${answer.answer}`
          ).join('\\n\\n');
        }
      } else if (onboardingType === 'voice_memo') {
        conversationText = 'Voice memo responses about life organization and goals';
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
      
      // Build complete context
      let fullContext = '';
      
      if (initialData && typeof initialData === 'object') {
        const data = initialData as any;
        fullContext += `USER PROFILE:\\n`;
        fullContext += `Role: ${data.role || 'Not specified'}\\n`;
        fullContext += `How they found us: ${data.source || 'Not specified'}\\n`;
        fullContext += `Selected goals: ${data.goals?.join(', ') || 'None'}\\n\\n`;
      }
      
      if (conversationText) {
        fullContext += `DETAILED RESPONSES:\\n${conversationText}\\n\\n`;
      }
      
      if (documentContext) {
        fullContext += `ADDITIONAL CONTEXT:\\n${documentContext}\\n\\n`;
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

      // Debug: Show what context we're working with
      console.log('📋 ONBOARDING CONTEXT ANALYSIS:');
      console.log('- Conversation text length:', conversationText.length);
      console.log('- Document context length:', documentContext.length);
      console.log('- Has initial data:', !!initialData);
      console.log('- Connected integrations:', connectedIntegrations.length);
      console.log('- Full context preview:', fullContext.substring(0, 200) + '...');
      
      if (!fullContext.trim()) {
        console.warn('⚠️ No onboarding context found - user may have skipped all steps');
        // For minimal context users, create a basic context
        fullContext = 'USER PROFILE: New user seeking life organization and productivity improvement. Looking to establish better systems for managing tasks, goals, and daily routines.';
      }

      // Step 1: Analyze responses
      setCurrentStep(0);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 2: Create categories (multi-step process)
      setCurrentStep(1);
      const multiStepFunctions: FunctionCall[] = [
        {
          id: 'analyze-profile',
          name: 'analyzeProfile',
          description: 'Extract key themes and specific details from user profile',
          status: 'executing',
          code: `const analysis = extractPersonalityAndThemes(userProfile);
return { themes, specificDetails, personality };`
        },
        {
          id: 'create-categories',
          name: 'createPersonalizedCategories',
          description: 'Generate categories specific to user\'s actual life areas',
          status: 'pending',
          code: `const categories = createCategoriesFrom(analysis.themes, analysis.specificDetails);
return personalizedCategories;`
        },
        {
          id: 'create-goals',
          name: 'createGoalsForCategories',
          description: 'Generate specific, actionable goals for each category',
          status: 'pending',
          code: `categories.forEach(cat => createSpecificGoals(cat, userContext));
return personalizedGoals;`
        },
        {
          id: 'create-routines',
          name: 'createRoutinesForCategories',
          description: 'Design daily/weekly routines for each life area',
          status: 'pending',
          code: `categories.forEach(cat => createRoutines(cat, userPreferences));
return personalizedRoutines;`
        },
        {
          id: 'create-todos',
          name: 'createTodosForCategories',
          description: 'Generate immediate action items for each category',
          status: 'pending',
          code: `categories.forEach(cat => createActionItems(cat, userContext));
return actionableItems;`
        }
      ];

      setFunctionCalls(multiStepFunctions);

      // Execute multi-step Gemini calls
      const categoriesResult = await createCategories(fullContext);
      
      // Update all functions as completed
      setFunctionCalls(prev => prev.map(fc => ({ ...fc, status: 'completed' })));

      // Step 3: Generate content
      setCurrentStep(2);
      const contentFunctions: FunctionCall[] = [
        {
          id: `create-goals-step-${Date.now()}`,
          name: 'createGoals',
          description: 'Generate specific, actionable goals for each category',
          status: 'executing',
          code: `categories.forEach(category => {
  const goals = extractGoalsFromContext(userContext, category)
    .map(goal => ({
      id: generateId(),
      title: goal.title,
      category: category.id,
      timeline: determineTimeline(goal.scope),
      priority: calculatePriority(goal.importance)
    }));
  
  return goals;
});`
        },
        {
          id: `create-routines-step-${Date.now()}-2`,
          name: 'createRoutines',
          description: 'Build daily and weekly routines that support user goals',
          status: 'pending',
          code: `const routines = userPreferences.schedule
  .map(timeblock => createRoutine({
    time: timeblock.preferred,
    frequency: determineBestFrequency(timeblock),
    category: matchToCategory(timeblock.activity)
  }))
  .filter(routine => routine.feasible);`
        },
        {
          id: `create-todos-step-${Date.now()}-3`,
          name: 'createTodos',
          description: 'Generate immediate action items to get started',
          status: 'pending',
          code: `const todos = goals.flatMap(goal => 
  breakDownIntoSteps(goal)
    .slice(0, 2) // First 2 steps only
    .map(step => ({
      id: generateId(),
      title: step.action,
      category: goal.category,
      priority: goal.priority
    }))
);`
        }
      ];

      setFunctionCalls(prev => [...prev, ...contentFunctions]);

      // Execute content creation functions
      for (let i = 0; i < contentFunctions.length; i++) {
        const currentFunction = contentFunctions[i];
        setFunctionCalls(prev => prev.map(fc => 
          fc.id === currentFunction.id ? { ...fc, status: 'executing' } : fc
        ));
        
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        setFunctionCalls(prev => prev.map(fc => 
          fc.id === currentFunction.id ? { ...fc, status: 'completed' } : fc
        ));
      }

      // Step 4: Build dashboard
      setCurrentStep(3);
      const dashboardFunctionId = `build-dashboard-${Date.now()}`;
      const dashboardFunction: FunctionCall = {
        id: dashboardFunctionId,
        name: 'buildDashboard',
        description: 'Assemble all components into final dashboard',
        status: 'executing',
        code: `const dashboard = {
  categories: createdCategories,
  goals: createdGoals,
  routines: createdRoutines,
  todos: createdTodos,
  events: generateUpcomingEvents(),
  notes: createWelcomeNotes()
};

localStorage.setItem('lifely_dashboard_data', JSON.stringify(dashboard));
return dashboard;`
      };

      setFunctionCalls(prev => [...prev, dashboardFunction]);
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
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
        fc.id === dashboardFunctionId ? { ...fc, status: 'completed', result: finalData } : fc
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
          
          // Convert AI icon names to actual emojis for consistent display
          const convertIconToEmoji = (iconName: string) => {
            const iconMap: Record<string, string> = {
              'graduation-cap': '🎓',
              'briefcase': '💼',
              'dumbbell': '💪',
              'brain': '🧠',
              'heart': '❤️',
              'user': '👤',
              'book': '📚',
              'home': '🏠',
              'fitness': '💪',
              'target': '🎯',
              'dollar-sign': '💰',
              'calendar': '📅',
              'computer': '💻',
              'music': '🎵'
            };
            return iconMap[iconName] || iconName || '📁';
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
            icon: convertIconToEmoji(category.icon),
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

Make routines SPECIFIC and actionable.

Return ONLY pure JSON (no markdown, no function calls):
{
  "routines": [
    {"id": "routine-1", "title": "Daily Rosary and Mass", "frequency": "daily", "time": "morning", "category": "${category.id}"}
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

  // Main orchestration function
  const createCategories = async (fullContext: string) => {
    try {
      console.log('🎯 Step 1: Analyzing user profile...');
      const analysis = await analyzeProfile(fullContext);
      
      console.log('📂 Step 2: Creating personalized categories...');
      const categoriesResult = await createPersonalizedCategories(analysis);
      
      console.log('🎯 Step 3: Creating specific goals...');
      const goals = await createGoalsForCategories(categoriesResult.categories, analysis);
      
      console.log('🔄 Step 4: Creating personalized routines...');
      const routines = await createRoutinesForCategories(categoriesResult.categories, analysis);
      
      console.log('✅ Step 5: Creating immediate todos...');
      const todos = await createTodosForCategories(categoriesResult.categories, analysis);

      // Create some sample events and notes
      const events = [{
        id: "event-1",
        title: "Weekly business review",
        category: categoriesResult.categories[0]?.id || "business",
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      }];

      const notes = [{
        id: "note-1", 
        title: "Personal growth insights",
        category: categoriesResult.categories[0]?.id || "personal",
        content: "Key strategies for achieving goals"
      }];

      return {
        categories: categoriesResult.categories,
        goals,
        routines,
        todos,
        events,
        notes,
        workStyle: analysis.personality,
        personalInsights: [
          `Strong focus on ${analysis.themes.join(' and ')}`,
          `Demonstrates ${analysis.personality}`,
          `Values systematic approaches to growth`
        ]
      };
    } catch (error) {
      console.error('❌ Multi-step category creation failed:', error);
      
      // Intelligent fallback based on whatever context we do have
      console.log('🤖 Creating intelligent fallback categories based on available context...');
      
      // Try to extract any useful info from the context for fallback
      const contextLower = fullContext.toLowerCase();
      const hasBusinessContext = contextLower.includes('business') || contextLower.includes('company') || contextLower.includes('startup') || contextLower.includes('revenue');
      const hasDevContext = contextLower.includes('code') || contextLower.includes('dev') || contextLower.includes('programming') || contextLower.includes('app');
      const hasContentContext = contextLower.includes('content') || contextLower.includes('youtube') || contextLower.includes('writing') || contextLower.includes('blog');
      const hasDesignContext = contextLower.includes('design') || contextLower.includes('figma') || contextLower.includes('ui') || contextLower.includes('ux');
      const hasStudentContext = contextLower.includes('student') || contextLower.includes('university') || contextLower.includes('college') || contextLower.includes('study');
      
      let fallbackCategories = [];
      
      if (hasBusinessContext) {
        fallbackCategories.push({ id: 'business-ops', name: 'Business Operations', purpose: 'Grow and scale business activities', priority: 9, icon: 'briefcase', color: 'blue' });
      }
      if (hasDevContext) {
        fallbackCategories.push({ id: 'development', name: 'Development Projects', purpose: 'Code, build and ship projects', priority: 8, icon: 'computer', color: 'green' });
      }
      if (hasContentContext) {
        fallbackCategories.push({ id: 'content-creation', name: 'Content Creation', purpose: 'Create and share valuable content', priority: 7, icon: 'video', color: 'red' });
      }
      if (hasDesignContext) {
        fallbackCategories.push({ id: 'design-work', name: 'Design Work', purpose: 'Create beautiful and functional designs', priority: 6, icon: 'palette', color: 'purple' });
      }
      if (hasStudentContext) {
        fallbackCategories.push({ id: 'academics', name: 'Academic Excellence', purpose: 'Excel in studies and coursework', priority: 9, icon: 'graduation-cap', color: 'indigo' });
      }
      
      // Always add these foundational categories
      fallbackCategories.push(
        { id: 'personal-systems', name: 'Personal Systems', purpose: 'Organize life and optimize workflows', priority: 5, icon: 'settings', color: 'gray' },
        { id: 'health-wellness', name: 'Health & Wellness', purpose: 'Maintain physical and mental wellbeing', priority: 4, icon: 'heart', color: 'pink' }
      );
      
      // If we have no specific context, use general but useful categories
      if (fallbackCategories.length <= 2) {
        fallbackCategories = [
          { id: 'productivity', name: 'Productivity & Focus', purpose: 'Optimize workflow and get things done', priority: 9, icon: 'target', color: 'blue' },
          { id: 'skill-development', name: 'Skill Development', purpose: 'Learn and grow professionally', priority: 8, icon: 'book', color: 'green' },
          { id: 'personal-projects', name: 'Personal Projects', purpose: 'Work on meaningful side projects', priority: 7, icon: 'rocket', color: 'purple' },
          { id: 'health-wellness', name: 'Health & Wellness', purpose: 'Maintain physical and mental wellbeing', priority: 6, icon: 'heart', color: 'pink' }
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
      case 'categories': return <BarChart3 className="w-5 h-5" />;
      case 'goals': return <Target className="w-5 h-5" />;
      case 'routines': return <Clock className="w-5 h-5" />;
      case 'todos': return <CheckSquare className="w-5 h-5" />;
      case 'events': return <Calendar className="w-5 h-5" />;
      case 'notes': return <NotebookPen className="w-5 h-5" />;
      default: return <Code className="w-5 h-5" />;
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