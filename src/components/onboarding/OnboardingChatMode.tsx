import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function OnboardingChatMode() {
  const navigate = useNavigate();
  const [selectedMode, setSelectedMode] = useState<"text" | "voice" | "">("");
  const [selectedProvider, setSelectedProvider] = useState<"gemini" | "openai" | "">("");
  const [selectedVoice, setSelectedVoice] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "success" | "error">("idle");
  const [isShowingPreview, setIsShowingPreview] = useState(false);

  const chatModes = [
    {
      id: "text",
      title: "Text Chat",
      description: "Chat with AI through text messages - perfect for detailed conversations",
      icon: "💬",
      features: ["Detailed responses", "Easy to reference", "Works anywhere"],
      gradient: "from-lifeos-primary to-lifeos-secondary"
    },
    {
      id: "voice",
      title: "Voice Conversation",
      description: "Speak naturally with AI - ideal for hands-free interaction",
      icon: "🎤",
      features: ["Natural conversation", "Hands-free", "Real-time responses"],
      gradient: "from-lifeos-secondary to-purple-600"
    }
  ];

  const providers = [
    {
      id: "gemini",
      name: "Google Gemini",
      description: selectedMode === "text" ? "Advanced AI with powerful function calling" : "Native audio with natural conversation",
      icon: "/gemini.png",
      textModel: "gemini-2.5-flash-preview-05-20",
      voiceModel: "gemini-2.5-flash-preview-05-20",
      service: selectedMode === "text" ? "geminiService" : "geminiLiveService",
      voices: [
        { id: "Puck", name: "Puck", description: "Playful and energetic" },
        { id: "Charon", name: "Charon", description: "Deep and authoritative" },
        { id: "Kore", name: "Kore", description: "Warm and friendly" },
        { id: "Fenrir", name: "Fenrir", description: "Bold and confident" },
        { id: "Aoede", name: "Aoede", description: "Melodic and expressive" }
      ]
    },
    {
      id: "openai",
      name: "OpenAI GPT",
      description: selectedMode === "text" ? "Reliable AI with excellent reasoning" : "Real-time voice conversation with GPT-4o",
      icon: "/openai.png", 
      textModel: "gpt-4o",
      voiceModel: "gpt-4o-realtime-preview-2024-12-17",
      service: selectedMode === "text" ? "geminiService" : "openaiRealtimeService",
      voices: [
        { id: "alloy", name: "Alloy", description: "Balanced and professional" },
        { id: "echo", name: "Echo", description: "Clear and articulate" },
        { id: "nova", name: "Nova", description: "Bright and enthusiastic" },
        { id: "shimmer", name: "Shimmer", description: "Gentle and soothing" },
        { id: "verse", name: "Verse", description: "Poetic and thoughtful" },
        { id: "ballad", name: "Ballad", description: "Smooth and melodic" }
      ]
    }
  ];

  const handleModeSelect = (mode: "text" | "voice") => {
    setSelectedMode(mode);
  };

  const handleProviderSelect = (provider: "gemini" | "openai") => {
    setSelectedProvider(provider);
    setSelectedVoice(""); // Reset voice selection
  };

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    
    try {
      if (selectedProvider === "gemini") {
        // Test Gemini API connection
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: "Test connection" }] }],
            generationConfig: { maxOutputTokens: 10 }
          })
        });
        
        if (response.ok) {
          setConnectionStatus("success");
          // Store API key for later use
          localStorage.setItem('lifely_gemini_api_key', apiKey);
        } else {
          setConnectionStatus("error");
        }
      } else if (selectedProvider === "openai") {
        // Test OpenAI API connection
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        
        if (response.ok) {
          setConnectionStatus("success");
          // Store API key for later use
          localStorage.setItem('lifely_openai_api_key', apiKey);
        } else {
          setConnectionStatus("error");
        }
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      setConnectionStatus("error");
    }
    
    setIsTestingConnection(false);
  };

  const handleShowPreview = () => {
    setIsShowingPreview(true);
  };

  const handleContinue = () => {
    // Save all preferences to localStorage for later use
    const preferences = {
      mode: selectedMode,
      provider: selectedProvider,
      voice: selectedVoice,
      model: selectedProvider === "gemini" 
        ? (selectedMode === "text" ? "gemini-2.5-flash-preview-05-20" : "gemini-2.5-flash-preview-05-20")
        : (selectedMode === "text" ? "gpt-4o" : "gpt-4o-realtime-preview-2024-12-17"),
      service: selectedProvider === "gemini"
        ? (selectedMode === "text" ? "geminiService" : "geminiLiveService") 
        : (selectedMode === "text" ? "geminiService" : "openaiRealtimeService")
    };
    
    localStorage.setItem('lifely_ai_preferences', JSON.stringify(preferences));
    console.log('Saved AI preferences:', preferences);
    
    // Continue to conversation
    navigate('/onboarding/conversation');
  };

  const canContinue = selectedMode && selectedProvider && apiKey && connectionStatus === "success";

  return (
    <div className="min-h-screen bg-gradient-to-br from-lifeos-light via-white to-blue-50 flex items-center justify-center p-6">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-lifeos-primary/20 to-lifeos-secondary/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-lifeos-secondary/20 to-purple-600/20 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
      </div>

      <div className="w-full max-w-5xl relative">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-lifeos-primary to-lifeos-secondary rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
            </div>
            <span className="text-2xl font-bold text-lifeos-dark">Lifely</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-lifeos-dark mb-4">
            Choose Your{" "}
            <span className="bg-gradient-to-r from-lifeos-primary to-lifeos-secondary bg-clip-text text-transparent">
              AI Interface
            </span>
          </h1>
          <p className="text-xl text-lifeos-gray-400 max-w-2xl mx-auto">
            How would you like to interact with your AI assistant? You can always change this later.
          </p>
        </div>

        {/* Step 1: Chat Mode Selection */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-white/20 p-8 shadow-2xl mb-8">
          <h2 className="text-2xl font-bold text-lifeos-dark mb-6">Step 1: Choose Your Communication Style</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            {chatModes.map((mode) => (
              <div
                key={mode.id}
                onClick={() => handleModeSelect(mode.id as "text" | "voice")}
                className={`p-6 rounded-2xl border cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl group ${
                  selectedMode === mode.id
                    ? 'border-lifeos-primary bg-gradient-to-br from-lifeos-primary/10 to-lifeos-secondary/10 shadow-lg'
                    : 'border-white/20 hover:border-lifeos-primary/30 bg-white/50'
                }`}
              >
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 bg-gradient-to-r ${mode.gradient} group-hover:scale-110 transition-transform duration-300`}>
                  <span className="text-2xl">{mode.icon}</span>
                </div>
                <h3 className="text-lg font-semibold text-lifeos-dark mb-2 group-hover:text-lifeos-primary transition-colors duration-300">
                  {mode.title}
                </h3>
                <p className="text-lifeos-gray-400 text-sm mb-4 leading-relaxed">
                  {mode.description}
                </p>
                <div className="space-y-2">
                  {mode.features.map((feature, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-lifeos-primary rounded-full"></div>
                      <span className="text-xs text-lifeos-gray-400">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Step 2: AI Provider Selection */}
        {selectedMode && (
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-white/20 p-8 shadow-2xl mb-8">
            <h2 className="text-2xl font-bold text-lifeos-dark mb-6">Step 2: Choose Your AI Provider</h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              {providers.map((provider) => (
                <div
                  key={provider.id}
                  onClick={() => handleProviderSelect(provider.id as "gemini" | "openai")}
                  className={`p-6 rounded-2xl border cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl group ${
                    selectedProvider === provider.id
                      ? 'border-lifeos-primary bg-gradient-to-br from-lifeos-primary/10 to-lifeos-secondary/10 shadow-lg'
                      : 'border-white/20 hover:border-lifeos-primary/30 bg-white/50'
                  }`}
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-white rounded-xl p-2 shadow-md">
                      <img src={provider.icon} alt={provider.name} className="w-full h-full object-contain" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-lifeos-dark group-hover:text-lifeos-primary transition-colors duration-300">
                        {provider.name}
                      </h3>
                      <p className="text-lifeos-gray-400 text-sm">
                        {provider.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Voice Selection (if voice mode) */}
        {selectedMode === "voice" && selectedProvider && (
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-white/20 p-8 shadow-2xl mb-8">
            <h2 className="text-2xl font-bold text-lifeos-dark mb-6">Step 3: Choose Your AI Voice</h2>
            
            <div className="grid md:grid-cols-2 gap-4">
              {providers.find(p => p.id === selectedProvider)?.voices.map((voice) => (
                <div
                  key={voice.id}
                  onClick={() => setSelectedVoice(voice.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all duration-300 hover:scale-105 group ${
                    selectedVoice === voice.id
                      ? 'border-lifeos-primary bg-gradient-to-br from-lifeos-primary/10 to-lifeos-secondary/10'
                      : 'border-white/20 hover:border-lifeos-primary/30 bg-white/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-lifeos-primary to-lifeos-secondary rounded-xl flex items-center justify-center">
                      <span className="text-white text-sm font-bold">{voice.name[0]}</span>
                    </div>
                    <div>
                      <h4 className="font-semibold text-lifeos-dark group-hover:text-lifeos-primary transition-colors duration-300">
                        {voice.name}
                      </h4>
                      <p className="text-xs text-lifeos-gray-400">{voice.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: API Key Setup */}
        {selectedProvider && (
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-white/20 p-8 shadow-2xl mb-8">
            <h2 className="text-2xl font-bold text-lifeos-dark mb-6">
              Step {selectedMode === "voice" ? "4" : "3"}: Configure API Access
            </h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-lifeos-dark mb-2">
                  {selectedProvider === "gemini" ? "Google AI Studio API Key" : "OpenAI API Key"}
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-lifeos-primary focus:border-transparent transition-all duration-300 bg-white/50 backdrop-blur-sm"
                  placeholder={`Enter your ${selectedProvider === "gemini" ? "Google AI Studio" : "OpenAI"} API key`}
                />
                <p className="text-xs text-lifeos-gray-400 mt-2">
                  Your API key is stored locally and never shared. Get yours from{" "}
                  <a 
                    href={selectedProvider === "gemini" ? "https://aistudio.google.com/app/apikey" : "https://platform.openai.com/api-keys"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-lifeos-primary hover:underline"
                  >
                    {selectedProvider === "gemini" ? "Google AI Studio" : "OpenAI Platform"}
                  </a>
                </p>
              </div>

              {apiKey && (
                <div className="flex gap-4">
                  <button
                    onClick={handleTestConnection}
                    disabled={isTestingConnection}
                    className="flex-1 bg-gradient-to-r from-lifeos-primary to-lifeos-secondary text-white py-3 px-6 rounded-xl font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isTestingConnection ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Testing Connection...
                      </div>
                    ) : (
                      "Test Connection"
                    )}
                  </button>
                </div>
              )}

              {connectionStatus !== "idle" && (
                <div className={`p-4 rounded-xl border ${
                  connectionStatus === "success" 
                    ? "bg-green-50 border-green-200 text-green-800" 
                    : "bg-red-50 border-red-200 text-red-800"
                }`}>
                  <div className="flex items-center gap-2">
                    {connectionStatus === "success" ? (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                      </svg>
                    )}
                    <span className="font-semibold">
                      {connectionStatus === "success" ? "Connection Successful!" : "Connection Failed"}
                    </span>
                  </div>
                  <p className="text-sm mt-1">
                    {connectionStatus === "success" 
                      ? "Your AI assistant is ready to help you build your personalized dashboard."
                      : "Please check your API key and try again. Make sure it has the necessary permissions."
                    }
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Preview Section */}
        {connectionStatus === "success" && (
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-white/20 p-8 shadow-2xl mb-8">
            <h2 className="text-2xl font-bold text-lifeos-dark mb-6">Preview Your AI Experience</h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              {/* Text Chat Preview */}
              {selectedMode === "text" && (
                <div className="bg-white/50 rounded-2xl p-6 border border-white/20">
                  <h3 className="font-semibold text-lifeos-dark mb-4 flex items-center gap-2">
                    💬 Text Chat Interface
                    <span className="text-xs bg-lifeos-primary/10 text-lifeos-primary px-2 py-1 rounded-full">
                      {selectedProvider === "gemini" ? "Gemini Service" : "GPT Service"}
                    </span>
                  </h3>
                  
                  <div className="space-y-3 text-sm">
                    <div className="bg-gray-100 rounded-lg p-3">
                      <div className="font-medium text-gray-800">You:</div>
                      <div className="text-gray-600">"Add a workout session for tomorrow at 6am"</div>
                    </div>
                    
                    <div className="bg-lifeos-primary/10 rounded-lg p-3">
                      <div className="font-medium text-lifeos-primary">AI Assistant:</div>
                      <div className="text-lifeos-dark">Perfect! I've created a workout session for tomorrow at 6:00 AM. Would you like me to set any specific exercises or duration?</div>
                      <div className="text-xs text-lifeos-primary mt-2 flex items-center gap-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        Function executed: createItem
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 text-xs text-lifeos-gray-400">
                    ✨ Features: Function calling, detailed responses, easy to reference
                  </div>
                </div>
              )}
              
              {/* Voice Chat Preview */}
              {selectedMode === "voice" && (
                <div className="bg-white/50 rounded-2xl p-6 border border-white/20">
                  <h3 className="font-semibold text-lifeos-dark mb-4 flex items-center gap-2">
                    🎤 Voice Conversation
                    <span className="text-xs bg-lifeos-secondary/10 text-lifeos-secondary px-2 py-1 rounded-full">
                      {selectedProvider === "gemini" ? "Gemini Live" : "OpenAI Realtime"}
                    </span>
                  </h3>
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-gray-100 rounded-lg">
                      <div className="w-8 h-8 bg-lifeos-primary rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-800">You speak:</div>
                        <div className="text-gray-600">"Add a workout session for tomorrow at 6am"</div>
                      </div>
                      <div className="flex gap-1">
                        <div className="w-1 h-4 bg-lifeos-primary rounded animate-pulse"></div>
                        <div className="w-1 h-3 bg-lifeos-primary rounded animate-pulse" style={{animationDelay: '0.1s'}}></div>
                        <div className="w-1 h-5 bg-lifeos-primary rounded animate-pulse" style={{animationDelay: '0.2s'}}></div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 p-3 bg-lifeos-secondary/10 rounded-lg">
                      <div className="w-8 h-8 bg-lifeos-secondary rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-lifeos-secondary">AI responds with {selectedVoice} voice:</div>
                        <div className="text-lifeos-dark italic">"Done! I've added your workout for tomorrow at 6 AM. Ready to crush those goals!"</div>
                      </div>
                      <div className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                        Real-time
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 text-xs text-lifeos-gray-400">
                    ✨ Features: Natural conversation, hands-free, instant responses
                  </div>
                </div>
              )}
              
              {/* Capabilities Comparison */}
              <div className="bg-gradient-to-br from-lifeos-primary/10 to-lifeos-secondary/10 rounded-2xl p-6 border border-lifeos-primary/20">
                <h3 className="font-semibold text-lifeos-dark mb-4">
                  🔧 {selectedProvider === "gemini" ? "Gemini" : "OpenAI"} Capabilities
                </h3>
                
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Create calendar events & tasks</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Smart goal tracking & progress</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Note organization & search</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Routine & habit building</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Context-aware suggestions</span>
                  </div>
                  {selectedMode === "voice" && (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span>Real-time voice interaction</span>
                    </div>
                  )}
                </div>
                
                <div className="mt-4 p-3 bg-white/50 rounded-lg">
                  <div className="text-xs text-lifeos-gray-400 mb-1">Selected Configuration:</div>
                  <div className="text-sm font-medium text-lifeos-dark">
                    {selectedProvider === "gemini" ? "Google Gemini" : "OpenAI GPT"} • 
                    {selectedMode === "text" ? " Text Chat" : ` Voice (${selectedVoice})`} • 
                    {selectedProvider === "gemini" 
                      ? (selectedMode === "text" ? " geminiService" : " geminiLiveService")
                      : (selectedMode === "text" ? " geminiService" : " openaiRealtimeService")
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Continue Button */}
        {canContinue && (
          <div className="text-center">
            <button
              onClick={handleContinue}
              className="bg-gradient-to-r from-lifeos-primary to-lifeos-secondary text-white py-4 px-8 rounded-xl font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg"
            >
              Continue to AI Chat Setup →
            </button>
            <p className="text-sm text-lifeos-gray-400 mt-3">
              Ready to start building your personalized dashboard
            </p>
          </div>
        )}
      </div>
    </div>
  );
}