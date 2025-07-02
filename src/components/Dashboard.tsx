import React, { useState, useEffect } from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, isToday, isYesterday } from 'date-fns';
import { Clock, BowArrow, CheckCircle, Circle, Flame, TrendingUp, Star, Calendar, Zap, Award, BookOpen, Dumbbell, Edit3, Heart, Sparkles, ArrowRight, Trophy, Sun, Moon, Coffee, Sunrise, Sunset, Settings, Target, BarChart3, Activity, Timer, Brain, Lightbulb } from 'lucide-react';
import { Item } from '../types';
import DailyFlowEditor, { DailyFlowItem } from './DailyFlowEditor';

interface DashboardProps {
  onNavigateToCategory: (categoryId: string) => void;
  items: Item[];
  categories: any[];
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigateToCategory, items, categories }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [completedScheduleItems, setCompletedScheduleItems] = useState<string[]>([]);
  const [personalMantra, setPersonalMantra] = useState("Excellence is a daily practice, not a destination");
  const [isEditingMantra, setIsEditingMantra] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [showFlowEditor, setShowFlowEditor] = useState(false);
  const [viewPeriod, setViewPeriod] = useState<'today' | 'week' | 'month'>('today');
  
  const today = new Date();
  const todayString = format(today, 'EEEE, MMMM do, yyyy');

  // Load daily flow from localStorage or use default
  const [dailyFlow, setDailyFlow] = useState<DailyFlowItem[]>(() => {
    const saved = localStorage.getItem('dailyFlow');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved daily flow:', e);
      }
    }
    // Default daily schedule
    return [
      { id: 'default-1', time: '06:00', activity: 'Morning Routine', categoryId: categories[0]?.id || 'general', duration: 60, priority: 'high' },
      { id: 'default-2', time: '08:00', activity: 'Work/Study', categoryId: categories[1]?.id || 'general', duration: 240, priority: 'high' },
      { id: 'default-3', time: '12:00', activity: 'Lunch Break', categoryId: categories[0]?.id || 'general', duration: 60, priority: 'medium' },
      { id: 'default-4', time: '18:00', activity: 'Evening Activities', categoryId: categories[2]?.id || 'general', duration: 120, priority: 'medium' },
    ];
  });

  // Convert dailyFlow to old format for backward compatibility
  const dailySchedule = dailyFlow.map(item => ({
    time: format(new Date(`1970-01-01T${item.time}`), 'h:mm a'),
    activity: item.activity,
    categoryId: item.categoryId,
    id: item.id,
    duration: item.duration,
    priority: item.priority
  }));

  // Enhanced mouse tracking for premium effects
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Update current time every minute for dynamic schedule
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Get today's todos with proper date handling
  const todaysTodos = items.filter(item => {
    if (item.type !== 'todo' || !item.dueDate) return false;
    
    // Ensure dueDate is a valid Date object
    const dueDate = item.dueDate instanceof Date ? item.dueDate : new Date(item.dueDate);
    if (isNaN(dueDate.getTime())) return false;
    
    // Compare dates at midnight to avoid timezone issues
    const dueDateMidnight = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    return dueDateMidnight.getTime() === todayMidnight.getTime();
  });

  // Get upcoming events (next 3)
  const upcomingEvents = items
    .filter(item => {
      if (item.type !== 'event' || !item.dateTime) return false;
      
      // Ensure dateTime is a valid Date object
      const dateTime = item.dateTime instanceof Date ? item.dateTime : new Date(item.dateTime);
      if (isNaN(dateTime.getTime())) return false;
      
      return dateTime > today;
    })
    .sort((a, b) => {
      const dateA = a.dateTime instanceof Date ? a.dateTime : new Date(a.dateTime!);
      const dateB = b.dateTime instanceof Date ? b.dateTime : new Date(b.dateTime!);
      return dateA.getTime() - dateB.getTime();
    })
    .slice(0, 3);

  // Get active routines for today
  const todaysRoutines = items.filter(item => {
    if (item.type !== 'routine') return false;
    const todayStr = today.toDateString();
    if (item.metadata?.frequency === 'daily') return true;
    if (item.metadata?.frequency === 'weekly') {
      const completedDates = item.metadata?.completedDates || [];
      return !completedDates.includes(todayStr);
    }
    return false;
  });

  // Calculate completion rates
  const todoCompletionRate = todaysTodos.length > 0 
    ? Math.round((todaysTodos.filter(t => t.completed).length / todaysTodos.length) * 100)
    : 0;

  const routineCompletionRate = todaysRoutines.length > 0
    ? Math.round((todaysRoutines.filter(r => {
        const todayStr = today.toDateString();
        return r.metadata?.completedDates?.includes(todayStr);
      }).length / todaysRoutines.length) * 100)
    : 0;

  // Get current schedule item
  const getCurrentScheduleItem = () => {
    const currentHour = currentTime.getHours();
    const currentMinutes = currentTime.getMinutes();
    const currentTimeMinutes = currentHour * 60 + currentMinutes;

    return dailySchedule.find(item => {
      const [startTime] = item.time.split('-');
      const [startHour, startMinute] = startTime.split(':').map(t => parseInt(t.replace(/[^\d]/g, '')));
      const adjustedStartHour = startTime.includes('PM') && startHour !== 12 ? startHour + 12 : 
                               startTime.includes('AM') && startHour === 12 ? 0 : startHour;
      const startTimeMinutes = adjustedStartHour * 60 + (startMinute || 0);
      
      return Math.abs(currentTimeMinutes - startTimeMinutes) < 60;
    });
  };

  const currentScheduleItem = getCurrentScheduleItem();

  // Toggle schedule item completion
  const toggleScheduleCompletion = (time: string) => {
    if (completedScheduleItems.includes(time)) {
      setCompletedScheduleItems(prev => prev.filter(t => t !== time));
    } else {
      setCompletedScheduleItems(prev => [...prev, time]);
    }
  };

  // Enhanced success metrics with time-based filtering
  const getSuccessMetrics = () => {
    const goals = items.filter(item => item.type === 'goal');
    const routines = items.filter(item => item.type === 'routine');
    const todos = items.filter(item => item.type === 'todo');
    
    // Calculate date ranges
    const weekStart = startOfWeek(today);
    const weekEnd = endOfWeek(today);
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);

    // Get period-specific data
    const getPeriodData = (period: 'today' | 'week' | 'month') => {
      let startDate: Date, endDate: Date;
      
      switch (period) {
        case 'today':
          startDate = today;
          endDate = today;
          break;
        case 'week':
          startDate = weekStart;
          endDate = weekEnd;
          break;
        case 'month':
          startDate = monthStart;
          endDate = monthEnd;
          break;
      }

      const periodTodos = todos.filter(item => {
        if (!item.dueDate) return false;
        const dueDate = item.dueDate instanceof Date ? item.dueDate : new Date(item.dueDate);
        if (isNaN(dueDate.getTime())) return false;
        
        // Compare dates at midnight to avoid timezone issues
        const dueDateMidnight = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
        const startDateMidnight = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
        const endDateMidnight = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
        
        return dueDateMidnight >= startDateMidnight && dueDateMidnight <= endDateMidnight;
      });

      const completedTodos = periodTodos.filter(item => item.completed);
      const todoCompletionRate = periodTodos.length > 0 
        ? Math.round((completedTodos.length / periodTodos.length) * 100)
        : 0;

      return {
        todos: periodTodos.length,
        completedTodos: completedTodos.length,
        todoCompletionRate,
        productivity: Math.round((completedTodos.length / Math.max(1, periodTodos.length)) * 100)
      };
    };

    const todayData = getPeriodData('today');
    const weekData = getPeriodData('week');
    const monthData = getPeriodData('month');

    // Enhanced metrics
    const avgGoalProgress = goals.length > 0 
      ? goals.reduce((sum, goal) => sum + (goal.metadata?.progress || 0), 0) / goals.length
      : 0;

    const avgStreakDays = routines.length > 0
      ? routines.reduce((sum, routine) => sum + (routine.metadata?.currentStreak || 0), 0) / routines.length
      : 0;

    // Yesterday's data for comparison with proper date handling
    const yesterday = subDays(today, 1);
    const yesterdayTodos = todos.filter(item => {
      if (!item.dueDate) return false;
      const dueDate = item.dueDate instanceof Date ? item.dueDate : new Date(item.dueDate);
      if (isNaN(dueDate.getTime())) return false;
      
      // Compare dates at midnight
      const dueDateMidnight = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
      const yesterdayMidnight = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
      
      return dueDateMidnight.getTime() === yesterdayMidnight.getTime();
    });
    const yesterdayCompleted = yesterdayTodos.filter(item => item.completed).length;
    const yesterdayRate = yesterdayTodos.length > 0 ? Math.round((yesterdayCompleted / yesterdayTodos.length) * 100) : 0;

    // Focus score (combination of all metrics)
    const focusScore = Math.round((avgGoalProgress + routineCompletionRate + todayData.todoCompletionRate + Math.min(avgStreakDays * 5, 100)) / 4);

    return {
      overallProgress: Math.round((avgGoalProgress + routineCompletionRate + todayData.todoCompletionRate) / 3),
      avgGoalProgress: Math.round(avgGoalProgress),
      avgStreakDays: Math.round(avgStreakDays),
      totalGoals: goals.length,
      activeRoutines: routines.length,
      focusScore,
      todayData,
      weekData,
      monthData,
      yesterdayRate,
      improvement: todayData.todoCompletionRate - yesterdayRate
    };
  };

  const metrics = getSuccessMetrics();

  // Achievement badges for header
  const getAchievementBadges = () => {
    const badges = [];
    if (todoCompletionRate === 100) badges.push({ icon: "🏆", text: "Todo Master", color: "bg-yellow-100 text-yellow-800 border-yellow-200" });
    if (routineCompletionRate >= 80) badges.push({ icon: "🔥", text: "Routine Legend", color: "bg-orange-100 text-orange-800 border-orange-200" });
    if (metrics.avgStreakDays >= 7) badges.push({ icon: "⚡", text: "Streak Warrior", color: "bg-blue-100 text-blue-800 border-blue-200" });
    if (metrics.avgGoalProgress >= 75) badges.push({ icon: "🎯", text: "Goal Crusher", color: "bg-purple-100 text-purple-800 border-purple-200" });
    return badges;
  };

  const achievementBadges = getAchievementBadges();

  // Handle mantra editing
  const handleMantraEdit = () => {
    setIsEditingMantra(!isEditingMantra);
  };

  const handleMantraChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPersonalMantra(e.target.value);
  };

  const handleMantraSubmit = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      setIsEditingMantra(false);
    }
  };

  // Enhanced time-based greeting with seasonal context
  const getTimeBasedGreeting = () => {
    const hour = currentTime.getHours();
    const month = currentTime.getMonth();
    
    // Seasonal context
    const season = month >= 2 && month <= 4 ? "Spring" :
                  month >= 5 && month <= 7 ? "Summer" :
                  month >= 8 && month <= 10 ? "Fall" : "Winter";
    
    const seasonalEmoji = season === "Spring" ? "🌸" :
                         season === "Summer" ? "☀️" :
                         season === "Fall" ? "🍂" : "❄️";

    if (hour < 6) return { 
      greeting: "Good Night", 
      emoji: "🌙", 
      message: "Rest well, tomorrow awaits", 
      icon: Moon,
      gradient: "from-indigo-900 to-purple-900"
    };
    if (hour < 12) return { 
      greeting: "Good Morning", 
      emoji: "🌅", 
      message: `Embrace this beautiful ${season} morning`, 
      icon: Sunrise,
      gradient: "from-orange-400 to-pink-400"
    };
    if (hour < 17) return { 
      greeting: "Good Afternoon", 
      emoji: seasonalEmoji, 
      message: "Power through with focused intention", 
      icon: Sun,
      gradient: "from-yellow-400 to-orange-400"
    };
    if (hour < 21) return { 
      greeting: "Good Evening", 
      emoji: "🌆", 
      message: "Finish strong and reflect on progress", 
      icon: Sunset,
      gradient: "from-purple-400 to-pink-400"
    };
    return { 
      greeting: "Good Night", 
      emoji: "🌙", 
      message: "Wind down and prepare for tomorrow", 
      icon: Moon,
      gradient: "from-indigo-600 to-purple-600"
    };
  };

  const timeGreeting = getTimeBasedGreeting();

  // Get motivational quote based on progress
  const getContextualMotivation = () => {
    const overallScore = metrics.overallProgress;
    
    if (overallScore >= 90) return "🚀 You're absolutely crushing it today!";
    if (overallScore >= 75) return "⭐ Excellence in motion - keep the momentum!";
    if (overallScore >= 60) return "💪 Strong progress - you're building something great!";
    if (overallScore >= 40) return "🌱 Growing stronger with every completed task!";
    return "🎯 Every small step counts - you've got this!";
  };

  const contextualMotivation = getContextualMotivation();

  // Daily flow editor functions
  const handleSaveDailyFlow = (newFlow: DailyFlowItem[]) => {
    setDailyFlow(newFlow);
    localStorage.setItem('dailyFlow', JSON.stringify(newFlow));
    console.log('Daily flow saved:', newFlow);
  };

  // Get insights based on current data
  const getSmartInsights = () => {
    const insights = [];
    
    // Removed improvement insights to clean up performance analytics section

    if (metrics.avgStreakDays >= 7) {
      insights.push({
        type: 'streak',
        icon: Flame,
        text: `Amazing ${metrics.avgStreakDays}-day average streak!`,
        color: 'orange'
      });
    }

    if (metrics.focusScore >= 85) {
      insights.push({
        type: 'focus',
        icon: Brain,
        text: 'Peak focus mode activated!',
        color: 'purple'
      });
    }


    return insights.slice(0, 2); // Show top 2 insights
  };

  const smartInsights = getSmartInsights();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 relative">
      {/* Enhanced animated background with mouse-reactive elements */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-20 left-20 w-72 h-72 bg-blue-400/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-400/5 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-emerald-400/5 rounded-full blur-3xl animate-pulse" style={{animationDelay: '4s'}}></div>
        
        {/* Subtle mouse-reactive gradient */}
        <div 
          className="absolute w-96 h-96 bg-gradient-radial from-blue-100/20 to-transparent rounded-full blur-3xl transition-all duration-1000 ease-out"
          style={{
            left: mousePosition.x - 192,
            top: mousePosition.y - 192,
          }}
        ></div>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        {/* Floating Header */}
        <div className="sticky top-6 z-[100] mb-8">
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center mb-2">
                  <div className="relative">
                    <span className="text-xl lg:text-2xl mr-2 relative z-10">{timeGreeting.emoji}</span>
                    <div className={`absolute inset-0 rounded-full bg-gradient-to-r ${timeGreeting.gradient} opacity-20 blur-md scale-150`}></div>
                  </div>
                  <h1 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-slate-800 to-blue-600 bg-clip-text text-transparent flex items-center">
                    <TrendingUp className="w-6 lg:w-7 h-6 lg:h-7 text-slate-700 mr-2 lg:mr-3" />
                    Life Execution
                </h1>
                </div>
                <div className="space-y-1">
                  <p className="text-slate-600 text-sm font-medium">
                    {timeGreeting.greeting} • {todayString}
                  </p>
                  <p className="text-slate-500 text-xs font-medium italic">
                    {timeGreeting.message} • {format(currentTime, 'h:mm a')}
                  </p>
                  <p className="text-blue-600 text-xs font-semibold mt-1">
                    {contextualMotivation}
                  </p>
                </div>
              </div>
              
              <div className="text-center lg:text-right">
                <div className="bg-gradient-to-br from-white to-blue-50/50 rounded-2xl p-3 lg:p-4 border border-slate-100/50 shadow-inner mb-2 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <div className="relative">
                    <div className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-slate-700 to-blue-500 bg-clip-text text-transparent">
                  {metrics.overallProgress}%
                    </div>
                    <div className="text-xs text-slate-500 font-semibold mt-1">Overall Progress</div>
                    
                    {/* Smaller progress ring */}
                    <div className="relative w-12 h-12 mx-auto mt-2">
                      <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 36 36">
                        <path
                          d="m18,2.0845 a 15.9155,15.9155 0 0,1 0,31.831 a 15.9155,15.9155 0 0,1 0,-31.831"
                          fill="none"
                          stroke="#e2e8f0"
                          strokeWidth="2"
                        />
                        <path
                          d="m18,2.0845 a 15.9155,15.9155 0 0,1 0,31.831 a 15.9155,15.9155 0 0,1 0,-31.831"
                          fill="none"
                          stroke="url(#progressGradient)"
                          strokeWidth="2"
                          strokeDasharray={`${metrics.overallProgress}, 100`}
                          className="transition-all duration-1000 ease-out"
                        />
                        <defs>
                          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#3b82f6" />
                            <stop offset="100%" stopColor="#8b5cf6" />
                          </linearGradient>
                        </defs>
                      </svg>
                    </div>
                  </div>
                </div>
                
                {/* Compact Achievement Badges */}
                {achievementBadges.length > 0 && (
                  <div className="flex flex-wrap gap-1 justify-center lg:justify-end">
                    {achievementBadges.slice(0, 2).map((badge, index) => (
                      <div 
                        key={index} 
                        className={`px-2 py-1 rounded-full text-xs font-bold border ${badge.color} animate-bounce shadow-sm backdrop-blur-sm`} 
                        style={{animationDelay: `${index * 0.2}s`}}
                      >
                        {badge.icon} {badge.text}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Success Metrics */}
        <div className="mb-3 lg:mb-4">
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/50 p-3 lg:p-4">
            {/* Metrics Header with Period Selector */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center">
                <BarChart3 className="w-5 h-5 mr-2 text-blue-600" />
                Performance Analytics
              </h3>
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                {(['today', 'week', 'month'] as const).map((period) => (
                  <button
                    key={period}
                    onClick={() => setViewPeriod(period)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all duration-200 ${
                      viewPeriod === period
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {period.charAt(0).toUpperCase() + period.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Smart Insights Bar */}
            {smartInsights.length > 0 && (
              <div className="mb-4 flex gap-2 overflow-x-auto">
                {smartInsights.map((insight, index) => {
                  const IconComponent = insight.icon;
                  return (
                    <div
                      key={index}
                      className={`flex items-center gap-2 px-3 py-2 bg-${insight.color}-50 text-${insight.color}-700 rounded-lg border border-${insight.color}-200 text-xs font-medium whitespace-nowrap flex-shrink-0`}
                    >
                      <IconComponent className="w-3 h-3" />
                      {insight.text}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 lg:gap-4">
              {(() => {
                const currentData = viewPeriod === 'today' ? metrics.todayData : 
                                  viewPeriod === 'week' ? metrics.weekData : metrics.monthData;
                
                return [
                  { 
                    label: `${viewPeriod === 'today' ? 'Today' : viewPeriod === 'week' ? 'This Week' : 'This Month'} Tasks`, 
                    value: currentData.todoCompletionRate, 
                    suffix: "%", 
                    color: "emerald", 
                    icon: CheckCircle,
                    bgFrom: "from-emerald-50/90",
                    bgTo: "to-green-50/90",
                    border: "border-emerald-100/60",
                    gradient: "from-emerald-400/10 to-green-400/10",
                    subtext: `${currentData.completedTodos}/${currentData.todos} completed`
                  },
                  { 
                    label: "Routines", 
                    value: routineCompletionRate, 
                    suffix: "%", 
                    color: "amber", 
                    icon: Flame,
                    bgFrom: "from-amber-50/90",
                    bgTo: "to-orange-50/90",
                    border: "border-amber-100/60",
                    gradient: "from-amber-400/10 to-orange-400/10",
                    subtext: `${metrics.activeRoutines} active`
                  },
                  { 
                    label: "Goals", 
                    value: metrics.avgGoalProgress, 
                    suffix: "%", 
                    color: "slate", 
                    icon: BowArrow,
                    bgFrom: "from-slate-50/90",
                    bgTo: "to-gray-50/90",
                    border: "border-slate-100/60",
                    gradient: "from-slate-400/10 to-gray-400/10",
                    subtext: `${metrics.totalGoals} goals tracked`
                  },
                  { 
                    label: "Streak", 
                    value: metrics.avgStreakDays, 
                    suffix: " days", 
                    color: "indigo", 
                    icon: TrendingUp,
                    bgFrom: "from-indigo-50/90",
                    bgTo: "to-blue-50/90",
                    border: "border-indigo-100/60",
                    gradient: "from-indigo-400/10 to-blue-400/10",
                    subtext: "average streak"
                  },
                  { 
                    label: "Focus Score", 
                    value: metrics.focusScore, 
                    suffix: "%", 
                    color: "purple", 
                    icon: Brain,
                    bgFrom: "from-purple-50/90",
                    bgTo: "to-violet-50/90",
                    border: "border-purple-100/60",
                    gradient: "from-purple-400/10 to-violet-400/10",
                    subtext: (() => {
                      const focusImprovement = metrics.focusScore - Math.round((
                        metrics.avgGoalProgress + 
                        routineCompletionRate + 
                        metrics.yesterdayRate + 
                        Math.min(metrics.avgStreakDays * 5, 100)
                      ) / 4);
                      
                      if (focusImprovement > 0) return `+${focusImprovement}% vs yesterday`;
                      if (focusImprovement < 0) return `${focusImprovement}% vs yesterday`;
                      return 'same as yesterday';
                    })()
                  }
                ];
              })().map((metric, index) => {
                const IconComponent = metric.icon;
                return (
                  <div 
                    key={metric.label}
                    className={`group bg-gradient-to-br ${metric.bgFrom} ${metric.bgTo} rounded-xl p-2 lg:p-3 border ${metric.border} transition-all duration-500 hover:scale-105 hover:shadow-lg cursor-pointer relative overflow-hidden`}
                    style={{animationDelay: `${index * 0.1}s`}}
                  >
                    <div className={`absolute inset-0 bg-gradient-to-r ${metric.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}></div>
                    <div className="relative flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-slate-600 mb-1">{metric.label}</p>
                        <p className={`text-lg lg:text-xl font-bold text-${metric.color}-600 mb-1`}>
                          {metric.value}{metric.suffix}
                        </p>
                        {metric.subtext && (
                          <p className="text-xs text-gray-500 mb-1">{metric.subtext}</p>
                        )}
                        <div className={`w-8 h-1 bg-${metric.color}-200 rounded-full overflow-hidden`}>
                          <div 
                            className={`h-full bg-${metric.color}-500 rounded-full transition-all duration-1000`} 
                            style={{
                              width: `${metric.label.includes("Streak") ? Math.min(metric.value * 10, 100) : metric.value}%`
                            }}
                          ></div>
                </div>
              </div>
                      <div className={`p-1 lg:p-2 bg-${metric.color}-100/60 rounded-xl group-hover:bg-${metric.color}-200/60 transition-all duration-300 group-hover:scale-110 group-hover:rotate-6`}>
                        <IconComponent className={`w-4 lg:w-5 h-4 lg:h-5 text-${metric.color}-500`} />
                </div>
              </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Compact Main Execution Duo */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4 mb-3 lg:mb-4">
          
          {/* Compact Today's Schedule */}
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg border border-white/50 p-3 lg:p-4 transition-all duration-700 hover:shadow-xl group">
            <div className="flex items-center justify-between mb-3 lg:mb-4">
              <div className="flex items-center">
                <div className="p-2 lg:p-3 bg-blue-100/60 rounded-xl mr-2 lg:mr-3 group-hover:bg-blue-200/60 transition-all duration-300 group-hover:scale-110">
                  <Clock className="w-4 lg:w-5 h-4 lg:h-5 text-blue-500" />
                </div>
                <h2 className="text-lg lg:text-xl font-bold text-slate-800">Today's Flow</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowFlowEditor(true)}
                  className="p-1.5 lg:p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-all duration-300 hover:scale-110"
                  title="Edit Daily Flow"
                >
                  <Settings className="w-4 lg:w-5 h-4 lg:h-5" />
                </button>
                <span className="text-xs font-bold text-blue-600 bg-blue-50/90 px-2 lg:px-3 py-1 lg:py-2 rounded-full border border-blue-100 animate-pulse">
                  {format(currentTime, 'h:mm a')}
                </span>
              </div>
            </div>
            <div className="space-y-2 lg:space-y-3">
              {dailySchedule.slice(0, 4).map((item, index) => {
                const isCompleted = completedScheduleItems.includes(item.time);
                const isCurrent = currentScheduleItem?.time === item.time;
                const category = categories.find(c => c.id === item.categoryId);
                
                return (
                  <div 
                    key={index} 
                    className={`group/item relative overflow-hidden rounded-xl p-2 lg:p-3 transition-all duration-500 cursor-pointer hover:scale-[1.02] ${
                      isCurrent ? 'bg-gradient-to-r from-blue-50/90 to-cyan-50/90 border-2 border-blue-200/60 shadow-lg animate-pulse' : 
                      isCompleted ? 'bg-gradient-to-r from-emerald-50/90 to-green-50/90 border border-emerald-200/60' : 
                      'bg-slate-50/60 border border-slate-200/60 hover:bg-white/90 hover:shadow-md'
                    }`}
                    onClick={() => toggleScheduleCompletion(item.time)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <p className={`font-bold text-base lg:text-lg ${
                            isCurrent ? 'text-blue-700' : 
                            isCompleted ? 'text-emerald-700' : 'text-slate-800'
                          }`}>
                            {item.time}
                          </p>
                          {isCurrent && <Zap className="w-4 lg:w-5 h-4 lg:h-5 text-blue-500 animate-bounce" />}
                        </div>
                        <p className={`text-sm font-semibold ${
                          isCurrent ? 'text-blue-600' : 
                          isCompleted ? 'text-emerald-600' : 'text-slate-600'
                        }`}>
                          {category?.icon} {item.activity}
                        </p>
                      </div>
                      <div className={`w-10 lg:w-12 h-10 lg:h-12 rounded-full border-2 lg:border-3 flex items-center justify-center transition-all duration-300 ${
                        isCompleted 
                          ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg' 
                          : 'border-slate-300 group-hover/item:border-blue-500 group-hover/item:shadow-md'
                      }`}>
                        {isCompleted && <CheckCircle className="w-5 lg:w-6 h-5 lg:h-6" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Compact Today's Focus */}
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg border border-white/50 p-3 lg:p-4 transition-all duration-700 hover:shadow-xl group">
            <div className="flex items-center justify-between mb-3 lg:mb-4">
              <div className="flex items-center">
                <div className="p-2 lg:p-3 bg-emerald-100/60 rounded-xl mr-2 lg:mr-3 group-hover:bg-emerald-200/60 transition-all duration-300 group-hover:scale-110">
                  <CheckCircle className="w-4 lg:w-5 h-4 lg:h-5 text-emerald-500" />
                </div>
                <h2 className="text-lg lg:text-xl font-bold text-slate-800">Today's Focus</h2>
              </div>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50/90 px-2 lg:px-3 py-1 lg:py-2 rounded-full border border-emerald-100">
                {todoCompletionRate}% Complete
              </span>
            </div>
            <div className="space-y-2 lg:space-y-3">
              {todaysTodos.length > 0 ? (
                todaysTodos.slice(0, 4).map((todo) => {
                  const category = categories.find(c => c.id === todo.categoryId);
                  return (
                    <div 
                      key={todo.id} 
                      className={`group/item relative overflow-hidden rounded-xl p-2 lg:p-3 transition-all duration-500 cursor-pointer hover:scale-[1.02] ${
                        todo.completed ? 'bg-gradient-to-r from-emerald-50/90 to-green-50/90 border border-emerald-200/60' : 
                        'bg-slate-50/60 border border-slate-200/60 hover:bg-white/90 hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`w-6 lg:w-7 h-6 lg:h-7 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                          todo.completed 
                            ? 'bg-emerald-500 border-emerald-500 text-white shadow-md' 
                            : 'border-slate-300 group-hover/item:border-emerald-500 group-hover/item:shadow-sm'
                        }`}>
                          {todo.completed && <CheckCircle className="w-4 lg:w-5 h-4 lg:h-5" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <p className={`font-bold text-sm lg:text-base ${
                              todo.completed ? 'text-emerald-700 line-through' : 'text-slate-800'
                            }`}>
                              {todo.title}
                            </p>
                            {todo.metadata?.priority === 'high' && (
                              <Star className="w-3 lg:w-4 h-3 lg:h-4 text-amber-500 animate-pulse flex-shrink-0" />
                            )}
                          </div>
                          <p className={`text-xs font-semibold ${
                            todo.completed ? 'text-emerald-600' : 'text-slate-600'
                          }`}>
                            {category?.icon} {todo.text}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-6 lg:py-8">
                  <div className="bg-gradient-to-br from-slate-50/60 to-blue-50/60 rounded-2xl p-4 lg:p-6">
                    <Award className="w-12 lg:w-16 h-12 lg:h-16 text-slate-300 mx-auto mb-3 lg:mb-4 animate-bounce" />
                    <p className="text-slate-500 font-bold text-base lg:text-lg">All clear for today</p>
                    <p className="text-xs text-slate-400 mt-1 lg:mt-2 font-medium">Focus on your routines and goals</p>
                  </div>
                </div>
              )}
            </div>
          </div>
              </div>

        {/* Compact Category Grid */}
        <div className="mb-3 lg:mb-4">
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg border border-white/50 p-3 lg:p-4">
            <div className="flex items-center justify-between mb-3 lg:mb-4">
              <h2 className="text-lg lg:text-xl font-bold text-slate-800 flex items-center">
                <Trophy className="w-4 lg:w-5 h-4 lg:h-5 text-amber-500 mr-2 lg:mr-3" />
                Life Categories
                <span className="ml-2 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                  Priority Ordered
              </span>
              </h2>
              <button 
                onClick={() => onNavigateToCategory('life-categories')}
                className="p-1 hover:bg-slate-100 rounded-full transition-all duration-300 hover:scale-110"
              >
                <ArrowRight className="w-4 lg:w-5 h-4 lg:h-5 text-slate-400 hover:text-slate-600" />
              </button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-3">
              {categories
                .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999))
                .map((category, index) => {
                  const categoryGoals = items.filter(item => 
                    item.type === 'goal' && item.categoryId === category.id
                  );
                  const avgProgress = categoryGoals.length > 0
                    ? Math.round(categoryGoals.reduce((sum, goal) => 
                        sum + (goal.metadata?.progress || 0), 0) / categoryGoals.length)
                    : 0;

                  return (
                    <button
                      key={category.id}
                      onClick={() => onNavigateToCategory(category.id)}
                      className="group relative overflow-hidden p-2 lg:p-3 rounded-2xl bg-white/60 border border-gray-200/60 hover:bg-white/90 transition-all duration-500 text-left hover:scale-105 shadow-md hover:shadow-lg"
                      style={{animationDelay: `${index * 0.1}s`}}
                    >
                      <div className="absolute top-0 left-0 w-full h-1 rounded-t-2xl transition-all duration-500" style={{ backgroundColor: category.color }}></div>
                      <div className="flex items-center justify-between mb-2 lg:mb-3">
                        <span className="text-lg lg:text-xl group-hover:scale-110 transition-transform duration-300">{category.icon}</span>
                        <div className="text-right">
                          <span className="text-xs font-bold px-2 py-1 rounded-full bg-gray-100/60 border border-gray-200" style={{ color: category.color }}>
                          {avgProgress}%
                        </span>
                        </div>
                      </div>
                      <p className="font-bold text-slate-800 text-sm lg:text-base mb-2">{category.name}</p>
                      <div className="w-full bg-gray-200/60 rounded-full h-1 lg:h-2 overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-700"
                          style={{ 
                            width: `${avgProgress}%`, 
                            backgroundColor: category.color 
                          }}
                        ></div>
                      </div>
                    </button>
                  );
                })}
            </div>
            </div>
          </div>

        {/* Compact Goals Section */}
        <div className="mb-3 lg:mb-4">
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg border border-white/50 p-3 lg:p-4">
            <div className="flex items-center justify-between mb-3 lg:mb-4">
              <h2 className="text-lg lg:text-xl font-bold text-slate-800 flex items-center">
                <BowArrow className="w-4 lg:w-5 h-4 lg:h-5 text-gray-900 mr-2 lg:mr-3" />
                Active Goals
            </h2>
              <span className="text-xs font-bold text-violet-600 bg-violet-50/90 px-2 lg:px-3 py-1 lg:py-2 rounded-full border border-violet-100">
                {metrics.avgGoalProgress}% Average Progress
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 lg:gap-3">
              {items
                .filter(item => item.type === 'goal')
                .slice(0, 6)
                .map((goal, index) => {
                  const category = categories.find(c => c.id === goal.categoryId);
                  const progress = goal.metadata?.progress || 0;
                  const isHighProgress = progress >= 75;
                  
                  return (
                    <div 
                      key={goal.id} 
                      className="group/item relative overflow-hidden rounded-xl p-2 lg:p-3 bg-slate-50/60 border border-slate-200/60 hover:bg-white/90 transition-all duration-500 cursor-pointer hover:scale-[1.02] hover:shadow-md"
                      onClick={() => onNavigateToCategory(goal.categoryId)}
                      style={{animationDelay: `${index * 0.1}s`}}
                    >
                      <div className="flex items-center justify-between mb-2 lg:mb-3">
                        <div className="flex items-center space-x-2 flex-1 min-w-0">
                          <span className="text-base lg:text-lg group-hover/item:scale-110 transition-transform duration-300 flex-shrink-0">{category?.icon}</span>
                          <p className="font-bold text-slate-800 text-xs lg:text-sm truncate">{goal.title}</p>
                          {isHighProgress && <Star className="w-3 lg:w-4 h-3 lg:h-4 text-amber-500 animate-pulse flex-shrink-0" />}
                        </div>
                        <span className="text-xs font-bold text-violet-600 ml-1">{progress}%</span>
                        </div>
                      <div className="w-full bg-slate-200/60 rounded-full h-2 lg:h-3 mb-1 lg:mb-2 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-1000 ${
                            progress >= 75 ? 'bg-gradient-to-r from-emerald-500 to-green-500' : 
                            progress >= 50 ? 'bg-gradient-to-r from-blue-500 to-cyan-500' : 
                            progress >= 25 ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 
                            'bg-gradient-to-r from-rose-500 to-pink-500'
                          }`}
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-slate-500 font-semibold truncate">{goal.metadata?.target}</p>
                    </div>
                  );
                })}
              </div>
          </div>
        </div>

        {/* Compact Personal Mantra Section */}
        <div className="text-center">
          <div className="bg-gradient-to-r from-slate-800 to-blue-700 rounded-2xl p-4 lg:p-6 text-white relative overflow-hidden shadow-xl">
            <div className="relative z-10">
              <div className="flex items-center justify-center mb-3 lg:mb-4">
                <Heart className="w-4 lg:w-5 h-4 lg:h-5 mr-2 lg:mr-3 text-pink-300 animate-pulse" />
                <span className="text-xs font-bold tracking-widest uppercase opacity-90">Personal Mantra</span>
                <button 
                  onClick={handleMantraEdit}
                  className="ml-2 lg:ml-3 p-1 lg:p-2 bg-white/10 backdrop-blur-sm rounded-full hover:bg-white/20 transition-all duration-300 hover:scale-110"
                >
                  <Edit3 className="w-3 lg:w-4 h-3 lg:h-4" />
                </button>
              </div>
              
              {isEditingMantra ? (
                <textarea
                  value={personalMantra}
                  onChange={handleMantraChange}
                  onKeyDown={handleMantraSubmit}
                  onBlur={() => setIsEditingMantra(false)}
                  className="w-full max-w-4xl mx-auto bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-2 lg:p-3 text-center text-base lg:text-lg font-medium text-white placeholder-white/60 resize-none"
                  rows={2}
                  autoFocus
                  placeholder="Enter your personal mantra..."
                />
              ) : (
                <p className="text-base lg:text-lg font-medium mb-3 lg:mb-4 max-w-4xl mx-auto leading-relaxed">
                  "{personalMantra}"
                </p>
              )}
              
              <div className="flex flex-wrap items-center justify-center gap-2 lg:gap-4 text-xs">
                {[
                  { icon: Sparkles, text: "Excellence Minded" },
                  { icon: BowArrow, text: "Goal Focused" },
                  { icon: TrendingUp, text: "Growth Oriented" }
                ].map((item, index) => {
                  const IconComponent = item.icon;
                  return (
                    <div 
                      key={item.text}
                      className="flex items-center space-x-1 lg:space-x-2 bg-white/15 backdrop-blur-sm rounded-full px-2 lg:px-4 py-1 lg:py-2 border border-white/20 hover:bg-white/20 transition-all duration-300 hover:scale-105"
                    >
                      <IconComponent className="w-3 lg:w-4 h-3 lg:h-4" />
                      <span className="font-semibold">{item.text}</span>
                </div>
                  );
                })}
              </div>
            </div>
            
            {/* Compact background pattern */}
            <div className="absolute inset-0 opacity-5">
              <div className="absolute top-6 right-6 w-24 h-24 border border-white rounded-full animate-pulse"></div>
              <div className="absolute bottom-6 left-6 w-20 h-20 border border-white rounded-full animate-pulse" style={{animationDelay: '1s'}}></div>
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-28 h-28 border border-white rounded-full animate-pulse" style={{animationDelay: '2s'}}></div>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Flow Editor Modal */}
      <DailyFlowEditor
        isOpen={showFlowEditor}
        onClose={() => setShowFlowEditor(false)}
        initialFlow={dailyFlow}
        categories={categories}
        onSave={handleSaveDailyFlow}
      />
    </div>
  );
};

export default Dashboard; 