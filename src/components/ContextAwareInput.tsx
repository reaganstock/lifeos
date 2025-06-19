import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Item } from '../types';

interface ContextAwareInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyPress?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  rows?: number;
  items: Item[];
  isDarkMode?: boolean;
}

interface ContextSuggestion {
  id: string;
  title: string;
  type: string;
  categoryId: string;
  displayText: string;
  mentionText: string; // The actual text that gets inserted (includes ID)
}

export interface ContextAwareInputRef {
  focus: () => void;
  blur: () => void;
}

const ContextAwareInput = forwardRef<ContextAwareInputRef, ContextAwareInputProps>(({
  value,
  onChange,
  onKeyPress,
  placeholder,
  className,
  style,
  rows = 1,
  items,
  isDarkMode = false
}, ref) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<ContextSuggestion[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [mentionStart, setMentionStart] = useState(-1);
  const [currentQuery, setCurrentQuery] = useState('');

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
    blur: () => textareaRef.current?.blur()
  }));

  // Convert items to suggestions
  const createSuggestions = (query: string): ContextSuggestion[] => {
    const filteredItems = items
      .filter(item => {
        const searchTerm = query.toLowerCase();
        return (
          item.title.toLowerCase().includes(searchTerm) ||
          item.type.toLowerCase().includes(searchTerm) ||
          item.categoryId.toLowerCase().includes(searchTerm)
        );
      })
      .slice(0, 8) // Limit to 8 suggestions
      .map(item => ({
        id: item.id,
        title: item.title,
        type: item.type,
        categoryId: item.categoryId,
        displayText: `@${item.title}`,
        mentionText: `@${item.title}` // For now, keep it simple and bold
      }));

    return filteredItems;
  };

  // Handle input changes and detect @ mentions
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPosition = e.target.selectionStart;
    
    onChange(newValue);

    // Check for @ mention
    const textBeforeCursor = newValue.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex >= 0) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      
      // Check if we're still in a mention (no spaces after @)
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        setMentionStart(lastAtIndex);
        setCurrentQuery(textAfterAt);
        const newSuggestions = createSuggestions(textAfterAt);
        setSuggestions(newSuggestions);
        setShowSuggestions(newSuggestions.length > 0);
        setSelectedSuggestionIndex(0);
      } else {
        setShowSuggestions(false);
      }
    } else {
      setShowSuggestions(false);
    }
  };

  // Handle ID pasting and conversion
  const handlePaste = (e: React.ClipboardEvent) => {
    const pastedText = e.clipboardData.getData('text').trim();
    
    // Check if pasted text looks like an item ID
    const foundItem = items.find(item => item.id === pastedText);
    
    console.log('📋 Paste detected:', { pastedText, foundItem: foundItem?.title });
    
    if (foundItem) {
      e.preventDefault();
      const cursorPosition = textareaRef.current?.selectionStart || 0;
      const beforeCursor = value.substring(0, cursorPosition);
      const afterCursor = value.substring(cursorPosition);
      const mentionText = `@${foundItem.title}`;
      const newValue = `${beforeCursor}${mentionText}${afterCursor}`;
      
      console.log('📋 Creating mention:', { mentionText, newValue });
      onChange(newValue);
      
      // Set cursor position after the mention
      setTimeout(() => {
        if (textareaRef.current) {
          const newPosition = cursorPosition + mentionText.length;
          textareaRef.current.setSelectionRange(newPosition, newPosition);
        }
      }, 0);
    }
  };

  // Handle suggestion selection
  const selectSuggestion = (suggestion: ContextSuggestion) => {
    if (mentionStart >= 0) {
      const beforeMention = value.substring(0, mentionStart);
      const afterMention = value.substring(mentionStart + currentQuery.length + 1);
      const newValue = `${beforeMention}${suggestion.mentionText} ${afterMention}`;
      onChange(newValue);
      
      // Set cursor position after the mention
      setTimeout(() => {
        if (textareaRef.current) {
          const newPosition = mentionStart + suggestion.mentionText.length + 1;
          textareaRef.current.setSelectionRange(newPosition, newPosition);
          textareaRef.current.focus();
        }
      }, 0);
    }
    setShowSuggestions(false);
  };

  // Handle keyboard navigation in suggestions
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSuggestions && suggestions.length > 0) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedSuggestionIndex((prev) => 
            prev < suggestions.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedSuggestionIndex((prev) => 
            prev > 0 ? prev - 1 : suggestions.length - 1
          );
          break;
        case 'Tab':
        case 'Enter':
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            selectSuggestion(suggestions[selectedSuggestionIndex]);
            return;
          }
          break;
        case 'Escape':
          setShowSuggestions(false);
          break;
      }
    }

    // Pass through other key events
    if (onKeyPress && (e.key === 'Enter' && !showSuggestions)) {
      onKeyPress(e as React.KeyboardEvent<HTMLTextAreaElement>);
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowSuggestions(false);
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Note: Using simple @ItemName format for better UX

  // Get position for suggestions dropdown (above input)
  const getSuggestionPosition = () => {
    if (!textareaRef.current || mentionStart < 0) return { bottom: 0, left: 0 };
    
    const textarea = textareaRef.current;
    const textBeforeMention = value.substring(0, mentionStart);
    const lines = textBeforeMention.split('\n');
    const currentLineLength = lines[lines.length - 1].length;
    
    // Approximate position (this is simplified - could be more precise)
    const charWidth = 8; // Approximate character width
    
    return {
      bottom: textarea.offsetHeight + 10, // 10px above the input
      left: Math.min(currentLineLength * charWidth, 200) // Prevent overflow
    };
  };

  const suggestionPosition = getSuggestionPosition();

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder={placeholder}
        className={`${className} context-aware-input`}
        style={style}
        rows={rows}
      />
      
      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          className={`absolute z-50 min-w-80 max-w-96 rounded-xl shadow-2xl border backdrop-blur-xl ${
            isDarkMode
              ? 'bg-gray-900/95 border-gray-700/50'
              : 'bg-white/95 border-gray-200/50'
          }`}
          style={{
            bottom: suggestionPosition.bottom,
            left: suggestionPosition.left,
            maxHeight: '200px',
            overflowY: 'auto'
          }}
        >
          {/* Header */}
          <div className={`px-4 py-2 border-b text-xs font-medium ${
            isDarkMode 
              ? 'border-gray-700/50 text-gray-400' 
              : 'border-gray-200/50 text-gray-500'
          }`}>
            Select item to mention ({suggestions.length} found)
          </div>
          
          {/* Suggestions List */}
          <div className="py-2">
            {suggestions.map((suggestion, index) => (
              <button
                key={suggestion.id}
                onClick={() => selectSuggestion(suggestion)}
                className={`w-full px-4 py-3 text-left hover:bg-opacity-50 transition-all duration-200 flex items-center space-x-3 ${
                  index === selectedSuggestionIndex
                    ? isDarkMode
                      ? 'bg-purple-500/20 border-r-2 border-purple-400'
                      : 'bg-purple-100/50 border-r-2 border-purple-500'
                    : isDarkMode
                    ? 'hover:bg-gray-800/50'
                    : 'hover:bg-gray-100/50'
                }`}
              >
                {/* Item Type Icon */}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium ${
                  suggestion.type === 'todo' ? 'bg-blue-100 text-blue-600' :
                  suggestion.type === 'goal' ? 'bg-green-100 text-green-600' :
                  suggestion.type === 'event' ? 'bg-purple-100 text-purple-600' :
                  suggestion.type === 'routine' ? 'bg-orange-100 text-orange-600' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {suggestion.type === 'todo' ? '✓' :
                   suggestion.type === 'goal' ? '🎯' :
                   suggestion.type === 'event' ? '📅' :
                   suggestion.type === 'routine' ? '🔄' :
                   '📝'}
                </div>
                
                {/* Item Details */}
                <div className="flex-1 min-w-0">
                  <div className={`font-bold truncate ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    {suggestion.title}
                  </div>
                  <div className={`text-xs flex items-center space-x-2 ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    <span className="capitalize">{suggestion.type}</span>
                    <span>•</span>
                    <span className="truncate">{suggestion.categoryId}</span>
                  </div>
                </div>
                
                {/* Selection Indicator */}
                {index === selectedSuggestionIndex && (
                  <div className={`text-xs px-2 py-1 rounded ${
                    isDarkMode ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-600'
                  }`}>
                    ↵
                  </div>
                )}
              </button>
            ))}
          </div>
          
          {/* Footer */}
          <div className={`px-4 py-2 border-t text-xs ${
            isDarkMode 
              ? 'border-gray-700/50 text-gray-500' 
              : 'border-gray-200/50 text-gray-400'
          }`}>
            ↑↓ Navigate • ↵ Select • Esc Cancel
          </div>
        </div>
      )}
    </div>
  );
});

ContextAwareInput.displayName = 'ContextAwareInput';

export default ContextAwareInput;