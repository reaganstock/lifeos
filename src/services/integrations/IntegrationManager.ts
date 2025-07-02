import { BaseIntegration } from './base/BaseIntegration';
import { TodoistIntegration } from './providers/TodoistIntegration';
import { GoogleCalendarIntegration } from './providers/GoogleCalendarIntegration';
import { MicrosoftCalendarIntegration } from './providers/MicrosoftCalendarIntegration';
import { OneNoteIntegration } from './providers/OneNoteIntegration';
import { NotionIntegration } from './providers/NotionIntegration';
import { YouTubeIntegration } from './providers/YouTubeIntegration';

import {
  IntegrationProvider,
  BaseIntegration as IBaseIntegration,
  ImportResult,
  ExportOptions,
  IntegrationError,
  SyncConfig,
  IntegrationStatus
} from './types';

import { IntegrationTokenService } from '../integrationTokenService';
import { supabase } from '../../lib/supabase';

export class IntegrationManager {
  private integrations: Map<string, BaseIntegration> = new Map();
  private configs: Map<IntegrationProvider, any> = new Map();
  private initialized = false;

  // OAuth Configuration Constants
  private static readonly OAUTH_CONFIGS = {
    notion: {
      clientId: '21dd872b-594c-80ed-90eb-0037fe32e351',
      clientSecret: 'secret_krnJDLvYIlzT4Qp5sn0Pd8QYf4UeOe2ptiJJAno9T8r',
      redirectUri: 'http://localhost:3000/auth/notion/callback'
    }
    // Add other OAuth configs here as needed
  };

  constructor() {
    this.initializeIntegrationConfigs();
  }

  private initializeIntegrationConfigs(): void {
    // Set up default configurations for each integration
    this.configs.set('todoist', {
      name: 'Todoist',
      description: 'Import tasks and projects from Todoist',
      icon: '/todoist.svg',
      authType: 'api_key', // or 'oauth'
      website: 'https://todoist.com',
      setupInstructions: 'Get your API token from Todoist Settings > Integrations'
    });

    this.configs.set('google-calendar', {
      name: 'Google Calendar',
      description: 'Sync events with Google Calendar',
      icon: '/google-calendar.svg',
      authType: 'oauth',
      website: 'https://calendar.google.com',
      setupInstructions: 'Authorize access to your Google Calendar'
    });

    this.configs.set('notion', {
      name: 'Notion',
      description: 'Import pages and databases from Notion',
      icon: '/notion.svg',
      authType: 'oauth', // or 'integration_token'
      website: 'https://notion.so',
      setupInstructions: 'Create a Notion integration and get your token'
    });

    this.configs.set('youtube', {
      name: 'YouTube',
      description: 'Import video transcripts from YouTube',
      icon: '/youtube.svg',
      color: '#FF0000',
      website: 'https://youtube.com',
      setupInstructions: 'YouTube integration is ready to use - no API key required! Just connect and start importing video transcripts.'
    });

    this.configs.set('microsoft-calendar', {
      name: 'Microsoft Calendar',
      description: 'Sync events with Outlook/Microsoft Calendar',
      icon: '/outlook-calendar.png',
      authType: 'oauth',
      website: 'https://outlook.com',
      setupInstructions: 'Authorize access to your Microsoft Calendar'
    });

    this.configs.set('apple-calendar', {
      name: 'Apple Calendar',
      description: 'Sync events with Apple Calendar (iCloud)',
      icon: '/apple-calendar.png',
      authType: 'oauth',
      website: 'https://icloud.com',
      setupInstructions: 'Note: Limited API access available'
    });

    this.configs.set('evernote', {
      name: 'Evernote',
      description: 'Import notes from Evernote',
      icon: '🐘',
      authType: 'oauth',
      website: 'https://evernote.com',
      setupInstructions: 'Authorize access to your Evernote account'
    });

    this.configs.set('onenote', {
      name: 'OneNote',
      description: 'Import notes from Microsoft OneNote',
      icon: '/onenote.png',
      authType: 'oauth',
      website: 'https://onenote.com',
      setupInstructions: 'Authorize access to your OneNote account'
    });

    this.configs.set('apple-notes', {
      name: 'Apple Notes',
      description: 'Import notes from Apple Notes',
      icon: '/apple-notes.svg',
      authType: 'local',
      website: 'https://apple.com',
      setupInstructions: 'Export notes manually or use third-party tools'
    });

    this.configs.set('google-drive', {
      name: 'Google Drive',
      description: 'Import files and documents from Google Drive',
      icon: '/google-drive.svg',
      authType: 'oauth',
      website: 'https://drive.google.com',
      setupInstructions: 'Authorize access to your Google Drive account'
    });
  }

