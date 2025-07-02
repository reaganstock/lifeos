import React, { useState, useEffect } from 'react';
import { RotateCcw, Plus, CheckCircle, X, Save, Filter, Calendar, Flame, Printer, Copy, Edit3, Trash2, Settings } from 'lucide-react';
import { Item, Category } from '../types';
import { copyToClipboard, showCopyFeedback } from '../utils/clipboard';

interface GlobalRoutinesProps {
  items: Item[];
  setItems: React.Dispatch<React.SetStateAction<Item[]>>;
  categories: Category[];
}

type FrequencyType = 'daily' | 'weekly' | 'monthly' | 'yearly';

const GlobalRoutines: React.FC<GlobalRoutinesProps> = ({ items, setItems, categories }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedFrequency, setSelectedFrequency] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'frequency' | 'category' | 'streak'>('recent');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [completionFilter, setCompletionFilter] = useState<'all' | 'completed' | 'incomplete'>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<string | null>(null);
  const [viewingRoutine, setViewingRoutine] = useState<string | null>(null);
  const [newRoutine, setNewRoutine] = useState({
    title: '',
    text: '',
    categoryId: categories[0]?.id || '',
    frequency: 'daily' as FrequencyType,
    duration: 30
  });
  const [editRoutine, setEditRoutine] = useState({
    title: '',
    text: '',
    frequency: 'daily' as FrequencyType,
    duration: 30
  });

  const routines = items.filter(item => item.type === 'routine');
  
  // Filter routines by category, frequency, and completion status
  const filteredRoutines = routines.filter(routine => {
    const categoryMatch = selectedCategory === 'all' || routine.categoryId === selectedCategory;
    const frequencyMatch = selectedFrequency === 'all' || routine.metadata?.frequency === selectedFrequency;
    const completionMatch = completionFilter === 'all' || 
      (completionFilter === 'completed' && routine.metadata?.completedToday) ||
      (completionFilter === 'incomplete' && !routine.metadata?.completedToday);
    return categoryMatch && frequencyMatch && completionMatch;
  });

  // Sort routines
  const sortedRoutines = [...filteredRoutines].sort((a, b) => {
    switch (sortBy) {
      case 'recent':
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      case 'frequency':
        const freqOrder = { 'daily': 1, 'weekly': 2, 'monthly': 3, 'yearly': 4 };
        return (freqOrder[a.metadata?.frequency as keyof typeof freqOrder] || 5) - 
               (freqOrder[b.metadata?.frequency as keyof typeof freqOrder] || 5);
      case 'category':
        const categoryA = categories.find(c => c.id === a.categoryId)?.name || '';
        const categoryB = categories.find(c => c.id === b.categoryId)?.name || '';
        return categoryA.localeCompare(categoryB);
      case 'streak':
        return (b.metadata?.currentStreak || 0) - (a.metadata?.currentStreak || 0);
      default:
        return 0;
    }
  });

  // Group routines by frequency for better organization
  const groupedRoutines = sortedRoutines.reduce((groups, routine) => {
    const frequency = routine.metadata?.frequency || 'daily';
    if (!groups[frequency]) {
      groups[frequency] = [];
    }
    groups[frequency].push(routine);
    return groups;
  }, {} as Record<string, Item[]>);

  const frequencies: FrequencyType[] = ['daily', 'weekly', 'monthly', 'yearly'];

  // Update newRoutine categoryId when categories are loaded
  useEffect(() => {
    if (categories.length > 0 && !newRoutine.categoryId) {
      setNewRoutine(prev => ({ ...prev, categoryId: categories[0].id }));
    }
  }, [categories, newRoutine.categoryId]);

  const handleAddRoutine = () => {
    if (!newRoutine.title.trim()) return;
    
    const routine: Item = {
      id: Date.now().toString(),
      categoryId: newRoutine.categoryId,
      type: 'routine',
      title: newRoutine.title,
      text: newRoutine.text,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        frequency: newRoutine.frequency,
        duration: newRoutine.duration,
        currentStreak: 0,
        bestStreak: 0,
        completedToday: false
      }
    };
    
    setItems([...items, routine]);
    setNewRoutine({
      title: '',
      text: '',
      categoryId: categories[0]?.id || '',
      frequency: 'daily' as FrequencyType,
      duration: 30
    });
    setShowAddForm(false);
  };

  const startEditingRoutine = (routine: Item) => {
    setEditingRoutine(routine.id);
    setEditRoutine({
      title: routine.title,
      text: routine.text,
      frequency: (routine.metadata?.frequency || 'daily') as FrequencyType,
      duration: routine.metadata?.duration || 30
    });
  };

  const saveEditedRoutine = (routineId: string) => {
    setItems(items.map(item => 
      item.id === routineId 
        ? { 
            ...item, 
            title: editRoutine.title,
            text: editRoutine.text,
            metadata: { 
              ...item.metadata, 
              frequency: editRoutine.frequency,
              duration: editRoutine.duration
            },
            updatedAt: new Date()
          }
        : item
    ));
    setEditingRoutine(null);
  };

  const cancelEditing = () => {
    setEditingRoutine(null);
    setEditRoutine({
      title: '',
      text: '',
      frequency: 'daily' as FrequencyType,
      duration: 30
    });
  };

  const deleteRoutine = (routineId: string) => {
    setItems(items.filter(item => item.id !== routineId));
    setEditingRoutine(null);
  };

  const toggleRoutineCompletion = (routineId: string) => {
    setItems(items.map(item => {
      if (item.id === routineId) {
        const wasCompleted = item.metadata?.completedToday || false;
        const currentStreak = item.metadata?.currentStreak || 0;
        const bestStreak = item.metadata?.bestStreak || 0;
        
          return {
            ...item,
            metadata: {
              ...item.metadata,
            completedToday: !wasCompleted,
            currentStreak: !wasCompleted ? currentStreak + 1 : Math.max(0, currentStreak - 1),
            bestStreak: !wasCompleted ? Math.max(bestStreak, currentStreak + 1) : bestStreak
            },
            updatedAt: new Date()
          };
      }
      return item;
    }));
  };

  const handleRoutineClick = (routineId: string) => {
    setViewingRoutine(routineId);
  };

  const handleRoutineDoubleClick = (routineId: string, routine: Item) => {
    setEditingRoutine(routineId);
    setEditRoutine({
      title: routine.title,
      text: routine.text,
      frequency: (routine.metadata?.frequency || 'daily') as FrequencyType,
      duration: routine.metadata?.duration || 30
    });
  };

  const closeViewing = () => {
    setViewingRoutine(null);
  };

  const printRoutine = () => {
    const viewingRoutineData = routines.find(r => r.id === viewingRoutine);
    if (!viewingRoutineData) {
      console.error('No routine found for printing');
      return;
    }

    const category = categories.find(c => c.id === viewingRoutineData.categoryId);
    const isCompleted = viewingRoutineData.metadata?.completedToday || false;
    const duration = viewingRoutineData.metadata?.duration || 0;
    const currentStreak = viewingRoutineData.metadata?.currentStreak || 0;
    const frequency = viewingRoutineData.metadata?.frequency || 'daily';

    // Create print-friendly content that matches the displayed view
    const printContent = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${viewingRoutineData.title} - Life Structure Routine</title>
          <style>
            @page { 
              margin: 0.75in; 
              size: letter; 
            }
            
            * { 
              margin: 0; 
              padding: 0; 
              box-sizing: border-box; 
            }
            
            body { 
              font-family: 'Georgia', 'Times New Roman', serif; 
              color: #1a202c; 
              line-height: 1.6; 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              min-height: 100vh;
              padding: 0;
            }
            
            .routine-card {
              background: white;
              border-radius: 20px;
              box-shadow: 0 25px 50px rgba(0,0,0,0.15);
              overflow: visible;
              max-width: 6.5in;
              margin: 0.5in auto;
              position: relative;
            }
            
            .routine-card::before {
              content: '';
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              height: 6px;
              background: linear-gradient(90deg, #667eea, #764ba2, #f093fb, #f5576c);
            }
            
            .header-section {
              background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
              padding: 0.75rem;
              text-align: center;
              position: relative;
            }
            
            .routine-icon {
              width: 30px;
              height: 30px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0 auto 0.5rem;
              font-size: 1rem;
              color: white;
              box-shadow: 0 4px 8px rgba(102, 126, 234, 0.2);
            }
            
            .routine-title {
              font-size: 1.5rem;
              font-weight: 700;
              color: #1a202c;
              margin-bottom: 0.25rem;
              letter-spacing: -0.02em;
            }
            
            .routine-subtitle {
              font-size: 0.9rem;
              color: #4a5568;
              font-style: italic;
              margin-bottom: 0.5rem;
            }
            
            .meta-badges {
              display: flex;
              justify-content: center;
              gap: 1rem;
              flex-wrap: wrap;
            }
            
            .meta-badge {
              background: white;
              padding: 0.5rem 1rem;
              border-radius: 20px;
              font-weight: 600;
              font-size: 0.8rem;
              box-shadow: 0 2px 6px rgba(0,0,0,0.1);
              border: 1px solid #e2e8f0;
              color: #2d3748;
            }
            
            .frequency-badge {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              border: none;
            }
            
            .content-section {
              padding: 1rem;
            }
            
            .status-banner {
              background: ${isCompleted ? 
                'linear-gradient(135deg, #48bb78 0%, #38a169 100%)' : 
                'linear-gradient(135deg, #ed8936 0%, #dd6b20 100%)'
              };
              color: white;
              padding: 0.5rem;
              text-align: center;
              font-weight: 600;
              font-size: 0.9rem;
              margin-bottom: 1rem;
              border-radius: 8px;
              box-shadow: 0 2px 6px rgba(0,0,0,0.15);
            }
            
            .description-card {
              background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
              padding: 1.5rem;
              border-radius: 12px;
              border-left: 4px solid #667eea;
              margin-bottom: 1rem;
              position: relative;
              page-break-inside: avoid;
            }
            
            .description-title {
              font-size: 1.1rem;
              font-weight: 600;
              color: #2d3748;
              margin-bottom: 0.5rem;
              display: flex;
              align-items: center;
              gap: 0.5rem;
            }
            
            .description-text {
              font-size: 0.95rem;
              line-height: 1.5;
              color: #4a5568;
              white-space: pre-line;
            }
            
            
            .footer-section {
              background: linear-gradient(135deg, #2d3748 0%, #4a5568 100%);
              color: white;
              padding: 0.75rem;
              text-align: center;
              font-size: 0.8rem;
            }
            
            .footer-logo {
              font-weight: 700;
              font-size: 0.9rem;
              margin-bottom: 0.25rem;
            }
            
            .decorative-line {
              width: 40px;
              height: 2px;
              background: linear-gradient(90deg, #667eea, #764ba2);
              margin: 0.5rem auto;
              border-radius: 2px;
            }
            
            @media print {
              body {
                background: white !important;
              }
              .routine-card {
                box-shadow: none;
                border: 1px solid #e2e8f0;
                page-break-inside: auto;
              }
              .header-section {
                page-break-after: avoid;
              }
              .content-section {
                page-break-before: avoid;
              }
              .description-card {
                page-break-inside: avoid;
                break-inside: avoid;
              }
              .checkbox-section {
                page-break-inside: avoid;
                break-inside: avoid;
              }
              .footer-section {
                page-break-before: avoid;
              }
            }
          </style>
        </head>
        <body>
          <div class="routine-card">
            <div class="header-section">
              <div class="routine-icon">
                ${category?.icon || '🔄'}
              </div>
              <h1 class="routine-title">${viewingRoutineData.title}</h1>
              <p class="routine-subtitle">${category?.name || 'Personal Routine'}</p>
              <div class="decorative-line"></div>
              <div class="meta-badges">
                <div class="meta-badge frequency-badge">
                  ${frequency.charAt(0).toUpperCase() + frequency.slice(1)}
                </div>
                <div class="meta-badge">
                  ⏱️ ${duration} minutes
                </div>
              </div>
            </div>
            
            <div class="content-section">
              <div class="status-banner">
                ${isCompleted ? 
                  '✅ Completed Today - Great Job!' : 
                  '⏳ Ready for Today\'s Session'
                }
              </div>
              
              ${viewingRoutineData.text ? `
                <div class="description-card">
                  <h2 class="description-title">
                    📋 Routine Instructions
                  </h2>
                  <div class="description-text">${viewingRoutineData.text}</div>
                </div>
              ` : `
                <div class="description-card">
                  <h2 class="description-title">
                    📋 Routine Instructions
                  </h2>
                  <div class="description-text">Follow your ${frequency} routine for ${duration} minutes. Focus on consistency and building positive habits.</div>
                </div>
              `}
              
            </div>
            
            <div class="footer-section">
              <div class="footer-logo">Life Structure</div>
              <div>Generated on ${new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                month: 'long', 
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}</div>
            </div>
          </div>
        </body>
      </html>
    `;

    // Open print window
    console.log('📄 Opening print window for routine:', viewingRoutineData.title);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      console.log('📄 Writing content to print window');
      printWindow.document.write(printContent);
      printWindow.document.close();
      
      // Wait for content to load before printing
      printWindow.onload = () => {
        console.log('📄 Print window loaded, triggering print');
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 100);
      };
    } else {
      console.error('❌ Failed to open print window - popup may be blocked');
      alert('Print failed: Please allow popups for this site to enable printing.');
    }
  };


  const getFrequencyIcon = (frequency: string) => {
    switch (frequency) {
      case 'daily': return '📅';
      case 'weekly': return '📆';
      case 'monthly': return '🗓️';
      case 'yearly': return '📊';
      default: return '🔄';
    }
  };

  const handleEditFromFullscreen = (routineId: string, routine: Item) => {
    setViewingRoutine(null); // Close fullscreen first
    setEditingRoutine(routineId);
    setEditRoutine({
      title: routine.title,
      text: routine.text,
      frequency: (routine.metadata?.frequency || 'daily') as FrequencyType,
      duration: routine.metadata?.duration || 30
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50">
      {/* Print-specific styles */}
      <style>{`
        @media print {
          @page {
            margin: 0.5in;
            size: letter;
          }
          body {
            -webkit-print-color-adjust: exact;
            color-adjust: exact;
          }
          .print-routine-guide {
            page-break-inside: avoid;
            font-family: 'Arial', sans-serif;
          }
          .print-step {
            page-break-inside: avoid;
            margin-bottom: 0.5rem;
          }
          .print-tracker-cell {
            min-height: 40px;
            border: 2px solid #000 !important;
          }
        }
      `}</style>
      
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-red-500 bg-clip-text text-transparent flex items-center">
                  <RotateCcw className="w-10 h-10 text-orange-600 mr-4" />
                  Routines
                </h1>
                <p className="text-gray-600 mt-2 text-lg">
                  {routines.length} routines • Build consistent habits
                </p>
              </div>
              <button
                onClick={() => setShowAddForm(true)}
                className="group relative overflow-hidden bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-8 py-4 rounded-2xl flex items-center transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
              >
                <div className="absolute inset-0 bg-white/20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                <Plus className="w-5 h-5 mr-3 relative z-10" />
                <span className="font-semibold relative z-10">Add Routine</span>
              </button>
            </div>
          </div>
        </div>

        {/* Advanced Filter & Search Controls */}
        <div className="mb-8">
          <div className="bg-white/60 backdrop-blur-xl rounded-2xl shadow-lg border border-white/30 p-6">
            {/* Header with Advanced Filter Toggle */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                <Filter className="w-5 h-5 mr-2 text-gray-600" />
                Filter & Search
              </h3>
              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 ${
                  showAdvancedFilters 
                    ? 'bg-orange-100 text-orange-700 border border-orange-200' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Settings className="w-4 h-4" />
                Advanced
              </button>
            </div>

            {/* Basic Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              {/* Category Filter */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-4 py-4 bg-white/70 border border-gray-200/50 rounded-xl focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all duration-300 text-gray-800"
                >
                  <option value="all">All Categories</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.icon} {category.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Frequency Filter */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Frequency</label>
                <select
                  value={selectedFrequency}
                  onChange={(e) => setSelectedFrequency(e.target.value)}
                  className="w-full px-4 py-4 bg-white/70 border border-gray-200/50 rounded-xl focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all duration-300 text-gray-800"
                >
                  <option value="all">All Frequencies</option>
                  {frequencies.map(freq => (
                    <option key={freq} value={freq}>
                      {getFrequencyIcon(freq)} {freq.charAt(0).toUpperCase() + freq.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Completion Filter */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Completion Status</label>
                <select
                  value={completionFilter}
                  onChange={(e) => setCompletionFilter(e.target.value as 'all' | 'completed' | 'incomplete')}
                  className="w-full px-4 py-4 bg-white/70 border border-gray-200/50 rounded-xl focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all duration-300 text-gray-800"
                >
                  <option value="all">All Routines</option>
                  <option value="completed">✅ Completed Today</option>
                  <option value="incomplete">⏳ Not Completed</option>
                </select>
              </div>

              {/* Sort Options */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Sort by</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'recent' | 'frequency' | 'category' | 'streak')}
                  className="w-full px-4 py-4 bg-white/70 border border-gray-200/50 rounded-xl focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all duration-300 text-gray-800"
                >
                  <option value="recent">🕒 Most Recent</option>
                  <option value="frequency">📅 Frequency</option>
                  <option value="category">📁 Category</option>
                  <option value="streak">🔥 Streak</option>
                </select>
              </div>
            </div>

            {/* Advanced Filters */}
            {showAdvancedFilters && (
              <div className="border-t border-gray-200/50 pt-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Active Filters & Quick Actions</h4>
                
                {/* Active Filters Summary */}
                <div className="flex flex-wrap gap-2 mb-4">
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
                  {selectedFrequency !== 'all' && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                      Frequency: {selectedFrequency.charAt(0).toUpperCase() + selectedFrequency.slice(1)}
                      <button
                        onClick={() => setSelectedFrequency('all')}
                        className="ml-2 text-orange-600 hover:text-orange-800"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {completionFilter !== 'all' && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Status: {completionFilter === 'completed' ? 'Completed' : 'Incomplete'}
                      <button
                        onClick={() => setCompletionFilter('all')}
                        className="ml-2 text-green-600 hover:text-green-800"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {sortBy !== 'recent' && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      Sort: {sortBy === 'frequency' ? 'Frequency' : sortBy === 'category' ? 'Category' : 'Streak'}
                      <button
                        onClick={() => setSortBy('recent')}
                        className="ml-2 text-purple-600 hover:text-purple-800"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                </div>

                {/* Quick Filter Actions */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <button
                    onClick={() => setSelectedFrequency('daily')}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 rounded-lg text-sm font-medium text-blue-700 transition-colors"
                  >
                    📅 Daily
                  </button>
                  <button
                    onClick={() => setCompletionFilter('completed')}
                    className="flex items-center gap-2 px-3 py-2 bg-green-50 hover:bg-green-100 rounded-lg text-sm font-medium text-green-700 transition-colors"
                  >
                    ✅ Completed
                  </button>
                  <button
                    onClick={() => setCompletionFilter('incomplete')}
                    className="flex items-center gap-2 px-3 py-2 bg-orange-50 hover:bg-orange-100 rounded-lg text-sm font-medium text-orange-700 transition-colors"
                  >
                    ⏳ Pending
                  </button>
                  <button
                    onClick={() => setSortBy('streak')}
                    className="flex items-center gap-2 px-3 py-2 bg-red-50 hover:bg-red-100 rounded-lg text-sm font-medium text-red-700 transition-colors"
                  >
                    🔥 By Streak
                  </button>
                  <button
                    onClick={() => {
                      setSelectedCategory('all');
                      setSelectedFrequency('all');
                      setCompletionFilter('all');
                      setSortBy('recent');
                    }}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm font-medium text-gray-700 transition-colors"
                  >
                    🔄 Clear All
                  </button>
                </div>
              </div>
            )}

            {/* Enhanced Quick Stats */}
            <div className="mt-6 bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-4 border border-orange-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Routine Statistics</h3>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-700">{routines.length}</div>
                  <div className="text-gray-600">Total</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{routines.filter(r => r.metadata?.completedToday).length}</div>
                  <div className="text-gray-600">Completed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{routines.filter(r => !r.metadata?.completedToday).length}</div>
                  <div className="text-gray-600">Pending</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{Math.max(...routines.map(r => r.metadata?.currentStreak || 0), 0)}</div>
                  <div className="text-gray-600">Best Streak</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Routines by Frequency */}
        {selectedFrequency === 'all' ? (
          <div className="space-y-8">
            {Object.keys(groupedRoutines).length === 0 || filteredRoutines.length === 0 ? (
              // Empty state for all frequencies
              <div className="text-center py-20">
                <div className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-xl border border-white/30 p-12 max-w-md mx-auto">
                  <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <RotateCcw className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-4">No routines yet</h3>
                  <p className="text-gray-600 mb-8 leading-relaxed">
                    {selectedCategory !== 'all'
                      ? 'Try adjusting your category filter to see more routines'
                      : 'Start building healthy habits and consistent routines'
                    }
                  </p>
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-8 py-4 rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-lg"
                  >
                    <Plus className="w-5 h-5 mr-3 inline" />
                    Create Your First Routine
                  </button>
                </div>
              </div>
            ) : (
              frequencies.map(frequency => {
                const frequencyRoutines = groupedRoutines[frequency] || [];
                if (frequencyRoutines.length === 0) return null;
                
                return (
                  <div key={frequency} className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/30 p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                        <span className="text-2xl mr-3">{getFrequencyIcon(frequency)}</span>
                        {frequency.charAt(0).toUpperCase() + frequency.slice(1)} Routines
                      </h2>
                    </div>
                    
                    <div className="space-y-4">
                      {groupedRoutines[frequency].map((routine) => {
                        const category = categories.find(c => c.id === routine.categoryId);
                        const isEditing = editingRoutine === routine.id;
                        const isCompleted = routine.metadata?.completedToday || false;
                        const currentStreak = routine.metadata?.currentStreak || 0;
                        const duration = routine.metadata?.duration || 0;
                        
                        return (
                          <div
                            key={routine.id}
                            className={`group p-4 rounded-xl border transition-all duration-300 ${
                              isCompleted 
                                ? 'bg-green-50 border-green-200' 
                                : 'bg-gray-50 border-gray-200 hover:bg-white hover:shadow-md'
                            }`}
                          >
                            {isEditing ? (
                              <div className="space-y-4">
                                <input
                                  type="text"
                                  value={editRoutine.title}
                                  onChange={(e) => setEditRoutine(prev => ({ ...prev, title: e.target.value }))}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  placeholder="Routine title..."
                                />
                                <textarea
                                  value={editRoutine.text}
                                  onChange={(e) => setEditRoutine(prev => ({ ...prev, text: e.target.value }))}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-20 resize-none"
                                  placeholder="Routine description..."
                                />
                                <div className="grid grid-cols-2 gap-4">
                                  <select
                                    value={editRoutine.frequency}
                                    onChange={(e) => setEditRoutine(prev => ({ ...prev, frequency: e.target.value as FrequencyType }))}
                                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  >
                                    {frequencies.map(freq => (
                                      <option key={freq} value={freq}>
                                        {freq.charAt(0).toUpperCase() + freq.slice(1)}
                                      </option>
                                    ))}
                                  </select>
                                  <input
                                    type="number"
                                    value={editRoutine.duration}
                                    onChange={(e) => setEditRoutine(prev => ({ ...prev, duration: parseInt(e.target.value) || 0 }))}
                                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Duration (minutes)"
                                    min="1"
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
                                    onClick={() => saveEditedRoutine(routine.id)}
                                    className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center"
                                  >
                                    <Save className="w-4 h-4 mr-2" />
                                    Save
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div 
                                className="flex items-center justify-between cursor-pointer"
                                onClick={() => handleRoutineClick(routine.id)}
                                onDoubleClick={() => handleRoutineDoubleClick(routine.id, routine)}
                              >
                                <div className="flex items-center space-x-4 flex-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleRoutineCompletion(routine.id);
                                    }}
                                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                                      isCompleted 
                                        ? 'bg-green-500 border-green-500 text-white' 
                                        : 'border-gray-300 hover:border-green-400'
                                    }`}
                                  >
                                    {isCompleted && <CheckCircle className="w-4 h-4" />}
                                  </button>
                                  
                                  <div 
                                    className="w-4 h-4 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: category?.color }}
                                  />
                                  
                                  <div className="flex-1">
                                    <h3 className={`font-semibold text-lg ${
                                      isCompleted ? 'text-green-700 line-through' : 'text-gray-800'
                                    }`}>
                                      {routine.title}
                                    </h3>
                                    {routine.text && (
                                      <div className="text-gray-600 text-sm mt-1">{routine.text}</div>
                                    )}
                                    <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                                      <span className="flex items-center">
                                        <Calendar className="w-4 h-4 mr-1" />
                                        {duration} min
                                      </span>
                                      <span>{category?.icon} {category?.name}</span>
                                      {currentStreak > 0 && (
                                        <span className="flex items-center text-orange-600">
                                          <Flame className="w-4 h-4 mr-1" />
                                          {currentStreak} day streak
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Action buttons */}
                                <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      const success = await copyToClipboard(routine.id);
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
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      startEditingRoutine(routine);
                                    }}
                                    className="p-2 hover:bg-yellow-100 rounded-lg transition-colors"
                                  >
                                    <Edit3 className="w-4 h-4 text-yellow-600" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteRoutine(routine.id);
                                    }}
                                    className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          // Single frequency view
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/30 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                <span className="text-2xl mr-3">{getFrequencyIcon(selectedFrequency)}</span>
                {selectedFrequency.charAt(0).toUpperCase() + selectedFrequency.slice(1)} Routines
              </h2>
            </div>
            
            {sortedRoutines.filter(r => r.metadata?.frequency === selectedFrequency).length > 0 ? (
              <div className="space-y-4">
                {sortedRoutines.filter(r => r.metadata?.frequency === selectedFrequency).map((routine) => {
                  const category = categories.find(c => c.id === routine.categoryId);
                  const isEditing = editingRoutine === routine.id;
                  const isCompleted = routine.metadata?.completedToday || false;
                  const currentStreak = routine.metadata?.currentStreak || 0;
                  const duration = routine.metadata?.duration || 0;
                  
                  return (
                    <div
                      key={routine.id}
                      className={`group p-4 rounded-xl border transition-all duration-300 ${
                        isCompleted 
                          ? 'bg-green-50 border-green-200' 
                          : 'bg-gray-50 border-gray-200 hover:bg-white hover:shadow-md'
                      }`}
                    >
                      {isEditing ? (
                        <div className="space-y-4">
                          <input
                            type="text"
                            value={editRoutine.title}
                            onChange={(e) => setEditRoutine(prev => ({ ...prev, title: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Routine title..."
                          />
                          <textarea
                            value={editRoutine.text}
                            onChange={(e) => setEditRoutine(prev => ({ ...prev, text: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-20 resize-none"
                            placeholder="Routine description..."
                          />
                          <div className="grid grid-cols-2 gap-4">
                            <select
                              value={editRoutine.frequency}
                              onChange={(e) => setEditRoutine(prev => ({ ...prev, frequency: e.target.value as FrequencyType }))}
                              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                              {frequencies.map(freq => (
                                <option key={freq} value={freq}>
                                  {freq.charAt(0).toUpperCase() + freq.slice(1)}
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              value={editRoutine.duration}
                              onChange={(e) => setEditRoutine(prev => ({ ...prev, duration: parseInt(e.target.value) || 0 }))}
                              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="Duration (minutes)"
                              min="1"
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
                              onClick={() => saveEditedRoutine(routine.id)}
                              className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center"
                            >
                              <Save className="w-4 h-4 mr-2" />
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div 
                          className="flex items-center justify-between cursor-pointer"
                          onClick={() => handleRoutineClick(routine.id)}
                          onDoubleClick={() => handleRoutineDoubleClick(routine.id, routine)}
                        >
                          <div className="flex items-center space-x-4 flex-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleRoutineCompletion(routine.id);
                              }}
                              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                                isCompleted 
                                  ? 'bg-green-500 border-green-500 text-white' 
                                  : 'border-gray-300 hover:border-green-400'
                              }`}
                            >
                              {isCompleted && <CheckCircle className="w-4 h-4" />}
                            </button>
                            
                            <div 
                              className="w-4 h-4 rounded-full flex-shrink-0"
                              style={{ backgroundColor: category?.color }}
                            />
                            
                            <div className="flex-1">
                              <h3 className={`font-semibold text-lg ${
                                isCompleted ? 'text-green-700 line-through' : 'text-gray-800'
                              }`}>
                                {routine.title}
                              </h3>
                              {routine.text && (
                                <div className="text-gray-600 text-sm mt-1">{routine.text}</div>
                              )}
                              <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                                <span className="flex items-center">
                                  <Calendar className="w-4 h-4 mr-1" />
                                  {duration} min
                                </span>
                                <span>{category?.icon} {category?.name}</span>
                                {currentStreak > 0 && (
                                  <span className="flex items-center text-orange-600">
                                    <Flame className="w-4 h-4 mr-1" />
                                    {currentStreak} day streak
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Action buttons */}
                          <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                const success = await copyToClipboard(routine.id);
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
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditingRoutine(routine);
                              }}
                              className="p-2 hover:bg-yellow-100 rounded-lg transition-colors"
                            >
                              <Edit3 className="w-4 h-4 text-yellow-600" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteRoutine(routine.id);
                              }}
                              className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
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
                <div className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-xl border border-white/30 p-12 max-w-md mx-auto">
                  <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <RotateCcw className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-4">No routines yet</h3>
                  <p className="text-gray-600 mb-8 leading-relaxed">
                    {selectedCategory !== 'all' || selectedFrequency !== 'all'
                      ? 'Try adjusting your filters to see more routines'
                      : 'Start building healthy habits and consistent routines'
                    }
                  </p>
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-8 py-4 rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-lg"
                  >
                    <Plus className="w-5 h-5 mr-3 inline" />
                    Create Your First Routine
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Fullscreen Routine View Modal */}
        {viewingRoutine && (() => {
          const routine = items.find(item => item.id === viewingRoutine);
          const category = categories.find(c => c.id === routine?.categoryId);
          const isCompleted = routine?.metadata?.completedToday || false;
          const currentStreak = routine?.metadata?.currentStreak || 0;
          const duration = routine?.metadata?.duration || 0;
          
          if (!routine) return null;
          
          return (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="bg-white w-full h-full overflow-hidden print:shadow-none">
                <div 
                  className="p-8 text-white print:bg-white print:text-black"
                  style={{ 
                    background: `linear-gradient(135deg, ${category?.color || '#f59e0b'} 0%, ${category?.color || '#ef4444'} 100%)` 
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center print:bg-gray-200 print:text-black">
                        <span className="text-2xl">{category?.icon}</span>
                      </div>
                      <div>
                        <h1 className="text-4xl font-bold print:text-black">{routine.title}</h1>
                        <p className="text-white/80 text-xl print:text-gray-600">
                          {routine.metadata?.frequency?.charAt(0).toUpperCase()}{routine.metadata?.frequency?.slice(1)} routine • {duration} minutes
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 print:hidden">
                      <button
                        onClick={printRoutine}
                        className="p-3 hover:bg-white/20 rounded-xl transition-colors"
                        title="Print Routine"
                      >
                        <Printer className="w-8 h-8" />
                      </button>
                      <button
                        onClick={closeViewing}
                        className="p-3 hover:bg-white/20 rounded-xl transition-colors"
                      >
                        <X className="w-8 h-8" />
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="p-8 h-full overflow-y-auto print:p-4">
                  {routine.text && (
                    <div className="mb-8">
                      <h3 className="text-2xl font-semibold text-gray-800 mb-4">Description</h3>
                      <pre className="text-gray-600 text-xl leading-relaxed print:text-lg whitespace-pre-line font-sans">{routine.text}</pre>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-3 gap-8 mb-8 print:gap-4">
                    <div className="text-center p-6 bg-gray-50 rounded-xl print:border print:border-gray-300">
                      <div className="text-3xl font-bold text-gray-800">{duration}</div>
                      <div className="text-lg text-gray-600">Minutes</div>
                    </div>
                    <div className="text-center p-6 bg-gray-50 rounded-xl print:border print:border-gray-300">
                      <div className="text-3xl font-bold text-orange-600">{currentStreak}</div>
                      <div className="text-lg text-gray-600">Day Streak</div>
                    </div>
                    <div className="text-center p-6 bg-gray-50 rounded-xl print:border print:border-gray-300">
                      <div className="text-3xl font-bold text-blue-600">{routine.metadata?.bestStreak || 0}</div>
                      <div className="text-lg text-gray-600">Best Streak</div>
                    </div>
                  </div>
                  
                  <div className="flex justify-center space-x-6 print:hidden">
                    <button
                      onClick={() => toggleRoutineCompletion(routine.id)}
                      className={`px-12 py-6 rounded-xl font-semibold text-xl transition-all duration-300 ${
                        isCompleted 
                          ? 'bg-green-500 hover:bg-green-600 text-white' 
                          : 'bg-orange-500 hover:bg-orange-600 text-white'
                      }`}
                    >
                      {isCompleted ? 'Mark as Incomplete' : 'Mark as Complete'}
                    </button>
                    <button
                      onClick={() => handleEditFromFullscreen(routine.id, routine)}
                      className="px-12 py-6 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-semibold text-xl transition-all duration-300"
                    >
                      Edit Routine
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Add Routine Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-2xl w-full">
              <div className="bg-gradient-to-r from-orange-500 to-red-500 p-6 text-white rounded-t-2xl">
              <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-bold">Add New Routine</h3>
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
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Routine Title *</label>
                <input
                  type="text"
                  value={newRoutine.title}
                    onChange={(e) => setNewRoutine(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter routine title..."
                  autoFocus
                />
              </div>
              
              <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                <textarea
                  value={newRoutine.text}
                    onChange={(e) => setNewRoutine(prev => ({ ...prev, text: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-24 resize-none"
                    placeholder="Routine description..."
                />
              </div>
              
                <div className="grid grid-cols-3 gap-4">
              <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Category</label>
                <select
                  value={newRoutine.categoryId}
                      onChange={(e) => setNewRoutine(prev => ({ ...prev, categoryId: e.target.value }))}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.icon} {category.name}
                    </option>
                  ))}
                </select>
              </div>
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Frequency</label>
                  <select
                    value={newRoutine.frequency}
                      onChange={(e) => setNewRoutine(prev => ({ ...prev, frequency: e.target.value as FrequencyType }))}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {frequencies.map(freq => (
                        <option key={freq} value={freq}>
                          {freq.charAt(0).toUpperCase() + freq.slice(1)}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Duration (min)</label>
                  <input
                    type="number"
                    value={newRoutine.duration}
                      onChange={(e) => setNewRoutine(prev => ({ ...prev, duration: parseInt(e.target.value) || 0 }))}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="30"
                    min="1"
                  />
                </div>
              </div>
              
                <div className="flex justify-end space-x-4 pt-4">
              <button
                onClick={() => setShowAddForm(false)}
                    className="px-6 py-3 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddRoutine}
                    className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-8 py-4 rounded-2xl transition-all duration-300"
              >
                    Add Routine
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

export default GlobalRoutines; 