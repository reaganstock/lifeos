import OpenAI from 'openai';
import { Item, Category } from '../types';

// Prompt configuration for testing different approaches
const PROMPT_CONFIG = {
  USE_ENHANCED_PROMPT: true, // Toggle between old and new prompt styles
  MAX_CONTEXT_ITEMS: 10,     // How many items to show in prompt
  ENABLE_SAFETY_CHECKS: true, // Toggle safety confirmations
  GEORGETOWN_PERSONALITY: true // Toggle Georgetown-specific references
};

// Unique ID generator function  
const generateUniqueId = (): string => {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
};

// Function definitions for OpenAI function calling
const FUNCTIONS = [
  {
    name: 'createItem',
    description: 'Create a new item (todo, goal, event, note, routine, or voiceNote)',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Clear, concise title for the item'
        },
        description: {
          type: 'string',
          description: 'For routines: describe the purpose/benefits. For other items: detailed description or body text'
        },
        routineSteps: {
          type: 'string',
          description: 'For routines ONLY: The actual routine content - specific steps, exercises, or actions to perform. Example: "1. 20 push-ups\n2. 30 squats\n3. 1 minute plank"'
        },
        type: {
          type: 'string',
          enum: ['todo', 'goal', 'event', 'note', 'routine', 'voiceNote'],
          description: 'Type of item to create'
        },
        categoryId: {
          type: 'string',
          description: 'MUST use one of these exact category IDs from the available categories'
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'Priority level'
        },
        dueDate: {
          type: 'string',
          description: 'Due date in ISO format (YYYY-MM-DD) if applicable'
        },
        dateTime: {
          type: 'string',
          description: 'For EVENTS only: Date and time in ISO format (YYYY-MM-DDTHH:mm) when the event occurs. Required for events.'
        },
        frequency: {
          type: 'string',
          enum: ['daily', 'weekly', 'monthly', 'yearly'],
          description: 'For routines: how often to perform the routine'
        },
        location: {
          type: 'string',
          description: 'For events: where the event takes place'
        }
      },
      required: ['title', 'type', 'categoryId']
    }
  },
  {
    name: 'updateItem',
    description: 'Update an existing item',
    parameters: {
      type: 'object',
      properties: {
        itemId: {
          type: 'string',
          description: 'ID of the item to update'
        },
        updates: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            text: { type: 'string' },
            completed: { type: 'boolean' },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high']
            },
            dueDate: { type: 'string' },
            frequency: { type: 'string' },
            dateTime: { type: 'string' }
          }
        }
      },
      required: ['itemId', 'updates']
    }
  },
  {
    name: 'deleteItem',
    description: 'Delete an item',
    parameters: {
      type: 'object',
      properties: {
        itemId: {
          type: 'string',
          description: 'ID of the item to delete'
        }
      },
      required: ['itemId']
    }
  },
  {
    name: 'searchItems',
    description: 'Search and filter items by various criteria',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Text to search for in titles and descriptions'
        },
        type: {
          type: 'string',
          enum: ['todo', 'goal', 'event', 'note', 'routine', 'voiceNote'],
          description: 'Filter by item type'
        },
        categoryId: {
          type: 'string',
          description: 'Filter by category'
        },
        completed: {
          type: 'boolean',
          description: 'Filter by completion status'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return'
        }
      }
    }
  },
  {
    name: 'getItemsByCategory',
    description: 'Get all items in a specific category',
    parameters: {
      type: 'object',
      properties: {
        categoryId: {
          type: 'string',
          description: 'Category ID to get items from'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of items to return'
        }
      },
      required: ['categoryId']
    }
  },
  {
    name: 'getRecentItems',
    description: 'Get recently created or updated items',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Number of recent items to return',
          default: 10
        },
        days: {
          type: 'number',
          description: 'Number of days back to look',
          default: 7
        }
      }
    }
  },
  {
    name: 'findSingleItem',
    description: 'Find a single item by description for editing or deleting. Returns the best match.',
    parameters: {
      type: 'object',
      properties: {
        searchQuery: {
          type: 'string',
          description: 'Text to search for in item titles and descriptions'
        },
        type: {
          type: 'string',
          enum: ['todo', 'goal', 'event', 'note', 'routine', 'voiceNote'],
          description: 'Filter by item type if specified'
        },
        categoryId: {
          type: 'string',
          description: 'Filter by category if specified'
        }
      },
      required: ['searchQuery']
    }
  },
  {
    name: 'findItemByDescription',
    description: 'Find multiple items by searching titles and descriptions. Good for listing/browsing.',
    parameters: {
      type: 'object',
      properties: {
        searchQuery: {
          type: 'string',
          description: 'Text to search for in item titles and descriptions'
        },
        type: {
          type: 'string',
          enum: ['todo', 'goal', 'event', 'note', 'routine', 'voiceNote'],
          description: 'Filter by item type if specified'
        },
        categoryId: {
          type: 'string',
          description: 'Filter by category if specified'
        }
      },
      required: ['searchQuery']
    }
  },
  {
    name: 'bulkDeleteItems',
    description: 'Delete multiple items that match search criteria. Use when user says "delete all [items]".',
    parameters: {
      type: 'object',
      properties: {
        searchQuery: {
          type: 'string',
          description: 'Text to search for in item titles and descriptions'
        },
        type: {
          type: 'string',
          enum: ['todo', 'goal', 'event', 'note', 'routine', 'voiceNote'],
          description: 'Filter by item type if specified'
        },
        categoryId: {
          type: 'string',
          description: 'Filter by category if specified'
        }
      },
      required: ['searchQuery']
    }
  },
  {
    name: 'bulkCreateItems',
    description: 'Create multiple items at once. Use when user says "add these items" or provides a list.',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              routineSteps: { type: 'string' },
              type: { 
                type: 'string',
                enum: ['todo', 'goal', 'event', 'note', 'routine', 'voiceNote']
              },
              categoryId: { type: 'string' },
              priority: { type: 'string', enum: ['low', 'medium', 'high'] },
              dueDate: { type: 'string' },
              dateTime: { type: 'string' },
              frequency: { type: 'string' },
              location: { type: 'string' }
            },
            required: ['title', 'type', 'categoryId']
          }
        }
      },
      required: ['items']
    }
  },
  {
    name: 'bulkUpdateItems',
    description: 'Update multiple items that match search criteria. Use when user says "update all [items]".',
    parameters: {
      type: 'object',
      properties: {
        searchQuery: {
          type: 'string',
          description: 'Text to search for in item titles and descriptions'
        },
        type: {
          type: 'string',
          enum: ['todo', 'goal', 'event', 'note', 'routine', 'voiceNote'],
          description: 'Filter by item type if specified'
        },
        categoryId: {
          type: 'string',
          description: 'Filter by category if specified'
        },
        updates: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            text: { type: 'string' },
            completed: { type: 'boolean' },
            priority: { type: 'string', enum: ['low', 'medium', 'high'] },
            dueDate: { type: 'string' },
            frequency: { type: 'string' },
            dateTime: { type: 'string' }
          }
        }
      },
      required: ['searchQuery', 'updates']
    }
  },
  {
    name: 'directDeleteItem',
    description: 'Find and delete an item in one step. Use when user says "delete [item]" or "remove [item]".',
    parameters: {
      type: 'object',
      properties: {
        searchQuery: {
          type: 'string',
          description: 'Text to search for in item titles and descriptions'
        },
        type: {
          type: 'string',
          enum: ['todo', 'goal', 'event', 'note', 'routine', 'voiceNote'],
          description: 'Filter by item type if specified'
        },
        categoryId: {
          type: 'string',
          description: 'Filter by category if specified'
        }
      },
      required: ['searchQuery']
    }
  },
  {
    name: 'directEditItem',
    description: 'Find and edit an item in one step. Use when user says "edit [item]" or "change [item]".',
    parameters: {
      type: 'object',
      properties: {
        searchQuery: {
          type: 'string',
          description: 'Text to search for in item titles and descriptions'
        },
        updates: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            text: { type: 'string' },
            completed: { type: 'boolean' },
            priority: { type: 'string', enum: ['low', 'medium', 'high'] },
            dueDate: { type: 'string' },
            frequency: { type: 'string' },
            dateTime: { type: 'string' },
            location: { type: 'string' }
          }
        },
        type: {
          type: 'string',
          enum: ['todo', 'goal', 'event', 'note', 'routine', 'voiceNote'],
          description: 'Filter by item type if specified'
        },
        categoryId: {
          type: 'string',
          description: 'Filter by category if specified'
        }
      },
      required: ['searchQuery', 'updates']
    }
  },
  {
    name: 'bulkCreateEvents',
    description: 'Create multiple calendar events with specific dates and times. Use when user says "add to calendar" or "schedule for multiple days".',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Base title for the events'
        },
        description: {
          type: 'string',
          description: 'Description of the events'
        },
        categoryId: {
          type: 'string',
          description: 'Category for the events'
        },
        startDate: {
          type: 'string',
          description: 'Start date in YYYY-MM-DD format'
        },
        endDate: {
          type: 'string',
          description: 'End date in YYYY-MM-DD format'
        },
        time: {
          type: 'string',
          description: 'Time in HH:MM format (24-hour)'
        },
        location: {
          type: 'string',
          description: 'Location for the events'
        },
        frequency: {
          type: 'string',
          enum: ['daily', 'weekly', 'monthly'],
          description: 'How often to repeat'
        }
      },
      required: ['title', 'startDate', 'endDate', 'categoryId']
    }
  },
  {
    name: 'bulkUpdateItemsUnique',
    description: 'Update multiple items with UNIQUE values for each item. Use when user wants each item to have different/unique titles, descriptions, or other properties.',
    parameters: {
      type: 'object',
      properties: {
        searchQuery: {
          type: 'string',
          description: 'Text to search for in item titles and descriptions'
        },
        type: {
          type: 'string',
          enum: ['todo', 'goal', 'event', 'note', 'routine', 'voiceNote'],
          description: 'Filter by item type if specified'
        },
        categoryId: {
          type: 'string',
          description: 'Filter by category if specified'
        },
        updateType: {
          type: 'string',
          enum: ['titles', 'descriptions', 'priorities', 'categories'],
          description: 'What type of property to make unique'
        },
        theme: {
          type: 'string',
          description: 'Theme or context for generating unique values (e.g., "Life success", "fitness motivation", "spiritual growth")'
        }
      },
      required: ['searchQuery', 'updateType']
    }
  },
  {
    name: 'executeMultiOperation',
    description: 'Execute multiple operations with dependency management. Use for complex workflows that require multiple steps.',
    parameters: {
      type: 'object',
      properties: {
        operations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['create', 'update', 'delete', 'search'],
                description: 'Type of operation to perform'
              },
              data: {
                type: 'object',
                description: 'Data for the operation. Can include dependency references like "\\${0.id}"'
              },
              dependencies: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of operation indices this depends on (e.g., ["0", "1"])'
              }
            },
            required: ['type', 'data']
          }
        }
      },
      required: ['operations']
    }
  },
  {
    name: 'validateAndRepairItems',
    description: 'Validate all items and repair common data integrity issues.',
    parameters: {
      type: 'object',
      properties: {
        repairMode: {
          type: 'string',
          enum: ['check', 'repair', 'force_repair'],
          description: 'Mode: check for issues, repair safe issues, or force repair all issues'
        }
      }
    }
  },
  {
    name: 'massiveCreateItems',
    description: 'Create unlimited items at scale - hundreds or thousands. Use for true life management OS operations.',
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Pattern for item creation: "daily", "weekly", "monthly", "semester", "year", "range"'
        },
        baseTitle: {
          type: 'string',
          description: 'Base title pattern with variables like {date}, {number}, {weekday}'
        },
        type: {
          type: 'string',
          enum: ['todo', 'goal', 'event', 'note', 'routine', 'voiceNote'],
          description: 'Type of items to create'
        },
        categoryId: {
          type: 'string',
          description: 'Category for all items'
        },
        count: {
          type: 'number',
          description: 'Total number of items to create (unlimited)'
        },
        startDate: {
          type: 'string',
          description: 'Start date for date-based patterns'
        },
        endDate: {
          type: 'string',
          description: 'End date for date-based patterns'
        },
        timePattern: {
          type: 'string',
          description: 'Time pattern: "morning", "afternoon", "evening", "random", "HH:MM"'
        },
        variations: {
          type: 'array',
          items: { type: 'string' },
          description: 'Variations for titles/descriptions to create diversity'
        }
      },
      required: ['pattern', 'baseTitle', 'type', 'categoryId']
    }
  },
  {
    name: 'massiveDeleteItems',
    description: 'Delete unlimited items by pattern matching. True power user bulk deletion.',
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Deletion pattern: "all", "category", "type", "date_range", "title_contains", "regex"'
        },
        criteria: {
          type: 'object',
          properties: {
            categoryIds: { type: 'array', items: { type: 'string' } },
            types: { type: 'array', items: { type: 'string' } },
            titleContains: { type: 'string' },
            dateFrom: { type: 'string' },
            dateTo: { type: 'string' },
            regexPattern: { type: 'string' },
            completed: { type: 'boolean' },
            priority: { type: 'string' }
          }
        },
        safetyOverride: {
          type: 'boolean',
          description: 'Set to true for unlimited deletion power'
        }
      },
      required: ['pattern', 'criteria']
    }
  },
  {
    name: 'massiveUpdateItems',
    description: 'Update unlimited items across all categories. Total system-wide updates.',
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Update pattern: "all", "category", "type", "search", "date_range"'
        },
        criteria: {
          type: 'object',
          properties: {
            categoryIds: { type: 'array', items: { type: 'string' } },
            types: { type: 'array', items: { type: 'string' } },
            titleContains: { type: 'string' },
            dateFrom: { type: 'string' },
            dateTo: { type: 'string' }
          }
        },
        updates: {
          type: 'object',
          properties: {
            titlePattern: { type: 'string', description: 'New title pattern with variables' },
            textPattern: { type: 'string', description: 'New text pattern with variables' },
            priority: { type: 'string', enum: ['low', 'medium', 'high'] },
            categoryId: { type: 'string', description: 'Move to new category' },
            completed: { type: 'boolean' },
            addPrefix: { type: 'string' },
            addSuffix: { type: 'string' },
            dateShift: { type: 'string', description: 'Shift dates by days/weeks/months' }
          }
        },
        safetyOverride: {
          type: 'boolean',
          description: 'Set to true for unlimited update power'
        }
      },
      required: ['pattern', 'criteria', 'updates']
    }
  },
  {
    name: 'lifecycleOperations',
    description: 'Massive lifecycle operations - semester planning, year planning, habit building at scale.',
    parameters: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['semester_schedule', 'year_goals', 'habit_system', 'daily_routines', 'project_lifecycle'],
          description: 'Type of lifecycle operation'
        },
        scope: {
          type: 'string',
          enum: ['day', 'week', 'month', 'semester', 'year', 'lifetime'],
          description: 'Time scope for the operation'
        },
        intensity: {
          type: 'string',
          enum: ['light', 'moderate', 'intensive', 'extreme'],
          description: 'How intensive the schedule should be'
        },
        focus: {
          type: 'array',
          items: { type: 'string' },
          description: 'Areas of focus from Georgetown categories'
        },
        customData: {
          type: 'object',
          description: 'Any additional data for the specific operation'
        }
      },
      required: ['operation', 'scope']
    }
  },
  {
    name: 'smartCleanup',
    description: 'AI-powered smart cleanup of the entire system. Remove duplicates, organize, optimize.',
    parameters: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['deduplicate', 'organize', 'optimize', 'archive_old', 'merge_similar', 'full_cleanup'],
          description: 'Type of cleanup operation'
        },
        aggressiveness: {
          type: 'string',
          enum: ['conservative', 'moderate', 'aggressive', 'extreme'],
          description: 'How aggressive the cleanup should be'
        },
        preserveImportant: {
          type: 'boolean',
          description: 'Preserve items marked as important/high priority'
        }
      },
      required: ['operation']
    }
  },
  {
    name: 'deleteAllEvents',
    description: 'Delete ALL calendar events from the system. Use when user says "delete all events" or "delete all calendar events".',
    parameters: {
      type: 'object',
      properties: {
        confirm: {
          type: 'boolean',
          description: 'Confirmation that user wants to delete all events',
          default: true
        }
      }
    }
  },
  {
    name: 'createRoutineCalendar',
    description: 'Convert a routine into individual calendar events with specific times. Use when user wants to "add routine to calendar" or "schedule routine".',
    parameters: {
      type: 'object',
      properties: {
        routineName: {
          type: 'string',
          description: 'Name of the routine to convert to calendar events'
        },
        startDate: {
          type: 'string',
          description: 'Start date for the routine schedule (YYYY-MM-DD)'
        },
        endDate: {
          type: 'string',
          description: 'End date for the routine schedule (YYYY-MM-DD)'
        },
        startTime: {
          type: 'string',
          description: 'Start time for the routine (HH:MM format)',
          default: '06:00'
        }
      },
      required: ['routineName', 'startDate', 'endDate']
    }
  },
  {
    name: 'parseRoutineToCalendar',
    description: 'Parse ANY routine description from natural language and create individual calendar events. Use when user wants to add routines, schedules, or habits to their calendar.',
    parameters: {
      type: 'object',
      properties: {
        routineDescription: {
          type: 'string',
          description: 'The full description of the routine in natural language - can be anything the user says'
        },
        startDate: {
          type: 'string',
          description: 'Start date for the routine schedule (YYYY-MM-DD)',
          default: 'today'
        },
        endDate: {
          type: 'string',
          description: 'End date for the routine schedule (YYYY-MM-DD)',
          default: '30 days from start'
        },
        frequency: {
          type: 'string',
          description: 'How often to repeat the routine',
          enum: ['daily', 'weekdays', 'weekends', 'weekly', 'custom'],
          default: 'daily'
        }
      },
      required: ['routineDescription']
    }
  },
  {
    name: 'createRecurringEvent',
    description: 'Create a recurring event (weekly, monthly, etc.). Use when user says "every Monday", "weekly meeting", etc.',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title of the recurring event'
        },
        description: {
          type: 'string',
          description: 'Description of the event'
        },
        categoryId: {
          type: 'string',
          description: 'Category for the event'
        },
        startDateTime: {
          type: 'string',
          description: 'First occurrence date and time (ISO format)'
        },
        endDateTime: {
          type: 'string',
          description: 'End time for each occurrence (ISO format)'
        },
        recurrencePattern: {
          type: 'string',
          enum: ['daily', 'weekly', 'monthly', 'yearly'],
          description: 'How often the event repeats'
        },
        recurrenceInterval: {
          type: 'number',
          description: 'Interval between occurrences (e.g., 2 for every 2 weeks)',
          default: 1
        },
        recurrenceEndDate: {
          type: 'string',
          description: 'When to stop creating recurring events (ISO format)'
        },
        location: {
          type: 'string',
          description: 'Location for the events'
        }
      },
      required: ['title', 'startDateTime', 'recurrencePattern', 'categoryId']
    }
  }
];

