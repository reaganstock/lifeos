import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, Plus, Clock, MapPin, X, Edit3, Save, ChevronLeft, ChevronRight, MoreHorizontal, Calendar, CalendarDays, CalendarCheck, CheckCircle, Flame, Copy, Filter, Settings, Sun, Sunset, Moon } from 'lucide-react';
import { Item, Category } from '../types';
import { copyToClipboard, showCopyFeedback } from '../utils/clipboard';

interface GlobalCalendarProps {
  items: Item[];
  setItems: React.Dispatch<React.SetStateAction<Item[]>>;
  categories: Category[];
}

const GlobalCalendar: React.FC<GlobalCalendarProps> = ({ items, setItems, categories }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [dateRangeFilter, setDateRangeFilter] = useState<'all' | 'today' | 'this_week' | 'this_month' | 'upcoming'>('all');
  const [timeFilter, setTimeFilter] = useState<'all' | 'morning' | 'afternoon' | 'evening' | 'all_day'>('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'recent' | 'startTime' | 'category'>('recent');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDateDetails, setShowDateDetails] = useState(false);
  const [editingEvent, setEditingEvent] = useState<string | null>(null);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  const [newEvent, setNewEvent] = useState({
    title: '',
    text: '',
    categoryId: categories[0]?.id || '',
    startTime: '',
    endTime: '',
    location: '',
    isRecurring: false,
    recurrencePattern: 'weekly' as 'daily' | 'weekly' | 'monthly' | 'yearly',
    recurrenceInterval: 1,
    recurrenceEndDate: ''
  });
  const [editEvent, setEditEvent] = useState({
    title: '',
    text: '',
    startTime: '',
    endTime: '',
    location: ''
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const events = items.filter(item => item.type === 'event');
  
  const filteredEvents = events.filter(event => {
    // Category filter
    const categoryMatch = selectedCategory === 'all' || event.categoryId === selectedCategory;
    
    // Date range filter
    const dateRangeMatch = dateRangeFilter === 'all' || (() => {
      if (!event.dateTime) return false;
      const eventDate = new Date(event.dateTime);
      const today = new Date();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      
      switch (dateRangeFilter) {
        case 'today':
          return eventDate.toDateString() === today.toDateString();
        case 'this_week':
          return eventDate >= weekStart && eventDate <= weekEnd;
        case 'this_month':
          return eventDate >= monthStart && eventDate <= monthEnd;
        case 'upcoming':
          return eventDate >= today;
        default:
          return true;
      }
    })();
    
    // Time filter
    const timeMatch = timeFilter === 'all' || (() => {
      if (!event.dateTime) return timeFilter === 'all_day';
      const eventDate = new Date(event.dateTime);
      const hour = eventDate.getHours();
      
      switch (timeFilter) {
        case 'morning':
          return hour >= 6 && hour < 12;
        case 'afternoon':
          return hour >= 12 && hour < 18;
        case 'evening':
          return hour >= 18 || hour < 6;
        case 'all_day':
          return hour === 0 && eventDate.getMinutes() === 0; // All-day events often set to midnight
        default:
          return true;
      }
    })();
    
    return categoryMatch && dateRangeMatch && timeMatch;
  });

  // Sort events
  const sortedEvents = [...filteredEvents].sort((a, b) => {
    switch (sortBy) {
      case 'recent':
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      case 'startTime':
        if (!a.dateTime && !b.dateTime) return 0;
        if (!a.dateTime) return 1;
        if (!b.dateTime) return -1;
        return new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime();
      case 'category':
        const catA = categories.find(c => c.id === a.categoryId);
        const catB = categories.find(c => c.id === b.categoryId);
        return (catA?.priority || 999) - (catB?.priority || 999);
      default:
        return 0;
    }
  });

  // Update newEvent categoryId when categories are loaded
  useEffect(() => {
    if (categories.length > 0 && !newEvent.categoryId) {
      setNewEvent(prev => ({ ...prev, categoryId: categories[0].id }));
    }
  }, [categories, newEvent.categoryId]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [editEvent.text]);

  const handleAddEvent = () => {
    if (!newEvent.title.trim() || !newEvent.startTime) return;
    
    if (newEvent.isRecurring) {
      // Handle recurring events
      const createdEvents: Item[] = [];
      const startDate = new Date(newEvent.startTime);
      const endDate = newEvent.recurrenceEndDate ? new Date(newEvent.recurrenceEndDate) : new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000); // Default 1 year
      
      // Calculate duration if endTime is provided
      let duration = 60; // Default 1 hour
      if (newEvent.endTime) {
        const endTime = new Date(newEvent.endTime);
        duration = Math.round((endTime.getTime() - startDate.getTime()) / (1000 * 60));
      }
      
      let currentDate = new Date(startDate);
      let occurrenceCount = 0;
      const maxOccurrences = 100;
      const recurrenceId = Date.now().toString();
      
      while (currentDate <= endDate && occurrenceCount < maxOccurrences) {
        const eventStartTime = new Date(currentDate);
        const eventEndTime = new Date(eventStartTime.getTime() + duration * 60 * 1000);
        
        const event: Item = {
          id: `${recurrenceId}-${occurrenceCount}`,
          categoryId: newEvent.categoryId,
          type: 'event',
          title: newEvent.title,
          text: newEvent.text,
          dateTime: eventStartTime,
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: {
            location: newEvent.location,
            startTime: eventStartTime,
            endTime: eventEndTime,
            isRecurring: true,
            recurrencePattern: newEvent.recurrencePattern,
            recurrenceInterval: newEvent.recurrenceInterval,
            recurrenceId: recurrenceId,
            occurrenceNumber: occurrenceCount + 1
          }
        };
        
        createdEvents.push(event);
        occurrenceCount++;
        
        // Calculate next occurrence
        switch (newEvent.recurrencePattern) {
          case 'daily':
            currentDate.setDate(currentDate.getDate() + newEvent.recurrenceInterval);
            break;
          case 'weekly':
            currentDate.setDate(currentDate.getDate() + (7 * newEvent.recurrenceInterval));
            break;
          case 'monthly':
            currentDate.setMonth(currentDate.getMonth() + newEvent.recurrenceInterval);
            break;
          case 'yearly':
            currentDate.setFullYear(currentDate.getFullYear() + newEvent.recurrenceInterval);
            break;
        }
      }
      
      setItems([...items, ...createdEvents]);
    } else {
      // Handle single events
      const event: Item = {
        id: Date.now().toString(),
        categoryId: newEvent.categoryId,
        type: 'event',
        title: newEvent.title,
        text: newEvent.text,
        dateTime: new Date(newEvent.startTime),
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          location: newEvent.location,
          startTime: new Date(newEvent.startTime),
          endTime: newEvent.endTime ? new Date(newEvent.endTime) : undefined
        }
      };
      
      setItems([...items, event]);
    }
    
    setNewEvent({
      title: '',
      text: '',
      categoryId: categories[0]?.id || '',
      startTime: '',
      endTime: '',
      location: '',
      isRecurring: false,
      recurrencePattern: 'weekly' as 'daily' | 'weekly' | 'monthly' | 'yearly',
      recurrenceInterval: 1,
      recurrenceEndDate: ''
    });
    setShowAddForm(false);
  };

  const startEditingEvent = (event: Item) => {
    setEditingEvent(event.id);
    setEditEvent({
      title: event.title,
      text: event.text,
      startTime: event.metadata?.startTime ? 
        new Date(event.metadata.startTime).toISOString().slice(0, 16) : 
        (event.dateTime ? event.dateTime.toISOString().slice(0, 16) : ''),
      endTime: event.metadata?.endTime ? 
        new Date(event.metadata.endTime).toISOString().slice(0, 16) : '',
      location: event.metadata?.location || ''
    });
  };

  const saveEditedEvent = (eventId: string) => {
    setItems(items.map(item => 
      item.id === eventId 
        ? { 
            ...item, 
            title: editEvent.title,
            text: editEvent.text,
            dateTime: editEvent.startTime ? new Date(editEvent.startTime) : undefined,
            metadata: { 
              ...item.metadata, 
              location: editEvent.location,
              startTime: editEvent.startTime ? new Date(editEvent.startTime) : undefined,
              endTime: editEvent.endTime ? new Date(editEvent.endTime) : undefined
            },
            updatedAt: new Date()
          }
        : item
    ));
    setEditingEvent(null);
  };

  const cancelEditing = () => {
    setEditingEvent(null);
    setEditEvent({
      title: '',
      text: '',
      startTime: '',
      endTime: '',
      location: ''
    });
  };

  const deleteEvent = (eventId: string) => {
    setItems(items.filter(item => item.id !== eventId));
    setExpandedEvent(null);
    setEditingEvent(null);
  };

  const getEventsForDate = (date: Date) => {
    return sortedEvents.filter(event => {
      if (!event.dateTime) return false;
      const eventDate = new Date(event.dateTime);
      return eventDate.toDateString() === date.toDateString();
    });
  };

  const isToday = (date: Date) => {
    return date.toDateString() === new Date().toDateString();
  };

  const isViewingToday = () => {
    const today = new Date();
    if (viewMode === 'month') {
      return currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear();
    } else if (viewMode === 'week') {
      const weekDays = getWeekDays(currentDate);
      return weekDays.some(day => isToday(day));
    } else if (viewMode === 'day') {
      return isToday(currentDate);
    }
    return false;
  };

  const isPast = (date: Date) => {
    return date < new Date() && !isToday(date);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatTimeRange = (event: Item) => {
    const startTime = event.metadata?.startTime ? new Date(event.metadata.startTime) : event.dateTime;
    const endTime = event.metadata?.endTime ? new Date(event.metadata.endTime) : null;
    
    if (!startTime) return '';
    
    if (endTime) {
      return `${formatTime(startTime)} - ${formatTime(endTime)}`;
    } else {
      return formatTime(startTime);
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  const getWeekDays = (date: Date) => {
    const startOfWeek = new Date(date);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day;
    startOfWeek.setDate(diff);
    
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (viewMode === 'month') {
        newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
      } else if (viewMode === 'week') {
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
      } else if (viewMode === 'day') {
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
      }
      return newDate;
    });
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setShowDateDetails(true);
  };

  const getDateRangeText = () => {
    if (viewMode === 'month') {
      return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else if (viewMode === 'week') {
      const weekDays = getWeekDays(currentDate);
      const start = weekDays[0];
      const end = weekDays[6];
      if (start.getMonth() === end.getMonth()) {
        return `${start.toLocaleDateString('en-US', { month: 'long' })} ${start.getDate()}-${end.getDate()}, ${start.getFullYear()}`;
      } else {
        return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${end.getFullYear()}`;
      }
    } else {
      return currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }
  };

  const todayEvents = getEventsForDate(new Date());
  const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  const renderMonthView = () => (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
      {/* Days of Week Header */}
      <div className="grid grid-cols-7 border-b border-gray-200">
        {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
          <div key={day} className="p-4 text-center text-sm font-semibold text-gray-600 bg-gray-50">
            {day}
          </div>
        ))}
      </div>
      
      {/* Calendar Days */}
      <div className="grid grid-cols-7">
        {getDaysInMonth(currentDate).map((date, index) => {
          if (!date) {
            return (
              <div key={index} className="h-32 border-r border-b border-gray-100 bg-gray-25">
              </div>
            );
          }
          
          const dayEvents = getEventsForDate(date);
          const isCurrentDay = isToday(date);
          const isPastDay = isPast(date);
          
          return (
            <div
              key={date.toISOString()}
              className={`h-32 border-r border-b border-gray-100 p-2 cursor-pointer transition-all duration-200 hover:bg-blue-50 ${
                isCurrentDay ? 'bg-blue-50' : isPastDay ? 'bg-gray-25' : 'bg-white'
              }`}
              onClick={() => handleDateClick(date)}
            >
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium mb-2 ${
                isCurrentDay 
                  ? 'bg-blue-500 text-white' 
                  : isPastDay 
                    ? 'text-gray-400' 
                    : 'text-gray-700 hover:bg-gray-100'
              }`}>
                {date.getDate()}
              </div>
              
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map(event => {
                  const category = categories.find(c => c.id === event.categoryId);
                  return (
                    <div
                      key={event.id}
                      className="text-xs p-1 rounded text-white font-medium truncate"
                      style={{ backgroundColor: category?.color || '#3b82f6' }}
                      title={`${event.title} - ${formatTimeRange(event)}`}
                    >
                      {formatTimeRange(event)} {event.title}
                    </div>
                  );
                })}
                {dayEvents.length > 3 && (
                  <div className="text-xs text-gray-500 font-medium flex items-center">
                    <MoreHorizontal className="w-3 h-3 mr-1" />
                    {dayEvents.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderWeekView = () => {
    const weekDays = getWeekDays(currentDate);
    const hours = Array.from({ length: 24 }, (_, i) => i);
    
    return (
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
        {/* Week Header */}
        <div className="grid grid-cols-8 border-b border-gray-200">
          <div className="p-4 text-center text-sm font-semibold text-gray-600 bg-gray-50">Time</div>
          {weekDays.map(day => {
            const isCurrentDay = isToday(day);
            return (
              <div key={day.toISOString()} className={`p-4 text-center text-sm font-semibold border-l border-gray-200 ${
                isCurrentDay ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-600'
              }`}>
                <div>{day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                <div className={`text-lg font-bold ${isCurrentDay ? 'text-blue-600' : 'text-gray-800'}`}>
                  {day.getDate()}
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Week Grid */}
        <div className="max-h-96 overflow-y-auto">
          {hours.map(hour => (
            <div key={hour} className="grid grid-cols-8 border-b border-gray-100">
              <div className="p-2 text-xs text-gray-500 bg-gray-50 border-r border-gray-200 text-center">
                {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
              </div>
              {weekDays.map(day => {
                const dayEvents = getEventsForDate(day).filter(event => {
                  if (!event.dateTime) return false;
                  return new Date(event.dateTime).getHours() === hour;
                });
                
                return (
                  <div key={`${day.toISOString()}-${hour}`} className="p-1 border-l border-gray-200 min-h-[60px] relative">
                    {dayEvents.map(event => {
                      const category = categories.find(c => c.id === event.categoryId);
                      return (
                        <div
                          key={event.id}
                          className="text-xs p-2 rounded mb-1 text-white font-medium cursor-pointer hover:opacity-80"
                          style={{ backgroundColor: category?.color || '#3b82f6' }}
                          onClick={() => startEditingEvent(event)}
                          title={event.title}
                        >
                          <div className="truncate">{event.title}</div>
                          <div className="text-xs opacity-90">
                            {formatTimeRange(event)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const dayEvents = getEventsForDate(currentDate).sort((a, b) => {
      const timeA = a.dateTime ? new Date(a.dateTime).getTime() : 0;
      const timeB = b.dateTime ? new Date(b.dateTime).getTime() : 0;
      return timeA - timeB;
    });
    
    return (
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
        {/* Day Header */}
        <div className="p-6 bg-gradient-to-r from-blue-500 to-indigo-500 text-white">
          <h3 className="text-2xl font-bold">
            {currentDate.toLocaleDateString('en-US', { 
              weekday: 'long', 
              month: 'long', 
              day: 'numeric',
              year: 'numeric'
            })}
          </h3>
          <p className="text-blue-100 mt-1">
            {dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''} scheduled
          </p>
        </div>
        
        {/* Day Events */}
        <div className="p-6 max-h-96 overflow-y-auto">
          {dayEvents.length > 0 ? (
            <div className="space-y-4">
              {dayEvents.map(event => {
                const category = categories.find(c => c.id === event.categoryId);
                const isEditing = editingEvent === event.id;
                
                return (
                  <div
                    key={event.id}
                    className="p-4 border border-gray-200 rounded-xl hover:shadow-md transition-all duration-300"
                  >
                    {isEditing ? (
                      <div className="space-y-4">
                        <input
                          type="text"
                          value={editEvent.title}
                          onChange={(e) => setEditEvent(prev => ({ ...prev, title: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Event title..."
                        />
                        <textarea
                          ref={textareaRef}
                          value={editEvent.text}
                          onChange={(e) => setEditEvent(prev => ({ ...prev, text: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                          placeholder="Event description..."
                          rows={2}
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <input
                            type="datetime-local"
                            value={editEvent.startTime}
                            onChange={(e) => setEditEvent(prev => ({ ...prev, startTime: e.target.value }))}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <input
                            type="datetime-local"
                            value={editEvent.endTime}
                            onChange={(e) => setEditEvent(prev => ({ ...prev, endTime: e.target.value }))}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <input
                            type="text"
                            value={editEvent.location}
                            onChange={(e) => setEditEvent(prev => ({ ...prev, location: e.target.value }))}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Location..."
                          />
                        </div>
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={cancelEditing}
                            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => saveEditedEvent(event.id)}
                            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center"
                          >
                            <Save className="w-4 h-4 mr-2" />
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 flex-1">
                          <div 
                            className="w-4 h-4 rounded-full mt-1 flex-shrink-0"
                            style={{ backgroundColor: category?.color }}
                          />
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-800 text-lg">{event.title}</h4>
                            {event.text && (
                              <p className="text-gray-600 mt-1">{event.text}</p>
                            )}
                            <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                              <div className="flex items-center">
                                <Clock className="w-4 h-4 text-gray-400" />
                                <span className="text-gray-600 font-mono">
                                  {formatTimeRange(event)}
                                </span>
                              </div>
                              {event.metadata?.location && (
                                <div className="flex items-center">
                                  <MapPin className="w-4 h-4 mr-1" />
                                  {event.metadata.location}
                                </div>
                              )}
                              <div className="flex items-center">
                                <span className="text-xs">{category?.icon} {category?.name}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex space-x-2 ml-4">
                          <button
                            onClick={() => startEditingEvent(event)}
                            className="p-2 hover:bg-yellow-100 rounded-lg transition-colors"
                          >
                            <Edit3 className="w-4 h-4 text-yellow-600" />
                          </button>
                          <button
                            onClick={() => deleteEvent(event.id)}
                            className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <CalendarIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h4 className="text-lg font-semibold text-gray-600 mb-2">No events</h4>
              <p className="text-gray-500">No events scheduled for this date</p>
              <button
                onClick={() => {
                  setNewEvent(prev => ({
                    ...prev,
                    dateTime: currentDate.toISOString().slice(0, 16)
                  }));
                  setShowAddForm(true);
                }}
                className="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Add Event
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="p-6 max-w-7xl mx-auto">
        {/* Floating Header */}
        <div className="sticky top-6 z-40 mb-8">
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent flex items-center">
                  <CalendarIcon className="w-10 h-10 text-blue-600 mr-4" />
                  Calendar
                </h1>
                <p className="text-gray-600 mt-2 text-lg">
                  {todayEvents.length} events today • Apple-style calendar experience
                </p>
              </div>
              <button
                onClick={() => setShowAddForm(true)}
                className="group relative overflow-hidden bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white px-8 py-4 rounded-2xl flex items-center transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
              >
                <div className="absolute inset-0 bg-white/20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                <Plus className="w-5 h-5 mr-3 relative z-10" />
                <span className="font-semibold relative z-10">Add Event</span>
              </button>
            </div>
          </div>
        </div>

        {/* Advanced Filter & Search Controls */}
        <div className="mb-6">
          <div className="bg-white/60 backdrop-blur-xl rounded-2xl shadow-lg border border-white/30 p-6">
            {/* Header with Advanced Filter Toggle */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                <Filter className="w-5 h-5 mr-2 text-blue-600" />
                Filter & Search
              </h3>
              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 ${
                  showAdvancedFilters 
                    ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Settings className="w-4 h-4" />
                Advanced
              </button>
            </div>

            {/* Basic Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              {/* Category Filter */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-4 py-4 bg-white/70 border border-gray-200/50 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300 text-gray-800"
                >
                  <option value="all">All Categories</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.icon} {category.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Range Filter */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Date Range</label>
                <select
                  value={dateRangeFilter}
                  onChange={(e) => setDateRangeFilter(e.target.value as 'all' | 'today' | 'this_week' | 'this_month' | 'upcoming')}
                  className="w-full px-4 py-4 bg-white/70 border border-gray-200/50 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300 text-gray-800"
                >
                  <option value="all">All Dates</option>
                  <option value="today">📅 Today</option>
                  <option value="this_week">📆 This Week</option>
                  <option value="this_month">🗓️ This Month</option>
                  <option value="upcoming">🚀 Upcoming</option>
                </select>
              </div>

              {/* Sort Options */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Sort by</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'recent' | 'startTime' | 'category')}
                  className="w-full px-4 py-4 bg-white/70 border border-gray-200/50 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300 text-gray-800"
                >
                  <option value="recent">🕒 Most Recent</option>
                  <option value="startTime">⏰ Start Time</option>
                  <option value="category">📁 Category</option>
                </select>
              </div>
            </div>

            {/* Advanced Filters */}
            {showAdvancedFilters && (
              <div className="border-t border-gray-200/50 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Time of Day Filter */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 flex items-center">
                      <Sun className="w-4 h-4 mr-2 text-blue-600" />
                      Time of Day
                    </label>
                    <select
                      value={timeFilter}
                      onChange={(e) => setTimeFilter(e.target.value as 'all' | 'morning' | 'afternoon' | 'evening' | 'all_day')}
                      className="w-full px-4 py-4 bg-white/70 border border-gray-200/50 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300 text-gray-800"
                    >
                      <option value="all">All Times</option>
                      <option value="morning">🌅 Morning (6AM-12PM)</option>
                      <option value="afternoon">☀️ Afternoon (12PM-6PM)</option>
                      <option value="evening">🌆 Evening (6PM-6AM)</option>
                      <option value="all_day">📅 All Day Events</option>
                    </select>
                  </div>

                  {/* Event Stats */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Event Stats</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{sortedEvents.length}</div>
                        <div className="text-gray-600">Total Events</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-indigo-600">{sortedEvents.filter(e => e.dateTime && new Date(e.dateTime).toDateString() === new Date().toDateString()).length}</div>
                        <div className="text-gray-600">Today</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Active Filters Summary */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedCategory !== 'all' && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Category: {categories.find(c => c.id === selectedCategory)?.name}
                      <button
                        onClick={() => setSelectedCategory('all')}
                        className="ml-2 text-blue-600 hover:text-blue-800"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {dateRangeFilter !== 'all' && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Date: {dateRangeFilter.replace('_', ' ').charAt(0).toUpperCase() + dateRangeFilter.replace('_', ' ').slice(1)}
                      <button
                        onClick={() => setDateRangeFilter('all')}
                        className="ml-2 text-green-600 hover:text-green-800"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {timeFilter !== 'all' && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      Time: {timeFilter.replace('_', ' ').charAt(0).toUpperCase() + timeFilter.replace('_', ' ').slice(1)}
                      <button
                        onClick={() => setTimeFilter('all')}
                        className="ml-2 text-purple-600 hover:text-purple-800"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

              {/* Calendar Navigation */}
        <div className="mb-6">
          <div className="bg-white/60 backdrop-blur-xl rounded-xl shadow-lg border border-white/30 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => navigateDate('prev')}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-600" />
                </button>
                <h2 className="text-2xl font-bold text-gray-800">
                  {getDateRangeText()}
                </h2>
                <button
                  onClick={() => navigateDate('next')}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-gray-600" />
                </button>
              </div>
              
                <div className="flex items-center space-x-4">
                {/* View Mode Selector */}
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('month')}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center ${
                      viewMode === 'month' 
                        ? 'bg-white text-blue-600 shadow-sm' 
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    <Calendar className="w-4 h-4 mr-1" />
                    Month
                  </button>
                  <button
                    onClick={() => setViewMode('week')}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center ${
                      viewMode === 'week' 
                        ? 'bg-white text-blue-600 shadow-sm' 
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    <CalendarDays className="w-4 h-4 mr-1" />
                    Week
                  </button>
                  <button
                    onClick={() => setViewMode('day')}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center ${
                      viewMode === 'day' 
                        ? 'bg-white text-blue-600 shadow-sm' 
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    <CalendarCheck className="w-4 h-4 mr-1" />
                    Day
                  </button>
              </div>

                <button
                  onClick={() => setCurrentDate(new Date())}
                  disabled={isViewingToday()}
                  className={`px-4 py-2 rounded-lg transition-all duration-200 font-medium shadow-sm ${
                    isViewingToday() 
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                      : 'bg-blue-500 hover:bg-blue-600 text-white hover:shadow-md'
                  }`}
                >
                  Today
                </button>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Categories</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.icon} {category.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Calendar Views */}
        {viewMode === 'month' && renderMonthView()}
        {viewMode === 'week' && renderWeekView()}
        {viewMode === 'day' && renderDayView()}

        {/* Today's Events Section - Only show in month view */}
        {viewMode === 'month' && todayEvents.length > 0 && (
          <div className="mt-8">
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/30 p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <Clock className="w-6 h-6 text-blue-600 mr-3" />
                Today's Events
              </h3>
              <div className="space-y-3">
                {todayEvents
                  .sort((a, b) => new Date(a.dateTime!).getTime() - new Date(b.dateTime!).getTime())
                  .map(event => {
                  const category = categories.find(c => c.id === event.categoryId);
                  return (
                    <div
                      key={event.id}
                        className="flex items-center space-x-4 p-4 bg-white rounded-xl border border-gray-200 hover:shadow-md transition-all duration-300"
                    >
                      <div 
                          className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: category?.color }}
                      />
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-800">{event.title}</h4>
                          {event.text && <p className="text-sm text-gray-600">{event.text}</p>}
                      </div>
                      <div className="text-right">
                          <div className="text-sm font-medium text-blue-600">
                          {formatTimeRange(event)}
                        </div>
                        {event.metadata?.location && (
                          <div className="text-xs text-gray-500 flex items-center">
                            <MapPin className="w-3 h-3 mr-1" />
                            {event.metadata.location}
                          </div>
                        )}
                      </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => startEditingEvent(event)}
                            className="p-2 hover:bg-yellow-100 rounded-lg transition-colors"
                          >
                            <Edit3 className="w-4 h-4 text-yellow-600" />
                          </button>
                          <button
                            onClick={() => deleteEvent(event.id)}
                            className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Date Details Modal (Apple Calendar Style) */}
        {showDateDetails && selectedDate && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-2xl w-full max-h-[80vh] overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500 to-indigo-500 p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold">
                      {selectedDate.toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        month: 'long', 
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </h3>
                    <p className="text-blue-100 mt-1">
                      {selectedDateEvents.length} event{selectedDateEvents.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowDateDetails(false)}
                    className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
              
              <div className="p-6 max-h-96 overflow-y-auto">
                {selectedDateEvents.length > 0 ? (
                  <div className="space-y-4">
                    {selectedDateEvents
                      .sort((a, b) => new Date(a.dateTime!).getTime() - new Date(b.dateTime!).getTime())
                      .map(event => {
                        const category = categories.find(c => c.id === event.categoryId);
              return (
                <div
                  key={event.id}
                            className="p-4 border border-gray-200 rounded-xl hover:shadow-md transition-all duration-300"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-start space-x-3 flex-1">
                                <div 
                                  className="w-4 h-4 rounded-full mt-1 flex-shrink-0"
                                  style={{ backgroundColor: category?.color }}
                                />
                                <div className="flex-1">
                                  <h4 className="font-semibold text-gray-800 text-lg">{event.title}</h4>
                                  {event.text && (
                                    <p className="text-gray-600 mt-1">{event.text}</p>
                                  )}
                                  <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                                    <div className="flex items-center">
                                      <Clock className="w-4 h-4 text-gray-400" />
                                      <span className="text-gray-600 font-mono">
                                        {formatTimeRange(event)}
                                      </span>
                                    </div>
                                    {event.metadata?.location && (
                                      <div className="flex items-center">
                                        <MapPin className="w-4 h-4 mr-1" />
                                        {event.metadata.location}
                                      </div>
                                    )}
                                    <div className="flex items-center">
                                      <span className="text-xs">{category?.icon} {category?.name}</span>
                                    </div>
                                  </div>
                                </div>
                      </div>
                              <div className="flex space-x-2 ml-4">
                          <button
                                  onClick={async (e) => {
                                    const success = await copyToClipboard(event.id);
                                    if (success) {
                                      showCopyFeedback(e.target as HTMLElement);
                                    }
                                  }}
                                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                  title="Copy ID for AI chat"
                                >
                                  <Copy className="w-4 h-4 text-gray-500" />
                          </button>
                          <button
                                  onClick={() => startEditingEvent(event)}
                                  className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                                >
                                  <Edit3 className="w-4 h-4 text-blue-500" />
                          </button>
                        <button
                                  onClick={() => deleteEvent(event.id)}
                          className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                        >
                          <X className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </div>
                          </div>
                        );
                      })}
                          </div>
                ) : (
                  <div className="text-center py-12">
                    <CalendarIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h4 className="text-lg font-semibold text-gray-600 mb-2">No events</h4>
                    <p className="text-gray-500">No events scheduled for this date</p>
                          <button
                      onClick={() => {
                        setNewEvent(prev => ({
                          ...prev,
                          dateTime: selectedDate.toISOString().slice(0, 16)
                        }));
                        setShowDateDetails(false);
                        setShowAddForm(true);
                      }}
                      className="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      Add Event
                          </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Add Event Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-2xl w-full">
              <div className="bg-gradient-to-r from-blue-500 to-indigo-500 p-6 text-white rounded-t-2xl">
              <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-bold">Add New Event</h3>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Event Title *</label>
                <input
                  type="text"
                  value={newEvent.title}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter event title..."
                  autoFocus
                />
              </div>
              
              <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                <textarea
                  value={newEvent.text}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, text: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-24 resize-none"
                    placeholder="Event description..."
                />
              </div>
              
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Start Time *</label>
                    <input
                      type="datetime-local"
                      value={newEvent.startTime}
                      onChange={(e) => setNewEvent(prev => ({ ...prev, startTime: e.target.value }))}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">End Time</label>
                    <input
                      type="datetime-local"
                      value={newEvent.endTime}
                      onChange={(e) => setNewEvent(prev => ({ ...prev, endTime: e.target.value }))}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Category</label>
                    <select
                      value={newEvent.categoryId}
                      onChange={(e) => setNewEvent(prev => ({ ...prev, categoryId: e.target.value }))}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {categories.map(category => (
                        <option key={category.id} value={category.id}>
                          {category.icon} {category.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Location</label>
                  <input
                    type="text"
                    value={newEvent.location}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, location: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Event location..."
                  />
                </div>
                
                {/* Recurring Event Options */}
                <div className="border-t border-gray-200 pt-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <input
                      type="checkbox"
                      id="isRecurring"
                      checked={newEvent.isRecurring}
                      onChange={(e) => setNewEvent(prev => ({ ...prev, isRecurring: e.target.checked }))}
                      className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                    />
                    <label htmlFor="isRecurring" className="text-sm font-semibold text-gray-700">
                      Make this a recurring event
                    </label>
                  </div>
                  
                  {newEvent.isRecurring && (
                    <div className="grid grid-cols-2 gap-4 ml-8">
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-2">Repeat</label>
                        <select
                          value={newEvent.recurrencePattern}
                          onChange={(e) => setNewEvent(prev => ({ ...prev, recurrencePattern: e.target.value as 'daily' | 'weekly' | 'monthly' | 'yearly' }))}
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                          <option value="yearly">Yearly</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-2">Every</label>
                        <select
                          value={newEvent.recurrenceInterval}
                          onChange={(e) => setNewEvent(prev => ({ ...prev, recurrenceInterval: parseInt(e.target.value) }))}
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value={1}>1</option>
                          <option value={2}>2</option>
                          <option value={3}>3</option>
                          <option value={4}>4</option>
                        </select>
                        <span className="text-xs text-gray-500 mt-1 block">
                          {newEvent.recurrencePattern === 'daily' && `day${newEvent.recurrenceInterval > 1 ? 's' : ''}`}
                          {newEvent.recurrencePattern === 'weekly' && `week${newEvent.recurrenceInterval > 1 ? 's' : ''}`}
                          {newEvent.recurrencePattern === 'monthly' && `month${newEvent.recurrenceInterval > 1 ? 's' : ''}`}
                          {newEvent.recurrencePattern === 'yearly' && `year${newEvent.recurrenceInterval > 1 ? 's' : ''}`}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-600 mb-2">End Date (optional)</label>
                        <input
                          type="date"
                          value={newEvent.recurrenceEndDate}
                          onChange={(e) => setNewEvent(prev => ({ ...prev, recurrenceEndDate: e.target.value }))}
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          min={newEvent.startTime ? newEvent.startTime.split('T')[0] : new Date().toISOString().split('T')[0]}
                        />
                        <p className="text-xs text-gray-500 mt-1">Leave empty to repeat indefinitely</p>
                      </div>
                    </div>
                  )}
                </div>
            
                <div className="flex justify-end space-x-4 pt-4">
              <button
                onClick={() => setShowAddForm(false)}
                    className="px-6 py-3 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddEvent}
                    className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white px-8 py-3 rounded-xl transition-all duration-300"
              >
                    Add Event
              </button>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Event Modal */}
      {editingEvent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-2xl w-full">
            <div className="bg-gradient-to-r from-orange-500 to-red-500 p-6 text-white rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold">Edit Event</h3>
                <button
                  onClick={cancelEditing}
                  className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Event Title *</label>
                <input
                  type="text"
                  value={editEvent.title}
                  onChange={(e) => setEditEvent(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="Enter event title..."
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                <textarea
                  ref={textareaRef}
                  value={editEvent.text}
                  onChange={(e) => setEditEvent(prev => ({ ...prev, text: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 h-24 resize-none"
                  placeholder="Event description..."
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Date & Time *</label>
                  <input
                    type="datetime-local"
                    value={editEvent.startTime}
                    onChange={(e) => setEditEvent(prev => ({ ...prev, startTime: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">End Time</label>
                  <input
                    type="datetime-local"
                    value={editEvent.endTime}
                    onChange={(e) => setEditEvent(prev => ({ ...prev, endTime: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Location</label>
                  <input
                    type="text"
                    value={editEvent.location}
                    onChange={(e) => setEditEvent(prev => ({ ...prev, location: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Event location..."
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-4 pt-4">
                <button
                  onClick={cancelEditing}
                  className="px-6 py-3 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => saveEditedEvent(editingEvent)}
                  className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-8 py-3 rounded-xl transition-all duration-300 flex items-center"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default GlobalCalendar; 