import React, { useState } from 'react';
import { RotateCcw, Plus, CheckCircle, X, Save, Filter, Calendar, Flame, Printer, Copy } from 'lucide-react';
import { categories } from '../data/initialData';
import { Item } from '../types';
import { copyToClipboard, showCopyFeedback } from '../utils/clipboard';

interface GlobalRoutinesProps {
  items: Item[];
  setItems: React.Dispatch<React.SetStateAction<Item[]>>;
}

type FrequencyType = 'daily' | 'weekly' | 'monthly' | 'yearly';

const GlobalRoutines: React.FC<GlobalRoutinesProps> = ({ items, setItems }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedFrequency, setSelectedFrequency] = useState<string>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<string | null>(null);
  const [viewingRoutine, setViewingRoutine] = useState<string | null>(null);
  const [newRoutine, setNewRoutine] = useState({
    title: '',
    text: '',
    categoryId: 'self-regulation',
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
  
  // Filter routines by category and frequency
  const filteredRoutines = routines.filter(routine => {
    const categoryMatch = selectedCategory === 'all' || routine.categoryId === selectedCategory;
    const frequencyMatch = selectedFrequency === 'all' || routine.metadata?.frequency === selectedFrequency;
    return categoryMatch && frequencyMatch;
  });

  // Group routines by frequency for better organization
  const groupedRoutines = filteredRoutines.reduce((groups, routine) => {
    const frequency = routine.metadata?.frequency || 'daily';
    if (!groups[frequency]) {
      groups[frequency] = [];
    }
    groups[frequency].push(routine);
    return groups;
  }, {} as Record<string, Item[]>);

  const frequencies: FrequencyType[] = ['daily', 'weekly', 'monthly', 'yearly'];

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
      categoryId: 'self-regulation',
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
    window.print();
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

        {/* Filters */}
        <div className="mb-6">
          <div className="bg-white/60 backdrop-blur-xl rounded-xl shadow-lg border border-white/30 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Filter className="w-5 h-5 text-gray-600" />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="all">All Categories</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.icon} {category.name}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedFrequency}
                  onChange={(e) => setSelectedFrequency(e.target.value)}
                  className="px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="all">All Frequencies</option>
                  {frequencies.map(freq => (
                    <option key={freq} value={freq}>
                      {getFrequencyIcon(freq)} {freq.charAt(0).toUpperCase() + freq.slice(1)}
                    </option>
                  ))}
                </select>
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
                      {frequencyRoutines.map((routine) => {
                        const category = categories.find(c => c.id === routine.categoryId);
                        const isEditing = editingRoutine === routine.id;
                        const isCompleted = routine.metadata?.completedToday || false;
                        const currentStreak = routine.metadata?.currentStreak || 0;
                        const duration = routine.metadata?.duration || 0;
                        
                        return (
                          <div
                            key={routine.id}
                            className={`p-4 rounded-xl border transition-all duration-300 ${
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
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                  placeholder="Routine title..."
                                />
                                <textarea
                                  value={editRoutine.text}
                                  onChange={(e) => setEditRoutine(prev => ({ ...prev, text: e.target.value }))}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 h-20 resize-none"
                                  placeholder="Routine description..."
                                />
                                <div className="grid grid-cols-2 gap-4">
                                  <select
                                    value={editRoutine.frequency}
                                    onChange={(e) => setEditRoutine(prev => ({ ...prev, frequency: e.target.value as FrequencyType }))}
                                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
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
                                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
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
            
            {filteredRoutines.length > 0 ? (
              <div className="space-y-4">
                {filteredRoutines.map((routine) => {
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
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                            placeholder="Routine title..."
                          />
                          <textarea
                            value={editRoutine.text}
                            onChange={(e) => setEditRoutine(prev => ({ ...prev, text: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 h-20 resize-none"
                            placeholder="Routine description..."
                          />
                          <div className="grid grid-cols-2 gap-4">
                            <select
                              value={editRoutine.frequency}
                              onChange={(e) => setEditRoutine(prev => ({ ...prev, frequency: e.target.value as FrequencyType }))}
                              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
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
                              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
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
                              className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                            >
                              <Save className="w-4 h-4 text-blue-500" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteRoutine(routine.id);
                              }}
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
                  
                  {/* Print-only content */}
                  <div className="hidden print:block print-routine-guide mt-8">
                    <div className="border-t-4 border-gray-800 pt-8">
                      <div className="text-center mb-8">
                        <h1 className="text-4xl font-bold text-gray-900 mb-2">{routine.title}</h1>
                        <div className="text-xl text-gray-700 mb-4">{routine.text}</div>
                        <div className="flex justify-center space-x-8 text-lg">
                          <span><strong>Frequency:</strong> {routine.metadata?.frequency?.charAt(0).toUpperCase()}{routine.metadata?.frequency?.slice(1)}</span>
                          <span><strong>Duration:</strong> {duration} minutes</span>
                          <span><strong>Category:</strong> {category?.name}</span>
                        </div>
                      </div>
                      
                      {/* Step-by-step guide */}
                      <div className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center border-b-2 border-gray-300 pb-2">ROUTINE STEPS</h2>
                        <div className="space-y-4">
                          {routine.text.split('\n').filter(step => step.trim()).map((step, index) => (
                            <div key={index} className="print-step flex items-start space-x-4 p-3 border border-gray-300 rounded">
                              <div className="w-8 h-8 bg-gray-800 text-white rounded-full flex items-center justify-center font-bold text-lg">
                                {index + 1}
                              </div>
                              <div className="text-lg text-gray-800 flex-1 whitespace-pre-line">{step.trim()}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* Weekly tracking grid */}
                      <div className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center border-b-2 border-gray-300 pb-2">WEEKLY TRACKER</h2>
                        <div className="grid grid-cols-7 gap-2 mb-4">
                          {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(day => (
                            <div key={day} className="text-center font-bold text-gray-800 p-2 bg-gray-200 border border-gray-400">
                              {day}
                            </div>
                          ))}
                        </div>
                        {Array.from({ length: 4 }, (_, week) => (
                          <div key={week} className="grid grid-cols-7 gap-2 mb-2">
                            {Array.from({ length: 7 }, (_, day) => (
                              <div key={day} className="print-tracker-cell w-full h-12 border-2 border-gray-400 rounded flex items-center justify-center">
                                <span className="text-xs text-gray-500">Week {week + 1}</span>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                      
                      {/* Tips and notes */}
                      <div className="border-t-2 border-gray-300 pt-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">TIPS FOR SUCCESS</h2>
                        <div className="grid grid-cols-2 gap-6 text-sm">
                          <div>
                            <h3 className="font-bold mb-2">⏰ TIMING</h3>
                            <ul className="space-y-1 text-gray-700">
                              <li>• Set a consistent time each day</li>
                              <li>• Use a timer for {duration} minutes</li>
                              <li>• Start with shorter sessions if needed</li>
                            </ul>
                          </div>
                          <div>
                            <h3 className="font-bold mb-2">📈 PROGRESS</h3>
                            <ul className="space-y-1 text-gray-700">
                              <li>• Mark completion immediately</li>
                              <li>• Track your streak</li>
                              <li>• Celebrate small wins</li>
                            </ul>
                          </div>
                        </div>
                        
                        <div className="mt-6 text-center text-xs text-gray-600 border-t border-gray-300 pt-4">
                          <p>Current Streak: {currentStreak} days | Best Streak: {routine.metadata?.bestStreak || 0} days</p>
                          <p>Generated on {new Date().toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>
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
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Enter routine title..."
                  autoFocus
                />
              </div>
              
              <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                <textarea
                  value={newRoutine.text}
                    onChange={(e) => setNewRoutine(prev => ({ ...prev, text: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 h-24 resize-none"
                    placeholder="Routine description..."
                />
              </div>
              
                <div className="grid grid-cols-3 gap-4">
              <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Category</label>
                <select
                  value={newRoutine.categoryId}
                      onChange={(e) => setNewRoutine(prev => ({ ...prev, categoryId: e.target.value }))}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
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
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
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
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
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