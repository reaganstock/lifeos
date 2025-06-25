// Integration provider types
export type IntegrationProvider = 
  | 'todoist' 
  | 'google-calendar' 
  | 'microsoft-calendar' 
  | 'apple-calendar'
  | 'evernote' 
  | 'notion' 
  | 'apple-notes' 
  | 'youtube';

// Integration status
export type IntegrationStatus = 'connected' | 'disconnected' | 'error' | 'syncing';

// Base integration interface
export interface BaseIntegration {
  id: string;
  provider: IntegrationProvider;
  name: string;
  description: string;
  icon: string;
  status: IntegrationStatus;
  connectedAt?: Date;
  lastSyncAt?: Date;
  config?: Record<string, any>;
}

// OAuth configuration
export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string[];
  authUrl: string;
  tokenUrl: string;
}

// API configuration
export interface ApiConfig {
  baseUrl: string;
  version?: string;
  headers?: Record<string, string>;
}

// Integration data types
export interface TodoistTask {
  id: string;
  content: string;
  description?: string;
  completed: boolean;
  priority: number;
  due?: {
    date: string;
    datetime?: string;
  };
  project_id: string;
  labels: string[];
  created_at: string;
  updated_at: string;
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  location?: string;
  attendees?: Array<{
    email: string;
    responseStatus?: string;
  }>;
  recurrence?: string[];
  created: string;
  updated: string;
}

export interface MicrosoftCalendarEvent {
  id: string;
  subject: string;
  body?: {
    content: string;
    contentType: 'text' | 'html';
  };
  start?: {
    dateTime: string;
    timeZone: string;
  } | {
    date: string;
  };
  end?: {
    dateTime: string;
    timeZone: string;
  } | {
    date: string;
  };
  location?: {
    displayName: string;
    address?: any;
  };
  isAllDay?: boolean;
  organizer?: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
  attendees?: Array<{
    emailAddress: {
      name: string;
      address: string;
    };
    status: {
      response: string;
      time: string;
    };
  }>;
  importance?: 'low' | 'normal' | 'high';
  sensitivity?: 'normal' | 'personal' | 'private' | 'confidential';
  showAs?: 'free' | 'tentative' | 'busy' | 'oof' | 'workingElsewhere' | 'unknown';
  webLink?: string;
  createdDateTime?: string;
  lastModifiedDateTime?: string;
  categories?: string[];
  isOnlineMeeting?: boolean;
  onlineMeeting?: {
    joinUrl: string;
  };
}

export interface NotionPage {
  id: string;
  title: string;
  content?: string;
  properties: Record<string, any>;
  created_time: string;
  last_edited_time: string;
  archived: boolean;
  url: string;
}

export interface EvernoteNote {
  guid: string;
  title: string;
  content: string;
  created: number;
  updated: number;
  notebookGuid?: string;
  tagNames?: string[];
  attributes?: {
    author?: string;
    source?: string;
    sourceURL?: string;
  };
}

export interface YouTubeTranscript {
  videoId: string;
  title: string;
  description?: string;
  duration: number;
  author: string;
  transcript: Array<{
    text: string;
    start: number;
    duration: number;
  }>;
  metadata: {
    publishedAt: string;
    viewCount?: number;
    language?: string;
  };
}

// Import/Export types
export interface ImportResult {
  provider: IntegrationProvider;
  totalItems: number;
  importedItems: number;
  failedItems: number;
  errors: string[];
  summary: {
    todos?: number;
    events?: number;
    notes?: number;
    routines?: number;
    goals?: number;
  };
}

export interface ExportOptions {
  format: 'json' | 'csv' | 'markdown' | 'ics' | 'native';
  categories?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  includeCompleted?: boolean;
  includeArchived?: boolean;
}

// Sync configuration
export interface SyncConfig {
  enabled: boolean;
  frequency: 'manual' | 'hourly' | 'daily' | 'weekly';
  direction: 'import' | 'export' | 'bidirectional';
  conflictResolution: 'local' | 'remote' | 'newest' | 'manual';
  categoryMapping: Record<string, string>;
}

// Integration capabilities
export interface IntegrationCapabilities {
  canImport: boolean;
  canExport: boolean;
  canSync: boolean;
  supportsRealtime: boolean;
  supportedItemTypes: Array<'todos' | 'events' | 'notes' | 'goals' | 'routines'>;
  maxBatchSize?: number;
  rateLimits?: {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
  };
}

// Error types
export interface IntegrationError {
  code: string;
  message: string;
  provider: IntegrationProvider;
  timestamp: Date;
  details?: Record<string, any>;
}

// Webhook types
export interface WebhookPayload {
  provider: IntegrationProvider;
  event: string;
  data: any;
  timestamp: Date;
  signature?: string;
} 