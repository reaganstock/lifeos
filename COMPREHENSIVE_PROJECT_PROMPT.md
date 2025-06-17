# 🎯 lifeOS AI - Comprehensive Project Prompt

## 🚀 Project Overview

**lifeOS AI** is a comprehensive life management application where users manage their entire life through natural language AI interactions. The app organizes everything around **Life Categories** (academics, business, sports, catholicism, etc.) and allows users to manage calendars, notes, goals, routines, and todos through AI commands.

**Core Philosophy**: "Become Cooler Than Cooper Flag" - A CEO-type, calisthenics-skilled, good-looking, socially capable individual through systematic life organization and goal achievement.

## 🏗️ Current Technical Architecture

### **Frontend Stack**
- **React + TypeScript + Tailwind CSS**
- **Real-time localStorage sync** via storage events
- **Web Audio API** for voice recording/transcription
- **Lucide Icons** for consistent UI
- **Responsive design** working on all devices

### **AI Integration (Dual System)**
- **Gemini Direct API** - Primary AI for natural language processing
- **OpenRouter** - 300+ models for enhanced AI capabilities
- **Function calling architecture** for AI CRUD operations
- **Intent detection** for smart command categorization

### **Data Model**
```typescript
interface Item {
  id: string;
  title: string;
  text: string;
  type: 'todo' | 'event' | 'note' | 'goal' | 'routine';
  completed: boolean;
  categoryId: string;
  createdAt: Date;
  updatedAt: Date;
  dueDate?: Date;
  metadata: {
    priority: 'low' | 'medium' | 'high';
    aiGenerated?: boolean;
    // ... other metadata
  };
}

interface Category {
  id: string;
  name: string;
  emoji: string;
  color: string;
  priority: number; // 0 = Foundation, 1-6 = Priority levels
}
```

### **Core Features**
1. **Dashboard** - Today's overview, schedule, todos, goals, motivation
2. **Global Todos** - AI-powered creation with category filtering
3. **Global Calendar** - Multiple views with AI event scheduling
4. **Global Goals** - Progress tracking with visual feedback
5. **Global Routines** - Habit tracking with streak counters
6. **Global Notes** - Text & voice notes with AI transcription
7. **Key Events** - Milestone tracking with timeline view
8. **Life Categories Manager** - Custom categories with priority system

## 🎯 MCP Integration Strategy

### **Current MCP Servers Configured**
```json
{
  "filesystem": "File operations and project management",
  "supabase": "Database operations with access token",
  "git": "Version control and code management", 
  "brave-search": "Web search for real-time information"
}
```

### **MCP Enhancement Opportunities**
1. **Real-time Database Operations** via Supabase MCP
2. **File-based Configuration** management via filesystem MCP
3. **Automated Code Management** via git MCP
4. **Research & Context** gathering via brave-search MCP

## 🚀 Development Requirements

### **Immediate Priorities**
1. **MCP-Powered Development** - Leverage all MCP servers for enhanced development
2. **Supabase Migration Planning** - Use Supabase MCP for database design
3. **RAG Implementation Research** - Use web search for n8n + vector database patterns
4. **Code Quality & Testing** - Systematic testing of all features

### **Key Development Patterns**
1. **Function Calling AI** - All AI interactions through structured function calls
2. **Real-time Sync** - Immediate updates across all components
3. **Progressive Enhancement** - Features work offline, enhanced online
4. **Voice-First Design** - Natural language commands for everything
5. **Category-Centric** - Everything belongs to a life category

## 🧠 AI Assistant Requirements

### **Core Capabilities Needed**
1. **Natural Language Processing**
   - Parse commands: "todo: finish Georgetown application by Friday"
   - Extract intent, priority, due dates, category assignment
   - Handle complex multi-part requests

2. **Context Awareness**
   - Understand user's life categories and priorities
   - Suggest relevant actions based on current time/context
   - Learn from user patterns and preferences

