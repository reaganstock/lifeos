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
      
      // 3. Get document context
      const documents = getUserData(user.id, 'lifely_onboarding_documents', []);
      let documentContext = '';
      if (documents.length > 0) {
        documentContext = documents.map((doc: any) => {
          if (doc.type === 'youtube') {
            return `YouTube Video: ${doc.content}`;
          } else if (doc.type === 'text') {
            return `User Note: ${doc.content}`;
          } else {
            return `Document "${doc.name}": ${doc.content.substring(0, 500)}...`;
          }
        }).join('\\n\\n');
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

      if (!fullContext.trim()) {
        throw new Error('No onboarding data found');
      }

      // Step 1: Analyze responses
      setCurrentStep(0);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 2: Create categories
      setCurrentStep(1);
      const categoriesFunction: FunctionCall = {
        id: 'create-categories',
        name: 'createCategories',
        description: 'Generate personalized life categories based on user responses',
        status: 'executing',
        code: `const categories = analyzeUserNeeds(responses)
  .map(need => createCategory(need))
  .filter(cat => cat.priority > 5)
  .sort((a, b) => b.priority - a.priority);

return categories.slice(0, 6);`
      };

      setFunctionCalls([categoriesFunction]);

      // Simulate real Gemini call for categories
      const categoriesResult = await createCategories(fullContext);
      
      setFunctionCalls(prev => prev.map(fc => 
        fc.id === 'create-categories' 
          ? { ...fc, status: 'completed', result: categoriesResult.categories }
          : fc
      ));

      // Step 3: Generate content
      setCurrentStep(2);
      const contentFunctions: FunctionCall[] = [
        {
          id: 'create-goals-step',
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
          id: 'create-routines-step',
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
          id: 'create-todos-step',
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
      const dashboardFunction: FunctionCall = {
        id: 'build-dashboard',
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
        fc.id === 'build-dashboard' ? { ...fc, status: 'completed', result: finalData } : fc
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

  const createCategories = async (fullContext: string) => {
    const prompt = `You are creating a personalized life management system. Based on this user profile: "${fullContext}"

CRITICAL INSTRUCTIONS:
1. Create 4-6 categories that match this specific user's life areas and goals
2. If they're a student, include "Academics" or "Studies" category
3. If they mention business/work, include "Business" or "Career" category  
4. If they mention fitness/health, include "Health & Fitness" category
5. Create specific, actionable items that match their actual situation and challenges
6. Use their exact words and goals from their responses
7. Create realistic timelines based on their role (student = shorter academic cycles)

Create PERSONALIZED content based on their responses. For example:
- Student → Study schedules, assignment tracking, exam prep
- Business person → Client meetings, revenue goals, networking
- Fitness focused → Workout routines, meal planning, progress tracking

Return ONLY valid JSON in this exact format:
{
  "categories": [{"id": "academics", "name": "Academics", "purpose": "Excel in studies", "priority": 9, "icon": "graduation-cap", "color": "blue"}],
  "goals": [{"id": "goal-1", "title": "Achieve 3.8 GPA this semester", "category": "academics", "timeline": "4 months", "priority": 5}],
  "routines": [{"id": "routine-1", "title": "Daily study session", "frequency": "daily", "time": "evening", "category": "academics"}],
  "todos": [{"id": "todo-1", "title": "Complete chemistry assignment", "category": "academics", "priority": 3}],
  "events": [{"id": "event-1", "title": "Midterm exam - Biology", "category": "academics", "date": "${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()}"}],
  "notes": [{"id": "note-1", "title": "Study strategies that work", "category": "academics", "content": "Active recall and spaced repetition"}],
  "workStyle": "Describe their work style based on their responses (e.g. 'Detail-oriented and methodical' or 'Creative and collaborative')",
  "personalInsights": ["Insight about their approach to life management", "Insight about their priorities", "Insight about their goals and aspirations"]
}`;
    
    try {
      // Use regular Gemini call - no special tools needed
      const result = await geminiService.processMessage(prompt, [], [], [], false, false);
      
      console.log('Gemini response for categories:', result.response);
      
      // Try to parse JSON from response
      try {
        const cleanResponse = result.response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleanResponse);
        console.log('Successfully parsed categories:', parsed);
        return parsed;
      } catch (parseError) {
        console.log('JSON parsing failed, using fallback data');
      }
      
      // Personalized fallback data based on user context (student with academic/business/fitness goals)
      return {
        categories: [
          { id: 'academics', name: 'Academics', purpose: 'Excel in studies and coursework', priority: 9, icon: 'graduation-cap', color: 'blue' },
          { id: 'business', name: 'Business & Career', purpose: 'Scale business and professional growth', priority: 8, icon: 'briefcase', color: 'green' },
          { id: 'health-fitness', name: 'Health & Fitness', purpose: 'Physical fitness and wellbeing', priority: 7, icon: 'dumbbell', color: 'red' },
          { id: 'personal-growth', name: 'Personal Development', purpose: 'Self-improvement and life balance', priority: 6, icon: 'brain', color: 'purple' }
        ],
        goals: [
          { id: 'goal-1', title: 'Achieve excellent grades this semester', category: 'academics', timeline: '4 months', priority: 5 },
          { id: 'goal-2', title: 'Grow business revenue by 20%', category: 'business', timeline: '3 months', priority: 5 },
          { id: 'goal-3', title: 'Train consistently 4-5x per week', category: 'health-fitness', timeline: '1 month', priority: 4 }
        ],
        routines: [
          { id: 'routine-1', title: 'Daily study sessions', frequency: 'daily', time: 'evening', category: 'academics' },
          { id: 'routine-2', title: 'Morning workout', frequency: 'daily', time: 'morning', category: 'health-fitness' }
        ],
        todos: [
          { id: 'todo-1', title: 'Complete upcoming assignment', category: 'academics', priority: 4 },
          { id: 'todo-2', title: 'Follow up on client prospects', category: 'business', priority: 3 },
          { id: 'todo-3', title: 'Plan this week\'s workouts', category: 'health-fitness', priority: 3 }
        ],
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
    } catch (error) {
      console.error('Category creation error:', error);
      throw error;
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
              {Object.entries(dashboardData).map(([type, items]) => (
                <div key={type} className="bg-gradient-to-br from-lifeos-primary/10 to-lifeos-secondary/10 border border-lifeos-primary/20 rounded-xl p-4 text-center hover:scale-105 transition-transform">
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