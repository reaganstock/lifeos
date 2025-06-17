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

export class SecureAiService {
  
  /**
   * Process prompt through Gemini via secure Edge Function
   * All API keys are server-side only
   */
  static async processWithGemini(
    prompt: string,
    context?: any,
    functionCalls?: any[]
  ): Promise<SecureAiResponse> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('User not authenticated');
      }

      const response = await supabase.functions.invoke('lifeOS-ai-gemini', {
        body: {
          prompt,
          context,
          functionCalls,
          userId: session.user.id
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Gemini API error');
      }

      return response.data;
    } catch (error: any) {
      console.error('Secure Gemini API error:', error);
      return {
        success: false,
        response: '',
        error: error.message || 'Failed to process with Gemini'
      };
    }
  }

  /**
   * Process messages through OpenRouter via secure Edge Function
   * Supports multiple models with server-side rate limiting
   */
  static async processWithOpenRouter(
    messages: any[],
    model: string = 'openai/gpt-4o',
    temperature: number = 0.7,
    maxTokens: number = 2048
  ): Promise<SecureAiResponse> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('User not authenticated');
      }

      const response = await supabase.functions.invoke('lifeOS-ai-openrouter', {
        body: {
          messages,
          model,
          temperature,
          max_tokens: maxTokens,
          userId: session.user.id
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'OpenRouter API error');
      }

      return response.data;
    } catch (error: any) {
      console.error('Secure OpenRouter API error:', error);
      return {
        success: false,
        response: '',
        error: error.message || 'Failed to process with OpenRouter'
      };
    }
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
} 