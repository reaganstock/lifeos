import { BaseIntegration } from '../base/BaseIntegration';
import { 
  IntegrationCapabilities, 
  ImportResult, 
  ExportOptions, 
  TodoistTask,
  BaseIntegration as IBaseIntegration
} from '../types';
import { IntegrationTokenService } from '../../integrationTokenService';
import { supabase } from '../../../lib/supabase';
// Types will be imported from the main app
type Item = any;
type ItemType = 'todo' | 'note' | 'event' | 'goal' | 'routine';

export class TodoistIntegration extends BaseIntegration {
  private readonly baseUrl = 'https://api.todoist.com/rest/v2';

  constructor(config: IBaseIntegration) {
    super(config);
  }

  getCapabilities(): IntegrationCapabilities {
    return {
      canImport: true,
      canExport: true,
      canSync: true,
      supportsRealtime: false,
      supportedItemTypes: ['todos'],
      maxBatchSize: 100,
      rateLimits: {
        requestsPerMinute: 450,
        requestsPerHour: 450 * 60,
        requestsPerDay: 450 * 60 * 24
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
    const storedToken = await IntegrationTokenService.getToken(user.id, 'todoist');
    if (storedToken) {
      console.log('🔐 Loaded Todoist token from Supabase');
      this.accessToken = storedToken.access_token;
    } else if (!this.accessToken) {
      throw this.createError('NO_TOKEN', 'Todoist API token is required');
    }

    // Test the connection
    const isValid = await this.testConnection();
    if (!isValid) {
      throw this.createError('INVALID_TOKEN', 'Invalid Todoist API token');
    }

    // Store token securely if we have one and it's valid
    if (this.accessToken && !storedToken) {
      await IntegrationTokenService.storeToken({
        user_id: user.id,
        provider: 'todoist',
        access_token: this.accessToken,
        token_type: 'Bearer'
      });
      console.log('🔐 Stored Todoist token securely in Supabase');
    }

    this.setStatus('connected');
  }

  async refreshAccessToken(): Promise<void> {
    // Todoist API tokens don't expire, so no refresh needed
    // Just test if the current token is still valid
    const isValid = await this.testConnection();
    if (!isValid) {
      this.setStatus('error');
      throw this.createError('TOKEN_INVALID', 'Todoist API token is no longer valid');
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.makeRequest<any>(`${this.baseUrl}/projects`);
      return true;
    } catch (error) {
      console.error('Todoist connection test failed:', error);
      return false;
    }
  }

  async importData(categoryId?: string): Promise<ImportResult> {
    this.setStatus('syncing');
    
    try {
      const tasks = await this.getTodoistTasks();
      const projects = await this.getTodoistProjects();
      
      console.log(`📥 Fetched ${tasks.length} active tasks and ${projects.length} projects from Todoist`);
      
      if (tasks.length === 0) {
        console.log('ℹ️ No active tasks found to import');
        return {
          provider: 'todoist',
          totalItems: 0,
          importedItems: 0,
          failedItems: 0,
          errors: [],
          summary: { todos: 0 }
        };
      }
      
      // Convert Todoist tasks to our Item format
      const convertedItems = await this.convertTodoistTasksToItems(tasks, projects, categoryId);
      
      console.log(`🔄 Converted ${convertedItems.length} Todoist tasks to internal format`);
      
      if (convertedItems.length === 0) {
        console.log('⚠️ No items to save after conversion');
        return {
          provider: 'todoist',
          totalItems: tasks.length,
          importedItems: 0,
          failedItems: tasks.length,
          errors: ['No valid items to import after conversion'],
          summary: { todos: 0 }
        };
      }
      
      // Now actually save the items to the database using localStorage or Supabase
      const savedItems = await this.saveConvertedItems(convertedItems, categoryId);
      
      const duplicateCount = convertedItems.length - savedItems.length;
      const result: ImportResult = {
        provider: 'todoist',
        totalItems: tasks.length,
        importedItems: savedItems.length,
        failedItems: Math.max(0, duplicateCount),
        errors: duplicateCount > 0 ? 
          [`${duplicateCount} items already exist (duplicates skipped)`] : [],
        summary: {
          todos: savedItems.length
        }
      };

      this.updateLastSync();
      this.setStatus('connected');
      
      console.log(`✅ Todoist import completed: ${savedItems.length}/${tasks.length} items saved`);
      
      return result;
    } catch (error) {
      this.setStatus('error');
      throw this.createError(
        'IMPORT_FAILED',
        `Failed to import from Todoist: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async exportData(options: ExportOptions): Promise<void> {
    // Implementation for exporting data to Todoist
    // This would convert your internal items to Todoist format and create them
    throw new Error('Export to Todoist not yet implemented');
  }

  // Todoist-specific methods
  private async getTodoistTasks(): Promise<TodoistTask[]> {
    console.log('🔍 Fetching Todoist tasks...');
    const allTasks = await this.makeRequest<TodoistTask[]>(`${this.baseUrl}/tasks`);
    console.log(`📋 Retrieved ${allTasks.length} total tasks from Todoist API`);
    
    // Filter out completed tasks and tutorial/onboarding tasks
    const activeTasks = allTasks.filter(task => {
      // Skip completed tasks
      if (task.completed) {
        console.log(`⏭️ Skipping completed task: "${task.content}"`);
        return false;
      }
      
      // Skip common tutorial/onboarding tasks
      const tutorialKeywords = [
        'Add your first task',
        'Check off tasks',
        'Add your first Project',
        'Download Todoist',
        'Subscribe for monthly',
        'Explore our templates',
        'Connect your calendar',
        'Add Todoist to your email',
        'Set aside 5 minutes',
        'Go to your `Upcoming`',
        'Type **`q`**',
        'Switching from written lists',
        'Add tasks as soon as they come to mind',
        'curated templates',
        'productivity inspiration',
        'first task',
        'first Project'
      ];
      
      const isTutorial = tutorialKeywords.some(keyword => 
        task.content.toLowerCase().includes(keyword.toLowerCase())
      );
      
      if (isTutorial) {
        console.log(`📚 Skipping tutorial task: "${task.content}"`);
        return false;
      }
      
      return true;
    });
    
    console.log(`✅ Filtered to ${activeTasks.length} active, non-tutorial tasks`);
    console.log('📋 Active tasks:', activeTasks.map(t => ({ id: t.id, content: t.content, completed: t.completed })));
    
    return activeTasks;
  }

  private async getTodoistProjects(): Promise<Array<{ id: string; name: string; color: string }>> {
    console.log('🔍 Fetching Todoist projects...');
    const projects = await this.makeRequest<Array<{ id: string; name: string; color: string }>>(`${this.baseUrl}/projects`);
    console.log(`📁 Retrieved ${projects.length} projects from Todoist API`);
    console.log('📁 Projects:', projects.map(p => ({ id: p.id, name: p.name })));
    return projects;
  }

  private async convertTodoistTasksToItems(
    tasks: TodoistTask[], 
    projects: Array<{ id: string; name: string; color: string }>,
    categoryId?: string
  ): Promise<Item[]> {
    const projectMap = new Map(projects.map(p => [p.id, p]));
    
    console.log('🔄 Converting Todoist tasks to internal format...');
    
    const convertedItems = tasks.map(task => {
      const project = projectMap.get(task.project_id);
      
      // Parse due date properly
      let dueDate: Date | undefined;
      if (task.due?.datetime) {
        dueDate = new Date(task.due.datetime);
      } else if (task.due?.date) {
        dueDate = new Date(task.due.date);
      }
      
      const item = {
        id: `todoist-${task.id}`,
        type: 'todo' as ItemType,
        title: task.content,
        text: task.description || '', // Use 'text' instead of 'description'
        completed: task.completed || false,
        categoryId: categoryId || 'imported-todoist', // Use provided category or default
        createdAt: new Date(task.created_at),
        updatedAt: new Date(task.updated_at),
        dueDate: dueDate,
        metadata: {
          priority: this.mapTodoistPriority(task.priority),
          source: 'todoist',
          originalId: task.id,
          projectName: project?.name,
          projectColor: project?.color,
          tags: task.labels || []
        }
      } as Item;
      
      return item;
    });
    
    console.log('✅ Sample converted items:', convertedItems.slice(0, 2).map(item => ({
      id: item.id,
      title: item.title,
      type: item.type,
      completed: item.completed,
      categoryId: item.categoryId
    })));
    
    return convertedItems;
  }

  private mapTodoistPriority(todoistPriority: number): 'low' | 'medium' | 'high' | 'urgent' {
    // Todoist priority: 1 (normal) to 4 (urgent)
    switch (todoistPriority) {
      case 4: return 'urgent';
      case 3: return 'high';
      case 2: return 'medium';
      default: return 'low';
    }
  }

  private async saveConvertedItems(items: Item[], categoryId?: string): Promise<Item[]> {
    const savedItems: Item[] = [];
    
    // For now, save to localStorage as the app does
    // In the future, this could be enhanced to use Supabase directly
    try {
      // Ensure we have a category for imported Todoist items (only if using default category)
      if (!categoryId) {
        await this.ensureTodoistCategory();
      }
      
      const existingItems = this.getStoredItems();
      
      // Filter out items that might already exist (by Todoist ID and title to avoid duplicates)
      const existingTodoistIds = new Set(existingItems
        .filter(item => item.metadata?.source === 'todoist')
        .map(item => item.metadata?.originalId));
      
      const existingTitles = new Set(existingItems.map(item => item.title.toLowerCase().trim()));
      
      const newItems = items.filter(item => {
        // Skip if we already have this Todoist item
        if (existingTodoistIds.has(item.metadata?.originalId)) {
          console.log(`🔄 Skipping existing Todoist item: "${item.title}"`);
          return false;
        }
        
        // Skip if we have an item with the same title
        if (existingTitles.has(item.title.toLowerCase().trim())) {
          console.log(`🔄 Skipping duplicate title: "${item.title}"`);
          return false;
        }
        
        return true;
      });
      
      console.log(`💾 Saving ${newItems.length} new items (filtered out ${items.length - newItems.length} duplicates)`);
      
      // Add the new items
      const updatedItems = [...existingItems, ...newItems];
      this.saveStoredItems(updatedItems);
      
      savedItems.push(...newItems);
      
      // Trigger a page refresh to show the new items
      window.dispatchEvent(new CustomEvent('todoist-import-completed', {
        detail: { itemsImported: newItems.length }
      }));
      
    } catch (error) {
      console.error('❌ Failed to save converted items:', error);
    }
    
    return savedItems;
  }

  private async ensureTodoistCategory(): Promise<void> {
    try {
      const existingCategories = this.getStoredCategories();
      const todoistCategoryExists = existingCategories.some(cat => cat.id === 'imported-todoist');
      
      if (!todoistCategoryExists) {
        const todoistCategory = {
          id: 'imported-todoist',
          name: 'Todoist Import',
          icon: '✅',
          color: '#e44332', // Todoist's brand color
          priority: 999, // Low priority, shows at bottom
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        const updatedCategories = [...existingCategories, todoistCategory];
        this.saveStoredCategories(updatedCategories);
        
        console.log('📁 Created Todoist Import category');
      }
    } catch (error) {
      console.error('❌ Failed to ensure Todoist category:', error);
    }
  }

  private getStoredCategories(): any[] {
    try {
      const saved = localStorage.getItem('lifeStructureCategories');
      if (!saved) return [];
      return JSON.parse(saved);
    } catch (error) {
      console.error('❌ Error loading categories from localStorage:', error);
      return [];
    }
  }

  private saveStoredCategories(categories: any[]): void {
    try {
      localStorage.setItem('lifeStructureCategories', JSON.stringify(categories));
      console.log(`📁 Saved ${categories.length} categories to localStorage`);
    } catch (error) {
      console.error('❌ Error saving categories to localStorage:', error);
    }
  }

  private getStoredItems(): Item[] {
    try {
      const saved = localStorage.getItem('lifeStructureItems');
      if (!saved) return [];
      
      const parsed = JSON.parse(saved);
      return parsed.map((item: any) => ({
        ...item,
        createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
        updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
        dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
        dateTime: item.dateTime ? new Date(item.dateTime) : undefined
      }));
    } catch (error) {
      console.error('❌ Error loading items from localStorage:', error);
      return [];
    }
  }

  private saveStoredItems(items: Item[]): void {
    try {
      localStorage.setItem('lifeStructureItems', JSON.stringify(items));
      console.log(`💾 Saved ${items.length} items to localStorage`);
    } catch (error) {
      console.error('❌ Error saving items to localStorage:', error);
    }
  }

  // Webhook handling for real-time sync (if needed)
  async handleWebhook(payload: any): Promise<void> {
    console.log('Todoist webhook received:', payload);
    // Handle Todoist webhook events here
    // This would trigger incremental sync of changed items
  }

  // Override auth headers for Todoist
  protected getAuthHeaders(): Record<string, string> {
    if (this.accessToken) {
      return {
        'Authorization': `Bearer ${this.accessToken}`
      };
    }
    return {};
  }

  // Static method to create OAuth URL (if using OAuth instead of API token)
  static getOAuthUrl(clientId: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: clientId,
      scope: 'data:read_write',
      state: Math.random().toString(36).substring(7),
      redirect_uri: redirectUri,
      response_type: 'code'
    });

    return `https://todoist.com/oauth/authorize?${params.toString()}`;
  }

  // Exchange OAuth code for token (if using OAuth)
  static async exchangeCodeForToken(
    code: string, 
    clientId: string, 
    clientSecret: string,
    redirectUri: string
  ): Promise<{ access_token: string }> {
    const response = await fetch('https://todoist.com/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri
      })
    });

    if (!response.ok) {
      throw new Error(`OAuth exchange failed: ${response.statusText}`);
    }

    return await response.json();
  }
} 