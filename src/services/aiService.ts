// Backward compatibility stub for existing components
// Most functionality has been moved to ChatService

import OpenAI from 'openai';
import { Item, Category } from '../types';

// OpenAI client instance
const getOpenAIClient = () => {
  const apiKey = process.env.REACT_APP_OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OpenAI API key not found. Please set REACT_APP_OPENAI_API_KEY environment variable.');
  }

  return new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true // Note: In production, use server-side proxy
  });
};

export class AIService {
  // Simple stub methods for backward compatibility
  async processCommand(command: string, defaultCategoryId: string): Promise<Item | null> {
    try {
      const response = await getOpenAIClient().chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are an AI assistant that helps with personal life management. Users will give you commands in natural language to add items (goals, todos, events, etc.) to their life management system.

Your task is to parse the command and return a JSON object with the following structure:
{
  "title": "string - clear, concise title",
  "description": "string - optional detailed description", 
  "type": "goal" | "todo" | "event" | "note",
  "priority": "low" | "medium" | "high",
  "dueDate": "YYYY-MM-DD" | null,
  "categoryId": "string - use the provided default or infer from context"
}

Categories context:
- self-regulation: habits, routines, discipline, time management
- gym-calisthenics: fitness, workouts, exercises, physical training  
- mobile-apps: app development, coding, business, entrepreneurship
- catholicism: faith, prayer, Bible study, spiritual goals
- social-charisma: social skills, relationships, networking, dating
- content: content creation, social media, educational content

Guidelines:
- Be concise but descriptive in titles
- Infer priority based on urgency words (urgent=high, important=medium, default=low)
- Parse dates naturally (tomorrow, next week, etc.)
- If no clear type, default to "todo"
- Return null if the command is unclear or not actionable

Examples:
"Add gym workout tomorrow" -> {"title": "Gym Workout", "type": "todo", "priority": "medium", "dueDate": "tomorrow"}
"Goal: Get into Georgetown" -> {"title": "Get into Georgetown", "type": "goal", "priority": "high"}
"Urgent: finish app prototype" -> {"title": "Finish app prototype", "type": "todo", "priority": "high"}

Return only valid JSON, no explanations.`
          },
          {
            role: 'user',
            content: command
          }
        ],
        temperature: 0.1, // Low temperature for consistent parsing
        max_tokens: 200
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from AI');
      }

      // Parse the JSON response
      const parsed = JSON.parse(content);
      
      // Validate required fields
      if (!parsed.title) {
        throw new Error('AI response missing required title field');
      }

      // Create the item with defaults
      const item: Item = {
        id: Date.now().toString(),
        title: parsed.title,
        text: parsed.description || '',
        type: parsed.type || 'todo',
        completed: false,
        categoryId: parsed.categoryId || defaultCategoryId,
        createdAt: new Date(),
        updatedAt: new Date(),
        dueDate: parsed.dueDate ? new Date(parsed.dueDate) : undefined,
        metadata: {
          priority: parsed.priority || 'medium',
          aiGenerated: true
        }
      };

      return item;

    } catch (error) {
      console.error('AI processing failed:', error);
      
      // Fallback: create a simple todo item
      const fallbackItem: Item = {
        id: Date.now().toString(),
        title: command,
        text: '',
        type: 'todo',
        completed: false,
        categoryId: defaultCategoryId,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          priority: 'medium',
          aiGenerated: true
        }
      };

      return fallbackItem;
    }
  }

  detectIntent(message: string): any {
    return { intent: 'unknown', confidence: 0 };
  }

  /**
   * Transcribe audio using voice service (backward compatibility)
   * @deprecated Use voiceService.transcribeAudio directly
   */
  async transcribeAudio(audioBlob: Blob): Promise<string> {
    // This is a simple mock for backward compatibility
    // In practice, you should use voiceService directly
    return "Voice note recorded";
  }

  async suggestCategoryItems(categoryId: string): Promise<any[]> {
    // Mock suggestions for now
    return [];
  }

  /**
   * Generate AI suggestions based on user context
   */
  async generateSuggestions(context: {
    recentItems: Item[];
    categories: Category[];
    timeOfDay: 'morning' | 'afternoon' | 'evening';
  }): Promise<string[]> {
    try {
      const response = await getOpenAIClient().chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are a life management assistant. Based on the user's recent activities and current time, suggest 3-5 helpful actions they could take. Keep suggestions concise (under 50 characters each).

Focus on:
- Georgetown application progress
- Fitness and calisthenics training
- App development and entrepreneurship  
- Faith and spiritual growth
- Social connections and charisma
- Content creation

Recent context: ${JSON.stringify(context.recentItems.slice(0, 5))}
Time: ${context.timeOfDay}

Return only an array of suggestion strings, no explanations.`
          }
        ],
        temperature: 0.7,
        max_tokens: 150
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const suggestions = JSON.parse(content);
        return Array.isArray(suggestions) ? suggestions : [];
      }
      
      return [];
    } catch (error) {
      console.error('Failed to generate suggestions:', error);
      return [
        'Review Georgetown application progress',
        'Plan today\'s workout routine', 
        'Work on mobile app feature',
        'Daily prayer and reflection',
        'Connect with someone new'
      ];
    }
  }

  /**
   * Analyze progress and provide insights
   */
  async analyzeProgress(items: Item[]): Promise<{
    summary: string;
    insights: string[];
    recommendations: string[];
  }> {
    try {
      const response = await getOpenAIClient().chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `Analyze the user's life management progress and provide insights. Return a JSON object with:
{
  "summary": "Brief overall progress summary (1-2 sentences)",
  "insights": ["Key insight 1", "Key insight 2", "Key insight 3"],
  "recommendations": ["Actionable recommendation 1", "Actionable recommendation 2"]
}

Focus on Georgetown goals, fitness progress, app development, faith journey, and social growth.`
          },
          {
            role: 'user',
            content: `Analyze my progress: ${JSON.stringify(items.slice(0, 20))}`
          }
        ],
        temperature: 0.3,
        max_tokens: 300
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        return JSON.parse(content);
      }
      
      throw new Error('No analysis response');
    } catch (error) {
      console.error('Progress analysis failed:', error);
      return {
        summary: "Keep up the great work on your goals!",
        insights: [
          "You're making steady progress across multiple areas",
          "Consider focusing on high-priority items first",
          "Consistency is key to achieving your Georgetown dreams"
        ],
        recommendations: [
          "Set specific deadlines for key goals",
          "Break large goals into smaller tasks"
        ]
      };
    }
  }

  /**
   * Transcribe text from an image using GPT-4o vision capabilities
   */
  async transcribeImage(imageFile: File): Promise<string> {
    try {
      console.log('Starting image transcription with OpenAI...');
      
      // Convert image to base64
      const base64Image = await this.fileToBase64(imageFile);
      
      const response = await getOpenAIClient().chat.completions.create({
        model: 'gpt-4o', // Using GPT-4o for vision capabilities
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Please extract and transcribe all text visible in this image. Return only the text content, nothing else.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0
      });

      const extractedText = response.choices[0]?.message?.content || '';
      console.log('Image transcription result:', extractedText);
      
      return extractedText;
    } catch (error) {
      console.error('Image transcription failed:', error);
      throw error;
    }
  }

  /**
   * Convert file to base64 data URL
   */
  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Extract just the base64 part (remove the data:image/...;base64, prefix)
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Convert blob URL or data URL to base64
   */
  async blobUrlToBase64(url: string): Promise<string> {
    const response = await fetch(url);
    const blob = await response.blob();
    const file = new File([blob], 'image.jpg', { type: blob.type });
    return this.fileToBase64(file);
  }

  /**
   * Generate a smart summary of text content
   */
  async generateSummary(text: string): Promise<string> {
    try {
      const response = await getOpenAIClient().chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that creates concise, well-structured summaries. Focus on key points and main ideas.'
          },
          {
            role: 'user',
            content: `Please create a concise summary of the following text:\n\n${text}`
          }
        ],
        temperature: 0.3,
        max_tokens: 300
      });

      return response.choices[0]?.message?.content || 'Unable to generate summary';
    } catch (error) {
      console.error('Summary generation failed:', error);
      throw error;
    }
  }

  /**
   * Improve and enhance text content using AI
   */
  async improveText(text: string): Promise<string> {
    try {
      const response = await getOpenAIClient().chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a writing assistant that improves text by enhancing clarity, flow, grammar, and overall quality while maintaining the original meaning and tone.'
          },
          {
            role: 'user',
            content: `Please improve and enhance the following text:\n\n${text}`
          }
        ],
        temperature: 0.7,
        max_tokens: 800
      });

      return response.choices[0]?.message?.content || text;
    } catch (error) {
      console.error('Text improvement failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const aiService = new AIService(); 