import { 
  BaseIntegration as IBaseIntegration,
  IntegrationCapabilities,
  IntegrationError,
  ImportResult,
  ExportOptions,
  SyncConfig,
  IntegrationStatus,
  IntegrationProvider
} from '../types';

export abstract class BaseIntegration {
  protected config: IBaseIntegration;
  protected accessToken?: string;
  protected refreshToken?: string;

  constructor(config: IBaseIntegration) {
    this.config = config;
  }

  // Abstract methods that must be implemented by each integration
  abstract getCapabilities(): IntegrationCapabilities;
  abstract authenticate(): Promise<void>;
  abstract refreshAccessToken(): Promise<void>;
  abstract testConnection(): Promise<boolean>;
  abstract importData(categoryId?: string): Promise<ImportResult>;
  abstract exportData(options: ExportOptions): Promise<void>;

  // Common methods
  public getId(): string {
    return this.config.id;
  }

  public getProvider(): IntegrationProvider {
    return this.config.provider;
  }

  public getName(): string {
    return this.config.name;
  }

  public getStatus(): IntegrationStatus {
    return this.config.status;
  }

  public setStatus(status: IntegrationStatus): void {
    this.config.status = status;
  }

  public isConnected(): boolean {
    return this.config.status === 'connected' && !!this.accessToken;
  }

  public getLastSyncAt(): Date | undefined {
    return this.config.lastSyncAt;
  }

  public updateLastSync(): void {
    this.config.lastSyncAt = new Date();
  }

  // Token management
  public setTokens(accessToken: string, refreshToken?: string): void {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }

  public getAccessToken(): string | undefined {
    return this.accessToken;
  }

  // Error handling
  protected createError(code: string, message: string, details?: Record<string, any>): IntegrationError {
    return {
      code,
      message,
      provider: this.config.provider,
      timestamp: new Date(),
      details
    };
  }

  // Rate limiting helper
  protected async handleRateLimit(retryAfter?: number): Promise<void> {
    const delay = retryAfter ? retryAfter * 1000 : 1000; // Default 1 second
    console.log(`Rate limited for ${this.config.provider}, waiting ${delay}ms`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  // Common HTTP request wrapper with error handling
  protected async makeRequest<T>(
    url: string, 
    options: RequestInit = {},
    retries: number = 3
  ): Promise<T> {
    const headers = {
      'Content-Type': 'application/json',
      ...this.getAuthHeaders(),
      ...options.headers
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '1');
        await this.handleRateLimit(retryAfter);
        
        if (retries > 0) {
          return this.makeRequest<T>(url, options, retries - 1);
        }
      }

      // Handle token refresh
      if (response.status === 401 && this.refreshToken && retries > 0) {
        await this.refreshAccessToken();
        return this.makeRequest<T>(url, options, retries - 1);
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Request failed for ${this.config.provider}:`, error);
      throw this.createError(
        'REQUEST_FAILED',
        `Failed to make request: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { url, error }
      );
    }
  }

  // Get auth headers (override in specific integrations)
  protected getAuthHeaders(): Record<string, string> {
    if (this.accessToken) {
      return {
        'Authorization': `Bearer ${this.accessToken}`
      };
    }
    return {};
  }

  // Data transformation helpers
  protected formatDate(date: string | Date): string {
    return new Date(date).toISOString();
  }

  protected parseDate(dateString: string): Date {
    return new Date(dateString);
  }

  // Pagination helper
  protected async getAllPages<T>(
    fetcher: (nextPageToken?: string) => Promise<{ items: T[], nextPageToken?: string }>,
    maxPages: number = 100
  ): Promise<T[]> {
    const allItems: T[] = [];
    let nextPageToken: string | undefined;
    let pageCount = 0;

    do {
      const response = await fetcher(nextPageToken);
      allItems.push(...response.items);
      nextPageToken = response.nextPageToken;
      pageCount++;
    } while (nextPageToken && pageCount < maxPages);

    return allItems;
  }

  // Batch processing helper
  protected async processBatch<T, R>(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    batchSize: number = 50
  ): Promise<R[]> {
    const results: R[] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await processor(batch);
      results.push(...batchResults);
      
      // Small delay between batches to avoid overwhelming APIs
      if (i + batchSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  // Configuration helpers
  public updateConfig(updates: Partial<IBaseIntegration>): void {
    this.config = { ...this.config, ...updates };
  }

  public getConfig(): IBaseIntegration {
    return { ...this.config };
  }

  // Cleanup method
  public async disconnect(): Promise<void> {
    this.accessToken = undefined;
    this.refreshToken = undefined;
    this.setStatus('disconnected');
  }
} 