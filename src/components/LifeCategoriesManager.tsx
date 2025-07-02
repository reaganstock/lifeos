import React, { useState, useEffect } from 'react';
import { FolderOpen, Plus, Edit3, Trash2, Star, ArrowUp, ArrowDown, X } from 'lucide-react';
// Removed initialCategories import - users create their own categories
import { Category } from '../types';
import { useAuthContext } from './AuthProvider';
import { useSupabaseData } from '../hooks/useSupabaseData';

interface LifeCategoriesManagerProps {
  onNavigateToCategory: (categoryId: string) => void;
}

const LifeCategoriesManager: React.FC<LifeCategoriesManagerProps> = ({ onNavigateToCategory }) => {
  const { user } = useAuthContext();
  const {
    categories: supabaseCategories,
    loading,
    error,
    createCategory,
    updateCategory,
    deleteCategory
  } = useSupabaseData();
  
  // Use Supabase categories for authenticated users, localStorage for others
  const categories = user ? supabaseCategories : [];
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [priorityError, setPriorityError] = useState<string>('');
  const [pendingRecompaction, setPendingRecompaction] = useState(false);
  const [newCategory, setNewCategory] = useState({
    name: '',
    icon: '📁',
    color: '#74B9FF',
    priority: 0
  });

  // Function to get the next available priority
  const getNextAvailablePriority = () => {
    const existingPriorities = categories.map(cat => cat.priority).sort((a, b) => a - b);
    for (let i = 0; i <= 10; i++) {
      if (!existingPriorities.includes(i)) {
        return i;
      }
    }
    // If all priorities 0-10 are taken, return the highest + 1
    return Math.max(...existingPriorities, 0) + 1;
  };

  // Function to check if priority is available
  const checkPriorityAvailable = (value: number, currentCategoryId?: string) => {
    return !categories.some(cat => 
      cat.priority === value && 
      (!currentCategoryId || cat.id !== currentCategoryId)
    );
  };

  // Function to get available priority slots
  const getAvailablePriorities = (currentCategoryId?: string) => {
    const available = [];
    for (let i = 0; i <= 10; i++) {
      if (checkPriorityAvailable(i, currentCategoryId)) {
        available.push(i);
      }
    }
    return available;
  };

  // Function to reorder priorities when a category takes an existing priority
  const reorderPriorities = async (changingCategoryId: string, newPriority: number) => {
    if (!user) return;

    // Find the category that currently has this priority
    const existingCategory = categories.find(cat => 
      cat.priority === newPriority && cat.id !== changingCategoryId
    );

    if (!existingCategory) return; // No conflict, no need to reorder

    console.log(`🔄 Reordering priorities: ${changingCategoryId} wants priority ${newPriority}, currently held by ${existingCategory.id}`);

    // Get all categories sorted by current priority
    const sortedCategories = [...categories]
      .filter(cat => cat.id !== changingCategoryId)
      .sort((a, b) => a.priority - b.priority);

    // Find where to insert the changing category
    const insertIndex = sortedCategories.findIndex(cat => cat.priority >= newPriority);
    
    // Create new ordering
    const reorderedCategories = [...sortedCategories];
    if (insertIndex === -1) {
      // Insert at the end
      reorderedCategories.push(categories.find(cat => cat.id === changingCategoryId)!);
    } else {
      // Insert at the found position
      reorderedCategories.splice(insertIndex, 0, categories.find(cat => cat.id === changingCategoryId)!);
    }

    // Assign new sequential priorities
    const updatePromises = reorderedCategories.map((cat, index) => {
      if (cat.priority !== index) {
        console.log(`📝 Updating "${cat.name}" from priority ${cat.priority} to ${index}`);
        return updateCategory(cat.id, { priority: index });
      }
      return Promise.resolve(true);
    });

    await Promise.all(updatePromises);
    console.log('✅ Priority reordering complete');
  };

  // Function to recompact priorities after deletion (removes gaps)
  const recompactPriorities = async () => {
    if (!user) return;

    console.log('🔧 Recompacting priorities after deletion...');
    
    // Get all categories sorted by priority
    const sortedCategories = [...categories].sort((a, b) => a.priority - b.priority);
    
    // Check if recompaction is needed (are there gaps?)
    let needsRecompaction = false;
    for (let i = 0; i < sortedCategories.length; i++) {
      if (sortedCategories[i].priority !== i) {
        needsRecompaction = true;
        break;
      }
    }

    if (!needsRecompaction) {
      console.log('✅ No recompaction needed - priorities are already sequential');
      return;
    }

    // Assign sequential priorities (0, 1, 2, 3...)
    const updatePromises = sortedCategories.map((cat, index) => {
      if (cat.priority !== index) {
        console.log(`📝 Recompacting "${cat.name}" from priority ${cat.priority} to ${index}`);
        return updateCategory(cat.id, { priority: index });
      }
      return Promise.resolve(true);
    });

    await Promise.all(updatePromises);
    console.log('✅ Priority recompaction complete');
  };

  // Function to validate priority input and show reorder preview
  const validatePriorityInput = (value: string, currentCategoryId?: string) => {
    const numValue = parseInt(value);
    
    // Clear previous errors
    setPriorityError('');
    
    // Handle invalid inputs
    if (isNaN(numValue) || value === '') {
      setPriorityError('Please enter a valid number between 0-10');
      return newCategory.priority; // Keep current value
    }
    
    // Check range
    if (numValue < 0 || numValue > 10) {
      setPriorityError('Priority must be between 0-10');
      return newCategory.priority; // Keep current value
    }
    
    // Check if this priority is taken (excluding current category if editing)
    const conflictCategory = categories.find(cat => 
      cat.priority === numValue && 
      (!currentCategoryId || cat.id !== currentCategoryId)
    );
    
    if (conflictCategory) {
      const priorityLabel = numValue === 0 ? 'Foundation' : `Priority ${numValue}`;
      setPriorityError(`⚠️ ${priorityLabel} is currently "${conflictCategory.name}". Saving will reorder other categories.`);
    }
    
    return numValue;
  };

  const handleAddCategory = async () => {
    if (!newCategory.name.trim()) return;

    // Check if there's a range error (not reorder warnings)
    if (priorityError && !priorityError.includes('Saving will reorder')) {
      alert('Please fix the priority error before saving.');
      return;
    }

    const categoryData = {
      name: newCategory.name,
      icon: newCategory.icon,
      color: newCategory.color,
      priority: newCategory.priority,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (user) {
      // Use Supabase for authenticated users
      const result = await createCategory(categoryData);
      if (result) {
        console.log('✅ Category created successfully:', result.name);
        
        // Trigger reordering if there was a conflict
        if (priorityError && priorityError.includes('Saving will reorder')) {
          await reorderPriorities(result.id, newCategory.priority);
        }
        
        setNewCategory({ name: '', icon: '📁', color: '#74B9FF', priority: getNextAvailablePriority() });
        setPriorityError('');
        setEditingCategory(null);
        setShowAddForm(false);
      } else {
        console.error('❌ Failed to create category');
        alert('Failed to create category. Please try again.');
      }
    } else {
      // Legacy localStorage handling for unauthenticated users
      // For unauthenticated users - this is no longer supported
      // const category: Category = {
      //   id: newCategory.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      //   ...categoryData
      // };
      // Note: This won't work because we're not managing localStorage categories anymore
      console.warn('⚠️ Cannot create categories for unauthenticated users');
      alert('Please sign in to create categories');
    }
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setPriorityError(''); // Clear any existing priority errors
    setNewCategory({
      name: category.name,
      icon: category.icon,
      color: category.color,
      priority: category.priority
    });
    setShowAddForm(true);
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory || !newCategory.name.trim()) return;

    // Check if there's a range error (not reorder warnings)
    if (priorityError && !priorityError.includes('Saving will reorder')) {
      alert('Please fix the priority error before saving.');
      return;
    }

    const updates = {
      name: newCategory.name,
      icon: newCategory.icon,
      color: newCategory.color,
      priority: newCategory.priority,
      updatedAt: new Date()
    };

    if (user) {
      // Use Supabase for authenticated users
      const success = await updateCategory(editingCategory.id, updates);
      if (success) {
        console.log('✅ Category updated successfully');
        
        // Trigger reordering if there was a conflict
        if (priorityError && priorityError.includes('Saving will reorder')) {
          await reorderPriorities(editingCategory.id, newCategory.priority);
        }
        
        setEditingCategory(null);
        setPriorityError('');
        setNewCategory({ name: '', icon: '📁', color: '#74B9FF', priority: getNextAvailablePriority() });
        setShowAddForm(false);
      } else {
        console.error('❌ Failed to update category');
        alert('Failed to update category. Please try again.');
      }
    } else {
      console.warn('⚠️ Cannot update categories for unauthenticated users');
      alert('Please sign in to update categories');
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (user) {
      // Use Supabase for authenticated users - the warning dialog is already handled in useSupabaseData
      const success = await deleteCategory(categoryId);
      if (success) {
        console.log('✅ Category deleted successfully');
        
        // Mark that we need recompaction when categories update
        setPendingRecompaction(true);
      } else {
        console.error('❌ Failed to delete category');
        alert('Failed to delete category. Please try again.');
      }
    } else {
      console.warn('⚠️ Cannot delete categories for unauthenticated users');
      alert('Please sign in to delete categories');
    }
  };

  const adjustPriority = async (categoryId: string, direction: 'up' | 'down') => {
    if (!user) {
      console.warn('⚠️ Cannot adjust priority for unauthenticated users');
      alert('Please sign in to adjust category priorities');
      return;
    }

    const category = categories.find(cat => cat.id === categoryId);
    if (!category) return;

    const sortedCategories = [...categories].sort((a, b) => a.priority - b.priority);
    const currentIndex = sortedCategories.findIndex(cat => cat.id === categoryId);
    
    if (direction === 'up' && currentIndex === 0) {
      // Already at the top
      return;
    }
    
    if (direction === 'down' && currentIndex === sortedCategories.length - 1) {
      // Already at the bottom
      return;
    }

    // Calculate new positions to swap with adjacent category
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const targetCategory = sortedCategories[targetIndex];
    
    // Swap priorities between the two categories
    const newPriority = targetCategory.priority;
    const targetNewPriority = category.priority;
    
    try {
      // Update both categories to swap their priorities
      const [success1, success2] = await Promise.all([
        updateCategory(categoryId, { priority: newPriority }),
        updateCategory(targetCategory.id, { priority: targetNewPriority })
      ]);
      
      if (success1 && success2) {
        console.log('✅ Category priorities swapped successfully');
      } else {
        console.error('❌ Failed to swap category priorities');
        alert('Failed to update category priorities. Please try again.');
      }
    } catch (error) {
      console.error('❌ Error swapping priorities:', error);
      alert('Failed to update category priorities. Please try again.');
    }
  };

  const sortedCategories = [...categories].sort((a, b) => a.priority - b.priority);

  const commonIcons = ['📱', '💪', '🏋️', '✝️', '📝', '🗣️', '⚖️', '🎯', '💼', '🎨', '🏠', '💰', '🌱', '🧠', '❤️'];
  const commonColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#74B9FF', '#FD79A8', '#FDCB6E', '#6C5CE7'];

  // Auto-recompact priorities when categories change after deletion
  useEffect(() => {
    if (pendingRecompaction && user && categories.length > 0) {
      console.log('📋 Categories updated after deletion, checking for recompaction...');
      setPendingRecompaction(false);
      recompactPriorities();
    }
  }, [categories.length, pendingRecompaction, user]);


  // Show loading state while data is being fetched
  if (user && loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your categories...</p>
        </div>
      </div>
    );
  }

  // Show error state if data loading failed
  if (user && error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Failed to load categories: {error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Show authentication prompt for unauthenticated users
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <FolderOpen className="w-16 h-16 text-purple-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Life Categories Manager</h2>
          <p className="text-gray-600 mb-6">
            Sign in to create and manage your life categories. Categories help organize all your todos, events, goals, and notes.
          </p>
          <button
            onClick={() => alert('Please use the sign in button in the sidebar')}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Sign In Required
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50">
      <div className="p-6 max-w-7xl mx-auto">
        {/* Floating Header */}
        <div className="sticky top-6 z-40 mb-8">
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-indigo-500 bg-clip-text text-transparent flex items-center">
                  <FolderOpen className="w-10 h-10 text-purple-600 mr-4" />
                  Life Categories Manager
                </h1>
                <p className="text-gray-600 mt-2 text-lg">
                  Organize your life into meaningful categories. Everything you do will be assigned to one of these.
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => {
                    setNewCategory({ 
                      name: '', 
                      icon: '📁', 
                      color: '#74B9FF', 
                      priority: getNextAvailablePriority() 
                    });
                    setShowAddForm(true);
                  }}
                  className="group relative overflow-hidden bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white px-8 py-4 rounded-2xl flex items-center transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
                >
                  <div className="absolute inset-0 bg-white/20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                  <Plus className="w-5 h-5 mr-3 relative z-10" />
                  <span className="font-semibold relative z-10">Add Category</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Revolutionary Add/Edit Form */}
        {showAddForm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/30 max-w-2xl w-full overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-purple-500 to-indigo-500 p-6 text-white">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-bold">
                    {editingCategory ? 'Edit Category' : 'Add New Life Category'}
                  </h3>
                  <button
                    onClick={() => {
                      setShowAddForm(false);
                      setEditingCategory(null);
                      setPriorityError('');
                      setNewCategory({ name: '', icon: '📁', color: '#74B9FF', priority: getNextAvailablePriority() });
                    }}
                    className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
              
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">Category Name *</label>
                    <input
                      type="text"
                      value={newCategory.name}
                      onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                      className="w-full px-4 py-4 bg-gray-50/50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all duration-300"
                      placeholder="e.g., Health & Fitness"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">Priority (0 = Foundation)</label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={newCategory.priority}
                      onChange={(e) => setNewCategory({ ...newCategory, priority: validatePriorityInput(e.target.value, editingCategory?.id) })}
                      className={`w-full px-4 py-4 bg-gray-50/50 border rounded-2xl focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all duration-300 ${
                        priorityError 
                          ? priorityError.includes('Saving will reorder')
                            ? 'border-yellow-300 bg-yellow-50/50'
                            : 'border-red-300 bg-red-50/50'
                          : 'border-gray-200'
                      }`}
                    />
                    {priorityError && (
                      <p className={`text-xs mt-2 flex items-center ${
                        priorityError.includes('Saving will reorder') 
                          ? 'text-yellow-700' 
                          : 'text-red-600'
                      }`}>
                        <span className="mr-1">⚠️</span>
                        {priorityError}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      Lower numbers = higher priority. Only one category per priority level allowed.
                    </p>
                    {getAvailablePriorities(editingCategory?.id).length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-600 mb-1">Available priorities:</p>
                        <div className="flex flex-wrap gap-1">
                          {getAvailablePriorities(editingCategory?.id).map(priority => (
                            <button
                              key={priority}
                              type="button"
                              onClick={() => {
                                setNewCategory({ ...newCategory, priority });
                                setPriorityError('');
                              }}
                              className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
                            >
                              {priority === 0 ? 'Foundation' : priority}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Icon</label>
                  <div className="flex items-center space-x-4">
                    <input
                      type="text"
                      value={newCategory.icon}
                      onChange={(e) => setNewCategory({ ...newCategory, icon: e.target.value })}
                      className="w-20 px-4 py-4 bg-gray-50/50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all duration-300 text-center text-xl"
                    />
                    <div className="flex flex-wrap gap-2">
                      {commonIcons.map(icon => (
                        <button
                          key={icon}
                          onClick={() => setNewCategory({ ...newCategory, icon })}
                          className="p-3 hover:bg-purple-50 rounded-xl text-xl transition-all duration-300 hover:scale-110"
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Color</label>
                  <div className="flex items-center space-x-4">
                    <input
                      type="color"
                      value={newCategory.color}
                      onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
                      className="w-16 h-16 border border-gray-300 rounded-2xl cursor-pointer"
                    />
                    <div className="flex flex-wrap gap-2">
                      {commonColors.map(color => (
                        <button
                          key={color}
                          onClick={() => setNewCategory({ ...newCategory, color })}
                          className="w-10 h-10 rounded-full border-2 border-gray-300 hover:scale-110 transition-all duration-300"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Footer */}
              <div className="bg-gray-50/50 p-6 flex space-x-4">
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingCategory(null);
                    setPriorityError('');
                    setNewCategory({ name: '', icon: '📁', color: '#74B9FF', priority: getNextAvailablePriority() });
                  }}
                  className="flex-1 px-6 py-4 bg-gray-100 text-gray-700 rounded-2xl hover:bg-gray-200 transition-all duration-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={editingCategory ? handleUpdateCategory : handleAddCategory}
                  disabled={!newCategory.name.trim() || (!!priorityError && !priorityError.includes('Saving will reorder'))}
                  className="flex-1 px-6 py-4 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-2xl hover:from-purple-600 hover:to-indigo-600 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 shadow-lg font-semibold"
                >
                  {editingCategory ? 'Update Category' : 'Add Category'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Revolutionary Categories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {sortedCategories.map((category) => (
            <div
              key={category.id}
              className="group relative bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/30 overflow-hidden transition-all duration-500 hover:shadow-2xl hover:scale-[1.02]"
            >
              {/* Gradient Border */}
              <div 
                className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r opacity-80"
                style={{ 
                  background: `linear-gradient(90deg, ${category.color}, ${category.color}dd)` 
                }}
              />
              
              <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-lg" style={{ backgroundColor: `${category.color}20` }}>
                      {category.icon}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-800">{category.name}</h3>
                      <div className="flex items-center space-x-2 mt-2">
                        <span className="text-sm font-medium text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                          Priority: {category.priority === 0 ? 'Foundation' : category.priority}
                        </span>
                        {category.priority <= 2 && (
                          <Star className="w-4 h-4 text-yellow-500 fill-current" />
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => adjustPriority(category.id, 'up')}
                      className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all duration-300"
                      title="Increase priority"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => adjustPriority(category.id, 'down')}
                      className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all duration-300"
                      title="Decrease priority"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <button
                    onClick={() => onNavigateToCategory(category.id)}
                    className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl hover:from-blue-600 hover:to-cyan-600 text-sm font-semibold transition-all duration-300 transform hover:scale-105 shadow-md"
                  >
                    Open Category
                  </button>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleEditCategory(category)}
                      className="p-3 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-300"
                      title="Edit category"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(category.id)}
                      className="p-3 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-300"
                      title="Delete category"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Revolutionary Tips Section */}
        <div className="bg-white/60 backdrop-blur-xl rounded-2xl shadow-lg border border-white/30 p-8">
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-6 border border-blue-100">
            <h3 className="text-xl font-bold text-blue-900 mb-4 flex items-center">
              💡 Tips for Life Categories
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
              <ul className="space-y-2">
                <li className="flex items-start space-x-2">
                  <span className="text-blue-500 font-bold">•</span>
                  <span>Keep categories broad enough to encompass related activities</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-blue-500 font-bold">•</span>
                  <span>Priority 0 = Foundation (self-regulation, health basics)</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-blue-500 font-bold">•</span>
                  <span>Priority 1-2 = High priority areas you want to focus on</span>
                </li>
              </ul>
              <ul className="space-y-2">
                <li className="flex items-start space-x-2">
                  <span className="text-blue-500 font-bold">•</span>
                  <span>Priority 3+ = Important but secondary areas</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-blue-500 font-bold">•</span>
                  <span>Every todo, event, goal, etc. will be assigned to one of these categories</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-blue-500 font-bold">•</span>
                  <span>Use meaningful icons and colors to make categories easily recognizable</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LifeCategoriesManager; 