import { supabase } from '../lib/supabase';

export interface SecureAiResponse {
  success: boolean;
  response: string;
  usage?: {
    total_tokens?: number;
    prompt_tokens?: number;
    completion_tokens?: number;
  };
  error?: string;
}

export interface AiRequest {
  messages: Array<{
    role: 'user' | 'assistant' | 'system'
    content: string
  }>
  model?: string
  temperature?: number
  maxTokens?: number
  tools?: any[]
  toolChoice?: any
}

export interface AiResponse {
  content: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  toolCalls?: any[]
  error?: string
}

export class SecureAiService {
  
  /**
   * Process request through Gemini via secure Edge Function
   * All API keys are server-side only
   */
  static async processWithGemini(request: AiRequest): Promise<AiResponse> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('User not authenticated');
      }

      const response = await supabase.functions.invoke('lifeOS-ai-gemini', {
        body: {
          messages: request.messages,
          model: request.model || 'gemini-2.5-flash-preview-05-20',
          temperature: request.temperature || 0.7,
          maxTokens: request.maxTokens || 4096,
          tools: request.tools,
          toolChoice: request.toolChoice,
          userId: session.user.id
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Gemini API error');
      }

      const data = response.data;
      return {
        content: data.response || '',
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens || 0,
          completionTokens: data.usage.completion_tokens || 0,
          totalTokens: data.usage.total_tokens || 0,
        } : undefined,
        toolCalls: data.toolCalls,
        error: data.success ? undefined : data.error,
      };
    } catch (error: any) {
      console.error('Secure Gemini API error:', error);
      return {
        content: '',
        error: error.message || 'Failed to process with Gemini'
      };
    }
  }

  /**
   * Legacy method for backward compatibility
   */
  static async processWithGeminiLegacy(
    prompt: string,
    context?: any,
    functionCalls?: any[]
  ): Promise<SecureAiResponse> {
    const request: AiRequest = {
      messages: [{ role: 'user', content: prompt }],
      tools: functionCalls,
    };

    const response = await this.processWithGemini(request);
    
    return {
      success: !response.error,
      response: response.content,
      usage: response.usage ? {
        total_tokens: response.usage.totalTokens,
        prompt_tokens: response.usage.promptTokens,
        completion_tokens: response.usage.completionTokens,
      } : undefined,
      error: response.error,
    };
  }

  /**
   * Process request through OpenRouter via secure Edge Function
   * Supports multiple models with server-side rate limiting
   */
  static async processWithOpenRouter(request: AiRequest): Promise<AiResponse> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('User not authenticated');
      }

      const response = await supabase.functions.invoke('lifeOS-ai-openrouter', {
        body: {
          messages: request.messages,
          model: request.model || 'anthropic/claude-3.5-sonnet',
          temperature: request.temperature || 0.7,
          max_tokens: request.maxTokens || 4096,
          tools: request.tools,
          toolChoice: request.toolChoice,
          userId: session.user.id
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'OpenRouter API error');
      }

      const data = response.data;
      return {
        content: data.response || '',
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens || 0,
          completionTokens: data.usage.completion_tokens || 0,
          totalTokens: data.usage.total_tokens || 0,
        } : undefined,
        toolCalls: data.toolCalls,
        error: data.success ? undefined : data.error,
      };
    } catch (error: any) {
      console.error('Secure OpenRouter API error:', error);
      return {
        content: '',
        error: error.message || 'Failed to process with OpenRouter'
      };
    }
  }

  /**
   * Legacy method for backward compatibility
   */
  static async processWithOpenRouterLegacy(
    messages: any[],
    model: string = 'openai/gpt-4o',
    temperature: number = 0.7,
    maxTokens: number = 2048
  ): Promise<SecureAiResponse> {
    const request: AiRequest = {
      messages,
      model,
      temperature,
      maxTokens,
    };

    const response = await this.processWithOpenRouter(request);
    
    return {
      success: !response.error,
      response: response.content,
      usage: response.usage ? {
        total_tokens: response.usage.totalTokens,
        prompt_tokens: response.usage.promptTokens,
        completion_tokens: response.usage.completionTokens,
      } : undefined,
      error: response.error,
    };
  }

  /**
   * Get user's API usage statistics
   */
  static async getUserUsage(timeframe: 'day' | 'week' | 'month' = 'month') {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('User not authenticated');
      }

      const startDate = new Date();
      if (timeframe === 'day') {
        startDate.setDate(startDate.getDate() - 1);
      } else if (timeframe === 'week') {
        startDate.setDate(startDate.getDate() - 7);
      } else {
        startDate.setMonth(startDate.getMonth() - 1);
      }

      const { data, error } = await supabase
        .from('api_usage')
        .select('*')
        .eq('user_id', session.user.id)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Calculate totals
      const totalTokens = data.reduce((sum, usage) => sum + (usage.tokens_used || 0), 0);
      const totalCostCents = data.reduce((sum, usage) => sum + (usage.cost_cents || 0), 0);
      const requestCount = data.length;

      return {
        usage: data,
        totals: {
          tokens: totalTokens,
          costCents: totalCostCents,
          costDollars: totalCostCents / 100,
          requests: requestCount
        }
      };
    } catch (error: any) {
      console.error('Error fetching usage:', error);
      throw error;
    }
  }

  /**
   * Universal processing method that routes to appropriate service
   */
  static async processMessage(
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    model: string,
    options?: {
      temperature?: number
      maxTokens?: number
      tools?: any[]
      toolChoice?: any
    }
  ): Promise<AiResponse> {
    const request: AiRequest = {
      messages,
      model,
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
      tools: options?.tools,
      toolChoice: options?.toolChoice,
    }

    const isGeminiModel = model.includes('gemini')
    
    if (isGeminiModel) {
      return await this.processWithGemini(request)
    } else {
      return await this.processWithOpenRouter(request)
    }
  }

  /**
   * Track usage for cost monitoring
   */
  static async trackUsage(
    service: 'gemini' | 'openrouter' | 'core',
    model: string,
    tokensUsed: number,
    costCents?: number
  ): Promise<boolean> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('No session for usage tracking');
        return false;
      }

      const { error } = await supabase
        .from('api_usage')
        .insert([
          {
            user_id: session.user.id,
            service,
            model,
            tokens_used: tokensUsed,
            cost_cents: costCents || 0,
            created_at: new Date().toISOString(),
          },
        ]);

      if (error) {
        console.error('Error tracking usage:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in trackUsage:', error);
      return false;
    }
  }
} 