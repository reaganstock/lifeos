import { supabase } from '../lib/supabase';
import { IntegrationToken as DBIntegrationToken, IntegrationTokenInsert } from '../lib/database.types';

export type IntegrationToken = DBIntegrationToken;

export interface TokenData {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_at?: Date;
  scope?: string;
  workspace_id?: string;
  workspace_name?: string;
  bot_id?: string;
}

export class IntegrationTokenService {
  
  /**
   * Store an integration token securely in Supabase
   */
  static async storeToken(provider: string, tokenData: TokenData): Promise<IntegrationToken | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      console.log(`🔐 Storing ${provider} token securely in Supabase...`);
      
      const tokenRecord = {
        user_id: user.id,
        provider,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_type: tokenData.token_type || 'Bearer',
        expires_at: tokenData.expires_at?.toISOString(),
        scope: tokenData.scope,
        workspace_id: tokenData.workspace_id,
        workspace_name: tokenData.workspace_name,
        bot_id: tokenData.bot_id
      };

      // Use upsert to handle updates to existing tokens
      const { data, error } = await supabase
        .from('integration_tokens')
        .upsert(tokenRecord, {
          onConflict: 'user_id,provider'
        })
        .select()
        .single();

      if (error) throw error;

      console.log(`✅ Successfully stored ${provider} token for user ${user.id}`);
      return data;
    } catch (error) {
      console.error(`❌ Failed to store ${provider} token:`, error);
      return null;
    }
  }

  /**
   * Retrieve an integration token from Supabase
   */
  static async getToken(provider: string): Promise<IntegrationToken | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      console.log(`🔍 Retrieving ${provider} token from Supabase...`);

      const { data, error } = await supabase
        .from('integration_tokens')
        .select('*')
        .eq('user_id', user.id)
        .eq('provider', provider)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No token found - this is normal
          console.log(`📝 No ${provider} token found for user`);
          return null;
        }
        throw error;
      }

      // Check if token is expired
      if (data.expires_at) {
        const expiresAt = new Date(data.expires_at);
        const now = new Date();
        const bufferTime = 5 * 60 * 1000; // 5 minutes buffer
        
        if (expiresAt.getTime() - bufferTime < now.getTime()) {
          console.log(`⚠️ ${provider} token is expired or expiring soon`);
          // Try to refresh if we have a refresh token
          if (data.refresh_token) {
            console.log(`🔄 Attempting to refresh ${provider} token...`);
            const refreshed = await this.refreshToken(provider, data.refresh_token);
            if (refreshed) return refreshed;
          }
          return null;
        }
      }

      console.log(`✅ Retrieved valid ${provider} token`);
      return data;
    } catch (error) {
      console.error(`❌ Failed to retrieve ${provider} token:`, error);
      return null;
    }
  }

  /**
   * Delete an integration token
   */
  static async deleteToken(provider: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      console.log(`🗑️ Deleting ${provider} token...`);

      const { error } = await supabase
        .from('integration_tokens')
        .delete()
        .eq('user_id', user.id)
        .eq('provider', provider);

      if (error) throw error;

      console.log(`✅ Successfully deleted ${provider} token`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to delete ${provider} token:`, error);
      return false;
    }
  }

  /**
   * Get all integration tokens for the current user
   */
  static async getAllTokens(): Promise<IntegrationToken[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('integration_tokens')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('❌ Failed to retrieve all tokens:', error);
      return [];
    }
  }

  /**
   * Check if a provider is connected (has valid token)
   */
  static async isConnected(provider: string): Promise<boolean> {
    const token = await this.getToken(provider);
    return token !== null;
  }

  /**
   * Refresh an OAuth token (provider-specific implementation needed)
   */
  private static async refreshToken(provider: string, refreshToken: string): Promise<IntegrationToken | null> {
    try {
      console.log(`🔄 Refreshing ${provider} token...`);
      
      // This would need provider-specific refresh logic
      // For now, we'll just handle the general case
      switch (provider) {
        case 'google_calendar':
          // Google OAuth refresh logic would go here
          break;
        case 'todoist':
          // Todoist typically uses long-lived tokens
          break;
        case 'notion':
          // Notion tokens typically don't expire
          break;
        default:
          console.log(`⚠️ Token refresh not implemented for ${provider}`);
          return null;
      }
      
      return null;
    } catch (error) {
      console.error(`❌ Failed to refresh ${provider} token:`, error);
      return null;
    }
  }

  /**
   * Update token metadata (like workspace info)
   */
  static async updateTokenMetadata(provider: string, metadata: Partial<Pick<TokenData, 'workspace_id' | 'workspace_name' | 'bot_id'>>): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { error } = await supabase
        .from('integration_tokens')
        .update(metadata)
        .eq('user_id', user.id)
        .eq('provider', provider);

      if (error) throw error;

      console.log(`✅ Updated ${provider} token metadata`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to update ${provider} token metadata:`, error);
      return false;
    }
  }
} 