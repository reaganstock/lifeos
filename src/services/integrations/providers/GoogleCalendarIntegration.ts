import { BaseIntegration } from '../base/BaseIntegration';
import { 
  IntegrationCapabilities, 
  ImportResult, 
  ExportOptions, 
  GoogleCalendarEvent,
  BaseIntegration as IBaseIntegration
} from '../types';

// Types will be imported from the main app
type Item = any;
type ItemType = 'todo' | 'note' | 'event' | 'goal' | 'routine';

export class GoogleCalendarIntegration extends BaseIntegration {
  private readonly baseUrl = 'https://www.googleapis.com/calendar/v3';

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
        requestsPerMinute: 1000,
        requestsPerHour: 1000000,
        requestsPerDay: 1000000000
      }
    };
  }

  async authenticate(): Promise<void> {
    if (!this.accessToken) {
      throw this.createError('NO_TOKEN', 'Google Calendar access token is required');
    }

    const isValid = await this.testConnection();
    if (!isValid) {
      throw this.createError('INVALID_TOKEN', 'Invalid Google Calendar access token');
    }

    this.setStatus('connected');
  }

  async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      throw this.createError('NO_REFRESH_TOKEN', 'No refresh token available');
    }

    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID || '',
          client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
          refresh_token: this.refreshToken,
          grant_type: 'refresh_token'
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
        `Failed to refresh Google Calendar token: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.makeRequest<any>(`${this.baseUrl}/users/me/calendarList`);
      return true;
    } catch (error) {
      console.error('Google Calendar connection test failed:', error);
      return false;
    }
  }

  async importData(categoryId?: string): Promise<ImportResult> {
    this.setStatus('syncing');
    
    try {
      const calendars = await this.getCalendarList();
      let totalEvents = 0;
      let importedEvents = 0;
      const errors: string[] = [];

      for (const calendar of calendars) {
        try {
          const events = await this.getCalendarEvents(calendar.id);
          const convertedEvents = await this.convertGoogleEventsToItems(events, calendar);
          
          totalEvents += events.length;
          importedEvents += convertedEvents.length;
          
          // Here you would save to your database
          console.log(`Imported ${convertedEvents.length} events from calendar: ${calendar.summary}`);
        } catch (error) {
          errors.push(`Failed to import calendar ${calendar.summary}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      const result: ImportResult = {
        provider: 'google-calendar',
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
      
      return result;
    } catch (error) {
      this.setStatus('error');
      throw this.createError(
        'IMPORT_FAILED',
        `Failed to import from Google Calendar: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async exportData(options: ExportOptions): Promise<void> {
    // Implementation for exporting data to Google Calendar
    throw new Error('Export to Google Calendar not yet implemented');
  }

  // Google Calendar-specific methods
  private async getCalendarList(): Promise<Array<{ id: string; summary: string; primary?: boolean }>> {
    const response = await this.makeRequest<{ items: Array<{ id: string; summary: string; primary?: boolean }> }>
      (`${this.baseUrl}/users/me/calendarList`);
    return response.items;
  }

  private async getCalendarEvents(calendarId: string): Promise<GoogleCalendarEvent[]> {
    const now = new Date();
    const oneMonthAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    const oneMonthFromNow = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));

    const params = new URLSearchParams({
      timeMin: oneMonthAgo.toISOString(),
      timeMax: oneMonthFromNow.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '2500'
    });

    return this.getAllPages(async (pageToken) => {
      if (pageToken) {
        params.set('pageToken', pageToken);
      }
      
      const response = await this.makeRequest<{ 
        items: GoogleCalendarEvent[], 
        nextPageToken?: string 
      }>(`${this.baseUrl}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`);
      
      return {
        items: response.items || [],
        nextPageToken: response.nextPageToken
      };
    });
  }

  private async convertGoogleEventsToItems(
    events: GoogleCalendarEvent[], 
    calendar: { id: string; summary: string; primary?: boolean }
  ): Promise<Item[]> {
    return events.map(event => {
      const startDate = event.start.dateTime || event.start.date;
      const endDate = event.end.dateTime || event.end.date;
      
      return {
        id: `google-${event.id}`,
        type: 'event' as ItemType,
        title: event.summary || 'Untitled Event',
        description: event.description || '',
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        location: event.location || '',
        isAllDay: !!event.start.date, // All-day events use 'date' instead of 'dateTime'
        categoryId: 'imported-google-calendar',
        attendees: event.attendees?.map(a => a.email) || [],
        recurrence: event.recurrence || [],
        metadata: {
          source: 'google-calendar',
          originalId: event.id,
          calendarName: calendar.summary,
          calendarId: calendar.id,
          isPrimaryCalendar: calendar.primary || false
        },
        createdAt: new Date(event.created),
        updatedAt: new Date(event.updated)
      } as Item;
    });
  }

  // Webhook handling for real-time sync
  async handleWebhook(payload: any): Promise<void> {
    console.log('Google Calendar webhook received:', payload);
    // Handle Google Calendar push notifications here
    // This would trigger incremental sync of changed events
  }

  // Create a calendar event
  async createEvent(calendarId: string, event: Partial<GoogleCalendarEvent>): Promise<GoogleCalendarEvent> {
    return this.makeRequest<GoogleCalendarEvent>(
      `${this.baseUrl}/calendars/${encodeURIComponent(calendarId)}/events`,
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
    event: Partial<GoogleCalendarEvent>
  ): Promise<GoogleCalendarEvent> {
    return this.makeRequest<GoogleCalendarEvent>(
      `${this.baseUrl}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
      {
        method: 'PUT',
        body: JSON.stringify(event)
      }
    );
  }

  // Delete a calendar event
  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    await this.makeRequest<void>(
      `${this.baseUrl}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
      {
        method: 'DELETE'
      }
    );
  }

  // Set up push notifications for real-time sync
  async setupPushNotifications(webhookUrl: string): Promise<void> {
    const watchRequest = {
      id: `watch-${Date.now()}`,
      type: 'web_hook',
      address: webhookUrl,
      params: {
        ttl: '3600' // 1 hour
      }
    };

    const calendars = await this.getCalendarList();
    
    for (const calendar of calendars) {
      try {
        await this.makeRequest(
          `${this.baseUrl}/calendars/${encodeURIComponent(calendar.id)}/events/watch`,
          {
            method: 'POST',
            body: JSON.stringify(watchRequest)
          }
        );
        console.log(`Set up push notifications for calendar: ${calendar.summary}`);
      } catch (error) {
        console.error(`Failed to set up push notifications for calendar ${calendar.summary}:`, error);
      }
    }
  }

  // Static OAuth helper methods
  static getOAuthUrl(clientId: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/calendar',
      access_type: 'offline',
      prompt: 'consent'
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  static async exchangeCodeForToken(
    code: string, 
    clientId: string, 
    clientSecret: string,
    redirectUri: string
  ): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
      })
    });

    if (!response.ok) {
      throw new Error(`OAuth exchange failed: ${response.statusText}`);
    }

    return await response.json();
  }
} 