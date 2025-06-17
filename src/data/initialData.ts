import { Category, Item, DailySchedule, WeeklyHabit, OneTimeAction } from '../types';

const now = new Date();

export const categories: Category[] = [
  {
    id: 'self-regulation',
    name: 'Self-Regulation',
    icon: '⚖️',
    color: '#74B9FF',
    priority: 0,
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'gym-calisthenics',
    name: 'Gym/Calisthenics',
    icon: '🏋️',
    color: '#4ECDC4',
    priority: 1,
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'mobile-apps',
    name: 'Mobile Apps/AI/Entrepreneurship',
    icon: '📱',
    color: '#45B7D1',
    priority: 2,
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'catholicism',
    name: 'Catholicism',
    icon: '✝️',
    color: '#96CEB4',
    priority: 3,
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'social-charisma',
    name: 'Social/Charisma/Dating',
    icon: '🗣️',
    color: '#DDA0DD',
    priority: 4,
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'content',
    name: 'Content Creation',
    icon: '📝',
    color: '#FFEAA7',
    priority: 5,
    createdAt: now,
    updatedAt: now
  }
];

export const initialItems: Item[] = [
  // Self-Regulation Goals (formerly Looks Maxing)
  {
    id: '1',
    categoryId: 'self-regulation',
    type: 'goal',
    title: 'Become an 8/10',
    text: 'Focus on supplements, fashion, teeth whitening, skincare routine',
    metadata: { progress: 0, target: '8/10 rating' },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '2',
    categoryId: 'self-regulation',
    type: 'todo',
    title: 'Buy supplements & set up routine',
    text: 'Research and purchase supplements for looks maxing routine',
    dueDate: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '3',
    categoryId: 'self-regulation',
    type: 'routine',
    title: 'Morning routine',
    text: 'Wake up at 5AM, immediate skincare, get dressed, make bed, go to gym',
    metadata: { 
      frequency: 'daily',
      timeOfDay: '05:00',
      duration: 30,
      completedDates: [],
      currentStreak: 0,
      bestStreak: 0,
      completedToday: false
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '4',
    categoryId: 'self-regulation',
    type: 'routine',
    title: 'Nightly routine',
    text: 'Clean environment, shower, pray, brush teeth, sleep',
    metadata: { 
      frequency: 'daily',
      timeOfDay: '21:30',
      duration: 60,
      completedDates: [],
      currentStreak: 0,
      bestStreak: 0,
      completedToday: false
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },

  // Gym/Calisthenics Goals
  {
    id: '5',
    categoryId: 'gym-calisthenics',
    type: 'goal',
    title: 'Backflip',
    text: 'Learn to do a backflip',
    metadata: { progress: 0, target: '1 clean backflip' },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '6',
    categoryId: 'gym-calisthenics',
    type: 'goal',
    title: 'Dunk consistently',
    text: 'Be able to dunk readily and consistently',
    metadata: { progress: 0, target: 'Consistent dunking' },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '7',
    categoryId: 'gym-calisthenics',
    type: 'goal',
    title: 'Planche',
    text: 'Master the planche',
    metadata: { progress: 0, target: '20 second hold' },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '8',
    categoryId: 'gym-calisthenics',
    type: 'goal',
    title: 'One-arm pull-up',
    text: 'Complete one-arm pull-up',
    metadata: { progress: 0, target: '1 clean rep' },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '9',
    categoryId: 'gym-calisthenics',
    type: 'goal',
    title: 'Handstand push-up',
    text: 'Master handstand push-ups (priority #1)',
    metadata: { progress: 0, target: '5 clean reps' },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '10',
    categoryId: 'gym-calisthenics',
    type: 'routine',
    title: 'Daily gym session',
    text: 'Alternate between weightlifting and calisthenics days',
    metadata: { 
      frequency: 'daily', 
      timeOfDay: '06:00',
      duration: 180,
      completedDates: [],
      currentStreak: 0,
      bestStreak: 0
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },

  // Mobile Apps/Entrepreneurship Goals
  {
    id: '11',
    categoryId: 'mobile-apps',
    type: 'goal',
    title: 'Great app development process',
    text: 'Develop streamlined process for pumping out mobile apps',
    metadata: { progress: 0, target: 'Documented process' },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '12',
    categoryId: 'mobile-apps',
    type: 'goal',
    title: 'Monthly revenue target',
    text: 'Achieve 3K-5K per month from mobile apps',
    metadata: { progress: 0, target: '$3000-5000/month' },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '13',
    categoryId: 'mobile-apps',
    type: 'goal',
    title: 'Billionaire by 40',
    text: 'Build businesses and invest to reach $1B net worth by age 40',
    metadata: { progress: 0, target: '$1,000,000,000' },
    createdAt: new Date(),
    updatedAt: new Date()
  },

  // Catholicism Goals
  {
    id: '14',
    categoryId: 'catholicism',
    type: 'goal',
    title: 'Read Bible in a year',
    text: 'Complete Bible reading in 365 days',
    metadata: { progress: 0, target: '365 days' },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '15',
    categoryId: 'catholicism',
    type: 'goal',
    title: 'Read Catechism in a year',
    text: 'Complete Catechism reading in 365 days',
    metadata: { progress: 0, target: '365 days' },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '16',
    categoryId: 'catholicism',
    type: 'routine',
    title: 'Daily prayer to St. Joseph',
    text: 'Pray to St. Joseph every day',
    metadata: { 
      frequency: 'daily', 
      duration: 10,
      completedDates: [],
      currentStreak: 0,
      bestStreak: 0
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '17',
    categoryId: 'catholicism',
    type: 'routine',
    title: 'Daily Mass attendance',
    text: 'Attend Mass every day when possible',
    metadata: { 
      frequency: 'daily', 
      timeOfDay: '19:00',
      duration: 60,
      completedDates: [],
      currentStreak: 0,
      bestStreak: 0
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },

  // Content Creation
  {
    id: '18',
    categoryId: 'content',
    type: 'goal',
    title: 'Build personal brand',
    text: 'Establish strong personal brand across platforms',
    metadata: { progress: 0, target: '10K followers' },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '19',
    categoryId: 'content',
    type: 'routine',
    title: 'Daily content creation',
    text: 'Create content for social media platforms daily',
    metadata: { 
      frequency: 'daily', 
      duration: 60,
      completedDates: [],
      currentStreak: 0,
      bestStreak: 0
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },

  // Social/Charisma/Dating
  {
    id: '20',
    categoryId: 'social-charisma',
    type: 'goal',
    title: 'Improve social skills',
    text: 'Become more charismatic and socially capable',
    metadata: { progress: 0, target: 'Confident in any social situation' },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '21',
    categoryId: 'social-charisma',
    type: 'routine',
    title: 'Daily social interaction',
    text: 'Practice social skills through daily interactions',
    metadata: { 
      frequency: 'daily', 
      duration: 30,
      completedDates: [],
      currentStreak: 0,
      bestStreak: 0
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },

  // Self-Regulation
  {
    id: '22',
    categoryId: 'self-regulation',
    type: 'goal',
    title: 'Perfect daily routine',
    text: 'Maintain consistent daily schedule and habits',
    metadata: { progress: 0, target: '90% consistency' },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '23',
    categoryId: 'self-regulation',
    type: 'routine',
    title: 'Sleep schedule',
    text: 'Sleep at 9:30 PM, wake at 5:00 AM consistently',
    metadata: { 
      frequency: 'daily', 
      timeOfDay: '21:30',
      duration: 450,
      completedDates: [],
      currentStreak: 0,
      bestStreak: 0
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },

  // Supplements routine
  {
    id: '24',
    categoryId: 'self-regulation',
    type: 'note',
    title: 'Supplements List',
    text: `Daily supplements routine:
- Creatine (5g daily)
- Protein powder (post-workout)
- Multivitamin
- Vitamin D3
- Omega-3
- Zinc
- Magnesium (before bed)`,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

export const dailySchedule: DailySchedule[] = [
  { time: '5:00 AM', activity: 'Wake up', categoryId: 'self-regulation' },
  { time: '5:00-8:00 AM', activity: 'Gym + Bible + Catechism', categoryId: 'gym-calisthenics' },
  { time: '8:00-10:00 AM', activity: 'Study Church History', categoryId: 'catholicism' },
  { time: '10:00-6:00 PM', activity: 'Work (Mobile Apps, Content)', categoryId: 'mobile-apps' },
  { time: '7:00-8:00 PM', activity: 'Mass', categoryId: 'catholicism' },
  { time: '8:00-9:00 PM', activity: 'Nightly Routine', categoryId: 'self-regulation' },
  { time: '9:30 PM', activity: 'Sleep', categoryId: 'self-regulation' }
];

export const weeklyHabits: WeeklyHabit[] = [
  {
    id: 'w1',
    title: 'Content intake',
    targetDays: 7,
    completedDays: 0,
    streak: 0
  },
  {
    id: 'w2',
    title: 'Content creation for all forums',
    targetDays: 7,
    completedDays: 0,
    streak: 0
  },
  {
    id: 'w3',
    title: 'Workouts',
    targetDays: 7,
    completedDays: 0,
    streak: 0
  },
  {
    id: 'w4',
    title: 'No technology Sunday',
    targetDays: 1,
    completedDays: 0,
    streak: 0
  }
];

export const oneTimeActions: OneTimeAction[] = [
  {
    id: 'ota1',
    title: 'Get app repos in place',
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    importance: 'high',
    completed: false
  },
  {
    id: 'ota2',
    title: 'Get apps up',
    deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    importance: 'high',
    completed: false
  },
  {
    id: 'ota3',
    title: 'Buy supplements & looks maxing routine',
    deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    importance: 'high',
    completed: false
  },
  {
    id: 'ota4',
    title: 'Fashion on the buckboard/everything prepped for college',
    deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    importance: 'medium',
    completed: false
  },
  {
    id: 'ota5',
    title: 'Start connecting on LinkedIn',
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    importance: 'medium',
    completed: false
  },
  {
    id: 'ota6',
    title: 'Landing page w/ VSL, newsletter',
    deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    importance: 'high',
    completed: false
  },
  {
    id: 'ota7',
    title: 'Set up gym & diet routine/deal',
    deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    importance: 'high',
    completed: false
  },
  {
    id: 'ota8',
    title: 'AI content helper & prompts',
    deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    importance: 'high',
    completed: false
  }
]; 