  // Get available integration providers
  getAvailableProviders(): Array<{
    provider: IntegrationProvider;
    name: string;
    description: string;
    icon: string;
    authType: string;
    website: string;
    setupInstructions: string;
    isImplemented: boolean;
  }> {
    return Array.from(this.configs.entries()).map(([provider, config]) => ({
      provider,
      ...config,
      isImplemented: this.isProviderImplemented(provider)
    }));
  }

  private isProviderImplemented(provider: IntegrationProvider): boolean {
    const implemented = ['todoist', 'google-calendar', 'microsoft-calendar', 'onenote', 'notion', 'youtube'];
    return implemented.includes(provider);
  }

  // Create and register an integration
  async createIntegration(
    provider: IntegrationProvider, 
    config: Partial<IBaseIntegration>,
    credentials?: { apiKey?: string; accessToken?: string; refreshToken?: string }
  ): Promise<string> {
    const integrationId = `${provider}-${Date.now()}`;
    
    const baseConfig: IBaseIntegration = {
      id: integrationId,
      provider,
      name: this.configs.get(provider)?.name || provider,
      description: this.configs.get(provider)?.description || '',
      icon: this.configs.get(provider)?.icon || '🔗',
      status: 'disconnected',
      ...config
    };

    let integration: BaseIntegration;

    switch (provider) {
      case 'todoist':
        integration = new TodoistIntegration(baseConfig);
        break;
      case 'google-calendar':
        integration = new GoogleCalendarIntegration(baseConfig);
        break;
      case 'microsoft-calendar':
        integration = new MicrosoftCalendarIntegration(baseConfig);
        break;
      case 'onenote':
        integration = new OneNoteIntegration(baseConfig);
        break;
      case 'notion':
        integration = new NotionIntegration(baseConfig);
        break;
      case 'youtube':
        integration = new YouTubeIntegration(baseConfig);
        break;
      default:
        throw new Error(`Integration provider ${provider} not implemented`);
    }

    // Set credentials if provided
    if (credentials) {
      if (credentials.apiKey) {
        integration.setTokens(credentials.apiKey);
      } else if (credentials.accessToken) {
        integration.setTokens(credentials.accessToken, credentials.refreshToken);
      }
    }

    this.integrations.set(integrationId, integration);
    return integrationId;
  }

  // Get an integration by ID
  getIntegration(integrationId: string): BaseIntegration | undefined {
    return this.integrations.get(integrationId);
  }

  // Get all registered integrations
  getAllIntegrations(): Array<{ id: string; integration: BaseIntegration }> {
    return Array.from(this.integrations.entries()).map(([id, integration]) => ({
      id,
      integration
    }));
  }

  // Get integrations by provider
  getIntegrationsByProvider(provider: IntegrationProvider): BaseIntegration[] {
    return Array.from(this.integrations.values())
      .filter(integration => integration.getProvider() === provider);
  }

  // Get connected integrations
  getConnectedIntegrations(): BaseIntegration[] {
    return Array.from(this.integrations.values())
      .filter(integration => integration.isConnected());
  }

  // Authenticate an integration
  async authenticateIntegration(integrationId: string): Promise<void> {
    const integration = this.getIntegration(integrationId);
    if (!integration) {
      throw new Error(`Integration ${integrationId} not found`);
    }

    try {
      await integration.authenticate();
      console.log(`✅ ${integration.getName()} authenticated successfully`);
    } catch (error) {
      console.error(`❌ Failed to authenticate ${integration.getName()}:`, error);
      throw error;
    }
  }

  // Test connection for an integration
  async testConnection(integrationId: string): Promise<boolean> {
    const integration = this.getIntegration(integrationId);
    if (!integration) {
      throw new Error(`Integration ${integrationId} not found`);
    }

    try {
      return await integration.testConnection();
    } catch (error) {
      console.error(`Connection test failed for ${integration.getName()}:`, error);
      return false;
    }
  }

