import React, { useState, useEffect, useRef } from 'react';
import { CheckSquare, Filter, Plus, Calendar, Clock, Flag, X, Edit3, Save, Check, Copy } from 'lucide-react';
import { categories } from '../data/initialData';
import { Item } from '../types';
import { copyToClipboard, showCopyFeedback } from '../utils/clipboard';

interface GlobalTodosProps {
  items: Item[];
  setItems: React.Dispatch<React.SetStateAction<Item[]>>;
}

const GlobalTodos: React.FC<GlobalTodosProps> = ({ items, setItems }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTodo, setEditingTodo] = useState<string | null>(null);
  const [expandedTodo, setExpandedTodo] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed' | 'overdue'>('all');
  const [sortBy, setSortBy] = useState<'dueDate' | 'priority' | 'category'>('dueDate');
  const [newTodo, setNewTodo] = useState({
    title: '',
    text: '',
    categoryId: 'self-regulation',
    dueDate: '',
    priority: 'medium' as 'low' | 'medium' | 'high'
  });
  const [editTodo, setEditTodo] = useState({
    title: '',
    text: '',
    dueDate: '',
    priority: 'medium' as 'low' | 'medium' | 'high'
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Helper functions - defined before they're used
  const isOverdue = (dueDate: Date | undefined) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date() && new Date(dueDate).toDateString() !== new Date().toDateString();
  };

  const isDueToday = (dueDate: Date | undefined) => {
    if (!dueDate) return false;
    return new Date(dueDate).toDateString() === new Date().toDateString();
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'from-red-500 to-pink-500';
      case 'medium': return 'from-yellow-500 to-orange-500';
      case 'low': return 'from-green-500 to-emerald-500';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return '🔥';
      case 'medium': return '⚡';
      case 'low': return '🌱';
      default: return '📝';
    }
  };

  const todos = items.filter(item => item.type === 'todo');
  
  const filteredTodos = todos.filter(todo => {
    const categoryMatch = selectedCategory === 'all' || todo.categoryId === selectedCategory;
    const statusMatch = filterStatus === 'all' || 
      (filterStatus === 'completed' && todo.completed) ||
      (filterStatus === 'pending' && !todo.completed) ||
      (filterStatus === 'overdue' && !todo.completed && isOverdue(todo.dueDate));
    
    return categoryMatch && statusMatch;
  });

  const sortedTodos = [...filteredTodos].sort((a, b) => {
    switch (sortBy) {
      case 'priority':
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return (priorityOrder[b.metadata?.priority as keyof typeof priorityOrder] || 2) - 
               (priorityOrder[a.metadata?.priority as keyof typeof priorityOrder] || 2);
      case 'category':
        const catA = categories.find(c => c.id === a.categoryId);
        const catB = categories.find(c => c.id === b.categoryId);
        return (catA?.priority || 999) - (catB?.priority || 999);
      case 'dueDate':
      default:
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }
  });

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [editTodo.text]);

  const handleAddTodo = () => {
    if (!newTodo.title.trim()) return;
    
    const todo: Item = {
      id: Date.now().toString(),
      categoryId: newTodo.categoryId,
      type: 'todo',
      title: newTodo.title,
      text: newTodo.text,
      dueDate: newTodo.dueDate ? new Date(newTodo.dueDate) : undefined,
      completed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        priority: newTodo.priority
      }
    };
    
    setItems([...items, todo]);
    setNewTodo({
      title: '',
      text: '',
      categoryId: 'self-regulation',
      dueDate: '',
      priority: 'medium'
    });
    setShowAddForm(false);
  };

  const toggleTodoComplete = (todoId: string) => {
    setItems(items.map(item => 
      item.id === todoId 
        ? { 
            ...item, 
            completed: !item.completed,
            updatedAt: new Date()
          }
        : item
    ));
  };

  const startEditingTodo = (todo: Item) => {
    setEditingTodo(todo.id);
    setExpandedTodo(todo.id);
    setEditTodo({
      title: todo.title,
      text: todo.text,
      dueDate: todo.dueDate ? todo.dueDate.toISOString().split('T')[0] : '',
      priority: todo.metadata?.priority || 'medium'
    });
  };

  const saveEditedTodo = (todoId: string) => {
    setItems(items.map(item => 
      item.id === todoId 
        ? { 
            ...item, 
            title: editTodo.title,
            text: editTodo.text,
            dueDate: editTodo.dueDate ? new Date(editTodo.dueDate) : undefined,
            metadata: { 
              ...item.metadata, 
              priority: editTodo.priority
            },
            updatedAt: new Date()
          }
        : item
    ));
    setEditingTodo(null);
  };

  const cancelEditing = () => {
    setEditingTodo(null);
    setEditTodo({
      title: '',
      text: '',
      dueDate: '',
      priority: 'medium'
    });
  };

  const handleTodoClick = (todoId: string) => {
    if (expandedTodo === todoId) {
      setExpandedTodo(null);
    } else {
      setExpandedTodo(todoId);
    }
  };

  const deleteTodo = (todoId: string) => {
    setItems(items.filter(item => item.id !== todoId));
    setExpandedTodo(null);
    setEditingTodo(null);
  };

  const totalTodos = filteredTodos.length;
  const completedTodos = filteredTodos.filter(todo => todo.completed).length;
  const overdueTodos = filteredTodos.filter(todo => !todo.completed && isOverdue(todo.dueDate)).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="p-6 max-w-7xl mx-auto">
        {/* Floating Header */}
        <div className="sticky top-6 z-40 mb-8">
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-500 bg-clip-text text-transparent flex items-center">
                  <CheckSquare className="w-10 h-10 text-green-600 mr-4" />
                  Todos
                </h1>
                <p className="text-gray-600 mt-2 text-lg">
                  {completedTodos} of {totalTodos} completed • {overdueTodos} overdue
                </p>
              </div>
              <button
                onClick={() => setShowAddForm(true)}
                className="group relative overflow-hidden bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-8 py-4 rounded-2xl flex items-center transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
              >
                <div className="absolute inset-0 bg-white/20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                <Plus className="w-5 h-5 mr-3 relative z-10" />
                <span className="font-semibold relative z-10">New Todo</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tesla-Style Controls */}
        <div className="mb-8">
          <div className="bg-white/60 backdrop-blur-xl rounded-2xl shadow-lg border border-white/30 p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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

              {/* Status Filter */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as 'all' | 'pending' | 'completed' | 'overdue')}
                  className="w-full px-4 py-4 bg-white/70 border border-gray-200/50 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300 text-gray-800"
                >
                  <option value="all">All Tasks</option>
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>

              {/* Sort Options */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Sort by</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'dueDate' | 'priority' | 'category')}
                  className="w-full px-4 py-4 bg-white/70 border border-gray-200/50 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300 text-gray-800"
                >
                  <option value="dueDate">Due Date</option>
                  <option value="priority">Priority</option>
                  <option value="category">Category</option>
                </select>
              </div>

              {/* Quick Stats */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Quick Stats</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Completed:</span>
                    <span className="font-bold text-green-600">{completedTodos}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pending:</span>
                    <span className="font-bold text-blue-600">{totalTodos - completedTodos}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Overdue:</span>
                    <span className="font-bold text-gray-900">{overdueTodos}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Clean List Layout */}
        <div className="bg-white/60 backdrop-blur-xl rounded-2xl shadow-lg border border-white/30 overflow-hidden">
          {sortedTodos.map((todo, index) => {
            const category = categories.find(c => c.id === todo.categoryId);
            const isCompleted = todo.completed;
            const priority = todo.metadata?.priority || 'medium';
            const isExpanded = expandedTodo === todo.id;
            const isEditing = editingTodo === todo.id;
            const overdue = isOverdue(todo.dueDate);
            const dueToday = isDueToday(todo.dueDate);
            
            return (
              <div
                key={todo.id}
                className={`group relative transition-all duration-300 hover:bg-white/80 ${
                  index !== sortedTodos.length - 1 ? 'border-b border-gray-200/50' : ''
                } ${isCompleted ? 'opacity-60' : ''}`}
                onClick={() => !isEditing && handleTodoClick(todo.id)}
                onDoubleClick={() => !isEditing && startEditingTodo(todo)}
              >
                {/* Priority indicator bar - using category color with opacity variation */}
                <div 
                  className="absolute left-0 top-0 bottom-0 w-1 transition-all duration-300"
                  style={{ 
                    backgroundColor: category?.color || '#3b82f6',
                    opacity: overdue ? 1 : 
                             dueToday ? 0.9 : 
                             priority === 'high' ? 0.8 :
                             priority === 'medium' ? 0.6 :
                             0.4
                  }}
                />
                
                <div className="p-6 pl-8">
                  {isEditing ? (
                    <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Title</label>
                        <input
                          type="text"
                          value={editTodo.title}
                          onChange={(e) => setEditTodo({ ...editTodo, title: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300"
                          autoFocus
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                        <textarea
                          ref={textareaRef}
                          value={editTodo.text}
                          onChange={(e) => setEditTodo({ ...editTodo, text: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300 resize-none overflow-hidden"
                          rows={3}
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Due Date</label>
                          <input
                            type="date"
                            value={editTodo.dueDate}
                            onChange={(e) => setEditTodo({ ...editTodo, dueDate: e.target.value })}
                            className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Priority</label>
                          <select
                            value={editTodo.priority}
                            onChange={(e) => setEditTodo({ ...editTodo, priority: e.target.value as 'low' | 'medium' | 'high' })}
                            className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300"
                          >
                            <option value="low">🌱 Low</option>
                            <option value="medium">⚡ Medium</option>
                            <option value="high">🔥 High</option>
                          </select>
                        </div>
                      </div>
                      
                      <div className="flex space-x-3 pt-4">
                        <button
                          onClick={() => saveEditedTodo(todo.id)}
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
                    <div className="flex items-center justify-between">
                      {/* Left side - Main content */}
                      <div className="flex items-center space-x-4 flex-1 min-w-0">
                        {/* Checkbox */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTodoComplete(todo.id);
                          }}
                          className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all duration-300 flex-shrink-0 ${
                            isCompleted 
                              ? 'bg-green-500 border-green-500 text-white' 
                              : 'border-gray-300 hover:border-blue-500'
                          }`}
                        >
                          {isCompleted && <Check className="w-4 h-4" />}
                        </button>
                        
                        {/* Category indicator */}
                        <div 
                          className="w-3 h-3 rounded-full shadow-sm flex-shrink-0"
                          style={{ backgroundColor: category?.color || '#3b82f6' }}
                        />
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-3 mb-1">
                            <h3 className={`font-semibold text-gray-800 truncate ${isCompleted ? 'line-through' : ''}`}>
                              {todo.title}
                            </h3>
                            <span className="text-sm">{getPriorityIcon(priority)}</span>
                          </div>
                          
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span className="flex items-center">
                              {category?.icon} {category?.name}
                            </span>
                            
                            {todo.dueDate && (
                              <span 
                                className={`flex items-center ${
                                  overdue ? 'font-bold' : 
                                  dueToday ? 'font-semibold' : 
                                  'text-gray-500'
                                }`}
                                style={{
                                  color: overdue || dueToday ? category?.color || '#3b82f6' : undefined,
                                  filter: overdue ? 'brightness(0.7)' : dueToday ? 'brightness(0.8)' : undefined
                                }}
                              >
                                <Calendar className="w-3 h-3 mr-1" />
                                {overdue ? 'Overdue' : 
                                 dueToday ? 'Due Today' : 
                                 todo.dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                            )}
                            
                            <span 
                              className="px-2 py-1 rounded-full text-xs font-medium"
                              style={{
                                backgroundColor: category?.color ? `${category.color}20` : '#3b82f620',
                                color: category?.color || '#3b82f6',
                                opacity: priority === 'high' ? 1 : priority === 'medium' ? 0.8 : 0.6
                              }}
                            >
                              {priority.toUpperCase()}
                            </span>
                          </div>
                          
                          {isExpanded && todo.text && (
                            <p className={`mt-3 text-gray-600 leading-relaxed ${isCompleted ? 'line-through opacity-60' : ''}`}>
                              {todo.text}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {/* Right side - Actions */}
                      <div className={`flex items-center space-x-2 transition-opacity ${
                        isExpanded ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}>
                        {/* Copy ID Button */}
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            const success = await copyToClipboard(todo.id);
                            if (success) {
                              showCopyFeedback(e.target as HTMLElement);
                            }
                          }}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Copy ID for AI chat"
                        >
                          <Copy className="w-4 h-4 text-gray-500" />
                        </button>
                        {!isEditing && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditingTodo(todo);
                            }}
                            className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                          >
                            <Edit3 className="w-4 h-4 text-gray-600" />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteTodo(todo.id);
                          }}
                          className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                        >
                          <X className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {sortedTodos.length === 0 && (
          <div className="text-center py-20">
            <div className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-xl border border-white/30 p-12 max-w-md mx-auto">
              <div className="w-20 h-20 bg-gradient-to-br from-green-600 to-emerald-700 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <CheckSquare className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-4">No todos yet</h3>
              <p className="text-gray-600 mb-8 leading-relaxed">
                {selectedCategory !== 'all' || filterStatus !== 'all'
                  ? 'Try adjusting your filters to see more tasks'
                  : 'Start organizing your tasks and boost your productivity'
                }
              </p>
              <button
                onClick={() => setShowAddForm(true)}
                className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-8 py-4 rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-lg"
              >
                <Plus className="w-5 h-5 mr-3 inline" />
                Create Your First Todo
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Revolutionary Add Todo Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/30 max-w-lg w-full overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-500 p-6 text-white">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold">New Todo</h3>
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
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Task Title *
                </label>
                <input
                  type="text"
                  value={newTodo.title}
                  onChange={(e) => setNewTodo({ ...newTodo, title: e.target.value })}
                  placeholder="e.g., Complete Georgetown application"
                  className="w-full px-4 py-4 bg-gray-50/50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all duration-300"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Description
                </label>
                <textarea
                  value={newTodo.text}
                  onChange={(e) => setNewTodo({ ...newTodo, text: e.target.value })}
                  placeholder="Add any additional details..."
                  rows={4}
                  className="w-full px-4 py-4 bg-gray-50/50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all duration-300 resize-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Category
                </label>
                <select
                  value={newTodo.categoryId}
                  onChange={(e) => setNewTodo({ ...newTodo, categoryId: e.target.value })}
                  className="w-full px-4 py-4 bg-gray-50/50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all duration-300"
                >
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.icon} {category.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={newTodo.dueDate}
                    onChange={(e) => setNewTodo({ ...newTodo, dueDate: e.target.value })}
                    className="w-full px-4 py-4 bg-gray-50/50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all duration-300"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Priority
                  </label>
                  <select
                    value={newTodo.priority}
                    onChange={(e) => setNewTodo({ ...newTodo, priority: e.target.value as 'low' | 'medium' | 'high' })}
                    className="w-full px-4 py-4 bg-gray-50/50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all duration-300"
                  >
                    <option value="low">🌱 Low Priority</option>
                    <option value="medium">⚡ Medium Priority</option>
                    <option value="high">🔥 High Priority</option>
                  </select>
                </div>
              </div>

              {/* AI Suggestions */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-4 border border-green-100">
                <h4 className="text-sm font-bold text-green-800 mb-3">📝 AI Todo Suggestions:</h4>
                <div className="text-xs text-green-700 space-y-2">
                  <p>• <strong>Georgetown:</strong> "Submit application essays" or "Schedule campus visit"</p>
                  <p>• <strong>Fitness:</strong> "Complete morning workout" or "Practice backflip technique"</p>
                  <p>• <strong>Business:</strong> "Review app wireframes" or "Call potential investors"</p>
                  <p>• <strong>Personal:</strong> "Read 30 pages" or "Practice Spanish for 1 hour"</p>
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="bg-gray-50/50 p-6 flex space-x-4">
              <button
                onClick={() => setShowAddForm(false)}
                className="flex-1 px-6 py-4 bg-gray-100 text-gray-700 rounded-2xl hover:bg-gray-200 transition-all duration-300 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleAddTodo}
                disabled={!newTodo.title.trim()}
                className="flex-1 px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-2xl hover:from-green-600 hover:to-emerald-600 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 shadow-lg font-semibold"
              >
                Create Todo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GlobalTodos;