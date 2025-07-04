import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle, ArrowRight, Send, MessageSquare } from 'lucide-react';
import { useAuthContext } from '../AuthProvider';
import { setUserData } from '../../utils/userStorage';

const ONBOARDING_QUESTIONS = [
  {
    id: 1,
    question: "What brought you here? What's going on in your life that made you look for a better way to stay organized?",
    focus: "Understanding your motivation and current pain points"
  },
  {
    id: 2,
    question: "What are the main areas of your life you're juggling right now? (e.g., work/career, school/studies, business, fitness, relationships, personal projects, finances, etc.) Tell me what's most important to you.",
    focus: "Identifying specific life categories and priorities"
  },
  {
    id: 3,
    question: "Walk me through what a typical day looks like for you right now. What does your schedule include, and how do you currently track tasks and goals?",
    focus: "Learning your current routine and organizational system"
  },
  {
    id: 4,
    question: "What specific goals are you working toward in the next 3-6 months? Be detailed - what exactly do you want to achieve in each area of your life?",
    focus: "Capturing concrete goals for personalized planning"
  },
  {
    id: 5,
    question: "What would your ideal productivity system look like? How do you want to track progress, manage deadlines, and stay motivated across all your priorities?",
    focus: "Defining preferred organizational style and workflow"
  }
];

interface Message {
  id: string;
  type: 'assistant' | 'user';
  content: string;
  timestamp: Date;
}

