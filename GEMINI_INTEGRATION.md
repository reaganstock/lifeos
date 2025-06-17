# Gemini Integration Guide for lifeOS AI

## 🚀 Overview

Your lifeOS AI app now supports **DUAL AI INTEGRATION**:

1. **OpenRouter** - Access to 300+ models (Claude, GPT, etc.)
2. **Gemini Direct API** - Direct integration with Google's Gemini models

## 🔧 Setup Instructions

### Environment Variables Required

Create a `.env` file in your project root with these keys:

```bash
# OpenRouter API Key (for Claude, GPT, and other models)
REACT_APP_OPENROUTER_API_KEY=your_openrouter_key_here

# Google Gemini API Key (for direct Gemini access)
REACT_APP_GEMINI_API_KEY=your_gemini_key_here
```

### How to Get API Keys

**OpenRouter API Key:**
1. Visit [OpenRouter](https://openrouter.ai)
2. Sign up and go to [API Keys](https://openrouter.ai/settings/keys)
3. Create a new key and add credits ($5-10 to start)

**Gemini API Key:**
1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Create a new API key

## 🧠 Model Switching Logic

The app automatically routes your requests:

### Gemini Models (Direct API)
- `gemini-2.5-flash-preview-05-20` ⚡
- `gemini-1.5-pro` 🎯
- `gemini-1.5-flash` 💨

### OpenRouter Models
- `Claude Sonnet 4` (72.7% SWE-bench) 🏆
- `Claude Opus 4` (72.5% SWE-bench) 🚀
- `GPT-4.1` ⚡
- `DeepSeek R1` 🔮
- `Grok 3 Beta` 🤖

## 🎯 Feature Highlights

### Universal Function Calling
Both integrations support ALL life management functions:

```typescript
✅ universalCreate - Create any item type
✅ universalEdit - Edit any item type  
✅ universalDelete - Delete any item type
✅ universalSearch - Search all items
✅ smartEditNote - Advanced note editing
✅ createIntelligentCalendar - Bulk calendar creation
✅ parseRoutineToCalendar - Convert routines to events
✅ bulkOperations - Mass item management
```

### Smart Confirmation System
- AI suggests actions with context
- User confirms before execution
- Beautiful confirmation cards in UI
- Instant feedback on success/failure

### Natural Language Examples

**Creating Items:**
```
"Add 5 workout routines for next week"
"Create 20 study goals for this semester"
"Schedule Elon Musk's routine for the next month"
```

**Editing & Management:**
```
"Remove all asterisks from my notes"
"Complete all todos from yesterday"
"Delete events containing 'meeting'"
```

**Smart Calendar Operations:**
```
"Add 100 basketball events over the next 3 months"
"Create a Georgetown student schedule"
"Parse my morning routine into calendar events"
```

## 🔄 How Model Switching Works

```typescript
// In ChatService.ts
const isGeminiModel = currentModel.startsWith('gemini-') || 
                     currentModel.includes('gemini');

if (isGeminiModel) {
  // Route to Gemini Direct API
  result = await geminiService.processMessage(message, items, history);
} else {
  // Route to OpenRouter
  result = await aiActions.processMessage(message, items, history);
}
```

## 🎨 UI Integration

### Model Selector Component
- Tesla-style animated interface
- Real-time model switching
- Provider color coding
- Cost indicators
- Performance badges

### Function Confirmation Cards
- Beautiful glassmorphism design
- Action preview before execution
- One-click confirmation/cancellation
- Success/error feedback

## 🚀 Performance Features

### Gemini Optimizations
- Direct API calls (no proxy)
- Thinking mode disabled for speed
- Intelligent function detection
- Context-aware prompting

### OpenRouter Benefits
- 300+ model access
- Smart fallback routing
- Cost optimization
- High availability

## 🔧 Advanced Configuration

### Gemini Service Settings
```typescript
// In geminiService.ts
const requestBody = {
  contents: geminiMessages,
  generationConfig: {
    temperature: 0.7,
    maxOutputTokens: 4000,
    thinkingConfig: {
      thinkingBudget: 0 // Disabled for speed
    }
  }
};
```

### Function Calling
Both services use identical function schemas:
- `createItem` - Create todos, goals, events, routines, notes
- `updateItem` - Modify existing items
- `deleteItem` - Remove items
- `searchItems` - Find items
- `bulkOperations` - Mass operations

## 🎯 Real-World Use Cases

### Daily Life Management
```
User: "Add my morning routine to the calendar for next week"
AI: Creates 7 calendar events with routine steps
```

### Goal Tracking
```
User: "Create 10 fitness goals and track my progress"
AI: Creates goals with progress tracking
```

### Note Organization
```
User: "Clean up all my notes and remove formatting issues"
AI: Processes notes to remove asterisks, fix formatting
```

### Calendar Bulk Operations
```
User: "Delete all events for next Thursday"
AI: Finds and removes all Thursday events
```

## 🛠 Troubleshooting

### API Key Issues
```bash
# Check if keys are loaded
console.log('OpenRouter Key:', process.env.REACT_APP_OPENROUTER_API_KEY ? 'Set' : 'Missing');
console.log('Gemini Key:', process.env.REACT_APP_GEMINI_API_KEY ? 'Set' : 'Missing');
```

### Model Not Responding
1. Check API credits/quotas
2. Try switching models
3. Check browser console for errors
4. Verify internet connection

### Function Calls Not Working
1. Ensure function schemas match
2. Check localStorage permissions
3. Verify item structure
4. Review confirmation flow

## 🌟 Future Enhancements

### Planned Features
- **Gemini Live API** - Voice conversations
- **Multi-dashboard** - Multiple life seasons
- **Smart routing** - Auto model selection
- **Cost optimization** - Dynamic model switching
- **Performance monitoring** - Response time tracking

### Voice Integration (Coming Soon)
```typescript
// Gemini Live API integration
const liveSession = await geminiService.startLiveSession();
liveSession.on('message', handleVoiceCommand);
```

## 🎉 Success Metrics

Your lifeOS AI now provides:
- ⚡ **Instant AI responses** with dual API support
- 🎯 **100% function compatibility** across both services
- 🚀 **300+ model access** via OpenRouter
- 💎 **Premium Gemini features** via direct API
- 🎨 **Beautiful UI** with confirmation system
- 🧠 **Smart routing** between services

## 📱 Mobile & Desktop

The integration works seamlessly across:
- Desktop browsers
- Mobile web apps
- Progressive Web App (PWA)
- All screen sizes

Your lifeOS AI is now a **world-class AI-powered life management system**! 🚀✨ 