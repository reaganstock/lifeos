import React, { useState } from 'react';
import { CheckCircle, Calendar, Target, FileText, Repeat, X, Edit3 } from 'lucide-react';

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
      case 'todo': return <CheckCircle className="w-5 h-5 text-blue-500" />;
      case 'event': return <Calendar className="w-5 h-5 text-purple-500" />;
      case 'goal': return <Target className="w-5 h-5 text-green-500" />;
      case 'note': return <FileText className="w-5 h-5 text-yellow-500" />;
      case 'routine': return <Repeat className="w-5 h-5 text-orange-500" />;
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
    <div className={`border rounded-xl p-4 mb-4 transition-all duration-200 ${
      isDarkMode 
        ? 'bg-gray-800/50 border-gray-600/50 backdrop-blur-sm' 
        : 'bg-white/90 border-gray-200/50 backdrop-blur-sm'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          {functionCall.name === 'bulkCreateItems' ? 
            <Edit3 className="w-5 h-5 text-purple-500" /> : 
            getIcon(functionCall.args.type)
          }
          <div>
            <div className={`font-medium ${getActionColor(functionCall.name)} text-sm`}>
              {functionCall.name.replace(/([A-Z])/g, ' $1').toLowerCase().replace(/^./, str => str.toUpperCase())}
            </div>
            <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Function Call
            </div>
          </div>
        </div>
        
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`text-xs px-2 py-1 rounded transition-all ${
            isDarkMode 
              ? 'hover:bg-gray-700 text-gray-300' 
              : 'hover:bg-gray-100 text-gray-600'
          }`}
        >
          {isExpanded ? 'Less' : 'More'}
        </button>
      </div>

      {/* Preview */}
      <div className={`text-sm mb-3 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
        {getPreviewText()}
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

      {/* Action Buttons */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          {functionCall.completed ? (
            <div className="flex-1 bg-gradient-to-r from-green-600 to-green-700 text-white text-sm py-2 px-4 rounded-lg flex items-center justify-center space-x-2 opacity-75">
              <CheckCircle className="w-4 h-4" />
              <span>Executed</span>
            </div>
          ) : (
            <>
              <button
                onClick={onApprove}
                className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white text-sm py-2 px-4 rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 flex items-center justify-center space-x-2"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Execute</span>
              </button>
              
              <button
                onClick={onReject}
                className={`px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                  isDarkMode 
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' 
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
        
        {/* Auto-approve checkbox */}
        {onAutoApproveChange && (
          <div className="flex items-center justify-center">
            <label className={`flex items-center space-x-2 cursor-pointer text-sm ${
              isDarkMode ? 'text-gray-300' : 'text-gray-600'
            }`}>
              <input
                type="checkbox"
                checked={autoApprove}
                onChange={(e) => onAutoApproveChange(e.target.checked)}
                className="w-4 h-4 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500 focus:ring-2"
              />
              <span>Auto-approve future calls</span>
            </label>
          </div>
        )}
      </div>
    </div>
  );
};

export default FunctionCallUI;