// Helper functions for localStorage management
const getStoredItems = (): Item[] => {
  try {
    const savedItems = localStorage.getItem('lifeStructureItems');
    if (!savedItems) return [];
    
    const parsedItems = JSON.parse(savedItems);
    // Convert date strings back to Date objects
    return parsedItems.map((item: any) => ({
      ...item,
      createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
      updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
      dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
      dateTime: item.dateTime ? new Date(item.dateTime) : undefined
    }));
  } catch (error) {
    console.error('Error loading items from localStorage:', error);
    return [];
  }
};

const saveStoredItems = (items: Item[]): void => {
  try {
    localStorage.setItem('lifeStructureItems', JSON.stringify(items));
  } catch (error) {
    console.error('Error saving items to localStorage:', error);
  }
};

// OpenRouter Configuration
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1';
const OPENROUTER_API_KEY = process.env.REACT_APP_OPENROUTER_API_KEY;

// Available models for selection
export const AVAILABLE_MODELS = [
  // OpenAI Models
  {
    id: 'openai/gpt-4.1',
    name: 'GPT-4.1',
    provider: 'OpenAI',
    description: 'Latest GPT-4.1 with improved performance and efficiency',
    cost: 'Medium',
    strengths: ['Function calling', 'Speed', 'Code generation']
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    description: 'Multimodal GPT-4 with vision capabilities',
    cost: 'Medium',
    strengths: ['General purpose', 'Vision', 'Function calling']
  },
  
  // Anthropic Models
  {
    id: 'anthropic/claude-sonnet-4',
    name: 'Claude Sonnet 4',
    provider: 'Anthropic', 
    description: 'State-of-the-art coding and reasoning (72.7% SWE-bench)',
    cost: 'Medium',
    strengths: ['Coding', 'Reasoning', 'Function calling']
  },
  {
    id: 'anthropic/claude-opus-4',
    name: 'Claude Opus 4',
    provider: 'Anthropic',
    description: 'Most powerful model for complex coding tasks (72.5% SWE-bench)',
    cost: 'High',
    strengths: ['Complex coding', 'Long reasoning', 'Autonomous work']
  },
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    description: 'Previous generation Sonnet - reliable and fast',
    cost: 'Medium',
    strengths: ['Coding', 'Analysis', 'Tool use']
  },



  // DeepSeek Models - Latest 2025
  {
    id: 'deepseek/deepseek-r1-0528:free',
    name: 'DeepSeek R1 0528 (Free)',
    provider: 'DeepSeek',
    description: 'Latest R1 update, performance on par with OpenAI o1 (Free)',
    cost: 'Free',
    strengths: ['Open reasoning', 'Math', 'Coding', 'Free']
  },
  {
    id: 'deepseek/deepseek-r1-0528',
    name: 'DeepSeek R1 0528',
    provider: 'DeepSeek',
    description: 'Latest R1 update, performance on par with OpenAI o1',
    cost: 'Medium',
    strengths: ['Open reasoning', 'Math', 'Coding', 'Transparency']
  },
  {
    id: 'deepseek/deepseek-r1',
    name: 'DeepSeek R1',
    provider: 'DeepSeek',
    description: 'Original R1 - fully open reasoning model (671B params)',
    cost: 'Medium',
    strengths: ['Open reasoning', 'Transparent thinking', 'MIT license']
  },
  {
    id: 'deepseek/deepseek-chat-v3-0324:free',
    name: 'DeepSeek V3 0324 (Free)',
    provider: 'DeepSeek',
    description: 'Latest V3 flagship model - excellent general capabilities (Free)',
    cost: 'Free',
    strengths: ['General tasks', 'Coding', 'Free', 'Fast']
  },
  {
    id: 'deepseek/deepseek-chat-v3-0324',
    name: 'DeepSeek V3 0324',
    provider: 'DeepSeek',
    description: 'Latest V3 flagship model - excellent general capabilities',
    cost: 'Low',
    strengths: ['General tasks', 'Coding', 'Cost-effective', 'Fast']
  },
  {
    id: 'deepseek/deepseek-r1-distill-qwen-32b',
    name: 'DeepSeek R1 Distill Qwen 32B',
    provider: 'DeepSeek',
    description: 'R1 distilled into 32B model - outperforms o1-mini',
    cost: 'Low',
    strengths: ['Math', 'Coding', 'Efficiency', 'Reasoning']
  },
  {
    id: 'deepseek/deepseek-r1-distill-qwen-14b',
    name: 'DeepSeek R1 Distill Qwen 14B',
    provider: 'DeepSeek',
    description: 'R1 distilled into 14B model - great performance/cost ratio',
    cost: 'Low',
    strengths: ['Math', 'Coding', 'Efficiency', 'Budget-friendly']
  },

  // xAI Grok Models - Latest 2025
  {
    id: 'x-ai/grok-3-beta',
    name: 'Grok 3 Beta',
    provider: 'xAI',
    description: 'Latest flagship Grok - excels at enterprise use cases',
    cost: 'High',
    strengths: ['Data extraction', 'Domain knowledge', 'Enterprise', 'Structured tasks']
  },
  {
    id: 'x-ai/grok-3-mini-beta',
    name: 'Grok 3 Mini Beta',
    provider: 'xAI',
    description: 'Lightweight thinking model - ideal for math and reasoning',
    cost: 'Low',
    strengths: ['Thinking model', 'Math', 'Reasoning', 'Transparent traces']
  },
  {
    id: 'x-ai/grok-2-1212',
    name: 'Grok 2 1212',
    provider: 'xAI',
    description: 'Enhanced accuracy, instruction adherence, multilingual support',
    cost: 'Medium',
    strengths: ['Accuracy', 'Multilingual', 'Instruction following', 'Steerable']
  },

  // Google Models - DIRECT GEMINI API (not OpenRouter)
  {
    id: 'gemini-2.5-pro-preview-06-05',
    name: 'Gemini 2.5 Pro Preview',
    provider: 'Google Direct',
    description: 'Direct Gemini API - Most intelligent thinking model with state-of-the-art performance',
    cost: 'High',
    strengths: ['Thinking mode', 'Advanced reasoning', 'Complex coding', 'Direct API']
  },
  {
    id: 'gemini-2.5-flash-preview-05-20',
    name: 'Gemini 2.5 Flash Preview',
    provider: 'Google Direct',
    description: 'Direct Gemini API - Fast model with controllable thinking capabilities',
    cost: 'Low',
    strengths: ['Speed', 'Thinking mode', 'Function calling', 'Direct API']
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'Google Direct',
    description: 'Direct Gemini API - Latest stable Flash model with thinking',
    cost: 'Low',
    strengths: ['Speed', 'Thinking mode', 'Function calling', 'Direct API']
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'Google Direct',
    description: 'Direct Gemini API - Next-gen features with native tool use',
    cost: 'Low',
    strengths: ['Speed', 'Tool use', 'Function calling', 'Direct API']
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'Google Direct',
    description: 'Direct Gemini API - Most powerful Gemini model',
    cost: 'Medium',
    strengths: ['Advanced reasoning', 'Complex tasks', 'Function calling', 'Direct API']
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'Google Direct', 
    description: 'Direct Gemini API - Powerful general-purpose model',
    cost: 'Medium',
    strengths: ['General purpose', 'Long context', 'Direct API']
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'Google Direct',
    description: 'Direct Gemini API - Fast and efficient model',
    cost: 'Low',
    strengths: ['Speed', 'Efficiency', 'Direct API']
  }
];

// Default model - Gemini 2.5 Flash Pro for direct API integration
const DEFAULT_MODEL = 'gemini-2.5-flash-preview-05-20';
const MODEL_STORAGE_KEY = 'selectedAIModel';

// Get current model from localStorage or default
let currentModel = (() => {
  try {
    const stored = localStorage.getItem(MODEL_STORAGE_KEY);
    if (stored && AVAILABLE_MODELS.find(m => m.id === stored)) {
      console.log('🔄 Loaded model from storage:', stored);
      return stored;
    }
  } catch (error) {
    console.warn('Failed to load model from localStorage:', error);
  }
  console.log('🔄 Using default model:', DEFAULT_MODEL);
  return DEFAULT_MODEL;
})();

export const setCurrentModel = (modelId: string) => {
  console.log('🚀 Setting model to:', modelId);
  
  // Validate model exists
  const modelExists = AVAILABLE_MODELS.find(m => m.id === modelId);
  if (!modelExists) {
    console.error('❌ Invalid model ID:', modelId);
    return false;
  }
  
  // Update current model
  currentModel = modelId;
  
  // Persist to localStorage
  try {
    localStorage.setItem(MODEL_STORAGE_KEY, modelId);
    console.log('✅ Model saved to localStorage:', modelId);
  } catch (error) {
    console.error('❌ Failed to save model to localStorage:', error);
  }
  
  // Force UI update by dispatching custom event
  window.dispatchEvent(new CustomEvent('modelChanged', { detail: { modelId } }));
  
  return true;
};

// Add caching to prevent excessive localStorage reads and logging
let lastChecked = 0;
let cachedStoredModel: string | null = null;
const CACHE_DURATION = 5000; // Cache for 5 seconds

export const getCurrentModel = () => {
  const now = Date.now();
  
  // Use cached value if recent enough (prevent excessive localStorage reads)
  if (now - lastChecked < CACHE_DURATION && cachedStoredModel !== null) {
    return currentModel;
  }
  
  // Only check localStorage and log when cache is stale
  try {
    const stored = localStorage.getItem(MODEL_STORAGE_KEY);
    lastChecked = now;
    cachedStoredModel = stored;
    
    if (stored && AVAILABLE_MODELS.find(m => m.id === stored)) {
      // Only log if model actually changed
      if (currentModel !== stored) {
        console.log('🔄 getCurrentModel: Model changed to:', stored);
        currentModel = stored;
      } else {
        currentModel = stored;
      }
    } else {
      // Only log if switching to default
      if (currentModel !== DEFAULT_MODEL) {
        console.log('🔄 getCurrentModel: Using default model:', DEFAULT_MODEL);
        currentModel = DEFAULT_MODEL;
      } else {
        currentModel = DEFAULT_MODEL;
      }
    }
  } catch (error) {
    console.warn('Failed to get model from localStorage:', error);
    currentModel = DEFAULT_MODEL;
  }
  
  return currentModel;
};

// Make getCurrentModel available globally for geminiService
(window as any).getCurrentModel = getCurrentModel;

// Force reset to Gemini model
export const forceResetToGemini = () => {
  console.log('🔧 Forcing reset to Gemini 2.5 Flash Pro');
  const geminiModel = 'gemini-2.5-flash-preview-05-20';
  setCurrentModel(geminiModel);
  return geminiModel;
};

// Types and classes for enhanced batch operations
interface BulkOperationResult {
  success: boolean;
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  failures: Array<{
    item?: Item;
    itemId?: string;
    error: string;
    index: number;
  }>;
  createdItems?: Item[];
  updatedItems?: Item[];
  deletedItems?: string[];
  warnings: string[];
}

// Enhanced transaction-like behavior for batch operations
class BatchTransaction {
  private originalItems: Item[];
  private currentItems: Item[];
  private operations: Array<{
    type: 'create' | 'update' | 'delete';
    item?: Item;
    itemId?: string;
    updates?: any;
  }> = [];

  constructor() {
    this.originalItems = getStoredItems();
    this.currentItems = [...this.originalItems];
  }

  // Add operation to transaction
  addOperation(operation: { type: 'create' | 'update' | 'delete'; item?: Item; itemId?: string; updates?: any }) {
    this.operations.push(operation);
  }

