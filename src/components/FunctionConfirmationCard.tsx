import React from 'react';
import { CheckCircle, XCircle, Zap, Edit3, Plus, Trash2, Search } from 'lucide-react';

interface FunctionCall {
  name: string;
  args: any;
}

interface FunctionConfirmationCardProps {
  functionCall: FunctionCall;
  onConfirm: () => void;
  onCancel: () => void;
  isDarkMode?: boolean;
}

const FunctionConfirmationCard: React.FC<FunctionConfirmationCardProps> = ({
  functionCall,
  onConfirm,
  onCancel,
  isDarkMode = false
}) => {
  const getFunctionIcon = (functionName: string) => {
    switch (functionName) {
      case 'universalEdit':
      case 'smartEditNote':
        return <Edit3 className="w-5 h-5" />;
      case 'universalCreate':
        return <Plus className="w-5 h-5" />;
      case 'universalDelete':
        return <Trash2 className="w-5 h-5" />;
      case 'universalSearch':
        return <Search className="w-5 h-5" />;
      default:
        return <Zap className="w-5 h-5" />;
    }
  };

  const getFunctionColor = (functionName: string) => {
    switch (functionName) {
      case 'universalEdit':
      case 'smartEditNote':
        return 'from-blue-500 to-blue-600';
      case 'universalCreate':
        return 'from-green-500 to-green-600';
      case 'universalDelete':
        return 'from-red-500 to-red-600';
      case 'universalSearch':
        return 'from-purple-500 to-purple-600';
      default:
        return 'from-indigo-500 to-indigo-600';
    }
  };

  const getFunctionDescription = (functionCall: FunctionCall) => {
    const { name, args } = functionCall;
    
    switch (name) {
      case 'universalEdit':
        return `Edit ${args.itemType || 'item'}: ${args.editAction?.replace('_', ' ')} "${args.searchQuery}"`;
      case 'smartEditNote':
        return `Edit note: ${args.editType?.replace('_', ' ')} in "${args.searchQuery}"`;
      case 'universalCreate':
        return `Create ${args.itemType}: "${args.title}"`;
      case 'universalDelete':
        return `Delete ${args.itemType || 'items'} matching "${args.searchQuery}"`;
      case 'universalSearch':
        return `Search ${args.itemType || 'all items'} for "${args.query}"`;
      case 'createIntelligentCalendar':
        return `Create ${args.eventCount || 100} intelligent calendar events`;
      case 'deleteAllEvents':
        return 'Delete all calendar events';
      default:
        return `Execute ${name}`;
    }
  };

  const getActionDetails = (functionCall: FunctionCall) => {
    const { name, args } = functionCall;
    const details = [];
    
    if (args.newValue) details.push(`New value: "${args.newValue}"`);
    if (args.content) details.push(`Content: "${args.content.substring(0, 50)}..."`);
    if (args.priority) details.push(`Priority: ${args.priority}`);
    if (args.location) details.push(`Location: ${args.location}`);
    if (args.category) details.push(`Category: ${args.category}`);
    if (args.findText) details.push(`Find: "${args.findText}"`);
    if (args.replaceText) details.push(`Replace with: "${args.replaceText}"`);
    
    return details;
  };

  const themeColors = {
    bg: isDarkMode ? 'bg-gray-800/95' : 'bg-white/95',
    border: isDarkMode ? 'border-gray-600' : 'border-gray-200',
    text: isDarkMode ? 'text-gray-100' : 'text-gray-900',
    subtext: isDarkMode ? 'text-gray-300' : 'text-gray-600',
    glass: isDarkMode ? 'backdrop-blur-xl bg-gray-800/80' : 'backdrop-blur-xl bg-white/80'
  };

  return (
    <div className={`
      ${themeColors.glass} ${themeColors.border}
      border rounded-2xl p-6 mx-4 my-3 shadow-2xl
      transform transition-all duration-300 ease-out
      hover:scale-[1.02] hover:shadow-3xl
      animate-in slide-in-from-bottom-4 fade-in duration-500
    `}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-4">
        <div className={`
          w-12 h-12 rounded-xl bg-gradient-to-br ${getFunctionColor(functionCall.name)}
          flex items-center justify-center text-white shadow-lg
        `}>
          {getFunctionIcon(functionCall.name)}
        </div>
        <div className="flex-1">
          <h3 className={`${themeColors.text} text-lg font-semibold`}>
            AI Action Required
          </h3>
          <p className={`${themeColors.subtext} text-sm`}>
            {getFunctionDescription(functionCall)}
          </p>
        </div>
      </div>

      {/* Details */}
      {getActionDetails(functionCall).length > 0 && (
        <div className={`
          ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50/50'}
          rounded-xl p-4 mb-4 space-y-2
        `}>
          {getActionDetails(functionCall).map((detail, index) => (
            <div key={index} className={`${themeColors.subtext} text-sm flex items-center gap-2`}>
              <div className="w-1.5 h-1.5 bg-current rounded-full opacity-60" />
              {detail}
            </div>
          ))}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onConfirm}
          className="
            flex-1 bg-gradient-to-r from-green-500 to-green-600 
            text-white font-medium py-3 px-6 rounded-xl
            hover:from-green-600 hover:to-green-700
            transform hover:scale-[1.02] active:scale-[0.98]
            transition-all duration-200 ease-out
            shadow-lg hover:shadow-xl
            flex items-center justify-center gap-2
          "
        >
          <CheckCircle className="w-4 h-4" />
          Confirm
        </button>
        <button
          onClick={onCancel}
          className={`
            flex-1 ${isDarkMode ? 'bg-gray-600 hover:bg-gray-500' : 'bg-gray-200 hover:bg-gray-300'}
            ${themeColors.text} font-medium py-3 px-6 rounded-xl
            transform hover:scale-[1.02] active:scale-[0.98]
            transition-all duration-200 ease-out
            shadow-lg hover:shadow-xl
            flex items-center justify-center gap-2
          `}
        >
          <XCircle className="w-4 h-4" />
          Cancel
        </button>
      </div>
    </div>
  );
};

export default FunctionConfirmationCard; 