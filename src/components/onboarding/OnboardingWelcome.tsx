import React, { useState } from 'react';
import { ChevronRight, Sparkles, User, GraduationCap, Briefcase, Heart } from 'lucide-react';
import LifelyLogo from '../LifelyLogo';

interface OnboardingWelcomeProps {
  onNext: (data: {
    role: string;
    background: string;
    goals: string;
  }) => void;
}

const OnboardingWelcome: React.FC<OnboardingWelcomeProps> = ({ onNext }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState({
    role: '',
    background: '',
    goals: ''
  });

  const questions = [
    {
      id: 'role',
      title: "What best describes you?",
      subtitle: "Help us personalize your experience",
      options: [
        { value: 'student', label: 'Student', icon: GraduationCap, desc: 'Currently studying or in school' },
        { value: 'professional', label: 'Professional', icon: Briefcase, desc: 'Working in your career' },
        { value: 'entrepreneur', label: 'Entrepreneur', icon: Sparkles, desc: 'Building your own business' },
        { value: 'other', label: 'Other', icon: User, desc: 'Something else entirely' }
      ]
    },
    {
      id: 'background',
      title: "How did you hear about Lifely?",
      subtitle: "We're curious about your journey here",
      options: [
        { value: 'social', label: 'Social Media', icon: Heart, desc: 'Found us on social platforms' },
        { value: 'search', label: 'Search Engine', icon: Sparkles, desc: 'Discovered through search' },
        { value: 'friend', label: 'Friend/Colleague', icon: User, desc: 'Someone recommended us' },
        { value: 'other', label: 'Other', icon: Briefcase, desc: 'Different source' }
      ]
    },
    {
      id: 'goals',
      title: "What's your main goal with Lifely?",
      subtitle: "Let's align our AI to help you succeed",
      options: [
        { value: 'organization', label: 'Get Organized', icon: Sparkles, desc: 'Structure my life and tasks' },
        { value: 'productivity', label: 'Boost Productivity', icon: Briefcase, desc: 'Accomplish more efficiently' },
        { value: 'balance', label: 'Work-Life Balance', icon: Heart, desc: 'Find harmony in all areas' },
        { value: 'growth', label: 'Personal Growth', icon: GraduationCap, desc: 'Develop and improve myself' }
      ]
    }
  ];

  const currentQuestion = questions[currentStep];
  const isComplete = currentStep >= questions.length;

  const handleOptionSelect = (value: string) => {
    const newAnswers = { ...answers, [currentQuestion.id]: value };
    setAnswers(newAnswers);

    if (currentStep < questions.length - 1) {
      setTimeout(() => setCurrentStep(currentStep + 1), 300);
    } else {
      setTimeout(() => onNext(newAnswers), 500);
    }
  };

  if (isComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-blue-700 rounded-full flex items-center justify-center mx-auto mb-6">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Perfect! Let's continue...</h2>
          <div className="w-8 h-1 bg-gradient-to-r from-blue-600 to-blue-700 rounded-full mx-auto animate-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
            <span>Question {currentStep + 1} of {questions.length}</span>
            <span>{Math.round(((currentStep + 1) / questions.length) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-blue-600 to-blue-700 h-2 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${((currentStep + 1) / questions.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Question */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <LifelyLogo size={48} />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
            {currentQuestion.title}
          </h1>
          <p className="text-xl text-gray-600 leading-relaxed">
            {currentQuestion.subtitle}
          </p>
        </div>

        {/* Options */}
        <div className="grid gap-4 md:gap-6">
          {currentQuestion.options.map((option) => {
            const Icon = option.icon;
            const isSelected = answers[currentQuestion.id as keyof typeof answers] === option.value;
            
            return (
              <button
                key={option.value}
                onClick={() => handleOptionSelect(option.value)}
                className={`group relative p-6 rounded-2xl border-2 transition-all duration-300 transform hover:scale-[1.02] hover:shadow-xl ${
                  isSelected
                    ? 'border-blue-500 bg-gradient-to-r from-blue-50 to-blue-100 shadow-lg'
                    : 'border-gray-200 bg-white/80 backdrop-blur-sm hover:border-blue-300'
                }`}
              >
                <div className="flex items-center space-x-4">
                  <div className={`p-3 rounded-xl transition-all duration-300 ${
                    isSelected
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white'
                      : 'bg-gray-100 text-gray-600 group-hover:bg-blue-100 group-hover:text-blue-600'
                  }`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-lg font-semibold text-gray-800 mb-1">
                      {option.label}
                    </h3>
                    <p className="text-gray-600 text-sm">
                      {option.desc}
                    </p>
                  </div>
                  <ChevronRight className={`w-5 h-5 transition-all duration-300 ${
                    isSelected
                      ? 'text-blue-600 transform translate-x-1'
                      : 'text-gray-400 group-hover:text-blue-600 group-hover:transform group-hover:translate-x-1'
                  }`} />
                </div>

                {/* Selection indicator */}
                {isSelected && (
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-r from-blue-600 to-blue-700 rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Skip option */}
        <div className="text-center mt-8">
          <button
            onClick={() => handleOptionSelect('skip')}
            className="text-gray-500 hover:text-gray-700 text-sm transition-colors duration-300"
          >
            I'd rather skip this question
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingWelcome;