import { BaseIntegration } from '../base/BaseIntegration';
import { 
  IntegrationCapabilities, 
  ImportResult, 
  ExportOptions, 
  OneNoteNote,
  OneNoteNotebook,
  OneNoteSection,
  BaseIntegration as IBaseIntegration
} from '../types';
import { IntegrationTokenService } from '../../integrationTokenService';
import { supabase } from '../../../lib/supabase';

// Types will be imported from the main app
type Item = any;
type ItemType = 'todo' | 'note' | 'event' | 'goal' | 'routine';

export class OneNoteIntegration extends BaseIntegration {
  private readonly baseUrl = 'https://graph.microsoft.com/v1.0';

  constructor(config: IBaseIntegration) {
    super(config);
  }

  getCapabilities(): IntegrationCapabilities {
    return {
      canImport: true,
      canExport: true,
      canSync: true,
      supportsRealtime: false,
      supportedItemTypes: ['notes'],
      maxBatchSize: 1000,
      rateLimits: {
        requestsPerMinute: 600,
        requestsPerHour: 10000,
        requestsPerDay: 150000
      }
    };
  }

  async authenticate(): Promise<void> {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw this.createError('NO_USER', 'User not authenticated');
    }

    // Try to load token from secure storage first
    const storedToken = await IntegrationTokenService.getToken(user.id, 'onenote');
    if (storedToken) {
      console.log('🔐 Loaded OneNote token from Supabase');
      this.accessToken = storedToken.access_token;
      this.refreshToken = storedToken.refresh_token || undefined;
    } else if (!this.accessToken) {
      throw this.createError('NO_TOKEN', 'OneNote access token is required');
    }

    const isValid = await this.testConnection();
    if (!isValid) {
      throw this.createError('INVALID_TOKEN', 'Invalid OneNote access token');
    }

    // Store token securely if we have one and it's valid
    if (this.accessToken && !storedToken) {
      await IntegrationTokenService.storeToken({
        user_id: user.id,
        provider: 'onenote',
        access_token: this.accessToken,
        refresh_token: this.refreshToken || null,
        token_type: 'Bearer'
      });
      console.log('🔐 Stored OneNote token securely in Supabase');
    }

