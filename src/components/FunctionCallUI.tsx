import React, { useState } from 'react';
import { CheckCircle, Calendar, BowArrow, FileText, RotateCcw, X, Edit3, CheckSquare } from 'lucide-react';

interface FunctionCallUIProps {
  functionCall: {
    name: string;
    args: any;
    completed?: boolean;
    result?: any;
  };
  onApprove: () => void;
  onReject: () => void;
  isDarkMode?: boolean;
  autoApprove?: boolean;
  onAutoApproveChange?: (enabled: boolean) => void;
}

const FunctionCallUI: React.FC<FunctionCallUIProps> = ({ 
  functionCall, 
  onApprove, 
  onReject, 
  isDarkMode = false,
  autoApprove = false,
  onAutoApproveChange 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getIcon = (type: string) => {
    switch (type) {
      case 'todo': return <CheckSquare className="w-5 h-5 text-blue-500" />;
      case 'event': return <Calendar className="w-5 h-5 text-purple-500" />;
      case 'goal': return <BowArrow className="w-5 h-5 text-green-500" />;
      case 'note': return <FileText className="w-5 h-5 text-yellow-500" />;
      case 'routine': return <RotateCcw className="w-5 h-5 text-orange-500" />;
      default: return <Edit3 className="w-5 h-5 text-gray-500" />;
    }
  };

  const getActionColor = (name: string) => {
    if (name.includes('create') || name.includes('add')) return 'text-green-600';
    if (name.includes('update') || name.includes('edit')) return 'text-blue-600';
    if (name.includes('delete') || name.includes('remove')) return 'text-red-600';
    return 'text-gray-600';
  };

  const formatArgs = (args: any) => {
    const formatted: any = {};
    Object.keys(args).forEach(key => {
      if (typeof args[key] === 'string' && args[key].length > 50) {
        formatted[key] = args[key].substring(0, 50) + '...';
      } else {
        formatted[key] = args[key];
      }
    });
    return formatted;
  };

  const getPreviewText = () => {
    const args = functionCall.args;
    
    // Handle bulkCreateItems differently
    if (functionCall.name === 'bulkCreateItems' && args.itemsJson) {
      try {
        const items = JSON.parse(args.itemsJson);
        const itemCount = items.length;
        const itemTypes = Array.from(new Set(items.map((item: any) => item.type)));
        const categories = Array.from(new Set(items.map((item: any) => item.categoryId)));
        
        return `Creating ${itemCount} items: ${itemTypes.join(', ')} across ${categories.length} categories`;
      } catch (e) {
        return `Creating multiple items (bulk creation)`;
      }
    }
    
    // Handle single item creation
    const type = args.type || 'item';
    const title = args.title || args.name || 'Untitled';
    const category = args.categoryId || args.category || '';
    
    return `Creating ${type}: "${title}"${category ? ` in ${category}` : ''}`;
  };

  return (
    <div className={`relative overflow-hidden rounded-2xl p-5 mb-6 transition-all duration-300 transform hover:scale-[1.02] ${
      isDarkMode 
        ? 'bg-gradient-to-br from-gray-900/90 via-gray-800/95 to-gray-900/90 border border-gray-700/50 shadow-2xl' 
        : 'bg-gradient-to-br from-white/95 via-gray-50/98 to-white/95 border border-gray-200/60 shadow-2xl'
    }`}
    style={{
      backdropFilter: 'blur(20px)',
      boxShadow: isDarkMode 
        ? '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.1)' 
        : '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.8)'
    }}>
      {/* Animated background glow */}
      <div className="absolute inset-0 opacity-20">
        <div className={`absolute inset-0 rounded-2xl animate-pulse ${
          functionCall.args.type === 'todo' ? 'bg-gradient-to-r from-blue-500/20 to-indigo-500/20' :
          functionCall.args.type === 'event' ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20' :
          functionCall.args.type === 'goal' ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20' :
          functionCall.args.type === 'note' ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20' :
          functionCall.args.type === 'routine' ? 'bg-gradient-to-r from-orange-500/20 to-red-500/20' :
          'bg-gradient-to-r from-purple-500/20 to-indigo-500/20'
        }`}></div>
      </div>

      {/* Header */}
      <div className="relative flex items-center justify-between mb-4">
        <div className="flex items-center space-x-4">
          {/* Enhanced icon with glow effect */}
          <div className={`relative p-3 rounded-xl shadow-lg transform transition-all duration-300 ${
            functionCall.args.type === 'todo' ? 'bg-gradient-to-br from-blue-500 to-indigo-600' :
            functionCall.args.type === 'event' ? 'bg-gradient-to-br from-purple-500 to-pink-600' :
            functionCall.args.type === 'goal' ? 'bg-gradient-to-br from-green-500 to-emerald-600' :
            functionCall.args.type === 'note' ? 'bg-gradient-to-br from-yellow-500 to-orange-600' :
            functionCall.args.type === 'routine' ? 'bg-gradient-to-br from-orange-500 to-red-600' :
            'bg-gradient-to-br from-purple-500 to-indigo-600'
          }`}>
            <div className="absolute inset-0 rounded-xl bg-white/20 animate-pulse"></div>
            {functionCall.name === 'bulkCreateItems' ? 
              <Edit3 className="w-6 h-6 text-white relative z-10" /> : 
              React.cloneElement(getIcon(functionCall.args.type) as React.ReactElement, { 
                className: "w-6 h-6 text-white relative z-10" 
              })
            }
          </div>
          <div>
            <div className={`font-bold text-lg ${getActionColor(functionCall.name)} mb-1`}>
              {functionCall.name.replace(/([A-Z])/g, ' $1').toLowerCase().replace(/^./, str => str.toUpperCase())}
            </div>
            <div className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              🎯 AI Function Call
            </div>
          </div>
        </div>
        
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`relative px-4 py-2 rounded-lg font-medium text-sm transition-all duration-300 transform hover:scale-105 ${
            isDarkMode 
              ? 'bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 border border-gray-600/50' 
              : 'bg-gray-100/50 hover:bg-gray-200/50 text-gray-600 border border-gray-300/50'
          }`}
        >
          <span className="relative z-10">{isExpanded ? '👁️ Less' : '🔍 More'}</span>
        </button>
      </div>

      {/* Enhanced Preview */}
      <div className={`relative p-4 rounded-xl mb-4 ${
        isDarkMode ? 'bg-gray-800/30 border border-gray-700/30' : 'bg-gray-50/30 border border-gray-200/30'
      }`}>
        <div className={`font-semibold text-base mb-2 ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>
          ✨ {getPreviewText()}
        </div>
        <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          Ready to execute when you approve
        </div>
      </div>

      {/* Expandable Details */}
      {isExpanded && (
        <div className={`mb-3 p-3 rounded-lg text-xs ${
          isDarkMode ? 'bg-gray-900/50' : 'bg-gray-50'
        }`}>
          <div className={`mb-2 font-bold ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            {functionCall.name === 'bulkCreateItems' ? 'Items to Create:' : 'Function Arguments:'}
          </div>
          
          {functionCall.name === 'bulkCreateItems' && functionCall.args.itemsJson ? (
            <div className="space-y-2">
              {(() => {
                try {
                  const items = JSON.parse(functionCall.args.itemsJson);
                  return items.map((item: any, index: number) => (
                    <div key={index} className={`p-2 rounded border-l-2 ${
                      item.type === 'todo' ? 'border-blue-500 bg-blue-50/50' :
                      item.type === 'goal' ? 'border-green-500 bg-green-50/50' :
                      item.type === 'event' ? 'border-purple-500 bg-purple-50/50' :
                      item.type === 'routine' ? 'border-orange-500 bg-orange-50/50' :
                      item.type === 'note' ? 'border-yellow-500 bg-yellow-50/50' :
                      'border-gray-500 bg-gray-50/50'
                    } ${isDarkMode ? 'bg-opacity-20' : ''}`}>
                      <div className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                        {item.type}: {item.title}
                      </div>
                      <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Category: {item.categoryId}
                      </div>
                      {item.dateTime && (
                        <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Date: {new Date(item.dateTime).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  ));
                } catch (e) {
                  return <div className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Error parsing items</div>;
                }
              })()}
            </div>
          ) : (
            <pre className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'} whitespace-pre-wrap font-mono`}>
              {JSON.stringify(formatArgs(functionCall.args), null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* Enhanced Action Buttons */}
      <div className="space-y-4">
        <div className="flex items-center space-x-3">
          {functionCall.completed ? (
            <div className="flex-1 relative overflow-hidden bg-gradient-to-r from-green-500 via-emerald-500 to-green-600 text-white py-4 px-6 rounded-xl flex items-center justify-center space-x-3 shadow-lg">
              <div className="absolute inset-0 bg-gradient-to-r from-green-400/20 to-emerald-400/20 animate-pulse"></div>
              <CheckCircle className="w-5 h-5 relative z-10" />
              <span className="font-bold text-lg relative z-10">✅ Executed Successfully</span>
            </div>
          ) : (
            <>
              <button
                onClick={onApprove}
                className="flex-1 relative overflow-hidden bg-gradient-to-r from-green-500 via-emerald-500 to-green-600 text-white py-4 px-6 rounded-xl hover:from-green-600 hover:via-emerald-600 hover:to-green-700 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center space-x-3 font-bold text-base shadow-xl group"
                style={{
                  boxShadow: '0 10px 25px -5px rgba(34, 197, 94, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-green-400/20 to-emerald-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <CheckCircle className="w-5 h-5 relative z-10 group-hover:rotate-12 transition-transform duration-300" />
                <span className="relative z-10">🚀 Execute Function</span>
              </button>
              
              <button
                onClick={onReject}
                className={`relative px-4 py-4 rounded-xl transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg group ${
                  isDarkMode 
                    ? 'bg-gradient-to-r from-gray-700 to-gray-600 hover:from-gray-600 hover:to-gray-500 text-gray-300 border border-gray-600' 
                    : 'bg-gradient-to-r from-gray-200 to-gray-100 hover:from-gray-300 hover:to-gray-200 text-gray-600 border border-gray-300'
                }`}
              >
                <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
              </button>
            </>
          )}
        </div>
        
        {/* Enhanced Auto-approve checkbox */}
        {onAutoApproveChange && (
          <div className={`relative p-4 rounded-xl border transition-all duration-300 ${
            autoApprove
              ? 'border-green-500/30 bg-gradient-to-r from-green-500/10 to-emerald-500/10'
              : isDarkMode 
                ? 'border-gray-600/30 bg-gray-800/20' 
                : 'border-gray-300/30 bg-gray-50/20'
          }`}>
            <label className={`flex items-center space-x-4 cursor-pointer group`}>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={autoApprove}
                  onChange={(e) => onAutoApproveChange(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-8 h-8 rounded-xl border-2 transition-all duration-300 flex items-center justify-center ${
                  autoApprove 
                    ? 'bg-gradient-to-br from-green-500 to-emerald-600 border-green-400 shadow-lg transform scale-105' 
                    : isDarkMode 
                      ? 'border-gray-500 bg-gray-700/50 hover:border-gray-400' 
                      : 'border-gray-400 bg-white hover:border-gray-500'
                }`}>
                  {autoApprove && (
                    <CheckSquare className="w-5 h-5 text-white" />
                  )}
                </div>
              </div>
              <div className="flex-1">
                <div className={`font-semibold text-base transition-colors duration-300 ${
                  autoApprove 
                    ? 'text-green-600 dark:text-green-400' 
                    : isDarkMode ? 'text-gray-200' : 'text-gray-700'
                }`}>
                  ⚡ Auto-approve future calls
                </div>
                <div className={`text-sm transition-colors duration-300 ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  Automatically execute similar function calls
                </div>
              </div>
            </label>
          </div>
        )}
      </div>
    </div>
  );
};

export default FunctionCallUI;