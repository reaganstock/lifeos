import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AIAssistant from "../AIAssistant";

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function OnboardingConversation() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [aiPreferences, setAiPreferences] = useState<any>(null);
  const [isReadyToBuild, setIsReadyToBuild] = useState(false);

  useEffect(() => {
    // Load AI preferences from previous step
    const savedPrefs = localStorage.getItem('lifely_ai_preferences');
    if (savedPrefs) {
      const prefs = JSON.parse(savedPrefs);
      setAiPreferences(prefs);
      setIsVoiceMode(prefs.mode === 'voice');
    }
  }, []);

  const handleConversationUpdate = (updatedMessages: Message[]) => {
    setMessages(updatedMessages);
  };

  const handleReadyToBuild = () => {
    setIsReadyToBuild(true);
  };

  const handleProceedToBuild = () => {
    // Save the conversation for the agentic mode
    localStorage.setItem('lifely_onboarding_conversation', JSON.stringify(messages));
    
    // Navigate to agentic mode
    navigate('/onboarding/agentic-mode');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-lifeos-light via-white to-blue-50 flex">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-lifeos-primary/20 to-lifeos-secondary/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-lifeos-secondary/20 to-purple-600/20 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
      </div>

      <div className="w-full max-w-4xl mx-auto p-6 flex flex-col h-screen relative">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-lifeos-primary to-lifeos-secondary rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
            </div>
            <span className="text-2xl font-bold text-lifeos-dark">Lifely</span>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-lifeos-dark mb-2">
            Let's Get to Know{" "}
            <span className="bg-gradient-to-r from-lifeos-primary to-lifeos-secondary bg-clip-text text-transparent">
              You
            </span>
          </h1>
          <p className="text-lg text-lifeos-gray-400">
            {isVoiceMode ? "Have a natural conversation" : "Chat with your AI assistant"} to build your perfect productivity system
          </p>

          {/* AI Configuration Display */}
          {aiPreferences && (
            <div className="mt-4 inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/20">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-lifeos-dark">
                {aiPreferences.provider === 'gemini' ? 'Google Gemini' : 'OpenAI GPT'} • 
                {isVoiceMode ? ` ${aiPreferences.voice} Voice` : ' Text Chat'}
              </span>
            </div>
          )}
        </div>

        {/* Chat Area */}
        <div className="flex-1 bg-white/80 backdrop-blur-sm rounded-3xl border border-white/20 shadow-2xl flex flex-col overflow-hidden">
          {aiPreferences ? (
            <AIAssistant
              isOpen={true}
              onClose={() => {}} // No close in onboarding
              categories={[]}
              items={[]}
              onAddItem={() => {}}
              onRefreshItems={() => {}}
              currentView="onboarding"
              inlineMode={true}
              isSidebarMode={false}
              sidebarWidth={undefined}
              isCollapsed={false}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-lifeos-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-lifeos-gray-400">Loading AI preferences...</p>
              </div>
            </div>
          )}
        </div>

        {/* Ready to Build Button */}
        {isReadyToBuild && (
          <div className="mt-6 text-center">
            <div className="bg-gradient-to-r from-lifeos-primary/10 to-lifeos-secondary/10 border border-lifeos-primary/20 rounded-2xl p-6 mb-4">
              <h3 className="text-lg font-bold text-lifeos-dark mb-2">🎉 Ready to Build Your Dashboard!</h3>
              <p className="text-lifeos-gray-400 mb-4">
                Great conversation! I now have everything I need to create your personalized productivity system.
              </p>
              <button
                onClick={handleProceedToBuild}
                className="bg-gradient-to-r from-lifeos-primary to-lifeos-secondary text-white py-4 px-8 rounded-xl font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg"
              >
                Start Building My Dashboard →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}