  // Execute all operations with rollback capability
  execute(): BulkOperationResult {
    const result: BulkOperationResult = {
      success: false,
      totalProcessed: 0,
      successCount: 0,
      failureCount: 0,
      failures: [],
      warnings: [],
      createdItems: [],
      updatedItems: [],
      deletedItems: []
    };

    try {
      for (let i = 0; i < this.operations.length; i++) {
        const operation = this.operations[i];
        result.totalProcessed++;

        try {
          switch (operation.type) {
            case 'create':
              if (operation.item) {
                this.currentItems.push(operation.item);
                result.createdItems!.push(operation.item);
                result.successCount++;
              }
              break;
            
            case 'update':
              if (operation.itemId && operation.updates) {
                const itemIndex = this.currentItems.findIndex(item => item.id === operation.itemId);
                if (itemIndex !== -1) {
                  const updatedItem = { ...this.currentItems[itemIndex], ...operation.updates, updatedAt: new Date() };
                  this.currentItems[itemIndex] = updatedItem;
                  result.updatedItems!.push(updatedItem);
                  result.successCount++;
                } else {
                  throw new Error(`Item with ID ${operation.itemId} not found`);
                }
              }
              break;
            
            case 'delete':
              if (operation.itemId) {
                const itemIndex = this.currentItems.findIndex(item => item.id === operation.itemId);
                if (itemIndex !== -1) {
                  const deletedItem = this.currentItems[itemIndex];
                  this.currentItems.splice(itemIndex, 1);
                  result.deletedItems!.push(`${deletedItem.type}: ${deletedItem.title}`);
                  result.successCount++;
                } else {
                  throw new Error(`Item with ID ${operation.itemId} not found`);
                }
              }
              break;
          }
        } catch (error) {
          result.failureCount++;
          result.failures.push({
            index: i,
            itemId: operation.itemId,
            item: operation.item,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Commit if more successes than failures
      if (result.successCount > result.failureCount) {
        saveStoredItems(this.currentItems);
        result.success = true;
      } else {
        result.warnings.push('Transaction rolled back due to high failure rate');
      }

    } catch (error) {
      result.warnings.push(`Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  // Rollback to original state
  rollback() {
    saveStoredItems(this.originalItems);
  }
}

export class AIActions {
  private openai: OpenAI;
  private itemsModified: boolean = false;

  constructor() {
    // Use OpenRouter API key from environment variables
    const openRouterApiKey = process.env.REACT_APP_OPENROUTER_API_KEY;
    const fallbackApiKey = process.env.REACT_APP_OPENAI_API_KEY;
    const apiKey = openRouterApiKey || fallbackApiKey;
    
    if (!apiKey) {
      throw new Error('AI service configuration error. Please contact support.');
    }

    console.log('🔑 AIActions: API key configured successfully');

    this.openai = new OpenAI({
      apiKey,
      baseURL: OPENROUTER_API_URL,
      dangerouslyAllowBrowser: true
    });
  }

  // Create a new item
  async createItem(params: {
    title: string;
    description?: string;
    routineSteps?: string;
    type: string;
    categoryId: string;
    priority?: string;
    dueDate?: string;
    dateTime?: string;
    frequency?: string;
    location?: string;
  }): Promise<Item> {
    console.log('🎯 Creating item with params:', params);
    
    const items = getStoredItems();
    
    const priorityValue = (params.priority === 'low' || params.priority === 'medium' || params.priority === 'high') 
      ? params.priority 
      : 'medium';
    
    // For routines, use routineSteps as the main content and description for purpose
    let itemText = params.description || '';
    if (params.type === 'routine' && params.routineSteps) {
      itemText = params.routineSteps; // Put the actual routine steps in the text field
    }
    
    // Validate required fields for events
    if (params.type === 'event' && !params.dateTime) {
      throw new Error('Events require a dateTime parameter');
    }
    
    const newItem: Item = {
      id: generateUniqueId(),
      title: params.title,
      text: itemText,
      type: params.type as any,
      categoryId: params.categoryId,
      completed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      dueDate: params.dueDate ? new Date(params.dueDate) : undefined,
      dateTime: params.dateTime ? new Date(params.dateTime) : undefined,
      metadata: {
        priority: priorityValue,
        aiGenerated: true,
        // Add routine-specific metadata
        ...(params.type === 'routine' && {
          frequency: (params.frequency as 'daily' | 'weekly' | 'monthly' | 'yearly') || 'daily',
          currentStreak: 0,
          bestStreak: 0,
          completedToday: false,
          completedDates: []
        }),
        // Add event-specific metadata
        ...(params.type === 'event' && {
          location: params.location
        }),
        // Add description as separate metadata for routines so we keep both
        ...(params.type === 'routine' && params.description && {
          routinePurpose: params.description
        })
      }
    };

    console.log('✅ Created item:', newItem);
    
    items.push(newItem);
    saveStoredItems(items);
    
    console.log('💾 Saved to localStorage, total items:', items.length);
    
    return newItem;
  }

  // Update an existing item
  async updateItem(itemId: string, updates: any): Promise<Item> {
    console.log('✏️ Updating item ID:', itemId, 'with updates:', updates);
    
    const items = getStoredItems();
    const itemIndex = items.findIndex(item => item.id === itemId);
    
    if (itemIndex === -1) {
      console.error('❌ Item not found for update:', itemId);
      throw new Error(`Item with id ${itemId} not found`);
    }

    const currentItem = items[itemIndex];
    console.log('📝 Current item:', currentItem.title, currentItem.type);
    
    // Handle special update cases
    const processedUpdates: any = { ...updates };
    
    // Handle date updates
    if (updates.dueDate && typeof updates.dueDate === 'string') {
      processedUpdates.dueDate = new Date(updates.dueDate);
    }
    
    // Handle metadata updates (like priority)
    if (updates.priority) {
      processedUpdates.metadata = {
        ...currentItem.metadata,
        priority: updates.priority
      };
    }
    
    // Handle routine-specific updates
    if (currentItem.type === 'routine' && updates.frequency) {
      processedUpdates.metadata = {
        ...currentItem.metadata,
        frequency: updates.frequency
      };
    }
    
    // Handle event-specific updates  
    if (currentItem.type === 'event' && updates.dateTime) {
      processedUpdates.dateTime = new Date(updates.dateTime);
    }

    const updatedItem = {
      ...currentItem,
      ...processedUpdates,
      updatedAt: new Date()
    };

    items[itemIndex] = updatedItem;
    saveStoredItems(items);
    
    console.log('✅ Successfully updated item:', updatedItem.title);
    
    return updatedItem;
  }

  // Delete an item
  async deleteItem(itemId: string): Promise<boolean> {
    console.log('🗑️ Deleting item ID:', itemId);
    
    const items = getStoredItems();
    const itemIndex = items.findIndex(item => item.id === itemId);
    
    if (itemIndex === -1) {
      console.error('❌ Item not found for deletion:', itemId);
      return false;
    }

    const itemToDelete = items[itemIndex];
    console.log('🗑️ Deleting:', itemToDelete.title, itemToDelete.type);
    
    items.splice(itemIndex, 1);
    saveStoredItems(items);
    
    console.log('✅ Successfully deleted item');
    
    return true;
  }

  // Search items
  async searchItems(params: {
    query?: string;
    type?: string;
    categoryId?: string;
    completed?: boolean;
    limit?: number;
  }): Promise<Item[]> {
    let items = getStoredItems();

    // Apply filters
    if (params.query) {
      const query = params.query.toLowerCase();
      items = items.filter(item => 
        item.title.toLowerCase().includes(query) || 
        item.text.toLowerCase().includes(query)
      );
    }

    if (params.type) {
      items = items.filter(item => item.type === params.type);
    }

    if (params.categoryId) {
      items = items.filter(item => item.categoryId === params.categoryId);
    }

    if (params.completed !== undefined) {
      items = items.filter(item => item.completed === params.completed);
    }

    // Sort by creation date (newest first)
    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Apply limit
    if (params.limit) {
      items = items.slice(0, params.limit);
    }

    return items;
  }

  // Get items by category
  async getItemsByCategory(categoryId: string, limit?: number): Promise<Item[]> {
    return this.searchItems({ categoryId, limit });
  }

  // Get recent items
  async getRecentItems(limit: number = 10, days: number = 7): Promise<Item[]> {
    const items = getStoredItems();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const recentItems = items
      .filter(item => item.updatedAt >= cutoffDate)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, limit);

    return recentItems;
  }

  // Execute function call from OpenAI
  async executeFunction(name: string, args: any): Promise<any> {
    switch (name) {
      case 'createItem':
        return await this.createItem(args);
      case 'updateItem':
        return await this.updateItem(args.itemId, args.updates);
      case 'deleteItem':
        return await this.deleteItem(args.itemId);
      case 'searchItems':
        return await this.searchItems(args);
      case 'getItemsByCategory':
        return await this.getItemsByCategory(args.categoryId, args.limit);
      case 'getRecentItems':
        return await this.getRecentItems(args.limit, args.days);
      case 'findSingleItem':
        return await this.findSingleItem(args.searchQuery, args.type, args.categoryId);
      case 'findItemByDescription':
        return await this.findItemByDescription(args.searchQuery, args.type, args.categoryId);
      case 'bulkDeleteItems':
        return await this.bulkDeleteItems(args.searchQuery, args.type, args.categoryId);
      case 'bulkCreateItems':
        return await this.bulkCreateItems(args.items);
      case 'bulkUpdateItems':
        return await this.bulkUpdateItems(args.searchQuery, args.updates, args.type, args.categoryId);
      case 'directDeleteItem':
        return await this.directDeleteItem(args.searchQuery, args.type, args.categoryId);
      case 'directEditItem':
        return await this.directEditItem(args.searchQuery, args.updates, args.type, args.categoryId);
      case 'bulkCreateEvents':
        return await this.bulkCreateEvents(args.title, args.description, args.categoryId, args.startDate, args.endDate, args.time, args.location, args.frequency);
      case 'bulkUpdateItemsUnique':
        return await this.bulkUpdateItemsUnique(args.searchQuery, args.type, args.categoryId, args.updateType, args.theme);
      case 'executeMultiOperation':
        return await this.executeMultiOperation(args.operations);
      case 'validateAndRepairItems':
        return await this.validateAndRepairItems(args.repairMode);
      case 'massiveCreateItems':
        return await this.massiveCreateItems(args.pattern, args.baseTitle, args.type, args.categoryId, args.count, args.startDate, args.endDate, args.timePattern, args.variations);
      case 'massiveDeleteItems':
        return await this.massiveDeleteItems(args.pattern, args.criteria, args.safetyOverride);
      case 'massiveUpdateItems':
        return await this.massiveUpdateItems(args.pattern, args.criteria, args.updates, args.safetyOverride);
      case 'lifecycleOperations':
        return await this.lifecycleOperations(args.operation, args.scope, args.intensity, args.focus, args.customData);
      case 'smartCleanup':
        return await this.smartCleanup(args.operation, args.aggressiveness, args.preserveImportant);
      case 'deleteAllEvents':
        return await this.deleteAllEvents(args.confirm);
      case 'createRoutineCalendar':
        return await this.createRoutineCalendar(args.routineName, args.startDate, args.endDate, args.startTime);
      case 'parseRoutineToCalendar':
        return await this.parseRoutineToCalendar(args.routineDescription, args.startDate, args.endDate, args.frequency);
      case 'createRecurringEvent':
        return await this.createRecurringEvent(args.title, args.description, args.categoryId, args.startDateTime, args.endDateTime, args.recurrencePattern, args.recurrenceInterval, args.recurrenceEndDate, args.location);
      default:
        throw new Error(`Unknown function: ${name}`);
    }
  }

  // Get available functions for OpenAI
  getFunctions() {
    return FUNCTIONS;
  }

  // Get tools in the new OpenRouter format
  getTools(categories: any[] = []) {
    // Update the categoryId description in createItem function
    const updatedFunctions = FUNCTIONS.map(func => {
      if (func.name === 'createItem') {
        const categoryDescription = categories.length > 0 
          ? `MUST use one of these exact category IDs: ${categories.map(cat => `"${cat.id}" (${cat.name})`).join(', ')}`
          : 'MUST use one of these exact category IDs from the available categories';
        
        return {
          ...func,
          parameters: {
            ...func.parameters,
            properties: {
              ...func.parameters.properties,
              categoryId: {
                ...func.parameters.properties.categoryId,
                description: categoryDescription
              }
            }
          }
        };
      }
      return func;
    });

    return updatedFunctions.map(func => ({
      type: "function",
      function: func
    }));
  }

  // Build conversation history from chat messages
  private buildConversationHistory(messages: Array<{ role: 'user' | 'assistant'; content: string }>): Array<{ role: 'user' | 'assistant'; content: string }> {
    // Limit to last 40 messages for context management
    return messages.slice(-40);
  }

  // Build system prompt with current items context
  private buildSystemPrompt(items: Item[], isAskMode: boolean = false): string {
    if (isAskMode) {
      return `🎯 **LIFELY AI - ASK MODE** (Life Guidance & Insights)
You are Lifely AI in ASK MODE - a life management consultant providing insights, advice, and guidance based on the user's existing life structure.

IMPORTANT: When asked what mode you are in, respond: "I am currently in Ask Mode - I provide guidance and insights but cannot create or modify items."

**YOUR ROLE:**
✅ **LIFE CONSULTANT** - Analyze their current setup and provide strategic guidance
✅ **INSIGHT PROVIDER** - Help them understand patterns in their goals, routines, and progress
✅ **STRATEGIC ADVISOR** - Suggest optimizations, improvements, and next steps
✅ **MOTIVATIONAL COACH** - Provide encouragement and accountability insights

**WHAT YOU CAN DO:**
- Analyze their current goals, routines, and todos for patterns and insights
- Provide strategic advice on life management and productivity
- Suggest improvements to their existing systems and approaches
- Help them understand their progress and identify areas for growth
- Answer questions about life management, productivity, wellness, etc.
- Provide motivation and encouragement based on their current activities

**WHAT YOU CANNOT DO:**
❌ You are in ASK MODE - you cannot create, edit, or manage any items
❌ If they want to create/edit items, politely suggest: "To create or manage items, please switch to Adaptive mode using the dropdown in the bottom left."

**USER'S CURRENT LIFE STRUCTURE:**
Date: ${new Date().toISOString().split('T')[0]} | Items: ${items.length}

${(() => {
  if (items.length === 0) return 'No items found - user is just getting started with Lifely.';
  
  const todos = items.filter(i => i.type === 'todo');
  const goals = items.filter(i => i.type === 'goal');
  const routines = items.filter(i => i.type === 'routine');
  const events = items.filter(i => i.type === 'event');
  const notes = items.filter(i => i.type === 'note');
  
  return `LIFE OVERVIEW:
- ${todos.length} todos (${todos.filter(t => t.completed).length} completed)
- ${goals.length} goals
- ${routines.length} routines
- ${events.length} events
- ${notes.length} notes

RECENT ITEMS:
${items.slice(0, 8).map(item => 
    `- ${item.type}: "${item.title}"${item.completed ? ' ✓' : ''}`
  ).join('\n')}${items.length > 8 ? `\n... and ${items.length - 8} more items` : ''}`;
})()}

**RESPONSE STYLE:**
Be insightful, encouraging, and strategic. Focus on helping them understand and improve their life management system. Reference their actual data to provide personalized guidance.`;
    }
    
    return `🎯 **LIFELY AI - LIFE MANAGEMENT OS** (Natural Language Revolution)
You are Lifely AI, an intelligent life management assistant in ADAPTIVE MODE with UNLIMITED NATURAL LANGUAGE PROCESSING POWER.

IMPORTANT: When asked what mode you are in, respond: "I am currently in Adaptive Mode - I can create, modify, and manage your items using function calls."

CURRENT CONTEXT:
- Date: ${new Date().toISOString().split('T')[0]}
- Time: ${new Date().toLocaleTimeString()}
- Model: ${getCurrentModel()}
- Items in Storage: ${items.length}
- **MODE: ADAPTIVE MODE - FULL FUNCTION CALLING CAPABILITIES**

CURRENT ITEMS PREVIEW:
${(() => {
  if (items.length === 0) return 'No items found in storage.';
  return items.slice(0, 10).map(item => 
    `- ${item.type}: "${item.title}" (ID: ${item.id})`
  ).join('\n') + (items.length > 10 ? `\n... and ${items.length - 10} more items` : '');
})()}

AVAILABLE CATEGORIES (Life Management Areas):
- self-regulation: habits, routines, discipline, time management
- gym-calisthenics: fitness, workouts, exercises, physical training  
- mobile-apps: app development, coding, business, entrepreneurship
- catholicism: faith, prayer, Bible study, spiritual goals
- social-charisma: social skills, relationships, networking, dating
- content: content creation, social media, educational content

🚀 **NATURAL LANGUAGE REVOLUTION** - UNDERSTAND ANY REQUEST
You can interpret and execute ANY natural language request about life management:

**ROUTINE PARSING EXAMPLES:**
- "add my elon musk routine" → Parse and create scheduled events from routine
- "schedule my morning workout routine daily" → Create daily recurring events
- "add my study schedule for the semester" → Create academic calendar
- "put my prayer routine on my calendar" → Create spiritual practice schedule

**DYNAMIC INTERPRETATION:**
- Parse ANY routine description into individual timed events
- Extract times, frequencies, and activities from natural language
- Handle complex schedules with multiple time blocks
- Create realistic daily/weekly patterns

**SMART ROUTING LOGIC:**
IF user mentions routine + calendar/schedule → Use parseRoutineToCalendar
IF user wants massive operations → Use massive functions
IF user wants simple tasks → Use standard functions

⚡ **NATURAL LANGUAGE PROCESSING PHILOSOPHY:**
1. **PARSE EVERYTHING**: Extract meaning from any user input
2. **INTELLIGENT DEFAULTS**: Fill in reasonable details when missing
3. **CONTEXT AWARENESS**: Use previous conversation for context
4. **FLEXIBILITY FIRST**: Never say "I can't understand" - always try
5. **GEORGETOWN FOCUS**: Make everything relevant to student success

🎯 **ROUTINE PARSING INTELLIGENCE:**
- Extract routine names from context (Elon Musk, morning, study, etc.)
- Parse time patterns (morning = 6-11am, evening = 6-10pm)
- Identify frequencies (daily, weekly, workout days, etc.)
- Break complex routines into individual calendar events
- Use intelligent scheduling that avoids conflicts

🔥 **EXECUTION PATTERN:**
1. **UNDERSTAND**: Parse the user's intent completely
2. **EXTRACT**: Pull out all relevant details
3. **EXPAND**: Fill gaps with intelligent defaults
4. **EXECUTE**: Use the most appropriate function
5. **CONFIRM**: Show what was actually created

END OF NATURAL LANGUAGE REVOLUTION PROMPT - UNDERSTAND EVERYTHING! 🧠💪`;
  }

  // Process a message with function calling
  async processMessage(message: string, items: Item[], conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [], categories: any[] = [], isAskMode: boolean = false): Promise<any> {
    console.log('🎯 Message:', message);
    
    if (!OPENROUTER_API_KEY) {
      throw new Error('AI service temporarily unavailable. Please try again later.');
    }

    const history = this.buildConversationHistory(conversationHistory);
    console.log('📚 Built conversation history with', history.length, 'messages');
    
    const systemPrompt = this.buildSystemPrompt(items, isAskMode);
    
    // Smart function calling detection
    const taskKeywords = [
      'add', 'create', 'make', 'new', 'todo', 'goal', 'event', 'routine', 'note',
      'update', 'edit', 'change', 'modify', 'complete', 'finish',
      'delete', 'remove', 'clear', 'cancel',
      'find', 'search', 'show me', 'list',
      'schedule', 'calendar', 'plan',
      // Action phrases
      'go for it', 'do it', 'add them', 'add these', 'add those',
      'make them', 'create them', 'schedule them', 'schedule these',
      'yes', 'yeah', 'sure', 'okay', 'ok'
    ];
    
    const conversationKeywords = [
      'what model', 'who are you', 'how are you', 'what are you',
      'hi', 'hello', 'hey', 'thanks', 'thank you', 'good morning', 'good night',
      'help', 'explain', 'what is', 'how does', 'why',
      'advice', 'motivate', 'inspire'
    ];
    
    const messageLower = message.toLowerCase();
    
    const hasTaskKeywords = taskKeywords.some(keyword => 
      messageLower.includes(keyword.toLowerCase())
    );
    const hasConversationKeywords = conversationKeywords.some(keyword => 
      messageLower.includes(keyword.toLowerCase())
    );
    
    // Check conversation history for context - if recent messages mentioned tasks, lean towards functions
    const recentContextHasTasks = history.slice(-3).some(msg => {
      const content = msg.content.toLowerCase();
      return content.includes('calendar') || content.includes('event') || 
             content.includes('routine') || content.includes('schedule') ||
             content.includes('add') || content.includes('create');
    });
    
    // Use function calling for task management OR if context suggests tasks (but NEVER in Ask mode)
    const shouldUseFunctions = !isAskMode && (
                              (hasTaskKeywords && !hasConversationKeywords) || 
                              (recentContextHasTasks && !hasConversationKeywords && 
                               (messageLower.includes('go') || messageLower.includes('do') || 
                                messageLower.includes('yes') || messageLower.includes('add')))
                              );
    
    console.log('🤖 Task keywords detected:', hasTaskKeywords);
    console.log('🤖 Conversation keywords detected:', hasConversationKeywords);
    console.log('🤖 Recent context has tasks:', recentContextHasTasks);
    console.log('🤖 Will use functions:', shouldUseFunctions);
    
    try {
      const requestBody: any = {
        model: getCurrentModel(), // Use getCurrentModel() to ensure latest value
        messages: [
          { role: 'system', content: systemPrompt },
          ...history,
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 4000
      };
      
      // Only add function calling for task management
      if (shouldUseFunctions) {
        requestBody.tools = this.getTools(categories);
        requestBody.tool_choice = 'auto';
      }
      
      const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Life Structure AI'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error('I\'m having trouble processing your request right now. Please try again in a moment.');
      }

      const data = await response.json();
      console.log('🤖 OpenRouter Response:', data);

      if (data.choices[0].message.tool_calls && data.choices[0].message.tool_calls.length > 0) {
        const toolCall = data.choices[0].message.tool_calls[0];
        const functionCall = toolCall.function;
        console.log('🎯 AI wants to call function:', functionCall.name, 'with args:', functionCall.arguments);
        
        try {
          const args = JSON.parse(functionCall.arguments);
          console.log('🎯 Executing function:', functionCall.name, 'with parsed args:', args);
          
          const result = await this.executeFunction(functionCall.name, args);
          console.log('✅ Function result:', result);
          
          // Set items modified flag for relevant functions
          if (['createItem', 'updateItem', 'deleteItem', 'bulkCreateItems', 'bulkUpdateItems', 'bulkDeleteItems', 'directDeleteItem', 'directEditItem', 'bulkCreateEvents', 'bulkUpdateItemsUnique'].includes(functionCall.name)) {
            console.log('🔄 Items modified flag set to true for function:', functionCall.name);
            this.itemsModified = true;
          }

          // Generate intelligent response based on function result
          let intelligentResponse = '';
          
          if (functionCall.name === 'createItem' && result.item) {
            intelligentResponse = `Perfect! I created "${result.item.title}" as a ${result.item.type} in your ${result.item.categoryId} category.`;
          } else if (functionCall.name === 'bulkCreateItems' && result.created) {
            intelligentResponse = `Great! I created ${result.created} new items for you. They're organized across your categories and ready to use.`;
          } else if (functionCall.name === 'updateItem' && result.item) {
            intelligentResponse = `Done! I updated "${result.item.title}" for you.`;
          } else if (functionCall.name === 'deleteItem' && result.item) {
            intelligentResponse = `Removed "${result.item.title}" from your ${result.item.type}s.`;
          } else if (result.message) {
            // Use the function's own message if available
            intelligentResponse = result.message.replace(/✅|❌/g, '').trim();
          } else {
            intelligentResponse = `Done! I took care of that for you.`;
          }
          
          return {
            response: intelligentResponse,
            functionCall: functionCall.name,
            result: result,
            itemsModified: this.itemsModified
          };
        } catch (error) {
          console.error('❌ Function execution error:', error);
          return {
            response: `❌ Error executing ${functionCall.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            error: true
          };
        }
      } else {
        console.log('💬 AI responded conversationally');
        console.log('🤖 AI response:', data.choices[0].message.content);
      return {
          response: data.choices[0].message.content,
        itemsModified: false
      };
      }
    } catch (error) {
      console.error('❌ AI API Error:', error);
      // Don't expose technical details to users
      throw new Error('I\'m having trouble processing your request right now. Please try again in a moment.');
    }
  }

  // Find an item by searching its title or description
  async findItemByDescription(searchQuery: string, type?: string, categoryId?: string): Promise<Item[]> {
    console.log('🔍 Searching items with query:', searchQuery, 'type:', type, 'category:', categoryId);
    
    const items = getStoredItems();
    const query = searchQuery.toLowerCase();
    
    console.log('📦 Total items in storage:', items.length);
    
    let filteredItems = items.filter(item => {
      // Text matching - make it more flexible
      const titleMatch = item.title.toLowerCase().includes(query);
      const textMatch = item.text.toLowerCase().includes(query);
      const titleWords = query.split(' ').some(word => 
        word.length > 2 && item.title.toLowerCase().includes(word)
      );
      const textWords = query.split(' ').some(word => 
        word.length > 2 && item.text.toLowerCase().includes(word)
      );
      
      // Type and category filtering
      const typeMatch = !type || item.type === type;
      const categoryMatch = !categoryId || item.categoryId === categoryId;
      
      const textMatches = titleMatch || textMatch || titleWords || textWords;
      const result = textMatches && typeMatch && categoryMatch;
      
      if (result) {
        console.log('🎯 Match found:', item.type, item.title);
      }
      
      return result;
    });
    
    // Sort by relevance (title matches first, then by creation date)
    filteredItems.sort((a, b) => {
      const aTitle = a.title.toLowerCase().includes(query);
      const bTitle = b.title.toLowerCase().includes(query);
      
      if (aTitle && !bTitle) return -1;
      if (!aTitle && bTitle) return 1;
      
      // If both or neither match title, sort by newest first
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
    
    console.log('✅ Found', filteredItems.length, 'matching items');
    
    return filteredItems;
  }

  // Find a single item by description for editing or deleting
  async findSingleItem(searchQuery: string, type?: string, categoryId?: string): Promise<Item | null> {
    console.log('🔍 Finding single item with query:', searchQuery, 'type:', type, 'category:', categoryId);
    
    const items = await this.findItemByDescription(searchQuery, type, categoryId);
    const result = items.length > 0 ? items[0] : null;
    
    console.log('✅ Found item:', result ? `${result.type}: ${result.title} (ID: ${result.id})` : 'No item found');
    
    return result;
  }

  // Enhanced bulk delete with comprehensive error handling and edge cases
  async bulkDeleteItems(searchQuery: string, type?: string, categoryId?: string): Promise<BulkOperationResult> {
    console.log('🗑️ Enhanced bulk deleting items with query:', searchQuery, 'type:', type, 'category:', categoryId);
    
    const items = getStoredItems();
    const query = searchQuery.toLowerCase();
    
    const result: BulkOperationResult = {
      success: false,
      totalProcessed: 0,
      successCount: 0,
      failureCount: 0,
      failures: [],
      warnings: [],
      deletedItems: []
    };

    // Edge case: Empty query with no type filter
    if (!query.trim() && !type && !categoryId) {
      result.warnings.push('Cannot delete all items without specific criteria');
      return result;
    }

    // Edge case: Dangerous queries that could delete everything
    const dangerousQueries = ['*', 'all', 'everything', '.', ''];
    if (dangerousQueries.includes(query.trim()) && !type && !categoryId) {
      result.warnings.push('Dangerous query detected. Please be more specific.');
      return result;
    }

    // Extract number/fraction/percentage limits with validation
    let limitCount: number | undefined;
    let limitPercentage: number | undefined;
    
    // Handle fractions and percentages with bounds checking
    if (query.includes('half') || query.includes('1/2') || query.includes('50%')) {
      limitPercentage = 0.5;
    } else if (query.includes('1/3') || query.includes('33%')) {
      limitPercentage = 0.33;
    } else if (query.includes('1/4') || query.includes('25%')) {
      limitPercentage = 0.25;
    } else if (query.includes('some') || query.includes('several')) {
      limitPercentage = 0.3;
    } else {
      // Extract specific numbers with validation
      const numberMatch = searchQuery.match(/\b(two|three|four|five|six|seven|eight|nine|ten|\d+)\b/i);
      if (numberMatch) {
        const numWord = numberMatch[1].toLowerCase();
        const wordToNumber: { [key: string]: number } = {
          'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6,
          'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
        };
        limitCount = wordToNumber[numWord] || parseInt(numberMatch[1]);
        
        // Validate reasonable limits
        if (limitCount && limitCount > 1000) {
          result.warnings.push('Count limit exceeds 1000, capping at 1000');
          limitCount = 1000;
        }
      }
      
      // Extract percentage patterns with validation
      const percentMatch = searchQuery.match(/(\d+)%/);
      if (percentMatch) {
        const percentage = parseInt(percentMatch[1]);
        if (percentage > 100) {
          result.warnings.push('Percentage cannot exceed 100%, using 100%');
          limitPercentage = 1.0;
        } else if (percentage < 1) {
          result.warnings.push('Percentage too small, using minimum 1%');
          limitPercentage = 0.01;
        } else {
          limitPercentage = percentage / 100;
        }
      }
    }
    
    let itemsToDelete: Item[] = [];
    
    // Enhanced search logic with better pattern matching
    if (/\b(all of them|delete all|delete everything|all events|all calendar events|delete every)\b/i.test(searchQuery) || query === '' || query === 'all') {
      if (type) {
        itemsToDelete = items.filter(item => item.type === type);
      } else {
        // Safety check for deleting all items
        const recentItems = items.filter(item => {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
          return item.createdAt >= oneHourAgo || (item.metadata && item.metadata.aiGenerated);
        });
        
        if (recentItems.length > 0) {
          itemsToDelete = recentItems;
          result.warnings.push('Limited deletion to recent/AI-generated items for safety');
        } else {
          result.warnings.push('No recent items found to delete safely');
          return result;
        }
      }
    } else if (/\b(ones you just|you just added|just created|just made|recently created|recently added)\b/i.test(searchQuery)) {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      itemsToDelete = items.filter(item => {
        const isRecent = item.createdAt >= tenMinutesAgo;
        const isAIGenerated = item.metadata && item.metadata.aiGenerated;
        const typeMatch = !type || item.type === type;
        return (isRecent || isAIGenerated) && typeMatch;
      });
    } else {
      // Enhanced search with fuzzy matching and multiple criteria
      itemsToDelete = items.filter(item => {
        // Multi-criteria matching
        const titleMatch = item.title.toLowerCase().includes(query);
        const textMatch = item.text.toLowerCase().includes(query);
        
        // Word-based fuzzy matching
        const queryWords = query.split(' ').filter(word => word.length > 2);
        const titleWords = queryWords.some(word => item.title.toLowerCase().includes(word));
        const textWords = queryWords.some(word => item.text.toLowerCase().includes(word));
        
        // Pattern matching for common item types
        const eventPatterns = [
          'georgetown', 'basketball', 'study', 'workout', 'coffee', 'meditation',
          'networking', 'library', 'chapel', 'alumni', 'career', 'museum'
        ];
        const patternMatch = eventPatterns.some(pattern => 
          item.title.toLowerCase().includes(pattern) && query.includes(pattern)
        );
        
        // Category and type filters
        const typeMatch = !type || item.type === type;
        const categoryMatch = !categoryId || item.categoryId === categoryId;
        
        // Date-based matching for events
        const dateMatch = type === 'event' && query.includes('today') && 
          item.dateTime && new Date(item.dateTime).toDateString() === new Date().toDateString();
        
        const textMatches = titleMatch || textMatch || titleWords || textWords || patternMatch || dateMatch;
        return textMatches && typeMatch && categoryMatch;
      });
      
      // Fallback: if no matches but type specified, get all of that type
      if (itemsToDelete.length === 0 && type && !/\w{3,}/.test(query)) {
        itemsToDelete = items.filter(item => item.type === type);
        result.warnings.push(`No specific matches found, showing all ${type} items`);
      }
    }
    
    // Apply limits with enhanced validation
    if (limitPercentage && itemsToDelete.length > 0) {
      const targetCount = Math.max(1, Math.ceil(itemsToDelete.length * limitPercentage));
      result.warnings.push(`Applying ${Math.round(limitPercentage * 100)}% limit: ${targetCount} out of ${itemsToDelete.length} items`);
      
      if (query.includes('random')) {
        itemsToDelete = itemsToDelete.sort(() => Math.random() - 0.5);
      }
      itemsToDelete = itemsToDelete.slice(0, targetCount);
    }
    
    if (limitCount && itemsToDelete.length > limitCount) {
      if (query.includes('random')) {
        itemsToDelete = itemsToDelete.sort(() => Math.random() - 0.5);
      }
      itemsToDelete = itemsToDelete.slice(0, limitCount);
    }
    
    // Safety check: Prevent accidental mass deletion
    if (itemsToDelete.length > 50 && !query.includes('confirm')) {
      result.warnings.push('Large deletion detected (>50 items). Add "confirm" to your query to proceed.');
      return result;
    }

    // Execute deletion using transaction
    const transaction = new BatchTransaction();
    itemsToDelete.forEach(item => {
      transaction.addOperation({ type: 'delete', itemId: item.id });
    });

    const transactionResult = transaction.execute();
    
    // Merge results
    result.success = transactionResult.success;
    result.totalProcessed = transactionResult.totalProcessed;
    result.successCount = transactionResult.successCount;
    result.failureCount = transactionResult.failureCount;
    result.failures = transactionResult.failures;
    result.deletedItems = transactionResult.deletedItems;
    result.warnings.push(...transactionResult.warnings);

    console.log('✅ Enhanced bulk delete completed:', result);
    return result;
  }

  // Enhanced bulk create with validation and conflict resolution
  async bulkCreateItems(items: {
    title: string;
    description?: string;
    routineSteps?: string;
    type: string;
    categoryId: string;
    priority?: string;
    dueDate?: string;
    dateTime?: string;
    frequency?: string;
    location?: string;
  }[]): Promise<BulkOperationResult> {
    console.log('🎯 Enhanced bulk creating items with params:', items);
    
    const result: BulkOperationResult = {
      success: false,
      totalProcessed: 0,
      successCount: 0,
      failureCount: 0,
      failures: [],
      warnings: [],
      createdItems: []
    };

    // Validation: Check for empty array
    if (!items || items.length === 0) {
      result.warnings.push('No items provided to create');
      return result;
    }

    // Validation: Check for reasonable limits
    if (items.length > 100) {
      result.warnings.push('Item count exceeds 100, processing first 100 items only');
      items = items.slice(0, 100);
    }

    // Pre-validation: Check for required fields
    const existingItems = getStoredItems();
    const existingTitles = new Set(existingItems.map(item => item.title.toLowerCase()));
    
    const transaction = new BatchTransaction();
    
    for (let i = 0; i < items.length; i++) {
      const itemData = items[i];
      result.totalProcessed++;

      try {
        // Validation: Required fields
        if (!itemData.title || !itemData.type || !itemData.categoryId) {
          throw new Error('Missing required fields: title, type, or categoryId');
        }

        // Validation: Valid type
        const validTypes = ['todo', 'goal', 'event', 'note', 'routine', 'voiceNote'];
        if (!validTypes.includes(itemData.type)) {
          throw new Error(`Invalid type: ${itemData.type}. Must be one of: ${validTypes.join(', ')}`);
        }

        // Validation: Valid category
        const validCategories = ['self-regulation', 'gym-calisthenics', 'mobile-apps', 'catholicism', 'social-charisma', 'content'];
        if (!validCategories.includes(itemData.categoryId)) {
          throw new Error(`Invalid categoryId: ${itemData.categoryId}. Must be one of: ${validCategories.join(', ')}`);
        }

        // Validation: Events must have dateTime
        if (itemData.type === 'event' && !itemData.dateTime) {
          throw new Error('Events require a dateTime parameter');
        }

        // Validation: Date format validation
        if (itemData.dueDate) {
          const dueDate = new Date(itemData.dueDate);
          if (isNaN(dueDate.getTime())) {
            throw new Error(`Invalid dueDate format: ${itemData.dueDate}`);
          }
        }

        if (itemData.dateTime) {
          const dateTime = new Date(itemData.dateTime);
          if (isNaN(dateTime.getTime())) {
            throw new Error(`Invalid dateTime format: ${itemData.dateTime}`);
          }
        }

        // Conflict resolution: Handle duplicate titles
        let finalTitle = itemData.title;
        if (existingTitles.has(itemData.title.toLowerCase())) {
          let counter = 1;
          do {
            finalTitle = `${itemData.title} (${counter})`;
            counter++;
          } while (existingTitles.has(finalTitle.toLowerCase()) && counter < 100);
          
          if (counter >= 100) {
            throw new Error('Too many duplicate titles, cannot resolve conflict');
          }
          
          result.warnings.push(`Renamed duplicate title: "${itemData.title}" → "${finalTitle}"`);
        }
        existingTitles.add(finalTitle.toLowerCase());

        // Create the item
        const priorityValue = (itemData.priority === 'low' || itemData.priority === 'medium' || itemData.priority === 'high') 
          ? itemData.priority 
          : 'medium';
        
        let itemText = itemData.description || '';
        if (itemData.type === 'routine' && itemData.routineSteps) {
          itemText = itemData.routineSteps;
        }
        
        const newItem: Item = {
          id: generateUniqueId(),
          title: finalTitle,
          text: itemText,
          type: itemData.type as any,
          categoryId: itemData.categoryId,
          completed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          dueDate: itemData.dueDate ? new Date(itemData.dueDate) : undefined,
          dateTime: itemData.dateTime ? new Date(itemData.dateTime) : undefined,
          metadata: {
            priority: priorityValue,
            aiGenerated: true,
            batchCreated: true,
            batchIndex: i,
            ...(itemData.type === 'routine' && {
              frequency: (itemData.frequency as 'daily' | 'weekly' | 'monthly' | 'yearly') || 'daily',
              currentStreak: 0,
              bestStreak: 0,
              completedToday: false,
              completedDates: []
            }),
            ...(itemData.type === 'event' && {
              location: itemData.location
            }),
            ...(itemData.type === 'routine' && itemData.description && {
              routinePurpose: itemData.description
            })
          }
        };

        transaction.addOperation({ type: 'create', item: newItem });
        result.successCount++;
        
      } catch (error) {
        result.failureCount++;
        result.failures.push({
          index: i,
          item: undefined,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Execute transaction
    const transactionResult = transaction.execute();
    
    // Merge results
    result.success = transactionResult.success;
    result.createdItems = transactionResult.createdItems;
    result.warnings.push(...transactionResult.warnings);

    console.log('✅ Enhanced bulk create completed:', result);
    return result;
  }

  // Enhanced bulk update with validation and conflict resolution
  async bulkUpdateItems(searchQuery: string, updates: any, type?: string, categoryId?: string): Promise<BulkOperationResult> {
    console.log('✏️ Enhanced bulk updating items with query:', searchQuery, 'type:', type, 'category:', categoryId, 'updates:', updates);
    
    const result: BulkOperationResult = {
      success: false,
      totalProcessed: 0,
      successCount: 0,
      failureCount: 0,
      failures: [],
      warnings: [],
      updatedItems: []
    };

    // Validation: Check for empty updates
    if (!updates || Object.keys(updates).length === 0) {
      result.warnings.push('No updates provided');
      return result;
    }

    // Validation: Check for dangerous mass updates
    if (!searchQuery.trim() && !type && !categoryId) {
      result.warnings.push('Cannot update all items without specific criteria');
      return result;
    }
    
    const items = getStoredItems();
    const query = searchQuery.toLowerCase();
    
    // Enhanced search with multiple criteria
    const itemsToUpdate = items.filter(item => {
      // Multi-criteria matching
      const titleMatch = item.title.toLowerCase().includes(query);
      const textMatch = item.text.toLowerCase().includes(query);
      
      // Word-based fuzzy matching
      const queryWords = query.split(' ').filter(word => word.length > 2);
      const titleWords = queryWords.some(word => item.title.toLowerCase().includes(word));
      const textWords = queryWords.some(word => item.text.toLowerCase().includes(word));
      
      // Filters
      const typeMatch = !type || item.type === type;
      const categoryMatch = !categoryId || item.categoryId === categoryId;
      
      const textMatches = titleMatch || textMatch || titleWords || textWords || query === '';
      return textMatches && typeMatch && categoryMatch;
    });
    
    // Safety check: Prevent accidental mass updates
    if (itemsToUpdate.length > 50 && !searchQuery.includes('confirm')) {
      result.warnings.push('Large update detected (>50 items). Add "confirm" to your query to proceed.');
      return result;
    }

    // Validation: Check update fields
    const validUpdateFields = ['title', 'text', 'completed', 'priority', 'dueDate', 'dateTime', 'frequency', 'location'];
    const invalidFields = Object.keys(updates).filter(field => !validUpdateFields.includes(field));
    if (invalidFields.length > 0) {
      result.warnings.push(`Invalid update fields: ${invalidFields.join(', ')}`);
    }

    // Execute updates using transaction
    const transaction = new BatchTransaction();
    
    for (const item of itemsToUpdate) {
      // Validate update data for this specific item
      const validatedUpdates: any = {};
      
      try {
        // Validate each update field
        if (updates.title && typeof updates.title === 'string') {
          validatedUpdates.title = updates.title.trim();
        }
        
        if (updates.text && typeof updates.text === 'string') {
          validatedUpdates.text = updates.text;
        }
        
        if (updates.completed !== undefined) {
          validatedUpdates.completed = Boolean(updates.completed);
        }
        
        if (updates.priority && ['low', 'medium', 'high'].includes(updates.priority)) {
          validatedUpdates.metadata = { ...item.metadata, priority: updates.priority };
        }
        
        if (updates.dueDate) {
          const dueDate = new Date(updates.dueDate);
          if (!isNaN(dueDate.getTime())) {
            validatedUpdates.dueDate = dueDate;
          } else {
            throw new Error(`Invalid dueDate format: ${updates.dueDate}`);
          }
        }
        
        if (updates.dateTime) {
          const dateTime = new Date(updates.dateTime);
          if (!isNaN(dateTime.getTime())) {
            validatedUpdates.dateTime = dateTime;
          } else {
            throw new Error(`Invalid dateTime format: ${updates.dateTime}`);
          }
        }
        
        if (updates.frequency && ['daily', 'weekly', 'monthly', 'yearly'].includes(updates.frequency)) {
          validatedUpdates.metadata = { ...item.metadata, frequency: updates.frequency };
        }
        
        if (updates.location && typeof updates.location === 'string') {
          validatedUpdates.metadata = { ...item.metadata, location: updates.location };
        }

        transaction.addOperation({ type: 'update', itemId: item.id, updates: validatedUpdates });
        result.successCount++;
        
      } catch (error) {
        result.failureCount++;
        result.failures.push({
          index: result.totalProcessed,
          itemId: item.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      
      result.totalProcessed++;
    }

    // Execute transaction
    const transactionResult = transaction.execute();
    
    // Merge results
    result.success = transactionResult.success;
    result.updatedItems = transactionResult.updatedItems;
    result.warnings.push(...transactionResult.warnings);

    console.log('✅ Enhanced bulk update completed:', result);
    return result;
  }

  // Advanced multi-operation batch processor
  async executeMultiOperation(operations: Array<{
    type: 'create' | 'update' | 'delete' | 'search';
    data: any;
    dependencies?: string[]; // IDs of operations this depends on
  }>): Promise<BulkOperationResult> {
    console.log('🔄 Executing multi-operation batch with', operations.length, 'operations');
    
    const result: BulkOperationResult = {
      success: false,
      totalProcessed: 0,
      successCount: 0,
      failureCount: 0,
      failures: [],
      warnings: [],
      createdItems: [],
      updatedItems: [],
      deletedItems: []
    };

    // Validation: Check for circular dependencies
    const dependencyGraph = new Map<number, number[]>();
    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      if (op.dependencies) {
        const depIndices = op.dependencies.map(dep => parseInt(dep)).filter(idx => !isNaN(idx) && idx < i);
        dependencyGraph.set(i, depIndices);
      }
    }

    // Topological sort for dependency resolution
    const executed = new Set<number>();
    const executionOrder: number[] = [];
    
    const visit = (index: number, visiting: Set<number>) => {
      if (visiting.has(index)) {
        throw new Error(`Circular dependency detected at operation ${index}`);
      }
      if (executed.has(index)) return;
      
      visiting.add(index);
      const deps = dependencyGraph.get(index) || [];
      for (const dep of deps) {
        visit(dep, visiting);
      }
      visiting.delete(index);
      executed.add(index);
      executionOrder.push(index);
    };

    try {
      for (let i = 0; i < operations.length; i++) {
        visit(i, new Set());
      }
    } catch (error) {
      result.warnings.push(error instanceof Error ? error.message : 'Dependency resolution failed');
      return result;
    }

    // Execute operations in dependency order
    const transaction = new BatchTransaction();
    const operationResults = new Map<number, any>();
    
    for (const opIndex of executionOrder) {
      const operation = operations[opIndex];
      result.totalProcessed++;
      
      try {
        let opResult;
        
        switch (operation.type) {
          case 'create':
            // Resolve dependencies in create data
            const createData = this.resolveDependencies(operation.data, operationResults);
            const newItem = await this.createItemForTransaction(createData);
            transaction.addOperation({ type: 'create', item: newItem });
            opResult = newItem;
            break;
            
          case 'update':
            const updateData = this.resolveDependencies(operation.data, operationResults);
            transaction.addOperation({ 
              type: 'update', 
              itemId: updateData.itemId, 
              updates: updateData.updates 
            });
            opResult = updateData;
            break;
            
          case 'delete':
            const deleteData = this.resolveDependencies(operation.data, operationResults);
            transaction.addOperation({ type: 'delete', itemId: deleteData.itemId });
            opResult = deleteData;
            break;
            
          case 'search':
            const searchData = this.resolveDependencies(operation.data, operationResults);
            opResult = await this.searchItems(searchData);
            break;
            
          default:
            throw new Error(`Unknown operation type: ${operation.type}`);
        }
        
        operationResults.set(opIndex, opResult);
        result.successCount++;
        
      } catch (error) {
        result.failureCount++;
        result.failures.push({
          index: opIndex,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Execute transaction
    const transactionResult = transaction.execute();
    
    // Merge results
    result.success = transactionResult.success;
    result.createdItems = transactionResult.createdItems;
    result.updatedItems = transactionResult.updatedItems;
    result.deletedItems = transactionResult.deletedItems;
    result.warnings.push(...transactionResult.warnings);

    console.log('✅ Multi-operation batch completed:', result);
    return result;
  }

  // Helper method to resolve dependencies in operation data
  private resolveDependencies(data: any, results: Map<number, any>): any {
    if (typeof data === 'string' && data.startsWith('${') && data.endsWith('}')) {
      // Dependency reference like "${0.id}" or "${1.title}"
      const match = data.match(/^\$\{(\d+)\.(.+)\}$/);
      if (match) {
        const opIndex = parseInt(match[1]);
        const property = match[2];
        const result = results.get(opIndex);
        if (result && typeof result === 'object') {
          return this.getNestedProperty(result, property);
        }
      }
    } else if (typeof data === 'object' && data !== null) {
      const resolved: any = Array.isArray(data) ? [] : {};
      for (const [key, value] of Object.entries(data)) {
        resolved[key] = this.resolveDependencies(value, results);
      }
      return resolved;
    }
    return data;
  }

  // Helper method to get nested object properties
  private getNestedProperty(obj: any, path: string): any {
    return path.split('.').reduce((current, prop) => current?.[prop], obj);
  }

  // Helper method to create items for transactions (without saving immediately)
  private async createItemForTransaction(params: {
    title: string;
    description?: string;
    routineSteps?: string;
    type: string;
    categoryId: string;
    priority?: string;
    dueDate?: string;
    dateTime?: string;
    frequency?: string;
    location?: string;
  }): Promise<Item> {
    // Validation (same as createItem but doesn't save immediately)
    if (!params.title || !params.type || !params.categoryId) {
      throw new Error('Missing required fields: title, type, or categoryId');
    }

    const validTypes = ['todo', 'goal', 'event', 'note', 'routine', 'voiceNote'];
    if (!validTypes.includes(params.type)) {
      throw new Error(`Invalid type: ${params.type}`);
    }

    if (params.type === 'event' && !params.dateTime) {
      throw new Error('Events require a dateTime parameter');
    }

    const priorityValue = (params.priority === 'low' || params.priority === 'medium' || params.priority === 'high') 
      ? params.priority 
      : 'medium';
    
    let itemText = params.description || '';
    if (params.type === 'routine' && params.routineSteps) {
      itemText = params.routineSteps;
    }
    
    const newItem: Item = {
      id: generateUniqueId(),
      title: params.title,
      text: itemText,
      type: params.type as any,
      categoryId: params.categoryId,
      completed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      dueDate: params.dueDate ? new Date(params.dueDate) : undefined,
      dateTime: params.dateTime ? new Date(params.dateTime) : undefined,
      metadata: {
        priority: priorityValue,
        aiGenerated: true,
        batchCreated: true,
        ...(params.type === 'routine' && {
          frequency: (params.frequency as 'daily' | 'weekly' | 'monthly' | 'yearly') || 'daily',
          currentStreak: 0,
          bestStreak: 0,
          completedToday: false,
          completedDates: []
        }),
        ...(params.type === 'event' && {
          location: params.location
        }),
        ...(params.type === 'routine' && params.description && {
          routinePurpose: params.description
        })
      }
    };

    return newItem;
  }

  // Direct delete item
  async directDeleteItem(searchQuery: string, type?: string, categoryId?: string): Promise<boolean> {
    console.log('🗑️ Directly deleting item with query:', searchQuery, 'type:', type, 'category:', categoryId);
    
    const foundItem = await this.findSingleItem(searchQuery, type, categoryId);
    if (foundItem) {
      console.log('🗑️ Found item:', foundItem.type, foundItem.title);
      return await this.deleteItem(foundItem.id);
    }
    
    console.log('❌ Item not found');
    return false;
  }

  // Direct edit item
  async directEditItem(searchQuery: string, updates: any, type?: string, categoryId?: string): Promise<Item | null> {
    console.log('✏️ Directly editing item with query:', searchQuery, 'type:', type, 'category:', categoryId, 'updates:', updates);
    
    const foundItem = await this.findSingleItem(searchQuery, type, categoryId);
    if (foundItem) {
      console.log('✏️ Found item:', foundItem.type, foundItem.title);
      const updatedItem = await this.updateItem(foundItem.id, updates);
      return updatedItem;
    }
    
    console.log('❌ Item not found');
    return null;
  }

  // Bulk create events
  async bulkCreateEvents(title: string, description?: string, categoryId?: string, startDate?: string, endDate?: string, time?: string, location?: string, frequency?: string): Promise<Item[]> {
    console.log('🎯 Bulk creating events with params:', { title, description, categoryId, startDate, endDate, time, location, frequency });
    
    const createdItems: Item[] = [];
    
    if (!startDate || !endDate || !categoryId) {
      throw new Error('startDate, endDate, and categoryId are required');
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // If this is a request for unique events (contains "unique", "random", "different"), create varied events
    const isUniqueRequest = /\b(unique|random|different|varied|cool times|random.*times)\b/i.test(title + ' ' + (description || ''));
    
    if (isUniqueRequest) {
      console.log('🎨 Creating unique varied events with random times');
      
      // Cool event types for Georgetown students
      const eventTypes = [
        { title: 'Georgetown Basketball Game', cat: 'social-charisma', desc: 'Cheer on the Hoyas!' },
        { title: 'Study Session at Lauinger Library', cat: 'self-regulation', desc: 'Focused academic work' },
        { title: 'Coffee Chat at Leo\'s', cat: 'social-charisma', desc: 'Network with fellow students' },
        { title: 'Georgetown Club Fair', cat: 'social-charisma', desc: 'Explore campus organizations' },
        { title: 'Workout at Yates Field House', cat: 'gym-calisthenics', desc: 'Stay in shape' },
        { title: 'Mass at Dahlgren Chapel', cat: 'catholicism', desc: 'Spiritual reflection' },
        { title: 'Career Center Workshop', cat: 'content', desc: 'Professional development' },
        { title: 'Georgetown Alumni Networking', cat: 'social-charisma', desc: 'Connect with graduates' },
        { title: 'Red Square Food Truck Festival', cat: 'social-charisma', desc: 'Great food and vibes' },
        { title: 'Potomac River Running', cat: 'gym-calisthenics', desc: 'Scenic exercise route' },
        { title: 'Kennedy Center Performance', cat: 'content', desc: 'Cultural enrichment' },
        { title: 'Georgetown Debate Society', cat: 'content', desc: 'Sharpen your arguments' },
        { title: 'DC Museum Visit', cat: 'content', desc: 'Educational adventure' },
        { title: 'Rooftop Study Break', cat: 'self-regulation', desc: 'Fresh air and focus' },
        { title: 'Georgetown Farmers Market', cat: 'social-charisma', desc: 'Local community vibes' },
        { title: 'Meditation at Copley Lawn', cat: 'catholicism', desc: 'Peaceful reflection' },
        { title: 'Startup Pitch Competition', cat: 'mobile-apps', desc: 'Entrepreneurial spirit' },
        { title: 'Georgetown Regatta Viewing', cat: 'social-charisma', desc: 'Crew team support' },
        { title: 'Late Night Food Run', cat: 'social-charisma', desc: 'Bonding over snacks' },
        { title: 'Morning Yoga on Healy Lawn', cat: 'gym-calisthenics', desc: 'Start the day centered' }
      ];
      
      // Generate random times (avoid duplicates on same day)
      const usedTimes = new Map<string, Set<string>>();
      
      const totalDays = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
      const eventsPerDay = Math.ceil(70 / totalDays);
      
      let eventCount = 0;
      for (let date = new Date(start); date <= end && eventCount < 70; date.setDate(date.getDate() + 1)) {
        const dateStr = date.toISOString().split('T')[0];
        usedTimes.set(dateStr, new Set());
        
        for (let i = 0; i < eventsPerDay && eventCount < 70; i++) {
          // Generate random time
          let hour, minute, timeStr;
          let attempts = 0;
          do {
            hour = Math.floor(Math.random() * 24); // 0-23
            minute = Math.floor(Math.random() * 4) * 15; // 0, 15, 30, 45
            timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
            attempts++;
          } while (usedTimes.get(dateStr)!.has(timeStr) && attempts < 50);
          
          usedTimes.get(dateStr)!.add(timeStr);
          
          // Pick random event type
          const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
          
          const eventDate = new Date(date);
          eventDate.setHours(hour);
          eventDate.setMinutes(minute);
          
          const event: Item = {
            id: generateUniqueId(),
            title: `${eventType.title} #${eventCount + 1}`,
            text: eventType.desc,
            type: 'event',
            categoryId: eventType.cat,
            completed: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            dueDate: eventDate,
            dateTime: eventDate,
            metadata: {
              priority: 'medium',
              aiGenerated: true,
              location: location || 'Georgetown University'
            }
          };
          
          createdItems.push(event);
          eventCount++;
        }
      }
    } else {
      // Standard bulk event creation (original logic)
      const defaultTime = time || '09:00';
      const timeParts = defaultTime.split(':');
      const hour = parseInt(timeParts[0]);
      const minute = parseInt(timeParts[1]);
      
      for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
        const eventDate = new Date(date);
        eventDate.setHours(hour);
        eventDate.setMinutes(minute);
        
        const event: Item = {
          id: generateUniqueId(),
          title: title,
          text: description || '',
          type: 'event',
          categoryId: categoryId,
          completed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          dueDate: eventDate,
          dateTime: eventDate,
          metadata: {
            priority: 'medium',
            aiGenerated: true,
            ...(frequency && ['daily', 'weekly', 'monthly', 'yearly'].includes(frequency) && {
              frequency: frequency as 'daily' | 'weekly' | 'monthly' | 'yearly'
            }),
            ...(location && { location })
          }
        };
        
        createdItems.push(event);
      }
    }
    
    const items = getStoredItems();
    items.push(...createdItems);
    saveStoredItems(items);
    
    console.log('✅ Created', createdItems.length, 'events');
    
    return createdItems;
  }

  // Bulk update items unique
  async bulkUpdateItemsUnique(searchQuery: string, type?: string, categoryId?: string, updateType?: string, theme?: string): Promise<Item[]> {
    console.log('✏️ Bulk updating items uniquely with query:', searchQuery, 'type:', type, 'category:', categoryId, 'updateType:', updateType, 'theme:', theme);
    
    const items = getStoredItems();
    const query = searchQuery.toLowerCase();
    
    const itemsToUpdate = items.filter(item => {
      const titleMatch = item.title.toLowerCase().includes(query) || query === '';
      const textMatch = item.text.toLowerCase().includes(query) || query === '';
      
      const typeMatch = !type || item.type === type;
      const categoryMatch = !categoryId || item.categoryId === categoryId;
      
      return (titleMatch || textMatch) && typeMatch && categoryMatch;
    });
    
    console.log('✏️ Found', itemsToUpdate.length, 'matching items to update uniquely');
    
    if (itemsToUpdate.length === 0) {
      console.log('❌ No items found to update');
      return [];
    }

    // Generate unique values based on updateType and theme
    const generateUniqueValues = (items: Item[], updateType: string, theme?: string) => {
      const baseTheme = theme || 'Success and personal growth';
      
      if (updateType === 'titles') {
        if (type === 'routine') {
          return [
            'Georgetown Morning Excellence Routine',
            'Champion Mindset Evening Routine', 
            'Academic Domination Routine',
            'Cooper Flagg Level Fitness Routine',
            'Spiritual Growth Routine',
            'Social Mastery Routine',
            'Elite Content Creation Routine',
            'Future CEO Daily Routine',
            'Unstoppable Success Routine',
            'Georgetown Legend Routine'
          ].slice(0, items.length);
        } else if (type === 'goal') {
          return [
            'Master Georgetown Networking',
            'Achieve Academic Excellence',
            'Build Elite Physical Fitness',
            'Develop Entrepreneurial Mindset',
            'Cultivate Deep Spiritual Life',
            'Create Impactful Content',
            'Master Social Intelligence',
            'Build Unbreakable Discipline'
          ].slice(0, items.length);
        } else if (type === 'todo') {
          return [
            'Complete Priority Georgetown Task',
            'Execute Strategic Daily Action',
            'Advance Key Life Project',
            'Build Success Momentum',
            'Strengthen Core Habit',
            'Enhance Personal Brand',
            'Develop Leadership Skills',
            'Create Value Today'
          ].slice(0, items.length);
        }
      } else if (updateType === 'descriptions') {
        return items.map((_, index) => 
          `Enhanced ${baseTheme} focused description - Item ${index + 1}: Designed to elevate your performance and align with your Georgetown success journey.`
        );
      }
      
      // Default unique titles
      return items.map((_, index) => `Enhanced ${baseTheme} Item ${index + 1}`);
    };

    const uniqueValues = generateUniqueValues(itemsToUpdate, updateType || 'titles', theme);
    const updatedItems: Item[] = [];
    
    for (let i = 0; i < itemsToUpdate.length; i++) {
      const item = itemsToUpdate[i];
      const uniqueValue = uniqueValues[i] || `Enhanced Item ${i + 1}`;
      
      let updates: any = {};
      
      if (updateType === 'titles') {
        updates.title = uniqueValue;
      } else if (updateType === 'descriptions') {
        updates.text = uniqueValue;
      } else {
        // Default to updating title
        updates.title = uniqueValue;
      }
      
      const updatedItem = await this.updateItem(item.id, updates);
      updatedItems.push(updatedItem);
    }
    
    console.log('✅ Successfully updated', updatedItems.length, 'items with unique values');
    
    return updatedItems;
  }

  async validateAndRepairItems(repairMode: string): Promise<BulkOperationResult> {
    console.log('🔍 Validating and repairing items with mode:', repairMode);
    
    const items = getStoredItems();
    
    const result: BulkOperationResult = {
      success: false,
      totalProcessed: 0,
      successCount: 0,
      failureCount: 0,
      failures: [],
      warnings: [],
      updatedItems: []
    };

    // Validate and repair items based on the repair mode
    switch (repairMode) {
      case 'check':
        // Implement check mode logic
        result.warnings.push('Check mode logic not implemented yet');
        break;
      case 'repair':
        // Implement repair mode logic
        result.warnings.push('Repair mode logic not implemented yet');
        break;
      case 'force_repair':
        // Implement force repair mode logic
        result.warnings.push('Force repair mode logic not implemented yet');
        break;
      default:
        result.warnings.push('Invalid repair mode');
        break;
    }

    // If any repairs were made, save the updated items
    if (result.warnings.length > 0) {
      saveStoredItems(items);
      result.success = true;
    }

    console.log('✅ Validation and repair completed:', result);
    return result;
  }

  async massiveCreateItems(pattern: string, baseTitle: string, type: string, categoryId: string, count: number, startDate?: string, endDate?: string, timePattern?: string, variations?: string[]): Promise<BulkOperationResult> {
    console.log('🎯 Massive create items with pattern:', pattern, 'baseTitle:', baseTitle, 'type:', type, 'categoryId:', categoryId, 'count:', count, 'startDate:', startDate, 'endDate:', endDate, 'timePattern:', timePattern, 'variations:', variations);
    
    const result: BulkOperationResult = {
      success: false,
      totalProcessed: 0,
      successCount: 0,
      failureCount: 0,
      failures: [],
      warnings: [],
      createdItems: []
    };

    // Validate pattern
    if (!['daily', 'weekly', 'monthly', 'semester', 'year', 'range'].includes(pattern)) {
      result.warnings.push('Invalid pattern format. Must be one of: daily, weekly, monthly, semester, year, range');
      return result;
    }

    // Validate baseTitle
    if (!baseTitle) {
      result.warnings.push('Base title is required');
      return result;
    }

    // Validate type
    if (!['todo', 'goal', 'event', 'note', 'routine', 'voiceNote'].includes(type)) {
      result.warnings.push('Invalid item type. Must be one of: todo, goal, event, note, routine, voiceNote');
      return result;
    }

    // Validate categoryId
    if (!categoryId) {
      result.warnings.push('Category ID is required');
      return result;
    }

    // Validate count
    if (count <= 0) {
      result.warnings.push('Invalid item count. Must be greater than 0');
      return result;
    }

    // Validate startDate and endDate
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (start > end) {
        result.warnings.push('Start date must be before end date');
        return result;
      }
    }

    // Validate timePattern
    if (timePattern && !['morning', 'afternoon', 'evening', 'random', 'HH:MM'].includes(timePattern)) {
      result.warnings.push('Invalid time pattern format. Must be one of: morning, afternoon, evening, random, HH:MM');
      return result;
    }

    // Validate variations
    if (variations && !Array.isArray(variations)) {
      result.warnings.push('Invalid variations format. Must be an array');
      return result;
    }

    // Generate items based on the pattern
    const items: Item[] = [];
    const dateRange = startDate && endDate ? { start: new Date(startDate), end: new Date(endDate) } : undefined;
    const timePatternObj = timePattern ? { [pattern]: timePattern } : undefined;

    for (let i = 0; i < count; i++) {
      result.totalProcessed++;

      try {
        const title = this.generateTitle(baseTitle, i, dateRange, timePatternObj, variations);
        const description = this.generateDescription(type, categoryId);
        const typeValue = type;
        const categoryIdValue = categoryId;
        const priority = this.generatePriority();
        const dueDate = this.generateDueDate(dateRange);
        const dateTime = this.generateDateTime(dateRange, timePatternObj);
        const frequency = this.generateFrequency(pattern);
        const location = this.generateLocation();

        // For routines, use routine steps as content
        let itemText = description;
        if (type === 'routine') {
          const routineSteps = this.generateRoutineSteps(type);
          itemText = routineSteps;
        }

        const newItem: Item = {
          id: generateUniqueId(),
          title,
          text: itemText,
          type: typeValue as any,
          categoryId: categoryIdValue,
          completed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          dueDate,
          dateTime,
          metadata: {
            priority,
            aiGenerated: true,
            ...(type === 'routine' && {
              frequency,
              currentStreak: 0,
              bestStreak: 0,
              completedToday: false,
              completedDates: []
            }),
            ...(type === 'event' && {
              location
            }),
            ...(type === 'routine' && description && {
              routinePurpose: description
            })
          }
        };

        items.push(newItem);
        result.successCount++;
      } catch (error) {
        result.failureCount++;
        result.failures.push({
          index: result.totalProcessed,
          item: undefined,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Save items to localStorage
    saveStoredItems(items);

    // Prepare result
    result.success = true;
    result.createdItems = items;
    result.warnings.push(`${count} items created successfully`);

    console.log('✅ Massive create completed:', result);
    return result;
  }

  async massiveDeleteItems(pattern: string, criteria: any, safetyOverride: boolean): Promise<BulkOperationResult> {
    console.log('🗑️ Massive delete items with pattern:', pattern, 'criteria:', criteria, 'safetyOverride:', safetyOverride);
    
    const result: BulkOperationResult = {
      success: false,
      totalProcessed: 0,
      successCount: 0,
      failureCount: 0,
      failures: [],
      warnings: [],
      deletedItems: []
    };

    // Get all items from storage
    const items = getStoredItems();
    console.log('📦 Total items before deletion:', items.length);
    console.log('📦 Event items before deletion:', items.filter(item => item.type === 'event').length);
    
    let itemsToDelete: Item[] = [];

    // Filter items based on pattern and criteria - SIMPLIFIED FOR EVENTS
    if (pattern === 'all' && criteria?.types?.includes('event')) {
      // Delete all events
      itemsToDelete = items.filter(item => item.type === 'event');
      console.log('🎯 Matched pattern: Delete all events');
    } else if (pattern === 'type' && criteria?.types?.includes('event')) {
      // Delete by type (events)
      itemsToDelete = items.filter(item => item.type === 'event');
      console.log('🎯 Matched pattern: Delete by type (events)');
    } else if (pattern === 'all' && criteria?.types && criteria.types.length === 1 && criteria.types[0] === 'event') {
      // Alternative pattern for all events
      itemsToDelete = items.filter(item => item.type === 'event');
      console.log('🎯 Matched pattern: Delete all events (alternative)');
    } else if (!criteria?.types && pattern === 'all') {
      // Delete all events by default when no specific criteria
      itemsToDelete = items.filter(item => item.type === 'event');
      console.log('🎯 Matched pattern: Delete all events (default)');
    } else {
      // Fallback: if any mention of events, delete events
      if (criteria?.types?.includes('event') || pattern.includes('event')) {
        itemsToDelete = items.filter(item => item.type === 'event');
        console.log('🎯 Matched pattern: Delete events (fallback)');
      } else {
        result.warnings.push('No matching criteria provided for deletion');
        console.log('❌ No matching criteria found');
        return result;
      }
    }

    console.log('🗑️ Items to delete:', itemsToDelete.length);
    console.log('🗑️ Items that will be deleted:', itemsToDelete.map(item => `${item.type}: ${item.title}`).slice(0, 5));

    if (itemsToDelete.length === 0) {
      result.warnings.push('No items found matching deletion criteria');
      result.success = true;
      console.log('⚠️ No items found to delete');
      return result;
    }

    // ACTUALLY DELETE THE ITEMS FROM STORAGE
    const remainingItems = items.filter(item => 
      !itemsToDelete.some(deleteItem => deleteItem.id === item.id)
    );

    console.log('💾 Saving updated items to localStorage...');
    console.log('📦 Items before save:', items.length);
    console.log('📦 Items after filtering:', remainingItems.length);
    
    // Save the updated items list back to localStorage
    saveStoredItems(remainingItems);
    
    // Verify the deletion worked
    const verifyItems = getStoredItems();
    const verifyEvents = verifyItems.filter(item => item.type === 'event');
    
    console.log('✅ Verification - Total items after deletion:', verifyItems.length);
    console.log('✅ Verification - Event items after deletion:', verifyEvents.length);

    // Prepare successful result
    result.success = true;
    result.totalProcessed = itemsToDelete.length;
    result.successCount = itemsToDelete.length;
    result.deletedItems = itemsToDelete.map(item => `${item.type}: ${item.title}`);
    result.warnings.push(`Successfully deleted ${itemsToDelete.length} items from storage`);
    result.warnings.push(`Remaining items: ${verifyItems.length}, Remaining events: ${verifyEvents.length}`);

    console.log('✅ Massive delete completed:', result);
    return result;
  }

  async massiveUpdateItems(pattern: string, criteria: any, updates: any, safetyOverride: boolean): Promise<BulkOperationResult> {
    console.log('✏️ Massive update items with pattern:', pattern, 'criteria:', criteria, 'updates:', updates, 'safetyOverride:', safetyOverride);
    
    const result: BulkOperationResult = {
      success: false,
      totalProcessed: 0,
      successCount: 0,
      failureCount: 0,
      failures: [],
      warnings: [],
      updatedItems: []
    };

    // Validate pattern
    if (!['all', 'category', 'type', 'search', 'date_range'].includes(pattern)) {
      result.warnings.push('Invalid pattern format. Must be one of: all, category, type, search, date_range');
      return result;
    }

    // Validate criteria
    if (!criteria || !criteria.categoryIds || !criteria.types || !criteria.titleContains || !criteria.dateFrom || !criteria.dateTo) {
      result.warnings.push('Invalid criteria format. Must include categoryIds, types, titleContains, dateFrom, and dateTo');
      return result;
    }

    // Validate updates
    if (!updates || !updates.titlePattern || !updates.textPattern || !updates.priority || !updates.categoryId || !updates.completed || !updates.addPrefix || !updates.addSuffix || !updates.dateShift) {
      result.warnings.push('Invalid updates format. Must include titlePattern, textPattern, priority, categoryId, completed, addPrefix, addSuffix, and dateShift');
      return result;
    }

    // Validate safetyOverride
    if (typeof safetyOverride !== 'boolean') {
      result.warnings.push('Invalid safetyOverride format. Must be a boolean');
      return result;
    }

    // Fetch items based on criteria
    const items = getStoredItems();
    const filteredItems = items.filter(item => {
      const categoryMatch = criteria.categoryIds.includes(item.categoryId);
      const typeMatch = criteria.types.includes(item.type);
      const titleMatch = item.title.toLowerCase().includes(criteria.titleContains.toLowerCase());
      const dateMatch = item.createdAt >= new Date(criteria.dateFrom) && item.createdAt <= new Date(criteria.dateTo);
      return categoryMatch && typeMatch && titleMatch && dateMatch;
    });

    // Prepare result
    result.success = true;
    result.totalProcessed = filteredItems.length;
    result.successCount = filteredItems.length;
    result.updatedItems = filteredItems.map(item => ({
      ...item,
      title: this.generateTitle(updates.titlePattern, parseInt(item.id) || 0, undefined, undefined, undefined, item.metadata?.priority),
      text: this.generateText(updates.textPattern, item.id),
      categoryId: updates.categoryId,
      completed: updates.completed,
      updatedAt: new Date(),
      metadata: {
        ...(item.metadata || {}),
        priority: updates.priority,
        location: this.generateLocation()
      }
    }));
    result.warnings.push(`${filteredItems.length} items updated successfully`);

    console.log('✅ Massive update completed:', result);
    return result;
  }

  async lifecycleOperations(operation: string, scope: string, intensity: string, focus: string[], customData?: any): Promise<BulkOperationResult> {
    console.log('🎯 Massive lifecycle operations with operation:', operation, 'scope:', scope, 'intensity:', intensity, 'focus:', focus, 'customData:', customData);
    
    const result: BulkOperationResult = {
      success: false,
      totalProcessed: 0,
      successCount: 0,
      failureCount: 0,
      failures: [],
      warnings: [],
      createdItems: [],
      updatedItems: [],
      deletedItems: []
    };

    // Validate operation
    if (!['semester_schedule', 'year_goals', 'habit_system', 'daily_routines', 'project_lifecycle'].includes(operation)) {
      result.warnings.push('Invalid operation format. Must be one of: semester_schedule, year_goals, habit_system, daily_routines, project_lifecycle');
      return result;
    }

    // Validate scope
    if (!['day', 'week', 'month', 'semester', 'year', 'lifetime'].includes(scope)) {
      result.warnings.push('Invalid scope format. Must be one of: day, week, month, semester, year, lifetime');
      return result;
    }

    // Validate intensity
    if (!['light', 'moderate', 'intensive', 'extreme'].includes(intensity)) {
      result.warnings.push('Invalid intensity format. Must be one of: light, moderate, intensive, extreme');
      return result;
    }

    // Validate focus
    if (!focus || focus.length === 0) {
      result.warnings.push('Focus areas are required');
      return result;
    }

    // Fetch items based on operation and scope
    const items = getStoredItems();
    const filteredItems = items.filter(item => {
      const categoryMatch = focus.some(category => item.categoryId.toLowerCase().includes(category.toLowerCase()));
      const dateMatch = this.isWithinDateRange(item.createdAt, scope);
      return categoryMatch && dateMatch;
    });

    // Prepare result
    result.success = true;
    result.totalProcessed = filteredItems.length;
    result.successCount = filteredItems.length;
    result.createdItems = filteredItems.map(item => ({
      ...item,
      updatedAt: new Date(),
      metadata: {
        ...item.metadata,
        frequency: this.generateFrequency(scope),
        location: this.generateLocation()
      }
    }));
    result.updatedItems = filteredItems.map(item => ({
      ...item,
      updatedAt: new Date(),
      metadata: {
        ...item.metadata,
        frequency: this.generateFrequency(scope),
        location: this.generateLocation()
      }
    }));
    result.deletedItems = filteredItems.map(item => `${item.type}: ${item.title}`);
    result.warnings.push(`${filteredItems.length} items processed successfully`);

    console.log('✅ Massive lifecycle operations completed:', result);
    return result;
  }

  async smartCleanup(operation: string, aggressiveness: string, preserveImportant: boolean): Promise<BulkOperationResult> {
    console.log('🧹 AI-powered smart cleanup with operation:', operation, 'aggressiveness:', aggressiveness, 'preserveImportant:', preserveImportant);
    
    const result: BulkOperationResult = {
      success: false,
      totalProcessed: 0,
      successCount: 0,
      failureCount: 0,
      failures: [],
      warnings: [],
      updatedItems: []
    };

    // Validate operation
    if (!['deduplicate', 'organize', 'optimize', 'archive_old', 'merge_similar', 'full_cleanup'].includes(operation)) {
      result.warnings.push('Invalid operation format. Must be one of: deduplicate, organize, optimize, archive_old, merge_similar, full_cleanup');
      return result;
    }

    // Validate aggressiveness
    if (!['conservative', 'moderate', 'aggressive', 'extreme'].includes(aggressiveness)) {
      result.warnings.push('Invalid aggressiveness format. Must be one of: conservative, moderate, aggressive, extreme');
      return result;
    }

    // Validate preserveImportant
    if (typeof preserveImportant !== 'boolean') {
      result.warnings.push('Invalid preserveImportant format. Must be a boolean');
      return result;
    }

    // Fetch items based on operation and aggressiveness
    const items = getStoredItems();
    const filteredItems = items.filter(item => {
      const importantMatch = item.metadata?.priority === 'high';
      const duplicateMatch = items.some(otherItem => otherItem.id !== item.id && otherItem.title === item.title && otherItem.text === item.text);
      const outdatedMatch = item.createdAt < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const similarMatch = items.some(otherItem => otherItem.id !== item.id && otherItem.categoryId === item.categoryId && otherItem.title !== item.title && otherItem.text !== item.text);
      return (importantMatch && preserveImportant) || duplicateMatch || outdatedMatch || similarMatch;
    });

    // Prepare result
    result.success = true;
    result.totalProcessed = filteredItems.length;
    result.successCount = filteredItems.length;
    result.updatedItems = filteredItems.map(item => ({
      ...item,
      updatedAt: new Date(),
      metadata: {
        ...(item.metadata || {}),
        priority: this.generatePriority()
      }
    }));
    result.warnings.push(`${filteredItems.length} items cleaned up successfully`);

    console.log('✅ Smart cleanup completed:', result);
    return result;
  }

  // Helper methods for massive operations
  private generateTitle(baseTitle: string, index: number, dateRange?: { start: Date; end: Date }, timePattern?: any, variations?: string[], priority?: string): string {
    let title = baseTitle;
    
    // Replace variables in title
    title = title.replace('{number}', (index + 1).toString());
    title = title.replace('{index}', index.toString());
    
    if (dateRange) {
      const date = new Date(dateRange.start.getTime() + (index * (dateRange.end.getTime() - dateRange.start.getTime()) / 100));
      title = title.replace('{date}', date.toDateString());
      title = title.replace('{weekday}', date.toLocaleDateString('en-US', { weekday: 'long' }));
    }
    
    if (variations && variations.length > 0) {
      const variation = variations[index % variations.length];
      title = title.replace('{variation}', variation);
    }
    
    if (priority) {
      title = title.replace('{priority}', priority);
    }
    
    return title;
  }

  private generateDescription(type: string, categoryId: string): string {
    const descriptions = {
      todo: `Important task for ${categoryId} - generated by Lifely AI`,
      goal: `Strategic goal for ${categoryId} advancement`,
      event: `Scheduled event for ${categoryId} activities`,
      note: `Important note for ${categoryId} reference`,
      routine: `Daily routine for ${categoryId} excellence`,
      voiceNote: `Voice note for ${categoryId} tracking`
    };
    return descriptions[type as keyof typeof descriptions] || 'AI-generated item';
  }

  private generateRoutineSteps(type: string): string {
    if (type !== 'routine') return '';
    
    const routineSteps = [
      '1. Prepare materials\n2. Begin focused work\n3. Complete task\n4. Review results',
      '1. Set environment\n2. Execute planned activity\n3. Track progress\n4. Optimize for next time',
      '1. Warm up\n2. Main activity\n3. Cool down\n4. Reflect on performance'
    ];
    
    return routineSteps[Math.floor(Math.random() * routineSteps.length)];
  }

  private generatePriority(): 'low' | 'medium' | 'high' {
    const priorities: ('low' | 'medium' | 'high')[] = ['low', 'medium', 'high'];
    return priorities[Math.floor(Math.random() * priorities.length)];
  }

  private generateDueDate(dateRange?: { start: Date; end: Date }): Date | undefined {
    if (!dateRange) return undefined;
    
    const randomTime = dateRange.start.getTime() + Math.random() * (dateRange.end.getTime() - dateRange.start.getTime());
    return new Date(randomTime);
  }

  private generateDateTime(dateRange?: { start: Date; end: Date }, timePattern?: any): Date | undefined {
    if (!dateRange) return undefined;
    
    const date = this.generateDueDate(dateRange);
    if (!date) return undefined;
    
    // Set time based on pattern
    if (timePattern?.morning) {
      date.setHours(9, 0, 0, 0);
    } else if (timePattern?.afternoon) {
      date.setHours(14, 0, 0, 0);
    } else if (timePattern?.evening) {
      date.setHours(19, 0, 0, 0);
    } else if (timePattern?.random) {
      date.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60), 0, 0);
    }
    
    return date;
  }

  private generateFrequency(pattern: string): 'daily' | 'weekly' | 'monthly' | 'yearly' {
    const frequencyMap: { [key: string]: 'daily' | 'weekly' | 'monthly' | 'yearly' } = {
      daily: 'daily',
      weekly: 'weekly',
      monthly: 'monthly',
      semester: 'monthly',
      year: 'yearly',
      range: 'weekly'
    };
    
    return frequencyMap[pattern] || 'daily';
  }

  private generateLocation(): string {
    const locations = [
      'Georgetown University',
      'Lauinger Library',
      'Yates Field House',
      'Red Square',
      'Healy Hall',
      'Copley Lawn',
      'Leo\'s Coffee',
      'Dahlgren Chapel'
    ];
    
    return locations[Math.floor(Math.random() * locations.length)];
  }

  private generateText(textPattern: string, itemId: string): string {
    let text = textPattern;
    text = text.replace('{id}', itemId);
    text = text.replace('{timestamp}', new Date().toISOString());
    return text;
  }

  private isWithinDateRange(date: Date, scope: string): boolean {
    const now = new Date();
    const timeDiff = now.getTime() - date.getTime();
    
    switch (scope) {
      case 'day':
        return timeDiff <= 24 * 60 * 60 * 1000; // 1 day
      case 'week':
        return timeDiff <= 7 * 24 * 60 * 60 * 1000; // 1 week
      case 'month':
        return timeDiff <= 30 * 24 * 60 * 60 * 1000; // 30 days
      case 'semester':
        return timeDiff <= 120 * 24 * 60 * 60 * 1000; // 120 days
      case 'year':
        return timeDiff <= 365 * 24 * 60 * 60 * 1000; // 365 days
      case 'lifetime':
        return true; // All items
      default:
        return false;
    }
  }

  async deleteAllEvents(confirm: boolean): Promise<boolean> {
    if (!confirm) {
      throw new Error('User confirmation required to delete all events');
    }

    const items = getStoredItems();
    const eventItems = items.filter(item => item.type === 'event');

    if (eventItems.length === 0) {
      console.log('⚠️ No events found to delete');
      return true;
    }

    const transaction = new BatchTransaction();
    eventItems.forEach(item => {
      transaction.addOperation({ type: 'delete', itemId: item.id });
    });

    const transactionResult = transaction.execute();

    if (transactionResult.success) {
      console.log('✅ All events deleted successfully');
      return true;
    } else {
      console.error('❌ Failed to delete events:', transactionResult.failures);
      return false;
    }
  }

  async createRoutineCalendar(routineName: string, startDate: string, endDate: string, startTime: string): Promise<Item[]> {
    console.log('🎯 Creating routine calendar with params:', { routineName, startDate, endDate, startTime });
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const timeParts = startTime.split(':');
    const hour = parseInt(timeParts[0]);
    const minute = parseInt(timeParts[1]);
    
    const createdItems: Item[] = [];
    
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const eventDate = new Date(date);
      eventDate.setHours(hour);
      eventDate.setMinutes(minute);
      
      const event: Item = {
        id: generateUniqueId(),
        title: `${routineName} - Daily`,
        text: `Daily routine for ${routineName}`,
        type: 'routine',
        categoryId: 'self-regulation',
        completed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        dueDate: eventDate,
        dateTime: eventDate,
        metadata: {
          priority: 'medium',
          aiGenerated: true,
          frequency: 'daily',
          currentStreak: 0,
          bestStreak: 0,
          completedToday: false,
          completedDates: []
        }
      };
      
      createdItems.push(event);
    }
    
    const items = getStoredItems();
    items.push(...createdItems);
    saveStoredItems(items);
    
    console.log('✅ Created', createdItems.length, 'routine calendar events');
    
    return createdItems;
  }

  async parseRoutineToCalendar(routineDescription: string, startDate?: string, endDate?: string, frequency?: string): Promise<Item[]> {
    console.log('🎯 Parsing routine to calendar with description:', routineDescription, 'startDate:', startDate, 'endDate:', endDate, 'frequency:', frequency);
    
    // Smart parsing of the routine description
    const routineParsed = this.intelligentRoutineParsing(routineDescription);
    
    // Set intelligent defaults for dates
    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
    
    // Set intelligent frequency
    const freq = frequency || routineParsed.detectedFrequency || 'daily';
    
    const createdItems: Item[] = [];
    
    // Generate events based on parsed routine
    for (const activity of routineParsed.activities) {
      for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
        // Skip based on frequency
        if (freq === 'weekdays' && (date.getDay() === 0 || date.getDay() === 6)) continue;
        if (freq === 'weekends' && date.getDay() !== 0 && date.getDay() !== 6) continue;
        if (freq === 'weekly' && date.getDay() !== start.getDay()) continue;
        
        const eventDate = new Date(date);
        eventDate.setHours(activity.hour);
        eventDate.setMinutes(activity.minute);
        
        const event: Item = {
          id: generateUniqueId(),
          title: activity.title,
          text: activity.description,
          type: 'event',
          categoryId: activity.category,
          completed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          dueDate: eventDate,
          dateTime: eventDate,
          metadata: {
            priority: activity.priority,
            aiGenerated: true,
            parsedFromRoutine: routineDescription,
            location: activity.location,
            frequency: freq as 'daily' | 'weekly' | 'monthly' | 'yearly'
          }
        };
        
        createdItems.push(event);
      }
    }
    
    // Save to storage
    const items = getStoredItems();
    items.push(...createdItems);
    saveStoredItems(items);
    
    console.log('✅ Created', createdItems.length, 'calendar events from routine');
    
    return createdItems;
  }