  // Import data from an integration
  async importData(integrationId: string, categoryId?: string): Promise<ImportResult> {
    const integration = this.getIntegration(integrationId);
    if (!integration) {
      throw new Error(`Integration ${integrationId} not found`);
    }

    if (!integration.isConnected()) {
      throw new Error(`Integration ${integration.getName()} is not connected`);
    }

    try {
      const result = await integration.importData(categoryId);
      console.log(`📥 Import completed for ${integration.getName()}:`, result);
      return result;
    } catch (error) {
      console.error(`❌ Import failed for ${integration.getName()}:`, error);
      throw error;
    }
  }

  // Export data to an integration
  async exportData(integrationId: string, options: ExportOptions): Promise<void> {
    const integration = this.getIntegration(integrationId);
    if (!integration) {
      throw new Error(`Integration ${integrationId} not found`);
    }

    if (!integration.isConnected()) {
      throw new Error(`Integration ${integration.getName()} is not connected`);
    }

    const capabilities = integration.getCapabilities();
    if (!capabilities.canExport) {
      throw new Error(`Integration ${integration.getName()} does not support export`);
    }

    try {
      await integration.exportData(options);
      console.log(`📤 Export completed for ${integration.getName()}`);
    } catch (error) {
      console.error(`❌ Export failed for ${integration.getName()}:`, error);
      throw error;
    }
  }

  // Bulk import from multiple integrations
  async bulkImport(integrationIds: string[]): Promise<ImportResult[]> {
    const results: ImportResult[] = [];
    
    for (const id of integrationIds) {
      try {
        const result = await this.importData(id);
        results.push(result);
      } catch (error) {
        const integration = this.getIntegration(id);
                 results.push({
           provider: integration?.getProvider() || 'todoist',
           totalItems: 0,
           importedItems: 0,
           failedItems: 0,
           errors: [error instanceof Error ? error.message : 'Unknown error'],
           summary: {}
         });
      }
    }

    return results;
  }

  // Update integration status
  updateIntegrationStatus(integrationId: string, status: IntegrationStatus): void {
    const integration = this.getIntegration(integrationId);
    if (integration) {
      integration.setStatus(status);
    }
  }

  // Remove an integration
  removeIntegration(integrationId: string): boolean {
    const integration = this.getIntegration(integrationId);
    if (integration) {
      integration.disconnect();
      return this.integrations.delete(integrationId);
    }
    return false;
  }

  // Get integration summary
  getIntegrationSummary(): {
    total: number;
    connected: number;
    disconnected: number;
    errors: number;
    byProvider: Record<IntegrationProvider, number>;
  } {
    const integrations = Array.from(this.integrations.values());
    
    const summary = {
      total: integrations.length,
      connected: 0,
      disconnected: 0,
      errors: 0,
      byProvider: {} as Record<IntegrationProvider, number>
    };

    integrations.forEach(integration => {
      const status = integration.getStatus();
      const provider = integration.getProvider();

      switch (status) {
        case 'connected':
          summary.connected++;
          break;
        case 'disconnected':
          summary.disconnected++;
          break;
        case 'error':
          summary.errors++;
          break;
      }

      summary.byProvider[provider] = (summary.byProvider[provider] || 0) + 1;
    });

    return summary;
  }

  // OAuth URL generators (static methods)
  static getTodoistOAuthUrl(clientId: string, redirectUri: string): string {
    return TodoistIntegration.getOAuthUrl(clientId, redirectUri);
  }

  static getGoogleCalendarOAuthUrl(clientId: string, redirectUri: string): string {
    return GoogleCalendarIntegration.getOAuthUrl(clientId, redirectUri);
  }

  static async getMicrosoftCalendarOAuthUrl(clientId: string, redirectUri: string): Promise<string> {
    console.log('🔐 Generating Microsoft OAuth URL with PKCE...');
    const { url, codeVerifier } = await MicrosoftCalendarIntegration.getOAuthUrl(clientId, redirectUri);
    
    console.log('🔐 Generated code verifier length:', codeVerifier.length);
    console.log('🔐 Storing code verifier in sessionStorage...');
    
    // Store the code verifier for later use in token exchange (both session and local storage)
    sessionStorage.setItem('microsoft_code_verifier', codeVerifier);
    localStorage.setItem('microsoft_code_verifier', codeVerifier);
    
    // Verify it was stored
    const storedSession = sessionStorage.getItem('microsoft_code_verifier');
    const storedLocal = localStorage.getItem('microsoft_code_verifier');
    console.log('🔐 Verification - sessionStorage:', storedSession ? 'Successfully stored' : 'Failed to store');
    console.log('🔐 Verification - localStorage:', storedLocal ? 'Successfully stored' : 'Failed to store');
    
    console.log('🔗 Generated OAuth URL:', url.substring(0, 100) + '...');
    return url;
  }

