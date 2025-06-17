import React, { useState, useRef, useEffect } from 'react';
import { Plus, Mic, MicOff, Sparkles, Send, X, Loader } from 'lucide-react';
import { aiService } from '../services/aiService';
import { voiceService } from '../services/voiceService';
import { Item, Category } from '../types';

interface QuickAddProps {
  categories: Category[];
  onAddItem: (item: Item) => void;
  defaultCategoryId?: string;
  isOpen: boolean;
  onClose: () => void;
}

const QuickAdd: React.FC<QuickAddProps> = ({ 
  categories, 
  onAddItem, 
  defaultCategoryId, 
  isOpen, 
  onClose 
}) => {
  const [command, setCommand] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  
  const inputRef = useRef<HTMLInputElement>(null);

  // Georgetown success command suggestions
  const commandSuggestions = [
    "Add goal: Master backflip by summer",
    "Create routine: Daily Bible reading at 6am",
    "Schedule Georgetown application deadline January 15",
    "Todo: Complete handstand push-up progression",
    "Goal: Reach $5K monthly revenue by Q2",
    "Routine: Evening Mass 7-8PM daily",
    "Note: Conversation tips for better charisma",
    "Event: Calisthenics training tomorrow 6am",
    "Goal: Read Bible in 365 days",
    "Todo: Update Georgetown essay draft"
  ];

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      // Show random suggestions
      const randomSuggestions = commandSuggestions
        .sort(() => 0.5 - Math.random())
        .slice(0, 3);
      setSuggestions(randomSuggestions);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim() || isProcessing) return;

    setIsProcessing(true);
    
    try {
      const item = await aiService.processCommand(command, defaultCategoryId || categories[0]?.id);
      
      if (item) {
        onAddItem(item);
        setCommand('');
        
        // Show success feedback
        const successMessage = `✨ Added ${item.type}: "${item.title}"`;
        const category = categories.find(c => c.id === item.categoryId);
        console.log(`${successMessage} to ${category?.name || 'category'}`);
        
        // Close after successful add
        setTimeout(() => {
          onClose();
        }, 500);
      }
    } catch (error) {
      console.error('Error processing command:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVoiceRecording = async () => {
    if (isRecording) {
      try {
        const audioRecording = await voiceService.stopRecording();
        setIsRecording(false);
        
        if (audioRecording) {
          setIsProcessing(true);
          const transcriptionResult = await voiceService.transcribeWithContext(audioRecording.blob);
          setCommand(transcriptionResult.text);
          setIsProcessing(false);
        }
      } catch (error) {
        console.error('Voice recording error:', error);
        setIsRecording(false);
        setIsProcessing(false);
      }
    } else {
      try {
        await voiceService.startRecording();
        setIsRecording(true);
      } catch (error) {
        console.error('Failed to start recording:', error);
      }
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setCommand(suggestion);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const getPlaceholderText = () => {
    const placeholders = [
      "Add Georgetown application deadline...",
      "Create daily Bible reading routine...",
      "Goal: Master backflip...",
      "Schedule gym session tomorrow...",
      "Note: Charisma improvement ideas..."
    ];
    return placeholders[Math.floor(Math.random() * placeholders.length)];
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white bg-opacity-20 rounded-lg">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Quick Add with AI</h2>
                <p className="text-blue-100 text-sm">Natural language processing for Georgetown success</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-6">
          {/* Command Input */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder={getPlaceholderText()}
                className="w-full px-4 py-4 pr-24 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                disabled={isProcessing}
              />
              
              {/* Voice Recording Button */}
              <div className="absolute right-2 top-2 flex space-x-2">
                <button
                  type="button"
                  onClick={handleVoiceRecording}
                  className={`p-2 rounded-lg transition-colors ${
                    isRecording 
                      ? 'bg-red-500 text-white animate-pulse' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  disabled={isProcessing}
                >
                  {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>
                
                <button
                  type="submit"
                  disabled={!command.trim() || isProcessing}
                  className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isProcessing ? (
                    <Loader className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Recording Indicator */}
            {isRecording && (
              <div className="flex items-center justify-center space-x-2 text-red-600 bg-red-50 rounded-lg p-3">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <span className="font-medium">Recording... speak your command</span>
              </div>
            )}

            {/* Processing Indicator */}
            {isProcessing && !isRecording && (
              <div className="flex items-center justify-center space-x-2 text-blue-600 bg-blue-50 rounded-lg p-3">
                <Sparkles className="w-4 h-4 animate-spin" />
                <span className="font-medium">AI is processing your command...</span>
              </div>
            )}
          </form>

          {/* Suggestions */}
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-600 mb-3">Quick Suggestions:</h3>
            <div className="space-y-2">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="w-full text-left p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-sm"
                  disabled={isProcessing}
                >
                  <span className="text-gray-600">💡</span> {suggestion}
                </button>
              ))}
            </div>
          </div>

          {/* Examples & Tips */}
          <div className="mt-6 bg-blue-50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-800 mb-2">Examples:</h3>
            <div className="text-xs text-blue-700 space-y-1">
              <p>• <strong>Goals:</strong> "Achieve backflip by summer" or "Goal: $5K revenue monthly"</p>
              <p>• <strong>Routines:</strong> "Daily Bible reading at 6am" or "Gym routine Monday-Friday"</p>
              <p>• <strong>Events:</strong> "Georgetown interview tomorrow 2pm" or "Mass tonight 7pm"</p>
              <p>• <strong>Todos:</strong> "Complete essay draft" or "Buy protein powder"</p>
              <p>• <strong>Notes:</strong> "Remember social skills tip" or "Handstand progression notes"</p>
            </div>
          </div>

          {/* Category Indicator */}
          {defaultCategoryId && (
            <div className="mt-4 text-center">
              <span className="text-xs text-gray-500">
                Adding to: {categories.find(c => c.id === defaultCategoryId)?.name || 'Default'}
                (AI will auto-categorize based on content)
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuickAdd; 