    this.setStatus('connected');
  }

  async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      throw this.createError('NO_REFRESH_TOKEN', 'No refresh token available');
    }

    try {
      const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: process.env.REACT_APP_MICROSOFT_CLIENT_ID || '',
          client_secret: process.env.REACT_APP_MICROSOFT_CLIENT_SECRET || '',
          refresh_token: this.refreshToken,
          grant_type: 'refresh_token',
          scope: 'https://graph.microsoft.com/Notes.ReadWrite offline_access'
        })
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.statusText}`);
      }

      const data = await response.json();
      this.setTokens(data.access_token, this.refreshToken);
    } catch (error) {
      this.setStatus('error');
      throw this.createError(
        'TOKEN_REFRESH_FAILED',
        `Failed to refresh OneNote token: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.makeRequest<any>(`${this.baseUrl}/me/onenote/notebooks`);
      return true;
    } catch (error) {
      console.error('OneNote connection test failed:', error);
      return false;
    }
  }

  async importData(categoryId?: string): Promise<ImportResult> {
    this.setStatus('syncing');
    
    try {
      const notebooks = await this.getNotebooks();
      let totalNotes = 0;
      let importedNotes = 0;
      const errors: string[] = [];

      for (const notebook of notebooks) {
        try {
          console.log(`📝 Getting pages directly from notebook: ${notebook.displayName}`);
          
          // Try getting pages directly from notebook instead of going through sections
          const notes = await this.getNotesFromNotebook(notebook.id);
          console.log(`📋 Found ${notes.length} notes in notebook: ${notebook.displayName}`);
          
          if (notes.length > 0) {
            // Create a dummy section for notes that come directly from notebook
            const dummySection: OneNoteSection = {
              id: 'notebook-pages',
              displayName: 'All Pages',
              createdDateTime: notebook.createdDateTime,
              lastModifiedDateTime: notebook.lastModifiedDateTime,
              pagesUrl: '',
              notebookId: notebook.id
            };
            
            const convertedNotes = await this.convertOneNoteNotesToItems(notes, notebook, dummySection);
            
            totalNotes += notes.length;
            importedNotes += convertedNotes.length;
            
            console.log(`✅ Imported ${convertedNotes.length} notes from notebook: ${notebook.displayName}`);
          } else {
            // Fallback to section-by-section approach
            console.log(`📝 No direct pages found, trying sections for notebook: ${notebook.displayName}`);
            const sections = await this.getSections(notebook.id);
            console.log(`📂 Found ${sections.length} sections in notebook: ${notebook.displayName}`);
            
            for (const section of sections) {
              try {
                console.log(`📄 Getting notes from section: ${section.displayName}`);
                const sectionNotes = await this.getNotes(section.id);
                console.log(`📋 Found ${sectionNotes.length} notes in section: ${section.displayName}`);
                
                const convertedNotes = await this.convertOneNoteNotesToItems(sectionNotes, notebook, section);
                
                totalNotes += sectionNotes.length;
                importedNotes += convertedNotes.length;
                
                console.log(`✅ Imported ${convertedNotes.length} notes from section: ${section.displayName} in notebook: ${notebook.displayName}`);
              } catch (error) {
                console.error(`❌ Error importing section ${section.displayName}:`, error);
                errors.push(`Failed to import section ${section.displayName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
              }
            }
          }
        } catch (error) {
          console.error(`❌ Error importing notebook ${notebook.displayName}:`, error);
          errors.push(`Failed to import notebook ${notebook.displayName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      const result: ImportResult = {
        provider: 'onenote',
        totalItems: totalNotes,
        importedItems: importedNotes,
        failedItems: totalNotes - importedNotes,
        errors,
        summary: {
          notes: importedNotes
        }
      };

      this.updateLastSync();
      this.setStatus('connected');
      
      return result;
    } catch (error) {
      this.setStatus('error');
      throw this.createError(
        'IMPORT_FAILED',
        `Failed to import from OneNote: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async exportData(options: ExportOptions): Promise<void> {
    // Implementation for exporting data to OneNote
    throw new Error('Export to OneNote not yet implemented');
  }

  // OneNote-specific methods
  private async getNotebooks(): Promise<OneNoteNotebook[]> {
    const response = await this.makeRequest<{ value: OneNoteNotebook[] }>
      (`${this.baseUrl}/me/onenote/notebooks`);
    return response.value;
  }

  private async getSections(notebookId: string): Promise<OneNoteSection[]> {
    console.log(`🔍 OneNote: Getting sections for notebook ID: ${notebookId}`);
    const url = `${this.baseUrl}/me/onenote/notebooks/${encodeURIComponent(notebookId)}/sections`;
    console.log(`📂 OneNote: Sections URL: ${url}`);
    
    const response = await this.makeRequest<{ value: OneNoteSection[] }>(url);
    console.log(`✅ OneNote: Found ${response.value.length} sections`);
    
    // Log section details for debugging
    response.value.forEach((section, index) => {
      console.log(`📋 Section ${index + 1}: "${section.displayName}" (ID: ${section.id})`);
    });
    
    return response.value;
  }

  private async getNotesFromNotebook(notebookId: string): Promise<OneNoteNote[]> {
    console.log(`🔍 OneNote: Getting pages directly from notebook ID: ${notebookId}`);
    
    return this.getAllPages(async (pageToken) => {
      let url: string;
      
      // If we have a nextLink from previous response, use it directly
      if (pageToken) {
        url = pageToken;
        console.log(`📄 OneNote: Using nextLink for pagination: ${url.substring(0, 100)}...`);
      } else {
        // Get pages directly from notebook
        url = `${this.baseUrl}/me/onenote/notebooks/${encodeURIComponent(notebookId)}/pages`;
        console.log(`📄 OneNote: Notebook pages URL: ${url}`);
      }
      
      try {
        const response = await this.makeRequest<{ 
          value: OneNoteNote[], 
          '@odata.nextLink'?: string 
        }>(url);
        
        console.log(`✅ OneNote: Successfully fetched ${response.value.length} pages from notebook`);
        
        return {
          items: response.value,
          nextPageToken: response['@odata.nextLink'] || undefined
        };
      } catch (error) {
        console.error(`❌ OneNote: Failed to fetch pages from notebook ${notebookId}:`, error);
        // Return empty array to allow fallback to sections approach
        return {
          items: [],
          nextPageToken: undefined
        };
      }
    });
  }

  private async getNotes(sectionId: string): Promise<OneNoteNote[]> {
    console.log(`🔍 OneNote: Getting notes for section ID: ${sectionId}`);
    
    return this.getAllPages(async (pageToken) => {
      let url: string;
      
      // If we have a nextLink from previous response, use it directly
      if (pageToken) {
        url = pageToken;
        console.log(`📄 OneNote: Using nextLink for pagination: ${url.substring(0, 100)}...`);
      } else {
        // Try the simplest possible request first
        url = `${this.baseUrl}/me/onenote/sections/${encodeURIComponent(sectionId)}/pages`;
        console.log(`📄 OneNote: Initial request URL: ${url}`);
      }
      
      try {
        const response = await this.makeRequest<{ 
          value: OneNoteNote[], 
          '@odata.nextLink'?: string 
        }>(url);
        
        console.log(`✅ OneNote: Successfully fetched ${response.value.length} notes`);
        
        return {
          items: response.value,
          nextPageToken: response['@odata.nextLink'] || undefined
        };
      } catch (error) {
        console.error(`❌ OneNote: Failed to fetch notes from section ${sectionId}:`, error);
        // If the section ID format is problematic, try alternative approaches
        throw error;
      }
    });
  }

  private async convertOneNoteNotesToItems(
    notes: OneNoteNote[], 
    notebook: OneNoteNotebook,
    section: OneNoteSection
  ): Promise<Item[]> {
    await this.ensureOneNoteCategory();
    
    const convertedItems: Item[] = [];

    for (const note of notes) {
      try {
        // Get note content if available
        let content = '';
        if (note.contentUrl) {
          try {
            const contentResponse = await this.makeRequest<string>(note.contentUrl, {
              headers: {
                'Accept': 'text/html'
              }
            });
            content = this.stripHtmlTags(contentResponse);
          } catch (error) {
            console.warn(`Failed to fetch content for note ${note.title}:`, error);
          }
        }

        const item: Item = {
          id: `onenote-${note.id}`,
          title: note.title || 'Untitled Note',
          description: content ? content.substring(0, 500) + (content.length > 500 ? '...' : '') : '',
          type: 'note' as ItemType,
          categoryId: 'imported-onenote',
          completed: false,
          priority: 1,
          createdAt: new Date(note.createdDateTime),
          updatedAt: new Date(note.lastModifiedDateTime),
          metadata: {
            source: 'onenote',
            originalId: note.id,
            notebookId: notebook.id,
            notebookName: notebook.displayName,
            sectionId: section.id,
            sectionName: section.displayName,
            pageUrl: note.pageUrl,
            oneNoteClientUrl: note.links?.oneNoteClientUrl?.href,
            oneNoteWebUrl: note.links?.oneNoteWebUrl?.href,
            fullContent: content
          }
        };

        convertedItems.push(item);
      } catch (error) {
        console.error(`Error converting OneNote note ${note.id}:`, error);
      }
    }

    // Save converted items
    await this.saveConvertedItems(convertedItems, 'imported-onenote');
    
    return convertedItems;
  }

  private stripHtmlTags(html: string): string {
    // Basic HTML tag removal
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  }

  private async saveConvertedItems(items: Item[], categoryId?: string): Promise<Item[]> {
    if (items.length === 0) return [];

    try {
      // Get existing items to check for duplicates
      const existingItems = this.getStoredItems();
      const existingOneNoteIds = new Set(
        existingItems
          .filter(item => item.metadata?.source === 'onenote')
          .map(item => item.metadata?.originalId)
      );

      // Filter out duplicates
      const newItems = items.filter(item => !existingOneNoteIds.has(item.metadata?.originalId));
      
      if (newItems.length === 0) {
        console.log('📝 No new OneNote notes to import (all already exist)');
        return [];
      }

      // Add new items to existing items
      const allItems = [...existingItems, ...newItems];
      
      // Save back to localStorage
      this.saveStoredItems(allItems);
      
      console.log(`📝 Successfully imported ${newItems.length} new OneNote notes (${items.length - newItems.length} duplicates skipped)`);
      
      return newItems;
    } catch (error) {
      console.error('❌ Error saving OneNote items:', error);
      throw error;
    }
  }

  private async ensureOneNoteCategory(): Promise<void> {
    const categories = this.getStoredCategories();
    const oneNoteCategory = categories.find(cat => cat.id === 'imported-onenote');

    if (!oneNoteCategory) {
      const newCategory = {
        id: 'imported-onenote',
        name: 'OneNote',
        icon: '📝',
        color: '#7719aa',
        priority: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      categories.push(newCategory);
      this.saveStoredCategories(categories);
      console.log('📁 Created OneNote category');
    }
  }

  private getStoredCategories(): any[] {
    try {
      const stored = localStorage.getItem('lifeStructureCategories');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading categories from localStorage:', error);
      return [];
    }
  }

  private saveStoredCategories(categories: any[]): void {
    try {
      localStorage.setItem('lifeStructureCategories', JSON.stringify(categories));
      console.log(`💾 Saved ${categories.length} categories to localStorage`);
    } catch (error) {
      console.error('Error saving categories to localStorage:', error);
      throw error;
    }
  }

  private getStoredItems(): Item[] {
    try {
      const stored = localStorage.getItem('lifeStructureItems');
      if (!stored) return [];
      
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed.map((item: any) => ({
        ...item,
        createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
        updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
        dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
        dateTime: item.dateTime ? new Date(item.dateTime) : undefined
      })) : [];
    } catch (error) {
      console.error('Error loading items from localStorage:', error);
      return [];
    }
  }

  private saveStoredItems(items: Item[]): void {
    try {
      localStorage.setItem('lifeStructureItems', JSON.stringify(items));
      console.log(`💾 Saved ${items.length} items to localStorage (lifeStructureItems)`);
      
      // Dispatch custom event for real-time UI updates
      window.dispatchEvent(new CustomEvent('itemsModified', {
        detail: { items, timestamp: Date.now() }
      }));
      console.log('📡 Dispatched itemsModified event for real-time updates');
    } catch (error) {
      console.error('Error saving items to localStorage:', error);
      throw error;
    }
  }

  // PKCE helper functions
  private static generateRandomString(length: number): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return result;
  }

  private static async sha256(plain: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    const hash = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hash);
    const hashString = Array.from(hashArray).map(b => String.fromCharCode(b)).join('');
    return btoa(hashString)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  // Static OAuth helper methods with PKCE
  static async getOAuthUrl(clientId: string, redirectUri: string): Promise<{ url: string; codeVerifier: string }> {
    // Generate PKCE code verifier and challenge for SPA authentication
    const codeVerifier = OneNoteIntegration.generateRandomString(128);
    const codeChallenge = await OneNoteIntegration.sha256(codeVerifier);
    const codeChallengeMethod = 'S256';

    console.log('🔐 OneNote - Generated PKCE parameters');
    console.log('🔐 OneNote - Code verifier length:', codeVerifier.length);
    console.log('🔐 OneNote - Code challenge length:', codeChallenge.length);

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: 'https://graph.microsoft.com/Notes.ReadWrite offline_access',
      response_mode: 'query',
      prompt: 'consent',
      code_challenge: codeChallenge,
      code_challenge_method: codeChallengeMethod,
      state: 'onenote' // Help identify this as OneNote OAuth
    });

    const url = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
    
    return { url, codeVerifier };
  }

  static async exchangeCodeForToken(
    code: string, 
    clientId: string, 
    clientSecret: string,
    redirectUri: string,
    codeVerifier?: string
  ): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
    console.log('🔗 Exchanging OneNote OAuth code for token...');
    console.log('🕐 Exchange started at:', new Date().toISOString());
    console.log('🔑 Code length:', code.length);
    console.log('🔑 Client ID:', clientId.substring(0, 8) + '...');
    console.log('🔑 Redirect URI:', redirectUri);

    const tokenParams: Record<string, string> = {
      client_id: clientId,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      scope: 'https://graph.microsoft.com/Notes.ReadWrite offline_access'
    };

    // Add PKCE code_verifier if provided (for SPA), otherwise use client_secret (for Web)
    if (codeVerifier) {
      tokenParams.code_verifier = codeVerifier;
      console.log('🔐 Using PKCE flow (no client secret)');
    } else if (clientSecret && clientSecret.trim() !== '') {
      tokenParams.client_secret = clientSecret;
      console.log('🔐 Using client secret flow');
    } else {
      throw new Error('Either codeVerifier (for PKCE) or clientSecret must be provided');
    }

    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams(tokenParams)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OneNote OAuth exchange failed:', errorText);
      throw new Error(`OAuth exchange failed: ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();

    // Store the token securely in Supabase
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const expiresAt = new Date(Date.now() + result.expires_in * 1000).toISOString();
        
        await IntegrationTokenService.storeToken({
          user_id: user.id,
          provider: 'onenote',
          access_token: result.access_token,
          refresh_token: result.refresh_token,
          token_type: 'Bearer',
          expires_at: expiresAt
        });
        
        console.log('🔐 OneNote token stored securely in Supabase');
      }
    } catch (error) {
      console.warn('⚠️ Failed to store OneNote token in Supabase:', error);
    }

    return result;
  }

  // Webhook handling for real-time sync (OneNote doesn't support webhooks currently)
  async handleWebhook(payload: any): Promise<void> {
    console.log('OneNote webhook received (not supported):', payload);
  }
} 