import { Item, Category } from '../types';

export interface CategoryContext {
  items: Item[];
  category: Category;
  contextLinks: Array<{
    id: string;
    title: string;
    url: string;
    type: 'link' | 'drive' | 'document';
    content?: string; // Extracted/parsed content
  }>;
}

export interface RAGResponse {
  response: string;
  sources: Array<{
    type: 'item' | 'link';
    title: string;
    excerpt: string;
    itemType?: string;
  }>;
  confidence: number;
}



export class CategoryRAGService {
  
  // Track conversation history for better context (like AIAssistant does)
  private static conversationHistory: Map<string, Array<{ role: 'user' | 'assistant'; content: string }>> = new Map();
  
  /**
   * Process a question within a specific category context with specialized read-only analysis
   */
  static async askQuestion(
    question: string,
    categoryId: string,
    categoryContext: CategoryContext,
    sessionId: string = 'default'
  ): Promise<RAGResponse> {
    try {
      console.log('🧠 CategoryRAG: Processing intelligent question for category:', categoryId);
      
      // 1. Get conversation history for this category session
      const historyKey = `${categoryId}-${sessionId}`;
      const history = this.conversationHistory.get(historyKey) || [];
      
      // 2. Build enhanced context for comprehensive analysis
      const relevantItems = await this.searchCategoryItems(question, categoryContext);
      const relevantLinks = await this.searchContextLinks(question, categoryContext.contextLinks);
      const contextString = this.buildEnhancedContextString(relevantItems, relevantLinks, categoryContext);
      
      // 3. Create specialized system prompt for category knowledge
      const systemPrompt = this.buildCategoryKnowledgePrompt(categoryContext, contextString);
      
      // 4. Build conversation messages with specialized prompt
      const messages = [
        { role: 'system', content: systemPrompt },
        ...history.map(h => ({ role: h.role, content: h.content })),
        { role: 'user', content: question }
      ];
      
      // 5. Call Gemini directly without function calling tools for pure analysis
      const response = await this.makeDirectGeminiCall(messages);
      
      // 6. Update conversation history
      const newHistory = [
        ...history,
        { role: 'user' as const, content: question },
        { role: 'assistant' as const, content: response }
      ];
      
      // Keep only last 8 messages to avoid context bloat
      if (newHistory.length > 8) {
        newHistory.splice(0, newHistory.length - 8);
      }
      
      this.conversationHistory.set(historyKey, newHistory);
      
      // 7. Generate sources and confidence
      const sources = this.extractSources(relevantItems, relevantLinks);
      const confidence = this.calculateConfidence(relevantItems, relevantLinks, question);

      return {
        response,
        sources,
        confidence
      };

    } catch (error) {
      console.error('❌ CategoryRAG Error:', error);
      return {
        response: 'Sorry, I encountered an error processing your question. Please try again.',
        sources: [],
        confidence: 0
      };
    }
  }

  /**
   * Build specialized system prompt for category knowledge that emphasizes analysis over action
   */
  private static buildCategoryKnowledgePrompt(categoryContext: CategoryContext, contextString: string): string {
    const categoryName = categoryContext.category.name;
    const categoryIcon = categoryContext.category.icon;
    const itemCount = categoryContext.items.length;
    
    return `You are a specialized knowledge assistant for the "${categoryName}" ${categoryIcon} category. You are a READ-ONLY advisor that provides deep analysis and insights.

CRITICAL RESTRICTIONS:
- You CANNOT create, modify, or delete any items
- You CANNOT perform any actions - you are purely analytical
- You can ONLY provide insights, analysis, and recommendations based on existing data
- Never suggest that you can create items or make changes to the system

YOUR EXPERTISE:
You excel at providing comprehensive, thoughtful analysis including:

ANALYTICAL CAPABILITIES:
- Pattern recognition across ${itemCount} items in this category
- Progress tracking and trend analysis
- Priority assessment and strategic recommendations
- Educational support including study guides and quizzes
- Workflow optimization and productivity insights
- Goal achievement strategies and milestone planning

EDUCATIONAL SUPPORT:
- Create detailed study guides from notes and materials
- Generate comprehensive quizzes and practice questions
- Develop structured learning schedules and study plans
- Break down complex topics into digestible sections
- Provide memory techniques and learning strategies

STRATEGIC PLANNING:
- Analyze priority levels and urgency factors
- Recommend optimal scheduling and time management
- Identify dependencies and logical task sequences
- Suggest workflow improvements and efficiency gains
- Provide goal-setting guidance and progress tracking methods

RESPONSE GUIDELINES:
- Provide detailed, comprehensive responses (200+ words when appropriate)
- Use clear, professional language without asterisks (*) or star formatting
- Structure responses with clear headers and sections
- Include specific references to user data when relevant
- Focus on actionable insights and practical recommendations
- Provide in-depth analysis rather than surface-level answers

CONTEXT DATA AVAILABLE:
${contextString}

Remember: You are an analytical expert, not an action-taker. Provide deep insights and comprehensive recommendations based on the user's existing data.`;
  }