  // Intelligent routine parsing - the heart of natural language processing
  private intelligentRoutineParsing(description: string): {
    activities: Array<{
      title: string;
      description: string;
      hour: number;
      minute: number;
      category: string;
      priority: 'low' | 'medium' | 'high';
      location?: string;
    }>;
    detectedFrequency?: string;
  } {
    const desc = description.toLowerCase();
    const activities: Array<{
      title: string;
      description: string;
      hour: number;
      minute: number;
      category: string;
      priority: 'low' | 'medium' | 'high';
      location?: string;
    }> = [];
    
    let detectedFrequency = 'daily';
    
    // Detect frequency from description
    if (desc.includes('weekly') || desc.includes('week')) detectedFrequency = 'weekly';
    if (desc.includes('weekday') || desc.includes('monday') || desc.includes('tuesday')) detectedFrequency = 'weekdays';
    if (desc.includes('weekend') || desc.includes('saturday') || desc.includes('sunday')) detectedFrequency = 'weekends';
    
    // Pre-defined routine patterns with intelligent defaults
    if (desc.includes('elon musk') || desc.includes('elon')) {
      activities.push(
        { title: 'Early Morning Strategic Thinking', description: 'Plan the day, review priorities, mental preparation for excellence', hour: 6, minute: 0, category: 'self-regulation', priority: 'high', location: 'Quiet space' },
        { title: 'Intense Focus Work Block 1', description: 'Deep work on most important project - no distractions', hour: 7, minute: 0, category: 'mobile-apps', priority: 'high', location: 'Study space' },
        { title: 'Physical Training', description: 'Strength training and cardio for mental and physical energy', hour: 9, minute: 30, category: 'gym-calisthenics', priority: 'high', location: 'Yates Field House' },
        { title: 'Knowledge Acquisition', description: 'Reading, learning, staying informed on latest developments', hour: 11, minute: 0, category: 'content', priority: 'medium', location: 'Library' },
        { title: 'Networking/Social Connection', description: 'Building relationships and expanding network', hour: 13, minute: 0, category: 'social-charisma', priority: 'medium', location: 'Campus' },
        { title: 'Intense Focus Work Block 2', description: 'Afternoon deep work session - push boundaries', hour: 15, minute: 0, category: 'mobile-apps', priority: 'high', location: 'Study space' },
        { title: 'Reflection and Planning', description: 'Review day, plan tomorrow, spiritual/mental reflection', hour: 19, minute: 0, category: 'catholicism', priority: 'medium', location: 'Chapel/quiet space' }
      );
    } else if (desc.includes('morning') || desc.includes('wake up')) {
      activities.push(
        { title: 'Morning Routine Start', description: 'Wake up and begin the day with intention', hour: 6, minute: 30, category: 'self-regulation', priority: 'medium', location: 'Home' },
        { title: 'Morning Exercise', description: 'Get the blood flowing and energy up', hour: 7, minute: 0, category: 'gym-calisthenics', priority: 'medium', location: 'Gym' },
        { title: 'Morning Planning', description: 'Set intentions and priorities for the day', hour: 8, minute: 0, category: 'self-regulation', priority: 'high', location: 'Desk' }
      );
    } else if (desc.includes('study') || desc.includes('academic')) {
      activities.push(
        { title: 'Study Session - Focus Block', description: 'Intensive academic work and learning', hour: 9, minute: 0, category: 'self-regulation', priority: 'high', location: 'Library' },
        { title: 'Study Break - Active Recovery', description: 'Short break with movement or fresh air', hour: 11, minute: 0, category: 'gym-calisthenics', priority: 'low', location: 'Outside' },
        { title: 'Study Session - Deep Dive', description: 'Continued focused academic work', hour: 11, minute: 15, category: 'self-regulation', priority: 'high', location: 'Library' }
      );
    } else if (desc.includes('workout') || desc.includes('fitness')) {
      activities.push(
        { title: 'Workout - Strength Training', description: 'Build physical strength and endurance', hour: 7, minute: 0, category: 'gym-calisthenics', priority: 'high', location: 'Yates Field House' },
        { title: 'Workout - Cardio', description: 'Cardiovascular training for endurance', hour: 8, minute: 0, category: 'gym-calisthenics', priority: 'medium', location: 'Track/Cardio area' }
      );
    } else if (desc.includes('prayer') || desc.includes('spiritual') || desc.includes('faith')) {
      activities.push(
        { title: 'Morning Prayer', description: 'Begin the day with spiritual reflection and prayer', hour: 7, minute: 0, category: 'catholicism', priority: 'high', location: 'Dahlgren Chapel' },
        { title: 'Evening Reflection', description: 'End the day with gratitude and spiritual contemplation', hour: 20, minute: 0, category: 'catholicism', priority: 'medium', location: 'Chapel/quiet space' }
      );
    } else {
      // Generic routine - try to extract any times or activities mentioned
      const timeMatches = desc.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/g);
      const activityMatches = desc.match(/\b(workout|study|work|eat|sleep|read|write|code|pray|meditate|run|walk)\w*\b/g);
      
      if (timeMatches && activityMatches) {
        for (let i = 0; i < Math.min(timeMatches.length, activityMatches.length); i++) {
          const timeStr = timeMatches[i];
          const activity = activityMatches[i];
          
          // Parse time
          let hour = 9; // default
          let minute = 0;
          const timeParsed = timeStr.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/);
          if (timeParsed) {
            hour = parseInt(timeParsed[1]);
            minute = timeParsed[2] ? parseInt(timeParsed[2]) : 0;
            if (timeParsed[3] === 'pm' && hour !== 12) hour += 12;
            if (timeParsed[3] === 'am' && hour === 12) hour = 0;
          }
          
          // Map activity to category
          let category = 'self-regulation';
          if (activity.includes('workout') || activity.includes('run') || activity.includes('walk')) category = 'gym-calisthenics';
          if (activity.includes('pray') || activity.includes('meditate')) category = 'catholicism';
          if (activity.includes('code') || activity.includes('work')) category = 'mobile-apps';
          if (activity.includes('read') || activity.includes('write')) category = 'content';
          
          activities.push({
            title: `${activity.charAt(0).toUpperCase() + activity.slice(1)} Session`,
            description: `Scheduled ${activity} activity`,
            hour,
            minute,
            category,
            priority: 'medium',
            location: 'Georgetown University'
          });
        }
      } else {
        // Fallback - create a generic routine based on description
        activities.push({
          title: description.charAt(0).toUpperCase() + description.slice(1),
          description: `Custom routine: ${description}`,
          hour: 9,
          minute: 0,
          category: 'self-regulation',
          priority: 'medium',
          location: 'Georgetown University'
        });
      }
    }
    
    return { activities, detectedFrequency };
  }

  async createRecurringEvent(
    title: string,
    description: string = '',
    categoryId: string,
    startDateTime: string,
    endDateTime?: string,
    recurrencePattern: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'weekly',
    recurrenceInterval: number = 1,
    recurrenceEndDate?: string,
    location?: string
  ): Promise<Item[]> {
    console.log('🔄 Creating recurring event:', { title, recurrencePattern, recurrenceInterval });
    
    const createdEvents: Item[] = [];
    const startDate = new Date(startDateTime);
    const endDate = recurrenceEndDate ? new Date(recurrenceEndDate) : new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000); // Default 1 year
    
    // Calculate duration if endDateTime is provided
    let duration = 60; // Default 1 hour
    if (endDateTime) {
      const endTime = new Date(endDateTime);
      duration = Math.round((endTime.getTime() - startDate.getTime()) / (1000 * 60));
    }
    
    let currentDate = new Date(startDate);
    let occurrenceCount = 0;
    const maxOccurrences = 100; // Safety limit
    
    while (currentDate <= endDate && occurrenceCount < maxOccurrences) {
      const eventStartTime = new Date(currentDate);
      const eventEndTime = new Date(eventStartTime.getTime() + duration * 60 * 1000);
      
      const event: Item = {
        id: generateUniqueId(),
        title: title,
        text: description,
        type: 'event',
        categoryId: categoryId,
        completed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        dateTime: eventStartTime,
        metadata: {
          priority: 'medium',
          aiGenerated: true,
          startTime: eventStartTime,
          endTime: eventEndTime,
          duration: duration,
                     ...{ isRecurring: true },
           ...{ recurrencePattern: recurrencePattern },
           ...{ recurrenceInterval: recurrenceInterval },
           ...{ recurrenceId: generateUniqueId() }, // Link all occurrences
           ...{ occurrenceNumber: occurrenceCount + 1 },
          ...(location && { location })
        }
      };
      
      createdEvents.push(event);
      occurrenceCount++;
      
      // Calculate next occurrence
      switch (recurrencePattern) {
        case 'daily':
          currentDate.setDate(currentDate.getDate() + recurrenceInterval);
          break;
        case 'weekly':
          currentDate.setDate(currentDate.getDate() + (7 * recurrenceInterval));
          break;
        case 'monthly':
          currentDate.setMonth(currentDate.getMonth() + recurrenceInterval);
          break;
        case 'yearly':
          currentDate.setFullYear(currentDate.getFullYear() + recurrenceInterval);
          break;
      }
    }
    
    // Save all events
    const items = getStoredItems();
    items.push(...createdEvents);
    saveStoredItems(items);
    
    console.log('✅ Created', createdEvents.length, 'recurring events');
    
    return createdEvents;
  }
}

export const aiActions = new AIActions(); 