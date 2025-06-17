// Chat Message Types
export interface MessageVersion {
  id: string;
  content: string;
  timestamp: Date;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  versions: MessageVersion[]; // Multiple versions of this message
  currentVersionIndex: number; // Which version is currently displayed
  timestamp: Date;
  isEditing?: boolean;
}

// Chat Session Types
export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

// AI Response Types
export interface AIResponse {
  success: boolean;
  message: string;
  itemCreated?: {
    type: string;
    title: string;
    categoryId: string;
    item?: any; // Full item data when available
  };
  functionResults?: any[]; // Results from function calls
  itemsModified?: boolean; // Whether any items were modified
  pendingFunctionCall?: any; // Function call waiting for confirmation
}

// Chat State
export interface ChatState {
  sessions: ChatSession[];
  currentSessionId: string | null;
  isProcessing: boolean;
} 