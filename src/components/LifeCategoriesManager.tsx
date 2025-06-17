import React, { useState } from 'react';
import { FolderOpen, Plus, Edit3, Trash2, Star, ArrowUp, ArrowDown, X } from 'lucide-react';
import { categories as initialCategories } from '../data/initialData';
import { Category } from '../types';

interface LifeCategoriesManagerProps {
  onNavigateToCategory: (categoryId: string) => void;
}

const LifeCategoriesManager: React.FC<LifeCategoriesManagerProps> = ({ onNavigateToCategory }) => {
  const [categories, setCategories] = useState(initialCategories);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [newCategory, setNewCategory] = useState({
    name: '',
    icon: '📁',
    color: '#74B9FF',
    priority: 6
  });

  const handleAddCategory = () => {
    if (!newCategory.name.trim()) return;

    const category: Category = {
      id: newCategory.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      name: newCategory.name,
      icon: newCategory.icon,
      color: newCategory.color,
      priority: newCategory.priority,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    setCategories([...categories, category]);
    setNewCategory({ name: '', icon: '📁', color: '#74B9FF', priority: 6 });
    setShowAddForm(false);
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setNewCategory({
      name: category.name,
      icon: category.icon,
      color: category.color,
      priority: category.priority
    });
    setShowAddForm(true);
  };

  const handleUpdateCategory = () => {
    if (!editingCategory || !newCategory.name.trim()) return;

    setCategories(categories.map(cat => 
      cat.id === editingCategory.id 
        ? { ...cat, name: newCategory.name, icon: newCategory.icon, color: newCategory.color, priority: newCategory.priority }
        : cat
    ));
    
    setEditingCategory(null);
    setNewCategory({ name: '', icon: '📁', color: '#74B9FF', priority: 6 });
    setShowAddForm(false);
  };

  const handleDeleteCategory = (categoryId: string) => {
    if (window.confirm('Are you sure you want to delete this category? This action cannot be undone.')) {
      setCategories(categories.filter(cat => cat.id !== categoryId));
    }
  };

  const adjustPriority = (categoryId: string, direction: 'up' | 'down') => {
    setCategories(categories.map(cat => {
      if (cat.id === categoryId) {
        const newPriority = direction === 'up' ? Math.max(0, cat.priority - 1) : cat.priority + 1;
        return { ...cat, priority: newPriority };
      }
      return cat;
    }));
  };

  const sortedCategories = [...categories].sort((a, b) => a.priority - b.priority);

  const commonIcons = ['📱', '💪', '🏋️', '✝️', '📝', '🗣️', '⚖️', '🎯', '💼', '🎨', '🏠', '💰', '🌱', '🧠', '❤️'];
  const commonColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#74B9FF', '#FD79A8', '#FDCB6E', '#6C5CE7'];

  // Quick add 3 categories functionality
  const handleQuickAdd3Categories = () => {
    const quickCategories = [
      { name: 'Health & Fitness', icon: '💪', color: '#4ECDC4' },
      { name: 'Career & Business', icon: '💼', color: '#45B7D1' },
      { name: 'Personal Growth', icon: '🌱', color: '#96CEB4' }
    ];

    const newCategories = quickCategories.map((cat, index) => ({
      id: (cat.name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now() + index),
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
      priority: categories.length + index + 1,
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    setCategories([...categories, ...newCategories]);
  };

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
                  onClick={handleQuickAdd3Categories}
                  className="group relative overflow-hidden bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-6 py-4 rounded-2xl flex items-center transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
                >
                  <div className="absolute inset-0 bg-white/20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                  <span className="text-xl mr-2 relative z-10">⚡</span>
                  <span className="font-semibold relative z-10 text-sm">Quick +3</span>
                </button>

                <button
                  onClick={() => setShowAddForm(true)}
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
                      setNewCategory({ name: '', icon: '📁', color: '#74B9FF', priority: 6 });
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
                      onChange={(e) => setNewCategory({ ...newCategory, priority: parseInt(e.target.value) })}
                      className="w-full px-4 py-4 bg-gray-50/50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all duration-300"
                    />
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
                    setNewCategory({ name: '', icon: '📁', color: '#74B9FF', priority: 6 });
                  }}
                  className="flex-1 px-6 py-4 bg-gray-100 text-gray-700 rounded-2xl hover:bg-gray-200 transition-all duration-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={editingCategory ? handleUpdateCategory : handleAddCategory}
                  disabled={!newCategory.name.trim()}
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