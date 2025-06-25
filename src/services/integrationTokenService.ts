import { supabase } from '../lib/supabase';

export interface IntegrationToken {
  id?: string;
  user_id: string;
  provider: string;
  access_token: string;
  refresh_token?: string | null;
  token_type?: string | null;
  expires_at?: string | null;
  scope?: string | null;
  workspace_id?: string | null;
  workspace_name?: string | null;
  bot_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface IntegrationTokenInsert {
  user_id: string;
  provider: string;
  access_token: string;
  refresh_token?: string | null;
  token_type?: string | null;
  expires_at?: string | null;
  scope?: string | null;
  workspace_id?: string | null;
  workspace_name?: string | null;
  bot_id?: string | null;
}

export class IntegrationTokenService {
  /**
   * Store or update an integration token for a user
   */
  static async storeToken(token: IntegrationTokenInsert): Promise<IntegrationToken> {
    console.log('💾 Storing integration token for provider:', token.provider);
    
    try {
      // First, try to update an existing token for this user/provider
      const { data: existingToken } = await supabase
        .from('integration_tokens')
        .select('id')
        .eq('user_id', token.user_id)
        .eq('provider', token.provider)
        .single();

      if (existingToken) {
        // Update existing token
        const { data, error } = await supabase
          .from('integration_tokens')
          .update({
            access_token: token.access_token,
            refresh_token: token.refresh_token,
            token_type: token.token_type,
            expires_at: token.expires_at,
            scope: token.scope,
            workspace_id: token.workspace_id,
            workspace_name: token.workspace_name,
            bot_id: token.bot_id,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingToken.id)
          .select()
          .single();

        if (error) throw error;
        console.log('✅ Updated existing integration token');
        return data;
      } else {
        // Insert new token
        const { data, error } = await supabase
          .from('integration_tokens')
          .insert(token)
          .select()
          .single();

        if (error) throw error;
        console.log('✅ Stored new integration token');
        return data;
      }
    } catch (error) {
      console.error('❌ Failed to store integration token:', error);
      throw error;
    }
  }

  /**
   * Retrieve an integration token for a user and provider
   */
  static async getToken(userId: string, provider: string): Promise<IntegrationToken | null> {
    console.log('🔍 Retrieving integration token for:', { userId: userId.substring(0, 8) + '...', provider });
    
    try {
      const { data, error } = await supabase
        .from('integration_tokens')
        .select('*')
        .eq('user_id', userId)
        .eq('provider', provider)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned - token doesn't exist
          console.log('📝 No token found for provider:', provider);
          return null;
        }
        throw error;
      }

      console.log('✅ Retrieved integration token for provider:', provider);
      return data;
    } catch (error) {
      console.error('❌ Failed to retrieve integration token:', error);
      throw error;
    }
  }

  /**
   * Get all integration tokens for a user
   */
  static async getAllTokens(userId: string): Promise<IntegrationToken[]> {
    console.log('🔍 Retrieving all integration tokens for user:', userId.substring(0, 8) + '...');
    
    try {
      const { data, error } = await supabase
        .from('integration_tokens')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      console.log(`✅ Retrieved ${data.length} integration tokens`);
      return data;
    } catch (error) {
      console.error('❌ Failed to retrieve integration tokens:', error);
      throw error;
    }
  }

  /**
   * Delete an integration token
   */
  static async deleteToken(userId: string, provider: string): Promise<void> {
    console.log('🗑️ Deleting integration token for provider:', provider);
    
    try {
      const { error } = await supabase
        .from('integration_tokens')
        .delete()
        .eq('user_id', userId)
        .eq('provider', provider);

      if (error) throw error;
      console.log('✅ Deleted integration token for provider:', provider);
    } catch (error) {
      console.error('❌ Failed to delete integration token:', error);
      throw error;
    }
  }

  /**
   * Update an existing token (for refresh scenarios)
   */
  static async updateToken(
    userId: string, 
    provider: string, 
    updates: Partial<Omit<IntegrationTokenInsert, 'user_id' | 'provider'>>
  ): Promise<IntegrationToken> {
    console.log('🔄 Updating integration token for provider:', provider);
    
    try {
      const { data, error } = await supabase
        .from('integration_tokens')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('provider', provider)
        .select()
        .single();

      if (error) throw error;
      console.log('✅ Updated integration token for provider:', provider);
      return data;
    } catch (error) {
      console.error('❌ Failed to update integration token:', error);
      throw error;
    }
  }

  /**
   * Check if a token exists for a user/provider
   */
  static async hasToken(userId: string, provider: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('integration_tokens')
        .select('id')
        .eq('user_id', userId)
        .eq('provider', provider)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return false; // No rows returned
        }
        throw error;
      }

      return !!data;
    } catch (error) {
      console.error('❌ Failed to check token existence:', error);
      return false;
    }
  }

  /**
   * Get token with automatic refresh if expired
   */
  static async getValidToken(userId: string, provider: string): Promise<IntegrationToken | null> {
    const token = await this.getToken(userId, provider);
    
    if (!token) {
      return null;
    }

    // Check if token is expired
    if (token.expires_at && new Date(token.expires_at) <= new Date()) {
      console.log('🔄 Token expired, attempting refresh...');
      
      if (token.refresh_token) {
        try {
          // TODO: Implement token refresh logic based on provider
          console.log('⚠️ Token refresh not yet implemented for provider:', provider);
        } catch (error) {
          console.error('❌ Failed to refresh token:', error);
          return null;
        }
      } else {
        console.log('❌ Token expired and no refresh token available');
        return null;
      }
    }

    return token;
  }
} 