  static async getOneNoteOAuthUrl(clientId: string, redirectUri: string): Promise<string> {
    console.log('🔐 Generating OneNote OAuth URL with PKCE...');
    const { url, codeVerifier } = await OneNoteIntegration.getOAuthUrl(clientId, redirectUri);
    
    console.log('🔐 Generated OneNote code verifier length:', codeVerifier.length);
    console.log('🔐 Storing OneNote code verifier in sessionStorage...');
    
    // Store the code verifier for later use in token exchange (both session and local storage)
    // Use the same storage key as Microsoft Calendar since they share the same OAuth flow
    sessionStorage.setItem('microsoft_code_verifier', codeVerifier);
    localStorage.setItem('microsoft_code_verifier', codeVerifier);
    
    // Verify it was stored
    const storedSession = sessionStorage.getItem('microsoft_code_verifier');
    const storedLocal = localStorage.getItem('microsoft_code_verifier');
    console.log('🔐 OneNote - Verification - sessionStorage:', storedSession ? 'Successfully stored' : 'Failed to store');
    console.log('🔐 OneNote - Verification - localStorage:', storedLocal ? 'Successfully stored' : 'Failed to store');
    
    console.log('🔗 Generated OneNote OAuth URL:', url.substring(0, 100) + '...');
    return url;
  }

  static getNotionOAuthUrl(): string {
    const config = IntegrationManager.OAUTH_CONFIGS.notion;
    return NotionIntegration.getOAuthUrl(config.clientId, config.redirectUri);
  }

  // OAuth token exchange (static methods)
  static async exchangeTodoistCode(
    code: string, 
    clientId: string, 
    clientSecret: string, 
    redirectUri: string
  ): Promise<{ access_token: string }> {
    return TodoistIntegration.exchangeCodeForToken(code, clientId, clientSecret, redirectUri);
  }

