import { useState, useEffect } from "react";

export default function OnboardingAgenticMode() {
  const [chatMessages, setChatMessages] = useState<{role: 'ai' | 'user', content: string, timestamp: Date}[]>([]);
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [currentAction, setCurrentAction] = useState<string | null>(null);
  const [completedActions, setCompletedActions] = useState<string[]>([]);
  const [dashboardProgress, setDashboardProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const actions = [
    "Analyzing your goals and preferences",
    "Creating personalized calendar templates",
    "Setting up smart routine suggestions",
    "Configuring AI-powered note organization",
    "Building custom integration workflows",
    "Generating your first week's schedule",
    "Setting up goal tracking system",
    "Creating productivity insights dashboard"
  ];

  useEffect(() => {
    // Load the conversation from previous step
    const savedConversation = localStorage.getItem('lifely_onboarding_conversation');
    if (savedConversation) {
      const conversation = JSON.parse(savedConversation);
      console.log('Loaded conversation:', conversation);
      
      // Start the agentic process with the conversation context
      startAgenticConversation(conversation);
    } else {
      // Fallback if no conversation
      startAgenticConversation();
    }
  }, []);

  const startAgenticConversation = async (conversation?: any[]) => {
    if (conversation && conversation.length > 0) {
      // Use the actual conversation from the previous step
      addMessage('ai', "Perfect! I've analyzed our conversation and I understand exactly what you need. Based on everything you told me, I'm now going to build your personalized productivity system.");
      
      await delay(2000);
      
      // Add a summary message based on the conversation
      const userMessages = conversation.filter((msg: any) => msg.role === 'user');
      const summary = `I'll create a system that addresses: ${userMessages.length > 0 ? 'your specific challenges and goals' : 'your productivity needs'}. This will only take a moment!`;
      addMessage('ai', summary);
      
      // Start building immediately since we have the conversation context
      setTimeout(() => {
        startBuildingProcess();
      }, 2000);
    } else {
      // Fallback for missing conversation
      addMessage('ai', "Hi! I'm your AI assistant and I'm going to build your perfect productivity dashboard based on our previous conversation.");
      
      await delay(2000);
      addMessage('ai', "Let me start building your personalized system right away!");
      
      setTimeout(() => {
        startBuildingProcess();
      }, 3000);
    }
  };

  const startBuildingProcess = async () => {
    for (let i = 0; i < actions.length; i++) {
      setCurrentAction(actions[i]);
      setIsAIThinking(true);
      
      // Simulate AI working
      await delay(2000 + Math.random() * 2000);
      
      setCompletedActions(prev => [...prev, actions[i]]);
      setDashboardProgress(((i + 1) / actions.length) * 100);
      
      // Add contextual messages during the process
      if (i === 2) {
        addMessage('ai', "I'm creating some smart routines based on your goals. I noticed you mentioned productivity - I'm setting up a focus-time routine that adapts to your calendar!");
      } else if (i === 5) {
        addMessage('ai', "Your calendar is looking great! I've blocked out focused work time and added some suggested breaks. How does your energy typically flow throughout the day?");
      }
      
      setIsAIThinking(false);
      await delay(500);
    }
    
    setCurrentAction(null);
    setIsComplete(true);
    
    await delay(1000);
    addMessage('ai', "🎉 Perfect! Your dashboard is ready! I've created a personalized productivity system with smart calendars, adaptive routines, and AI-powered insights. Ready to see what I built for you?");
  };

  const addMessage = (role: 'ai' | 'user', content: string) => {
    setChatMessages(prev => [...prev, { role, content, timestamp: new Date() }]);
  };

  const handleUserMessage = (message: string) => {
    addMessage('user', message);
    
    // Simulate AI response
    setTimeout(() => {
      const responses = [
        "That's really helpful to know! I'm incorporating that into your setup.",
        "Great insight! I'm adjusting your dashboard based on that.",
        "Perfect! That helps me customize your experience even better.",
        "I'm taking note of that and building it into your system."
      ];
      
      addMessage('ai', responses[Math.floor(Math.random() * responses.length)]);
    }, 1000);
  };

  const handleFinish = () => {
    window.location.href = "/dashboard";
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  return (
    <div className="min-h-screen bg-gradient-to-br from-lifeos-light via-white to-blue-50 flex">
      {/* Left Panel - Chat Interface */}
      <div className="w-1/2 p-6 flex flex-col">
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-white/20 shadow-2xl flex-1 flex flex-col">
          {/* Chat Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-lifeos-primary to-lifeos-secondary rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-lifeos-dark">Lifely AI</h2>
                <p className="text-sm text-lifeos-gray-400">Building your dashboard...</p>
              </div>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 p-6 overflow-y-auto space-y-4">
            {chatMessages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${
                    message.role === 'user'
                      ? 'bg-gradient-to-r from-lifeos-primary to-lifeos-secondary text-white'
                      : 'bg-white/80 text-lifeos-dark border border-white/20'
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                </div>
              </div>
            ))}
            
            {isAIThinking && (
              <div className="flex justify-start">
                <div className="bg-white/80 text-lifeos-dark border border-white/20 px-4 py-3 rounded-2xl">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-lifeos-primary rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-lifeos-primary rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                      <div className="w-2 h-2 bg-lifeos-primary rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                    <span className="text-sm text-lifeos-gray-400">AI is thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Chat Input */}
          <div className="p-6 border-t border-gray-200">
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Tell me about your productivity style..."
                className="flex-1 px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-lifeos-primary focus:border-transparent transition-all duration-300 bg-white/50 backdrop-blur-sm"
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                    handleUserMessage(e.currentTarget.value);
                    e.currentTarget.value = '';
                  }
                }}
              />
              <button className="px-6 py-3 bg-gradient-to-r from-lifeos-primary to-lifeos-secondary text-white rounded-xl hover:scale-105 transition-all duration-300">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Progress & Preview */}
      <div className="w-1/2 p-6 flex flex-col">
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-white/20 shadow-2xl flex-1 p-8">
          {/* Progress Header */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-lifeos-dark mb-4">
              Building Your{" "}
              <span className="bg-gradient-to-r from-lifeos-primary to-lifeos-secondary bg-clip-text text-transparent">
                Dashboard
              </span>
            </h2>
            <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
              <div 
                className="bg-gradient-to-r from-lifeos-primary to-lifeos-secondary h-3 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${dashboardProgress}%` }}
              ></div>
            </div>
            <p className="text-lifeos-gray-400">{Math.round(dashboardProgress)}% Complete</p>
          </div>

          {/* Current Action */}
          {currentAction && (
            <div className="bg-gradient-to-r from-lifeos-primary/10 to-lifeos-secondary/10 border border-lifeos-primary/20 rounded-2xl p-6 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 border-2 border-lifeos-primary border-t-transparent rounded-full animate-spin"></div>
                <div>
                  <h3 className="font-semibold text-lifeos-primary">Currently Working On</h3>
                  <p className="text-lifeos-dark">{currentAction}</p>
                </div>
              </div>
            </div>
          )}

          {/* Actions List */}
          <div className="space-y-3">
            {actions.map((action, index) => (
              <div
                key={index}
                className={`flex items-center gap-4 p-4 rounded-xl transition-all duration-300 ${
                  completedActions.includes(action)
                    ? 'bg-green-50 border border-green-200'
                    : currentAction === action
                    ? 'bg-lifeos-primary/10 border border-lifeos-primary/20'
                    : 'bg-white/50 border border-white/20'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  completedActions.includes(action)
                    ? 'bg-green-500'
                    : currentAction === action
                    ? 'bg-lifeos-primary'
                    : 'bg-gray-300'
                }`}>
                  {completedActions.includes(action) ? (
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                  ) : currentAction === action ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <span className="text-white text-sm font-bold">{index + 1}</span>
                  )}
                </div>
                <div className={`flex-1 ${completedActions.includes(action) ? 'text-green-800' : 'text-lifeos-dark'}`}>
                  <p className="font-medium">{action}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Completion */}
          {isComplete && (
            <div className="mt-8 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              
              <h3 className="text-2xl font-bold text-lifeos-dark mb-4">Dashboard Ready! 🎉</h3>
              
              <p className="text-lifeos-gray-400 mb-6">
                Your personalized productivity system is complete with smart scheduling, 
                adaptive routines, and AI-powered insights.
              </p>

              <button
                onClick={handleFinish}
                className="bg-gradient-to-r from-lifeos-primary to-lifeos-secondary text-white py-4 px-8 rounded-xl font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg"
              >
                Enter Your Dashboard →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}