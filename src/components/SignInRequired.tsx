import React from 'react';
import { useNavigate } from 'react-router-dom';

interface SignInRequiredProps {
  onSignInClick?: () => void;
}

const SignInRequired: React.FC<SignInRequiredProps> = ({ onSignInClick }) => {
  const navigate = useNavigate();

  const handleSignInClick = () => {
    if (onSignInClick) {
      onSignInClick();
    } else {
      navigate('/auth');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-blue-900 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        {/* Lock Icon */}
        <div className="mx-auto w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl flex items-center justify-center mb-8 shadow-2xl">
          <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </div>

        {/* Heading */}
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
          Authentication Required
        </h1>

        {/* Description */}
        <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 leading-relaxed">
          Please sign in to access Life Structure and manage your goals, tasks, and routines.
        </p>

        {/* Sign In Button */}
        <button
          onClick={handleSignInClick}
          className="bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 ease-out"
        >
          Sign In to Continue
        </button>

        {/* Background decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-purple-600/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
        </div>
      </div>
    </div>
  );
};

export default SignInRequired;