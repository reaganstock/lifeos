import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Loader2, FileText, Brain, Sparkles, Plus, MessagesSquare, Sun, Moon } from 'lucide-react';
import { CategoryRAGService, CategoryContext, RAGResponse } from '../services/categoryRAG';
import { Item, Category } from '../types';

interface CategoryKnowledgeProps {
  categoryId: string;
  category: Category;
  items: Item[];
  contextLinks: Array<{
    id: string;
    title: string;
    url: string;
    type: 'link' | 'drive' | 'document';
    content?: string;
  }>;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: RAGResponse['sources'];
  confidence?: number;
  isLoading?: boolean;
}

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const CategoryKnowledge: React.FC<CategoryKnowledgeProps> = ({
  categoryId,
  category,
  items,
  contextLinks,
  onClose
}) => {
  // Chat state
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Theme colors
  const themeColors = {
    background: isDarkMode 
      ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%)'
      : 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.95) 100%)',
    border: isDarkMode ? 'rgba(75, 85, 99, 0.3)' : 'rgba(229, 231, 235, 0.8)',
    text: isDarkMode ? '#e5e7eb' : '#374151'
  };

  // Initialize with default session
  useEffect(() => {
    const defaultSession: ChatSession = {
      id: 'default',
      title: `${category.name} Knowledge`,
      messages: [{
        id: '1',
        type: 'assistant',
        content: `Welcome to your ${category.name} ${category.icon} Knowledge Assistant! I'm here to provide deep analysis and insights based on your ${items.length} items and resources.

I specialize in comprehensive analysis and strategic guidance:

EDUCATIONAL SUPPORT
• Create detailed study guides from your notes and materials
• Generate practice quizzes and test questions
• Develop structured learning schedules and study plans
• Break down complex topics into digestible sections

STRATEGIC PLANNING  
• Analyze priorities and recommend optimal scheduling
• Identify patterns and suggest workflow improvements
• Provide goal achievement strategies and milestone planning
• Connect related items to reveal insights and dependencies

PRODUCTIVITY OPTIMIZATION
• Assess your progress patterns and suggest improvements
• Recommend time management and organization strategies
• Create comprehensive action plans for your objectives
• Analyze completion rates and identify bottlenecks

Ready to dive deep? Try asking for detailed analysis like creating study guides, prioritization strategies, or comprehensive project roadmaps!`,
        timestamp: new Date(),
      }],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    setSessions([defaultSession]);
    setCurrentSessionId('default');
  }, [categoryId, category.name, items.length]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessions, currentSessionId]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Clear conversation history when component mounts (fresh start like AIAssistant)
  useEffect(() => {
    CategoryRAGService.clearConversationHistory(categoryId, 'category-chat');
  }, [categoryId, category.icon]);

  const getCurrentSession = () => sessions.find(s => s.id === currentSessionId);
  
  const createNewSession = () => {
    const newSession: ChatSession = {
      id: `session_${Date.now()}`,
      title: `New Chat ${sessions.length + 1}`,
      messages: [{
        id: `${Date.now()}_welcome`,
        type: 'assistant',
        content: `New conversation started for **${category.name}**! How can I help you today?`,
        timestamp: new Date(),
      }],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    setSessions(prev => [...prev, newSession]);
    setCurrentSessionId(newSession.id);
    setShowSessions(false);
  };

  const switchSession = (sessionId: string) => {
    setCurrentSessionId(sessionId);
    setShowSessions(false);
  };

  const addMessage = (type: 'user' | 'assistant', content: string, sources?: RAGResponse['sources'], confidence?: number) => {
    const newMessage: ChatMessage = {
      id: `${Date.now()}_${type}`,
      type,
      content,
      timestamp: new Date(),
      sources,
      confidence
    };

    setSessions(prev => prev.map(session => 
      session.id === currentSessionId 
        ? {
            ...session,
            messages: [...session.messages, newMessage],
            updatedAt: new Date()
          }
        : session
    ));
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    setIsLoading(true);

    // Add user message
    addMessage('user', userMessage);

    try {
      const categoryContext: CategoryContext = {
        items,
        category,
        contextLinks
      };

      const response = await CategoryRAGService.askQuestion(
        userMessage,
        categoryId,
        categoryContext,
        'category-chat' // Session ID for conversation history (like AIAssistant)
      );

      // Add assistant response
      addMessage('assistant', response.response, response.sources, response.confidence);

    } catch (error) {
      console.error('Failed to get response:', error);
      addMessage('assistant', "I'm sorry, I encountered an error while processing your question. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleSources = (messageId: string) => {
    setExpandedSources(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  const currentSession = getCurrentSession();

  // Sample questions based on category - showcasing deep analysis capabilities
  const getSampleQuestions = () => {
    const analyticalQuestions = [
      'Create a comprehensive study guide from my notes',
      'What should I prioritize next based on my progress?',
      'Generate a quiz from my study materials',
      'Analyze my productivity patterns and suggest improvements',
      'What are the connections between my goals and current tasks?',
      'Create a detailed action plan for my upcoming deadlines'
    ];
    
    const categorySpecific = {
      'work-productivity': [
        'Create a strategic roadmap for my professional development',
        'Analyze my meeting patterns and suggest optimizations',
        'What skills should I focus on based on my career goals?',
        'Generate a comprehensive project timeline from my notes'
      ],
      'gym-calisthenics': [
        'Design a progressive training plan based on my current routine',
        'Analyze my workout consistency and suggest improvements',
        'What exercises should I focus on for balanced development?',
        'Create a strength progression strategy from my fitness goals'
      ],
      'academic-studies': [
        'Create a comprehensive exam preparation schedule',
        'Generate practice questions from my course materials',
        'What study techniques would work best for my learning style?',
        'Analyze my academic progress and identify improvement areas'
      ],
      'self-regulation': [
        'Create a holistic life improvement plan',
        'What habits should I focus on for better personal growth?',
        'Analyze my routines and suggest optimization strategies',
        'Generate a comprehensive wellness action plan'
      ],
      'mobile-apps': [
        'Create a development roadmap for my app projects',
        'What features should I prioritize in my current projects?',
        'Analyze my coding progress and suggest learning paths',
        'Generate a comprehensive project management strategy'
      ],
      'content': [
        'Create a content strategy based on my ideas and notes',
        'What topics should I focus on for maximum impact?',
        'Analyze my content themes and suggest expansion areas',
        'Generate a comprehensive content calendar plan'
      ]
    };
    
    return [
      ...analyticalQuestions.slice(0, 3),
      ...(categorySpecific[categoryId as keyof typeof categorySpecific] || []).slice(0, 3)
    ];
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Category Header with Gradient */}
      <div 
        className="p-6 text-white"
        style={{ 
          background: `linear-gradient(135deg, ${category.color} 0%, ${category.color}CC 100%)` 
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">
                {category.icon} {category.name} Knowledge
              </h1>
              <p className="text-white/80 text-lg">
                Ask questions about your {category.name.toLowerCase()} items and resources
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-3 hover:bg-white/20 rounded-xl transition-colors"
          >
            <X className="w-8 h-8" />
          </button>
        </div>
      </div>

      {/* Main Chat Interface */}
      <div 
        className="flex-1 flex flex-col overflow-hidden"
        style={{
          background: themeColors.background,
        }}
      >
        {/* Toolbar */}
        <div 
          className="flex items-center justify-between p-4 border-b relative overflow-hidden"
          style={{ borderColor: themeColors.border }}
        >
          <div className="flex items-center space-x-3 relative z-10">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">{category.icon}</span>
              <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                Chat Assistant
              </span>
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
          </div>
        </div>

        {/* Context Info */}
        <div 
          className="px-4 py-3 border-b text-sm relative overflow-visible"
          style={{ borderColor: themeColors.border, color: themeColors.text }}
        >
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center space-x-2">
              <span>Context: <span className="font-semibold" style={{ color: category.color }}>
                {items.length} items • {contextLinks.length} links
              </span></span>
            </div>
            
            <div className="flex items-center space-x-2 text-xs">
              <div className="flex items-center space-x-1">
                <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-green-600 bg-green-100/50 px-2 py-0.5 rounded-full">
                  Category RAG Active
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Session History */}
        {showSessions && (
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
                  Chat History ({sessions.length})
                </h3>
                <button
                  onClick={createNewSession}
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
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`p-2 rounded-lg text-xs cursor-pointer transition-all transform hover:scale-[1.02] ${
                      session.id === currentSessionId 
                        ? 'text-white shadow-md' 
                        : isDarkMode 
                          ? 'bg-gray-700/50 text-gray-200 hover:bg-gray-600/50'
                          : 'bg-white/50 text-gray-600 hover:bg-gray-50/80 shadow-sm'
                    }`}
                    style={{
                      background: session.id === currentSessionId 
                        ? `linear-gradient(to right, ${category.color}, ${category.color}DD)`
                        : undefined
                    }}
                    onClick={() => switchSession(session.id)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-medium truncate flex-1 text-xs">{session.title}</div>
                      {session.id === currentSessionId && (
                        <span className="text-xs bg-white/20 px-1 py-0.5 rounded text-xs">Active</span>
                      )}
                    </div>
                    <div className={`text-xs ${session.id === currentSessionId ? 'text-gray-200' : 'text-gray-500'}`}>
                      {session.messages.length} msgs • {session.updatedAt.toLocaleDateString()}
                    </div>
                    {session.messages.length > 1 && (
                      <div className={`text-xs mt-1 truncate ${
                        session.id === currentSessionId ? 'text-gray-300' : 'text-gray-400'
                      }`}>
                        {session.messages[session.messages.length - 1]?.content.substring(0, 40)}...
                      </div>
                    )}
                  </div>
                ))}
                {sessions.length === 0 && (
                  <div className={`text-center py-3 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    No chat sessions yet. Start a conversation!
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {currentSession?.messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl p-4 ${
                  message.type === 'user'
                    ? 'text-white'
                    : isDarkMode
                    ? 'bg-gray-800/50 text-gray-100 border border-gray-700'
                    : 'bg-white/80 text-gray-800 border border-gray-200 shadow-sm'
                }`}
                style={{
                  background: message.type === 'user' 
                    ? `linear-gradient(to right, ${category.color}, ${category.color}CC)`
                    : undefined
                }}
              >
                {/* Message Content */}
                <div className="prose prose-sm max-w-none">
                  <div className="whitespace-pre-wrap leading-relaxed">
                    {message.content.split('**').map((part, index) => 
                      index % 2 === 0 ? part : <strong key={index}>{part}</strong>
                    )}
                  </div>
                </div>

                {/* Sources and Confidence */}
                {message.type === 'assistant' && (message.sources || message.confidence) && (
                  <div className="mt-4 pt-3 border-t border-gray-200/50 space-y-2">
                    {message.confidence && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">Confidence:</span>
                        <div className="flex items-center space-x-2">
                          <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full transition-all duration-500"
                              style={{ 
                                width: `${message.confidence}%`,
                                background: `linear-gradient(to right, ${category.color}AA, ${category.color})`
                              }}
                            />
                          </div>
                          <span className="font-medium text-gray-600">{message.confidence}%</span>
                        </div>
                      </div>
                    )}

                    {message.sources && message.sources.length > 0 && (
                      <div>
                        <button
                          onClick={() => toggleSources(message.id)}
                          className="flex items-center space-x-1 text-xs hover:text-opacity-80 transition-colors"
                          style={{ color: category.color }}
                        >
                          <FileText className="w-3 h-3" />
                          <span>Show Sources ({message.sources.length})</span>
                        </button>

                        {expandedSources.has(message.id) && (
                          <div className="mt-2 space-y-2">
                            {message.sources.map((source, index) => (
                              <div key={index} className="bg-gray-50/50 rounded-lg p-2 border border-gray-200/50">
                                <div className="flex items-center space-x-2 mb-1">
                                  <span className="text-xs font-medium text-gray-700">{source.title}</span>
                                  {source.itemType && (
                                    <span 
                                      className="text-xs text-white px-1 py-0.5 rounded"
                                      style={{ backgroundColor: category.color }}
                                    >
                                      {source.itemType}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-600">{source.excerpt}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Timestamp */}
                <div className="mt-2 text-xs opacity-60">
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white/80 border border-gray-200 rounded-2xl p-4 flex items-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: category.color }} />
                <span className="text-sm text-gray-600">Analyzing your {category.name} data...</span>
              </div>
            </div>
          )}

          {/* Sample Questions */}
          {currentSession?.messages.length === 1 && !isLoading && (
            <div className="rounded-2xl p-6 border border-gray-200/50"
                 style={{ background: `linear-gradient(135deg, ${category.color}10, ${category.color}05)` }}>
              <h4 className="text-sm font-semibold mb-3 flex items-center" style={{ color: category.color }}>
                <Sparkles className="w-4 h-4 mr-2" />
                Suggested Questions
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {getSampleQuestions().map((question: string, index: number) => (
                  <button
                    key={index}
                    onClick={() => setInputValue(question)}
                    className="text-left p-3 bg-white/70 hover:bg-white rounded-xl text-sm transition-all duration-300 border border-gray-200/50 hover:border-gray-300 hover:shadow-md transform hover:scale-[1.02]"
                    style={{ 
                      color: category.color,
                      borderColor: `${category.color}30`
                    }}
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div 
          className="border-t p-4"
          style={{ borderColor: themeColors.border }}
        >
          <div className="flex space-x-3">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={`Ask about your ${category.name} items...`}
                className={`w-full px-4 py-3 rounded-xl resize-none focus:outline-none transition-all duration-300 ${
                  isDarkMode
                    ? 'bg-gray-800/50 border border-gray-700 text-gray-100 placeholder-gray-400'
                    : 'bg-white/80 border border-gray-200 text-gray-800 placeholder-gray-500'
                }`}
                rows={1}
                style={{ minHeight: '48px', maxHeight: '120px' }}
              />
            </div>
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading}
              className="px-6 py-3 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center space-x-2"
              style={{
                background: !inputValue.trim() || isLoading 
                  ? 'linear-gradient(to right, #d1d5db, #9ca3af)'
                  : `linear-gradient(to right, ${category.color}, ${category.color}CC)`
              }}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CategoryKnowledge; 