import React, { useState, useEffect, useRef } from 'react';
import { BowArrow, Filter, Plus, TrendingUp, Award, Calendar, X, Edit3, Save, ChevronRight, Trash2, Maximize2, Copy } from 'lucide-react';
import { Item, Category } from '../types';
import { copyToClipboard, showCopyFeedback } from '../utils/clipboard';

interface GlobalGoalsProps {
  items: Item[];
  setItems: React.Dispatch<React.SetStateAction<Item[]>>;
  categories: Category[];
}

const GlobalGoals: React.FC<GlobalGoalsProps> = ({ items, setItems, categories }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<string | null>(null);
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null);
  const [fullscreenGoal, setFullscreenGoal] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'priority' | 'progress' | 'category'>('priority');
  const [newGoal, setNewGoal] = useState({
    title: '',
    text: '',
    categoryId: categories[0]?.id || '',
    target: '',
    progress: 0
  });
  const [editGoal, setEditGoal] = useState({
    title: '',
    text: '',
    target: '',
    progress: 0,
    dueDate: ''
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const goals = items.filter(item => item.type === 'goal');
  const filteredGoals = selectedCategory === 'all' 
    ? goals 
    : goals.filter(item => item.categoryId === selectedCategory);

  const sortedGoals = [...filteredGoals].sort((a, b) => {
    switch (sortBy) {
      case 'progress':
        return (b.metadata?.progress || 0) - (a.metadata?.progress || 0);
      case 'category':
        const catA = categories.find(c => c.id === a.categoryId);
        const catB = categories.find(c => c.id === b.categoryId);
        return (catA?.priority || 999) - (catB?.priority || 999);
      case 'priority':
      default:
        const categoryA = categories.find(c => c.id === a.categoryId);
        const categoryB = categories.find(c => c.id === b.categoryId);
        return (categoryA?.priority || 999) - (categoryB?.priority || 999);
    }
  });

  // Update newGoal categoryId when categories are loaded
  useEffect(() => {
    if (categories.length > 0 && !newGoal.categoryId) {
      setNewGoal(prev => ({ ...prev, categoryId: categories[0].id }));
    }
  }, [categories, newGoal.categoryId]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [editGoal.text, editGoal.target]);

  const handleAddGoal = () => {
    if (!newGoal.title.trim()) return;
    
    const goal: Item = {
      id: Date.now().toString(),
      categoryId: newGoal.categoryId,
      type: 'goal',
      title: newGoal.title,
      text: newGoal.text,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        target: newGoal.target,
        progress: newGoal.progress
      }
    };
    
    setItems([...items, goal]);
    setNewGoal({
      title: '',
      text: '',
      categoryId: categories[0]?.id || '',
      target: '',
      progress: 0
    });
    setShowAddForm(false);
  };

  const updateGoalProgress = (goalId: string, newProgress: number) => {
    setItems(items.map(item => 
      item.id === goalId 
        ? { 
            ...item, 
            metadata: { ...item.metadata, progress: Math.max(0, Math.min(100, newProgress)) },
            updatedAt: new Date()
          }
        : item
    ));
  };

  const startEditingGoal = (goal: Item) => {
    setEditingGoal(goal.id);
    setExpandedGoal(goal.id);
    setEditGoal({
      title: goal.title,
      text: goal.text,
      target: goal.metadata?.target || '',
      progress: goal.metadata?.progress || 0,
      dueDate: goal.dueDate ? new Date(goal.dueDate).toISOString().split('T')[0] : ''
    });
  };

  const saveEditedGoal = (goalId: string) => {
    setItems(items.map(item => 
      item.id === goalId 
        ? { 
            ...item, 
            title: editGoal.title,
            text: editGoal.text,
            dueDate: editGoal.dueDate ? new Date(editGoal.dueDate) : undefined,
            metadata: { 
              ...item.metadata, 
              target: editGoal.target,
              progress: editGoal.progress 
            },
            updatedAt: new Date()
          }
        : item
    ));
    setEditingGoal(null);
  };

  const cancelEditing = () => {
    setEditingGoal(null);
    setEditGoal({
      title: '',
      text: '',
      target: '',
      progress: 0,
      dueDate: ''
    });
  };

  const handleGoalClick = (goalId: string) => {
    if (expandedGoal === goalId) {
      setExpandedGoal(null);
    } else {
      setExpandedGoal(goalId);
    }
  };

  const handleEditFromFullscreen = (goalId: string, goal: Item) => {
    setFullscreenGoal(null); // Close fullscreen first
    setEditingGoal(goalId);
    setExpandedGoal(goalId);
    setEditGoal({
      title: goal.title,
      text: goal.text,
      target: goal.metadata?.target || '',
      progress: goal.metadata?.progress || 0,
      dueDate: goal.dueDate ? new Date(goal.dueDate).toISOString().split('T')[0] : ''
    });
  };

  const deleteGoal = (goalId: string) => {
    setItems(items.filter(item => item.id !== goalId));
    setExpandedGoal(null);
    setEditingGoal(null);
  };

  const getProgressColor = (progress: number) => {
    return 'from-gray-300 to-gray-400';
  };

  const getProgressLabel = (progress: number) => {
    if (progress >= 90) return 'Almost complete';
    if (progress >= 75) return 'Great progress';
    if (progress >= 50) return 'Halfway there';
    if (progress >= 25) return 'Getting started';
    return 'Just beginning';
  };

  const totalGoals = filteredGoals.length;
  const completedGoals = filteredGoals.filter(goal => (goal.metadata?.progress || 0) >= 100).length;
  const averageProgress = totalGoals > 0 
    ? filteredGoals.reduce((sum, goal) => sum + (goal.metadata?.progress || 0), 0) / totalGoals 
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="p-6 max-w-7xl mx-auto">
        {/* Floating Header */}
        <div className="sticky top-6 z-40 mb-8">
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold text-gray-800 flex items-center">
                  <BowArrow className="w-10 h-10 text-gray-600 mr-4" />
                  Goals
                </h1>
                <p className="text-gray-600 mt-2 text-lg">
                  {completedGoals} of {totalGoals} completed • {Math.round(averageProgress)}% average progress
                </p>
              </div>
              <button
                onClick={() => setShowAddForm(true)}
                className="group relative overflow-hidden bg-gray-600 hover:bg-gray-700 text-white px-8 py-4 rounded-2xl flex items-center transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
              >
                <div className="absolute inset-0 bg-white/10 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                <Plus className="w-5 h-5 mr-3 relative z-10" />
                <span className="font-semibold relative z-10">New Goal</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tesla-Style Controls */}
        <div className="mb-8">
          <div className="bg-white/60 backdrop-blur-xl rounded-2xl shadow-lg border border-white/30 p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Category Filter */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Filter by Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-4 py-4 bg-white/70 border border-gray-200/50 rounded-xl focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all duration-300 text-gray-800"
                >
                  <option value="all">All Categories</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.icon} {category.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort Options */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Sort by</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'priority' | 'progress' | 'category')}
                  className="w-full px-4 py-4 bg-white/70 border border-gray-200/50 rounded-xl focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all duration-300 text-gray-800"
                >
                  <option value="priority">Category Priority</option>
                  <option value="progress">Progress</option>
                  <option value="category">Category</option>
                </select>
              </div>

              {/* Quick Stats */}
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-4 border border-blue-100">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Quick Stats</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Completed:</span>
                    <span className="font-bold text-gray-700">{completedGoals}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>In Progress:</span>
                    <span className="font-bold text-gray-700">{totalGoals - completedGoals}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg Progress:</span>
                    <span className="font-bold text-gray-700">{Math.round(averageProgress)}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Overall Progress */}
        <div className="mb-8">
          <div className="bg-white/60 backdrop-blur-xl rounded-2xl shadow-lg border border-white/30 p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">Overall Progress</h3>
              <span className="text-3xl font-bold text-gray-700">
                {Math.round(averageProgress)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4 mb-2 overflow-hidden">
              <div 
                className={`h-4 rounded-full transition-all duration-1000 bg-gradient-to-r ${getProgressColor(averageProgress)}`}
                style={{ width: `${averageProgress}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-600 font-medium">{getProgressLabel(averageProgress)}</p>
          </div>
        </div>

        {/* Revolutionary Goals Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedGoals.map((goal) => {
            const category = categories.find(c => c.id === goal.categoryId);
            const progress = goal.metadata?.progress || 0;
            const isExpanded = expandedGoal === goal.id;
            const isEditing = editingGoal === goal.id;
            
            return (
              <div
                key={goal.id}
                className={`group relative bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/30 overflow-hidden transition-all duration-500 hover:shadow-2xl hover:scale-[1.02] cursor-pointer ${
                  isExpanded ? 'md:col-span-2 lg:col-span-2 transform scale-[1.01]' : ''
                }`}
                onClick={() => !isEditing && handleGoalClick(goal.id)}
                onDoubleClick={() => !isEditing && handleEditFromFullscreen(goal.id, goal)}
              >
                {/* Gradient Border */}
                <div 
                  className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r opacity-80"
                  style={{ 
                    background: `linear-gradient(90deg, ${category?.color || '#ef4444'}, ${category?.color || '#f97316'})` 
                  }}
                />
                
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-3 h-3 rounded-full shadow-sm"
                        style={{ backgroundColor: category?.color || '#ef4444' }}
                      />
                      <span className="text-sm font-medium text-gray-600">
                        {category?.icon} {category?.name}
                      </span>
                      <div className={`text-2xl font-bold ${progress >= 100 ? 'text-green-600' : 'text-gray-800'}`}>
                        {progress}%
                      </div>
                    </div>
                    
                    <div className={`flex items-center space-x-2 transition-opacity ${isExpanded ? 'opacity-100' : 'opacity-0'}`}>
                      {!isEditing && (
                        <>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              const success = await copyToClipboard(goal.id);
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
                              setFullscreenGoal(goal.id);
                            }}
                            className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                            title="Fullscreen"
                          >
                            <Maximize2 className="w-4 h-4 text-blue-600" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditFromFullscreen(goal.id, goal);
                            }}
                            className="p-2 hover:bg-yellow-100 rounded-lg transition-colors"
                          >
                            <Edit3 className="w-4 h-4 text-yellow-600" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteGoal(goal.id);
                        }}
                        className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </div>

                  {/* Content */}
                  {isEditing ? (
                    <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Title</label>
                        <input
                          type="text"
                          value={editGoal.title}
                          onChange={(e) => setEditGoal({ ...editGoal, title: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-500/50 focus:border-gray-500 transition-all duration-300"
                          autoFocus
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                        <textarea
                          ref={textareaRef}
                          value={editGoal.text}
                          onChange={(e) => setEditGoal({ ...editGoal, text: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-500/50 focus:border-gray-500 transition-all duration-300 resize-none overflow-hidden"
                          rows={3}
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Notes</label>
                        <textarea
                          value={editGoal.target}
                          onChange={(e) => setEditGoal({ ...editGoal, target: e.target.value })}
                          placeholder="Add notes about your progress, thoughts, or updates..."
                          className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-500/50 focus:border-gray-500 transition-all duration-300 resize-none"
                          rows={3}
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Deadline</label>
                        <input
                          type="date"
                          value={editGoal.dueDate}
                          onChange={(e) => setEditGoal({ ...editGoal, dueDate: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-500/50 focus:border-gray-500 transition-all duration-300"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Progress: {editGoal.progress}%
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={editGoal.progress}
                          onChange={(e) => setEditGoal({ ...editGoal, progress: parseInt(e.target.value) })}
                          className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                        />
                      </div>
                      
                      <div className="flex space-x-3 pt-4">
                        <button
                          onClick={() => saveEditedGoal(goal.id)}
                          className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all duration-300 flex items-center justify-center font-semibold"
                        >
                          <Save className="w-4 h-4 mr-2" />
                          Save
                        </button>
                        <button
                          onClick={cancelEditing}
                          className="px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all duration-300 font-semibold"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="mb-4">
                        <h3 className={`font-bold text-gray-800 mb-2 ${isExpanded ? 'text-xl' : 'text-lg'}`}>
                          {goal.title}
                        </h3>
                        <p className={`text-gray-600 leading-relaxed ${isExpanded ? 'text-base' : 'text-sm'}`}>
                          {isExpanded ? goal.text : (
                            goal.text.length > 100 ? goal.text.substring(0, 100) + '...' : goal.text
                          )}
                        </p>
                        
                        {!isExpanded && goal.text.length > 100 && (
                          <div className="mt-2 text-red-600 text-sm font-medium">
                            Tap to read more...
                          </div>
                        )}
                      </div>

                      {/* Progress Bar */}
                      <div className="mb-4">
                        <div className="flex justify-between text-sm mb-2">
                          <span className="font-semibold text-gray-700">Progress</span>
                          <span className="text-gray-500 font-medium">{getProgressLabel(progress)}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                          <div 
                            className={`h-3 rounded-full transition-all duration-500 bg-gradient-to-r ${getProgressColor(progress)}`}
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                      </div>



                      {/* Notes */}
                      {goal.metadata?.target && (
                        <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-200">
                          <div className="flex items-start space-x-2">
                            <div>
                              <span className="text-sm font-semibold text-gray-700 block">Notes:</span>
                              <span className="text-sm text-gray-600">{goal.metadata.target}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Progress Controls */}
                      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateGoalProgress(goal.id, progress - 10);
                            }}
                            className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium transition-all duration-300"
                            disabled={progress <= 0}
                          >
                            -10%
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateGoalProgress(goal.id, progress + 10);
                            }}
                            className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium transition-all duration-300"
                            disabled={progress >= 100}
                          >
                            +10%
                          </button>
                          {progress < 100 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateGoalProgress(goal.id, 100);
                              }}
                              className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium transition-all duration-300"
                            >
                              Complete
                            </button>
                          )}
                        </div>
                        
                        <div className="text-xs text-gray-500">
                          {goal.dueDate ? (
                            <div className="flex items-center space-x-1">
                              <Calendar className="w-3 h-3" />
                              <span>
                                {new Date(goal.dueDate).toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric'
                                })}
                              </span>
                            </div>
                          ) : (
                            new Date(goal.updatedAt).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric'
                            })
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {sortedGoals.length === 0 && (
          <div className="text-center py-20">
            <div className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-xl border border-white/30 p-12 max-w-md mx-auto">
              <div className="w-20 h-20 bg-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <BowArrow className="w-10 h-10 text-gray-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-4">No goals yet</h3>
              <p className="text-gray-600 mb-8 leading-relaxed">
                {selectedCategory !== 'all' 
                  ? `No goals in ${categories.find(c => c.id === selectedCategory)?.name}`
                  : 'Start setting ambitious goals to track your progress'
                }
              </p>
              <button
                onClick={() => setShowAddForm(true)}
                className="bg-gray-600 hover:bg-gray-700 text-white px-8 py-4 rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-lg"
              >
                <Plus className="w-5 h-5 mr-3 inline" />
                Create Your First Goal
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Goal Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-2xl w-full">
            {/* Header */}
            <div className="bg-gray-600 p-6 text-white rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold">Add New Goal</h3>
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
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Goal Title *
                </label>
                <input
                  type="text"
                  value={newGoal.title}
                  onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
                  placeholder="Enter goal title..."
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={newGoal.text}
                  onChange={(e) => setNewGoal({ ...newGoal, text: e.target.value })}
                  placeholder="Goal description..."
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-500 focus:border-gray-500 h-24 resize-none"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    value={newGoal.categoryId}
                    onChange={(e) => setNewGoal({ ...newGoal, categoryId: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                  >
                    {categories.map(category => (
                      <option key={category.id} value={category.id}>
                        {category.icon} {category.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Initial Progress: {newGoal.progress}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={newGoal.progress}
                    onChange={(e) => setNewGoal({ ...newGoal, progress: parseInt(e.target.value) || 0 })}
                    className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer mt-3"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={newGoal.target}
                  onChange={(e) => setNewGoal({ ...newGoal, target: e.target.value })}
                  placeholder="Add notes about your goal..."
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-500 focus:border-gray-500 h-24 resize-none"
                />
              </div>
              
              <div className="flex justify-end space-x-4 pt-4">
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-6 py-3 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddGoal}
                  disabled={!newGoal.title.trim()}
                  className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-8 py-3 rounded-xl transition-all duration-300"
                >
                  Add Goal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Goal Dashboard Fullscreen Modal */}
      {fullscreenGoal && (() => {
        const goal = items.find(item => item.id === fullscreenGoal);
        const category = categories.find(c => c.id === goal?.categoryId);
        const progress = goal?.metadata?.progress || 0;
        
        if (!goal) return null;
        
        return (
          <div className="fixed inset-0 bg-gradient-to-br from-gray-50 to-gray-100 z-50 flex flex-col">
            {/* Header */}
            <div 
              className="p-8 text-white"
              style={{ 
                background: `linear-gradient(135deg, ${category?.color || '#6b7280'} 0%, ${category?.color || '#4b5563'} 100%)` 
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                    <span className="text-2xl">{category?.icon}</span>
                  </div>
                  <div>
                    <h1 className="text-4xl font-bold">{goal.title}</h1>
                    <p className="text-white/80 text-xl">
                      {progress}% complete • {category?.name}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleEditFromFullscreen(goal.id, goal)}
                    className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors flex items-center"
                  >
                    <Edit3 className="w-4 h-4 mr-2" />
                    Edit Goal
                  </button>
                  <button
                    onClick={() => setFullscreenGoal(null)}
                    className="p-3 hover:bg-white/20 rounded-xl transition-colors"
                  >
                    <X className="w-8 h-8" />
                  </button>
                </div>
              </div>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-6xl mx-auto px-8 py-12">
                {/* Goal Title */}
                <div className="text-center mb-12">
                  <h1 className="text-5xl font-bold text-gray-900 mb-4">{goal.title}</h1>
                  <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
                    {goal.text || 'No description provided'}
                  </p>
                </div>
                
                {/* Progress Circle */}
                <div className="flex justify-center mb-16">
                  <div className="relative w-80 h-80">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="45"
                        stroke="#e5e7eb"
                        strokeWidth="8"
                        fill="none"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="45"
                        stroke="#6b7280"
                        strokeWidth="8"
                        fill="none"
                        strokeDasharray={`${2 * Math.PI * 45}`}
                        strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`}
                        className="transition-all duration-1000 ease-out"
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-6xl font-bold text-gray-900">{progress}%</div>
                        <div className="text-lg text-gray-600 mt-2">{getProgressLabel(progress)}</div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
                  <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200 text-center">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Calendar className="w-8 h-8 text-blue-600" />
                    </div>
                    <div className="text-3xl font-bold text-gray-900 mb-2">
                      {Math.ceil((new Date().getTime() - new Date(goal.createdAt).getTime()) / (1000 * 60 * 60 * 24))}
                    </div>
                    <div className="text-gray-600">Days Active</div>
                  </div>
                  
                  <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200 text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <TrendingUp className="w-8 h-8 text-green-600" />
                    </div>
                    <div className="text-3xl font-bold text-gray-900 mb-2">{progress}%</div>
                    <div className="text-gray-600">Completed</div>
                  </div>
                  
                  <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200 text-center">
                    <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Award className="w-8 h-8 text-purple-600" />
                    </div>
                    <div className="text-3xl font-bold text-gray-900 mb-2">
                      {progress >= 100 ? '🏆' : progress >= 75 ? '🥈' : progress >= 50 ? '🥉' : '⭐'}
                    </div>
                    <div className="text-gray-600">Achievement</div>
                  </div>
                </div>
                
                {/* Notes Section */}
                {goal.metadata?.target && (
                  <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200 mb-8">
                    <h3 className="text-2xl font-bold text-gray-900 mb-4">Notes & Updates</h3>
                    <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {goal.metadata.target}
                    </div>
                  </div>
                )}
                
                {/* Progress Controls */}
                <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200">
                  <h3 className="text-2xl font-bold text-gray-900 mb-6">Update Progress</h3>
                  <div className="flex items-center justify-center space-x-4">
                    <button
                      onClick={() => updateGoalProgress(goal.id, Math.max(0, progress - 10))}
                      className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-colors"
                      disabled={progress <= 0}
                    >
                      -10%
                    </button>
                    <button
                      onClick={() => updateGoalProgress(goal.id, Math.max(0, progress - 5))}
                      className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-colors"
                      disabled={progress <= 0}
                    >
                      -5%
                    </button>
                    <div className="px-8 py-3 bg-gray-50 rounded-xl font-bold text-2xl text-gray-900 min-w-[120px] text-center">
                      {progress}%
                    </div>
                    <button
                      onClick={() => updateGoalProgress(goal.id, Math.min(100, progress + 5))}
                      className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-colors"
                      disabled={progress >= 100}
                    >
                      +5%
                    </button>
                    <button
                      onClick={() => updateGoalProgress(goal.id, Math.min(100, progress + 10))}
                      className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-colors"
                      disabled={progress >= 100}
                    >
                      +10%
                    </button>
                    {progress < 100 && (
                      <button
                        onClick={() => updateGoalProgress(goal.id, 100)}
                        className="px-8 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold transition-colors"
                      >
                        Complete Goal
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default GlobalGoals; 