  static async exchangeGoogleCode(
    code: string, 
    clientId: string, 
    clientSecret: string, 
    redirectUri: string
  ): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
    return GoogleCalendarIntegration.exchangeCodeForToken(code, clientId, clientSecret, redirectUri);
  }

  static async exchangeMicrosoftCode(
    code: string, 
    clientId: string, 
    clientSecret: string, 
    redirectUri: string
  ): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
    // Get the stored code verifier for PKCE - try both storages
    let codeVerifier = sessionStorage.getItem('microsoft_code_verifier');
    
    if (!codeVerifier) {
      codeVerifier = localStorage.getItem('microsoft_code_verifier');
      console.log('🔐 Code verifier not in sessionStorage, trying localStorage:', codeVerifier ? 'Found' : 'Not found');
    } else {
      console.log('🔐 Retrieved code verifier from sessionStorage: Found');
    }
    
    // Clean up the stored verifier from both storages
    if (codeVerifier) {
      sessionStorage.removeItem('microsoft_code_verifier');
      localStorage.removeItem('microsoft_code_verifier');
      console.log('🧹 Cleaned up stored code verifier from both storages');
    } else {
      console.log('❌ No code verifier found in either storage');
    }
    
    return MicrosoftCalendarIntegration.exchangeCodeForToken(code, clientId, clientSecret, redirectUri, codeVerifier || undefined);
  }

  static async exchangeOneNoteCode(
    code: string, 
    clientId: string, 
    clientSecret: string, 
    redirectUri: string
  ): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
    // OneNote uses same Microsoft OAuth flow as Microsoft Calendar, including PKCE
    let codeVerifier = sessionStorage.getItem('microsoft_code_verifier');
    
    if (!codeVerifier) {
      codeVerifier = localStorage.getItem('microsoft_code_verifier');
      console.log('🔐 OneNote - Code verifier not in sessionStorage, trying localStorage:', codeVerifier ? 'Found' : 'Not found');
    } else {
      console.log('🔐 OneNote - Retrieved code verifier from sessionStorage: Found');
    }
    
    // Clean up the stored verifier from both storages
    if (codeVerifier) {
      sessionStorage.removeItem('microsoft_code_verifier');
      localStorage.removeItem('microsoft_code_verifier');
      console.log('🧹 OneNote - Cleaned up stored code verifier from both storages');
    } else {
      console.log('❌ OneNote - No code verifier found in either storage');
    }
    
    return OneNoteIntegration.exchangeCodeForToken(code, clientId, clientSecret, redirectUri, codeVerifier || undefined);
  }

  static async exchangeNotionCode(
    code: string
  ): Promise<{ access_token: string; bot_id: string; workspace_name: string }> {
    const config = IntegrationManager.OAUTH_CONFIGS.notion;
    return NotionIntegration.exchangeCodeForToken(code, config.clientId, config.clientSecret, config.redirectUri);
  }

  // Special methods for specific integrations
  async importYouTubeTranscript(integrationId: string, videoUrl: string, categoryId?: string): Promise<any> {
    const integration = this.getIntegration(integrationId);
    if (!integration || integration.getProvider() !== 'youtube') {
      throw new Error('YouTube integration not found');
    }

    const youtubeIntegration = integration as YouTubeIntegration;
    return await youtubeIntegration.importVideoTranscript(videoUrl, categoryId);
  }

  async searchYouTubeVideos(integrationId: string, query: string, maxResults?: number): Promise<any[]> {
    const integration = this.getIntegration(integrationId);
    if (!integration || integration.getProvider() !== 'youtube') {
      throw new Error('YouTube integration not found');
    }

    const youtubeIntegration = integration as YouTubeIntegration;
    return await youtubeIntegration.searchVideos(query, maxResults);
  }

  // Initialize manager and load existing integrations
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      await this.loadExistingIntegrations();
      this.initialized = true;
      console.log('🔗 IntegrationManager initialized with existing integrations');
    } catch (error) {
      console.error('❌ Failed to initialize IntegrationManager:', error);
    }
  }

  // Helper function to normalize provider names
  private normalizeProviderName(provider: string): IntegrationProvider {
    // Convert from storage format (underscores) to type format (hyphens)
    const normalized = provider.replace(/_/g, '-') as IntegrationProvider;
    console.log(`🔄 Normalized provider "${provider}" -> "${normalized}"`);
    return normalized;
  }

  // Load existing integrations from Supabase tokens
  private async loadExistingIntegrations(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('👤 No authenticated user - skipping token loading');
        return;
      }

      console.log('🔍 Loading stored integration tokens from Supabase...');
      const tokens = await IntegrationTokenService.getAllTokens(user.id);
      
      if (tokens.length === 0) {
        console.log('📝 No stored integration tokens found');
        return;
      }

      console.log(`🔑 Found ${tokens.length} stored integration tokens`);
      
      // Create integrations for each stored token (but don't authenticate yet)
      const authenticationPromises: Promise<void>[] = [];
      
      for (const token of tokens) {
        try {
          console.log(`🔧 Restoring ${token.provider} integration...`);
          
          // Normalize provider name to match TypeScript types
          const normalizedProvider = this.normalizeProviderName(token.provider);
          
          const integrationId = await this.createIntegration(
            normalizedProvider,
            {
              name: this.configs.get(normalizedProvider)?.name || normalizedProvider,
              description: this.configs.get(normalizedProvider)?.description || ''
            },
            {
              accessToken: token.access_token,
              refreshToken: token.refresh_token || undefined
            }
          );

          // Queue authentication for later (parallel processing)
          const integration = this.getIntegration(integrationId);
          if (integration) {
            authenticationPromises.push(
              integration.authenticate().then(() => {
                console.log(`✅ Restored and authenticated ${token.provider} integration`);
              }).catch(error => {
                console.error(`❌ Failed to authenticate ${token.provider} integration:`, error);
                integration.setStatus('error');
              })
            );
          }
        } catch (error) {
          console.error(`❌ Failed to restore ${token.provider} integration:`, error);
        }
      }
      
      console.log(`🚀 Created ${tokens.length} integrations, authenticating in parallel...`);
      
      // Don't wait for authentication to complete - let it happen in background
      Promise.all(authenticationPromises).then(() => {
        const connectedCount = this.getConnectedIntegrations().length;
        console.log(`🎉 Successfully authenticated ${connectedCount} integrations`);
      }).catch(error => {
        console.warn('⚠️ Some integrations failed to authenticate:', error);
      });
      
    } catch (error) {
      console.warn('⚠️ Failed to load integration tokens from Supabase:', error);
    }
  }
}

// Export singleton instance
export const integrationManager = new IntegrationManager(); 