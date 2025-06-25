import { BaseIntegration } from '../base/BaseIntegration';
import { 
  IntegrationCapabilities, 
  ImportResult, 
  ExportOptions, 
  MicrosoftCalendarEvent,
  BaseIntegration as IBaseIntegration
} from '../types';
import { IntegrationTokenService } from '../../integrationTokenService';
import { supabase } from '../../../lib/supabase';

// Types will be imported from the main app
type Item = any;
type ItemType = 'todo' | 'note' | 'event' | 'goal' | 'routine';

export class MicrosoftCalendarIntegration extends BaseIntegration {
  private readonly baseUrl = 'https://graph.microsoft.com/v1.0';

  constructor(config: IBaseIntegration) {
    super(config);
  }

  getCapabilities(): IntegrationCapabilities {
    return {
      canImport: true,
      canExport: true,
      canSync: true,
      supportsRealtime: true,
      supportedItemTypes: ['events'],
      maxBatchSize: 1000,
      rateLimits: {
        requestsPerMinute: 10000,
        requestsPerHour: 600000,
        requestsPerDay: 14400000
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
    const storedToken = await IntegrationTokenService.getToken(user.id, 'microsoft_calendar');
    if (storedToken) {
      console.log('🔐 Loaded Microsoft Calendar token from Supabase');
      this.accessToken = storedToken.access_token;
      this.refreshToken = storedToken.refresh_token || undefined;
    } else if (!this.accessToken) {
      throw this.createError('NO_TOKEN', 'Microsoft Calendar access token is required');
    }

    const isValid = await this.testConnection();
    if (!isValid) {
      throw this.createError('INVALID_TOKEN', 'Invalid Microsoft Calendar access token');
    }

    // Store token securely if we have one and it's valid
    if (this.accessToken && !storedToken) {
      await IntegrationTokenService.storeToken({
        user_id: user.id,
        provider: 'microsoft_calendar',
        access_token: this.accessToken,
        refresh_token: this.refreshToken || null,
        token_type: 'Bearer'
      });
      console.log('🔐 Stored Microsoft Calendar token securely in Supabase');
    }

    this.setStatus('connected');
  }

  async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      throw this.createError('NO_REFRESH_TOKEN', 'No refresh token available');
    }

    try {
      const clientId = process.env.REACT_APP_MICROSOFT_CLIENT_ID;
      const clientSecret = process.env.REACT_APP_MICROSOFT_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        throw new Error('Microsoft OAuth credentials not configured');
      }

      const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: this.refreshToken,
          grant_type: 'refresh_token',
          scope: 'https://graph.microsoft.com/calendars.readwrite offline_access'
        })
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.statusText}`);
      }

      const data = await response.json();
      this.setTokens(data.access_token, data.refresh_token || this.refreshToken);

      // Update token in Supabase
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
        await IntegrationTokenService.updateToken(user.id, 'microsoft_calendar', {
          access_token: data.access_token,
          refresh_token: data.refresh_token || this.refreshToken,
          expires_at: expiresAt
        });
      }
    } catch (error) {
      this.setStatus('error');
      throw this.createError(
        'TOKEN_REFRESH_FAILED',
        `Failed to refresh Microsoft Calendar token: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.makeRequest<any>(`${this.baseUrl}/me/calendars`);
      return true;
    } catch (error) {
      console.error('Microsoft Calendar connection test failed:', error);
      return false;
    }
  }

  async importData(categoryId?: string): Promise<ImportResult> {
    this.setStatus('syncing');
    
    try {
      console.log('🔍 Starting Microsoft Calendar import...');
      const calendars = await this.getCalendarList();
      let totalEvents = 0;
      let importedEvents = 0;
      const errors: string[] = [];

      console.log(`📅 Found ${calendars.length} calendars in Microsoft Outlook`);

      const allConvertedItems: Item[] = [];

      for (const calendar of calendars) {
        try {
          console.log(`📅 Importing events from calendar: ${calendar.name}`);
          const events = await this.getCalendarEvents(calendar.id);
          const convertedEvents = await this.convertMicrosoftEventsToItems(events, calendar);
          
          totalEvents += events.length;
          allConvertedItems.push(...convertedEvents);
          console.log(`📥 Converted ${convertedEvents.length} events from ${calendar.name}`);
        } catch (error) {
          const errorMsg = `Failed to import calendar ${calendar.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          console.error('❌', errorMsg);
        }
      }

      // Save all converted items
      const savedItems = await this.saveConvertedItems(allConvertedItems, categoryId);
      importedEvents = savedItems.length;
      
      const result: ImportResult = {
        provider: 'microsoft-calendar',
        totalItems: totalEvents,
        importedItems: importedEvents,
        failedItems: totalEvents - importedEvents,
        errors,
        summary: {
          events: importedEvents
        }
      };

      this.updateLastSync();
      this.setStatus('connected');
      
      console.log(`✅ Microsoft Calendar import completed: ${importedEvents}/${totalEvents} events imported`);
      return result;
    } catch (error) {
      this.setStatus('error');
      throw this.createError(
        'IMPORT_FAILED',
        `Failed to import from Microsoft Calendar: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async exportData(options: ExportOptions): Promise<void> {
    // Implementation for exporting data to Microsoft Calendar
    throw new Error('Export to Microsoft Calendar not yet implemented');
  }

  // Microsoft Calendar-specific methods
  private async getCalendarList(): Promise<Array<{ id: string; name: string; color?: string; isDefault?: boolean }>> {
    const response = await this.makeRequest<{ value: Array<{ id: string; name: string; color?: string; isDefault?: boolean }> }>
      (`${this.baseUrl}/me/calendars`);
    return response.value;
  }

  private async getCalendarEvents(calendarId: string): Promise<MicrosoftCalendarEvent[]> {
    const now = new Date();
    const oneMonthAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    const oneMonthFromNow = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));

    const filter = `start/dateTime ge '${oneMonthAgo.toISOString()}' and end/dateTime le '${oneMonthFromNow.toISOString()}'`;
    
    return this.getAllPages(async (nextLink) => {
      let url: string;
      if (nextLink) {
        url = nextLink;
      } else {
        const params = new URLSearchParams({
          $filter: filter,
          $orderby: 'start/dateTime',
          $top: '1000'
        });
        url = `${this.baseUrl}/me/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`;
      }
      
      const response = await this.makeRequest<{ 
        value: MicrosoftCalendarEvent[], 
        '@odata.nextLink'?: string 
      }>(url);
      
      return {
        items: response.value || [],
        nextPageToken: response['@odata.nextLink']
      };
    });
  }

  private async convertMicrosoftEventsToItems(
    events: MicrosoftCalendarEvent[], 
    calendar: { id: string; name: string; color?: string; isDefault?: boolean }
  ): Promise<Item[]> {
    return events.map(event => {
      const startDate = (event.start as any)?.dateTime || (event.start as any)?.date;
      const endDate = (event.end as any)?.dateTime || (event.end as any)?.date;
      
      return {
        id: `microsoft-${event.id}`,
        type: 'event' as ItemType,
        title: event.subject || 'Untitled Event',
        text: event.body?.content || '',
        dateTime: startDate ? new Date(startDate) : null,
        dueDate: endDate ? new Date(endDate) : null,
        metadata: {
          source: 'microsoft-calendar',
          originalId: event.id,
          calendarName: calendar.name,
          calendarId: calendar.id,
          isDefaultCalendar: calendar.isDefault || false,
          location: event.location?.displayName || '',
          isAllDay: !!event.isAllDay,
          organizer: event.organizer?.emailAddress?.address || '',
                     attendees: event.attendees?.map((a: any) => a.emailAddress?.address).filter(Boolean) || [],
          importance: event.importance || 'normal',
          sensitivity: event.sensitivity || 'normal',
          showAs: event.showAs || 'busy',
          webLink: event.webLink,
          bodyType: event.body?.contentType || 'text'
        },
        categoryId: 'imported-microsoft-calendar',
        createdAt: event.createdDateTime ? new Date(event.createdDateTime) : new Date(),
        updatedAt: event.lastModifiedDateTime ? new Date(event.lastModifiedDateTime) : new Date()
      } as Item;
    });
  }

  private async saveConvertedItems(items: Item[], categoryId?: string): Promise<Item[]> {
    if (items.length === 0) return [];

    console.log(`💾 Saving ${items.length} Microsoft Calendar events...`);

    // Ensure we have a category for Microsoft Calendar items
    await this.ensureMicrosoftCalendarCategory();

    // Get existing items to avoid duplicates
    const existingItems = this.getStoredItems();
    const existingMicrosoftIds = new Set(
      existingItems
        .filter(item => item.metadata?.source === 'microsoft-calendar')
        .map(item => item.id)
    );

    // Filter out duplicates and set category
    const newItems = items.filter(item => !existingMicrosoftIds.has(item.id));
    
    if (categoryId) {
      newItems.forEach(item => {
        item.categoryId = categoryId;
      });
    } else {
      newItems.forEach(item => {
        item.categoryId = 'imported-microsoft-calendar';
      });
    }

    if (newItems.length === 0) {
      console.log('📝 No new Microsoft Calendar events to save (all are duplicates)');
      return [];
    }

    // Add to existing items and save
    const updatedItems = [...existingItems, ...newItems];
    this.saveStoredItems(updatedItems);

    console.log(`✅ Saved ${newItems.length} new Microsoft Calendar events`);
    return newItems;
  }

  private async ensureMicrosoftCalendarCategory(): Promise<void> {
    const categories = this.getStoredCategories();
    const microsoftCategory = categories.find(cat => cat.id === 'imported-microsoft-calendar');

    if (!microsoftCategory) {
      const newCategory = {
        id: 'imported-microsoft-calendar',
        name: 'Microsoft Calendar',
        icon: '📆',
        color: '#0078d4',
        priority: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      categories.push(newCategory);
      this.saveStoredCategories(categories);
      console.log('📁 Created Microsoft Calendar category');
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

  // Webhook handling for real-time sync
  async handleWebhook(payload: any): Promise<void> {
    console.log('Microsoft Calendar webhook received:', payload);
    // Handle Microsoft Graph webhooks/change notifications here
    // This would trigger incremental sync of changed events
  }

  // Create a calendar event
  async createEvent(calendarId: string, event: Partial<MicrosoftCalendarEvent>): Promise<MicrosoftCalendarEvent> {
    return this.makeRequest<MicrosoftCalendarEvent>(
      `${this.baseUrl}/me/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: 'POST',
        body: JSON.stringify(event)
      }
    );
  }

  // Update a calendar event
  async updateEvent(
    calendarId: string, 
    eventId: string, 
    event: Partial<MicrosoftCalendarEvent>
  ): Promise<MicrosoftCalendarEvent> {
    return this.makeRequest<MicrosoftCalendarEvent>(
      `${this.baseUrl}/me/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(event)
      }
    );
  }

  // Delete a calendar event
  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    await this.makeRequest<void>(
      `${this.baseUrl}/me/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
      {
        method: 'DELETE'
      }
    );
  }

  // Set up webhooks for real-time sync
  async setupWebhooks(notificationUrl: string): Promise<void> {
    const subscription = {
      changeType: 'created,updated,deleted',
      notificationUrl,
      resource: '/me/events',
      expirationDateTime: new Date(Date.now() + 3600000).toISOString(), // 1 hour
      clientState: `microsoft-calendar-${Date.now()}`
    };

    try {
      await this.makeRequest(
        `${this.baseUrl}/subscriptions`,
        {
          method: 'POST',
          body: JSON.stringify(subscription)
        }
      );
      console.log('✅ Set up Microsoft Calendar webhooks for real-time sync');
    } catch (error) {
      console.error('❌ Failed to set up Microsoft Calendar webhooks:', error);
    }
  }

  // Generate PKCE challenge
  private static generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode.apply(null, Array.from(array)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  private static async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(digest))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  // Static OAuth helper methods
  static async getOAuthUrl(clientId: string, redirectUri: string): Promise<{ url: string; codeVerifier: string }> {
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);
    
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: 'https://graph.microsoft.com/calendars.readwrite offline_access',
      response_mode: 'query',
      prompt: 'consent',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
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
    console.log('🔗 Exchanging Microsoft OAuth code for token...');
    console.log('🕐 Exchange started at:', new Date().toISOString());
    console.log('🔑 Code length:', code.length);
    console.log('🔑 Client ID:', clientId.substring(0, 8) + '...');
    console.log('🔑 Redirect URI:', redirectUri);

    const tokenParams: Record<string, string> = {
      client_id: clientId,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      scope: 'https://graph.microsoft.com/calendars.readwrite offline_access'
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
      console.error('❌ Microsoft OAuth exchange failed:', errorText);
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
          provider: 'microsoft_calendar',
          access_token: result.access_token,
          refresh_token: result.refresh_token,
          token_type: 'Bearer',
          expires_at: expiresAt,
          scope: 'https://graph.microsoft.com/calendars.readwrite offline_access'
        });
        console.log('🔐 Stored Microsoft Calendar token securely in Supabase');
      } else {
        console.warn('⚠️ Cannot store token: User not authenticated');
      }
    } catch (error) {
      console.error('⚠️ Failed to store token securely (but OAuth still succeeded):', error);
    }

    console.log('✅ Microsoft OAuth token exchange successful');
    return result;
  }
} 