export default function OnboardingConversation() {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);


  // Initialize with welcome message and first question
  useEffect(() => {
    const welcomeMessage: Message = {
      id: 'welcome',
      type: 'assistant',
      content: "Hello! I'm here to help you build a completely personalized life management system. I'll ask you 5 strategic questions to understand your specific life areas, goals, and challenges. Based on your responses, I'll create custom categories, set up relevant goals and routines, and generate actionable tasks that match your exact situation.",
      timestamp: new Date()
    };
    
    const firstQuestion: Message = {
      id: `question-${ONBOARDING_QUESTIONS[0].id}`,
      type: 'assistant', 
      content: ONBOARDING_QUESTIONS[0].question,
      timestamp: new Date()
    };
    
    setMessages([welcomeMessage, firstQuestion]);
  }, []);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmitAnswer = () => {
    if (!currentAnswer.trim()) return;

    // Add user's answer
    const userMessage: Message = {
      id: `answer-${currentQuestionIndex + 1}`,
      type: 'user',
      content: currentAnswer.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setCurrentAnswer('');

    // Check if we have more questions
    if (currentQuestionIndex < ONBOARDING_QUESTIONS.length - 1) {
      // Move to next question
      const nextIndex = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextIndex);

      setTimeout(() => {
        const nextQuestion: Message = {
          id: `question-${ONBOARDING_QUESTIONS[nextIndex].id}`,
          type: 'assistant',
          content: ONBOARDING_QUESTIONS[nextIndex].question,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, nextQuestion]);
      }, 500);
    } else {
      // All questions answered - show completion
      setTimeout(() => {
        const completionMessage: Message = {
          id: 'completion',
          type: 'assistant',
          content: "Perfect! I now have everything I need to build your personalized dashboard with categories and tools that fit exactly how you work. Ready to see what I create for your specific needs?",
          timestamp: new Date()
        };
        setMessages(prev => [...prev, completionMessage]);
        setIsComplete(true);
      }, 500);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitAnswer();
    }
  };

  const handleProceedToBuild = () => {
    // Save conversation data using user-specific storage
    const conversationData = {
      messages,
      answers: ONBOARDING_QUESTIONS.map((q, index) => ({
        question: q.question,
        answer: messages.find(m => m.id === `answer-${index + 1}`)?.content || ''
      })),
      timestamp: new Date().toISOString(),
      type: 'conversation'
    };
    
    // Use user-specific storage to prevent data contamination
    setUserData(user?.id || null, 'lifely_onboarding_conversation', conversationData);
    setUserData(user?.id || null, 'lifely_onboarding_type', 'conversation');
    setUserData(user?.id || null, 'lifely_onboarding_progress', '/onboarding/documents');
    
    console.log('🔍 CONVERSATION SAVED:', {
      userId: user?.id,
      answersCount: conversationData.answers.filter(a => a.answer.trim()).length,
      totalLength: conversationData.answers.map(a => a.answer).join(' ').length
    });
    
    navigate('/onboarding/documents');
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

      <div className="relative z-10 h-screen flex flex-col">
        {/* Header */}
        <div className="p-8 border-b border-white/20 bg-white/40 backdrop-blur-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 bg-gradient-to-br from-lifeos-primary to-lifeos-secondary rounded-2xl flex items-center justify-center shadow-xl transition-all duration-300 hover:scale-110 hover:rotate-6">
              <MessageSquare className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-lifeos-dark mb-1 tracking-tight">Chat Setup</h1>
              <p className="text-lifeos-gray-400 text-lg">Answer 5 questions to build your personalized dashboard</p>
            </div>
          </div>
          
          {/* Progress indicator */}
          <div className="w-full bg-white/30 rounded-full h-2 mb-2">
            <div 
              className="bg-gradient-to-r from-lifeos-primary to-lifeos-secondary h-2 rounded-full transition-all duration-500"
              style={{ width: `${(currentQuestionIndex / ONBOARDING_QUESTIONS.length) * 100}%` }}
            />
          </div>
          <p className="text-lifeos-gray-400 text-sm">
            Question {Math.min(currentQuestionIndex + 1, ONBOARDING_QUESTIONS.length)} of {ONBOARDING_QUESTIONS.length} - Dashboard Personalization
          </p>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-white/60 backdrop-blur-sm">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4" style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(88, 88, 88, 0.2) transparent'
          }}>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-3xl ${message.type === 'user' ? 'order-2' : 'order-1'}`}>
                  <div
                    className={`rounded-2xl px-6 py-4 shadow-sm ${
                      message.type === 'user'
                        ? 'bg-gradient-to-r from-lifeos-primary to-lifeos-secondary text-white'
                        : 'bg-white/80 backdrop-blur-sm border border-white/20 text-lifeos-dark'
                    }`}
                  >
                    <p className="leading-relaxed">{message.content}</p>
                  </div>
                  <div className={`text-xs text-lifeos-gray-400 mt-2 ${message.type === 'user' ? 'text-right' : 'text-left'}`}>
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                
                {/* Avatar */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  message.type === 'user' ? 'order-1 ml-3 bg-lifeos-primary/10' : 'order-2 mr-3 bg-lifeos-secondary/10'
                }`}>
                  {message.type === 'user' ? (
                    <span className="text-lifeos-primary font-bold text-sm">You</span>
                  ) : (
                    <span className="text-lifeos-secondary font-bold text-sm">📋</span>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          {!isComplete && (
            <div className="border-t border-white/20 bg-white/40 backdrop-blur-sm p-6">
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <textarea
                    ref={textareaRef}
                    value={currentAnswer}
                    onChange={(e) => setCurrentAnswer(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your answer here..."
                    className="w-full resize-none rounded-xl border border-white/20 bg-white/60 backdrop-blur-sm px-4 py-3 text-lifeos-dark placeholder-lifeos-gray-400 focus:outline-none focus:ring-2 focus:ring-lifeos-primary/50 focus:border-transparent transition-all duration-200"
                    rows={3}
                    maxLength={1000}
                  />
                  <div className="text-xs text-lifeos-gray-400 mt-2 flex justify-between">
                    <span>Press Enter to send (Shift + Enter for new line)</span>
                    <span>{currentAnswer.length}/1000</span>
                  </div>
                </div>
                <button
                  onClick={handleSubmitAnswer}
                  disabled={!currentAnswer.trim()}
                  className="w-12 h-12 bg-gradient-to-r from-lifeos-primary to-lifeos-secondary hover:from-lifeos-primary/90 hover:to-lifeos-secondary/90 disabled:from-gray-300 disabled:to-gray-300 text-white rounded-xl transition-all duration-200 hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed shadow-lg hover:shadow-xl flex items-center justify-center"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Completion Modal */}
        {isComplete && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-8 shadow-2xl max-w-lg w-full border border-white/20">
              <div className="text-center mb-6">
                <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-2xl">
                  <CheckCircle className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-3xl font-bold text-lifeos-dark mb-2">Chat Complete!</h3>
                <p className="text-lifeos-gray-400">Perfect! I have all your answers to build your personalized dashboard.</p>
              </div>
              
              <div className="bg-gradient-to-r from-lifeos-primary/10 to-lifeos-secondary/10 border border-lifeos-primary/20 rounded-2xl p-6 mb-6">
                <h4 className="font-semibold text-lifeos-dark mb-3 flex items-center gap-2">
                  <span>✨</span> What's Next
                </h4>
                <ul className="text-lifeos-gray-400 text-sm space-y-2">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-lifeos-primary rounded-full"></div>
                    Analyze your workflow patterns
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-lifeos-secondary rounded-full"></div>
                    Create personalized categories
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-lifeos-primary rounded-full"></div>
                    Set up your dashboard for immediate use
                  </li>
                </ul>
              </div>
              
              <button
                onClick={handleProceedToBuild}
                className="w-full bg-gradient-to-r from-lifeos-primary to-lifeos-secondary hover:from-lifeos-primary/90 hover:to-lifeos-secondary/90 text-white py-4 px-8 rounded-xl font-semibold text-lg transition-all duration-300 hover:scale-105 shadow-xl hover:shadow-2xl hover:shadow-lifeos-primary/25 flex items-center justify-center gap-3"
              >
                Build My Dashboard
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}