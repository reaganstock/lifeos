import { Item } from '../types';
// Removed categories import - using dynamic categories from context

// Gemini API Configuration
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI SERVICE: REACT_APP_GEMINI_API_KEY environment variable is not set!');
  console.error('❌ Please add your Gemini API key to your .env file:');
  console.error('❌ REACT_APP_GEMINI_API_KEY=your_actual_api_key_here');
}

export interface GeminiResponse {
  success: boolean;
  response: string;
  functionResults?: any[];
  itemsModified?: boolean;
  itemCreated?: any;
  pendingFunctionCall?: any;
  thinkingContent?: string;
}

export class GeminiService {
  private itemsModified: boolean = false;
  private currentItems: Item[] = []; // Store current items from Supabase or localStorage
  private supabaseCallbacks: {
    createItem?: (item: any) => Promise<any>;
    updateItem?: (id: string, item: any) => Promise<any>;
    deleteItem?: (id: string) => Promise<any>;
    bulkCreateItems?: (items: any[]) => Promise<any>;
    refreshData?: () => Promise<void>;
  } = {};

  // Set Supabase callbacks for authenticated users
  setSupabaseCallbacks(callbacks: {
    createItem?: (item: any) => Promise<any>;
    updateItem?: (id: string, item: any) => Promise<any>;
    deleteItem?: (id: string) => Promise<any>;
    bulkCreateItems?: (items: any[]) => Promise<any>;
    refreshData?: () => Promise<void>;
  }): void {
    this.supabaseCallbacks = callbacks;
    console.log('✅ GEMINI SERVICE: Supabase callbacks configured for authenticated user');
  }

  // Clear Supabase callbacks for unauthenticated users
  clearSupabaseCallbacks(): void {
    this.supabaseCallbacks = {};
    console.log('✅ GEMINI SERVICE: Supabase callbacks cleared for unauthenticated user');
  }

  private async makeGeminiRequest(messages: any[], tools?: any[]) {
    // Get current model from global state, fallback to default
    const currentModel = (window as any).getCurrentModel?.() || 'gemini-2.5-flash-preview-05-20';
    
    // Use the selected model if it's a Gemini model, otherwise use default
    const model = currentModel.startsWith('gemini-') ? currentModel : 'gemini-2.5-flash-preview-05-20';
    
    // Convert messages to Gemini format
    const geminiMessages = this.convertToGeminiFormat(messages);
    
    const requestBody: any = {
      contents: geminiMessages,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4000,
        ...(model.includes('thinking') && {
          thinkingConfig: {
            thinkingBudget: 20000 // Enable thinking mode only for thinking models
          }
        })
      }
    };

    // Add tools if provided
    if (tools && tools.length > 0) {
      requestBody.tools = [{
        functionDeclarations: tools
      }];
      console.log('🔧 DEBUG: Added tools to request:', tools.length, 'tools');
      console.log('🔧 DEBUG: Request body with tools:', JSON.stringify(requestBody, null, 2));
    } else {
      console.log('⚠️ DEBUG: NO TOOLS provided to API request!');
    }

    if (!GEMINI_API_KEY) {
      throw new Error('Gemini API key is not configured. Please add REACT_APP_GEMINI_API_KEY to your .env file.');
    }

    const response = await fetch(`${GEMINI_API_URL}/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Gemini API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    return response.json();
  }

  private convertToGeminiFormat(messages: any[]): any[] {
    return messages.map(msg => {
      if (msg.role === 'system') {
        return {
          role: 'user',
          parts: [{ text: `[SYSTEM INSTRUCTIONS] ${msg.content}` }]
        };
      }
      
      return {
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      };
    });
  }

  async processMessage(
    message: string, 
    items: Item[], 
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [],
    categories: any[] = [],
    isAgenticMode: boolean = false
  ): Promise<GeminiResponse> {
    console.log('🚀 GEMINI DIRECT API - Processing:', message);
    
    // Store current items for use by functions
    this.currentItems = items;
    console.log('📊 GEMINI SERVICE: Stored', items.length, 'current items for function access');
    
    this.itemsModified = false;
    
    // Build system prompt with better instructions for conversational responses
    const systemPrompt = this.buildSmartSystemPrompt(items, categories) + `

CONVERSATIONAL RESPONSE GUIDELINES - CRITICAL:
- Keep responses natural and conversational, not robotic
- Don't overwhelm with technical details
- When functions are executed successfully, give brief confirmations like:
  * "Done! I created your workout session for tomorrow."
  * "Perfect! Updated your goal progress to 75%."
  * "Got it! Deleted those 3 completed todos."
- For conflicts, be helpful but concise:
  * "I see you already have a meeting at 2pm. Would you prefer 3pm instead?"
- For errors, be friendly and offer alternatives
- NEVER start responses with "✅ Successfully executed..." - be more natural
- Match the user's energy level and speaking style
- Remember this is a VOICE conversation - keep it flowing and natural`;
    
    // Build messages array
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: message }
    ];
    
    // Use function calling intelligently - not for every message
    const tools = this.getTools(categories);
    console.log('🔧 DEBUG: Tools being sent:', tools.length, 'tools');
    console.log('🔧 DEBUG: First few tools:', tools.slice(0, 3).map(t => t.name));
    
    try {
      const response = await this.makeGeminiRequest(messages, tools);
      console.log('🤖 Gemini Response:', response);
      
      // CRITICAL DEBUG: Check what we actually received
      console.log('🔍 DEBUG: Response structure:', JSON.stringify(response, null, 2));
      console.log('🔍 DEBUG: Candidates:', response.candidates);
      console.log('🔍 DEBUG: Parts:', response.candidates?.[0]?.content?.parts);
      
      // EXTRA DEBUG: Check for function calls more explicitly
      if (response.candidates?.[0]?.content?.parts) {
        response.candidates[0].content.parts.forEach((part: any, index: number) => {
          console.log(`🔍 DEBUG Part ${index}:`, part);
          console.log(`🔍 DEBUG Part ${index} has functionCall:`, !!(part as any).functionCall);
          console.log(`🔍 DEBUG Part ${index} has text:`, !!(part as any).text);
        });
      }
      
      // Handle function calls - EXECUTE IMMEDIATELY like OpenRouter
      const functionResults: any[] = [];
      
      let pendingFunctionCall: any = null;
      
      if (response.candidates?.[0]?.content?.parts) {
        const parts = response.candidates[0].content.parts;
        console.log('🔍 DEBUG: Processing parts:', parts);
        
        for (const part of parts) {
          console.log('🔍 DEBUG: Checking part:', part);
          console.log('🔍 DEBUG: Part has functionCall?', !!(part as any).functionCall);
          if ((part as any).functionCall) {
            const functionCall = (part as any).functionCall;
            console.log('🎯 Found function call:', functionCall.name, '| Agentic mode:', isAgenticMode);
            
            if (isAgenticMode) {
              // Agent mode: Return as pending function call for visual UI
              pendingFunctionCall = {
                name: functionCall.name,
                args: functionCall.args
              };
              console.log('📋 Agent mode: Returning function call as pending for visual approval');
              break; // Only handle the first function call
            } else {
              // Ask mode: Execute immediately like before
              console.log('⚡ Ask mode: Executing function immediately');
              try {
                const result = await this.executeFunction(functionCall.name, functionCall.args);
                functionResults.push({
                  function: functionCall.name,
                  ...result
                });
                console.log('✅ Ask mode: Function executed successfully');
              } catch (error) {
                console.error('❌ Ask mode: Function execution failed:', error);
                functionResults.push({
                  function: functionCall.name,
                  error: error instanceof Error ? error.message : 'Unknown error'
                });
              }
            }
          }
        }
      }
      
      // Get text response and thinking content
      const textPart = response.candidates?.[0]?.content?.parts?.find((part: any) => part.text);
      console.log('🔍 DEBUG: Text part found:', !!textPart);
      console.log('🔍 DEBUG: Pending function call exists:', !!pendingFunctionCall);
      
      let textResponse = textPart?.text || '';
      
      // Only use fallback if no text AND no function call
      if (!textResponse && !pendingFunctionCall) {
        textResponse = 'Unable to complete the requested action.';
        console.log('⚠️ DEBUG: Using fallback text response - no text part and no function call found');
      } else if (!textResponse && pendingFunctionCall) {
        textResponse = `I'll handle that for you now.`;
        console.log('✅ DEBUG: Using function prep text response');
      } else if (textResponse) {
        console.log('✅ DEBUG: Using actual AI text response');
      }
      
      console.log('🔍 DEBUG: Final text response:', textResponse);
      
      // Extract thinking content if available (for thinking models)
      const thinkingContent = response.candidates?.[0]?.content?.parts
        ?.find((part: any) => part.thought)?.thought;
      
      // If functions were executed, let AI respond conversationally about the results
      if (functionResults.length > 0) {
        const successfulResults = functionResults.filter(r => !r.error);
        
        if (successfulResults.length > 0) {
          // Create detailed context for the AI to respond intelligently
          const detailedContext = successfulResults.map(r => {
            const funcName = r.function || 'unknown';
            const items = r.result?.items || [];
            const createdCount = r.result?.created || items.length;
            
            // Provide specific details about what was actually done
            if (funcName === 'createItem' && items.length > 0) {
              const item = items[0];
              return `Created ${item.type}: "${item.title}" in ${item.categoryId} category${item.dateTime ? ' for ' + new Date(item.dateTime).toLocaleDateString() : ''}`;
            } else if (funcName === 'bulkCreateItems' && items.length > 0) {
              const itemsByType = items.reduce((acc: any, item: any) => {
                acc[item.type] = (acc[item.type] || 0) + 1;
                return acc;
              }, {});
              const breakdown = Object.entries(itemsByType).map(([type, count]) => `${count} ${type}${count === 1 ? '' : 's'}`).join(', ');
              const itemCategories = Array.from(new Set(items.map((item: any) => item.categoryId)));
              return `Created ${createdCount} items: ${breakdown} across ${itemCategories.length} categories (${itemCategories.join(', ')})`;
            } else if (funcName === 'updateItem' && items.length > 0) {
              const item = items[0];
              return `Updated ${item.type}: "${item.title}"`;
            } else if (funcName === 'deleteItem' && r.result?.item) {
              const item = r.result.item;
              return `Deleted ${item.type}: "${item.title}"`;
            }
            return r.result?.message || 'Action completed successfully';
          }).join('\n- ');
          
          console.log('🔄 Detailed context for intelligent response:', detailedContext);
          
          // Include system context and original message for intelligent response
          const followUpMessages = [
            { 
              role: 'system', 
              content: `You are an AI assistant that just completed actions for a user. Respond naturally and conversationally about what was accomplished. Be specific about what was created and where it was placed. Don't be robotic - be friendly and helpful.` 
            },
            { 
              role: 'user', 
              content: `Original request: "${message}"\n\nActions completed:\n- ${detailedContext}\n\nPlease provide a natural, conversational response about what was accomplished. Be specific about what was created, how many items, and where they were placed. Reference the original request to show you understand what was asked for.` 
            }
          ];
          
          console.log('📤 Making follow-up call to get natural response...');
          
          // Get AI's natural conversational response about what it did
          try {
            const followUpResponse = await this.makeGeminiRequest(followUpMessages);
            const naturalResponse = followUpResponse.candidates?.[0]?.content?.parts
              ?.find((part: any) => part.text)?.text || 'Done! I took care of that for you.';
            
            console.log('🎯 Natural response:', naturalResponse);
            
            return {
              success: true,
              response: naturalResponse,
              functionResults,
              itemsModified: this.itemsModified,
              thinkingContent
            };
          } catch (error) {
            console.error('❌ Follow-up response error:', error);
            // Create intelligent fallback based on actual function results
            let intelligentFallback = '';
            
            if (successfulResults.length === 1) {
              const result = successfulResults[0];
              const funcName = result.function;
              const items = result.result?.items || [];
              
              if (funcName === 'createItem' && items.length > 0) {
                const item = items[0];
                intelligentFallback = `Perfect! I created "${item.title}" as a ${item.type} in your ${item.categoryId} category.`;
              } else if (funcName === 'bulkCreateItems' && items.length > 0) {
                const count = result.result?.created || items.length;
                intelligentFallback = `Great! I created ${count} new items for you. They're organized across your categories and ready to use.`;
              } else {
                intelligentFallback = 'Done! I took care of that for you.';
              }
            } else {
              const totalItems = successfulResults.reduce((sum, r) => sum + (r.result?.created || r.result?.items?.length || 1), 0);
              intelligentFallback = `Perfect! I completed ${successfulResults.length} actions and created ${totalItems} items for you.`;
            }
            
            return {
              success: true,
              response: intelligentFallback,
              functionResults,
              itemsModified: this.itemsModified,
              pendingFunctionCall: pendingFunctionCall,
              thinkingContent
            };
          }
        } else {
          return {
            success: true,
            response: textResponse,
            functionResults,
            itemsModified: this.itemsModified,
            pendingFunctionCall: pendingFunctionCall,
            thinkingContent
          };
        }
      }
      