3. **Smart Suggestions**
   - Daily routine recommendations
   - Goal progress insights
   - Habit optimization suggestions
   - Cross-category connections

### **Voice Integration**
- **Real voice recording** via Web Audio API
- **AI transcription** with context understanding
- **Voice command processing** for hands-free operation
- **Voice note playback** with smart categorization

## 📊 Migration Strategy (localStorage → Supabase + RAG)

### **Phase 1: MCP-Enhanced Planning**
- Use **Supabase MCP** to design optimal database schema
- Use **filesystem MCP** to audit current data structures
- Use **git MCP** to track migration progress
- Use **brave-search MCP** to research RAG implementation patterns

### **Phase 2: Parallel Implementation**
- Maintain localStorage functionality while building Supabase integration
- Create abstraction layer for seamless switching
- Implement real-time sync across devices

### **Phase 3: RAG Enhancement**
- **n8n workflows** for AI processing
- **Vector database** (Pinecone/Supabase Vector) for context storage
- **Enhanced AI suggestions** based on user's actual data
- **Semantic search** across all user content

## 🎨 UI/UX Requirements

### **Design System**
- **Tesla-inspired** clean, modern interface
- **Color-coded categories** for visual organization
- **Smooth animations** and micro-interactions
- **Mobile-first** responsive design

### **Key Interactions**
- **Floating Action Button** for quick AI commands
- **Context menus** with Google Drive integration
- **Quick +3 categories** button for rapid setup
- **Progress visualizations** for goals and habits

## 🔧 Technical Specifications

### **Performance Requirements**
- **Sub-second AI responses** for common commands
- **Offline functionality** with sync when online
- **Real-time updates** across multiple devices
- **Efficient data caching** strategies

### **Security & Privacy**
- **User authentication** via Supabase Auth
- **Row Level Security** for multi-user data isolation
- **API key management** for AI services
- **Data encryption** for sensitive information

## 🧪 Testing Strategy

### **MCP-Enhanced Testing**
- Use **filesystem MCP** for test file management
- Use **git MCP** for test version tracking
- Use **Supabase MCP** for database testing scenarios
- Use **brave-search MCP** for integration testing research

### **Test Coverage Areas**
1. **AI Command Processing** - All natural language patterns
2. **Real-time Sync** - Cross-device data consistency
3. **Voice Integration** - Recording, transcription, playback
4. **Category Management** - CRUD operations and filtering
5. **Migration Safety** - Data integrity during Supabase migration

## 🎯 Success Metrics

### **User Experience**
- **< 1 second** AI command processing time
- **100% data integrity** during migration
- **Zero downtime** during Supabase transition
- **Voice command accuracy** > 95%

### **Technical Performance**
- **Real-time sync** working across devices
- **Offline functionality** maintained
- **RAG enhancement** providing relevant suggestions
- **MCP integration** streamlining development workflow

## 🚀 Development Approach

### **MCP-First Development**
1. **Leverage Supabase MCP** for all database operations
2. **Use filesystem MCP** for project organization
3. **Utilize git MCP** for version control automation
4. **Employ brave-search MCP** for research and problem-solving

### **Iterative Enhancement**
1. **Start with current features** working perfectly
2. **Add Supabase integration** with fallback mechanisms
3. **Implement RAG capabilities** for enhanced AI
4. **Optimize performance** and user experience

## 💡 Key Innovation Areas

### **AI-Powered Life Management**
- **Natural language everything** - No forms, just conversation
- **Contextual suggestions** based on user's actual data
- **Cross-category insights** connecting different life areas
- **Proactive recommendations** for optimal life optimization

### **MCP-Enhanced Development**
- **Database-first design** using Supabase MCP
- **Automated testing** via multiple MCP servers
- **Research-driven decisions** using web search MCP
- **Code quality maintenance** via git MCP

---

**This prompt defines the complete lifeOS AI project with MCP integration strategy. Use this as the foundation for all development decisions and feature implementations.** 