// Consistent color theme for the Life Structure app
export const theme = {
  // Primary brand colors
  primary: {
    50: '#f0f9ff',
    100: '#e0f2fe',
    200: '#bae6fd',
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#0ea5e9',
    600: '#0284c7',
    700: '#0369a1',
    800: '#075985',
    900: '#0c4a6e',
  },
  
  // Secondary colors for different sections
  secondary: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  },

  // Category-specific colors (matching the categories)
  categories: {
    'self-regulation': '#74B9FF',
    'gym-calisthenics': '#4ECDC4',
    'mobile-apps': '#45B7D1',
    'catholicism': '#96CEB4',
    'social-charisma': '#DDA0DD',
    'content': '#FFEAA7',
  },

  // Global section colors
  sections: {
    dashboard: {
      primary: '#64748b',
      secondary: '#0ea5e9',
      background: 'from-slate-50 via-white to-blue-50',
      card: 'bg-white/80 backdrop-blur-xl',
      accent: 'from-slate-600 to-blue-500'
    },
    todos: {
      primary: '#10b981',
      secondary: '#059669',
      background: 'from-green-50 via-white to-emerald-50',
      card: 'bg-white/80 backdrop-blur-xl',
      accent: 'from-green-600 to-emerald-500'
    },
    calendar: {
      primary: '#3b82f6',
      secondary: '#2563eb',
      background: 'from-blue-50 via-white to-indigo-50',
      card: 'bg-white/80 backdrop-blur-xl',
      accent: 'from-blue-600 to-indigo-500'
    },
    goals: {
      primary: '#8b5cf6',
      secondary: '#7c3aed',
      background: 'from-purple-50 via-white to-violet-50',
      card: 'bg-white/80 backdrop-blur-xl',
      accent: 'from-purple-600 to-violet-500'
    },
    routines: {
      primary: '#f97316',
      secondary: '#ea580c',
      background: 'from-orange-50 via-white to-red-50',
      card: 'bg-white/80 backdrop-blur-xl',
      accent: 'from-orange-600 to-red-500'
    },
    notes: {
      primary: '#eab308',
      secondary: '#ca8a04',
      background: 'from-yellow-50 via-white to-amber-50',
      card: 'bg-white/80 backdrop-blur-xl',
      accent: 'from-yellow-600 to-amber-500'
    },
    categories: {
      primary: '#ec4899',
      secondary: '#db2777',
      background: 'from-pink-50 via-white to-rose-50',
      card: 'bg-white/80 backdrop-blur-xl',
      accent: 'from-pink-600 to-rose-500'
    }
  },

  // Sidebar colors
  sidebar: {
    background: 'bg-white/95 backdrop-blur-xl',
    border: 'border-white/20',
    shadow: 'shadow-2xl',
    item: {
      default: 'text-gray-600 hover:text-gray-800 hover:bg-gray-50',
      active: 'text-blue-600 bg-blue-50 border-r-2 border-blue-600',
      icon: 'w-5 h-5'
    }
  },

  // Common UI elements
  ui: {
    button: {
      primary: 'bg-gradient-to-r hover:shadow-lg transition-all duration-300',
      secondary: 'bg-white hover:bg-gray-50 border border-gray-200',
      danger: 'bg-red-500 hover:bg-red-600 text-white',
      success: 'bg-green-500 hover:bg-green-600 text-white'
    },
    input: {
      default: 'bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:border-transparent',
      focus: 'focus:ring-blue-500'
    },
    card: {
      default: 'bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/30',
      hover: 'hover:shadow-xl transition-all duration-300'
    }
  }
};

// Helper function to get section theme
export const getSectionTheme = (section: keyof typeof theme.sections) => {
  return theme.sections[section];
};

// Helper function to get category color
export const getCategoryColor = (categoryId: string) => {
  return theme.categories[categoryId as keyof typeof theme.categories] || theme.primary[500];
}; 