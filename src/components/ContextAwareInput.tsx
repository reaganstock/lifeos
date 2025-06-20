import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Item } from '../types';
import { showCopyFeedback } from '../utils/clipboard';

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

interface ContextTag {
  id: string;
  name: string;
  type: string;
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
  const [contextTags, setContextTags] = useState<ContextTag[]>([]);
  const suggestionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
    blur: () => textareaRef.current?.blur()
  }));

  // Scroll selected suggestion into view
  const scrollToSelectedItem = (index: number) => {
    const selectedElement = suggestionRefs.current[index];
    if (selectedElement) {
      selectedElement.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest'
      });
    }
  };

  // Convert items to suggestions with improved filtering
  const createSuggestions = (query: string): ContextSuggestion[] => {
    if (!query.trim()) {
      // Show recent items if no query
      return items
        .slice(0, 8)
        .map(item => ({
          id: item.id,
          title: item.title,
          type: item.type,
          categoryId: item.categoryId,
          displayText: item.title, // Clean display without @
          mentionText: `@${item.title}`
        }));
    }

    // Enhanced filtering with partial matches and prioritization
    const filteredItems = items
      .filter(item => {
        const searchTerm = query.toLowerCase();
        const titleMatch = item.title.toLowerCase().includes(searchTerm);
        const textMatch = item.text?.toLowerCase().includes(searchTerm);
        const wordMatch = item.title.toLowerCase().split(' ').some(word => 
          word.startsWith(searchTerm)
        );
        return titleMatch || textMatch || wordMatch;
      })
      .sort((a, b) => {
        const searchTerm = query.toLowerCase();
        // Prioritize exact title matches
        const aExact = a.title.toLowerCase().startsWith(searchTerm);
        const bExact = b.title.toLowerCase().startsWith(searchTerm);
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        
        // Then prioritize title contains over text contains
        const aTitle = a.title.toLowerCase().includes(searchTerm);
        const bTitle = b.title.toLowerCase().includes(searchTerm);
        if (aTitle && !bTitle) return -1;
        if (!aTitle && bTitle) return 1;
        
        return 0;
      })
      .slice(0, 8)
      .map(item => ({
        id: item.id,
        title: item.title,
        type: item.type,
        categoryId: item.categoryId,
        displayText: item.title, // Clean display
        mentionText: `@${item.title}`
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
        // Reset refs array when suggestions change
        suggestionRefs.current = new Array(newSuggestions.length).fill(null);
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
    
    if (foundItem) {
      e.preventDefault();
      const cursorPosition = textareaRef.current?.selectionStart || 0;
      const beforeCursor = value.substring(0, cursorPosition);
      const afterCursor = value.substring(cursorPosition);
      const mentionText = `@${foundItem.title}`;
      const newValue = `${beforeCursor}${mentionText}${afterCursor}`;
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

  // Handle suggestion selection - add as context tag
  const selectSuggestion = (suggestion: ContextSuggestion) => {
    console.log('🎯 Selecting suggestion:', suggestion.title);
    
    // Add to context tags if not already present
    if (!contextTags.find(tag => tag.id === suggestion.id)) {
      const newTag: ContextTag = {
        id: suggestion.id,
        name: suggestion.title,
        type: suggestion.type
      };
      setContextTags(prev => [...prev, newTag]);
    }
    
    // Remove the @ and query from input
    if (mentionStart >= 0) {
      const beforeMention = value.substring(0, mentionStart);
      const afterMention = value.substring(mentionStart + currentQuery.length + 1);
      const newValue = `${beforeMention}${afterMention}`;
      onChange(newValue);
      
      // Set cursor position where @ was
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.setSelectionRange(mentionStart, mentionStart);
          textareaRef.current.focus();
        }
      }, 0);
    }
    
    setShowSuggestions(false);
  };

  // Remove context tag
  const removeContextTag = (tagId: string) => {
    setContextTags(prev => prev.filter(tag => tag.id !== tagId));
  };

  // Handle keyboard navigation in suggestions
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSuggestions && suggestions.length > 0) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedSuggestionIndex((prev) => {
            const newIndex = prev < suggestions.length - 1 ? prev + 1 : 0;
            // Scroll the selected item into view
            setTimeout(() => scrollToSelectedItem(newIndex), 0);
            return newIndex;
          });
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedSuggestionIndex((prev) => {
            const newIndex = prev > 0 ? prev - 1 : suggestions.length - 1;
            // Scroll the selected item into view
            setTimeout(() => scrollToSelectedItem(newIndex), 0);
            return newIndex;
          });
          break;
        case 'Tab':
        case 'Enter':
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            selectSuggestion(suggestions[selectedSuggestionIndex]);
            return;
          } else if (e.key === 'Tab') {
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
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      // Don't close if clicking inside the dropdown or the textarea
      if (target.closest('.suggestions-dropdown') || target === textareaRef.current) {
        return;
      }
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
      bottom: textarea.offsetHeight + 60, // 60px above the input (higher up to avoid tab bar)
      left: Math.min(currentLineLength * charWidth, 200) // Prevent overflow
    };
  };

  const suggestionPosition = getSuggestionPosition();

  return (
    <div className="relative">
      {/* Context Tags Display - Positioned to prevent layout shifts */}
      <div className={`absolute -top-12 left-0 right-0 flex flex-wrap gap-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} ${contextTags.length > 0 ? 'mb-2' : ''}`}>
        {contextTags.map((tag) => (
            <div
              key={tag.id}
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${
                isDarkMode
                  ? 'bg-purple-500/20 border-purple-400/30 text-purple-300'
                  : 'bg-purple-100/80 border-purple-300/50 text-purple-700'
              }`}
            >
              <span className="opacity-60">{tag.type}</span>
              <span>{tag.name}</span>
              <button
                onClick={() => {
                  const item = items.find(item => item.id === tag.id);
                  if (item) {
                    navigator.clipboard.writeText(item.text || item.title);
                    showCopyFeedback();
                  }
                }}
                className={`ml-1 hover:bg-blue-500/20 rounded-full w-4 h-4 flex items-center justify-center text-xs ${
                  isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-500 hover:text-blue-600'
                }`}
                title="Copy content"
              >
                📋
              </button>
              <button
                onClick={() => removeContextTag(tag.id)}
                className={`ml-1 hover:bg-red-500/20 rounded-full w-4 h-4 flex items-center justify-center text-xs ${
                  isDarkMode ? 'text-red-400 hover:text-red-300' : 'text-red-500 hover:text-red-600'
                }`}
                title="Remove context"
              >
                ×
              </button>
            </div>
        ))}
      </div>
      
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder={placeholder}
        className={`${className} context-aware-input relative z-20`}
        style={{
          ...style,
          color: isDarkMode ? '#ffffff' : '#1f2937',
        }}
        rows={rows}
      />
      
      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          className={`suggestions-dropdown absolute z-20 min-w-80 max-w-96 rounded-2xl shadow-2xl border backdrop-blur-xl ${
            isDarkMode
              ? 'bg-gray-900/98 border-gray-600/50'
              : 'bg-white/98 border-gray-300/50'
          }`}
          style={{
            bottom: suggestionPosition.bottom,
            left: suggestionPosition.left,
            maxHeight: '200px'
          }}
        >
          {/* Header */}
          <div className={`px-5 py-3 border-b text-xs font-semibold tracking-wide ${
            isDarkMode 
              ? 'border-gray-700/30 text-gray-300' 
              : 'border-gray-300/40 text-gray-600'
          }`}>
            Add Context ({suggestions.length} found)
          </div>
          
          {/* Suggestions List */}
          <div 
            className="py-1 max-h-48 overflow-y-auto"
            onWheel={(e) => e.stopPropagation()}
            onScroll={(e) => e.stopPropagation()}
          >
            {suggestions.map((suggestion, index) => (
              <button
                key={suggestion.id}
                ref={(el) => suggestionRefs.current[index] = el}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  selectSuggestion(suggestion);
                }}
                className={`w-full px-5 py-4 mx-1 my-0.5 rounded-xl text-left transition-all duration-200 flex items-center space-x-3 focus:outline-none ${
                  index === selectedSuggestionIndex
                    ? isDarkMode
                      ? 'bg-purple-500/25 border border-purple-400/40 shadow-lg shadow-purple-500/10'
                      : 'bg-purple-100/70 border border-purple-400/40 shadow-lg shadow-purple-500/10'
                    : isDarkMode
                    ? 'hover:bg-gray-700/50 focus:bg-gray-700/50 border border-transparent'
                    : 'hover:bg-gray-100/70 focus:bg-gray-100/70 border border-transparent'
                }`}
              >
                {/* Item Type Icon */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-medium shadow-sm ${
                  suggestion.type === 'todo' ? 'bg-blue-500/10 text-blue-600 border border-blue-200/50' :
                  suggestion.type === 'goal' ? 'bg-green-500/10 text-green-600 border border-green-200/50' :
                  suggestion.type === 'event' ? 'bg-purple-500/10 text-purple-600 border border-purple-200/50' :
                  suggestion.type === 'routine' ? 'bg-orange-500/10 text-orange-600 border border-orange-200/50' :
                  'bg-gray-500/10 text-gray-600 border border-gray-200/50'
                }`}>
                  {suggestion.type === 'todo' ? '✓' :
                   suggestion.type === 'goal' ? '🎯' :
                   suggestion.type === 'event' ? '📅' :
                   suggestion.type === 'routine' ? '🔄' :
                   '📝'}
                </div>
                
                {/* Item Details */}
                <div className="flex-1 min-w-0">
                  <div className={`font-semibold text-sm truncate ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    {suggestion.displayText}
                  </div>
                  <div className={`text-xs mt-0.5 font-medium ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    <span className="capitalize">{suggestion.type}</span>
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