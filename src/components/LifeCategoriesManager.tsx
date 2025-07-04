import React, { useState, useEffect } from 'react';
import { FolderOpen, Plus, Edit3, Trash2, Star, ArrowUp, ArrowDown, X } from 'lucide-react';
// Removed initialCategories import - users create their own categories
import { Category } from '../types';
import { useAuthContext } from './AuthProvider';
import { useSupabaseData } from '../hooks/useSupabaseData';

interface LifeCategoriesManagerProps {
  onNavigateToCategory: (categoryId: string) => void;
  categories: Category[];
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
}

const LifeCategoriesManager: React.FC<LifeCategoriesManagerProps> = ({ onNavigateToCategory, categories, setCategories }) => {
  const { user } = useAuthContext();
  const {
    loading,
    error,
    createCategory: createSupabaseCategory,
    updateCategory: updateSupabaseCategory,
    deleteCategory: deleteSupabaseCategory
  } = useSupabaseData();
  
  // Use localStorage-first pattern with categories passed from App.tsx
  
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

    // Update categories with new sequential priorities (localStorage-first)
    const updatedCategories = categories.map(cat => {
      const newIndex = reorderedCategories.findIndex(reordered => reordered.id === cat.id);
      if (newIndex !== -1 && cat.priority !== newIndex) {
        console.log(`📝 Updating "${cat.name}" from priority ${cat.priority} to ${newIndex}`);
        return { ...cat, priority: newIndex, updatedAt: new Date() };
      }
      return cat;
    });

    setCategories(updatedCategories);

    // Background sync to Supabase if user is authenticated
    if (user) {
      try {
        const updatePromises = reorderedCategories.map(async (cat, index) => {
          if (cat.priority !== index) {
            return updateSupabaseCategory(cat.id, { priority: index });
          }
          return Promise.resolve(true);
        });
        await Promise.all(updatePromises);
        console.log('✅ Priority reordering synced to Supabase');
      } catch (error) {
        console.error('⚠️ Failed to sync priority reordering to Supabase:', error);
      }
    }
    
    console.log('✅ Priority reordering complete');
  };

  // Function to recompact priorities after deletion (removes gaps)
  const recompactPriorities = async () => {
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

    // Assign sequential priorities (0, 1, 2, 3...) in localStorage immediately
    const updatedCategories = categories.map(cat => {
      const sortedIndex = sortedCategories.findIndex(sorted => sorted.id === cat.id);
      if (sortedIndex !== -1 && cat.priority !== sortedIndex) {
        console.log(`📝 Recompacting "${cat.name}" from priority ${cat.priority} to ${sortedIndex}`);
        return { ...cat, priority: sortedIndex, updatedAt: new Date() };
      }
      return cat;
    });

    setCategories(updatedCategories);

    // Background sync to Supabase if user is authenticated
    if (user) {
      try {
        const updatePromises = sortedCategories.map(async (cat, index) => {
          if (cat.priority !== index) {
            return updateSupabaseCategory(cat.id, { priority: index });
          }
          return Promise.resolve(true);
        });
        await Promise.all(updatePromises);
        console.log('✅ Priority recompaction synced to Supabase');
      } catch (error) {
        console.error('⚠️ Failed to sync priority recompaction to Supabase:', error);
      }
    }
    
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

  // localStorage-first helper functions
  const reorderPrioritiesLocal = (categoriesList: Category[], targetCategoryId: string, newPriority: number) => {
    // Create a copy for manipulation
    const categoryMap = new Map(categoriesList.map(cat => [cat.id, { ...cat }]));
    const targetCategory = categoryMap.get(targetCategoryId);
    
    if (!targetCategory) return categoriesList;
    
    const oldPriority = targetCategory.priority;
    targetCategory.priority = newPriority;
    
    // Adjust other categories
    categoryMap.forEach((category, id) => {
      if (id === targetCategoryId) return;
      
      if (oldPriority < newPriority && category.priority > oldPriority && category.priority <= newPriority) {
        category.priority = Math.max(0, category.priority - 1);
      } else if (oldPriority > newPriority && category.priority >= newPriority && category.priority < oldPriority) {
        category.priority = Math.min(10, category.priority + 1);
      }
    });
    
    return Array.from(categoryMap.values()).sort((a, b) => a.priority - b.priority);
  };

  const handleAddCategory = async () => {
    if (!newCategory.name.trim()) return;

    // Check if there's a range error (not reorder warnings)
    if (priorityError && !priorityError.includes('Saving will reorder')) {
      alert('Please fix the priority error before saving.');
      return;
    }

    // Create new category with localStorage-first pattern
    const newCategoryId = `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const categoryData = {
      id: newCategoryId,
      name: newCategory.name,
      icon: newCategory.icon,
      color: newCategory.color,
      priority: newCategory.priority,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Update localStorage immediately (localStorage-first pattern)
    const updatedCategories = [...categories, categoryData];
    
    // Trigger reordering if there was a conflict
    if (priorityError && priorityError.includes('Saving will reorder')) {
      const reorderedCategories = reorderPrioritiesLocal(updatedCategories, newCategoryId, newCategory.priority);
      setCategories(reorderedCategories);
    } else {
      setCategories(updatedCategories);
    }

    // Background sync to Supabase if user is authenticated
    if (user) {
      try {
        await createSupabaseCategory(categoryData);
        console.log('✅ Category synced to Supabase:', categoryData.name);
      } catch (error) {
        console.error('⚠️ Failed to sync category to Supabase:', error);
        // Don't show error to user as localStorage update succeeded
      }
    }
    
    // Reset form
    setNewCategory({ name: '', icon: '📁', color: '#74B9FF', priority: getNextAvailablePriority() });
    setPriorityError('');
    setEditingCategory(null);
    setShowAddForm(false);
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

    // Update localStorage immediately (localStorage-first pattern)
    let updatedCategories = categories.map(cat => 
      cat.id === editingCategory.id 
        ? { ...cat, ...updates }
        : cat
    );
    
    // Trigger reordering if there was a conflict
    if (priorityError && priorityError.includes('Saving will reorder')) {
      updatedCategories = reorderPrioritiesLocal(updatedCategories, editingCategory.id, newCategory.priority);
    }
    
    setCategories(updatedCategories);

    // Background sync to Supabase if user is authenticated
    if (user) {
      try {
        await updateSupabaseCategory(editingCategory.id, updates);
        console.log('✅ Category synced to Supabase');
      } catch (error) {
        console.error('⚠️ Failed to sync category update to Supabase:', error);
        // Don't show error to user as localStorage update succeeded
      }
    }
    
    // Reset form
    setEditingCategory(null);
    setPriorityError('');
    setNewCategory({ name: '', icon: '📁', color: '#74B9FF', priority: getNextAvailablePriority() });
    setShowAddForm(false);
  };

  const handleDeleteCategory = async (categoryId: string) => {
    const categoryToDelete = categories.find(cat => cat.id === categoryId);
    if (!categoryToDelete) return;

    // Show confirmation dialog with item count (similar to useSupabaseData)
    const itemsInCategory = JSON.parse(localStorage.getItem('lifeStructureItems') || '[]')
      .filter((item: any) => item.categoryId === categoryId);
    
    let confirmMessage = `Are you sure you want to delete the category "${categoryToDelete.name}"?`;
    
    if (itemsInCategory.length > 0) {
      confirmMessage += `\n\n⚠️ WARNING: This will also delete ${itemsInCategory.length} item${itemsInCategory.length === 1 ? '' : 's'} (notes, todos, events, goals, routines) assigned to this category.\n\nThis action cannot be undone.`;
    } else {
      confirmMessage += '\n\nThis action cannot be undone.';
    }

    const confirmed = window.confirm(confirmMessage);
    if (!confirmed) return;

    // Update localStorage immediately (localStorage-first pattern)
    const updatedCategories = categories.filter(cat => cat.id !== categoryId);
    setCategories(updatedCategories);

    // Also remove items from this category in localStorage
    if (itemsInCategory.length > 0) {
      const allItems = JSON.parse(localStorage.getItem('lifeStructureItems') || '[]');
      const updatedItems = allItems.filter((item: any) => item.categoryId !== categoryId);
      localStorage.setItem('lifeStructureItems', JSON.stringify(updatedItems));
      
      // Trigger a storage event to update other components
      window.dispatchEvent(new CustomEvent('forceDataRefresh'));
    }

    // Background sync to Supabase if user is authenticated
    if (user) {
      try {
        await deleteSupabaseCategory(categoryId);
        console.log('✅ Category deletion synced to Supabase');
      } catch (error) {
        console.error('⚠️ Failed to sync category deletion to Supabase:', error);
        // Don't show error to user as localStorage update succeeded
      }
    }
    
    // Mark that we need recompaction
    setPendingRecompaction(true);
  };

  const adjustPriority = async (categoryId: string, direction: 'up' | 'down') => {
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
    
    // Swap priorities between the two categories in localStorage immediately
    const updatedCategories = categories.map(cat => {
      if (cat.id === categoryId) {
        return { ...cat, priority: targetCategory.priority, updatedAt: new Date() };
      } else if (cat.id === targetCategory.id) {
        return { ...cat, priority: category.priority, updatedAt: new Date() };
      }
      return cat;
    });
    
    setCategories(updatedCategories);

    // Background sync to Supabase if user is authenticated
    if (user) {
      try {
        await Promise.all([
          updateSupabaseCategory(categoryId, { priority: targetCategory.priority }),
          updateSupabaseCategory(targetCategory.id, { priority: category.priority })
        ]);
        console.log('✅ Category priorities synced to Supabase');
      } catch (error) {
        console.error('⚠️ Failed to sync priority swap to Supabase:', error);
        // Don't show error to user as localStorage update succeeded
      }
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