  /**
   * Make direct call to Gemini API without function calling tools
   */
  private static async makeDirectGeminiCall(messages: any[]): Promise<string> {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.REACT_APP_GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: messages.slice(1).map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
          })),
          systemInstruction: {
            parts: [{ text: messages[0].content }]
          },
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH", 
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      const textPart = data.candidates?.[0]?.content?.parts?.find((part: any) => part.text);
      return textPart?.text || 'Unable to generate response.';

    } catch (error) {
      console.error('Direct Gemini call error:', error);
      throw error;
    }
  }

  /**
   * Build enhanced context string with comprehensive item details
   */
  private static buildEnhancedContextString(
    items: Item[],
    links: CategoryContext['contextLinks'],
    categoryContext: CategoryContext
  ): string {
    const category = categoryContext.category;
    let context = `CATEGORY: ${category.name} ${category.icon}\n`;
    context += `TOTAL ITEMS: ${categoryContext.items.length}\n`;
    context += `RELEVANT ITEMS FOR THIS QUERY: ${items.length}\n\n`;

    if (items.length > 0) {
      context += "DETAILED ITEM ANALYSIS:\n";
      
      items.forEach((item, index) => {
        context += `\n${index + 1}. ${item.type.toUpperCase()}: ${item.title}\n`;
        
        // Enhanced context based on item type
        if (item.type === 'todo') {
          context += `   Status: ${item.completed ? 'COMPLETED' : 'PENDING'}\n`;
          if (item.dueDate) {
            const isOverdue = new Date(item.dueDate) < new Date();
            const isDueToday = new Date(item.dueDate).toDateString() === new Date().toDateString();
            context += `   Due: ${item.dueDate instanceof Date ? item.dueDate.toLocaleDateString() : item.dueDate}`;
            if (isOverdue && !item.completed) context += " (OVERDUE)";
            if (isDueToday && !item.completed) context += " (DUE TODAY)";
            context += "\n";
          }
          if (item.metadata?.priority) {
            context += `   Priority: ${item.metadata.priority.toUpperCase()}\n`;
          }
        } else if (item.type === 'goal') {
          const progress = item.metadata?.progress || 0;
          context += `   Progress: ${progress}% complete\n`;
          if (item.metadata?.target) {
            context += `   Target: ${item.metadata.target}\n`;
          }
          if (progress >= 100) {
            context += `   Status: COMPLETED\n`;
          } else if (progress >= 75) {
            context += `   Status: NEAR COMPLETION\n`;
          } else if (progress >= 50) {
            context += `   Status: GOOD PROGRESS\n`;
          } else if (progress > 0) {
            context += `   Status: IN PROGRESS\n`;
          } else {
            context += `   Status: NOT STARTED\n`;
          }
        } else if (item.type === 'event') {
          if (item.dateTime) {
            const eventDate = new Date(item.dateTime);
            const isPast = eventDate < new Date();
            const isToday = eventDate.toDateString() === new Date().toDateString();
            context += `   Date/Time: ${eventDate.toLocaleDateString()} at ${eventDate.toLocaleTimeString()}`;
            if (isPast) context += " (PAST EVENT)";
            if (isToday) context += " (TODAY)";
            context += "\n";
          }
          if (item.metadata?.location) {
            context += `   Location: ${item.metadata.location}\n`;
          }
        } else if (item.type === 'routine') {
          const frequency = item.metadata?.frequency || 'unknown';
          const currentStreak = item.metadata?.currentStreak || 0;
          const completedToday = item.metadata?.completedToday || false;
          context += `   Frequency: ${frequency}\n`;
          context += `   Current Streak: ${currentStreak} days\n`;
          context += `   Today's Status: ${completedToday ? 'COMPLETED' : 'PENDING'}\n`;
        } else if (item.type === 'note' || item.type === 'voiceNote') {
          if (item.type === 'voiceNote') {
            context += `   Type: Voice Note with transcription\n`;
          }
          context += `   Created: ${new Date(item.createdAt).toLocaleDateString()}\n`;
        }
        
        if (item.text && item.text.trim()) {
          const preview = item.text.length > 200 ? item.text.substring(0, 200) + "..." : item.text;
          context += `   Content: ${preview}\n`;
        }
        
        context += `   Last Updated: ${new Date(item.updatedAt).toLocaleDateString()}\n`;
      });
    }

    if (links.length > 0) {
      context += "\n\nRELEVANT CONTEXT LINKS:\n";
      links.forEach((link, index) => {
        context += `${index + 1}. ${link.title} (${link.type})\n`;
        context += `   URL: ${link.url}\n`;
        if (link.content) {
          const preview = link.content.length > 150 ? link.content.substring(0, 150) + "..." : link.content;
          context += `   Content Preview: ${preview}\n`;
        }
      });
    }

    return context;
  }
  
  /**
   * Clear conversation history for a category session
   */
  static clearConversationHistory(categoryId: string, sessionId: string = 'default'): void {
    const historyKey = `${categoryId}-${sessionId}`;
    this.conversationHistory.delete(historyKey);
    console.log(`🧹 CategoryRAG: Cleared conversation history for ${historyKey}`);
  }

  /**
   * Search for relevant items within the category using enhanced keyword matching
   */
  private static async searchCategoryItems(
    question: string, 
    context: CategoryContext
  ): Promise<Item[]> {
    const query = question.toLowerCase();
    const items = context.items.filter(item => item.categoryId === context.category.id);
    
    console.log(`🔍 RAG: Searching ${items.length} items in category`);
    
    // Enhanced scoring algorithm
    const scoredItems = items.map(item => {
      let score = 0;
      const title = item.title.toLowerCase();
      const text = item.text.toLowerCase();
      
      // Exact phrase matching (highest score)
      if (title.includes(query) || text.includes(query)) {
        score += 10;
      }
      
      // Word-based matching
      const queryWords = query.split(' ').filter(word => word.length > 2);
      queryWords.forEach(word => {
        if (title.includes(word)) score += 3;
        if (text.includes(word)) score += 2;
      });
      
             // Recent items get bonus (more nuanced scoring)
       const daysSinceUpdate = (Date.now() - item.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
       if (daysSinceUpdate < 1) score += 3;     // Very recent (today)
       else if (daysSinceUpdate < 3) score += 2; // Recent (last 3 days)
       else if (daysSinceUpdate < 7) score += 1; // Somewhat recent (last week)
       
       // Voice notes get slight bonus for having rich content
       if (item.type === 'voiceNote') score += 1;
      
      // Type-specific bonuses
      if (query.includes('todo') && item.type === 'todo') score += 2;
      if (query.includes('goal') && item.type === 'goal') score += 2;
      if (query.includes('note') && (item.type === 'note' || item.type === 'voiceNote')) score += 2;
      if (query.includes('event') && item.type === 'event') score += 2;
      if (query.includes('routine') && item.type === 'routine') score += 2;
      
      return { item, score };
    });
    
    // Return top 5 most relevant items
    const relevantItems = scoredItems
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ item }) => item);
    
    console.log(`✅ RAG: Found ${relevantItems.length} relevant items`);
    return relevantItems;
  }

  /**
   * Search context links for relevant information
   */
  private static async searchContextLinks(
    question: string,
    contextLinks: CategoryContext['contextLinks']
  ): Promise<CategoryContext['contextLinks']> {
    const query = question.toLowerCase();
    
    const relevantLinks = contextLinks.filter(link => {
      const title = link.title.toLowerCase();
      const content = link.content?.toLowerCase() || '';
      
      // Check title and content for keywords
      const queryWords = query.split(' ').filter(word => word.length > 2);
      return queryWords.some(word => 
        title.includes(word) || content.includes(word)
      );
    });
    
    console.log(`🔗 RAG: Found ${relevantLinks.length} relevant links`);
    return relevantLinks.slice(0, 3); // Limit to top 3 links
  }

  /**
   * Build context string for AI prompt
   */
  private static buildContextString(
    items: Item[],
    links: CategoryContext['contextLinks'],
    category: Category
  ): string {
    let context = `Category: ${category.name} ${category.icon}\n\n`;
    
         // Add items context
     if (items.length > 0) {
       context += 'RELEVANT ITEMS:\n';
       items.forEach((item, index) => {
         context += `${index + 1}. [${item.type.toUpperCase()}] ${item.title}\n`;
         
         // Add description for all items
         if (item.text) {
           context += `   Description: ${item.text.substring(0, 200)}${item.text.length > 200 ? '...' : ''}\n`;
         }
         
         // Type-specific details
         if (item.type === 'todo') {
           context += `   Status: ${item.completed ? 'COMPLETED' : 'PENDING'}\n`;
           if (item.dueDate) {
             const isOverdue = new Date(item.dueDate) < new Date();
             context += `   Due Date: ${item.dueDate.toLocaleDateString()}${isOverdue ? ' (OVERDUE)' : ''}\n`;
           }
           if (item.metadata?.priority) {
             context += `   Priority: ${item.metadata.priority.toUpperCase()}\n`;
           }
         }
         
         if (item.type === 'goal' && item.metadata?.progress !== undefined) {
           context += `   Progress: ${item.metadata.progress}% ${item.metadata.progress >= 100 ? '(COMPLETED)' : '(IN PROGRESS)'}\n`;
           if (item.metadata.target) {
             context += `   Target: ${item.metadata.target}\n`;
           }
         }
         
         if (item.type === 'event' && item.dateTime) {
           const eventDate = new Date(item.dateTime);
           const now = new Date();
           const isPast = eventDate < now;
           const isToday = eventDate.toDateString() === now.toDateString();
           context += `   Date & Time: ${eventDate.toLocaleDateString()} at ${eventDate.toLocaleTimeString()}`;
           if (isPast) context += ' (PAST EVENT)';
           else if (isToday) context += ' (TODAY)';
           else context += ' (UPCOMING)';
           context += '\n';
           if (item.metadata?.location) {
             context += `   Location: ${item.metadata.location}\n`;
           }
         }
         
         if (item.type === 'routine') {
           if (item.metadata?.frequency) {
             context += `   Frequency: ${item.metadata.frequency}\n`;
           }
           if (item.metadata?.duration) {
             context += `   Duration: ${item.metadata.duration} minutes\n`;
           }
           if (item.metadata?.currentStreak !== undefined) {
             context += `   Current Streak: ${item.metadata.currentStreak} days\n`;
           }
           if (item.metadata?.bestStreak !== undefined) {
             context += `   Best Streak: ${item.metadata.bestStreak} days\n`;
           }
           context += `   Completed Today: ${item.metadata?.completedToday ? 'YES' : 'NO'}\n`;
         }
         
         if (item.type === 'note' || item.type === 'voiceNote') {
           if (item.type === 'voiceNote') {
             context += `   Type: Voice Note with transcription\n`;
           }
           context += `   Created: ${item.createdAt.toLocaleDateString()}\n`;
           context += `   Last Updated: ${item.updatedAt.toLocaleDateString()}\n`;
         }
         
         context += '\n';
       });
     }
    
    // Add links context
    if (links.length > 0) {
      context += 'RELEVANT RESOURCES:\n';
      links.forEach((link, index) => {
        context += `${index + 1}. [${link.type.toUpperCase()}] ${link.title}\n`;
        context += `   URL: ${link.url}\n`;
        if (link.content) {
          context += `   Content: ${link.content.substring(0, 300)}${link.content.length > 300 ? '...' : ''}\n`;
        }
        context += '\n';
      });
    }
    
    return context;
  }

  /**
   * Extract source references for citation
   */
  private static extractSources(
    items: Item[],
    links: CategoryContext['contextLinks']
  ): RAGResponse['sources'] {
    const sources: RAGResponse['sources'] = [];
    
    // Add item sources
    items.forEach(item => {
      sources.push({
        type: 'item',
        title: item.title,
        excerpt: item.text.substring(0, 100) + (item.text.length > 100 ? '...' : ''),
        itemType: item.type
      });
    });
    
    // Add link sources
    links.forEach(link => {
      sources.push({
        type: 'link',
        title: link.title,
        excerpt: link.content ? 
          link.content.substring(0, 100) + (link.content.length > 100 ? '...' : '') :
          'External resource'
      });
    });
    
    return sources;
  }

     /**
    * Calculate confidence score based on available context
    */
   private static calculateConfidence(
     items: Item[],
     links: CategoryContext['contextLinks'],
     question: string
   ): number {
     let confidence = 0;
     
     // Base confidence from items (different weights for different types)
     const itemTypeWeights = {
       'note': 25,      // Notes have rich text content
       'voiceNote': 25, // Voice notes have transcriptions
       'goal': 20,      // Goals have progress data
       'todo': 15,      // Todos have status and due dates
       'event': 15,     // Events have date/time info
       'routine': 20    // Routines have streak data
     };
     
     items.forEach(item => {
       const weight = itemTypeWeights[item.type] || 15;
       confidence += weight;
     });
     
     // Cap item confidence at 70
     confidence = Math.min(confidence, 70);
     
     // Bonus for recent items (they're more relevant)
     const recentItems = items.filter(item => {
       const daysSinceUpdate = (Date.now() - item.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
       return daysSinceUpdate < 7;
     });
     confidence += Math.min(recentItems.length * 5, 15);
     
     // Bonus for links with content
     const linksWithContent = links.filter(link => link.content);
     confidence += Math.min(linksWithContent.length * 10, 15);
     
     // Question complexity factor (simpler questions are easier to answer accurately)
     const questionWords = question.split(' ').length;
     if (questionWords <= 5) confidence += 10;
     else if (questionWords <= 10) confidence += 5;
     
     // Bonus for specific question types that we handle well
     const questionLower = question.toLowerCase();
     if (questionLower.includes('progress') || questionLower.includes('goal')) confidence += 5;
     if (questionLower.includes('due') || questionLower.includes('deadline')) confidence += 5;
     if (questionLower.includes('routine') || questionLower.includes('streak')) confidence += 5;
     if (questionLower.includes('event') || questionLower.includes('meeting')) confidence += 5;
     
     return Math.min(confidence, 100);
   }

     /**
    * Extract content from Google Drive or other links
    * This is a placeholder for future implementation with proper APIs
    */
   static async extractContentFromLink(url: string, type: string): Promise<string> {
     try {
       // For now, just return basic link info since we're focusing on item context
       if (type === 'drive') {
         return `Google Drive link: ${url}`;
       }
       
       return `External link: ${url}`;
       
     } catch (error) {
       console.error('Failed to extract content from link:', error);
       return '';
     }
   }

  /**
   * Enhanced search that combines existing search functions with RAG
   */
  static async enhancedCategorySearch(
    query: string,
    categoryId: string,
    items: Item[]
  ): Promise<{
    items: Item[];
    summary: string;
  }> {
    // Use existing search infrastructure
    const categoryItems = items.filter(item => item.categoryId === categoryId);
    
    // Enhanced scoring with semantic understanding
    const scoredItems = categoryItems.map(item => {
      let score = 0;
      const title = item.title.toLowerCase();
      const text = item.text.toLowerCase();
      const queryLower = query.toLowerCase();
      
      // Direct matches
      if (title.includes(queryLower)) score += 5;
      if (text.includes(queryLower)) score += 3;
      
      // Word-based scoring
      const queryWords = queryLower.split(' ').filter(word => word.length > 2);
      queryWords.forEach(word => {
        if (title.includes(word)) score += 2;
        if (text.includes(word)) score += 1;
      });
      
      // Recency bonus
      const daysSinceUpdate = (Date.now() - item.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate < 7) score += 1;
      
      return { item, score };
    });
    
    const results = scoredItems
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ item }) => item);
    
    // Generate summary
    const summary = this.generateSearchSummary(query, results, categoryId);
    
    return { items: results, summary };
  }

  /**
   * Generate a helpful summary of search results
   */
  private static generateSearchSummary(
    query: string,
    results: Item[],
    categoryId: string
  ): string {
    if (results.length === 0) {
      return `No items found for "${query}" in this category.`;
    }
    
    const types = Array.from(new Set(results.map(item => item.type)));
    const typeBreakdown = types.map(type => {
      const count = results.filter(item => item.type === type).length;
      return `${count} ${type}${count === 1 ? '' : 's'}`;
    }).join(', ');
    
    return `Found ${results.length} items matching "${query}": ${typeBreakdown}`;
  }
} 