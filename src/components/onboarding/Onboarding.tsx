import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import LifelyLogo from "../LifelyLogo";
import { useAuthContext } from '../AuthProvider';
import { getUserData, setUserData } from '../../utils/userStorage';

export default function Onboarding() {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    role: "",
    source: "",
    goals: [] as string[]
  });

  // Load saved progress on component mount (user-specific)
  useEffect(() => {
    if (!user?.id) return;
    
    const savedProgress = getUserData(user.id, 'lifely_onboarding_step', 0);
    const savedData = getUserData(user.id, 'lifely_onboarding_data', {
      role: "",
      source: "",
      goals: []
    });
    
    setCurrentStep(savedProgress);
    setFormData(savedData);
    
    console.log(`🔄 Loaded onboarding progress for ${user.email}: step ${savedProgress}`);
  }, [user?.id]);

  // Save progress whenever step or data changes (user-specific)
  useEffect(() => {
    if (!user?.id) return;
    
    setUserData(user.id, 'lifely_onboarding_step', currentStep);
    setUserData(user.id, 'lifely_onboarding_data', formData);
    
    // Save current progress URL for App.tsx redirect logic
    const progressUrls = [
      '/onboarding',
      '/onboarding',
      '/onboarding',
      '/onboarding'
    ];
    setUserData(user.id, 'lifely_onboarding_progress', progressUrls[Math.min(currentStep, progressUrls.length - 1)]);
    
    console.log(`💾 Saved onboarding progress for ${user.email}: step ${currentStep}`);
  }, [currentStep, formData, user?.id]);

  const roles = [
    {
      id: "student",
      title: "Student",
      description: "Managing classes, assignments, and personal growth",
      icon: "🎓",
      gradient: "from-blue-500 to-lifeos-primary"
    },
    {
      id: "professional",
      title: "Working Professional",
      description: "Balancing career, projects, and personal life",
      icon: "💼",
      gradient: "from-lifeos-primary to-lifeos-secondary"
    },
    {
      id: "entrepreneur",
      title: "Entrepreneur",
      description: "Building businesses while managing everything else",
      icon: "🚀",
      gradient: "from-lifeos-secondary to-purple-600"
    },
    {
      id: "parent",
      title: "Parent",
      description: "Juggling family responsibilities and personal goals",
      icon: "👨‍👩‍👧‍👦",
      gradient: "from-purple-600 to-pink-600"
    },
    {
      id: "creative",
      title: "Creative Professional",
      description: "Managing projects, clients, and creative inspiration",
      icon: "🎨",
      gradient: "from-pink-600 to-red-500"
    },
    {
      id: "other",
      title: "Something Else",
      description: "I'll tell Lifely more about my unique situation",
      icon: "✨",
      gradient: "from-orange-500 to-yellow-500"
    }
  ];

  const sources = [
    {
      id: "social",
      title: "Social Media",
      description: "Twitter, Instagram, TikTok, or other platforms",
      icon: "📱"
    },
    {
      id: "friend",
      title: "Friend or Colleague",
      description: "Someone recommended Lifely to me",
      icon: "👥"
    },
    {
      id: "search",
      title: "Search Engine",
      description: "Found Lifely through Google or other search",
      icon: "🔍"
    },
    {
      id: "productivity",
      title: "Productivity Community",
      description: "Discord, Reddit, or productivity forums",
      icon: "🌐"
    },
    {
      id: "youtube",
      title: "YouTube or Podcast",
      description: "Saw Lifely featured in content I was watching",
      icon: "📺"
    },
    {
      id: "other",
      title: "Other",
      description: "I found Lifely somewhere else",
      icon: "💫"
    }
  ];

  const goalOptions = [
    {
      id: "productivity",
      title: "Boost Productivity",
      description: "Get more done with less effort",
      icon: "⚡",
      color: "text-lifeos-primary"
    },
    {
      id: "organization",
      title: "Stay Organized",
      description: "Keep everything in one place",
      icon: "📋",
      color: "text-lifeos-secondary"
    },
    {
      id: "habits",
      title: "Build Better Habits",
      description: "Create sustainable routines",
      icon: "🔄",
      color: "text-purple-600"
    },
    {
      id: "balance",
      title: "Work-Life Balance",
      description: "Manage time across all areas of life",
      icon: "⚖️",
      color: "text-pink-600"
    },
    {
      id: "goals",
      title: "Achieve Big Goals",
      description: "Break down and accomplish major objectives",
      icon: "🎯",
      color: "text-green-600"
    },
    {
      id: "stress",
      title: "Reduce Stress",
      description: "Feel more in control and less overwhelmed",
      icon: "🧘",
      color: "text-blue-600"
    }
  ];

  const handleRoleSelect = (roleId: string) => {
    setFormData({ ...formData, role: roleId });
    setTimeout(() => setCurrentStep(1), 300);
  };

  const handleSourceSelect = (sourceId: string) => {
    setFormData({ ...formData, source: sourceId });
    setTimeout(() => setCurrentStep(2), 300);
  };

  const handleGoalToggle = (goalId: string) => {
    const newGoals = formData.goals.includes(goalId)
      ? formData.goals.filter(g => g !== goalId)
      : [...formData.goals, goalId];
    setFormData({ ...formData, goals: newGoals });
  };

  const handleContinue = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    } else {
      // This shouldn't be reached as step 3 uses direct method selection
      if (user?.id) {
        setUserData(user.id, 'lifely_onboarding_data', formData);
      }
      navigate('/onboarding/chat-mode');
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleOnboardingMethod = (method: 'voice-memo' | 'ai-conversation') => {
    if (!user?.id) return;
    
    setUserData(user.id, 'lifely_onboarding_data', formData);
    setUserData(user.id, 'lifely_onboarding_method', method);
    
    if (method === 'voice-memo') {
      setUserData(user.id, 'lifely_onboarding_progress', '/onboarding/voice-memo');
      navigate('/onboarding/voice-memo');
    } else {
      setUserData(user.id, 'lifely_onboarding_progress', '/onboarding/conversation');
      navigate('/onboarding/conversation');
    }
  };

  const steps = [
    {
      title: "What best describes you?",
      subtitle: "Help us understand your lifestyle so we can personalize your experience",
      progress: 0
    },
    {
      title: "How did you hear about Lifely?",
      subtitle: "We're curious how you discovered us in the wild",
      progress: 33
    },
    {
      title: "What are your main goals?",
      subtitle: "Select all that apply - this helps us set up your dashboard perfectly",
      progress: 66
    },
    {
      title: "Choose your setup method",
      subtitle: "How would you like to set up your personalized dashboard?",
      progress: 100
    }
  ];

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-lifeos-50 via-lifeos-100 to-lifeos-200 font-sans overflow-hidden">
      {/* Enhanced Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-20 h-20 bg-gradient-to-br from-lifeos-primary/20 to-lifeos-secondary/20 rounded-full blur-xl animate-float" style={{animationDelay: '0s'}}></div>
        <div className="absolute top-40 right-20 w-16 h-16 bg-gradient-to-br from-lifeos-secondary/30 to-purple-400/30 rounded-lg blur-lg animate-pulse" style={{animationDelay: '1s', animationDuration: '6s'}}></div>
        <div className="absolute bottom-32 left-1/4 w-12 h-12 bg-gradient-to-br from-lifeos-primary/25 to-blue-400/25 rounded-full blur-md animate-ping" style={{animationDelay: '2s', animationDuration: '8s'}}></div>
        <div className="absolute top-1/3 right-1/3 w-24 h-24 bg-gradient-to-br from-purple-400/20 to-lifeos-secondary/20 rounded-xl blur-lg animate-float-delayed"></div>
        <div className="absolute bottom-20 right-10 w-14 h-14 bg-gradient-to-br from-lifeos-primary/30 to-pink-400/30 rounded-full blur-sm animate-bounce" style={{animationDelay: '4s', animationDuration: '7s'}}></div>
        
        {/* Large Animated Gradient Orbs */}
        <div className="absolute top-1/4 left-1/2 transform -translate-x-1/2 w-96 h-96 bg-gradient-radial from-lifeos-primary/10 via-lifeos-secondary/5 to-transparent rounded-full blur-3xl animate-spin" style={{animationDuration: '20s'}}></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-radial from-lifeos-secondary/15 via-purple-400/8 to-transparent rounded-full blur-2xl animate-pulse" style={{animationDuration: '15s'}}></div>
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-4xl relative">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="w-16 h-16 bg-white/90 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-xl border border-white/20">
              <LifelyLogo size={40} />
            </div>
            <span className="text-3xl font-bold text-lifeos-dark tracking-tight">Lifely</span>
          </div>

          {/* Progress Bar */}
          <div className="w-full max-w-md mx-auto mb-8">
            <div className="flex items-center justify-between text-sm text-lifeos-gray-400 mb-2">
              <span>Step {currentStep + 1} of 4</span>
              <span>{steps[currentStep].progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-lifeos-primary to-lifeos-secondary h-2 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${steps[currentStep].progress}%` }}
              ></div>
            </div>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-lifeos-dark mb-4">
            {steps[currentStep].title}
          </h1>
          <p className="text-xl text-lifeos-gray-400 max-w-2xl mx-auto">
            {steps[currentStep].subtitle}
          </p>
        </div>

        {/* Step Content */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-white/20 p-8 shadow-2xl">
          
          {/* Step 0: Role Selection */}
          {currentStep === 0 && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {roles.map((role) => (
                <div
                  key={role.id}
                  onClick={() => handleRoleSelect(role.id)}
                  className={`p-6 rounded-2xl border cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl group ${
                    formData.role === role.id
                      ? 'border-lifeos-primary bg-gradient-to-br from-lifeos-primary/10 to-lifeos-secondary/10 shadow-lg'
                      : 'border-white/20 hover:border-lifeos-primary/30 bg-white/50'
                  }`}
                >
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 bg-gradient-to-r ${role.gradient} group-hover:scale-110 transition-transform duration-300`}>
                    <span className="text-2xl">{role.icon}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-lifeos-dark mb-2 group-hover:text-lifeos-primary transition-colors duration-300">
                    {role.title}
                  </h3>
                  <p className="text-lifeos-gray-400 text-sm leading-relaxed">
                    {role.description}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Step 1: Source Selection */}
          {currentStep === 1 && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sources.map((source) => (
                <div
                  key={source.id}
                  onClick={() => handleSourceSelect(source.id)}
                  className={`p-6 rounded-2xl border cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl group ${
                    formData.source === source.id
                      ? 'border-lifeos-primary bg-gradient-to-br from-lifeos-primary/10 to-lifeos-secondary/10 shadow-lg'
                      : 'border-white/20 hover:border-lifeos-primary/30 bg-white/50'
                  }`}
                >
                  <div className="w-16 h-16 bg-gradient-to-br from-lifeos-primary to-lifeos-secondary rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                    <span className="text-2xl">{source.icon}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-lifeos-dark mb-2 group-hover:text-lifeos-primary transition-colors duration-300">
                    {source.title}
                  </h3>
                  <p className="text-lifeos-gray-400 text-sm leading-relaxed">
                    {source.description}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Step 2: Goals Selection */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                {goalOptions.map((goal) => (
                  <div
                    key={goal.id}
                    onClick={() => handleGoalToggle(goal.id)}
                    className={`p-6 rounded-2xl border cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl group ${
                      formData.goals.includes(goal.id)
                        ? 'border-lifeos-primary bg-gradient-to-br from-lifeos-primary/10 to-lifeos-secondary/10 shadow-lg'
                        : 'border-white/20 hover:border-lifeos-primary/30 bg-white/50'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300 ${
                        formData.goals.includes(goal.id) 
                          ? 'bg-gradient-to-br from-lifeos-primary to-lifeos-secondary' 
                          : 'bg-gray-100 group-hover:bg-gradient-to-br group-hover:from-lifeos-primary group-hover:to-lifeos-secondary'
                      }`}>
                        <span className={`text-lg ${formData.goals.includes(goal.id) ? 'text-white' : goal.color}`}>
                          {goal.icon}
                        </span>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-lifeos-dark mb-1 group-hover:text-lifeos-primary transition-colors duration-300">
                          {goal.title}
                        </h3>
                        <p className="text-lifeos-gray-400 text-sm">
                          {goal.description}
                        </p>
                      </div>
                      {formData.goals.includes(goal.id) && (
                        <div className="w-6 h-6 bg-gradient-to-br from-lifeos-primary to-lifeos-secondary rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {formData.goals.length > 0 && (
                <div className="text-center pt-8">
                  <button
                    onClick={handleContinue}
                    className="bg-gradient-to-r from-lifeos-primary to-lifeos-secondary text-white py-4 px-8 rounded-xl font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg"
                  >
                    Continue to AI Chat Setup →
                  </button>
                  <p className="text-sm text-lifeos-gray-400 mt-3">
                    Selected {formData.goals.length} goal{formData.goals.length !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Onboarding Method Selection */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="grid gap-6">
                {/* Voice Memo Option */}
                <div
                  onClick={() => handleOnboardingMethod('voice-memo')}
                  className="p-8 rounded-2xl border cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl group border-green-200 hover:border-green-400 bg-gradient-to-br from-green-50 to-emerald-50"
                >
                  <div className="flex items-start gap-6">
                    <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <span className="text-2xl">🎤</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-xl font-semibold text-gray-800">Voice Memo Setup</h3>
                        <span className="bg-green-100 text-green-700 text-xs font-medium px-3 py-1 rounded-full">Recommended</span>
                      </div>
                      <p className="text-gray-600 mb-4 leading-relaxed">
                        Record yourself answering questions about your life and goals.
                      </p>
                    </div>
                  </div>
                </div>

                {/* AI Conversation Option */}
                <div
                  onClick={() => handleOnboardingMethod('ai-conversation')}
                  className="p-8 rounded-2xl border cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl group border-blue-200 hover:border-blue-400 bg-gradient-to-br from-blue-50 to-indigo-50"
                >
                  <div className="flex items-start gap-6">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <span className="text-2xl">🤖</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-xl font-semibold text-gray-800">AI Conversation</h3>
                      </div>
                      <p className="text-gray-600 mb-4 leading-relaxed">
                        Chat with our AI assistant about your workflow and goals.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-center pt-4">
                <p className="text-sm text-gray-500">
                  Both methods create the same personalized dashboard. Choose what feels right for you!
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          {/* Back Button */}
          {currentStep > 0 ? (
            <button
              onClick={handleBack}
              className="flex items-center gap-2 px-6 py-3 bg-white/60 backdrop-blur-sm hover:bg-white/80 text-lifeos-dark rounded-xl font-medium transition-all duration-200 border border-white/20 hover:scale-105"
            >
              ← Back
            </button>
          ) : (
            <div></div>
          )}
          
          {/* Progress Text */}
          {currentStep < 3 && (
            <div className="text-center">
              <p className="text-lifeos-gray-400">
                {currentStep === 0 ? "Click any option to continue" : 
                 currentStep === 1 ? "Almost there! Two more questions..." : 
                 "Last step! Choose your setup method..."}
              </p>
            </div>
          )}
          
          <div></div>
        </div>
        </div>
      </div>
    </div>
  );
}