      return {
        success: true,
        response: textResponse,
        itemsModified: false,
        pendingFunctionCall: pendingFunctionCall, // This was missing!
        thinkingContent
      };
      
    } catch (error) {
      console.error('❌ Gemini API Error:', error);
      throw error;
    }
  }

  private buildSmartSystemPrompt(items: Item[], categories: any[] = []): string {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const nextWeekStr = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    // Get existing events for conflict detection
    const existingEvents = items.filter(item => item.type === 'event');
    const upcomingEvents = existingEvents.filter(event => 
      event.dateTime && new Date(event.dateTime) >= today
    ).slice(0, 10); // Show next 10 events for context

    // Use actual categories from Supabase if available, otherwise fall back to item categories
    const availableCategories = categories.length > 0 
      ? categories.map(cat => ({ id: cat.id, name: cat.name }))
      : Array.from(new Set(items.map(item => item.categoryId)))
          .filter(categoryId => categoryId)
          .map(categoryId => ({ id: categoryId, name: categoryId }));

    console.log('📂 GEMINI SERVICE: Available categories for context:', availableCategories);

    return `You are an AI assistant for lifeOS, a comprehensive life management system. 

🎯 MANDATORY FUNCTION CALLING RULES:
1. You MUST call functions for ALL action requests - NO EXCEPTIONS
2. For creation requests → CALL createItem or bulkCreateItems functions
3. For update requests → CALL updateItem function  
4. For deletion requests → CALL bulkDeleteItems function (for clearing dashboard) or deleteItem (for single items)
5. DO NOT just talk about actions - EXECUTE them with function calls
6. EVERY action request REQUIRES a function call
7. "Delete everything" or "clear dashboard" → CALL bulkDeleteItems function to delete ALL item types at once
8. "Clear my dashboard" → Use bulkDeleteItems with {"deleteAll": true} to remove everything
9. When user says "delete everything" you MUST delete ALL items using bulkDeleteItems, not create new ones
10. Talking without function calls for action requests is FORBIDDEN

🗑️ DELETION STRATEGY:
- Single item deletion: "delete my workout routine" → deleteItem function
- Mass deletion: "clear dashboard", "delete everything", "delete these", "can you delete these" → bulkDeleteItems function
- Dashboard clearing: Use bulkDeleteItems to remove todos, goals, events, notes, and routines all at once
- Context-aware deletion: When user says "delete these" or "can you delete these" after discussing dashboard contents, delete ALL mentioned item types

🧠 SMART CONTEXT AWARENESS FOR DELETIONS:
- If conversation recently mentioned "notes and events" and user says "delete these" → Use bulkDeleteItems to delete ALL items, not just one type
- Pay attention to previous messages in conversation - if user asked about dashboard contents, "delete these" means delete everything mentioned
- "can you delete these?" = comprehensive deletion of all dashboard items
- "delete these for me" = comprehensive deletion of all dashboard items

🤖 AGENT MODE - INTELLIGENT AUTONOMOUS EXECUTION:

Agent mode is INTELLIGENT and AUTONOMOUS - it continues working until the user's goal is completely achieved.

CORE PRINCIPLES:
1. Recognize MAJOR LIFE EVENTS that require comprehensive planning
2. For major events, create EXTENSIVE lists (50+ items minimum)
3. Continue working until the goal is fully achieved
4. Be PROACTIVE and COMPREHENSIVE, not conservative

MAJOR LIFE EVENTS REQUIRING EXTENSIVE PLANNING:
- Moving to another country (like China) → 50+ items minimum
- Getting married → 30+ items minimum  
- Starting a business → 40+ items minimum
- Having a baby → 35+ items minimum
- Career change → 25+ items minimum
- Buying a house → 30+ items minimum
- Going to university → 25+ items minimum

MAJOR LIFE EVENT RESPONSE PATTERN:
When user mentions moving to China or similar major events:
1. Recognize this is a MASSIVE undertaking
2. Create comprehensive goals across ALL life areas
3. Include: language learning, visa/legal, housing, cultural adaptation, financial planning, professional setup, social networking, healthcare, transportation, communication setup, etc.
4. Create 50+ detailed items across multiple categories
5. Be THOROUGH and PROACTIVE

EXAMPLE FOR MOVING TO CHINA:
"Moving to China is a major life change requiring comprehensive planning. I'll create a complete system with 50+ goals, todos, and notes covering every aspect: language learning, visa requirements, housing, cultural adaptation, financial setup, professional networking, healthcare, transportation, and much more."

CRITICAL: 
- For major life events, CREATE MANY ITEMS (50+)
- Be comprehensive, not conservative
- Continue until the user's complex goal is fully addressed
- Agent mode WORKS AUTONOMOUSLY until goal achieved

EXAMPLES:
- "create a goal" → CALL createItem function
- "what are my goals?" → ANSWER from context below
- "how many todos do I have?" → ANSWER from context below
- "update my workout routine" → CALL updateItem function

CURRENT DATE/TIME CONTEXT - CRITICAL:
Today is: ${today.toLocaleDateString()} (${today.toISOString().split('T')[0]})
Current time: ${today.toLocaleString()}
When user says "today" or "TODAY", use: ${todayStr}
When user says "tomorrow", use: ${new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]}

CRITICAL CONFLICT DETECTION:
Before creating ANY appointment or event, you MUST check for existing events at the same time/date.
Current upcoming events:
${upcomingEvents.map(event => `- ${event.title} on ${event.dateTime ? new Date(event.dateTime).toLocaleDateString() : 'unknown date'} at ${event.dateTime ? new Date(event.dateTime).toLocaleTimeString() : 'unknown time'}`).join('\n')}

If user requests an appointment that conflicts with existing events, you MUST:
1. Alert them about the conflict
2. Suggest alternative times
3. Ask for confirmation before creating

ENHANCED ALL-DAY EVENT DETECTION:
Detect all-day events from these patterns:
- "all day" or "all-day" in title/description
- "conference" without specific time
- "festival", "fair", "retreat" 
- Events that span entire days by nature
- When user says "schedule for the whole day"

For all-day events:
- Set dateTime to start of day (00:00:00)
- Set startTime to 00:00:00
- Set endTime to 23:59:59
- Add metadata: { isAllDay: true }

🔒 AVAILABLE CATEGORIES - MANDATORY USE ONLY THESE:
${availableCategories.map(cat => `"${cat.id}" (${cat.name})`).join(', ')}

🛡️ CATEGORY VALIDATION RULES - CRITICAL:
1. EVERY item MUST have a valid categoryId from the list above
2. NEVER create items without categoryId - this will cause database errors
3. NEVER use categoryId that doesn't exist in the available categories
4. If unsure about category mapping, ALWAYS use: "${availableCategories.length > 0 ? availableCategories[0].id : 'self-regulation'}"

🎯 SMART CATEGORY MAPPING:
- Work/Business → "${availableCategories.find(c => c.id.includes('mobile-apps') || c.id.includes('content'))?.id || availableCategories[0]?.id || 'self-regulation'}"
- Fitness/Health → "${availableCategories.find(c => c.id.includes('gym') || c.id.includes('calisthenics'))?.id || availableCategories[0]?.id || 'self-regulation'}"
- Personal/Life → "${availableCategories.find(c => c.id.includes('self-regulation'))?.id || availableCategories[0]?.id || 'self-regulation'}"
- Social/Dating → "${availableCategories.find(c => c.id.includes('social') || c.id.includes('charisma'))?.id || availableCategories[0]?.id || 'self-regulation'}"
- Spiritual/Religion → "${availableCategories.find(c => c.id.includes('catholicism'))?.id || availableCategories[0]?.id || 'self-regulation'}"

⚠️ CATEGORY SAFETY PROTOCOL:
- BEFORE every function call, double-check categoryId exists in available list
- If ANY doubt about category, use fallback: "${availableCategories.length > 0 ? availableCategories[0].id : 'self-regulation'}"
- NEVER leave categoryId empty or undefined
- This prevents "foreign key constraint" database errors

ENHANCED DATE/TIME PARSING:
Current date: ${todayStr}
- "20th" → ${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-20
- "tomorrow" → ${new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
- "next week" → ${nextWeekStr} (same day of week)
- "next Tuesday" → Calculate actual next Tuesday date

TIME PARSING RULES:
- "10am" or "10:00" → "10:00:00"
- "2pm" or "2:00 PM" → "14:00:00" 
- "7:00" → "07:00:00" (morning unless context suggests evening)
- "all day" → Use dateTime with 00:00:00, set isAllDay: true
- "9 to 11" or "9-11" → startTime: "09:00:00", endTime: "11:00:00"
- "from 2pm to 4pm" → startTime: "14:00:00", endTime: "16:00:00"

SMART EVENT DEFAULTS:
- If no endTime specified and specific time given → Add appropriate duration
- Default appointment duration: 30 minutes
- Default meeting duration: 1 hour
- Default social event duration: 2 hours
- Default workout duration: 1 hour

CATEGORY INTELLIGENCE:
- Doctor/dentist/medical → "self-regulation"
- Workout/gym/exercise → "gym-calisthenics" 
- Meeting/work/client → "mobile-apps" (if dev context) or "content"
- Church/mass/prayer → "catholicism"
- Party/dinner/social → "social-charisma"
- Default fallback → "self-regulation"

ISO FORMAT EXAMPLES:
- June 20th at 2pm → dateTime: "${today.getFullYear()}-06-20T14:00:00", startTime: "${today.getFullYear()}-06-20T14:00:00", endTime: "${today.getFullYear()}-06-20T15:00:00"
- All day June 20th → dateTime: "${today.getFullYear()}-06-20T00:00:00", isAllDay: true, startTime: "${today.getFullYear()}-06-20T00:00:00", endTime: "${today.getFullYear()}-06-20T23:59:59"
- Tomorrow at 10am → dateTime: "${new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]}T10:00:00"

RESCHEDULING LOGIC - CRITICAL:
- "reschedule to next week" → Find event, update dateTime to same day next week (${nextWeekStr})
- "move to 4pm" → Keep same date, change time to 16:00:00
- "reschedule appointment to the 24th" → Change date to ${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-24, keep same time
- "reschedule to June 24th" → Use ${today.getFullYear()}-06-24 with original time
- USER SAYS "for the 20th" → ALWAYS use ${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-20
- USER SAYS "20th" → ALWAYS use ${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-20

RECURRING EVENTS - CRITICAL:
For recurring events like "weekly team meeting every Monday":
- Set isRecurring: true
- Set recurrencePattern: "weekly" 
- Set recurrenceInterval: 1
- Set recurrenceEndDate if specified
- Create initial event, system will handle recurrence

EXAMPLES:
- "Create doctor appointment for the 20th at 10am" → CHECK FOR CONFLICTS FIRST, then createItem with type: "event", dateTime: "${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-20T10:00:00"
- "doctor appointment next Tuesday 10am" → createItem with type: "event", dateTime: "CALCULATE_NEXT_TUESDAY_10AM"
- "lunch with John from 12 to 1" → createItem with startTime: "TODAY_12PM", endTime: "TODAY_13PM"
- "weekly team meeting every Monday 9am" → createItem with isRecurring: true, recurrencePattern: "weekly"
- "conference call in Conference Room A" → createItem with location: "Conference Room A"
- "Zoom meeting" → createItem with location: "Zoom"
- "all day conference tomorrow" → createItem with dateTime: "${new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]}T00:00:00", isAllDay: true
- "birthday party at 123 Main St" → createItem with location: "123 Main St"

ADVANCED OPERATIONS - CRITICAL:
- "Copy Steph Curry's routine" → copyRoutineFromPerson with personName: "Steph Curry"
- "Fill my calendar for next week" → generateFullDaySchedule with date range
- "Schedule learning from my notes for 45 days" → createCalendarFromNotes
- "Push all events back 1 week" → bulkRescheduleEvents with timeShift: "+1 week"
- "Change category to dating" → updateItem with newCategoryId: "social-charisma" (map to closest existing category!)

MULTIPLE DATE SCHEDULING - CRITICAL:
- "Schedule gym sessions for Monday, Wednesday, Friday" → createMultipleDateEvents with dates: ["2024-06-10", "2024-06-12", "2024-06-14"]
- "Book meetings for next week" → createMultipleDateEvents with multiple date strings
- "Create workout events for the whole week" → createMultipleDateEvents with 7 consecutive dates

RECURRING MULTIPLE DAYS - CRITICAL:
- "Schedule team meetings every Tuesday and Thursday at 3 PM for the next month" → createRecurringMultipleDays with daysOfWeek: ["tuesday", "thursday"], time: "15:00"
- "Weekly standup every Monday and Wednesday at 9 AM" → createRecurringMultipleDays with daysOfWeek: ["monday", "wednesday"], time: "09:00"
- "Gym sessions every Monday, Wednesday, Friday at 6 AM" → createRecurringMultipleDays with daysOfWeek: ["monday", "wednesday", "friday"], time: "06:00"

RECURRING EVENT DELETION - CRITICAL:
- When deleting recurring events, ALWAYS use deleteRecurringEvent instead of deleteItem
- This will ask user if they want to delete just one occurrence or all occurrences
- "Delete my daily workout" → deleteRecurringEvent with eventId: "daily workout"
- "Remove recurring meeting" → deleteRecurringEvent with eventId: "recurring meeting"

INTELLIGENT RESCHEDULING - CRITICAL:
The intelligentReschedule function MOVES existing events to new times, it does NOT create duplicates.
- "Cancel my workout and reschedule intelligently" → intelligentReschedule with canceledEventId: "workout"
- "I missed my morning workout, reschedule it" → intelligentReschedule with canceledEventId: "morning workout"  
- "Cancel meeting and shift other work events" → intelligentReschedule with canceledEventId: "meeting"
- This function finds the existing event, removes it, and creates an updated version at a new time
- The result is ONE event moved to a better time, NOT two events

FUZZY EVENT MATCHING - CRITICAL:
When user refers to events by description, use fuzzy matching:
- "morning workout" → Find events with "workout" in title scheduled in morning (5-12 AM)
- "afternoon meeting" → Find events with "meeting" in title scheduled in afternoon (12-17 PM)
- "evening dinner" → Find events with "dinner" in title scheduled in evening (17-23 PM)
- "my workout" → Find events in gym-calisthenics category with workout-related terms
- "team meeting" → Find events with "team" and "meeting" in title
- "doctor appointment" → Find events with "doctor" or "appointment" in title

CONFLICT RESOLUTION - CRITICAL:
When conflicts are detected:
1. If user says "create anyway", "override", "double-book" → Use createItemWithConflictOverride
2. If user chooses option 3 from conflict dialog → Use createItemWithConflictOverride
3. If user says "Create anyway (double-booked)" → Use createItemWithConflictOverride
4. NEVER get stuck in conflict resolution loops - always provide clear next steps

RESCHEDULING OPERATIONS - CRITICAL:
- "move my 3pm meeting to 4pm" → updateItem with startTime: "SAME_DATE_16:00:00"
- "reschedule dentist to next week" → updateItem with dateTime: "NEXT_WEEK_SAME_DAY_SAME_TIME"
- "reschedule appointment to the 24th" → updateItem with dateTime: "${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-24T[KEEP_ORIGINAL_TIME]"

INTELLIGENT TEXT EDITING - CRITICAL:
Be SMART about editing vs. rewriting. Choose the right approach:

1. SMALL EDITS (use replaceText):
- "change X to Y" → updateItem with replaceText: "X|Y"
- "fix the spacing" → updateItem with replaceText: "bad spacing|good spacing"
- "edit this word" → updateItem with replaceText: "oldword|newword"
- "remove duplicates" → updateItem with replaceText: "duplicate text|"

2. FORMATTING FIXES (use replaceText for specific issues):
- "fix the line breaks" → updateItem with replaceText: "text without breaks|text\nwith\nproper\nbreaks"
- "add bullet points" → updateItem with replaceText: "item1 item2|• item1\n• item2"
- "remove extra spaces" → updateItem with replaceText: "text  with   spaces|text with spaces"

3. CONTENT ADDITIONS (use appendText or prependText):
- "add this to the end" → updateItem with appendText: "new content"
- "add this to the beginning" → updateItem with prependText: "new content"

4. COMPLETE REWRITES (use text - ONLY when user asks for complete rewrite):
- "rewrite this note" → updateItem with text: "completely new content"
- "start over" → updateItem with text: "new content"

FORMATTING PRESERVATION:
- KEEP bullet points (-), numbered lists, line breaks
- KEEP proper spacing and structure
- ONLY remove excessive formatting (*****, ###, ---)
- When fixing formatting, use replaceText to target specific issues

INTELLIGENCE RULES:
- If user says "fix spacing" → updateItem with fixFormatting: true
- If user says "clean up" → updateItem with fixFormatting: true  
- If user says "organize this" → updateItem with fixFormatting: true
- If user says "remove duplicates" → updateItem with fixFormatting: true
- If user says "fix formatting" → updateItem with fixFormatting: true
- For specific word changes → use replaceText: "old|new"
- For adding content → use appendText or prependText
- NEVER completely rewrite unless explicitly asked

CRITICAL BULK OPERATIONS GUIDANCE:
- "all my daily routines" → Use type: "routine", filterByFrequency: "daily" (NOT frequency: "daily")
- "all weekly routines" → Use type: "routine", filterByFrequency: "weekly" (NOT frequency: "weekly")
- "all monthly routines" → Use type: "routine", filterByFrequency: "monthly" (NOT frequency: "monthly")
- "all my gym routines" → Use type: "routine", categoryId: "gym-calisthenics"

NEVER CONFUSE FILTERING WITH UPDATING:
- filterByFrequency = find existing routines with that frequency
- frequency = change routine frequency to that value

MULTI-STEP OPERATIONS - CRITICAL:
When user says "Create X and [do action]", you MUST make TWO separate function calls:

STEP 1: createItem with basic creation parameters (title, type, categoryId, frequency, duration, text)
STEP 2: updateItem with the created item's title and the action parameters

MULTIPLE DIFFERENT OPERATIONS - CRITICAL:
When user asks to apply DIFFERENT changes to multiple items, you MUST make SEPARATE updateItem calls:

- "Change note A to title X and note B to title Y" → TWO separate updateItem calls
- "Move one note to social-charisma and another to content" → TWO separate updateItem calls  
- "Edit each note to have different titles and categories" → SEPARATE updateItem call for EACH note

NEVER use bulkUpdateItems when items need DIFFERENT changes - only use it when applying SAME change to multiple items!

EXAMPLES:
- "Create a workout routine for 30 minutes daily and mark it complete for today"
  → Step 1: createItem(type: "routine", title: "Workout Routine", frequency: "daily", duration: 30, categoryId: "gym-calisthenics")  
  → Step 2: updateItem(itemId: "Workout Routine", completedToday: true)

- "Change note A to 'Where's Waldo' in social-charisma and note B to 'Where's Waldo' in content"
  → Step 1: updateItem(itemId: "note A", title: "Where's Waldo", text: "Where's Waldo...", newCategoryId: "social-charisma")
  → Step 2: updateItem(itemId: "note B", title: "Where's Waldo", text: "Where's Waldo...", newCategoryId: "content")

NEVER try to include completion status in createItem - ALWAYS use updateItem for the second action!

CONVERSATIONAL RESPONSES: You WILL receive detailed results showing exactly what was changed.
- You HAVE ACCESS to the specific item names that were modified
- You CAN and SHOULD tell the user which items were changed
- Share counts, warnings, and specific details
- Be conversational and helpful, not robotic
- For note updates: Mention what specific content was changed
- For category moves: Confirm "Moved [Note Title] from [old category] to [new category]"
- For content updates: Summarize what was added/changed
- Example: "I moved 2 items to self-regulation: Pack fishing gear and Go fishing at the lake. Both are now in the right category!"
- Example: "Updated your workout note with new exercises including push-ups, pull-ups, and planks"
- NEVER just say "huh?" or give unclear responses

SMART ITEM FINDING - NEVER ask for exact titles, always try to find items:
- "Change workout session to new name" → updateItem with itemId: "workout session", title: "new name"
- "Mark planche training complete" → updateItem with itemId: "planche training", completed: true
- "Delete workout session 1" → deleteItem with itemId: "workout session 1"
- "Delete my last note" → bulkDeleteItems with count: 1, type: "note", selection: "newest"
- "Delete the most recent todo" → bulkDeleteItems with count: 1, type: "todo", selection: "newest"
- "Set my React goal deadline to end of July" → updateItem with itemId: "React", dueDate: END OF JULY from above
- "Update my React goal progress" → updateItem with itemId: "React", progress: 90
- "Change all fishing todos to high priority" → bulkUpdateItems with searchTerm: "fishing", priority: "high"

EXACT ID HANDLING - When user provides specific IDs:
- "add workout tips to 1749880804964_tv8aza7z4" → updateItem with itemId: "1749880804964_tv8aza7z4", appendText: "workout tips content"
- "update 1749880804964_tv8aza7z4 with new info" → updateItem with itemId: "1749880804964_tv8aza7z4", appendText: "new info"
- "delete 1749880804964_tv8aza7z4" → deleteItem with itemId: "1749880804964_tv8aza7z4"
- ALWAYS use the exact ID provided by the user, don't question what it refers to unless there's a clear mismatch

SMART NOTE EDITING - PRESERVE existing content, don't rewrite everything:
- "Add workout tips to my fitness note" → updateItem with itemId: "fitness", appendText: "\\n\\nWorkout Tips:\\n- Stay hydrated\\n- Proper form is key"
- "Update my recipe note with cooking time" → updateItem with itemId: "recipe", appendText: "\\n\\nCooking Time: 45 minutes"
- "Add thoughts to depression note" → updateItem with itemId: "depression", appendText: "\\n\\nNew thoughts: [content]"
- "Put update at top of project note" → updateItem with itemId: "project", prependText: "UPDATE: [content]\\n\\n"
- Only use 'text' parameter for COMPLETE rewrites when user explicitly asks to "rewrite" or "replace all content"

NOTES CONTENT RULES - ABSOLUTELY CRITICAL:
- ALWAYS create notes with meaningful, detailed text content
- NEVER EVER use asterisks (*), bullet points (•), or ANY markdown formatting in note text
- NO symbols: No *, •, **, ##, ---, or any formatting symbols
- Use PLAIN TEXT ONLY with line breaks for organization
- When updating notes, provide complete, well-written content WITHOUT any symbols
- For "workout plan note" → Include actual exercises, sets, reps in plain text
- For "cooking recipe note" → Include ingredients, instructions, tips in plain text
- For "programming study note" → Include concepts, examples, resources in plain text
- Make note content genuinely useful, not placeholder text
- VIOLATION OF THIS RULE = CRITICAL ERROR

CONSOLIDATION FUNCTIONALITY:
When user asks to "consolidate", "merge", or "combine" duplicate items:
1. Use searchItems to find and read all the items to be merged
2. Analyze their content and combine intelligently, removing duplicates
3. Create ONE new comprehensive item with all the combined content
4. Delete the old duplicate items using bulkDeleteItems
5. Confirm what was consolidated and how many duplicates were removed

Example: "consolidate my workout notes" → 
Step 1: searchItems with query: "workout", type: "note"
Step 2: createItem with combined content from all found notes
Step 3: bulkDeleteItems to remove the old duplicate notes
Step 4: Confirm "Consolidated 4 workout notes into 1 comprehensive note"

MULTIPLE DIFFERENT UPDATES - USE executeMultipleUpdates:
When user wants DIFFERENT changes to multiple items, use executeMultipleUpdates instead of separate calls:

"Edit each note to change their title and beginning content to where's waldo and one category should be social-charisma and the other content" → 
executeMultipleUpdates with updatesJson: [
  {"itemId": "first note", "title": "Where's Waldo - Social", "text": "Where's Waldo content...", "newCategoryId": "social-charisma"},
  {"itemId": "second note", "title": "Where's Waldo - Content", "text": "Where's Waldo content...", "newCategoryId": "content"}
]

EXAMPLES:
"Create 3 workout todos for this week" → Call bulkCreateItems with 3 specific workout tasks
"Create a morning routine" → Call createItem with type: "routine", title: "Morning Routine", text: "Wake up at 5 AM\nBrush teeth\nGet dressed\nMake coffee", frequency: "daily", duration: 30
"Create a workout plan note" → Call createItem with type: "note", title: "Workout Plan", text: "MONDAY Upper Body\nPush-ups 3 sets of 12 reps\nPull-ups 3 sets of 8 reps\nDips 3 sets of 10 reps\nPlank 3 sets of 30 seconds\nRest 60 seconds between sets\n\nWEDNESDAY Lower Body\nSquats 3 sets of 15 reps\nLunges 3 sets of 12 reps each leg\nCalf raises 3 sets of 20 reps\nWall sit 3 sets of 45 seconds\n\nFRIDAY Full Body\nBurpees 3 sets of 8 reps\nMountain climbers 3 sets of 20 reps\nJumping jacks 3 sets of 30 reps\n\nRemember to warm up before and cool down after each session", categoryId: "gym-calisthenics"
"Create a cooking recipe note" → Call createItem with type: "note", title: "Healthy Recipes", text: "Breakfast Smoothie Bowl:\n1 frozen banana\n1/2 cup mixed berries\n1/4 cup rolled oats\n1 tbsp honey\n1/2 cup almond milk\nBlend until smooth, top with granola and fresh berries\n\nQuinoa Power Salad:\n1 cup cooked quinoa\n1 diced cucumber\n1 cup cherry tomatoes\n1/4 cup red onion\n2 tbsp olive oil\n1 tbsp lemon juice\nSalt and pepper to taste\nMix all ingredients, chill for 30 minutes", categoryId: "self-regulation"
"Update my workout note with new exercises" → Call updateItem with itemId: "workout", text: "COMPLETE new workout content in plain text without any asterisks or symbols"
"Change workout session to new name" → Call updateItem with itemId: "workout session", title: "new name"
"Mark Planche training as complete" → Call updateItem with itemId: "planche training", completed: true
"Mark all my daily routines as complete" → Call bulkUpdateItems with type: "routine", completedToday: true, searchTerm: "daily"
"Change my workout routine to 45 minutes" → Call updateItem with itemId: "workout routine", duration: 45
"Delete workout session 1 todo" → Call deleteItem with itemId: "workout session 1"
"Delete 5 random todos" → Call bulkDeleteItems with count: 5, type: "todo", selection: "random"
"Mark 3 todos complete" → Call bulkUpdateItems with count: 3, type: "todo", completed: true, selection: "random" → Then tell user which 3 todos were marked complete
"Delete all completed todos" → Call bulkDeleteItems with count: 999, type: "todo", selection: "complete"
"Set overdue todos to high priority" → Call bulkUpdateItems with count: 10, type: "todo", priority: "high", selection: "overdue"
"Change due date of 3 oldest todos to tomorrow" → Call bulkUpdateItems with count: 3, type: "todo", dueDate: "2024-01-15", selection: "oldest"
"Mark 2 random goals as 50% complete" → Call bulkUpdateItems with count: 2, type: "goal", progress: 50, selection: "random"
"Set half my goals to 75% progress" → Call bulkUpdateItems with quantityType: "half", type: "goal", progress: 75, selection: "random"
"Delete all completed goals" → Call bulkDeleteItems with quantityType: "all", type: "goal", selection: "complete"
"Set my React goal deadline to end of July" → Call updateItem with itemId: "React", dueDate: END OF JULY from above
"Update my React goal progress to 90% and set deadline to end of July" → Call updateItem with itemId: "React", progress: 90, dueDate: END OF JULY from above
"Change all fishing todos to social-charisma" → Call bulkUpdateItems with count: 20, type: "todo", searchTerm: "fishing", newCategoryId: "social-charisma"
"Delete all workout items" → Call bulkDeleteItems with count: 50, type: "todo", searchTerm: "workout"
"Update my React goal to 75%" → Call updateItem with itemId: "React", progress: 75
"Find all my programming goals" → Call searchItems with query: "programming", type: "goal"
"Find all my app goals and tell me about them" → Call searchItems with query: "app", type: "goal"
"Find all my gym/calisthenics todos" → Call searchItems with categoryId: "gym-calisthenics", type: "todo"
"Find all my mobile app todos" → Call searchItems with categoryId: "mobile-apps", type: "todo"
"Find all my content goals" → Call searchItems with categoryId: "content", type: "goal"
"Find all goals with progress over 50%" → Call searchItems with type: "goal", minProgress: 50
"Show me all incomplete goals" → Call searchItems with type: "goal", completed: false
"Find all completed todos" → Call searchItems with type: "todo", completed: true
"Show me all my daily routines" → Call searchItems with type: "routine", query: "daily"
"Find all my gym routines" → Call searchItems with type: "routine", categoryId: "gym-calisthenics"
"Move my React goal to mobile-apps category" → Call updateItem with itemId: "React", newCategoryId: "mobile-apps"
"Change all my routines to weekly" → Call bulkUpdateItems with type: "routine", frequency: "weekly", quantityType: "all"
"Mark all my daily routines as complete" → Call bulkUpdateItems with type: "routine", completedToday: true, searchTerm: "daily"
"Set my React goal deadline to end of next month" → Call updateItem with itemId: "React", dueDate: END OF NEXT MONTH from above
"Update my morning routine steps" → Call updateItem with itemId: "morning routine", text: "Wake up at 5 AM\nDrink water\nBrush teeth\nExercise\nMeditate"

Remember: Execute actions immediately via function calls. Be intelligent, specific, and date-aware!

CURRENT ITEMS CONTEXT (${items.length} total):
${items.length > 0 ? items.slice(0, 20).map(item => {
  const category = availableCategories.find(c => c.id === item.categoryId);
  const dueInfo = item.dueDate ? ` (due: ${item.dueDate.toLocaleDateString()})` : '';
  const completedInfo = item.completed ? ' ✓' : '';
  const progressInfo = item.metadata?.progress ? ` (${item.metadata.progress}%)` : '';
  
  // Add content preview for notes to provide better context
  let contentPreview = '';
  if (item.type === 'note' && item.text) {
    const preview = item.text.length > 100 ? item.text.substring(0, 100) + '...' : item.text;
    contentPreview = ` | Content: "${preview}"`;
  }
  
  return `• ID: ${item.id} | ${item.type.toUpperCase()}: "${item.title}"${dueInfo}${completedInfo}${progressInfo} [${category?.name || item.categoryId || 'Unknown'}]${contentPreview}`;
}).join('\n') : 'No items yet'}${items.length > 20 ? `\n... and ${items.length - 20} more items` : ''}

CRITICAL ID-TO-ITEM MAPPING:
Each item above shows its exact ID and title. When users provide an ID, use the EXACT mapping from above.
NEVER assume what an ID refers to - always check the context above.
Examples:
- User says "add workout tips to 1749880804964_tv8aza7z4" → Look up ID 1749880804964_tv8aza7z4 in the context above to see what item it actually is
- If ID 1749880804964_tv8aza7z4 maps to "Healthy Breakfast Ideas" → That's what it is, don't assume it's something else
- If user corrects you about what an ID refers to → Accept their correction and proceed

NOTES CONTENT AWARENESS:
You have access to the full content of all notes above. When users ask about notes, reference their actual content.
Examples:
- "What did I write about depression?" → Look at depression-related notes and summarize their content
- "What are my thoughts on fitness?" → Find fitness notes and quote/reference their content
- "Add to my recipe note that it takes 45 minutes" → Use appendText to add cooking time without losing existing recipe content

🧠 ENHANCED CONVERSATIONAL CONTEXT FOR DELETIONS:
When you provide information about user's dashboard/items and they respond with deletion requests:
- If you mention "You have X notes and Y events" and user says "delete these" → Use bulkDeleteItems to delete ALL item types mentioned
- "delete these" after dashboard summary = delete everything you just told them about
- "can you delete these?" = comprehensive deletion of all recently discussed items
- Context carries across conversation - track what you've told the user, then honor comprehensive deletion requests
- Example: If you say "You have 3 notes and 2 events" and user replies "can you delete these?" → Delete ALL notes AND events, not just one type
- Be contextually intelligent - "these" refers to the full scope of what was recently discussed or displayed`;
  }

  getTools(categories: any[] = []) {
    // Build dynamic category description with safety validation
    const categoryDescription = categories.length > 0 
      ? `CRITICAL: MUST use one of these exact category IDs: ${categories.map(cat => `"${cat.id}" (${cat.name})`).join(', ')}. NEVER use any other category IDs - this will cause database errors. If unsure, use "${categories[0]?.id || 'self-regulation'}".`
      : `CRITICAL: Must use a valid category ID. If unsure, use "self-regulation" as fallback.`;
    return [
      {
        name: 'createItem',
        description: 'Create a single item (todo, goal, event, routine, note). IMPORTANT: For CREATE+ACTION requests (e.g., "create routine and mark complete"), ONLY create the item here, then use updateItem separately for the action.',
        parameters: {
          type: 'OBJECT',
          properties: {
            type: {
              type: 'STRING',
              enum: ['todo', 'goal', 'event', 'routine', 'note'],
              description: 'Type of item to create'
            },
            title: {
              type: 'STRING',
              description: 'Title/name of the item'
            },
            text: {
              type: 'STRING', 
              description: 'For routines: The actual routine steps (e.g., "• Wake up at 5 AM\\n• Brush teeth\\n• Get dressed"). For other items: detailed description or body text'
            },
            duration: {
              type: 'NUMBER',
              description: 'Duration in minutes for routines'
            },
            categoryId: {
              type: 'STRING',
              description: categoryDescription
            },
            dueDate: {
              type: 'STRING',
              description: 'Due date in YYYY-MM-DD format for todos'
            },
            dateTime: {
              type: 'STRING', 
              description: 'CRITICAL: For events - Date and time in ISO format. Examples: "2024-06-20T14:00:00" (June 20th 2pm), "2024-06-24T10:00:00" (June 24th 10am). For "all day" events, use "2024-06-20T00:00:00". For "the 20th" use current month: "2024-06-20T00:00:00". For "next week" calculate the actual date.'
            },
            startTime: {
              type: 'STRING',
              description: 'CRITICAL: Start time for events in ISO format. This should match dateTime for single events. Example: "2024-06-20T14:00:00" for June 20th at 2pm.'
            },
            endTime: {
              type: 'STRING',
              description: 'CRITICAL: End time for events in ISO format. ALWAYS provide this unless explicitly "all day". Auto-calculate if not specified: meetings=1hr, appointments=30min, social=2hrs. Example: "2024-06-20T15:00:00" for 1hr after 2pm start.'
            },
            location: {
              type: 'STRING',
              description: 'Location for events (e.g., "Conference Room A", "123 Main St", "Zoom")'
            },
            isRecurring: {
              type: 'BOOLEAN',
              description: 'Whether this is a recurring event'
            },
            recurrencePattern: {
              type: 'STRING',
              enum: ['daily', 'weekly', 'monthly', 'yearly'],
              description: 'Recurrence pattern for recurring events'
            },
            priority: {
              type: 'STRING',
              enum: ['low', 'medium', 'high'],
              description: 'Priority level'
            },
            frequency: {
              type: 'STRING',
              enum: ['daily', 'weekly', 'monthly', 'yearly'],
              description: 'Frequency for routines'
            },
            tags: {
              type: 'STRING',
              description: 'Comma-separated tags for notes (e.g., "cooking, recipes, healthy")'
            },
            hasImage: {
              type: 'BOOLEAN',
              description: 'Whether the note has an image attachment'
            },
            imageUrl: {
              type: 'STRING',
              description: 'URL or path to image for notes'
            }
          },
          required: ['type', 'title', 'categoryId']
        }
      },
      {
        name: 'bulkCreateItems',
        description: 'Create multiple items at once - SMART and VARIED. Use this for creating 2+ items.',
        parameters: {
          type: 'OBJECT',
          properties: {
            itemsJson: {
              type: 'STRING',
              description: 'JSON string array of items to create. Each item should have: type, title, categoryId, and optional: text, dueDate, dateTime, priority, frequency, duration'
            }
          },
          required: ['itemsJson']
        }
      },
      {
        name: 'updateItem',
        description: 'Update an existing item by ID or name. Use whatever the user provides - never ask for additional info!',
        parameters: {
          type: 'OBJECT',
          properties: {
            itemId: {
              type: 'STRING', 
              description: 'ID or name of item to update (use exactly what user provides: "1749834305916_jmwplokbc" or "30-minute HIIT session")' 
            },
            title: { type: 'STRING', description: 'New title for the item' },
            text: { type: 'STRING', description: 'For routines: New routine steps (e.g., "• Wake up at 5 AM\\n• Brush teeth\\n• Get dressed"). For other items: New description. For complete text replacement.' },
            appendText: { type: 'STRING', description: 'Add text to the end of existing content. Use this for adding new information without losing existing content.' },
            prependText: { type: 'STRING', description: 'Add text to the beginning of existing content. Use this for adding context or updates at the start.' },
            replaceText: { type: 'STRING', description: 'Find and replace text within notes. Format: "old text|new text" (e.g., "smoothie bowl understanding|basketball")' },
            fixFormatting: { type: 'BOOLEAN', description: 'Automatically fix spacing, line breaks, and remove duplicate content. Use when user asks to "fix formatting", "clean up", or "organize".' },
            completed: { type: 'BOOLEAN', description: 'Mark item as completed/incomplete' },
            priority: { type: 'STRING', enum: ['low', 'medium', 'high'], description: 'New priority level' },
            progress: { type: 'NUMBER', description: 'Progress percentage for goals (0-100)' },
            newCategoryId: { type: 'STRING', description: 'Move item to new category. Can be any category name the user specifies (e.g., "dating", "work", "fitness") or existing ones: self-regulation, gym-calisthenics, mobile-apps, catholicism, social-charisma, content' },
            dueDate: { type: 'STRING', description: 'Due date in YYYY-MM-DD format for todos and goals' },
            dateTime: { type: 'STRING', description: 'CRITICAL: For rescheduling events - New date and time in ISO format. For "reschedule to next week", calculate the actual date. For "reschedule to the 24th", use current month 24th. Example: "2024-06-24T10:00:00"' },
            startTime: { type: 'STRING', description: 'CRITICAL: New start time for events in ISO format. For time-only changes like "move to 4pm", use "2024-MM-DDTHH:00:00" with current date.' },
            endTime: { type: 'STRING', description: 'CRITICAL: New end time for events in ISO format. Maintain duration when rescheduling unless explicitly changed.' },
            location: { type: 'STRING', description: 'Location for events (e.g., "Conference Room A", "123 Main St", "Zoom")' },
            isRecurring: { type: 'BOOLEAN', description: 'Whether this is a recurring event' },
            recurrencePattern: { type: 'STRING', enum: ['daily', 'weekly', 'monthly', 'yearly'], description: 'Recurrence pattern for recurring events' },
            frequency: { type: 'STRING', enum: ['daily', 'weekly', 'monthly', 'yearly'], description: 'New frequency for routines' },
            duration: { type: 'NUMBER', description: 'New duration in minutes for routines' },
            completedToday: { type: 'BOOLEAN', description: 'Mark routine as completed today (for routine tracking)' },
            tags: { type: 'STRING', description: 'Comma-separated tags for notes (e.g., "cooking, recipes, healthy")' },
            hasImage: { type: 'BOOLEAN', description: 'Whether the note has an image attachment' },
            imageUrl: { type: 'STRING', description: 'URL or path to image for notes' }
          },
          required: ['itemId']
        }
      },
      {
        name: 'deleteItem',
        description: 'Delete an item by ID or name. Use whatever the user provides - never ask for additional info!',
        parameters: {
          type: 'OBJECT',
          properties: {
            itemId: { 
              type: 'STRING', 
              description: 'ID or name of item to delete (use exactly what user provides: "1749834305916_jmwplokbc" or "30-minute HIIT session")' 
            }
          },
          required: ['itemId']
        }
      },
      {
        name: 'bulkUpdateItems',
        description: 'Update multiple items at once. Use for mass operations like "mark 5 todos complete" or "set fishing todos to high priority".',
        parameters: {
          type: 'OBJECT',
          properties: {
            count: { 
              type: 'NUMBER', 
              description: 'Number of items to update (e.g., 5 for "update 5 items"). Use 999 for "all".' 
            },
            quantityType: {
              type: 'STRING',
              enum: ['exact', 'half', 'all'],
              description: 'Type of quantity calculation: exact (use count as-is), half (calculate half of filtered items), all (update all filtered items)'
            },
            type: { 
              type: 'STRING', 
              enum: ['todo', 'goal', 'event', 'routine', 'note'], 
              description: 'Type of items to update' 
            },
            searchTerm: { 
              type: 'STRING', 
              description: 'Search for items containing this text (e.g., "fishing" finds all fishing-related items)' 
            },
            categoryId: { 
              type: 'STRING', 
              description: 'Category to filter by (optional)' 
            },
            completed: { type: 'BOOLEAN', description: 'Mark items as completed/incomplete' },
            priority: { type: 'STRING', enum: ['low', 'medium', 'high'], description: 'New priority level' },
            progress: { type: 'NUMBER', description: 'Progress percentage for goals (0-100)' },
            dueDate: { type: 'STRING', description: 'New due date in YYYY-MM-DD format' },
            newCategoryId: { 
              type: 'STRING', 
              description: 'New category to move items to. Can be any category name the user specifies (e.g., "dating", "work", "fitness") or existing ones: self-regulation, gym-calisthenics, mobile-apps, catholicism, social-charisma, content' 
            },
            frequency: { type: 'STRING', enum: ['daily', 'weekly', 'monthly', 'yearly'], description: 'New frequency for routines' },
            duration: { type: 'NUMBER', description: 'New duration in minutes for routines' },
            completedToday: { type: 'BOOLEAN', description: 'Mark routines as completed today (for routine tracking)' },
            filterByFrequency: { type: 'STRING', enum: ['daily', 'weekly', 'monthly', 'yearly'], description: 'Filter routines by existing frequency (use this to find routines with specific frequency)' },
            selection: { 
              type: 'STRING', 
              enum: ['random', 'oldest', 'newest', 'incomplete', 'complete', 'due_soon', 'overdue'], 
              description: 'How to select items: random, oldest, newest, incomplete, complete, due_soon, overdue' 
            }
          },
          required: ['type']
        }
      },
      {
        name: 'bulkDeleteItems',
        description: 'Delete multiple items at once. Use for mass deletion like "delete 5 random todos" or "delete all fishing items".',
        parameters: {
          type: 'OBJECT',
          properties: {
            count: { 
              type: 'NUMBER', 
              description: 'Number of items to delete (e.g., 5 for "delete 5 items"). Use 999 for "all".' 
            },
            quantityType: {
              type: 'STRING',
              enum: ['exact', 'half', 'all'],
              description: 'Type of quantity calculation: exact (use count as-is), half (calculate half of filtered items), all (delete all filtered items)'
            },
            type: { 
              type: 'STRING', 
              enum: ['todo', 'goal', 'event', 'routine', 'note'], 
              description: 'Type of items to delete' 
            },
            searchTerm: { 
              type: 'STRING', 
              description: 'Search for items containing this text (e.g., "fishing" finds all fishing-related items)' 
            },
            categoryId: { 
              type: 'STRING', 
              description: 'Category to filter by (optional)' 
            },
            selection: { 
              type: 'STRING', 
              enum: ['random', 'oldest', 'newest', 'incomplete', 'complete', 'all'], 
              description: 'How to select items: random, oldest, newest, incomplete, complete, all' 
            }
          },
          required: ['type']
        }
      },
      {
        name: 'createRecurringEvent',
        description: 'Create a recurring event (weekly, monthly, etc.). Use when user says "every Monday", "weekly meeting", etc.',
        parameters: {
          type: 'OBJECT',
          properties: {
            title: {
              type: 'STRING',
              description: 'Title of the recurring event'
            },
            text: {
              type: 'STRING',
              description: 'Description of the event'
            },
            categoryId: {
              type: 'STRING',
              description: 'Category for the event'
            },
            startDateTime: {
              type: 'STRING',
              description: 'First occurrence date and time (ISO format)'
            },
            endDateTime: {
              type: 'STRING',
              description: 'End time for each occurrence (ISO format)'
            },
            recurrencePattern: {
              type: 'STRING',
              enum: ['daily', 'weekly', 'monthly', 'yearly'],
              description: 'How often the event repeats'
            },
            recurrenceInterval: {
              type: 'NUMBER',
              description: 'Interval between occurrences (e.g., 2 for every 2 weeks)',
              default: 1
            },
            recurrenceEndDate: {
              type: 'STRING',
              description: 'When to stop creating recurring events (ISO format)'
            },
            location: {
              type: 'STRING',
              description: 'Location for the events'
            }
          },
          required: ['title', 'startDateTime', 'recurrencePattern', 'categoryId']
        }
      },
      {
        name: 'copyRoutineFromPerson',
        description: 'Copy a famous person\'s routine or create a routine based on someone\'s lifestyle. Use when user says "copy [person]\'s routine" or "create routine like [person]".',
        parameters: {
          type: 'OBJECT',
          properties: {
            personName: {
              type: 'STRING',
              description: 'Name of the person whose routine to copy (e.g., "Steph Curry", "Tim Cook", "David Goggins")'
            },
            routineType: {
              type: 'STRING',
              enum: ['morning', 'workout', 'daily', 'full-day', 'productivity'],
              description: 'Type of routine to copy (morning routine, workout routine, etc.)'
            },
            categoryId: {
              type: 'STRING',
              description: 'Category to place the routine items in'
            },
            startDate: {
              type: 'STRING',
              description: 'Start date for implementing the routine (YYYY-MM-DD format)'
            },
            duration: {
              type: 'NUMBER',
              description: 'How many days to schedule this routine for (default: 30)'
            }
          },
          required: ['personName']
        }
      },
      {
        name: 'generateFullDaySchedule',
        description: 'Generate a complete daily schedule based on user\'s existing routines, goals, and preferences. SMART AUTO-FILL: Use today as startDate and 7 days later as endDate if not specified. Use moderate intensity and 9am-5pm if not specified.',
        parameters: {
          type: 'OBJECT',
          properties: {
            startDate: {
              type: 'STRING',
              description: 'Start date for the schedule (YYYY-MM-DD format). DEFAULT: Use today\'s date if user doesn\'t specify'
            },
            endDate: {
              type: 'STRING',
              description: 'End date for the schedule (YYYY-MM-DD format). DEFAULT: Use 7 days from startDate if user doesn\'t specify'
            },
            includeExistingRoutines: {
              type: 'BOOLEAN',
              description: 'Whether to include existing routines in the schedule',
              default: true
            },
            workingHours: {
              type: 'STRING',
              description: 'Working hours preference. DEFAULT: "9am-5pm" if not specified',
              default: '9am-5pm'
            },
            intensity: {
              type: 'STRING',
              enum: ['light', 'moderate', 'intense', 'extreme'],
              description: 'How packed the schedule should be. DEFAULT: "moderate" if not specified',
              default: 'moderate'
            }
          },
          required: []
        }
      },
      {
        name: 'createCalendarFromNotes',
        description: 'Analyze user\'s notes and create calendar events for learning, studying, or implementing the concepts found in notes. Use when user says "schedule based on my notes" or "create calendar from what I\'m learning".',
        parameters: {
          type: 'OBJECT',
          properties: {
            startDate: {
              type: 'STRING',
              description: 'Start date for the learning schedule (YYYY-MM-DD format)'
            },
            duration: {
              type: 'NUMBER',
              description: 'Number of days to spread the learning over (default: 45)'
            },
            sessionLength: {
              type: 'NUMBER',
              description: 'Length of each study/practice session in minutes (default: 60)'
            },
            frequency: {
              type: 'STRING',
              enum: ['daily', 'weekdays', 'every-other-day', 'weekly'],
              description: 'How often to schedule learning sessions',
              default: 'daily'
            },
            focusAreas: {
              type: 'STRING',
              description: 'Specific topics or areas to focus on from notes (comma-separated)'
            }
          },
          required: ['startDate']
        }
      },
      {
        name: 'bulkRescheduleEvents',
        description: 'Reschedule multiple events at once. Use when user says "push all events back 1 week" or "move all my meetings to next month".',
        parameters: {
          type: 'OBJECT',
          properties: {
            searchTerm: {
              type: 'STRING',
              description: 'Search term to find events to reschedule (optional - leave empty for all events)'
            },
            categoryId: {
              type: 'STRING',
              description: 'Category to filter events by (optional)'
            },
            timeShift: {
              type: 'STRING',
              description: 'How to shift the events: "+1 week", "-3 days", "+2 months", etc.'
            },
            dateRange: {
              type: 'STRING',
              description: 'Date range to filter events (e.g., "2024-06-01 to 2024-06-30")'
            }
          },
          required: ['timeShift']
        }
      },
      {
        name: 'searchItems',
        description: 'Search for items by query, type, category, completion status, or progress',
        parameters: {
          type: 'OBJECT',
          properties: {
            query: { type: 'STRING', description: 'Search term to find items' },
            type: { type: 'STRING', enum: ['todo', 'goal', 'event', 'routine', 'note'], description: 'Filter by item type' },
            categoryId: { type: 'STRING', description: 'Filter by category' },
            completed: { type: 'BOOLEAN', description: 'Filter by completion status (true for complete, false for incomplete)' },
            minProgress: { type: 'NUMBER', description: 'Minimum progress percentage (for goals)' },
            maxProgress: { type: 'NUMBER', description: 'Maximum progress percentage (for goals)' }
          },
          required: []
        }
      },
      {
        name: 'consolidateItems',
        description: 'Consolidate duplicate items by combining their content and removing duplicates. Use when user asks to "consolidate", "merge", or "combine" items.',
        parameters: {
          type: 'OBJECT',
          properties: {
            searchQuery: { 
              type: 'STRING', 
              description: 'Search term to find items to consolidate (e.g., "workout" finds all workout-related items)' 
            },
            itemType: { 
              type: 'STRING', 
              enum: ['todo', 'goal', 'event', 'routine', 'note'], 
              description: 'Type of items to consolidate' 
            }
          },
          required: ['searchQuery', 'itemType']
        }
      },
      {
        name: 'removeAsterisks',
        description: 'Remove all asterisks and markdown symbols from a specific item. Use when user says "remove stars" or "get rid of asterisks".',
        parameters: {
          type: 'OBJECT',
          properties: {
            itemId: { 
              type: 'STRING', 
              description: 'ID or name of the item to clean up' 
            }
          },
          required: ['itemId']
        }
      },
      {
        name: 'executeMultipleUpdates',
        description: 'Execute multiple different update operations on different items. Use when user wants to apply DIFFERENT changes to multiple items (different titles, categories, etc). DO NOT use bulkUpdateItems for this.',
        parameters: {
          type: 'OBJECT',
          properties: {
            updatesJson: { 
              type: 'STRING', 
              description: 'JSON string array of update operations. Each object should have: itemId (required) plus any update parameters like title, text, newCategoryId, etc.' 
            }
          },
          required: ['updatesJson']
        }
      },
      {
        name: 'createMultipleDateEvents',
        description: 'Create the same event on multiple dates. Use when user says "schedule meeting for Monday, Wednesday, Friday" or "book gym sessions for next week".',
        parameters: {
          type: 'OBJECT',
          properties: {
            title: { type: 'STRING', description: 'Event title' },
            text: { type: 'STRING', description: 'Event description (optional)' },
            dates: { 
              type: 'ARRAY', 
              items: { type: 'STRING' },
              description: 'Array of date strings (e.g., ["2024-06-10", "2024-06-12", "2024-06-14"])' 
            },
            time: { type: 'STRING', description: 'Time for all events (e.g., "14:30")' },
            endTime: { type: 'STRING', description: 'End time (optional)' },
            duration: { type: 'NUMBER', description: 'Duration in minutes (optional)' },
            categoryId: { type: 'STRING', description: 'Category for the events' },
            location: { type: 'STRING', description: 'Location (optional)' },
            priority: { type: 'STRING', enum: ['low', 'medium', 'high'], description: 'Priority level' },
            ignoreConflicts: { type: 'BOOLEAN', description: 'Create events even if conflicts exist' }
          },
          required: ['title', 'dates']
        }
      },
      {
        name: 'deleteRecurringEvent',
        description: 'Delete a recurring event with confirmation for all occurrences. Use when user deletes a recurring event.',
        parameters: {
          type: 'OBJECT',
          properties: {
            eventId: { type: 'STRING', description: 'ID of the recurring event to delete' },
            deleteAll: { type: 'BOOLEAN', description: 'Whether to delete all occurrences (true) or just this one (false)' }
          },
          required: ['eventId']
        }
      },
      {
        name: 'intelligentReschedule',
        description: 'Intelligently reschedule events when one is canceled. Use when user cancels an event and wants smart rescheduling.',
        parameters: {
          type: 'OBJECT',
          properties: {
            canceledEventId: { type: 'STRING', description: 'ID of the canceled event' },
            rescheduleType: { 
              type: 'STRING', 
              enum: ['auto', 'priority', 'category'],
              description: 'Type of intelligent rescheduling to perform' 
            }
          },
          required: ['canceledEventId']
        }
      },
      {
        name: 'createItemWithConflictOverride',
        description: 'Create an event even when conflicts exist. Use when user says "create anyway", "override", or "double-book".',
        parameters: {
          type: 'OBJECT',
          properties: {
            title: { type: 'STRING', description: 'Event title' },
            text: { type: 'STRING', description: 'Event description' },
            type: { type: 'STRING', enum: ['todo', 'event', 'note', 'routine', 'goal'], description: 'Type of item' },
            dateTime: { type: 'STRING', description: 'Date and time for the event' },
            categoryId: { type: 'STRING', description: 'Category ID' },
            location: { type: 'STRING', description: 'Event location' },
            priority: { type: 'STRING', enum: ['low', 'medium', 'high'], description: 'Priority level' }
          },
          required: ['title', 'type']
        }
      },
      {
        name: 'createRecurringMultipleDays',
        description: 'Create recurring events for multiple specific days of the week. Use for "every Tuesday and Thursday" type requests.',
        parameters: {
          type: 'OBJECT',
          properties: {
            title: { type: 'STRING', description: 'Event title' },
            text: { type: 'STRING', description: 'Event description' },
            daysOfWeek: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Array of days like ["tuesday", "thursday"]' },
            time: { type: 'STRING', description: 'Time in HH:MM format (e.g., "15:00")' },
            duration: { type: 'NUMBER', description: 'Duration in minutes' },
            startDate: { type: 'STRING', description: 'Start date for the recurring pattern' },
            endDate: { type: 'STRING', description: 'End date for the recurring pattern' },
            categoryId: { type: 'STRING', description: 'Category ID' },
            location: { type: 'STRING', description: 'Event location' },
            priority: { type: 'STRING', enum: ['low', 'medium', 'high'], description: 'Priority level' }
          },
          required: ['title', 'daysOfWeek', 'time']
        }
      }
    ];
  }

  // Execute function calls immediately like OpenRouter
  async executeFunction(name: string, args: any): Promise<any> {
    switch (name) {
      case 'createItem':
        return await this.createItem(args);
      case 'bulkCreateItems':
        return await this.bulkCreateItems(args);
      case 'updateItem':
        return await this.updateItem(args);
      case 'deleteItem':
        return await this.deleteItem(args);
      case 'bulkUpdateItems':
        return await this.bulkUpdateItems(args);
      case 'bulkDeleteItems':
        return await this.bulkDeleteItems(args);
      case 'searchItems':
        return await this.searchItems(args);
      case 'consolidateItems':
        return await this.consolidateItems(args.searchQuery, args.itemType);
      case 'removeAsterisks':
        return await this.removeAsterisks(args.itemId);
      case 'executeMultipleUpdates':
        return await this.executeMultipleUpdates(args.updatesJson);
      case 'copyRoutineFromPerson':
        return await this.copyRoutineFromPerson(args);
      case 'generateFullDaySchedule':
        return await this.generateFullDaySchedule(args);
      case 'createCalendarFromNotes':
        return await this.createCalendarFromNotes(args);
      case 'bulkRescheduleEvents':
        return await this.bulkRescheduleEvents(args);
      case 'createRecurringEvent':
        return await this.createRecurringEvent(args);
      case 'createMultipleDateEvents':
        return await this.createMultipleDateEvents(args);
      case 'deleteRecurringEvent':
        return await this.deleteRecurringEvent(args);
      case 'intelligentReschedule':
        return await this.intelligentReschedule(args);
      case 'createItemWithConflictOverride':
        return await this.createItemWithConflictOverride(args);
      case 'createRecurringMultipleDays':
        return await this.createRecurringMultipleDays(args);
      default:
        throw new Error(`Function ${name} not implemented`);
    }
  }

  // Execute function calls with provided context (for OpenAI Realtime Service)
  async executeFunctionWithContext(name: string, args: any, currentItems: any[], currentCategories: any[]): Promise<any> {
    // Store the provided context temporarily
    const originalGetStoredItems = this.getStoredItems;
    const originalSaveStoredItems = this.saveStoredItems;
    
    // Override getStoredItems to use provided context
    this.getStoredItems = () => {
      console.log('📊 GEMINI SERVICE: Using provided context items:', currentItems.length);
      console.log('📊 GEMINI SERVICE: Sample context items:', currentItems.slice(0, 2).map(item => ({ id: item.id, title: item.title, type: item.type })));
      return currentItems.map((item: any) => ({
        ...item,
        createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
        updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
        dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
        dateTime: item.dateTime ? new Date(item.dateTime) : undefined
      }));
    };
    
    // Override saveStoredItems to update both localStorage and provided context
    this.saveStoredItems = (items: any[]) => {
      try {
        // Update localStorage
        localStorage.setItem('lifeStructureItems', JSON.stringify(items));
        console.log('💾 Saved', items.length, 'items to localStorage');
        
        // Update the provided context array
        currentItems.length = 0;
        currentItems.push(...items);
        console.log('📊 Updated provided context with', items.length, 'items');
        
        // Dispatch custom event for real-time UI updates
        window.dispatchEvent(new CustomEvent('itemsModified', {
          detail: { items, timestamp: Date.now() }
        }));
        console.log('📡 Dispatched itemsModified event for real-time updates');
      } catch (error) {
        console.error('❌ Failed to save items:', error);
      }
    };
    
    try {
      // Execute the function with the overridden methods
      const result = await this.executeFunction(name, args);
      return result;
    } finally {
      // Restore original methods
      this.getStoredItems = originalGetStoredItems;
      this.saveStoredItems = originalSaveStoredItems;
    }
  }

  private async createItem(args: any) {
    console.log('🎯 Creating item with args:', args);
    
    const items = this.getStoredItems();
    
    // Enhanced conflict detection for appointments/events
    if (args.type === 'event' && args.dateTime && !args.ignoreConflicts) {
      const requestedDateTime = new Date(args.dateTime);
      const conflictingEvents = items.filter(item => {
        if (item.type !== 'event' || !item.dateTime) return false;
        
        const existingDateTime = new Date(item.dateTime);
        const timeDiff = Math.abs(existingDateTime.getTime() - requestedDateTime.getTime());
        
        // Check for conflicts within 30 minutes
        return timeDiff < 30 * 60 * 1000;
      });
      
      if (conflictingEvents.length > 0) {
        const conflictDetails = conflictingEvents.map(event => 
          `"${event.title}" at ${new Date(event.dateTime!).toLocaleTimeString()}`
        ).join(', ');
        
        return {
          success: false,
          function: 'createItem',
          result: {
            message: `⚠️ CONFLICT DETECTED: You already have ${conflictDetails} at that time. Would you like to:
1. Choose a different time
2. Cancel the existing appointment
3. Create anyway (double-booked)

Please specify your preference or say "create anyway" to override.`,
            conflictingEvents: conflictingEvents.map(e => ({ id: e.id, title: e.title, dateTime: e.dateTime })),
            suggestedTimes: this.suggestAlternativeTimes(requestedDateTime, items),
            needsConflictResolution: true
          }
        };
      }
    }

    // Enhanced category mapping
    let categoryId = args.categoryId;
    if (categoryId) {
      categoryId = this.mapToExistingCategory(categoryId);
    }

    // Enhanced all-day event detection
    const isAllDayEvent = this.detectAllDayEvent(args);
    
    let dateTime = args.dateTime ? new Date(args.dateTime) : undefined;
    let startTime = args.startTime ? new Date(args.startTime) : undefined;
    let endTime = args.endTime ? new Date(args.endTime) : undefined;
    
    if (args.type === 'event') {
      // If dateTime is provided but no startTime, use dateTime as startTime
      if (dateTime && !startTime) {
        startTime = dateTime;
      }
      
      // Auto-generate endTime if not provided
      if (startTime && !endTime) {
        const start = new Date(startTime);
        const title = args.title.toLowerCase();
        let durationMinutes = 60; // Default 1 hour
        
        // Smart duration based on event type
        if (title.includes('appointment') || title.includes('doctor') || title.includes('dentist')) {
          durationMinutes = 30; // 30 minutes for appointments
        } else if (title.includes('party') || title.includes('dinner') || title.includes('social')) {
          durationMinutes = 120; // 2 hours for social events
        } else if (title.includes('meeting') || title.includes('call')) {
          durationMinutes = 60; // 1 hour for meetings
        } else if (title.includes('workout') || title.includes('gym') || title.includes('exercise')) {
          durationMinutes = 60; // 1 hour for workouts
        }
        
        if (isAllDayEvent) {
          // For all-day events, set start to beginning of day and end to end of day
          const dayStart = new Date(start);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(start);
          dayEnd.setHours(23, 59, 59, 999);
          
          startTime = dayStart;
          endTime = dayEnd;
          dateTime = dayStart;
        } else if (startTime.toISOString().includes('T00:00:00') && !args.title.toLowerCase().includes('midnight')) {
          // If time is 00:00:00 but not explicitly midnight, check if it should be all-day
          if (this.shouldBeAllDay(args.title, args.text)) {
            const dayStart = new Date(start);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(start);
            dayEnd.setHours(23, 59, 59, 999);
            
            startTime = dayStart;
            endTime = dayEnd;
            dateTime = dayStart;
          } else {
            // Regular timed event
            const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
            endTime = end;
          }
        } else {
          // Regular timed event
          const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
          endTime = end;
        }
      }
    }

    // Create the item
    const newItem: Item = {
      id: this.generateUniqueId(),
      title: args.title,
      text: args.text || '',
      type: args.type,
      categoryId: categoryId || 'self-regulation',
      completed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      dueDate: args.dueDate ? new Date(args.dueDate) : undefined,
      dateTime: dateTime,
      metadata: {
        priority: args.priority || 'medium',
        ...(args.location && { location: args.location }),
        ...(startTime && { startTime }),
        ...(endTime && { endTime }),
        ...(isAllDayEvent && { isAllDay: true }),
        ...(args.isRecurring && { 
          isRecurring: true,
          recurrencePattern: args.recurrencePattern || 'weekly',
          recurrenceInterval: args.recurrenceInterval || 1,
          recurrenceEndDate: args.recurrenceEndDate ? new Date(args.recurrenceEndDate) : undefined
        }),
        aiGenerated: true
      }
    };

    // Handle routine-specific metadata
    if (args.type === 'routine') {
      newItem.metadata = {
        ...newItem.metadata,
        frequency: args.frequency || 'daily',
        duration: args.duration || 30,
        currentStreak: 0,
        bestStreak: 0,
        completedToday: false,
        completedDates: []
      };
    }

    // Use Supabase if callbacks are available (authenticated user), otherwise localStorage
    if (this.supabaseCallbacks.createItem) {
      console.log('🔄 GEMINI SERVICE: Creating item via Supabase for authenticated user');
      try {
        const supabaseItem = await this.supabaseCallbacks.createItem(newItem);
        // Real-time subscriptions handle data updates automatically - manual refresh removed
        
        return {
          success: true,
          function: 'createItem',
          result: {
            message: `✅ Created ${args.type}: "${args.title}"${isAllDayEvent ? ' (All Day)' : ''}`,
            item: supabaseItem || newItem
          }
        };
      } catch (error) {
        console.error('❌ GEMINI SERVICE: Supabase createItem failed:', error);
        // Fall back to localStorage
        items.push(newItem);
        this.saveStoredItems(items);
        
        return {
          success: true,
          function: 'createItem',
          result: {
            message: `✅ Created ${args.type}: "${args.title}" (saved locally due to sync error)`,
            item: newItem
          }
        };
      }
    } else {
      console.log('🔄 GEMINI SERVICE: Creating item via localStorage for unauthenticated user');
      items.push(newItem);
      this.saveStoredItems(items);

      return {
        success: true,
        function: 'createItem',
        result: {
          message: `✅ Created ${args.type}: "${args.title}"${isAllDayEvent ? ' (All Day)' : ''}`,
          item: newItem
        }
      };
    }
  }

  // Helper methods for enhanced functionality
  private mapToExistingCategory(userCategory: string, currentCategories?: any[]): string {
    // If no current categories available, return the input as-is
    if (!currentCategories || currentCategories.length === 0) {
      return userCategory;
    }

    const searchTerm = userCategory.toLowerCase();
    
    // First try exact name match (case insensitive)
    const exactMatch = currentCategories.find(cat => 
      cat.name?.toLowerCase() === searchTerm
    );
    if (exactMatch) {
      return exactMatch.id;
    }
    
    // Try partial name match
    const partialMatch = currentCategories.find(cat => 
      cat.name?.toLowerCase().includes(searchTerm) || searchTerm.includes(cat.name?.toLowerCase())
    );
    if (partialMatch) {
      return partialMatch.id;
    }
    
    // FLEXIBLE semantic mapping based on user's ACTUAL categories
    const findSemanticMatch = (term: string): any | null => {
      const semanticGroups = [
        { keywords: ['personal', 'self', 'regulation', 'health', 'general', 'misc', 'default', 'other', 'medical', 'doctor'], type: 'personal' },
        { keywords: ['work', 'business', 'career', 'job', 'coding', 'programming', 'app', 'tech', 'development'], type: 'work' },
        { keywords: ['fitness', 'gym', 'workout', 'exercise', 'health', 'sport', 'training'], type: 'fitness' },
        { keywords: ['social', 'dating', 'relationship', 'friends', 'charisma'], type: 'social' },
        { keywords: ['study', 'learning', 'education', 'content', 'creation', 'notes', 'knowledge'], type: 'education' },
        { keywords: ['spiritual', 'church', 'prayer', 'faith', 'religion', 'mass'], type: 'spiritual' }
      ];
      
      // Find which semantic group the search term belongs to
      let targetType: string | null = null;
      for (const group of semanticGroups) {
        if (group.keywords.some(keyword => term.includes(keyword) || keyword.includes(term))) {
          targetType = group.type;
          break;
        }
      }
      
      // Find a user category that matches the semantic type
      if (targetType) {
        const semanticKeywords = semanticGroups.find(g => g.type === targetType)?.keywords || [];
        const match = currentCategories.find(cat => {
          const catName = cat.name?.toLowerCase() || '';
          return semanticKeywords.some(keyword => 
            catName.includes(keyword) || keyword.includes(catName)
          );
        });
        if (match) return match;
      }
      
      return null;
    };
    
    const semanticMatch = findSemanticMatch(searchTerm);
    if (semanticMatch) {
      console.log('✅ GEMINI SERVICE: Found semantic category match:', userCategory, '->', semanticMatch.name, '->', semanticMatch.id);
      return semanticMatch.id;
    }
    
    // If no match found, return the first available category ID or original input
    if (currentCategories.length > 0) {
      console.warn('⚠️ GEMINI SERVICE: No category match found, using first available:', userCategory, '->', currentCategories[0].name);
      return currentCategories[0].id;
    }
    
    return userCategory;
  }

  private detectAllDayEvent(args: any): boolean {
    const title = (args.title || '').toLowerCase();
    const text = (args.text || '').toLowerCase();
    
    // Explicit all-day indicators
    if (title.includes('all day') || title.includes('all-day') || 
        text.includes('all day') || text.includes('all-day')) {
      return true;
    }
    
    // Event types that are typically all-day
    const allDayKeywords = [
      'conference', 'festival', 'fair', 'retreat', 'vacation',
      'holiday', 'birthday', 'anniversary', 'wedding'
    ];
    
    return allDayKeywords.some(keyword => title.includes(keyword) || text.includes(keyword));
  }

  private shouldBeAllDay(title: string, text?: string): boolean {
    const titleLower = (title || '').toLowerCase();
    const textLower = (text || '').toLowerCase();
    
    // Check for conference or similar events without specific times
    const allDayPatterns = ['conference', 'festival', 'fair', 'retreat'];
    return allDayPatterns.some(pattern => 
      titleLower.includes(pattern) || textLower.includes(pattern)
    );
  }

  private suggestAlternativeTimes(requestedTime: Date, items: Item[]): string[] {
    const suggestions: string[] = [];
    const baseDate = new Date(requestedTime);
    
    // Suggest times 1 hour before and after
    for (let offset of [-60, 60, -120, 120]) {
      const suggestedTime = new Date(baseDate.getTime() + offset * 60 * 1000);
      const hasConflict = items.some(item => {
        if (item.type !== 'event' || !item.dateTime) return false;
        const existingTime = new Date(item.dateTime);
        return Math.abs(existingTime.getTime() - suggestedTime.getTime()) < 30 * 60 * 1000;
      });
      
      if (!hasConflict) {
        suggestions.push(suggestedTime.toLocaleString());
      }
    }
    
    return suggestions.slice(0, 3); // Return top 3 suggestions
  }

  private async bulkCreateItems(args: any) {
    console.log('🚀 Bulk creating items from JSON:', args.itemsJson);
    
    const newItems: Item[] = [];
    
    try {
      // Clean malformed JSON from Gemini before parsing
      let cleanedJson = args.itemsJson || '[]';
      
      // Fix common Gemini JSON malformation patterns
      cleanedJson = cleanedJson
        // Fix duplicate key patterns like "type": "note": "note" -> "type": "note"
        .replace(/"(\w+)":\s*"([^"]+)":\s*"[^"]*"/g, '"$1": "$2"')
        // Fix missing commas between properties
        .replace(/"\s*}\s*{/g, '"}, {')
        // Remove trailing commas before closing brackets/braces
        .replace(/,(\s*[}\]])/g, '$1')
        // Fix malformed array structures
        .replace(/\]\s*\[/g, '], [');
      
      console.log('🧹 Cleaned JSON:', cleanedJson);
      
      // Parse the cleaned JSON string
      const itemsData = JSON.parse(cleanedJson);
      console.log('📦 Parsed items:', itemsData);
      
      for (const itemData of itemsData) {
        const newItem: Item = {
          id: this.generateUniqueId(),
          title: itemData.title,
          text: this.stripMarkdownSymbols(itemData.text || ''),
          type: itemData.type,
          categoryId: itemData.categoryId,
          completed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          dueDate: itemData.dueDate ? new Date(itemData.dueDate) : undefined,
          dateTime: itemData.dateTime ? new Date(itemData.dateTime) : undefined,
          metadata: {
            priority: itemData.priority || 'medium',
            aiGenerated: true,
            // Add routine-specific metadata
            ...(itemData.type === 'routine' && {
              frequency: itemData.frequency || 'daily',
              duration: itemData.duration || 30,
              currentStreak: 0,
              bestStreak: 0,
              completedToday: false,
              completedDates: []
            }),
            // Add event-specific metadata
            ...(itemData.type === 'event' && {
              startTime: itemData.startTime ? new Date(itemData.startTime) : (itemData.dateTime ? new Date(itemData.dateTime) : undefined),
              endTime: itemData.endTime ? new Date(itemData.endTime) : undefined,
              location: itemData.location || undefined,
              isRecurring: itemData.isRecurring || false,
              recurrencePattern: itemData.recurrencePattern || undefined,
              duration: itemData.endTime && itemData.startTime ? 
                Math.round((new Date(itemData.endTime).getTime() - new Date(itemData.startTime).getTime()) / (1000 * 60)) : 
                undefined
            }),
            // Add note-specific metadata
            ...(itemData.type === 'note' && {
              tags: itemData.tags ? itemData.tags.split(',').map((t: string) => t.trim()) : [],
              hasImage: itemData.hasImage || false,
              imageUrl: itemData.imageUrl || undefined,
              hasCustomTitle: !!itemData.title
            }),
            // For non-routines, just add frequency if provided
            ...(itemData.type !== 'routine' && itemData.frequency && { frequency: itemData.frequency })
          }
        };
        
        newItems.push(newItem);
      }
      
      // Use Supabase if callbacks are available (authenticated user), otherwise localStorage
      if (this.supabaseCallbacks.bulkCreateItems) {
        console.log('🔄 GEMINI SERVICE: Bulk creating items via Supabase for authenticated user');
        try {
          const supabaseItems = await this.supabaseCallbacks.bulkCreateItems(newItems);
          // Real-time subscriptions handle data updates automatically - manual refresh removed
          
          return {
            success: true,
            function: 'bulkCreateItems',
            result: { created: newItems.length, items: supabaseItems || newItems }
          };
        } catch (error) {
          console.error('❌ GEMINI SERVICE: Supabase bulkCreateItems failed:', error);
          // Fall back to localStorage
          const items = this.getStoredItems();
          items.push(...newItems);
          this.saveStoredItems(items);
          
          return {
            success: true,
            function: 'bulkCreateItems',
            result: { created: newItems.length, items: newItems, fallbackUsed: true }
          };
        }
      } else {
        console.log('🔄 GEMINI SERVICE: Bulk creating items via localStorage for unauthenticated user');
        const items = this.getStoredItems();
        items.push(...newItems);
        this.saveStoredItems(items);
        
        return {
          success: true,
          function: 'bulkCreateItems',
          result: { created: newItems.length, items: newItems }
        };
      }
    } catch (error) {
      console.error('❌ Error parsing items JSON:', error);
      throw new Error(`Failed to parse items JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async updateItem(args: any) {
    console.log('🔄 Updating item with args:', args);
    
    const items = this.getStoredItems();
    console.log('📊 Found', items.length, 'items to search through');
    console.log('🔍 Looking for item with itemId:', args.itemId, 'title:', args.title);
    
    let itemIndex = -1;
    let searchMethod = '';
    
    // Enhanced item finding logic with better debugging
    if (args.itemId) {
      // Try exact ID match first
      itemIndex = items.findIndex(item => item.id === args.itemId);
      if (itemIndex !== -1) {
        searchMethod = 'exact ID match';
        console.log('✅ Found item by exact ID:', items[itemIndex].title);
      }
      
      // If not found by ID, try title matching
      if (itemIndex === -1) {
        const searchTitle = args.itemId.toLowerCase();
        itemIndex = items.findIndex(item => 
          item.title.toLowerCase().includes(searchTitle) ||
          searchTitle.includes(item.title.toLowerCase())
        );
        if (itemIndex !== -1) {
          searchMethod = 'title contains match';
          console.log('✅ Found item by title match:', items[itemIndex].title);
        }
      }
      
      // If still not found, try broader partial matching
      if (itemIndex === -1) {
        const searchTerms = args.itemId.toLowerCase().split(' ').filter((term: string) => term.length > 2);
        itemIndex = items.findIndex(item => {
          const itemTitle = item.title.toLowerCase();
          return searchTerms.some((term: string) => itemTitle.includes(term));
        });
        if (itemIndex !== -1) {
          searchMethod = 'partial word match';
          console.log('✅ Found item by partial match:', items[itemIndex].title);
        }
      }
    } else if (args.id) {
      itemIndex = items.findIndex(item => item.id === args.id);
      if (itemIndex !== -1) {
        searchMethod = 'args.id match';
        console.log('✅ Found item by args.id:', items[itemIndex].title);
      }
    } else if (args.title) {
      // Find by title (case-insensitive, partial match)
      const searchTitle = args.title.toLowerCase();
      itemIndex = items.findIndex(item => 
        item.title.toLowerCase().includes(searchTitle) ||
        searchTitle.includes(item.title.toLowerCase())
      );
      if (itemIndex !== -1) {
        searchMethod = 'title parameter match';
        console.log('✅ Found item by title parameter:', items[itemIndex].title);
      }
    }
    
    if (itemIndex === -1) {
      console.log('❌ Item not found! Searched for:', args.itemId || args.id || args.title);
      console.log('📋 Available items:', items.slice(0, 5).map(item => `"${item.title}" (${item.type}) - ID: ${item.id}`));
      
      return {
        success: false,
        function: 'updateItem',
        result: {
          message: `❌ Item not found: "${args.itemId || args.id || args.title}". Available items: ${items.slice(0, 3).map(item => `"${item.title}"`).join(', ')}`,
          availableItems: items.slice(0, 5).map(item => ({ id: item.id, title: item.title, type: item.type }))
        }
      };
    }
    
    console.log('🎯 Found item using', searchMethod, '- Title:', items[itemIndex].title);

    const originalItem = items[itemIndex];
    const updates: Partial<Item> = { updatedAt: new Date() };
    
    // Handle basic updates
    if (args.title !== undefined) updates.title = args.title;
    if (args.text !== undefined) updates.text = args.text;
    if (args.completed !== undefined) updates.completed = args.completed;
    if (args.priority !== undefined) updates.metadata = { ...originalItem.metadata, priority: args.priority };
    
    // Enhanced category mapping
    if (args.categoryId !== undefined || args.newCategoryId !== undefined) {
      const newCategory = args.categoryId || args.newCategoryId;
      const mappedCategory = this.mapToExistingCategory(newCategory);
      updates.categoryId = mappedCategory;
    }
    
    if (args.dueDate !== undefined) updates.dueDate = new Date(args.dueDate);
    
    // Enhanced datetime/reschedule handling for events
    if (args.dateTime !== undefined) {
      const newDateTime = new Date(args.dateTime);
      updates.dateTime = newDateTime;
      
      // If this is an event and we're updating dateTime, also update startTime
      if (originalItem.type === 'event') {
        const currentStartTime = originalItem.metadata?.startTime;
        if (currentStartTime) {
          // Extract the time portion from the current startTime
          const currentTime = new Date(currentStartTime);
          const timeStr = currentTime.toISOString().split('T')[1]; // Get HH:MM:SS.sssZ part
          
          // Combine new date with existing time
          const newStartTime = new Date(newDateTime.toISOString().split('T')[0] + 'T' + timeStr);
          
          // Also update endTime if it exists
          const currentEndTime = originalItem.metadata?.endTime;
          if (currentEndTime) {
            const currentEndTimeObj = new Date(currentEndTime);
            const currentDuration = currentEndTimeObj.getTime() - currentTime.getTime();
            const newEndTime = new Date(newStartTime.getTime() + currentDuration);
            
            updates.metadata = {
              ...updates.metadata,
              startTime: newStartTime,
              endTime: newEndTime
            };
          } else {
            updates.metadata = {
              ...updates.metadata,
              startTime: newStartTime
            };
          }
        }
      }
    }
    
    // Handle metadata updates
    const currentMetadata = originalItem.metadata || {};
    let metadataUpdates = {};
    
    // Event-specific metadata
    if (args.startTime !== undefined) {
      metadataUpdates = { ...metadataUpdates, startTime: new Date(args.startTime) };
    }
    if (args.endTime !== undefined) {
      metadataUpdates = { ...metadataUpdates, endTime: new Date(args.endTime) };
    }
    if (args.location !== undefined) {
      metadataUpdates = { ...metadataUpdates, location: args.location };
    }
    
    // Routine-specific metadata
    if (args.frequency !== undefined) {
      metadataUpdates = { ...metadataUpdates, frequency: args.frequency };
    }
    if (args.duration !== undefined) {
      metadataUpdates = { ...metadataUpdates, duration: args.duration };
    }
    
    // Goal-specific metadata
    if (args.progress !== undefined) {
      metadataUpdates = { ...metadataUpdates, progress: Math.max(0, Math.min(100, args.progress)) };
    }
    
    // Merge metadata updates
    if (Object.keys(metadataUpdates).length > 0) {
      updates.metadata = { ...currentMetadata, ...metadataUpdates };
    }

    const updatedItem = { ...originalItem, ...updates };

    // Use Supabase if callbacks are available (authenticated user), otherwise localStorage
    if (this.supabaseCallbacks.updateItem) {
      console.log('🔄 GEMINI SERVICE: Updating item via Supabase for authenticated user');
      try {
        const supabaseItem = await this.supabaseCallbacks.updateItem(originalItem.id, updatedItem);
        // Real-time subscriptions handle data updates automatically - manual refresh removed
        
        return {
          success: true,
          function: 'updateItem',
          result: {
            message: `✅ Updated ${updatedItem.type}: "${updatedItem.title}"`,
            item: supabaseItem || updatedItem
          }
        };
      } catch (error) {
        console.error('❌ GEMINI SERVICE: Supabase updateItem failed:', error);
        // Fall back to localStorage
        items[itemIndex] = updatedItem;
        this.saveStoredItems(items);
        
        return {
          success: true,
          function: 'updateItem',
          result: {
            message: `✅ Updated ${updatedItem.type}: "${updatedItem.title}" (saved locally due to sync error)`,
            item: updatedItem
          }
        };
      }
    } else {
      console.log('🔄 GEMINI SERVICE: Updating item via localStorage for unauthenticated user');
      items[itemIndex] = updatedItem;
      this.saveStoredItems(items);

      return {
        success: true,
        function: 'updateItem',
        result: {
          message: `✅ Updated ${updatedItem.type}: "${updatedItem.title}"`,
          item: updatedItem
        }
      };
    }
  }

  private async deleteItem(args: any) {
    const items = this.getStoredItems();
    
    // Clean the search term - remove common words like "todo", "goal", "event", etc.
    const cleanSearchTerm = (term: string) => {
      return term
        .toLowerCase()
        .replace(/\b(todo|goal|event|routine|note|item|task)\b/g, '') // Remove type words
        .replace(/\s+/g, ' ') // Normalize spaces
        .trim();
    };
    
    const searchTerm = cleanSearchTerm(args.itemId || '');
    console.log('🗑️ Searching to delete:', searchTerm, 'from original:', args.itemId);
    
    // Try to find by ID first (exact match)
    let itemIndex = items.findIndex(item => item.id === args.itemId);
    
    if (itemIndex !== -1) {
      console.log('✅ Found item to delete by exact ID:', items[itemIndex].title, 'Type:', items[itemIndex].type);
    }
    
    // If not found by ID, try smart name matching
    if (itemIndex === -1 && searchTerm) {
      // Method 1: Exact match after cleaning
      itemIndex = items.findIndex(item => 
        cleanSearchTerm(item.title) === searchTerm
      );
      
      // Method 2: Contains match after cleaning
      if (itemIndex === -1) {
        itemIndex = items.findIndex(item => 
          cleanSearchTerm(item.title).includes(searchTerm)
        );
      }
      
      // Method 3: Reverse contains (search term contains item title)
      if (itemIndex === -1) {
        itemIndex = items.findIndex(item => 
          searchTerm.includes(cleanSearchTerm(item.title))
        );
      }
      
      // Method 4: Word-by-word matching
      if (itemIndex === -1) {
        const searchWords = searchTerm.split(' ').filter(w => w.length > 2);
        itemIndex = items.findIndex(item => {
          const titleWords = cleanSearchTerm(item.title).split(' ');
          return searchWords.some(searchWord => 
            titleWords.some(titleWord => 
              titleWord.includes(searchWord) || searchWord.includes(titleWord)
            )
          );
        });
      }
    }
    
    if (itemIndex === -1) {
      // List similar items to help user
      const searchWords = searchTerm.split(' ').filter(w => w.length > 1);
      const similarItems = items.filter(item => {
        const itemTitle = cleanSearchTerm(item.title);
        return searchWords.some(word => itemTitle.includes(word));
      }).slice(0, 5);
      
      const suggestion = similarItems.length > 0 
        ? `\n\nSimilar items found: ${similarItems.map(item => `"${item.title}" (${item.type})`).join(', ')}`
        : `\n\nAvailable items: ${items.slice(0, 3).map(item => `"${item.title}" (${item.type})`).join(', ')}`;
      
      throw new Error(`Item not found for deletion: "${args.itemId}"${suggestion}`);
    }
    
    const deletedItem = items[itemIndex];

    // Use Supabase if callbacks are available (authenticated user), otherwise localStorage
    if (this.supabaseCallbacks.deleteItem) {
      console.log('🔄 GEMINI SERVICE: Deleting item via Supabase for authenticated user');
      try {
        await this.supabaseCallbacks.deleteItem(deletedItem.id);
        // Real-time subscriptions handle data updates automatically - manual refresh removed
        
        return {
          success: true,
          function: 'deleteItem',
          result: { 
            deleted: 1, 
            item: deletedItem,
            message: `Successfully deleted "${deletedItem.title}"`
          }
        };
      } catch (error) {
        console.error('❌ GEMINI SERVICE: Supabase deleteItem failed:', error);
        // Fall back to localStorage
        const filteredItems = items.filter((_, index) => index !== itemIndex);
        this.saveStoredItems(filteredItems);
        
        return {
          success: true,
          function: 'deleteItem',
          result: { 
            deleted: 1, 
            item: deletedItem,
            message: `Successfully deleted "${deletedItem.title}" (saved locally due to sync error)`
          }
        };
      }
    } else {
      console.log('🔄 GEMINI SERVICE: Deleting item via localStorage for unauthenticated user');
      const filteredItems = items.filter((_, index) => index !== itemIndex);
      this.saveStoredItems(filteredItems);
      
      return {
        success: true,
        function: 'deleteItem',
        result: { 
          deleted: 1, 
          item: deletedItem,
          message: `Successfully deleted "${deletedItem.title}"`
        }
      };
    }
  }

    private async bulkUpdateItems(args: any) {
    console.log('🔄 Bulk updating items:', args);
    
    const items = this.getStoredItems();
    console.log('📦 Total items before update:', items.length);
    
    // Filter by type and category
    let filteredItems = items.filter(item => item.type === args.type);
    console.log(`📋 Found ${filteredItems.length} ${args.type}s to choose from`);
    
    if (args.searchTerm) {
      filteredItems = filteredItems.filter(item => 
        item.title.toLowerCase().includes(args.searchTerm.toLowerCase()) ||
        item.text.toLowerCase().includes(args.searchTerm.toLowerCase())
      );
      console.log(`📋 After search filter (${args.searchTerm}): ${filteredItems.length} items`);
    }
    
    if (args.categoryId) {
      filteredItems = filteredItems.filter(item => item.categoryId === args.categoryId);
      console.log(`📋 After category filter: ${filteredItems.length} items`);
    }

    // Filter by frequency if specified
    if (args.filterByFrequency) {
      filteredItems = filteredItems.filter(item => item.metadata?.frequency === args.filterByFrequency);
      console.log(`📅 After frequency filter (${args.filterByFrequency}): ${filteredItems.length} items`);
    }
    
    // Smart quantity calculation
    let actualCount = args.count || 1;
    if (args.quantityType === 'half') {
      actualCount = Math.ceil(filteredItems.length / 2);
      console.log(`🧮 Half calculation: ${filteredItems.length} items ÷ 2 = ${actualCount}`);
    } else if (args.quantityType === 'all' || args.count === 999) {
      actualCount = filteredItems.length;
      console.log(`🧮 All calculation: ${actualCount} items`);
    }
    
    // Apply selection strategy
    let selectedItems = this.selectItems(filteredItems, actualCount, args.selection || 'random');
    console.log('🎯 Selected items for update:', selectedItems.map(item => item.title));
    
    // Warn if fewer items found than requested
    if (selectedItems.length < args.count && selectedItems.length < filteredItems.length) {
      console.log(`⚠️ Only found ${selectedItems.length} items, requested ${args.count}`);
    }
    
    // Update the selected items
    const updates: any = {};
    let metadataUpdates: any = {};
    
    if (args.completed !== undefined) updates.completed = args.completed;
    if (args.dueDate !== undefined) updates.dueDate = new Date(args.dueDate);
    if (args.newCategoryId !== undefined) {
      updates.categoryId = args.newCategoryId;
      console.log(`📂 Category update: ${args.newCategoryId}`);
    }
    
    // Handle metadata updates
    if (args.priority !== undefined) {
      // Auto-correct common priority typos
      let correctedPriority = args.priority.toLowerCase();
      if (correctedPriority.includes('hi') || correctedPriority === 'hihg') correctedPriority = 'high';
      if (correctedPriority.includes('lo')) correctedPriority = 'low';
      if (correctedPriority.includes('med')) correctedPriority = 'medium';
      
      metadataUpdates.priority = correctedPriority;
    }
    if (args.progress !== undefined) {
      metadataUpdates.progress = args.progress;
    }
    
    // Handle routine-specific metadata updates
    if (args.frequency !== undefined) metadataUpdates.frequency = args.frequency;
    if (args.duration !== undefined) metadataUpdates.duration = args.duration;
    if (args.completedToday !== undefined) metadataUpdates.completedToday = args.completedToday;
    
    // Apply metadata updates
    if (Object.keys(metadataUpdates).length > 0) {
      updates.metadata = metadataUpdates;
    }
    console.log('📝 Updates to apply:', updates);
    
    // Use Supabase if callbacks are available (authenticated user), otherwise localStorage
    if (this.supabaseCallbacks.updateItem) {
      console.log('🔄 GEMINI SERVICE: Bulk updating items via Supabase for authenticated user');
      try {
        for (const item of selectedItems) {
          // Handle metadata merging properly
          const updatedItem = {
            ...item,
            ...updates,
            updatedAt: new Date()
          };
          
          // Merge metadata if both exist
          if (updates.metadata && item.metadata) {
            updatedItem.metadata = {
              ...item.metadata,
              ...updates.metadata
            };
          }
          
          await this.supabaseCallbacks.updateItem(item.id, updatedItem);
          console.log(`✅ Updated item via Supabase: ${item.title}`);
        }
        
        // Real-time subscriptions handle data updates automatically - manual refresh removed
      } catch (error) {
        console.error('❌ GEMINI SERVICE: Supabase bulkUpdateItems failed:', error);
        // Fall back to localStorage
        selectedItems.forEach(item => {
          const itemIndex = items.findIndex(i => i.id === item.id);
          if (itemIndex !== -1) {
            // Handle metadata merging properly
            const updatedItem = {
              ...items[itemIndex],
              ...updates,
              updatedAt: new Date()
            };
            
            // Merge metadata if both exist
            if (updates.metadata && items[itemIndex].metadata) {
              updatedItem.metadata = {
                ...items[itemIndex].metadata,
                ...updates.metadata
              };
            }
            
            items[itemIndex] = updatedItem;
            console.log(`✅ Updated item: ${items[itemIndex].title}`);
          }
        });
        this.saveStoredItems(items);
      }
    } else {
      console.log('🔄 GEMINI SERVICE: Bulk updating items via localStorage for unauthenticated user');
      selectedItems.forEach(item => {
        const itemIndex = items.findIndex(i => i.id === item.id);
        if (itemIndex !== -1) {
          // Handle metadata merging properly
          const updatedItem = {
            ...items[itemIndex],
            ...updates,
            updatedAt: new Date()
          };
          
          // Merge metadata if both exist
          if (updates.metadata && items[itemIndex].metadata) {
            updatedItem.metadata = {
              ...items[itemIndex].metadata,
              ...updates.metadata
            };
          }
          
          items[itemIndex] = updatedItem;
          console.log(`✅ Updated item: ${items[itemIndex].title}`);
        }
      });
      this.saveStoredItems(items);
    }
     
         const updatedTitles = selectedItems.map(item => item.title).join(', ');
    const updateDetails = [];
    if (args.completed !== undefined) updateDetails.push(`marked ${args.completed ? 'complete' : 'incomplete'}`);
    if (args.priority !== undefined) updateDetails.push(`set to ${args.priority} priority`);
    if (args.progress !== undefined) updateDetails.push(`progress set to ${args.progress}%`);
    if (args.dueDate !== undefined) updateDetails.push(`due date changed`);
    if (args.newCategoryId !== undefined) updateDetails.push(`moved to ${args.newCategoryId} category`);
    if (args.frequency !== undefined) updateDetails.push(`frequency changed to ${args.frequency}`);
    if (args.duration !== undefined) updateDetails.push(`duration set to ${args.duration} minutes`);
    if (args.completedToday !== undefined) updateDetails.push(`marked ${args.completedToday ? 'complete' : 'incomplete'} for today`);
    
    // Add count warning if applicable
    let countWarning = '';
    if (selectedItems.length < args.count) {
      countWarning = ` (only found ${selectedItems.length} items, requested ${args.count})`;
    }
     
     return {
       success: true,
      function: 'bulkUpdateItems',
      result: { 
        updated: selectedItems.length, 
        items: selectedItems,
        message: `Updated ${selectedItems.length} ${args.type}s (${updateDetails.join(', ')}): ${updatedTitles}${countWarning}`
      }
    };
  }

    private async bulkDeleteItems(args: any) {
    console.log('🗑️ Bulk deleting items:', args);
     
     const items = this.getStoredItems();
    console.log('📦 Total items before deletion:', items.length);
    
    // Filter by type and category
    let filteredItems = items.filter(item => item.type === args.type);
    console.log(`📋 Found ${filteredItems.length} ${args.type}s to choose from`);
    
    if (args.searchTerm) {
      filteredItems = filteredItems.filter(item => 
        item.title.toLowerCase().includes(args.searchTerm.toLowerCase()) ||
        item.text.toLowerCase().includes(args.searchTerm.toLowerCase())
      );
      console.log(`📋 After search filter (${args.searchTerm}): ${filteredItems.length} items`);
    }
    
    if (args.categoryId) {
      filteredItems = filteredItems.filter(item => item.categoryId === args.categoryId);
      console.log(`📋 After category filter: ${filteredItems.length} items`);
    }
    
    // Smart quantity calculation
    let actualCount = args.count || 1;
    if (args.quantityType === 'half') {
      actualCount = Math.ceil(filteredItems.length / 2);
      console.log(`🧮 Half calculation: ${filteredItems.length} items ÷ 2 = ${actualCount}`);
    } else if (args.quantityType === 'all' || args.count === 999) {
      actualCount = filteredItems.length;
      console.log(`🧮 All calculation: ${actualCount} items`);
    }
    
    // Apply selection strategy
    let selectedItems = this.selectItems(filteredItems, actualCount, args.selection || 'random');
    console.log('🎯 Selected items for deletion:', selectedItems.map(item => item.title));
    
    // Check if no items were found
    if (selectedItems.length === 0) {
      let message = `No ${args.type}s found`;
      if (args.selection === 'complete') {
        message += ` that are completed`;
      } else if (args.selection === 'incomplete') {
        message += ` that are incomplete`;
      }
      if (args.searchTerm) {
        message += ` matching "${args.searchTerm}"`;
      }
      if (args.categoryId) {
        message += ` in ${args.categoryId} category`;
      }
      
      return {
        success: true,
        function: 'bulkDeleteItems',
        result: { 
          deleted: 0, 
          items: [],
          message: message
        }
      };
    }
    
    // Use Supabase if callbacks are available (authenticated user), otherwise localStorage
    if (this.supabaseCallbacks.deleteItem) {
      console.log('🔄 GEMINI SERVICE: Bulk deleting items via Supabase for authenticated user');
      try {
        for (const item of selectedItems) {
          await this.supabaseCallbacks.deleteItem(item.id);
          console.log(`✅ Deleted item via Supabase: ${item.title}`);
        }
        
        // Real-time subscriptions handle data updates automatically - manual refresh removed
      } catch (error) {
        console.error('❌ GEMINI SERVICE: Supabase bulkDeleteItems failed:', error);
        // Fall back to localStorage
        const remainingItems = items.filter(item => 
          !selectedItems.some(selected => selected.id === item.id)
        );
        console.log('📦 Total items after deletion:', remainingItems.length);
        this.saveStoredItems(remainingItems);
      }
    } else {
      console.log('🔄 GEMINI SERVICE: Bulk deleting items via localStorage for unauthenticated user');
      const remainingItems = items.filter(item => 
        !selectedItems.some(selected => selected.id === item.id)
      );
      console.log('📦 Total items after deletion:', remainingItems.length);
      this.saveStoredItems(remainingItems);
    }
     
     return {
       success: true,
      function: 'bulkDeleteItems',
      result: { 
        deleted: selectedItems.length, 
        items: selectedItems,
        message: `Successfully deleted ${selectedItems.length} ${args.type}s: ${selectedItems.map(item => item.title).join(', ')}`
      }
    };
  }

  private selectItems(items: Item[], count: number, selection: string): Item[] {
    switch (selection) {
      case 'oldest':
        return items
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
          .slice(0, count);
      
      case 'newest':
        return items
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, count);
      
      case 'incomplete':
        return items
          .filter(item => !item.completed)
          .slice(0, count);
      
            case 'complete':
        return items
          .filter(item => item.completed)
          .slice(0, count);
      
      case 'due_soon':
        const threeDaysFromNow = new Date();
        threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
        return items
          .filter(item => item.dueDate && item.dueDate <= threeDaysFromNow && item.dueDate >= new Date())
          .sort((a, b) => (a.dueDate?.getTime() || 0) - (b.dueDate?.getTime() || 0))
          .slice(0, count);
      
      case 'overdue':
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return items
          .filter(item => item.dueDate && item.dueDate < today && !item.completed)
          .sort((a, b) => (a.dueDate?.getTime() || 0) - (b.dueDate?.getTime() || 0))
          .slice(0, count);
      
      case 'all':
        return items.slice(0, count);
      
      case 'random':
       default:
        // Shuffle array and take first 'count' items
        const shuffled = [...items].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, count);
    }
  }

  private async searchItems(args: any) {
    const items = this.getStoredItems();
    const results = items.filter(item => {
      // More flexible query matching - check for partial words and related terms
      const matchesQuery = !args.query || (() => {
        const query = args.query.toLowerCase();
        const title = item.title.toLowerCase();
        const text = item.text.toLowerCase();
        
        // Direct match
        if (title.includes(query) || text.includes(query)) return true;
        
        // Word-by-word matching
        const queryWords = query.split(' ').filter((w: string) => w.length > 2);
        return queryWords.some((word: string) => 
          title.includes(word) || text.includes(word) ||
          // Related terms
          (word === 'cooking' && (title.includes('recipe') || title.includes('meal') || title.includes('food'))) ||
          (word === 'workout' && (title.includes('exercise') || title.includes('fitness') || title.includes('training')))
        );
      })();
      
      const matchesType = !args.type || item.type === args.type;
      const matchesCategory = !args.categoryId || item.categoryId === args.categoryId;
      const matchesCompleted = args.completed === undefined || item.completed === args.completed;
      
      // Progress filtering for goals
      let matchesProgress = true;
      if (args.minProgress !== undefined || args.maxProgress !== undefined) {
        const progress = item.metadata?.progress || 0;
        if (args.minProgress !== undefined && progress < args.minProgress) matchesProgress = false;
        if (args.maxProgress !== undefined && progress > args.maxProgress) matchesProgress = false;
      }
      
      return matchesQuery && matchesType && matchesCategory && matchesCompleted && matchesProgress;
    });
    
    // Create detailed message about search results
    const typeText = args.type ? `${args.type}s` : 'items';
    const queryText = args.query ? ` matching "${args.query}"` : '';
    const categoryText = args.categoryId ? ` in ${args.categoryId} category` : '';
    
    let message = `Found ${results.length} ${typeText}${queryText}${categoryText}`;
    if (results.length > 0) {
      const itemList = results.map(item => {
        const progress = item.metadata?.progress ? ` (${item.metadata.progress}% complete)` : '';
        const category = item.categoryId ? ` [${item.categoryId}]` : '';
        
        // Add routine-specific metadata
        let routineInfo = '';
        if (item.type === 'routine') {
          const frequency = item.metadata?.frequency || 'daily';
          const duration = item.metadata?.duration || 0;
          const currentStreak = item.metadata?.currentStreak || 0;
          const bestStreak = item.metadata?.bestStreak || 0;
          const completedToday = item.metadata?.completedToday ? 'completed today' : 'not completed today';
          
          routineInfo = ` (${frequency}, ${duration}min, streak: ${currentStreak}, best: ${bestStreak}, ${completedToday})`;
        }
        
        // Add note-specific metadata
        let noteInfo = '';
        if (item.type === 'note') {
          const tags = item.metadata?.tags && item.metadata.tags.length > 0 ? ` tags: [${item.metadata.tags.join(', ')}]` : '';
          const hasImage = item.metadata?.hasImage ? ' has image' : '';
          const imageUrl = item.metadata?.imageUrl ? ` (${item.metadata.imageUrl})` : '';
          
          if (tags || hasImage) {
            noteInfo = ` (${tags}${hasImage}${imageUrl})`.replace('( ', '(');
          }
        }
        
        return `"${item.title}"${progress}${routineInfo}${noteInfo}${category}`;
      }).join('\n');
      message += `:\n${itemList}`;
    } else {
      // Provide helpful suggestions when no results found
      const allItemsOfType = items.filter(item => !args.type || item.type === args.type);
      const availableCategories = Array.from(new Set(allItemsOfType.map(item => item.categoryId))).sort();
      
      if (args.categoryId && availableCategories.length > 0) {
        message += `.\n\nAvailable categories for ${args.type || 'items'}: ${availableCategories.join(', ')}`;
      } else if (args.query && allItemsOfType.length > 0) {
        const sampleItems = allItemsOfType.slice(0, 3).map(item => `"${item.title}"`).join(', ');
        message += `.\n\nSample ${args.type || 'items'}: ${sampleItems}`;
      }
    }
    
    return {
      success: true,
      function: 'searchItems',
      result: { 
        found: results.length, 
        items: results,
        message: message
      }
    };
  }

  // Helper method to get current items with comprehensive debugging
  private getCurrentItems(): Item[] {
    console.log('🔍 GEMINI SERVICE: getCurrentItems() called');
    console.log('📊 this.currentItems.length:', this.currentItems.length);
    console.log('📊 Supabase callbacks available:', Object.keys(this.supabaseCallbacks).length > 0);
    
    // Use current items from Supabase/context if available (authenticated users)
    if (this.currentItems.length > 0) {
      console.log('✅ GEMINI SERVICE: Using current items from Supabase context:', this.currentItems.length);
      console.log('📋 Sample items:', this.currentItems.slice(0, 3).map(item => `"${item.title}" (${item.type})`));
      return this.currentItems;
    }
    
    // Fall back to localStorage for unauthenticated users or when no current items
    console.log('⚠️ GEMINI SERVICE: currentItems empty, falling back to localStorage');
    try {
      const savedItems = localStorage.getItem('lifeStructureItems');
      if (!savedItems) {
        console.log('❌ GEMINI SERVICE: No localStorage data found');
        return [];
      }
      
      const parsedItems = JSON.parse(savedItems);
      const items = parsedItems.map((item: any) => ({
        ...item,
        createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
        updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
        dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
        dateTime: item.dateTime ? new Date(item.dateTime) : undefined
      }));
      console.log('📊 GEMINI SERVICE: Using localStorage items:', items.length);
      console.log('📋 Sample localStorage items:', items.slice(0, 3).map((item: Item) => `"${item.title}" (${item.type})`));
      return items;
    } catch (error) {
      console.error('❌ Error loading items from localStorage:', error);
      return [];
    }
  }

  // Helper methods for localStorage and current items (legacy compatibility)
  private getStoredItems(): Item[] {
    return this.getCurrentItems();
  }

  private saveStoredItems(items: Item[]): void {
    try {
      localStorage.setItem('lifeStructureItems', JSON.stringify(items));
      console.log('💾 Saved', items.length, 'items to localStorage');
      
      // Dispatch custom event for real-time UI updates
      window.dispatchEvent(new CustomEvent('itemsModified', {
        detail: { items, timestamp: Date.now() }
      }));
      console.log('📡 Dispatched itemsModified event for real-time updates');
    } catch (error) {
      console.error('❌ Failed to save items to localStorage:', error);
    }
  }

  private generateUniqueId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private parseDateTime(dateStr: string, timeStr?: string): string | undefined {
    if (!dateStr) return undefined;
    
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    
    // Handle relative dates
    if (dateStr.toLowerCase().includes('tomorrow')) {
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
      dateStr = tomorrow.toISOString().split('T')[0];
    } else if (dateStr.toLowerCase().includes('next week')) {
      const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      dateStr = nextWeek.toISOString().split('T')[0];
    } else if (dateStr.toLowerCase().includes('thursday') || dateStr.toLowerCase().includes('next thursday')) {
      const daysUntilThursday = (4 - today.getDay() + 7) % 7 || 7; // 4 = Thursday
      const nextThursday = new Date(today.getTime() + daysUntilThursday * 24 * 60 * 60 * 1000);
      dateStr = nextThursday.toISOString().split('T')[0];
    }
    
    // Handle numbered dates like "20th", "24th"
    const dayMatch = dateStr.match(/(\d{1,2})(st|nd|rd|th)/);
    if (dayMatch) {
      const day = parseInt(dayMatch[1]);
      // Check if the date has already passed this month, if so use next month
      const targetDate = new Date(currentYear, currentMonth, day);
      if (targetDate < today) {
        // Date has passed, use next month
        const nextMonth = currentMonth + 1;
        const nextYear = nextMonth > 11 ? currentYear + 1 : currentYear;
        const adjustedMonth = nextMonth > 11 ? 0 : nextMonth;
        dateStr = `${nextYear}-${String(adjustedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      } else {
        // Date hasn't passed, use current month
        dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }
    
    // Handle "June 20th" style dates
    const monthDayMatch = dateStr.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})/i);
    if (monthDayMatch) {
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const monthIndex = months.findIndex(m => m.toLowerCase() === monthDayMatch[1].toLowerCase());
      const day = parseInt(monthDayMatch[2]);
      dateStr = `${currentYear}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    
    // Parse time
    let timeString = '00:00:00';
    if (timeStr) {
      // Handle "10am", "2pm", "14:30", etc.
      const timeMatch = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
      if (timeMatch) {
        let hours = parseInt(timeMatch[1]);
        const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
        const ampm = timeMatch[3]?.toLowerCase();
        
        if (ampm === 'pm' && hours !== 12) {
          hours += 12;
        } else if (ampm === 'am' && hours === 12) {
          hours = 0;
        }
        
        timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
      }
    }
    
    return `${dateStr}T${timeString}`;
  }

  // Strip only problematic markdown symbols, preserve useful formatting
  private stripMarkdownSymbols(text: string): string {
    if (!text) return text;
    
    return text
      .replace(/\*{3,}/g, '') // Remove triple+ asterisks (but keep single/double for emphasis)
      .replace(/#{3,}/g, '') // Remove triple+ headers (but keep ## for sections)
      .replace(/---+/g, '') // Remove long dividers
      .replace(/~~~/g, '') // Remove strikethrough
      // PRESERVE: bullet points (-), numbered lists, basic formatting
      // PRESERVE: line breaks and spacing for readability
      .replace(/\s{3,}/g, '  ') // Normalize excessive whitespace but keep double spaces
      .trim();
  }

  // Execute multiple different update operations
  private async executeMultipleUpdates(updatesJson: string): Promise<any> {
    try {
      const updates = JSON.parse(updatesJson);
      const results = [];
      
      for (const update of updates) {
        try {
          const result = await this.updateItem(update);
          results.push(result);
        } catch (error) {
          results.push({
            success: false,
            itemId: update.itemId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
      
      return {
        success: true,
        function: 'executeMultipleUpdates',
        result: {
          totalUpdates: updates.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
          results: results
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to parse updates JSON: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Remove asterisks from a specific item
  private async removeAsterisks(itemId: string): Promise<any> {
    const items = this.getStoredItems();
    
    // Find the item by ID or name
    let itemIndex = items.findIndex(item => item.id === itemId);
    
    // If not found by ID, try name matching
    if (itemIndex === -1) {
      const cleanSearchTerm = (term: string) => {
        return term.toLowerCase().replace(/\b(todo|goal|event|routine|note|item|task)\b/g, '').replace(/\s+/g, ' ').trim();
      };
      
      const searchTerm = cleanSearchTerm(itemId);
      itemIndex = items.findIndex(item => 
        cleanSearchTerm(item.title).includes(searchTerm) || 
        searchTerm.includes(cleanSearchTerm(item.title))
      );
    }
    
    if (itemIndex === -1) {
      return {
        success: false,
        message: `Item not found: ${itemId}`
      };
    }
    
    const originalItem = items[itemIndex];
    const currentText = originalItem.text || '';
    const cleanedText = this.stripMarkdownSymbols(currentText);
    
    const updatedItem = {
      ...originalItem,
      text: cleanedText,
      updatedAt: new Date()
    };

    // Use Supabase if callbacks are available (authenticated user), otherwise localStorage
    if (this.supabaseCallbacks.updateItem) {
      console.log('🔄 GEMINI SERVICE: Removing asterisks via Supabase for authenticated user');
      try {
        const supabaseItem = await this.supabaseCallbacks.updateItem(originalItem.id, updatedItem);
        // Real-time subscriptions handle data updates automatically - manual refresh removed
        
        return {
          success: true,
          function: 'removeAsterisks',
          result: {
            item: supabaseItem || updatedItem,
            message: `Removed all asterisks and symbols from "${updatedItem.title}"`
          }
        };
      } catch (error) {
        console.error('❌ GEMINI SERVICE: Supabase removeAsterisks failed:', error);
        // Fall back to localStorage
        items[itemIndex] = updatedItem;
        this.saveStoredItems(items);
        
        return {
          success: true,
          function: 'removeAsterisks',
          result: {
            item: updatedItem,
            message: `Removed all asterisks and symbols from "${updatedItem.title}" (saved locally due to sync error)`
          }
        };
      }
    } else {
      console.log('🔄 GEMINI SERVICE: Removing asterisks via localStorage for unauthenticated user');
      items[itemIndex] = updatedItem;
      this.saveStoredItems(items);
      
      return {
        success: true,
        function: 'removeAsterisks',
        result: {
          item: updatedItem,
          message: `Removed all asterisks and symbols from "${updatedItem.title}"`
        }
      };
    }
  }

  // Consolidate duplicate items
  private async consolidateItems(searchQuery: string, itemType: string): Promise<any> {
    console.log('🔄 Consolidating items:', { searchQuery, itemType });
    
    const items = this.getStoredItems();
    const filteredItems = items.filter(item => 
      item.type === itemType && 
      item.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    if (filteredItems.length <= 1) {
      return {
        success: false,
        function: 'consolidateItems',
        result: { message: `Found ${filteredItems.length} items matching "${searchQuery}" - need at least 2 to consolidate` }
      };
    }
    
    // Combine all text content
    const combinedText = filteredItems.map(item => item.text).filter(text => text).join('\n\n');
    const consolidatedTitle = `Consolidated ${searchQuery} ${itemType}`;
    
    // Create new consolidated item
    const consolidatedItem: Item = {
      id: this.generateUniqueId(),
      title: consolidatedTitle,
      text: combinedText,
      type: itemType as any,
      categoryId: filteredItems[0].categoryId,
      completed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        priority: 'medium',
        aiGenerated: true,
        ...{ consolidatedFrom: filteredItems.map(item => item.title) }
      }
    };
    
    // Use Supabase if callbacks are available (authenticated user), otherwise localStorage
    if (this.supabaseCallbacks.deleteItem && this.supabaseCallbacks.createItem) {
      console.log('🔄 GEMINI SERVICE: Consolidating items via Supabase for authenticated user');
      try {
        // First delete all the original items
        for (const item of filteredItems) {
          await this.supabaseCallbacks.deleteItem(item.id);
          console.log(`✅ Deleted original item via Supabase: ${item.title}`);
        }
        
        // Then create the consolidated item
        const supabaseItem = await this.supabaseCallbacks.createItem(consolidatedItem);
        // Real-time subscriptions handle data updates automatically - manual refresh removed
        
        return {
          success: true,
          function: 'consolidateItems',
          result: { 
            message: `Consolidated ${filteredItems.length} items into "${consolidatedTitle}"`,
            consolidatedItem: supabaseItem || consolidatedItem,
            removedItems: filteredItems.length
          }
        };
      } catch (error) {
        console.error('❌ GEMINI SERVICE: Supabase consolidateItems failed:', error);
        // Fall back to localStorage
        const remainingItems = items.filter(item => !filteredItems.some(fi => fi.id === item.id));
        remainingItems.push(consolidatedItem);
        this.saveStoredItems(remainingItems);
        
        return {
          success: true,
          function: 'consolidateItems',
          result: { 
            message: `Consolidated ${filteredItems.length} items into "${consolidatedTitle}" (saved locally due to sync error)`,
            consolidatedItem,
            removedItems: filteredItems.length
          }
        };
      }
    } else {
      console.log('🔄 GEMINI SERVICE: Consolidating items via localStorage for unauthenticated user');
      const remainingItems = items.filter(item => !filteredItems.some(fi => fi.id === item.id));
      remainingItems.push(consolidatedItem);
      this.saveStoredItems(remainingItems);
      
      return {
        success: true,
        function: 'consolidateItems',
        result: { 
          message: `Consolidated ${filteredItems.length} items into "${consolidatedTitle}"`,
          consolidatedItem,
          removedItems: filteredItems.length
        }
      };
    }
  }

  private async copyRoutineFromPerson(args: any): Promise<any> {
    console.log('👤 Copying routine from person:', args);
    
    // const items = this.getStoredItems(); // TODO: Use for routine lookup
    const personName = args.personName;
    const routineType = args.routineType || 'daily';
    const startDate = args.startDate || new Date().toISOString().split('T')[0];
    const duration = args.duration || 30;
    
    // Dynamic routine generation based on person's profession/characteristics
    const routine = this.generatePersonRoutine(personName, routineType);
    
    return this.createRoutineEvents(routine, personName, startDate, duration);
  }

  private generatePersonRoutine(personName: string, routineType: string): any[] {
    const name = personName.toLowerCase();
    
    // Determine person type and generate appropriate routine
    let personType = 'general';
    let characteristics: string[] = [];
    
    // Athletes
    if (name.includes('curry') || name.includes('lebron') || name.includes('jordan') || 
        name.includes('messi') || name.includes('ronaldo') || name.includes('serena')) {
      personType = 'athlete';
      characteristics = ['early_riser', 'fitness_focused', 'disciplined', 'competitive'];
    }
    // Entrepreneurs/CEOs
    else if (name.includes('musk') || name.includes('bezos') || name.includes('cook') || 
             name.includes('gates') || name.includes('jobs') || name.includes('zuckerberg')) {
      personType = 'ceo';
      characteristics = ['early_riser', 'strategic_thinker', 'workaholic', 'innovative'];
    }
    // Fitness/Military
    else if (name.includes('goggins') || name.includes('jocko') || name.includes('cameron')) {
      personType = 'military_fitness';
      characteristics = ['extreme_early_riser', 'ultra_disciplined', 'physical_intense', 'mental_tough'];
    }
    // Artists/Creators
    else if (name.includes('swift') || name.includes('beyonce') || name.includes('kanye') || 
             name.includes('oprah') || name.includes('rogan')) {
      personType = 'creator';
      characteristics = ['creative', 'flexible_schedule', 'people_focused', 'expressive'];
    }
    // Scientists/Intellectuals
    else if (name.includes('einstein') || name.includes('hawking') || name.includes('curie') || 
             name.includes('tesla') || name.includes('feynman')) {
      personType = 'intellectual';
      characteristics = ['deep_thinker', 'research_focused', 'curious', 'methodical'];
    }

    return this.buildRoutineFromCharacteristics(personType, characteristics, routineType);
  }

  private buildRoutineFromCharacteristics(personType: string, characteristics: string[], routineType: string): any[] {
    const routine = [];
    
    // Base wake up time based on characteristics
    let wakeTime = '06:00';
    if (characteristics.includes('extreme_early_riser')) wakeTime = '04:30';
    else if (characteristics.includes('early_riser')) wakeTime = '05:30';
    else if (characteristics.includes('flexible_schedule')) wakeTime = '07:00';
    
    // Morning routine
    routine.push({
      time: wakeTime,
      title: 'Morning Awakening',
      description: 'Start the day with intention and energy',
      duration: 15,
      category: 'self-regulation'
    });
    
    // Spiritual/Mental preparation
    if (characteristics.includes('disciplined') || characteristics.includes('mental_tough')) {
      const nextTime = this.addMinutes(wakeTime, 15);
      routine.push({
        time: nextTime,
        title: 'Mental Preparation & Meditation',
        description: 'Mindfulness practice and mental conditioning',
        duration: 20,
        category: 'catholicism'
      });
    }
    
    // Physical activity based on person type
    let workoutTime = this.addMinutes(wakeTime, characteristics.includes('disciplined') ? 35 : 15);
    let workoutDuration = 60;
    let workoutTitle = 'Physical Training';
    let workoutDesc = 'Maintain physical fitness and health';
    
    if (personType === 'athlete') {
      workoutDuration = 120;
      workoutTitle = 'Sport-Specific Training';
      workoutDesc = 'Elite athletic training and skill development';
    } else if (personType === 'military_fitness') {
      workoutDuration = 90;
      workoutTitle = 'Intense Physical Conditioning';
      workoutDesc = 'High-intensity training for mental and physical toughness';
    }
    
    routine.push({
      time: workoutTime,
      title: workoutTitle,
      description: workoutDesc,
      duration: workoutDuration,
      category: 'gym-calisthenics'
    });
    
    // Nutrition
    const breakfastTime = this.addMinutes(workoutTime, workoutDuration);
    routine.push({
      time: breakfastTime,
      title: 'Nutritional Fuel',
      description: 'Optimal nutrition for peak performance',
      duration: 30,
      category: 'self-regulation'
    });
    
    // Core work activity based on person type
    const workStartTime = this.addMinutes(breakfastTime, 30);
    let workDuration = 240; // 4 hours
    let workTitle = 'Deep Work Session';
    let workDesc = 'Focused work on priority objectives';
    let workCategory = 'mobile-apps';
    
    if (personType === 'athlete') {
      workTitle = 'Skill Development & Strategy';
      workDesc = 'Technical training and game strategy analysis';
      workCategory = 'content';
    } else if (personType === 'creator') {
      workTitle = 'Creative Production';
      workDesc = 'Creative work and artistic expression';
      workCategory = 'content';
    } else if (personType === 'intellectual') {
      workTitle = 'Research & Analysis';
      workDesc = 'Deep research and intellectual exploration';
      workCategory = 'content';
    }
    
    routine.push({
      time: workStartTime,
      title: workTitle,
      description: workDesc,
      duration: workDuration,
      category: workCategory
    });
    
    // Afternoon activities
    const lunchTime = this.addMinutes(workStartTime, workDuration);
    routine.push({
      time: lunchTime,
      title: 'Midday Nutrition & Rest',
      description: 'Healthy meal and mental break',
      duration: 60,
      category: 'self-regulation'
    });
    
    // Secondary work/training block
    const afternoonTime = this.addMinutes(lunchTime, 60);
    if (personType === 'athlete' || personType === 'military_fitness') {
      routine.push({
        time: afternoonTime,
        title: 'Secondary Training Block',
        description: 'Additional training focusing on weaknesses',
        duration: 90,
        category: 'gym-calisthenics'
      });
    } else {
      routine.push({
        time: afternoonTime,
        title: 'Collaborative Work & Meetings',
        description: 'Team collaboration and strategic discussions',
        duration: 120,
        category: personType === 'creator' ? 'social-charisma' : 'mobile-apps'
      });
    }
    
    // Evening activities
    const eveningTime = '18:00';
    if (characteristics.includes('people_focused')) {
      routine.push({
        time: eveningTime,
        title: 'Social Connection & Networking',
        description: 'Building relationships and community',
        duration: 120,
        category: 'social-charisma'
      });
    } else {
      routine.push({
        time: eveningTime,
        title: 'Personal Development',
        description: 'Learning, reading, and self-improvement',
        duration: 90,
        category: 'content'
      });
    }
    
    // Wind down
    routine.push({
      time: '20:30',
      title: 'Evening Reflection & Recovery',
      description: 'Daily review, planning, and preparation for rest',
      duration: 60,
      category: 'self-regulation'
    });
    
    return routine;
  }

  private addMinutes(timeStr: string, minutes: number): string {
    const [hours, mins] = timeStr.split(':').map(Number);
    const totalMinutes = hours * 60 + mins + minutes;
    const newHours = Math.floor(totalMinutes / 60) % 24;
    const newMins = totalMinutes % 60;
    return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
  }

  private async createRoutineEvents(routine: any[], personName: string, startDate: string, duration: number): Promise<any> {
    const items = this.getStoredItems();
    const createdEvents: Item[] = [];
    
    // Enhanced category mapping for different activities
    const getCategoryForActivity = (activityTitle: string): string => {
      const title = activityTitle.toLowerCase();
      if (title.includes('prayer') || title.includes('meditation') || title.includes('spiritual')) return 'catholicism';
      if (title.includes('workout') || title.includes('gym') || title.includes('exercise') || title.includes('run') || title.includes('training')) return 'gym-calisthenics';
      if (title.includes('work') || title.includes('email') || title.includes('meeting') || title.includes('planning') || title.includes('strategy')) return 'mobile-apps';
      if (title.includes('study') || title.includes('film') || title.includes('analysis') || title.includes('learning') || title.includes('reading')) return 'content';
      if (title.includes('family') || title.includes('social') || title.includes('friends') || title.includes('networking')) return 'social-charisma';
      return 'self-regulation';
    };
    
    for (let day = 0; day < duration; day++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(currentDate.getDate() + day);
      const dateStr = currentDate.toISOString().split('T')[0];
      
      for (const activity of routine) {
        const startTime = `${dateStr}T${activity.time}:00`;
        const endTime = new Date(new Date(startTime).getTime() + activity.duration * 60 * 1000).toISOString();
        const activityCategory = getCategoryForActivity(activity.title);
        
        // Create more descriptive titles and descriptions
        const cleanTitle = activity.title.replace(/^(wake up at|check|review)/i, '').trim();
        const enhancedTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
        const enhancedDescription = activity.description || `${personName}'s routine: ${activity.title}`;
        
        const event: Item = {
          id: this.generateUniqueId(),
          title: enhancedTitle,
          text: enhancedDescription,
          type: 'event',
          categoryId: activityCategory,
          completed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          dateTime: new Date(startTime),
          metadata: {
            priority: 'medium',
            aiGenerated: true,
            startTime: new Date(startTime),
            endTime: new Date(endTime),
            duration: activity.duration,
            ...{ routineSource: personName },
            ...{ isRoutineEvent: true }
          }
        };
        
        createdEvents.push(event);
        items.push(event);
      }
    }
    
    // Use Supabase if callbacks are available (authenticated user), otherwise localStorage
    if (this.supabaseCallbacks.bulkCreateItems) {
      console.log('🔄 GEMINI SERVICE: Creating routine events via Supabase for authenticated user');
      try {
        const supabaseEvents = await this.supabaseCallbacks.bulkCreateItems(createdEvents);
        // Real-time subscriptions handle data updates automatically - manual refresh removed
        
        return {
          success: true,
          function: 'copyRoutineFromPerson',
          result: {
            message: `✅ Created ${createdEvents.length} routine events from ${personName} for ${duration} days`,
            eventsCreated: createdEvents.length,
            personName,
            events: supabaseEvents || createdEvents
          }
        };
      } catch (error) {
        console.error('❌ GEMINI SERVICE: Supabase bulk create failed, falling back to localStorage:', error);
        items.push(...createdEvents);
        this.saveStoredItems(items);
        
        return {
          success: true,
          function: 'copyRoutineFromPerson',
          result: {
            message: `✅ Created ${createdEvents.length} routine events from ${personName} for ${duration} days (saved locally due to sync error)`,
            eventsCreated: createdEvents.length,
            personName,
            events: createdEvents,
            fallbackUsed: true
          }
        };
      }
    } else {
      console.log('🔄 GEMINI SERVICE: Creating routine events via localStorage for unauthenticated user');
      items.push(...createdEvents);
      this.saveStoredItems(items);
      
      return {
        success: true,
        function: 'copyRoutineFromPerson',
        result: {
          message: `✅ Created ${createdEvents.length} events based on ${personName}'s routine for ${duration} days`,
          eventsCreated: createdEvents.length,
          person: personName,
          duration: duration,
          categoriesUsed: Array.from(new Set(createdEvents.map((e: any) => e.categoryId))),
          dailyActivities: routine.length
        }
      };
    }
  }

  private async generateFullDaySchedule(args: any): Promise<any> {
    console.log('📅 Generating full day schedule:', args);
    
    const items = this.getStoredItems();
    
    // SMART AUTO-FILL: Auto-generate missing parameters
    const today = new Date();
    const weekLater = new Date(today);
    weekLater.setDate(weekLater.getDate() + 7);
    
    const startDate = args.startDate || today.toISOString().split('T')[0];
    const endDate = args.endDate || weekLater.toISOString().split('T')[0];
    const workingHours = args.workingHours || '9am-5pm';
    const intensity = args.intensity || 'moderate';
    
    console.log('📅 Auto-filled parameters:', { startDate, endDate, workingHours, intensity });
    
    // Get existing routines to incorporate
    const existingRoutines = items.filter(item => item.type === 'routine');
    const existingGoals = items.filter(item => item.type === 'goal' && !item.completed);
    
    const createdEvents: Item[] = [];
    const currentDate = new Date(startDate);
    const endDateObj = new Date(endDate);
    
    while (currentDate <= endDateObj) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayEvents = this.generateDaySchedule(dateStr, existingRoutines, existingGoals, workingHours, intensity);
      
      for (const event of dayEvents) {
        const newEvent: Item = {
          id: this.generateUniqueId(),
          title: event.title,
          text: event.description,
          type: 'event',
          categoryId: event.category,
          completed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          dateTime: new Date(event.startTime),
          metadata: {
            priority: 'medium',
            aiGenerated: true,
            startTime: new Date(event.startTime),
            endTime: new Date(event.endTime),
            duration: event.duration,
            ...{ scheduleGenerated: true }
          }
        };
        
        createdEvents.push(newEvent);
        items.push(newEvent);
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Use Supabase if callbacks are available (authenticated user), otherwise localStorage
    if (this.supabaseCallbacks.bulkCreateItems) {
      console.log('🔄 GEMINI SERVICE: Creating full day schedule via Supabase for authenticated user');
      try {
        const supabaseEvents = await this.supabaseCallbacks.bulkCreateItems(createdEvents);
        // Real-time subscriptions will handle data refresh automatically
        // Removed manual refreshData call to prevent accidental data clearing
        
        return {
          success: true,
          function: 'generateFullDaySchedule',
          result: {
            message: `Generated full schedule with ${createdEvents.length} events`,
            eventsCreated: createdEvents.length,
            events: supabaseEvents || createdEvents
          }
        };
      } catch (error) {
        console.error('❌ GEMINI SERVICE: Supabase bulk create failed, falling back to localStorage:', error);
        items.push(...createdEvents);
        this.saveStoredItems(items);
        
        return {
          success: true,
          function: 'generateFullDaySchedule',
          result: {
            message: `Generated full schedule with ${createdEvents.length} events (saved locally due to sync error)`,
            eventsCreated: createdEvents.length,
            events: createdEvents,
            fallbackUsed: true
          }
        };
      }
    } else {
      console.log('🔄 GEMINI SERVICE: Creating full day schedule via localStorage for unauthenticated user');
      items.push(...createdEvents);
      this.saveStoredItems(items);
      
      return {
        success: true,
        function: 'generateFullDaySchedule',
        result: {
          message: `Generated full schedule with ${createdEvents.length} events`,
          eventsCreated: createdEvents.length,
          dateRange: `${startDate} to ${endDate}`,
          events: createdEvents
        }
      };
    }
  }

  private generateDaySchedule(date: string, routines: Item[], goals: Item[], workingHours: string, intensity: string): any[] {
    const schedule = [];
    
    // Morning routine (6:00-8:00)
    schedule.push({
      title: 'Morning Routine',
      description: 'Start the day with energy and focus',
      startTime: `${date}T06:00:00`,
      endTime: `${date}T08:00:00`,
      duration: 120,
      category: 'self-regulation'
    });
    
    // Work block based on working hours
    if (workingHours.includes('9am-5pm')) {
      schedule.push({
        title: 'Deep Work Session',
        description: 'Focused work on priority tasks',
        startTime: `${date}T09:00:00`,
        endTime: `${date}T12:00:00`,
        duration: 180,
        category: 'mobile-apps'
      });
      
      schedule.push({
        title: 'Lunch Break',
        description: 'Healthy meal and mental break',
        startTime: `${date}T12:00:00`,
        endTime: `${date}T13:00:00`,
        duration: 60,
        category: 'self-regulation'
      });
      
      schedule.push({
        title: 'Afternoon Work',
        description: 'Meetings and collaborative work',
        startTime: `${date}T13:00:00`,
        endTime: `${date}T17:00:00`,
        duration: 240,
        category: 'mobile-apps'
      });
    }
    
    // Workout time
    schedule.push({
      title: 'Workout Session',
      description: 'Physical fitness and health',
      startTime: `${date}T17:30:00`,
      endTime: `${date}T18:30:00`,
      duration: 60,
      category: 'gym-calisthenics'
    });
    
    // Evening routine
    schedule.push({
      title: 'Evening Wind Down',
      description: 'Reflection, planning, and relaxation',
      startTime: `${date}T20:00:00`,
      endTime: `${date}T21:00:00`,
      duration: 60,
      category: 'self-regulation'
    });
    
    return schedule;
  }

  private async createCalendarFromNotes(args: any): Promise<any> {
    console.log('📚 Creating calendar from notes:', args);
    
    const items = this.getStoredItems();
    const notes = items.filter(item => item.type === 'note');
    const startDate = args.startDate;
    const duration = args.duration || 45;
    const sessionLength = args.sessionLength || 60;
    const frequency = args.frequency || 'daily';
    
    if (notes.length === 0) {
      return {
        success: false,
        function: 'createCalendarFromNotes',
        result: { message: 'No notes found to create calendar from' }
      };
    }
    
    // Extract learning topics from notes
    const learningTopics = this.extractLearningTopics(notes, args.focusAreas);
    const createdEvents: Item[] = [];
    
    let currentDate = new Date(startDate);
    let topicIndex = 0;
    
    for (let day = 0; day < duration; day++) {
      if (this.shouldScheduleOnDay(currentDate, frequency)) {
        const topic = learningTopics[topicIndex % learningTopics.length];
        const dateStr = currentDate.toISOString().split('T')[0];
        const startTime = `${dateStr}T09:00:00`; // Default to 9 AM
        const endTime = new Date(new Date(startTime).getTime() + sessionLength * 60 * 1000).toISOString();
        
        const event: Item = {
          id: this.generateUniqueId(),
          title: `Study: ${topic.title}`,
          text: `Learning session: ${topic.description}`,
          type: 'event',
          categoryId: topic.category,
          completed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          dateTime: new Date(startTime),
          metadata: {
            priority: 'medium',
            aiGenerated: true,
            startTime: new Date(startTime),
            endTime: new Date(endTime),
            duration: sessionLength,
            ...{ learningTopic: topic.title, sourceNotes: topic.sourceNotes }
          }
        };
        
        createdEvents.push(event);
        items.push(event);
        topicIndex++;
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Use Supabase if callbacks are available (authenticated user), otherwise localStorage
    if (this.supabaseCallbacks.bulkCreateItems) {
      console.log('🔄 GEMINI SERVICE: Creating calendar from notes via Supabase for authenticated user');
      try {
        const supabaseEvents = await this.supabaseCallbacks.bulkCreateItems(createdEvents);
        // Real-time subscriptions handle data updates automatically - manual refresh removed
        
        return {
          success: true,
          function: 'createCalendarFromNotes',
          result: {
            message: `Created ${createdEvents.length} learning sessions from ${notes.length} notes`,
            eventsCreated: createdEvents.length,
            events: supabaseEvents || createdEvents
          }
        };
      } catch (error) {
        console.error('❌ GEMINI SERVICE: Supabase bulk create failed, falling back to localStorage:', error);
        items.push(...createdEvents);
        this.saveStoredItems(items);
        
        return {
          success: true,
          function: 'createCalendarFromNotes',
          result: {
            message: `Created ${createdEvents.length} learning sessions from ${notes.length} notes (saved locally due to sync error)`,
            eventsCreated: createdEvents.length,
            events: createdEvents,
            fallbackUsed: true
          }
        };
      }
    } else {
      console.log('🔄 GEMINI SERVICE: Creating calendar from notes via localStorage for unauthenticated user');
      items.push(...createdEvents);
      this.saveStoredItems(items);
      
      return {
        success: true,
        function: 'createCalendarFromNotes',
        result: {
          message: `Created ${createdEvents.length} learning sessions from ${notes.length} notes`,
          eventsCreated: createdEvents.length,
          topicsFound: learningTopics.length,
          events: createdEvents
        }
      };
    }
  }

  private extractLearningTopics(notes: Item[], focusAreas?: string): any[] {
    const topics = [];
    
    for (const note of notes) {
      // Extract key concepts from note content
      const content = note.text || '';
      const title = note.title;
      
      // Simple topic extraction - look for headers, bullet points, etc.
      const lines = content.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        if (line.includes('•') || line.includes('-') || line.includes('*')) {
          const topic = line.replace(/[•\-*]/g, '').trim();
          if (topic.length > 10) {
            topics.push({
              title: topic.substring(0, 50),
              description: `Study and practice: ${topic}`,
              category: note.categoryId,
              sourceNotes: [note.title]
            });
          }
        }
      }
      
      // If no bullet points found, use the note title as a topic
      if (topics.length === 0) {
        topics.push({
          title: title,
          description: `Review and study: ${title}`,
          category: note.categoryId,
          sourceNotes: [title]
        });
      }
    }
    
    return topics.slice(0, 20); // Limit to 20 topics
  }

  private shouldScheduleOnDay(date: Date, frequency: string): boolean {
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
    
    switch (frequency) {
      case 'daily':
        return true;
      case 'weekdays':
        return dayOfWeek >= 1 && dayOfWeek <= 5;
      case 'every-other-day':
        return Math.floor(date.getTime() / (24 * 60 * 60 * 1000)) % 2 === 0;
      case 'weekly':
        return dayOfWeek === 1; // Mondays only
      default:
        return true;
    }
  }

  private async createRecurringEvent(args: any): Promise<any> {
    console.log('🔄 Creating recurring event:', args);
    
    try {
      const items = this.getStoredItems();
      const createdEvents: Item[] = [];
      const startDate = new Date(args.startDateTime);
      const endDate = args.recurrenceEndDate ? new Date(args.recurrenceEndDate) : new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000); // Default 1 year
      
      // Calculate duration if endDateTime is provided
      let duration = 60; // Default 1 hour
      if (args.endDateTime) {
        const endTime = new Date(args.endDateTime);
        duration = Math.round((endTime.getTime() - startDate.getTime()) / (1000 * 60));
      }
      
      // Enhanced category mapping
      let categoryId = args.categoryId;
      if (categoryId) {
        categoryId = this.mapToExistingCategory(categoryId);
      }
      
      let currentDate = new Date(startDate);
      let occurrenceCount = 0;
      const maxOccurrences = 100;
      const recurrenceId = this.generateUniqueId();
      
      while (currentDate <= endDate && occurrenceCount < maxOccurrences) {
        const eventStartTime = new Date(currentDate);
        const eventEndTime = new Date(eventStartTime.getTime() + duration * 60 * 1000);
        
        const event: Item = {
          id: this.generateUniqueId(),
          title: args.title,
          text: args.text || '',
          type: 'event',
          categoryId: categoryId || 'self-regulation',
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
            isRecurring: true,
            recurrencePattern: args.recurrencePattern,
            recurrenceInterval: args.recurrenceInterval || 1,
            recurrenceId: recurrenceId,
            occurrenceNumber: occurrenceCount + 1,
            ...(args.location && { location: args.location })
          }
        };
        
        createdEvents.push(event);
        occurrenceCount++;
        
        // Calculate next occurrence
        switch (args.recurrencePattern) {
          case 'daily':
            currentDate.setDate(currentDate.getDate() + (args.recurrenceInterval || 1));
            break;
          case 'weekly':
            currentDate.setDate(currentDate.getDate() + (7 * (args.recurrenceInterval || 1)));
            break;
          case 'monthly':
            currentDate.setMonth(currentDate.getMonth() + (args.recurrenceInterval || 1));
            break;
          case 'yearly':
            currentDate.setFullYear(currentDate.getFullYear() + (args.recurrenceInterval || 1));
            break;
        }
      }
      
      // Use Supabase if callbacks are available (authenticated user), otherwise localStorage
      if (this.supabaseCallbacks.bulkCreateItems) {
        console.log('🔄 GEMINI SERVICE: Creating recurring events via Supabase for authenticated user');
        try {
          const supabaseEvents = await this.supabaseCallbacks.bulkCreateItems(createdEvents);
          // Real-time subscriptions handle data updates automatically - manual refresh removed
          
          return {
            success: true,
            function: 'createRecurringEvent',
            result: {
              message: `✅ Created ${createdEvents.length} recurring events: "${args.title}" (${args.recurrencePattern})`,
              eventsCreated: createdEvents.length,
              recurrencePattern: args.recurrencePattern,
              recurrenceInterval: args.recurrenceInterval || 1,
              firstEvent: createdEvents[0]?.dateTime,
              items: supabaseEvents || createdEvents
            }
          };
        } catch (error) {
          console.error('❌ GEMINI SERVICE: Supabase createRecurringEvent failed:', error);
          // Fall back to localStorage
          items.push(...createdEvents);
          this.saveStoredItems(items);
          
          return {
            success: true,
            function: 'createRecurringEvent',
            result: {
              message: `✅ Created ${createdEvents.length} recurring events: "${args.title}" (${args.recurrencePattern}) (saved locally due to sync error)`,
              eventsCreated: createdEvents.length,
              recurrencePattern: args.recurrencePattern,
              recurrenceInterval: args.recurrenceInterval || 1,
              firstEvent: createdEvents[0]?.dateTime,
              items: createdEvents
            }
          };
        }
      } else {
        console.log('🔄 GEMINI SERVICE: Creating recurring events via localStorage for unauthenticated user');
        items.push(...createdEvents);
        this.saveStoredItems(items);
        
        return {
          success: true,
          function: 'createRecurringEvent',
          result: {
            message: `✅ Created ${createdEvents.length} recurring events: "${args.title}" (${args.recurrencePattern})`,
            eventsCreated: createdEvents.length,
            recurrencePattern: args.recurrencePattern,
            recurrenceInterval: args.recurrenceInterval || 1,
            firstEvent: createdEvents[0]?.dateTime,
            lastEvent: createdEvents[createdEvents.length - 1]?.dateTime,
            items: createdEvents
          }
        };
      }
    } catch (error) {
      console.error('Error creating recurring event:', error);
      return {
        success: false,
        function: 'createRecurringEvent',
        result: {
          message: `❌ Error creating recurring event: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      };
    }
  }

  private async bulkRescheduleEvents(args: any): Promise<any> {
    console.log('📅 Bulk rescheduling events:', args);
    
    try {
      const items = this.getStoredItems();
      const timeShift = args.timeShift; // e.g., "+1 week", "-3 days"
      
      // Enhanced time shift parsing
      const shiftMatch = timeShift.match(/([+-])(\d+)\s*(week|day|month|year)s?/i);
      if (!shiftMatch) {
        return {
          success: false,
          function: 'bulkRescheduleEvents',
          result: {
            message: `❌ Invalid time shift format: "${timeShift}". Use format like "+1 week", "-3 days", "+2 months"`
          }
        };
      }
      
      const direction = shiftMatch[1] === '+' ? 1 : -1;
      const amount = parseInt(shiftMatch[2]);
      const unit = shiftMatch[3].toLowerCase();
      
      // Filter events to reschedule
      let eventsToReschedule = items.filter(item => item.type === 'event' && item.dateTime);
      
      if (args.searchTerm) {
        eventsToReschedule = eventsToReschedule.filter(item => 
          item.title.toLowerCase().includes(args.searchTerm.toLowerCase())
        );
      }
      
      if (args.categoryId) {
        eventsToReschedule = eventsToReschedule.filter(item => 
          item.categoryId === args.categoryId
        );
      }
      
      if (args.dateRange) {
        const [startStr, endStr] = args.dateRange.split(' to ');
        const startDate = new Date(startStr);
        const endDate = new Date(endStr);
        
        eventsToReschedule = eventsToReschedule.filter(item => {
          if (!item.dateTime) return false;
          const eventDate = new Date(item.dateTime);
          return eventDate >= startDate && eventDate <= endDate;
        });
      }
      
      if (eventsToReschedule.length === 0) {
        return {
          success: false,
          function: 'bulkRescheduleEvents',
          result: {
            message: `❌ No events found to reschedule with the given criteria.`,
            criteria: { timeShift, searchTerm: args.searchTerm, categoryId: args.categoryId, dateRange: args.dateRange }
          }
        };
      }
      
      // Calculate time shift in milliseconds
      let shiftMs = 0;
      switch (unit) {
        case 'day':
          shiftMs = direction * amount * 24 * 60 * 60 * 1000;
          break;
        case 'week':
          shiftMs = direction * amount * 7 * 24 * 60 * 60 * 1000;
          break;
        case 'month':
          shiftMs = direction * amount * 30 * 24 * 60 * 60 * 1000; // Approximate
          break;
        case 'year':
          shiftMs = direction * amount * 365 * 24 * 60 * 60 * 1000; // Approximate
          break;
      }
      
      // Reschedule events
      let rescheduledCount = 0;
      const rescheduledEvents: string[] = [];
      const errors: string[] = [];
      
      for (const event of eventsToReschedule) {
        try {
          const eventIndex = items.findIndex(item => item.id === event.id);
          if (eventIndex !== -1 && event.dateTime) {
            // Ensure dateTime is a Date object
            const currentDateTime = event.dateTime instanceof Date ? event.dateTime : new Date(event.dateTime);
            const newDateTime = new Date(currentDateTime.getTime() + shiftMs);
            
            // Update the event
            items[eventIndex] = {
              ...items[eventIndex],
              dateTime: newDateTime,
              metadata: {
                ...items[eventIndex].metadata,
                startTime: event.metadata?.startTime ? 
                  new Date((event.metadata.startTime instanceof Date ? event.metadata.startTime : new Date(event.metadata.startTime)).getTime() + shiftMs) : 
                  newDateTime,
                endTime: event.metadata?.endTime ? 
                  new Date((event.metadata.endTime instanceof Date ? event.metadata.endTime : new Date(event.metadata.endTime)).getTime() + shiftMs) : 
                  undefined
              },
              updatedAt: new Date()
            };
            
            rescheduledCount++;
            rescheduledEvents.push(`"${event.title}" → ${newDateTime.toLocaleDateString()} ${newDateTime.toLocaleTimeString()}`);
          }
        } catch (error) {
          console.error(`Error rescheduling event "${event.title}":`, error);
          errors.push(`Failed to reschedule "${event.title}": ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      // Use Supabase if callbacks are available (authenticated user), otherwise localStorage
      if (this.supabaseCallbacks.updateItem && rescheduledCount > 0) {
        console.log('🔄 GEMINI SERVICE: Bulk rescheduling events via Supabase for authenticated user');
        try {
          // For bulk reschedule, we need to update items, not create new ones
          const updatePromises = eventsToReschedule.slice(0, rescheduledCount).map(async (event) => {
            const eventIndex = items.findIndex(item => item.id === event.id);
            if (eventIndex !== -1) {
              const updatedEvent = items[eventIndex];
              return await this.supabaseCallbacks.updateItem!(event.id, updatedEvent);
            }
            return null;
          });
          
          await Promise.all(updatePromises);
          
          // Real-time subscriptions handle data updates automatically - manual refresh removed
          
          const message = rescheduledCount > 0 
            ? `✅ Successfully rescheduled ${rescheduledCount} events by ${timeShift}${errors.length > 0 ? ` (${errors.length} errors)` : ''}`
            : `❌ Failed to reschedule events${errors.length > 0 ? `: ${errors.join(', ')}` : ''}`;
          
          return {
            success: rescheduledCount > 0,
            function: 'bulkRescheduleEvents',
            result: {
              message,
              rescheduledCount,
              timeShift,
              rescheduledEvents: rescheduledEvents.slice(0, 5), // Show first 5 for brevity
              errors: errors.slice(0, 3) // Show first 3 errors
            }
          };
        } catch (error) {
          console.error('❌ GEMINI SERVICE: Supabase bulk update failed, falling back to localStorage:', error);
          this.saveStoredItems(items);
          
          const message = rescheduledCount > 0 
            ? `✅ Successfully rescheduled ${rescheduledCount} events by ${timeShift} (saved locally due to sync error)${errors.length > 0 ? ` (${errors.length} errors)` : ''}`
            : `❌ Failed to reschedule events${errors.length > 0 ? `: ${errors.join(', ')}` : ''}`;
          
          return {
            success: rescheduledCount > 0,
            function: 'bulkRescheduleEvents',
            result: {
              message,
              rescheduledCount,
              timeShift,
              rescheduledEvents: rescheduledEvents.slice(0, 5), // Show first 5 for brevity
              errors: errors.slice(0, 3), // Show first 3 errors
              fallbackUsed: true
            }
          };
        }
      } else {
        console.log('🔄 GEMINI SERVICE: Bulk rescheduling events via localStorage for unauthenticated user');
        this.saveStoredItems(items);
        
        const message = rescheduledCount > 0 
          ? `✅ Successfully rescheduled ${rescheduledCount} events by ${timeShift}${errors.length > 0 ? ` (${errors.length} errors)` : ''}`
          : `❌ Failed to reschedule events${errors.length > 0 ? `: ${errors.join(', ')}` : ''}`;
        
        return {
          success: rescheduledCount > 0,
          function: 'bulkRescheduleEvents',
          result: {
            message,
            rescheduledCount,
            timeShift,
            rescheduledEvents: rescheduledEvents.slice(0, 5), // Show first 5 for brevity
            errors: errors.slice(0, 3) // Show first 3 errors
          }
        };
      }
    } catch (error) {
      console.error('Error in bulkRescheduleEvents:', error);
      return {
        success: false,
        function: 'bulkRescheduleEvents',
        result: {
          message: `❌ Error rescheduling events: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      };
    }
  }

  private async createMultipleDateEvents(args: any): Promise<any> {
    console.log('📅 Creating events for multiple dates:', args);
    
    try {
      const items = this.getStoredItems();
      const createdEvents: Item[] = [];
      const errors: string[] = [];
      
      for (const dateStr of args.dates) {
        try {
          const eventDateTime = new Date(dateStr);
          if (args.time) {
            const [hours, minutes] = args.time.split(':').map(Number);
            eventDateTime.setHours(hours, minutes, 0, 0);
          }
          
          // Check for conflicts
          const conflictingEvents = items.filter(item => {
            if (item.type !== 'event' || !item.dateTime) return false;
            const existingDateTime = new Date(item.dateTime);
            const timeDiff = Math.abs(existingDateTime.getTime() - eventDateTime.getTime());
            return timeDiff < 30 * 60 * 1000; // 30 minutes
          });
          
          if (conflictingEvents.length > 0 && !args.ignoreConflicts) {
            errors.push(`Conflict on ${dateStr}: "${conflictingEvents[0].title}" already scheduled`);
            continue;
          }
          
          // Calculate end time
          let endTime = eventDateTime;
          if (args.duration) {
            endTime = new Date(eventDateTime.getTime() + args.duration * 60 * 1000);
          } else if (args.endTime) {
            const [hours, minutes] = args.endTime.split(':').map(Number);
            endTime = new Date(eventDateTime);
            endTime.setHours(hours, minutes, 0, 0);
          } else {
            endTime = new Date(eventDateTime.getTime() + 60 * 60 * 1000); // Default 1 hour
          }
          
          const event: Item = {
            id: this.generateUniqueId(),
            title: args.title,
            text: args.text || '',
            type: 'event',
            categoryId: this.mapToExistingCategory(args.categoryId) || 'personal',
            completed: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            dateTime: eventDateTime,
            metadata: {
              priority: args.priority || 'medium',
              aiGenerated: true,
              startTime: eventDateTime,
              endTime: endTime,
              duration: Math.round((endTime.getTime() - eventDateTime.getTime()) / (1000 * 60)),
              ...(args.location && { location: args.location })
            }
          };
          
          createdEvents.push(event);
        } catch (error) {
          errors.push(`Failed to create event for ${dateStr}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      // Use Supabase if callbacks are available (authenticated user), otherwise localStorage
      if (createdEvents.length > 0) {
        if (this.supabaseCallbacks.bulkCreateItems) {
          console.log('🔄 GEMINI SERVICE: Creating multiple date events via Supabase for authenticated user');
          try {
            const supabaseEvents = await this.supabaseCallbacks.bulkCreateItems(createdEvents);
            // Real-time subscriptions handle data updates automatically - manual refresh removed
            
            const message = `✅ Created ${createdEvents.length} events: "${args.title}"${errors.length > 0 ? ` (${errors.length} conflicts/errors)` : ''}`;
            
            return {
              success: createdEvents.length > 0,
              function: 'createMultipleDateEvents',
              result: {
                message,
                eventsCreated: createdEvents.length,
                errors: errors.slice(0, 3),
                createdEvents: (supabaseEvents || createdEvents).map((e: any) => ({
                  id: e.id,
                  title: e.title,
                  dateTime: e.dateTime
                }))
              }
            };
          } catch (error) {
            console.error('❌ GEMINI SERVICE: Supabase bulk create failed, falling back to localStorage:', error);
            items.push(...createdEvents);
            this.saveStoredItems(items);
            
            const message = `✅ Created ${createdEvents.length} events: "${args.title}" (saved locally due to sync error)${errors.length > 0 ? ` (${errors.length} conflicts/errors)` : ''}`;
            
            return {
              success: createdEvents.length > 0,
              function: 'createMultipleDateEvents',
              result: {
                message,
                eventsCreated: createdEvents.length,
                errors: errors.slice(0, 3),
                createdEvents: createdEvents.map(e => ({
                  id: e.id,
                  title: e.title,
                  dateTime: e.dateTime
                })),
                fallbackUsed: true
              }
            };
          }
        } else {
          console.log('🔄 GEMINI SERVICE: Creating multiple date events via localStorage for unauthenticated user');
          items.push(...createdEvents);
          this.saveStoredItems(items);
          
          const message = `✅ Created ${createdEvents.length} events: "${args.title}"${errors.length > 0 ? ` (${errors.length} conflicts/errors)` : ''}`;
          
          return {
            success: createdEvents.length > 0,
            function: 'createMultipleDateEvents',
            result: {
              message,
              eventsCreated: createdEvents.length,
              errors: errors.slice(0, 3),
              createdEvents: createdEvents.map(e => ({
                id: e.id,
                title: e.title,
                dateTime: e.dateTime
              }))
            }
          };
        }
      }
      
      const message = `❌ Failed to create events${errors.length > 0 ? `: ${errors.join(', ')}` : ''}`;
      
      return {
        success: false,
        function: 'createMultipleDateEvents',
        result: {
          message,
          eventsCreated: 0,
          errors: errors.slice(0, 3)
        }
      };
    } catch (error) {
      console.error('Error creating multiple date events:', error);
      return {
        success: false,
        function: 'createMultipleDateEvents',
        result: {
          message: `❌ Error creating events: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      };
    }
  }

  private async deleteRecurringEvent(args: any): Promise<any> {
    console.log('🗑️ Deleting recurring event:', args);
    
    try {
      const items = this.getStoredItems();
      const eventId = args.eventId;
      const deleteAll = args.deleteAll || false;
      
      const targetEvent = items.find(item => item.id === eventId);
      if (!targetEvent) {
        return {
          success: false,
          function: 'deleteRecurringEvent',
          result: {
            message: `❌ Event not found with ID: ${eventId}`
          }
        };
      }
      
      if (!targetEvent.metadata?.isRecurring) {
        // Not a recurring event, just delete normally
        // Use Supabase if callbacks are available (authenticated user), otherwise localStorage
        if (this.supabaseCallbacks.deleteItem) {
          console.log('🔄 GEMINI SERVICE: Deleting single event via Supabase for authenticated user');
          try {
            await this.supabaseCallbacks.deleteItem(eventId);
            // Real-time subscriptions handle data updates automatically - manual refresh removed
            
            return {
              success: true,
              function: 'deleteRecurringEvent',
              result: {
                message: `✅ Deleted event: "${targetEvent.title}"`
              }
            };
          } catch (error) {
            console.error('❌ GEMINI SERVICE: Supabase delete failed, falling back to localStorage:', error);
            const filteredItems = items.filter(item => item.id !== eventId);
            this.saveStoredItems(filteredItems);
            
            return {
              success: true,
              function: 'deleteRecurringEvent',
              result: {
                message: `✅ Deleted event: "${targetEvent.title}" (saved locally due to sync error)`,
                fallbackUsed: true
              }
            };
          }
        } else {
          console.log('🔄 GEMINI SERVICE: Deleting single event via localStorage for unauthenticated user');
          const filteredItems = items.filter(item => item.id !== eventId);
          this.saveStoredItems(filteredItems);
          
          return {
            success: true,
            function: 'deleteRecurringEvent',
            result: {
              message: `✅ Deleted event: "${targetEvent.title}"`
            }
          };
        }
      }
      
      if (!deleteAll) {
        // Ask for confirmation
        const recurrenceId = targetEvent.metadata.recurrenceId;
        const relatedEvents = items.filter(item => 
          item.metadata?.recurrenceId === recurrenceId && item.id !== eventId
        );
        
        return {
          success: false,
          function: 'deleteRecurringEvent',
          result: {
            message: `⚠️ This is a recurring event with ${relatedEvents.length + 1} total occurrences. Would you like to:
1. Delete only this occurrence
2. Delete all ${relatedEvents.length + 1} occurrences

Please specify "delete this one" or "delete all" to proceed.`,
            eventTitle: targetEvent.title,
            totalOccurrences: relatedEvents.length + 1,
            needsConfirmation: true
          }
        };
      }
      
      // Delete all occurrences
      const recurrenceId = targetEvent.metadata.recurrenceId;
      const eventsToDelete = items.filter(item => 
        item.metadata?.recurrenceId === recurrenceId
      );
      
      // Use Supabase if callbacks are available (authenticated user), otherwise localStorage
      if (this.supabaseCallbacks.deleteItem) {
        console.log('🔄 GEMINI SERVICE: Deleting recurring events via Supabase for authenticated user');
        try {
          // Delete each occurrence individually
          const deletePromises = eventsToDelete.map(event => 
            this.supabaseCallbacks.deleteItem!(event.id)
          );
          await Promise.all(deletePromises);
          
          // Real-time subscriptions handle data updates automatically - manual refresh removed
          
          return {
            success: true,
            function: 'deleteRecurringEvent',
            result: {
              message: `✅ Deleted all ${eventsToDelete.length} occurrences of "${targetEvent.title}"`
            }
          };
        } catch (error) {
          console.error('❌ GEMINI SERVICE: Supabase bulk delete failed, falling back to localStorage:', error);
          const filteredItems = items.filter(item => 
            !item.metadata?.recurrenceId || item.metadata.recurrenceId !== recurrenceId
          );
          this.saveStoredItems(filteredItems);
          
          return {
            success: true,
            function: 'deleteRecurringEvent',
            result: {
              message: `✅ Deleted all ${eventsToDelete.length} occurrences of "${targetEvent.title}" (saved locally due to sync error)`,
              fallbackUsed: true
            }
          };
        }
      } else {
        console.log('🔄 GEMINI SERVICE: Deleting recurring events via localStorage for unauthenticated user');
        const filteredItems = items.filter(item => 
          !item.metadata?.recurrenceId || item.metadata.recurrenceId !== recurrenceId
        );
        this.saveStoredItems(filteredItems);
        
        return {
          success: true,
          function: 'deleteRecurringEvent',
          result: {
            message: `✅ Deleted all ${eventsToDelete.length} occurrences of "${targetEvent.title}"`
          }
        };
      }
    } catch (error) {
      console.error('Error deleting recurring event:', error);
      return {
        success: false,
        function: 'deleteRecurringEvent',
        result: {
          message: `❌ Error deleting event: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      };
    }
  }

  private async createItemWithConflictOverride(args: any): Promise<any> {
    console.log('🎯 Creating item with conflict override:', args);
    
    // Force creation by setting ignoreConflicts flag
    const modifiedArgs = { ...args, ignoreConflicts: true };
    return await this.createItem(modifiedArgs);
  }

  private async createRecurringMultipleDays(args: any): Promise<any> {
    console.log('📅 Creating recurring events for multiple days:', args);
    
    try {
      const items = this.getStoredItems();
      const createdEvents: Item[] = [];
      const errors: string[] = [];
      
      // Parse the schedule pattern
      const daysOfWeek = args.daysOfWeek || []; // e.g., ['tuesday', 'thursday']
      const startDate = new Date(args.startDate || new Date());
      const endDate = new Date(args.endDate || new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000)); // Default 30 days
      const time = args.time || '15:00'; // Default 3 PM
      
      // Generate all dates for the specified days of week
      const targetDates: Date[] = [];
      const currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        
        if (daysOfWeek.some((day: string) => day.toLowerCase() === dayName)) {
          const eventDate = new Date(currentDate);
          const [hours, minutes] = time.split(':').map(Number);
          eventDate.setHours(hours, minutes, 0, 0);
          targetDates.push(new Date(eventDate));
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      // Create events for each target date
      const recurrenceId = this.generateUniqueId();
      
      for (const eventDateTime of targetDates) {
        try {
          // Check for conflicts
          const conflictingEvents = items.filter(item => {
            if (item.type !== 'event' || !item.dateTime) return false;
            const existingDateTime = new Date(item.dateTime);
            const timeDiff = Math.abs(existingDateTime.getTime() - eventDateTime.getTime());
            return timeDiff < 30 * 60 * 1000; // 30 minutes
          });
          
          if (conflictingEvents.length > 0 && !args.ignoreConflicts) {
            errors.push(`Conflict on ${eventDateTime.toLocaleDateString()}: "${conflictingEvents[0].title}" already scheduled`);
            continue;
          }
          
          // Calculate end time
          const duration = args.duration || 60; // Default 1 hour
          const endTime = new Date(eventDateTime.getTime() + duration * 60 * 1000);
          
          const event: Item = {
            id: this.generateUniqueId(),
            title: args.title,
            text: args.text || '',
            type: 'event',
            categoryId: this.mapToExistingCategory(args.categoryId) || 'work',
            completed: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            dateTime: eventDateTime,
            metadata: {
              priority: args.priority || 'medium',
              aiGenerated: true,
              startTime: eventDateTime,
              endTime: endTime,
              duration: duration,
              isRecurring: true,
              recurrenceId: recurrenceId,
              recurrencePattern: 'weekly',
              recurrenceInterval: 1,
              ...(args.location && { location: args.location })
            }
          };
          
          createdEvents.push(event);
        } catch (error) {
          errors.push(`Failed to create event for ${eventDateTime.toLocaleDateString()}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      // Use Supabase if callbacks are available (authenticated user), otherwise localStorage
      if (createdEvents.length > 0) {
        if (this.supabaseCallbacks.bulkCreateItems) {
          console.log('🔄 GEMINI SERVICE: Creating recurring multiple day events via Supabase for authenticated user');
          try {
            const supabaseEvents = await this.supabaseCallbacks.bulkCreateItems(createdEvents);
            // Real-time subscriptions handle data updates automatically - manual refresh removed
            
            const message = `✅ Created ${createdEvents.length} recurring events: "${args.title}" for ${daysOfWeek.join(' and ')}${errors.length > 0 ? ` (${errors.length} conflicts/errors)` : ''}`;
            
            return {
              success: createdEvents.length > 0,
              function: 'createRecurringMultipleDays',
              result: {
                message,
                eventsCreated: createdEvents.length,
                errors: errors.slice(0, 3),
                createdEvents: (supabaseEvents || createdEvents).map((e: any) => ({
                  id: e.id,
                  title: e.title,
                  dateTime: e.dateTime,
                  recurrenceId: e.metadata?.recurrenceId
                }))
              }
            };
          } catch (error) {
            console.error('❌ GEMINI SERVICE: Supabase bulk create failed, falling back to localStorage:', error);
            items.push(...createdEvents);
            this.saveStoredItems(items);
            
            const message = `✅ Created ${createdEvents.length} recurring events: "${args.title}" for ${daysOfWeek.join(' and ')} (saved locally due to sync error)${errors.length > 0 ? ` (${errors.length} conflicts/errors)` : ''}`;
            
            return {
              success: createdEvents.length > 0,
              function: 'createRecurringMultipleDays',
              result: {
                message,
                eventsCreated: createdEvents.length,
                errors: errors.slice(0, 3),
                createdEvents: createdEvents.map(e => ({
                  id: e.id,
                  title: e.title,
                  dateTime: e.dateTime,
                  recurrenceId: e.metadata?.recurrenceId
                })),
                fallbackUsed: true
              }
            };
          }
        } else {
          console.log('🔄 GEMINI SERVICE: Creating recurring multiple day events via localStorage for unauthenticated user');
          items.push(...createdEvents);
          this.saveStoredItems(items);
          
          const message = `✅ Created ${createdEvents.length} recurring events: "${args.title}" for ${daysOfWeek.join(' and ')}${errors.length > 0 ? ` (${errors.length} conflicts/errors)` : ''}`;
          
          return {
            success: createdEvents.length > 0,
            function: 'createRecurringMultipleDays',
            result: {
              message,
              eventsCreated: createdEvents.length,
              errors: errors.slice(0, 3),
              createdEvents: createdEvents.map(e => ({
                id: e.id,
                title: e.title,
                dateTime: e.dateTime,
                recurrenceId: e.metadata?.recurrenceId
              }))
            }
          };
        }
      }
      
      const message = `❌ Failed to create events${errors.length > 0 ? `: ${errors.join(', ')}` : ''}`;
      
      return {
        success: false,
        function: 'createRecurringMultipleDays',
        result: {
          message,
          eventsCreated: 0,
          errors: errors.slice(0, 3)
        }
      };
    } catch (error) {
      console.error('Error creating recurring multiple day events:', error);
      return {
        success: false,
        function: 'createRecurringMultipleDays',
        result: {
          message: `❌ Error creating events: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      };
    }
  }

  private findEventByDescription(items: Item[], description: string): Item | undefined {
    // First try exact ID match
    let event = items.find(item => item.id === description);
    if (event) return event;
    
    // Then try exact title match
    event = items.find(item => 
      item.type === 'event' && 
      item.title.toLowerCase() === description.toLowerCase()
    );
    if (event) return event;
    
    // Then try fuzzy title matching
    const searchTerms = description.toLowerCase().split(' ');
    event = items.find(item => {
      if (item.type !== 'event') return false;
      const title = item.title.toLowerCase();
      return searchTerms.every(term => title.includes(term));
    });
    if (event) return event;
    
    // Try partial matching with common workout/meeting terms
    const workoutTerms = ['workout', 'gym', 'exercise', 'training', 'fitness'];
    const meetingTerms = ['meeting', 'call', 'standup', 'sync'];
    
    if (workoutTerms.some(term => description.toLowerCase().includes(term))) {
      event = items.find(item => 
        item.type === 'event' && 
        (item.categoryId === 'gym-calisthenics' || item.categoryId === 'cardio-running') &&
        workoutTerms.some(term => item.title.toLowerCase().includes(term))
      );
      if (event) return event;
    }
    
    if (meetingTerms.some(term => description.toLowerCase().includes(term))) {
      event = items.find(item => 
        item.type === 'event' && 
        item.categoryId === 'work-productivity' &&
        meetingTerms.some(term => item.title.toLowerCase().includes(term))
      );
      if (event) return event;
    }
    
    // Try time-based matching (morning, afternoon, evening)
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    if (description.toLowerCase().includes('morning')) {
      event = items.find(item => {
        if (item.type !== 'event' || !item.dateTime) return false;
        const eventDate = new Date(item.dateTime);
        const eventTime = eventDate.getHours();
        return eventDate >= today && eventTime >= 5 && eventTime <= 12;
      });
      if (event) return event;
    }
    
    if (description.toLowerCase().includes('afternoon')) {
      event = items.find(item => {
        if (item.type !== 'event' || !item.dateTime) return false;
        const eventDate = new Date(item.dateTime);
        const eventTime = eventDate.getHours();
        return eventDate >= today && eventTime >= 12 && eventTime <= 17;
      });
      if (event) return event;
    }
    
    if (description.toLowerCase().includes('evening')) {
      event = items.find(item => {
        if (item.type !== 'event' || !item.dateTime) return false;
        const eventDate = new Date(item.dateTime);
        const eventTime = eventDate.getHours();
        return eventDate >= today && eventTime >= 17 && eventTime <= 23;
      });
      if (event) return event;
    }
    
    return undefined;
  }

  private async intelligentReschedule(args: any): Promise<any> {
    console.log('🧠 Intelligent rescheduling:', args);
    
    try {
      const items = this.getStoredItems();
      const canceledEventId = args.canceledEventId;
      // const rescheduleType = args.rescheduleType || 'auto'; // 'auto', 'priority', 'category' // TODO: Use for scheduling logic
      
      // Try to find the event by ID first, then by description
      let canceledEvent = items.find(item => item.id === canceledEventId);
      
      if (!canceledEvent) {
        // Try fuzzy search by description
        canceledEvent = this.findEventByDescription(items, canceledEventId);
      }
      
      if (!canceledEvent) {
        // Provide helpful suggestions
        const recentEvents = items
          .filter(item => item.type === 'event' && item.dateTime)
          .sort((a, b) => new Date(b.dateTime!).getTime() - new Date(a.dateTime!).getTime())
          .slice(0, 5);
        
        const suggestions = recentEvents.length > 0 
          ? `\n\nRecent events you might be referring to:\n${recentEvents.map(e => `• "${e.title}" (${new Date(e.dateTime!).toLocaleDateString()})`).join('\n')}`
          : '';
        
        return {
          success: false,
          function: 'intelligentReschedule',
          result: {
            message: `❌ I couldn't find an event matching "${canceledEventId}". Please provide the exact event title or ID.${suggestions}`
          }
        };
      }
      
      // At this point, canceledEvent is guaranteed to exist
      // Remove the canceled event
      const filteredItems = items.filter(item => item.id !== canceledEvent!.id);
      
      // Find events that need rescheduling based on the canceled event
      const eventsToReschedule: Item[] = [];
      const canceledDateTime = new Date(canceledEvent!.dateTime!);
      const canceledCategory = canceledEvent!.categoryId;
      
      // Smart rescheduling logic - UPDATE existing event instead of creating new one
      if (canceledCategory === 'gym-calisthenics' || canceledCategory === 'cardio-running') {
        // If workout was canceled, find next available slot
        // const workoutEvents = filteredItems.filter(item =>  // TODO: Use for workout scheduling
        const isWorkoutRelated = filteredItems.filter(item => 
          item.type === 'event' && 
          (item.categoryId === 'gym-calisthenics' || item.categoryId === 'cardio-running') &&
          item.dateTime &&
          new Date(item.dateTime) > canceledDateTime
        );
        
        // Find the earliest available slot today or tomorrow
        const today = new Date();
        today.setHours(6, 0, 0, 0); // Start looking from 6 AM
        
        let availableSlot = this.findNextAvailableSlot(filteredItems, today, 60); // 60 minutes
        
        if (availableSlot) {
          // UPDATE the existing event instead of creating a new one
          const updatedWorkout: Item = {
            ...canceledEvent!,
            dateTime: availableSlot,
            metadata: {
              ...canceledEvent!.metadata,
              startTime: availableSlot,
              endTime: new Date(availableSlot.getTime() + (canceledEvent!.metadata?.duration || 60) * 60 * 1000),
              rescheduledFrom: canceledEvent!.dateTime?.toString(),
              rescheduleReason: 'Missed workout - automatically rescheduled'
            },
            updatedAt: new Date()
          };
          
          // Add the updated event back to the list (instead of the removed one)
          filteredItems.push(updatedWorkout);
          eventsToReschedule.push(updatedWorkout);
        }
      } else if (canceledCategory === 'work-productivity') {
        // If work event was canceled, shift other work events
        const workEvents = filteredItems.filter(item => 
          item.type === 'event' && 
          item.categoryId === 'work-productivity' &&
          item.dateTime &&
          new Date(item.dateTime) > canceledDateTime &&
          new Date(item.dateTime).toDateString() === canceledDateTime.toDateString()
        );
        
        // Shift work events earlier to fill the gap
        const canceledDuration = canceledEvent!.metadata?.duration || 60;
        for (const workEvent of workEvents) {
          const eventIndex = filteredItems.findIndex(item => item.id === workEvent.id);
          if (eventIndex !== -1) {
            const newDateTime = new Date(workEvent.dateTime!.getTime() - canceledDuration * 60 * 1000);
            
            filteredItems[eventIndex] = {
              ...filteredItems[eventIndex],
              dateTime: newDateTime,
              metadata: {
                ...filteredItems[eventIndex].metadata,
                startTime: newDateTime,
                endTime: workEvent.metadata?.endTime ? 
                  new Date(workEvent.metadata.endTime.getTime() - canceledDuration * 60 * 1000) : 
                  undefined,
                rescheduledFrom: canceledEventId,
                rescheduleReason: 'Shifted earlier due to canceled meeting'
              },
              updatedAt: new Date()
            };
            
            eventsToReschedule.push(filteredItems[eventIndex]);
          }
        }
      }
      
      // Use Supabase if callbacks are available (authenticated user), otherwise localStorage
      if (this.supabaseCallbacks.deleteItem) {
        console.log('🔄 GEMINI SERVICE: Intelligent rescheduling via Supabase for authenticated user');
        try {
          // First, delete the canceled event
          await this.supabaseCallbacks.deleteItem(canceledEvent!.id);
          
          // Then, update the rescheduled events
          if (eventsToReschedule.length > 0 && this.supabaseCallbacks.updateItem) {
            const updatePromises = eventsToReschedule.map(event => 
              this.supabaseCallbacks.updateItem!(event.id, event)
            );
            await Promise.all(updatePromises);
          }
          
          // Real-time subscriptions handle data updates automatically - manual refresh removed
          
          const message = eventsToReschedule.length > 0 
            ? `✅ Canceled "${canceledEvent!.title}" and intelligently rescheduled ${eventsToReschedule.length} related events`
            : `✅ Canceled "${canceledEvent!.title}" (no related events to reschedule)`;
          
          return {
            success: true,
            function: 'intelligentReschedule',
            result: {
              message,
              canceledEvent: {
                title: canceledEvent!.title,
                dateTime: canceledEvent!.dateTime
              },
              rescheduledEvents: eventsToReschedule.map(e => ({
                title: e.title,
                newDateTime: e.dateTime,
                reason: e.metadata?.rescheduleReason
              }))
            }
          };
        } catch (error) {
          console.error('❌ GEMINI SERVICE: Supabase intelligent reschedule failed, falling back to localStorage:', error);
          this.saveStoredItems(filteredItems);
          
          const message = eventsToReschedule.length > 0 
            ? `✅ Canceled "${canceledEvent!.title}" and intelligently rescheduled ${eventsToReschedule.length} related events (saved locally due to sync error)`
            : `✅ Canceled "${canceledEvent!.title}" (no related events to reschedule, saved locally due to sync error)`;
          
          return {
            success: true,
            function: 'intelligentReschedule',
            result: {
              message,
              canceledEvent: {
                title: canceledEvent!.title,
                dateTime: canceledEvent!.dateTime
              },
              rescheduledEvents: eventsToReschedule.map(e => ({
                title: e.title,
                newDateTime: e.dateTime,
                reason: e.metadata?.rescheduleReason
              })),
              fallbackUsed: true
            }
          };
        }
      } else {
        console.log('🔄 GEMINI SERVICE: Intelligent rescheduling via localStorage for unauthenticated user');
        this.saveStoredItems(filteredItems);
        
        const message = eventsToReschedule.length > 0 
          ? `✅ Canceled "${canceledEvent!.title}" and intelligently rescheduled ${eventsToReschedule.length} related events`
          : `✅ Canceled "${canceledEvent!.title}" (no related events to reschedule)`;
        
        return {
          success: true,
          function: 'intelligentReschedule',
          result: {
            message,
            canceledEvent: {
              title: canceledEvent!.title,
              dateTime: canceledEvent!.dateTime
            },
            rescheduledEvents: eventsToReschedule.map(e => ({
              title: e.title,
              newDateTime: e.dateTime,
              reason: e.metadata?.rescheduleReason
            }))
          }
        };
      }
    } catch (error) {
      console.error('Error in intelligent reschedule:', error);
      return {
        success: false,
        function: 'intelligentReschedule',
        result: {
          message: `❌ Error rescheduling: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      };
    }
  }

  private findNextAvailableSlot(items: Item[], startTime: Date, durationMinutes: number): Date | null {
    const events = items
      .filter(item => item.type === 'event' && item.dateTime)
      .sort((a, b) => new Date(a.dateTime!).getTime() - new Date(b.dateTime!).getTime());
    
    let currentSlot = new Date(startTime);
    const endOfDay = new Date(startTime);
    endOfDay.setHours(22, 0, 0, 0); // Don't schedule after 10 PM
    
    while (currentSlot < endOfDay) {
      const slotEnd = new Date(currentSlot.getTime() + durationMinutes * 60 * 1000);
      
      // Check if this slot conflicts with any existing event
      const slotStartTime = currentSlot.getTime();
      const hasConflict = events.some(event => {
        const eventStart = new Date(event.dateTime!);
        const eventEnd = event.metadata?.endTime ? 
          new Date(event.metadata.endTime) : 
          new Date(eventStart.getTime() + 60 * 60 * 1000); // Default 1 hour
        
        return (slotStartTime < eventEnd.getTime() && slotEnd.getTime() > eventStart.getTime());
      });
      
      if (!hasConflict) {
        return currentSlot;
      }
      
      // Move to next 30-minute slot
      currentSlot = new Date(currentSlot.getTime() + 30 * 60 * 1000);
    }
    
    // Try tomorrow if no slot found today
    const tomorrow = new Date(startTime);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(6, 0, 0, 0);
    
    if (tomorrow.getDate() !== startTime.getDate()) {
      return this.findNextAvailableSlot(items, tomorrow, durationMinutes);
    }
    
    return null;
  }
}

export const geminiService = new GeminiService(); 