import React, { useState, useEffect } from 'react';
import { 
  Plus, X, Clock, Trash2, Edit3, Save, RotateCcw, 
  ChevronUp, ChevronDown, GripVertical, Zap, Coffee, 
  Sunrise, Sun, Sunset, Moon, ArrowUp, ArrowDown
} from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface DailyFlowItem {
  id: string;
  time: string;
  activity: string;
  categoryId: string;
  duration?: number; // in minutes
  priority?: 'low' | 'medium' | 'high';
  type?: 'routine' | 'work' | 'break' | 'personal';
  notes?: string;
}

interface DailyFlowEditorProps {
  isOpen: boolean;
  onClose: () => void;
  initialFlow?: DailyFlowItem[];
  categories: Array<{ id: string; name: string; icon: string; color: string }>;
  onSave: (flow: DailyFlowItem[]) => void;
}

// Sortable Item Component
function SortableFlowItem({ 
  item, 
  categories, 
  onUpdate, 
  onDelete, 
  isEditing, 
  onToggleEdit 
}: {
  item: DailyFlowItem;
  categories: Array<{ id: string; name: string; icon: string; color: string }>;
  onUpdate: (id: string, updates: Partial<DailyFlowItem>) => void;
  onDelete: (id: string) => void;
  isEditing: boolean;
  onToggleEdit: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const category = categories.find(c => c.id === item.categoryId);
  const getTimeIcon = (time: string) => {
    const hour = parseInt(time.split(':')[0]);
    if (hour >= 5 && hour < 12) return Sunrise;
    if (hour >= 12 && hour < 17) return Sun;
    if (hour >= 17 && hour < 21) return Sunset;
    return Moon;
  };

  const TimeIcon = getTimeIcon(item.time);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group bg-white border border-gray-200 rounded-xl p-4 transition-all duration-200 hover:shadow-md ${
        isDragging ? 'shadow-lg' : ''
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab hover:cursor-grabbing text-gray-400 hover:text-gray-600 transition-colors"
        >
          <GripVertical className="w-4 h-4" />
        </div>

        {/* Time Icon */}
        <div className="p-2 bg-gray-50 rounded-lg">
          <TimeIcon className="w-4 h-4 text-gray-600" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="time"
                  value={item.time}
                  onChange={(e) => onUpdate(item.id, { time: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <select
                  value={item.categoryId}
                  onChange={(e) => onUpdate(item.id, { categoryId: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <input
                type="text"
                value={item.activity}
                onChange={(e) => onUpdate(item.id, { activity: e.target.value })}
                placeholder="Activity name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  value={item.duration || ''}
                  onChange={(e) => onUpdate(item.id, { duration: parseInt(e.target.value) || undefined })}
                  placeholder="Duration (min)"
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <select
                  value={item.priority || 'medium'}
                  onChange={(e) => onUpdate(item.id, { priority: e.target.value as 'low' | 'medium' | 'high' })}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                </select>
              </div>
              <textarea
                value={item.notes || ''}
                onChange={(e) => onUpdate(item.id, { notes: e.target.value })}
                placeholder="Notes (optional)"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-gray-900">{item.time}</span>
                <span className="text-sm font-medium text-gray-600">{item.activity}</span>
                {item.priority === 'high' && (
                  <Zap className="w-3 h-3 text-amber-500" />
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>{category?.icon} {category?.name}</span>
                {item.duration && (
                  <>
                    <span>•</span>
                    <span>{item.duration}min</span>
                  </>
                )}
              </div>
              {item.notes && (
                <p className="text-xs text-gray-400 mt-1 italic">{item.notes}</p>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onToggleEdit(item.id)}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(item.id)}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DailyFlowEditor({ 
  isOpen, 
  onClose, 
  initialFlow = [], 
  categories, 
  onSave 
}: DailyFlowEditorProps) {
  const [flowItems, setFlowItems] = useState<DailyFlowItem[]>(initialFlow);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    setFlowItems(initialFlow);
    setHasChanges(false);
  }, [initialFlow]);

  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 6; hour < 24; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      if (hour < 23) slots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
    return slots;
  };

  const addNewItem = () => {
    const timeSlots = generateTimeSlots();
    const usedTimes = new Set(flowItems.map(item => item.time));
    const availableTime = timeSlots.find(time => !usedTimes.has(time)) || '09:00';

    const newItem: DailyFlowItem = {
      id: `flow-${Date.now()}`,
      time: availableTime,
      activity: 'New Activity',
      categoryId: categories[0]?.id || '',
      duration: 60,
      priority: 'medium',
      type: 'routine'
    };

    setFlowItems(prev => [...prev, newItem].sort((a, b) => a.time.localeCompare(b.time)));
    setEditingItemId(newItem.id);
    setHasChanges(true);
  };

  const updateItem = (id: string, updates: Partial<DailyFlowItem>) => {
    setFlowItems(prev => prev.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
    setHasChanges(true);
  };

  const deleteItem = (id: string) => {
    setFlowItems(prev => prev.filter(item => item.id !== id));
    setHasChanges(true);
  };

  const toggleEdit = (id: string) => {
    setEditingItemId(editingItemId === id ? null : id);
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      setFlowItems((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id);
        const newIndex = items.findIndex(item => item.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        setHasChanges(true);
        return newItems;
      });
    }
  };

  const resetToDefault = () => {
    const defaultFlow: DailyFlowItem[] = [
      {
        id: 'default-1',
        time: '06:00',
        activity: 'Morning Routine',
        categoryId: categories[0]?.id || '',
        duration: 60,
        priority: 'high',
        type: 'routine'
      },
      {
        id: 'default-2',
        time: '08:00',
        activity: 'Work/Study Session',
        categoryId: categories[1]?.id || '',
        duration: 240,
        priority: 'high',
        type: 'work'
      },
      {
        id: 'default-3',
        time: '12:00',
        activity: 'Lunch Break',
        categoryId: categories[0]?.id || '',
        duration: 60,
        priority: 'medium',
        type: 'break'
      },
      {
        id: 'default-4',
        time: '18:00',
        activity: 'Evening Activities',
        categoryId: categories[2]?.id || '',
        duration: 120,
        priority: 'medium',
        type: 'personal'
      }
    ];
    setFlowItems(defaultFlow);
    setHasChanges(true);
  };

  const handleSave = () => {
    onSave(flowItems);
    setHasChanges(false);
    onClose();
  };

  const getTotalDuration = () => {
    return flowItems.reduce((total, item) => total + (item.duration || 0), 0);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center">
              <Clock className="w-6 h-6 mr-3 text-blue-600" />
              Daily Flow Editor
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Customize your daily schedule • {flowItems.length} activities • {Math.floor(getTotalDuration() / 60)}h {getTotalDuration() % 60}m total
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Actions Bar */}
        <div className="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <button
              onClick={addNewItem}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Activity
            </button>
            <button
              onClick={resetToDefault}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reset Default
            </button>
          </div>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                Unsaved changes
              </span>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Save className="w-4 h-4" />
              Save Flow
            </button>
          </div>
        </div>

        {/* Flow Items */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {flowItems.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No activities scheduled</h3>
              <p className="text-gray-500 mb-4">Add your first activity to get started</p>
              <button
                onClick={addNewItem}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mx-auto"
              >
                <Plus className="w-4 h-4" />
                Add Activity
              </button>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={flowItems.map(item => item.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {flowItems
                    .sort((a, b) => a.time.localeCompare(b.time))
                    .map((item) => (
                      <SortableFlowItem
                        key={item.id}
                        item={item}
                        categories={categories}
                        onUpdate={updateItem}
                        onDelete={deleteItem}
                        isEditing={editingItemId === item.id}
                        onToggleEdit={toggleEdit}
                      />
                    ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>

        {/* Footer Stats */}
        <div className="p-4 bg-gray-50 border-t border-gray-200">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-lg font-bold text-blue-600">{flowItems.length}</div>
              <div className="text-xs text-gray-500">Activities</div>
            </div>
            <div>
              <div className="text-lg font-bold text-green-600">{Math.floor(getTotalDuration() / 60)}h {getTotalDuration() % 60}m</div>
              <div className="text-xs text-gray-500">Total Time</div>
            </div>
            <div>
              <div className="text-lg font-bold text-purple-600">{flowItems.filter(i => i.priority === 'high').length}</div>
              <div className="text-xs text-gray-500">High Priority</div>
            </div>
            <div>
              <div className="text-lg font-bold text-amber-600">{new Set(flowItems.map(i => i.categoryId)).size}</div>
              <div className="text-xs text-gray-500">Categories</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}