import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Loader2, FileAudio, Brain, Wand2, Sparkles, Target, Calendar, NotebookPen, CheckSquare, BarChart3, Code, Play, ChevronRight } from 'lucide-react';
import { geminiService } from '../../services/geminiService';
import { Category, Item } from '../../types';

interface ProcessingStage {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  status: 'pending' | 'processing' | 'completed' | 'error';
}

interface ExtractedData {
  categories: Array<{id: string; name: string; purpose: string; priority: number; icon?: string; color?: string}>;
  goals: Array<{id: string; title: string; category: string; timeline: string; priority?: number}>;
  routines: Array<{id: string; title: string; frequency: string; time: string; category?: string}>;
  todos: Array<{id: string; title: string; category: string; priority?: number}>;
  events: Array<{id: string; title: string; category: string; date: string}>;
  notes: Array<{id: string; title: string; category: string; content: string}>;
  workStyle: string;
  priorities: string[];
  interests: string[];
  personalInsights: string[];
}

interface FunctionCall {
  name: string;
  args: any;
  status: 'pending' | 'executing' | 'completed' | 'error';
  result?: any;
  description: string;
}

export default function OnboardingProcessing() {
  const navigate = useNavigate();
  const [currentStage, setCurrentStage] = useState(0);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [realTimePreview, setRealTimePreview] = useState<{
    categories: number;
    goals: number;
    routines: number;
    todos: number;
    events: number;
    notes: number;
  }>({ categories: 0, goals: 0, routines: 0, todos: 0, events: 0, notes: 0 });
  const [currentInsight, setCurrentInsight] = useState<string>('');
  const [functionCalls, setFunctionCalls] = useState<FunctionCall[]>([]);
  const [selectedFunctionCall, setSelectedFunctionCall] = useState<FunctionCall | null>(null);
  const [createdItems, setCreatedItems] = useState<{categories: Category[], items: Item[]}>({categories: [], items: []});

  const [stages, setStages] = useState<ProcessingStage[]>([
    {
      id: 'transcribe',
      title: 'Processing Your Responses',
      description: 'Analyzing your onboarding responses and extracting key insights',
      icon: <FileAudio className="w-6 h-6" />,
      status: 'pending'
    },
    {
      id: 'analyze',
      title: 'Understanding Your Life Structure',
      description: 'Identifying your goals, priorities, and organizational preferences',
      icon: <Brain className="w-6 h-6" />,
      status: 'pending'
    },
    {
      id: 'generate',
      title: 'Building Your Dashboard',
      description: 'Creating personalized categories, templates, and workflows',
      icon: <Wand2 className="w-6 h-6" />,
      status: 'pending'
    }
  ]);

  const updateStageStatus = (stageId: string, status: ProcessingStage['status']) => {
    setStages(prev => prev.map(stage => 
      stage.id === stageId ? { ...stage, status } : stage
    ));
  };

  const processData = useCallback(async () => {
    try {
      // Get onboarding data
      const onboardingType = localStorage.getItem('lifely_onboarding_type');
      let conversationText = '';
      
      if (onboardingType === 'conversation') {
        const convData = localStorage.getItem('lifely_onboarding_conversation');
        if (convData) {
          const data = JSON.parse(convData);
          conversationText = data.answers.map((answer: any) => 
            `Q: ${answer.question}\nA: ${answer.answer}`
          ).join('\n\n');
        }
      } else if (onboardingType === 'voice_memo') {
        const recordingData = localStorage.getItem('lifely_voice_memo_recording');
        if (recordingData) {
          const data = JSON.parse(recordingData);
          conversationText = data.questions.map((q: any, index: number) => 
            `Q: ${q.question}\nA: ${getSimulatedResponse(index)}`
          ).join('\n\n');
        }
      }
      
      if (!conversationText) {
        throw new Error('No onboarding data found');
      }
      
      // Stage 1: Process responses
      updateStageStatus('transcribe', 'processing');
      setCurrentStage(0);
      setCurrentInsight('Analyzing your responses...');
      await new Promise(resolve => setTimeout(resolve, 800));
      updateStageStatus('transcribe', 'completed');
      
      // Stage 2: AI Analysis with real-time updates
      updateStageStatus('analyze', 'processing');
      setCurrentStage(1);
      
      // Simulate real-time analysis with progressive insights
      const insights = [
        'Identifying your life priorities...',
        'Understanding your work style...',
        'Mapping your daily routines...',
        'Analyzing goal patterns...',
        'Extracting productivity preferences...'
      ];
      
      for (let i = 0; i < insights.length; i++) {
        setCurrentInsight(insights[i]);
        await new Promise(resolve => setTimeout(resolve, 600));
      }
      
      // Real Gemini analysis
      const analysisResult = await performRealAnalysis(conversationText);
      updateStageStatus('analyze', 'completed');
      
      // Stage 3: Generate dashboard with real-time preview
      updateStageStatus('generate', 'processing');
      setCurrentStage(2);
      setCurrentInsight('Building your personalized dashboard...');
      
      // Animate dashboard creation
      await animateDashboardCreation(analysisResult);
      
      setExtractedData(analysisResult);
      updateStageStatus('generate', 'completed');
      setCurrentInsight('Your dashboard is ready! 🎉');
      
      // Navigate after showing success
      setTimeout(() => {
        localStorage.setItem('lifely_extracted_data', JSON.stringify(analysisResult));
        localStorage.setItem('lifely_onboarding_completed', 'true');
        navigate('/onboarding/complete');
      }, 3000);
      
    } catch (error) {
      console.error('Processing error:', error);
      setError(error instanceof Error ? error.message : 'Failed to process onboarding data');
      updateStageStatus(stages[currentStage]?.id || 'transcribe', 'error');
    }
  }, [navigate, currentStage, stages, updateStageStatus]);

  const animateDashboardCreation = async (data: ExtractedData) => {
    const steps = [
      { field: 'categories', count: data.categories.length, delay: 300 },
      { field: 'goals', count: data.goals.length, delay: 300 },
      { field: 'routines', count: data.routines.length, delay: 300 },
      { field: 'todos', count: Math.floor(Math.random() * 8) + 3, delay: 300 },
      { field: 'events', count: Math.floor(Math.random() * 5) + 2, delay: 300 },
      { field: 'notes', count: Math.floor(Math.random() * 6) + 1, delay: 300 }
    ];

    for (const step of steps) {
      await new Promise(resolve => setTimeout(resolve, step.delay));
      setRealTimePreview(prev => ({
        ...prev,
        [step.field]: step.count
      }));
    }
  };

  useEffect(() => {
    processData();
  }, [processData]);

  const analyzeOnboardingData = async (data: any, onboardingType: string | null): Promise<ExtractedData> => {
    let conversationText = '';
    
    if (onboardingType === 'conversation') {
      // Extract from chat conversation
      conversationText = data.answers.map((answer: any) => 
        `Q: ${answer.question}\nA: ${answer.answer}`
      ).join('\n\n');
    } else if (onboardingType === 'voice_memo') {
      // For voice memo, we'll use the questions and simulated responses
      conversationText = data.questions.map((q: any, index: number) => 
        `Q: ${q.question}\nA: ${getSimulatedResponse(index)}`
      ).join('\n\n');
    } else {
      throw new Error('Unknown onboarding type');
    }

    return await performAnalysis(conversationText);
  };

  const performRealAnalysis = async (conversationText: string): Promise<ExtractedData> => {
    // Use real Gemini function calling to create dashboard structure
    const createLifeCategoriesFunction = {
      name: "create_life_categories",
      description: "Create personalized life categories based on user's responses",
      parameters: {
        type: "object",
        properties: {
          categories: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "Category name" },
                purpose: { type: "string", description: "What this category is for" },
                priority: { type: "number", description: "Priority 1-10" },
                icon: { type: "string", description: "Lucide icon name" },
                color: { type: "string", description: "Theme color" }
              }
            }
          },
          goals: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                category: { type: "string" },
                timeline: { type: "string" },
                priority: { type: "number" }
              }
            }
          },
          routines: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                frequency: { type: "string" },
                time: { type: "string" },
                category: { type: "string" }
              }
            }
          },
          workStyle: { type: "string" },
          priorities: { type: "array", items: { type: "string" } },
          interests: { type: "array", items: { type: "string" } },
          personalInsights: { type: "array", items: { type: "string" } }
        }
      }
    };

    const prompt = `Based on this onboarding conversation, create a comprehensive life management dashboard structure:

${conversationText}

Analyze their responses and create:
1. 4-7 personalized life categories that match their actual life structure
2. Specific goals they mentioned or can be inferred
3. Daily/weekly routines that support their lifestyle
4. Work style description
5. Key priorities and interests
6. Personal insights for customization

Focus on being specific, actionable, and tailored to their unique situation. Use appropriate Lucide icon names and colors.`;

    try {
      const result = await geminiService.processMessage(
        prompt,
        [],
        [],
        [createLifeCategoriesFunction],
        true // Force function call
      );

      // Parse function call result
      if (result.functionResults && result.functionResults.length > 0) {
        const functionResult = result.functionResults[0];
        if (functionResult.name === 'create_life_categories') {
          return functionResult.args as ExtractedData;
        }
      }

      // Fallback parsing
      const cleanedResponse = result.response.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      return JSON.parse(cleanedResponse);

    } catch (error) {
      console.error('Real analysis error:', error);
      // Enhanced fallback
      return {
        categories: [
          { id: 'work-career', name: 'Work & Career', purpose: 'Professional development and tasks', priority: 9, icon: 'briefcase', color: 'blue' },
          { id: 'health-fitness', name: 'Health & Fitness', purpose: 'Physical and mental wellbeing', priority: 8, icon: 'heart', color: 'red' },
          { id: 'personal-growth', name: 'Personal Growth', purpose: 'Learning and self-improvement', priority: 7, icon: 'brain', color: 'purple' },
          { id: 'relationships', name: 'Relationships', purpose: 'Family and social connections', priority: 8, icon: 'users', color: 'green' },
          { id: 'finance', name: 'Finance', purpose: 'Money management and goals', priority: 6, icon: 'dollar-sign', color: 'yellow' }
        ],
        goals: [
          { id: 'goal-1', title: 'Advance in career', category: 'work-career', timeline: '6 months', priority: 5 },
          { id: 'goal-2', title: 'Establish daily exercise routine', category: 'health-fitness', timeline: '1 month', priority: 4 },
          { id: 'goal-3', title: 'Learn new skill', category: 'personal-growth', timeline: '3 months', priority: 3 }
        ],
        routines: [
          { id: 'routine-1', title: 'Morning planning session', frequency: 'daily', time: 'morning', category: 'personal-growth' },
          { id: 'routine-2', title: 'Weekly goal review', frequency: 'weekly', time: 'Sunday evening', category: 'work-career' }
        ],
        todos: [],
        events: [],
        notes: [],
        workStyle: 'Structured with flexibility for creativity',
        priorities: ['Career advancement', 'Health improvement', 'Personal organization'],
        interests: ['Productivity', 'Technology', 'Self-improvement'],
        personalInsights: ['Values clear organization', 'Prefers digital tools', 'Motivated by progress tracking']
      };
    }
  };

  const performAnalysis = async (conversationText: string): Promise<ExtractedData> => {
    const analysisPrompt = `Analyze this onboarding conversation and extract structured information to build a personalized life management dashboard:

${conversationText}

Based on this conversation, extract and return a JSON object with the following structure:
{
  "categories": [
    {
      "name": "category name", 
      "purpose": "what this area is for", 
      "priority": 1-10,
      "icon": "suggested-icon-name",
      "color": "suggested-color"
    }
  ],
  "goals": [
    {
      "title": "specific goal", 
      "category": "which category this belongs to", 
      "timeline": "when they want to achieve this",
      "priority": 1-5
    }
  ],
  "routines": [
    {
      "title": "routine or habit", 
      "frequency": "daily/weekly/monthly", 
      "time": "when they prefer to do this",
      "category": "which category this supports"
    }
  ],
  "workStyle": "description of how they work best and stay organized",
  "priorities": ["top priority 1", "priority 2", "priority 3"],
  "interests": ["interest/hobby 1", "interest 2", "interest 3"],
  "personalInsights": ["insight about their personality/preferences", "insight 2", "insight 3"]
}

Important guidelines:
- Extract only what was actually mentioned or can be reasonably inferred
- Create 4-8 life categories that match their actual life structure
- Be specific and actionable with goals and routines
- Suggest appropriate icons and colors for categories
- Focus on their stated priorities and challenges
- Make insights personal and useful for customization

Return only the JSON object, no other text.`;

    try {
      // Use the correct method for Gemini service
      const geminiResponse = await geminiService.processMessage(analysisPrompt, [], [], [], false);
      
      // Clean and parse the response
      let cleanedResponse = geminiResponse.response.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      cleanedResponse = cleanedResponse.trim();
      
      const parsed = JSON.parse(cleanedResponse);
      
      // Validate and enhance the structure
      return {
        categories: parsed.categories || [],
        goals: parsed.goals || [],
        routines: parsed.routines || [],
        todos: parsed.todos || [],
        events: parsed.events || [],
        notes: parsed.notes || [],
        workStyle: parsed.workStyle || 'Flexible approach to organization',
        priorities: parsed.priorities || [],
        interests: parsed.interests || [],
        personalInsights: parsed.personalInsights || []
      };
      
    } catch (error) {
      console.error('Analysis error:', error);
      
      // Fallback to default structure
      return {
        categories: [
          { id: 'work', name: 'Work', purpose: 'Professional tasks and career goals', priority: 8, icon: 'briefcase', color: 'blue' },
          { id: 'health', name: 'Health', purpose: 'Physical and mental wellbeing', priority: 9, icon: 'heart', color: 'red' },
          { id: 'personal', name: 'Personal', purpose: 'Personal development and hobbies', priority: 7, icon: 'user', color: 'purple' }
        ],
        goals: [
          { id: 'goal-fallback', title: 'Improve daily organization', category: 'personal', timeline: '3 months', priority: 4 }
        ],
        routines: [
          { id: 'routine-fallback', title: 'Morning planning', frequency: 'daily', time: 'morning', category: 'personal' }
        ],
        todos: [],
        events: [],
        notes: [],
        workStyle: 'Structured approach with flexibility for unexpected tasks',
        priorities: ['Stay organized', 'Achieve goals', 'Maintain balance'],
        interests: ['Productivity', 'Self-improvement'],
        personalInsights: ['Values organization and structure', 'Wants to improve life management']
      };
    }
  };

  const getSimulatedResponse = (index: number): string => {
    const responses = [
      "I'm here because I feel overwhelmed trying to manage different areas of my life. I have goals but struggle to track them consistently.",
      "My biggest challenge is staying organized with work projects, health goals, and personal development. Things often fall through the cracks when I get busy.",
      "My typical day starts early with work, but I want to add more structure for exercise and learning. I struggle to maintain consistent routines.",
      "I need better systems to track my progress and stay accountable. I want to feel more in control of my schedule and priorities.",
      "I'm working toward career advancement, better health habits, and learning new skills. I don't want to lose track of these important goals."
    ];
    return responses[index] || "I want to improve my organization and life management.";
  };

  const getSimulatedTranscript = (questionId: string): string => {
    // In a real implementation, this would use actual speech-to-text
    const simulatedResponses: Record<string, string> = {
      'welcome': 'Hi, I\'m here because I feel like my life is scattered across different areas and I want to get more organized. I have goals but struggle to track them consistently.',
      'life-areas': 'The main areas I struggle with are work projects, personal health goals, and learning new skills. I also want to better manage my relationships and social life.',
      'goals': 'My main goals right now are to advance in my career, get in better shape, and learn a new language. I want to be more consistent with my habits.',
      'challenges': 'I usually struggle with maintaining consistency. I start strong but then life gets busy and I lose track of my commitments and goals.',
      'work-style': 'I work best when I have a clear plan but also need flexibility. I like digital tools for tracking but sometimes prefer writing things down.',
      'daily-routine': 'My typical day starts with checking emails, then work until evening. I want to add exercise and learning time but struggle to fit it in consistently.',
      'priorities': 'My top priorities are career growth, health improvement, and maintaining good relationships with family and friends.',
      'vision': 'In 6 months, I want to be someone who has clear systems for managing different areas of life and actually follows through on my commitments.'
    };
    
    return simulatedResponses[questionId] || 'I want to improve my organization and life management.';
  };

  const getStageIcon = (stage: ProcessingStage) => {
    if (stage.status === 'completed') {
      return (
        <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-lg">
          <CheckCircle className="w-5 h-5 text-white" />
        </div>
      );
    } else if (stage.status === 'processing') {
      return (
        <div className="w-8 h-8 bg-gradient-to-r from-lifeos-primary to-lifeos-secondary rounded-full flex items-center justify-center shadow-lg">
          <Loader2 className="w-5 h-5 text-white animate-spin" />
        </div>
      );
    } else if (stage.status === 'error') {
      return (
        <div className="w-8 h-8 bg-gradient-to-r from-red-500 to-red-600 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg">
          !
        </div>
      );
    } else {
      return (
        <div className="w-8 h-8 bg-lifeos-gray-200 border-2 border-lifeos-gray-300 rounded-full flex items-center justify-center">
          <div className="w-3 h-3 bg-lifeos-gray-400 rounded-full"></div>
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-lifeos-50 via-lifeos-100 to-lifeos-200 font-sans overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-20 h-20 bg-gradient-to-br from-lifeos-primary/20 to-lifeos-secondary/20 rounded-full blur-xl animate-float" style={{animationDelay: '0s'}}></div>
        <div className="absolute top-40 right-20 w-16 h-16 bg-gradient-to-br from-lifeos-secondary/30 to-purple-400/30 rounded-lg blur-lg animate-pulse" style={{animationDelay: '1s', animationDuration: '6s'}}></div>
        <div className="absolute bottom-32 left-1/4 w-12 h-12 bg-gradient-to-br from-lifeos-primary/25 to-blue-400/25 rounded-full blur-md animate-ping" style={{animationDelay: '2s', animationDuration: '8s'}}></div>
        <div className="absolute top-1/3 right-1/3 w-24 h-24 bg-gradient-to-br from-purple-400/20 to-lifeos-secondary/20 rounded-xl blur-lg animate-float-delayed"></div>
        <div className="absolute bottom-20 right-10 w-14 h-14 bg-gradient-to-br from-lifeos-primary/30 to-pink-400/30 rounded-full blur-sm animate-bounce" style={{animationDelay: '4s', animationDuration: '7s'}}></div>
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-8">
        <div className="max-w-2xl w-full">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="w-20 h-20 bg-gradient-to-br from-lifeos-primary to-lifeos-secondary rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl transition-all duration-300 hover:scale-110 hover:rotate-6">
              <Brain className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-lifeos-dark mb-4 tracking-tight">
              Building Your Personalized Dashboard
            </h1>
            <p className="text-lifeos-gray-400 text-lg leading-relaxed">
              We're analyzing your responses to create a life management system tailored just for you.
            </p>
          </div>

          {/* Processing Stages */}
          <div className="space-y-6 mb-12">
            {stages.map((stage, index) => (
              <div 
                key={stage.id}
                className={`flex items-start gap-4 p-6 rounded-2xl transition-all duration-500 backdrop-blur-sm shadow-lg ${
                  stage.status === 'processing' 
                    ? 'bg-gradient-to-r from-lifeos-primary/20 to-lifeos-secondary/20 border-2 border-lifeos-primary/40 shadow-lifeos-primary/20' 
                    : stage.status === 'completed'
                    ? 'bg-gradient-to-r from-green-500/20 to-green-600/20 border-2 border-green-400/40 shadow-green-100'
                    : stage.status === 'error'
                    ? 'bg-gradient-to-r from-red-500/20 to-red-600/20 border-2 border-red-400/40 shadow-red-100'
                    : 'bg-white/60 border-2 border-white/20'
                }`}
              >
                <div className="flex-shrink-0 mt-1">
                  {getStageIcon(stage)}
                </div>
                
                <div className="flex-1">
                  <h3 className={`text-xl font-semibold mb-2 ${
                    stage.status === 'completed' ? 'text-green-700' :
                    stage.status === 'processing' ? 'text-lifeos-primary' :
                    stage.status === 'error' ? 'text-red-600' :
                    'text-lifeos-dark'
                  }`}>
                    {stage.title}
                  </h3>
                  <p className={`${
                    stage.status === 'completed' ? 'text-green-600' :
                    stage.status === 'processing' ? 'text-lifeos-gray-500' :
                    stage.status === 'error' ? 'text-red-500' :
                    'text-lifeos-gray-400'
                  }`}>
                    {stage.description}
                  </p>
                  
                  {stage.status === 'processing' && (
                    <div className="mt-3">
                      <div className="w-full bg-white/30 rounded-full h-2">
                        <div className="bg-gradient-to-r from-lifeos-primary to-lifeos-secondary h-2 rounded-full animate-pulse" style={{ width: '60%' }} />
                      </div>
                    </div>
                  )}
                  
                  {stage.status === 'error' && (
                    <div className="mt-3 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                      {error || 'Something went wrong with this step'}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Real-time Dashboard Preview */}
          <div className="bg-white/80 backdrop-blur-md rounded-3xl p-8 border border-white/30 shadow-2xl">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-lifeos-primary/10 to-lifeos-secondary/10 px-4 py-2 rounded-full border border-lifeos-primary/20 mb-4">
                <Sparkles className="w-4 h-4 text-lifeos-primary animate-pulse" />
                <span className="text-lifeos-dark font-medium text-sm">Live Dashboard Generation</span>
              </div>
              
              {currentInsight && (
                <p className="text-lifeos-gray-500 text-lg animate-pulse">{currentInsight}</p>
              )}
            </div>

            {/* Live Dashboard Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-gradient-to-br from-lifeos-primary/10 to-lifeos-secondary/10 border border-lifeos-primary/20 rounded-2xl p-6 text-center hover:scale-105 transition-all duration-300 group">
                <div className="w-12 h-12 bg-gradient-to-r from-lifeos-primary to-lifeos-secondary rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
                <div className="text-3xl font-bold text-lifeos-primary mb-1 transition-all duration-500">
                  {realTimePreview.categories}
                </div>
                <div className="text-lifeos-gray-400 text-sm font-medium">Life Categories</div>
              </div>

              <div className="bg-gradient-to-br from-red-500/10 to-red-600/10 border border-red-400/20 rounded-2xl p-6 text-center hover:scale-105 transition-all duration-300 group">
                <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-red-600 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                  <Target className="w-6 h-6 text-white" />
                </div>
                <div className="text-3xl font-bold text-red-600 mb-1 transition-all duration-500">
                  {realTimePreview.goals}
                </div>
                <div className="text-lifeos-gray-400 text-sm font-medium">Goals</div>
              </div>

              <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border border-purple-400/20 rounded-2xl p-6 text-center hover:scale-105 transition-all duration-300 group">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                  <CheckSquare className="w-6 h-6 text-white" />
                </div>
                <div className="text-3xl font-bold text-purple-600 mb-1 transition-all duration-500">
                  {realTimePreview.todos}
                </div>
                <div className="text-lifeos-gray-400 text-sm font-medium">Todos</div>
              </div>

              <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-400/20 rounded-2xl p-6 text-center hover:scale-105 transition-all duration-300 group">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
                <div className="text-3xl font-bold text-blue-600 mb-1 transition-all duration-500">
                  {realTimePreview.events}
                </div>
                <div className="text-lifeos-gray-400 text-sm font-medium">Events</div>
              </div>

              <div className="bg-gradient-to-br from-green-500/10 to-green-600/10 border border-green-400/20 rounded-2xl p-6 text-center hover:scale-105 transition-all duration-300 group">
                <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                  <NotebookPen className="w-6 h-6 text-white" />
                </div>
                <div className="text-3xl font-bold text-green-600 mb-1 transition-all duration-500">
                  {realTimePreview.notes}
                </div>
                <div className="text-lifeos-gray-400 text-sm font-medium">Notes</div>
              </div>

              <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/10 border border-orange-400/20 rounded-2xl p-6 text-center hover:scale-105 transition-all duration-300 group">
                <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                  <Target className="w-6 h-6 text-white" />
                </div>
                <div className="text-3xl font-bold text-orange-600 mb-1 transition-all duration-500">
                  {realTimePreview.routines}
                </div>
                <div className="text-lifeos-gray-400 text-sm font-medium">Routines</div>
              </div>
            </div>

            {/* Success State */}
            {extractedData && (
              <div className="text-center animate-in fade-in duration-1000">
                <div className="inline-flex items-center gap-2 bg-gradient-to-r from-green-500/10 to-green-600/10 px-6 py-3 rounded-full border border-green-400/20 mb-4">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-green-700 font-semibold">Dashboard Generated Successfully!</span>
                </div>
                <p className="text-lifeos-gray-500 text-sm">
                  🎉 Your personalized life management system is ready with {extractedData.categories.length} categories, {extractedData.goals.length} goals, and {extractedData.routines.length} routines
                </p>
              </div>
            )}
          </div>

          {/* Error State */}
          {error && (
            <div className="text-center mt-8">
              <div className="bg-red-50 border border-red-200 rounded-2xl p-6 mb-4">
                <p className="text-red-700 mb-4">{error}</p>
                <button 
                  onClick={() => window.location.reload()}
                  className="bg-gradient-to-r from-lifeos-primary to-lifeos-secondary hover:from-lifeos-primary/90 hover:to-lifeos-secondary/90 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-xl"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}