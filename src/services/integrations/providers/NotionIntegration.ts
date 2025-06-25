import { BaseIntegration } from '../base/BaseIntegration';
import { 
  IntegrationCapabilities, 
  ImportResult, 
  ExportOptions, 
  NotionPage,
  BaseIntegration as IBaseIntegration
} from '../types';
import { IntegrationTokenService } from '../../integrationTokenService';

// Types will be imported from the main app
type Item = any;
type ItemType = 'todo' | 'note' | 'event' | 'goal' | 'routine';

export class NotionIntegration extends BaseIntegration {
  private readonly baseUrl = 'https://api.notion.com/v1';
  private readonly notionVersion = '2022-06-28';
  private readonly supabaseUrl = 'https://upkyravoehbslbywitar.supabase.co';
  private readonly supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwa3lyYXZvZWhic2xieXdpdGFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg1NjI4MDgsImV4cCI6MjA2NDEzODgwOH0.4lVuvAZCWbZ3Uk1aBqlXPY84jctN8CVmi-8KzkAwqd8';

  constructor(config: IBaseIntegration) {
    super(config);
  }

  getCapabilities(): IntegrationCapabilities {
    return {
      canImport: true,
      canExport: true,
      canSync: true,
      supportsRealtime: false,
      supportedItemTypes: ['notes', 'todos', 'goals'],
      maxBatchSize: 100,
      rateLimits: {
        requestsPerMinute: 100,
        requestsPerHour: 100 * 60,
        requestsPerDay: 100 * 60 * 24
      }
    };
  }

  async authenticate(): Promise<void> {
    // Try to load token from secure storage first
    const storedToken = await IntegrationTokenService.getToken('notion');
    if (storedToken) {
      console.log('🔐 Loaded Notion token from secure storage');
      this.accessToken = storedToken.access_token;
    } else if (!this.accessToken) {
      throw this.createError('NO_TOKEN', 'Notion integration token is required');
    }

    const isValid = await this.testConnection();
    if (!isValid) {
      throw this.createError('INVALID_TOKEN', 'Invalid Notion integration token');
    }

    // Store token securely if we have one and it's valid
    if (this.accessToken && !storedToken) {
      await IntegrationTokenService.storeToken('notion', {
        access_token: this.accessToken,
        token_type: 'Bearer'
      });
      console.log('🔐 Stored Notion token securely');
    }

    this.setStatus('connected');
  }

  async refreshAccessToken(): Promise<void> {
    // Notion integration tokens don't expire
    const isValid = await this.testConnection();
    if (!isValid) {
      this.setStatus('error');
      throw this.createError('TOKEN_INVALID', 'Notion integration token is no longer valid');
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.makeRequest<any>(`${this.baseUrl}/users/me`);
      return true;
    } catch (error) {
      console.error('Notion connection test failed:', error);
      return false;
    }
  }

