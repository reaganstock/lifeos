export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  priority: number; // 0 = foundation, 1-6 = priorities
  createdAt: Date;
  updatedAt: Date;
}

export interface Item {
  id: string;
  categoryId: string;
  type: 'todo' | 'event' | 'note' | 'voiceNote' | 'routine' | 'goal';
  title: string;
  text: string;
  completed?: boolean;
  dueDate?: Date;
  dateTime?: Date;
  attachment?: string; // For voice notes, file paths, etc.
  createdAt: Date;
  updatedAt: Date;
  metadata?: {
    progress?: number; // For goals (0-100)
    target?: string; // For goals
    recurrence?: string; // For routines (daily, weekly, etc.)
    duration?: number; // For routines (minutes)
    priority?: 'low' | 'medium' | 'high'; // For todos
    location?: string; // For events
    startTime?: Date; // For events - start time
    endTime?: Date; // For events - end time
    transcription?: string; // For voice notes
    tags?: string[]; // For any item
    aiGenerated?: boolean; // Mark items created by AI
    hasImage?: boolean; // For notes with image attachments
    imageUrl?: string; // For notes with image attachments
    imageUrls?: string[]; // For notes with multiple image attachments
    hasCustomTitle?: boolean; // For notes with custom titles
    // Enhanced batch operation properties
    batchCreated?: boolean; // Mark items created in batch operations
    batchIndex?: number; // Index in batch operation for tracking
    // Routine-specific properties
    frequency?: 'daily' | 'weekly' | 'monthly' | 'yearly'; // For routines
    timeOfDay?: string; // For routines
    completedDates?: string[]; // For routines - array of completed dates
    currentStreak?: number; // For routines - current consecutive days
    bestStreak?: number; // For routines - best streak achieved
    completedToday?: boolean; // For routines - completed today
    // 12 Week Year properties for goals
    startDate?: Date; // For 12-week goals
    endDate?: Date; // For 12-week goals
    weeklyTactics?: Array<{
      id: string;
      text: string;
      completed: boolean;
      week: number;
    }>; // For 12-week goals
    weeklyScores?: number[]; // For 12-week goals (0-100 for each week)
    currentWeek?: number; // For 12-week goals
    isActive?: boolean; // For 12-week goals
    isTranscribing?: boolean;
    isTranscribingImages?: boolean; // For image transcription status
    parsedFromRoutine?: string; // For events created from routine parsing
    // Recurring event properties
    isRecurring?: boolean; // For recurring events
    recurrencePattern?: 'daily' | 'weekly' | 'monthly' | 'yearly'; // For recurring events
    recurrenceInterval?: number; // For recurring events (e.g., every 2 weeks)
    recurrenceId?: string; // For linking recurring event instances
    occurrenceNumber?: number; // For tracking which occurrence this is
    recurrenceEndDate?: Date; // For when recurring events should stop
    // Intelligent rescheduling properties
    rescheduledFrom?: string; // ID of the original event that was rescheduled
    rescheduleReason?: string; // Reason for rescheduling
  };
}

export interface DailySchedule {
  time: string;
  activity: string;
  categoryId?: string;
  completed?: boolean;
  duration?: number;
}

export interface WeeklyHabit {
  id: string;
  title: string;
  targetDays: number; // per week
  completedDays: number;
  streak: number;
}

export interface OneTimeAction {
  id: string;
  title: string;
  deadline: Date;
  importance: 'low' | 'medium' | 'high';
  completed: boolean;
} 