  async importData(categoryId?: string): Promise<ImportResult> {
    this.setStatus('syncing');
    
    try {
      console.log('🔍 Starting Notion import...');
      const databases = await this.searchDatabases();
      const pages = await this.searchPages();
      
      console.log(`📊 Found ${databases.length} databases and ${pages.length} pages in Notion`);
      console.log('📊 Databases:', databases.map(db => ({ id: db.id, title: db.title })));
      console.log('📊 Pages:', pages.map(page => ({ id: page.id, title: page.title })));
      
      let totalItems = 0;
      let importedItems = 0;
      const errors: string[] = [];

      // Import database pages (structured data)
      let allConvertedItems: Item[] = [];
      
      for (const database of databases) {
        try {
          const databasePages = await this.getDatabasePages(database.id);
          const convertedPages = await this.convertNotionPagesToItems(databasePages, 'database');
          
          totalItems += databasePages.length;
          allConvertedItems.push(...convertedPages);
        } catch (error) {
          errors.push(`Failed to import database ${database.title}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Import regular pages (unstructured content)
      const convertedPages = await this.convertNotionPagesToItems(pages, 'page');
      totalItems += pages.length;
      allConvertedItems.push(...convertedPages);
      
      // Actually save the items to localStorage
      const savedItems = await this.saveConvertedItems(allConvertedItems, categoryId);
      importedItems = savedItems.length;
      
      const result: ImportResult = {
        provider: 'notion',
        totalItems,
        importedItems,
        failedItems: totalItems - importedItems,
        errors,
        summary: {
          notes: importedItems
        }
      };

      this.updateLastSync();
      this.setStatus('connected');
      
      return result;
    } catch (error) {
      this.setStatus('error');
      throw this.createError(
        'IMPORT_FAILED',
        `Failed to import from Notion: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async exportData(options: ExportOptions): Promise<void> {
    // Implementation for exporting data to Notion
    throw new Error('Export to Notion not yet implemented');
  }

  // Notion-specific methods
  private async searchDatabases(): Promise<Array<{ id: string; title: string; properties: any }>> {
    const response = await this.makeRequest<{ results: Array<{ id: string; title: any[]; properties: any }> }>
      (`${this.baseUrl}/search`, {
        method: 'POST',
        body: JSON.stringify({
          filter: {
            value: 'database',
            property: 'object'
          }
        })
      });

    return response.results.map(db => ({
      id: db.id,
      title: this.extractPlainText(db.title),
      properties: db.properties
    }));
  }

  private async searchPages(): Promise<NotionPage[]> {
    const response = await this.makeRequest<{ results: any[] }>
      (`${this.baseUrl}/search`, {
        method: 'POST',
        body: JSON.stringify({
          filter: {
            value: 'page',
            property: 'object'
          }
        })
      });

    return response.results.map(page => this.formatNotionPage(page));
  }

  private async getDatabasePages(databaseId: string): Promise<any[]> {
    return this.getAllPages(async (nextCursor) => {
      const body: any = {
        page_size: 100
      };
      
      if (nextCursor) {
        body.start_cursor = nextCursor;
      }

      const response = await this.makeRequest<{ 
        results: any[], 
        next_cursor?: string,
        has_more: boolean 
      }>(`${this.baseUrl}/databases/${databaseId}/query`, {
        method: 'POST',
        body: JSON.stringify(body)
      });
      
      return {
        items: response.results,
        nextPageToken: response.has_more ? response.next_cursor : undefined
      };
    });
  }

  private async getPageContent(pageId: string): Promise<string> {
    try {
      const response = await this.makeRequest<{ results: any[] }>
        (`${this.baseUrl}/blocks/${pageId}/children`);
      
      return response.results
        .map(block => this.extractBlockText(block))
        .filter(text => text.length > 0)
        .join('\n');
    } catch (error) {
      console.error(`Failed to get content for page ${pageId}:`, error);
      return '';
    }
  }

  private extractBlockText(block: any): string {
    switch (block.type) {
      case 'paragraph':
        return this.extractRichText(block.paragraph?.rich_text || []);
      case 'heading_1':
        return `# ${this.extractRichText(block.heading_1?.rich_text || [])}`;
      case 'heading_2':
        return `## ${this.extractRichText(block.heading_2?.rich_text || [])}`;
      case 'heading_3':
        return `### ${this.extractRichText(block.heading_3?.rich_text || [])}`;
      case 'bulleted_list_item':
        return `- ${this.extractRichText(block.bulleted_list_item?.rich_text || [])}`;
      case 'numbered_list_item':
        return `1. ${this.extractRichText(block.numbered_list_item?.rich_text || [])}`;
      case 'to_do':
        const checked = block.to_do?.checked ? '[x]' : '[ ]';
        return `${checked} ${this.extractRichText(block.to_do?.rich_text || [])}`;
      case 'code':
        const language = block.code?.language || '';
        const code = this.extractRichText(block.code?.rich_text || []);
        return `\`\`\`${language}\n${code}\n\`\`\``;
      case 'quote':
        return `> ${this.extractRichText(block.quote?.rich_text || [])}`;
      case 'callout':
        const emoji = block.callout?.icon?.emoji || '💡';
        const calloutText = this.extractRichText(block.callout?.rich_text || []);
        return `${emoji} ${calloutText}`;
      case 'toggle':
        return `▶ ${this.extractRichText(block.toggle?.rich_text || [])}`;
      case 'divider':
        return '---';
      case 'table_row':
        const cells = block.table_row?.cells || [];
        return cells.map((cell: any[]) => this.extractRichText(cell)).join(' | ');
      case 'equation':
        return `$$${block.equation?.expression || ''}$$`;
      case 'embed':
        return `[Embed: ${block.embed?.url || 'Unknown'}]`;
      case 'bookmark':
        return `[Bookmark: ${block.bookmark?.url || 'Unknown'}]`;
      case 'image':
        const imageUrl = block.image?.file?.url || block.image?.external?.url;
        return `[Image: ${imageUrl || 'Unknown'}]`;
      case 'video':
        const videoUrl = block.video?.file?.url || block.video?.external?.url;
        return `[Video: ${videoUrl || 'Unknown'}]`;
      case 'file':
        const fileUrl = block.file?.file?.url || block.file?.external?.url;
        const fileName = block.file?.name || 'Unknown file';
        return `[File: ${fileName} - ${fileUrl || 'Unknown'}]`;
      default:
        // Try to extract any rich_text content from unknown block types
        if (block[block.type]?.rich_text) {
          return this.extractRichText(block[block.type].rich_text);
        }
        return '';
    }
  }

  private extractRichText(richText: any[]): string {
    return richText.map(text => {
      let content = text.plain_text || '';
      
      // Apply formatting if present
      if (text.annotations) {
        if (text.annotations.bold) content = `**${content}**`;
        if (text.annotations.italic) content = `*${content}*`;
        if (text.annotations.strikethrough) content = `~~${content}~~`;
        if (text.annotations.underline) content = `__${content}__`;
        if (text.annotations.code) content = `\`${content}\``;
      }
      
      // Handle links
      if (text.href) {
        content = `[${content}](${text.href})`;
      }
      
      return content;
    }).join('');
  }

  private extractPlainText(textArray: any[]): string {
    return textArray.map(item => item.plain_text || '').join('');
  }

  private formatNotionPage(page: any): NotionPage {
    return {
      id: page.id,
      title: this.extractPlainText(page.properties?.title?.title || page.properties?.Name?.title || []) || 'Untitled',
      properties: page.properties,
      created_time: page.created_time,
      last_edited_time: page.last_edited_time,
      archived: page.archived || false,
      url: page.url
    };
  }

  private async convertNotionPagesToItems(
    pages: (NotionPage | any)[], 
    type: 'database' | 'page'
  ): Promise<Item[]> {
    const items: Item[] = [];

    for (const page of pages) {
      try {
        const formattedPage = type === 'page' ? page : this.formatNotionPage(page);
        const content = await this.getPageContent(formattedPage.id);
        
        // Determine item type based on content and properties
        const itemType = this.determineItemType(formattedPage, content);
        
        const item = {
          id: `notion-${formattedPage.id}`,
          type: itemType,
          title: formattedPage.title,
          description: content,
          content: content,
          categoryId: 'imported-notion',
          completed: this.extractCompletionStatus(formattedPage),
          metadata: {
            source: 'notion',
            originalId: formattedPage.id,
            notionUrl: formattedPage.url,
            properties: formattedPage.properties,
            sourceType: type
          },
          createdAt: new Date(formattedPage.created_time),
          updatedAt: new Date(formattedPage.last_edited_time)
        } as Item;

        items.push(item);
      } catch (error) {
        console.error(`Failed to convert Notion page ${page.id}:`, error);
      }
    }

    return items;
  }

  private determineItemType(page: NotionPage, content: string): ItemType {
    // Check properties for type hints
    const properties = page.properties || {};
    
    // Look for status/checkbox properties (todos)
    for (const [key, prop] of Object.entries(properties)) {
      if (prop.type === 'checkbox' || prop.type === 'status') {
        return 'todo';
      }
    }

    // Look for date properties (events/goals)
    const hasDateProperty = Object.values(properties).some((prop: any) => prop.type === 'date');
    if (hasDateProperty) {
      // If it has goals/progress related keywords, treat as goal
      if (this.containsGoalKeywords(page.title, content)) {
        return 'goal';
      }
      return 'event';
    }

    // Default to note
    return 'note';
  }

  private containsGoalKeywords(title: string, content: string): boolean {
    const goalKeywords = ['goal', 'objective', 'target', 'progress', 'milestone', 'achievement'];
    const text = `${title} ${content}`.toLowerCase();
    return goalKeywords.some(keyword => text.includes(keyword));
  }

  private extractCompletionStatus(page: NotionPage): boolean {
    const properties = page.properties || {};
    
    for (const prop of Object.values(properties)) {
      if ((prop as any).type === 'checkbox') {
        return (prop as any).checkbox || false;
      }
      if ((prop as any).type === 'status') {
        const status = (prop as any).status?.name?.toLowerCase() || '';
        return status === 'done' || status === 'completed' || status === 'finished';
      }
    }
    
    return false;
  }

  private async saveConvertedItems(items: Item[], categoryId?: string): Promise<Item[]> {
    const savedItems: Item[] = [];
    
    try {
      // Ensure we have a category for imported Notion items (only if using default category)
      if (!categoryId) {
        await this.ensureNotionCategory();
      }
      
      const existingItems = this.getStoredItems();
      
      // Filter out items that might already exist (by Notion ID and title to avoid duplicates)
      const existingNotionIds = new Set(existingItems
        .filter(item => item.metadata?.source === 'notion')
        .map(item => item.metadata?.originalId));
      
      const existingTitles = new Set(existingItems.map(item => item.title.toLowerCase().trim()));
      
      const newItems = items.filter(item => {
        // Skip if we already have this Notion item
        if (existingNotionIds.has(item.metadata?.originalId)) {
          console.log(`🔄 Skipping existing Notion item: "${item.title}"`);
          return false;
        }
        
        // Skip if we have an item with the same title
        if (existingTitles.has(item.title.toLowerCase().trim())) {
          console.log(`🔄 Skipping duplicate title: "${item.title}"`);
          return false;
        }
        
        return true;
      });
      
      console.log(`💾 Saving ${newItems.length} new Notion items (${items.length - newItems.length} duplicates skipped)`);
      
      // Add new items to existing ones
      const allItems = [...existingItems, ...newItems];
      this.saveStoredItems(allItems);
      
      savedItems.push(...newItems);
      
      console.log(`✅ Successfully saved ${savedItems.length} Notion items to localStorage`);
      
    } catch (error) {
      console.error('❌ Error saving Notion items:', error);
      throw error;
    }
    
    return savedItems;
  }

  private async ensureNotionCategory(): Promise<void> {
    const categories = this.getStoredCategories();
    
    // Check if Notion category already exists
    const notionCategoryExists = categories.some(cat => 
      cat.id === 'imported-notion' || cat.name === 'Notion Import'
    );
    
    if (!notionCategoryExists) {
      console.log('📁 Creating Notion Import category...');
      
      const notionCategory = {
        id: 'imported-notion',
        name: 'Notion Import',
        description: 'Items imported from Notion',
        color: '#000000', // Notion's brand color
        icon: '📝',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      categories.push(notionCategory);
      this.saveStoredCategories(categories);
      
      console.log('✅ Created Notion Import category');
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
      console.log(`📁 Saved ${categories.length} categories to localStorage (lifeStructureCategories)`);
      
      // Dispatch custom event for real-time UI updates
      window.dispatchEvent(new CustomEvent('categoriesModified', {
        detail: { categories, timestamp: Date.now() }
      }));
      console.log('📡 Dispatched categoriesModified event for real-time updates');
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

  // Create a new page in Notion
  async createPage(parentId: string, properties: any, content?: any[]): Promise<NotionPage> {
    const pageData: any = {
      parent: { page_id: parentId },
      properties
    };

    if (content) {
      pageData.children = content;
    }

    const response = await this.makeRequest<any>(`${this.baseUrl}/pages`, {
      method: 'POST',
      body: JSON.stringify(pageData)
    });

    return this.formatNotionPage(response);
  }

  // Create a new database
  async createDatabase(parentId: string, title: string, properties: any): Promise<any> {
    const databaseData = {
      parent: { page_id: parentId },
      title: [
        {
          type: 'text',
          text: { content: title }
        }
      ],
      properties
    };

    return this.makeRequest<any>(`${this.baseUrl}/databases`, {
      method: 'POST',
      body: JSON.stringify(databaseData)
    });
  }

  // Override makeRequest to use Supabase function
  protected async makeRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
    const endpoint = url.replace(this.baseUrl, '');
    
    console.log(`🔗 Making Notion API call via Supabase: ${options.method || 'GET'} ${endpoint}`);
    
    const functionUrl = `${this.supabaseUrl}/functions/v1/notion-oauth`;
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.supabaseAnonKey}`
      },
      body: JSON.stringify({
        action: 'api_call',
        endpoint,
        method: options.method || 'GET',
        body: options.body ? JSON.parse(options.body as string) : undefined,
        accessToken: this.accessToken
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Supabase function error:`, errorText);
      throw new Error(`Request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log(`✅ Notion API call successful via Supabase: ${options.method || 'GET'} ${endpoint}`);
    return result;
  }

  // Override auth headers for Notion
  protected getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Notion-Version': this.notionVersion
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    return headers;
  }

  // Static OAuth helper methods (for Notion OAuth)
  static getOAuthUrl(clientId: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      owner: 'user'
    });

    return `https://api.notion.com/v1/oauth/authorize?${params.toString()}`;
  }

  static async exchangeCodeForToken(
    code: string, 
    clientId: string, 
    clientSecret: string,
    redirectUri: string
  ): Promise<{ access_token: string; bot_id: string; workspace_name: string }> {
    console.log('🔗 Exchanging Notion OAuth code for token via Supabase...');
    console.log('📝 Request details:', {
      clientId: clientId.substring(0, 8) + '...',
      redirectUri,
      codeLength: code.length
    });

    try {
      const supabaseUrl = 'https://upkyravoehbslbywitar.supabase.co';
      const functionUrl = `${supabaseUrl}/functions/v1/notion-oauth`;
      
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwa3lyYXZvZWhic2xieXdpdGFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg1NjI4MDgsImV4cCI6MjA2NDEzODgwOH0.4lVuvAZCWbZ3Uk1aBqlXPY84jctN8CVmi-8KzkAwqd8`
        },
        body: JSON.stringify({
          action: 'exchange_token',
          code,
          clientId,
          clientSecret,
          redirectUri
        })
      });

      console.log('📡 Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ OAuth exchange error response:', errorText);
        throw new Error(`OAuth exchange failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ OAuth token exchange successful via Supabase');
      
      // Store the token securely in Supabase
      try {
        await IntegrationTokenService.storeToken('notion', {
          access_token: result.access_token,
          token_type: 'Bearer',
          bot_id: result.bot_id,
          workspace_name: result.workspace_name
        });
        console.log('🔐 Stored Notion token securely in Supabase');
      } catch (error) {
        console.error('⚠️ Failed to store token securely (but OAuth still succeeded):', error);
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ OAuth token exchange failed:', error);
      throw error;
    }
  }
} 