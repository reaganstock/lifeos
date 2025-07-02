import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, MapPin, Clock, Calendar, Mic, MicOff, Play, Pause, Camera, Edit3, Save, X, Maximize2, Trash2, CheckCircle, CheckCircle2, FileText, RotateCcw, BowArrow, Link, ExternalLink, FolderOpen, Globe, Brain, Settings, Filter } from 'lucide-react';
import { Item, Category } from '../types';
import { voiceService, VoiceRecording, TranscriptionResult } from '../services/voiceService';
import LocalCategoryNotes from './LocalCategoryNotes';
import CategoryKnowledge from './CategoryKnowledge';
import { CategoryRAGService } from '../services/categoryRAG';

interface CategoryPageProps {
  categoryId: string;
  onBack: () => void;
  items: Item[];
  setItems: React.Dispatch<React.SetStateAction<Item[]>>;
  categories: Category[];
  isGlobalAIAssistantOpen?: boolean;
}

const CategoryPage: React.FC<CategoryPageProps> = ({ categoryId, onBack, items, setItems, categories, isGlobalAIAssistantOpen }) => {
  const [activeTab, setActiveTab] = useState<Item['type']>('todo');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const [currentRecording, setCurrentRecording] = useState<VoiceRecording | null>(null);
  const [shouldTranscribe, setShouldTranscribe] = useState(true);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [fullscreenNote, setFullscreenNote] = useState<string | null>(null);
  const [fullscreenGoal, setFullscreenGoal] = useState<string | null>(null);
  const [fullscreenRoutine, setFullscreenRoutine] = useState<string | null>(null);
  const [playingNote, setPlayingNote] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editGoal, setEditGoal] = useState({
    title: '',
    text: '',
    target: '',
    progress: 0
  });
  const [newItem, setNewItem] = useState({
    title: '',
    text: '',
    dueDate: '',
    dateTime: '',
    location: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    frequency: 'daily' as 'daily' | 'weekly',
    timeOfDay: '',
    duration: 30,
    target: '',
    progress: 0
  });
  const [showRecurringDeleteModal, setShowRecurringDeleteModal] = useState(false);
  const [recurringDeleteData, setRecurringDeleteData] = useState<{
    itemId: string;
    recurrenceId: string;
    occurrenceCount: number;
    eventTitle: string;
  } | null>(null);

  // Context links and Google Drive state
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextLinks, setContextLinks] = useState<Array<{
    id: string;
    title: string;
    url: string;
    type: 'link' | 'drive' | 'document';
  }>>([]);
  const [showAddLinkModal, setShowAddLinkModal] = useState(false);
  const [newLink, setNewLink] = useState({
    title: '',
    url: '',
    type: 'link' as 'link' | 'drive' | 'document'
  });
  
  // Track if AI Assistant is open (for hiding FAB)
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
  
  // Category Knowledge Modal
  const [showKnowledgeModal, setShowKnowledgeModal] = useState(false);
  
  // Local Category Filters
  const [showLocalFilters, setShowLocalFilters] = useState(false);
  const [localPriorityFilter, setLocalPriorityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [localCompletionFilter, setLocalCompletionFilter] = useState<'all' | 'completed' | 'incomplete'>('all');
  const [localSortBy, setLocalSortBy] = useState<'recent' | 'priority' | 'due_date' | 'alphabetical' | 'progress' | 'date_time'>('recent');
  const [localDateFilter, setLocalDateFilter] = useState<'all' | 'today' | 'this_week' | 'upcoming' | 'overdue'>('all');
  const [localProgressFilter, setLocalProgressFilter] = useState<'all' | 'not_started' | 'in_progress' | 'completed'>('all');
  const [localFrequencyFilter, setLocalFrequencyFilter] = useState<'all' | 'daily' | 'weekly' | 'monthly' | 'yearly'>('all');
  const [localRoutineStatusFilter, setLocalRoutineStatusFilter] = useState<'all' | 'completed_today' | 'pending_today' | 'streak_active'>('all');
  const [localNotesFilter, setLocalNotesFilter] = useState<'all' | 'voice_notes' | 'text_notes' | 'with_images' | 'recent_week'>('all');

  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  // Set default datetime when switching to event tab or when modal opens
  useEffect(() => {
    if (showAddModal && activeTab === 'event' && !newItem.dateTime) {
      const now = new Date();
      now.setMinutes(now.getMinutes() + 60); // Default to 1 hour from now
      const defaultDateTime = now.toISOString().slice(0, 16);
      console.log('Setting default dateTime for event:', defaultDateTime);
      setNewItem(prev => ({ 
        ...prev, 
        dateTime: defaultDateTime 
      }));
    }
  }, [activeTab, showAddModal, newItem.dateTime]);

  // Clear form when modal closes or tab changes
  useEffect(() => {
    if (!showAddModal) {
      console.log('Modal closed, clearing form');
      setNewItem({
        title: '',
        text: '',
        dueDate: '',
        dateTime: '',
        location: '',
        priority: 'medium',
        frequency: 'daily',
        timeOfDay: '',
        duration: 30,
        target: '',
        progress: 0
      });
      setUploadedImages([]);
    }
  }, [showAddModal]);

  // Clear form when switching tabs
  useEffect(() => {
    console.log('Tab changed to:', activeTab);
    setNewItem(prev => ({
      title: '',
      text: '',
      dueDate: '',
      dateTime: activeTab === 'event' ? prev.dateTime : '',
      location: '',
      priority: 'medium',
      frequency: 'daily',
      timeOfDay: '',
      duration: 30,
      target: '',
      progress: 0
    }));
  }, [activeTab]);

  const category = categories.find(c => c.id === categoryId);
  const categoryItems = items.filter(item => item.categoryId === categoryId);

  // Handle category not found
  if (!category) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-blue-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-pink-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.864-.833-2.634 0L4.18 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Category Not Found</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6 text-lg">
            The category you're looking for doesn't exist or may have been deleted.
          </p>
          <button
            onClick={onBack}
            className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const tabs: { type: Item['type']; label: string; icon: React.ReactNode; gradient: string }[] = [
    { type: 'todo', label: 'Todos', icon: <CheckCircle className="w-5 h-5" />, gradient: 'from-green-500 to-emerald-500' },
    { type: 'event', label: 'Events', icon: <Calendar className="w-5 h-5" />, gradient: 'from-blue-500 to-cyan-500' },
    { type: 'note', label: 'Notes', icon: <FileText className="w-5 h-5" />, gradient: 'from-yellow-500 to-orange-500' },
    { type: 'routine', label: 'Routines', icon: <RotateCcw className="w-5 h-5" />, gradient: 'from-purple-500 to-pink-500' },
    { type: 'goal', label: 'Goals', icon: <BowArrow className="w-5 h-5" />, gradient: 'from-red-500 to-rose-500' }
  ];

  const filteredItems = categoryItems.filter(item => {
    // Tab type filter
    let typeMatch = false;
    if (activeTab === 'note') {
      typeMatch = item.type === 'note' || item.type === 'voiceNote';
    } else {
      typeMatch = item.type === activeTab;
    }
    
    if (!typeMatch) return false;
    
    // Priority filter (only for todos and goals)
    if ((activeTab === 'todo' || activeTab === 'goal') && localPriorityFilter !== 'all') {
      if (item.metadata?.priority !== localPriorityFilter) return false;
    }
    
    // Completion filter (only for todos)
    if (activeTab === 'todo' && localCompletionFilter !== 'all') {
      const isCompleted = item.completed || false;
      if (localCompletionFilter === 'completed' && !isCompleted) return false;
      if (localCompletionFilter === 'incomplete' && isCompleted) return false;
    }
    
    // Date filter (for todos and events)
    if ((activeTab === 'todo' || activeTab === 'event') && localDateFilter !== 'all') {
      const itemDate = activeTab === 'todo' ? item.dueDate : item.dateTime;
      if (!itemDate) return false;
      
      const date = new Date(itemDate);
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      const weekEnd = new Date(today);
      weekEnd.setDate(today.getDate() + 7);
      
      switch (localDateFilter) {
        case 'today':
          return date.toDateString() === today.toDateString();
        case 'this_week':
          return date >= today && date <= weekEnd;
        case 'upcoming':
          return date > today;
        case 'overdue':
          return date < today && activeTab === 'todo' && !item.completed;
        default:
          return true;
      }
    }
    
    // Progress filter (only for goals)
    if (activeTab === 'goal' && localProgressFilter !== 'all') {
      const progress = item.metadata?.progress || 0;
      switch (localProgressFilter) {
        case 'not_started':
          return progress === 0;
        case 'in_progress':
          return progress > 0 && progress < 100;
        case 'completed':
          return progress >= 100;
        default:
          return true;
      }
    }
    
    // Frequency filter (only for routines)
    if (activeTab === 'routine' && localFrequencyFilter !== 'all') {
      const frequency = item.metadata?.frequency;
      return frequency === localFrequencyFilter;
    }
    
    // Routine status filter (only for routines)
    if (activeTab === 'routine' && localRoutineStatusFilter !== 'all') {
      switch (localRoutineStatusFilter) {
        case 'completed_today':
          return item.metadata?.completedToday === true;
        case 'pending_today':
          return item.metadata?.completedToday !== true;
        case 'streak_active':
          return (item.metadata?.currentStreak || 0) > 0;
        default:
          return true;
      }
    }
    
    // Notes filter (only for notes)
    if (activeTab === 'note' && localNotesFilter !== 'all') {
      switch (localNotesFilter) {
        case 'voice_notes':
          return item.type === 'voiceNote' || item.metadata?.isVoiceNote === true;
        case 'text_notes':
          return item.type === 'note' && item.metadata?.isVoiceNote !== true;
        case 'with_images':
          return item.metadata?.hasImage === true || (item.metadata?.imageUrls && item.metadata.imageUrls.length > 0);
        case 'recent_week':
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return new Date(item.createdAt) > weekAgo;
        default:
          return true;
      }
    }
    
    return true;
  }).sort((a, b) => {
    // Custom sorting based on localSortBy
    switch (localSortBy) {
      case 'priority':
        if (activeTab === 'todo' || activeTab === 'goal') {
          const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
          const priorityA = priorityOrder[a.metadata?.priority as keyof typeof priorityOrder] || 0;
          const priorityB = priorityOrder[b.metadata?.priority as keyof typeof priorityOrder] || 0;
          return priorityB - priorityA;
        }
        break;
      case 'due_date':
        if (activeTab === 'todo' && a.dueDate && b.dueDate) {
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }
        break;
      case 'alphabetical':
        return a.title.localeCompare(b.title);
      case 'progress':
        if (activeTab === 'goal') {
          const progressA = a.metadata?.progress || 0;
          const progressB = b.metadata?.progress || 0;
          return progressB - progressA;
        }
        break;
      case 'date_time':
        if (activeTab === 'event' && a.dateTime && b.dateTime) {
          return new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime();
        }
        break;
      case 'recent':
      default:
        // Special sorting for events by dateTime
        if (activeTab === 'event') {
          const timeA = a.dateTime ? new Date(a.dateTime).getTime() : 0;
          const timeB = b.dateTime ? new Date(b.dateTime).getTime() : 0;
          return timeA - timeB; // Earliest events first
        }
        
        // Default: Sort by most recent (updatedAt) for all other tabs
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    }
    
    // Fallback to recent sorting
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const toggleItemCompletion = (itemId: string) => {
    setItems(items.map(item => 
      item.id === itemId 
        ? { ...item, completed: !item.completed, updatedAt: new Date() }
        : item
    ));
  };

  const handleItemClick = (itemId: string) => {
    if (expandedItem === itemId) {
      setExpandedItem(null);
    } else {
      setExpandedItem(itemId);
    }
  };

  const startEditingItem = (item: Item) => {
    setEditingItem(item.id);
    setExpandedItem(item.id);
    if (item.type === 'note' || item.type === 'voiceNote') {
      setEditText(item.text);
    } else if (item.type === 'goal') {
      setEditGoal({
        title: item.title,
        text: item.text,
        target: item.metadata?.target || '',
        progress: item.metadata?.progress || 0
      });
    }
  };

  const saveEditedItem = (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    if (item.type === 'note' || item.type === 'voiceNote') {
      setItems(items.map(i => 
        i.id === itemId 
          ? { 
              ...i, 
              text: editText,
              title: editText.length > 50 ? editText.substring(0, 50) + '...' : editText,
              updatedAt: new Date()
            }
          : i
      ));
    } else if (item.type === 'goal') {
      setItems(items.map(i => 
        i.id === itemId 
          ? { 
              ...i, 
              title: editGoal.title,
              text: editGoal.text,
              metadata: { 
                ...i.metadata, 
                target: editGoal.target,
                progress: editGoal.progress 
              },
              updatedAt: new Date()
            }
          : i
      ));
    }
    setEditingItem(null);
    setEditText('');
  };

  const cancelEditing = () => {
    setEditingItem(null);
    setEditText('');
    setEditGoal({
      title: '',
      text: '',
      target: '',
      progress: 0
    });
  };

  const deleteItem = async (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    
    // Check if it's a recurring event
    if (item?.type === 'event' && item.metadata?.isRecurring && item.metadata?.recurrenceId) {
      const recurrenceId = item.metadata.recurrenceId;
      const allOccurrences = items.filter(i => 
        i.metadata?.recurrenceId === recurrenceId
      );
      
      // Show custom modal for recurring events
      setRecurringDeleteData({
        itemId,
        recurrenceId,
        occurrenceCount: allOccurrences.length,
        eventTitle: item.title
      });
      setShowRecurringDeleteModal(true);
    } else {
      // Regular deletion
      setItems(items.filter(i => i.id !== itemId));
      console.log('Deleted regular event');
      setExpandedItem(null);
      setEditingItem(null);
    }
  };

  const handleRecurringDelete = (deleteAll: boolean) => {
    if (!recurringDeleteData) return;
    
    const { itemId, recurrenceId, occurrenceCount } = recurringDeleteData;
    
    if (deleteAll) {
      // Delete all occurrences
      setItems(items.filter(i => 
        !(i.metadata?.recurrenceId === recurrenceId)
      ));
      console.log(`Deleted all ${occurrenceCount} occurrences of recurring event`);
    } else {
      // Delete only this occurrence
      setItems(items.filter(i => i.id !== itemId));
      console.log('Deleted single occurrence of recurring event');
    }
    
    // Close modal and reset state
    setShowRecurringDeleteModal(false);
    setRecurringDeleteData(null);
    setExpandedItem(null);
    setEditingItem(null);
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

  const getProgressLabel = (progress: number) => {
    if (progress >= 90) return 'Almost complete';
    if (progress >= 75) return 'Great progress';
    if (progress >= 50) return 'Halfway there';
    if (progress >= 25) return 'Getting started';
    return 'Just beginning';
  };

  const handleEditFromFullscreen = (itemId: string, item: Item) => {
    // Close fullscreen first
    setFullscreenNote(null);
    setFullscreenGoal(null);
    setFullscreenRoutine(null);
    
    // Then enter edit mode
    startEditingItem(item);
  };

  const handleAddItem = () => {
    if (!newItem.title.trim()) return;

    const baseItem = {
      id: Date.now().toString(),
      title: newItem.title,
      text: newItem.text,
      categoryId: categoryId,
      completed: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    let item: Item;

    switch (activeTab) {
      case 'todo':
        item = {
          ...baseItem,
          type: 'todo' as const,
          dueDate: newItem.dueDate ? new Date(newItem.dueDate + 'T12:00:00') : undefined,
          metadata: {
            priority: newItem.priority
          }
        };
        break;
      case 'event':
        item = {
          ...baseItem,
          type: 'event' as const,
          dateTime: newItem.dateTime ? new Date(newItem.dateTime) : new Date(),
          metadata: {
            location: newItem.location
          }
        };
        break;
      case 'note':
        // Check if there's a voice recording for this note
        const hasVoiceRecording = currentRecording?.blob;
        item = {
          ...baseItem,
          type: hasVoiceRecording ? 'voiceNote' as const : 'note' as const,
          attachment: hasVoiceRecording ? URL.createObjectURL(currentRecording!.blob) : undefined,
          metadata: {
            isTranscribing: !!(hasVoiceRecording && shouldTranscribe)
          }
        };
        break;
      case 'routine':
        item = {
          ...baseItem,
          type: 'routine' as const,
          metadata: {
            frequency: newItem.frequency,
            timeOfDay: newItem.timeOfDay,
            duration: newItem.duration,
            currentStreak: 0,
            bestStreak: 0,
            completedToday: false,
            completedDates: []
          }
        };
        break;
      case 'goal':
        item = {
          ...baseItem,
          type: 'goal' as const,
          metadata: {
            target: newItem.target,
            progress: newItem.progress
          }
        };
        break;
      default:
        return;
    }

    // Add the item immediately
    setItems([...items, item]);
    
    // Handle background transcription for voice notes if needed
    if (activeTab === 'note' && currentRecording?.blob && shouldTranscribe) {
      handleBackgroundTranscription(item.id, currentRecording.blob);
    }
    
    // Reset form completely
    setNewItem({
      title: '',
      text: '',
      dueDate: '',
      dateTime: '',
      location: '',
      priority: 'medium',
      frequency: 'daily',
      timeOfDay: '',
      duration: 30,
      target: '',
      progress: 0
    });
    setUploadedImages([]);
    setCurrentRecording(null);
    setShouldTranscribe(true);
    setShowAddModal(false);
  };

  const handleBackgroundTranscription = async (itemId: string, voiceBlob: Blob) => {
    try {
      const transcriptionResult = await voiceService.transcribeWithContext(voiceBlob, categoryId);
      
      // Update the item with transcription
      setItems(prevItems => prevItems.map(item => {
        if (item.id === itemId) {
          return {
            ...item,
            text: transcriptionResult.text,
            title: transcriptionResult.text.length > 50 
              ? transcriptionResult.text.substring(0, 50) + '...' 
              : transcriptionResult.text,
            metadata: {
              ...item.metadata,
              transcription: transcriptionResult.text,
              aiGenerated: true,
              isTranscribing: false
            },
            updatedAt: new Date()
          };
        }
        return item;
      }));
    } catch (error) {
      console.error('Background transcription failed:', error);
      // Update item to remove transcribing status
      setItems(prevItems => prevItems.map(item => {
        if (item.id === itemId) {
          return {
            ...item,
            metadata: {
              ...item.metadata,
              isTranscribing: false
            }
          };
        }
        return item;
      }));
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            setUploadedImages(prev => [...prev, e.target!.result as string]);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };

  const startRecording = async () => {
    try {
      setCurrentRecording(null);
      await voiceService.startRecording();
    setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const stopRecording = async () => {
    try {
      const recording = await voiceService.stopRecording();
      setIsRecording(false);
      setCurrentRecording(recording);
      
      // Just store the recording, don't transcribe automatically
      // User can choose to transcribe via checkbox when saving
      
    } catch (error) {
      console.error('Error with voice recording:', error);
      setIsRecording(false);
    }
  };

  const handleVoiceRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const playVoiceNote = (noteId: string, audioUrl: string) => {
    if (playingNote === noteId) {
      // Pause current audio
      if (audioRef.current) {
        audioRef.current.pause();
        setPlayingNote(null);
      }
    } else {
      // Stop any currently playing audio
      if (audioRef.current) {
        audioRef.current.pause();
      }
      
      // Create new audio and play
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.onended = () => {
        setPlayingNote(null);
      };
      
      audio.onerror = () => {
        console.error('Error playing audio');
        setPlayingNote(null);
      };
      
      audio.play().then(() => {
        setPlayingNote(noteId);
      }).catch((error) => {
        console.error('Error playing audio:', error);
        setPlayingNote(null);
      });
    }
  };

  // Context links functions
  const handleAddLink = () => {
    if (!newLink.title.trim() || !newLink.url.trim()) return;

    const link = {
      id: Date.now().toString(),
      title: newLink.title,
      url: newLink.url,
      type: newLink.type
    };

    setContextLinks([...contextLinks, link]);
    setNewLink({ title: '', url: '', type: 'link' });
    setShowAddLinkModal(false);
  };

  const deleteLink = (linkId: string) => {
    setContextLinks(contextLinks.filter(link => link.id !== linkId));
  };

  const openLink = (url: string) => {
    window.open(url, '_blank');
  };

  const handleGoogleDriveConnect = () => {
    // Set up the new link form with Google Drive defaults
    setNewLink({
      title: `${category?.name} Google Drive`,
      url: '',
      type: 'drive'
    });
    setShowAddLinkModal(true);
    setShowContextMenu(false);
  };

  if (!category) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-pink-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-xl border border-white/30 p-12 text-center">
            <h1 className="text-3xl font-bold text-gray-800 mb-4">Category not found</h1>
            <button
              onClick={onBack}
              className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white px-8 py-4 rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-lg"
            >
              <ArrowLeft className="w-5 h-5 mr-3 inline" />
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  const getTabStats = (type: Item['type']) => {
    const tabItems = categoryItems.filter(item => {
      if (type === 'note') {
        return item.type === 'note' || item.type === 'voiceNote';
      }
      return item.type === type;
    });

    if (type === 'todo') {
      const completed = tabItems.filter(item => item.completed).length;
      return `${completed}/${tabItems.length}`;
    }
    return tabItems.length.toString();
  };

  const getAISuggestions = (type: Item['type']) => {
    const suggestions = {
      todo: [
        'Complete Georgetown application',
        'Practice handstand push-ups',
        'Read daily Bible chapter',
        'Work on mobile app development'
      ],
      event: [
        'Georgetown interview',
        'Gym workout session',
        'Sunday Mass',
        'Business networking event'
      ],
      note: [
        'Daily reflection',
        'Business idea brainstorm',
        'Workout progress notes',
        'Prayer intentions'
      ],
      voiceNote: [
        'Daily reflection',
        'Business idea brainstorm',
        'Workout progress notes',
        'Prayer intentions'
      ],
      routine: [
        'Morning prayer routine',
        'Daily calisthenics practice',
        'Evening Bible reading',
        'Weekly business planning'
      ],
      goal: [
        'Get accepted to Georgetown',
        'Master advanced calisthenics',
        'Launch successful business',
        'Build strong relationships'
      ]
    };
    return suggestions[type] || [];
  };

  const renderAddModal = () => {
    if (!showAddModal) return null;

    const currentTab = tabs.find(tab => tab.type === activeTab);
    const suggestions = getAISuggestions(activeTab);

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/30 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className={`bg-gradient-to-r ${currentTab?.gradient} p-6 text-white`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {currentTab?.icon}
                <h3 className="text-2xl font-bold">Add {currentTab?.label.slice(0, -1)}</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-white/20 rounded-xl transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
          
          <div className="p-6 space-y-6">
            {/* AI Suggestions */}
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-4 border border-blue-100">
              <h4 className="text-sm font-semibold text-blue-900 mb-3 flex items-center">
                ✨ AI Suggestions for {category.name}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {suggestions.map((suggestion: string, index: number) => (
                  <button
                    key={index}
                    onClick={() => setNewItem(prev => ({ ...prev, title: suggestion }))}
                    className="text-left p-3 bg-white/70 hover:bg-white rounded-xl text-sm text-blue-800 hover:text-blue-900 transition-all duration-300 border border-blue-200/50 hover:border-blue-300 hover:shadow-md transform hover:scale-[1.02]"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Title *</label>
                <input
                  type="text"
                  value={newItem.title}
                  onChange={(e) => setNewItem(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300"
                  placeholder={`Enter ${activeTab} title...`}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                <textarea
                  value={newItem.text}
                  onChange={(e) => setNewItem(prev => ({ ...prev, text: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300 h-24 resize-none"
                  placeholder="Add description..."
                />
              </div>

              {/* Type-specific fields */}
              {activeTab === 'todo' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Due Date</label>
                    <input
                      type="date"
                      value={newItem.dueDate}
                      onChange={(e) => setNewItem(prev => ({ ...prev, dueDate: e.target.value }))}
                      className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300"
                      min={new Date().toISOString().slice(0, 10)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Priority</label>
                    <select
                      value={newItem.priority}
                      onChange={(e) => setNewItem(prev => ({ ...prev, priority: e.target.value as 'low' | 'medium' | 'high' }))}
                      className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300"
                    >
                      <option value="low">🌱 Low</option>
                      <option value="medium">⚡ Medium</option>
                      <option value="high">🔥 High</option>
                    </select>
                  </div>
                </div>
              )}

              {activeTab === 'event' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Date & Time *</label>
                    <input
                      type="datetime-local"
                      value={newItem.dateTime}
                      onChange={(e) => {
                        console.log('DateTime input changed:', e.target.value);
                        setNewItem(prev => ({ ...prev, dateTime: e.target.value }));
                      }}
                      className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300"
                      min={new Date().toISOString().slice(0, 16)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Location</label>
                    <input
                      type="text"
                      value={newItem.location}
                      onChange={(e) => setNewItem(prev => ({ ...prev, location: e.target.value }))}
                      className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300"
                      placeholder="Enter location..."
                    />
                  </div>
                </div>
              )}

              {activeTab === 'routine' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Frequency</label>
                    <select
                      value={newItem.frequency}
                      onChange={(e) => setNewItem(prev => ({ ...prev, frequency: e.target.value as 'daily' | 'weekly' }))}
                      className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300"
                    >
                      <option value="daily">📅 Daily</option>
                      <option value="weekly">📆 Weekly</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Time of Day</label>
                    <select
                      value={newItem.timeOfDay}
                      onChange={(e) => setNewItem(prev => ({ ...prev, timeOfDay: e.target.value }))}
                      className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300"
                    >
                      <option value="">Select time...</option>
                      <option value="Morning">🌅 Morning</option>
                      <option value="Afternoon">☀️ Afternoon</option>
                      <option value="Evening">🌅 Evening</option>
                      <option value="Night">🌙 Night</option>
                      <option value="Anytime">⏰ Anytime</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Duration (min)</label>
                    <select
                      value={newItem.duration}
                      onChange={(e) => setNewItem(prev => ({ ...prev, duration: parseInt(e.target.value) || 30 }))}
                      className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300"
                    >
                      <option value={5}>5 minutes</option>
                      <option value={10}>10 minutes</option>
                      <option value={15}>15 minutes</option>
                      <option value={20}>20 minutes</option>
                      <option value={30}>30 minutes</option>
                      <option value={45}>45 minutes</option>
                      <option value={60}>1 hour</option>
                      <option value={90}>1.5 hours</option>
                      <option value={120}>2 hours</option>
                    </select>
                  </div>
                </div>
              )}

              {activeTab === 'goal' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Target/Outcome</label>
                    <input
                      type="text"
                      value={newItem.target}
                      onChange={(e) => setNewItem(prev => ({ ...prev, target: e.target.value }))}
                      className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300"
                      placeholder="What do you want to achieve?"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Initial Progress (%)</label>
                    <input
                      type="number"
                      value={newItem.progress}
                      onChange={(e) => setNewItem(prev => ({ ...prev, progress: parseInt(e.target.value) || 0 }))}
                      className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300"
                      min="0"
                      max="100"
                    />
                  </div>
                </div>
              )}

              {/* Photo Upload and Voice Recording for Notes */}
              {activeTab === 'note' && (
                <div className="space-y-6">
                  {/* Voice Recording Section */}
                  <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-gray-700 font-medium">Voice Note</span>
                      <button
                        type="button"
                        onClick={handleVoiceRecording}
                        disabled={isRecording}
                        className={`px-6 py-3 rounded-2xl flex items-center transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${
                          isRecording 
                            ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg' 
                            : 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white hover:from-yellow-600 hover:to-orange-600 shadow-lg'
                        }`}
                      >
                        {isRecording ? (
                          <>
                            <MicOff className="w-5 h-5 mr-2" />
                            Stop Recording
                          </>
                        ) : (
                          <>
                            <Mic className="w-5 h-5 mr-2" />
                            Start Recording
                          </>
                        )}
                      </button>
                    </div>
                    
                    {/* Transcription Checkbox */}
                    <div className="flex items-center space-x-2 mb-3">
                      <input
                        type="checkbox"
                        id="shouldTranscribeCategory"
                        checked={shouldTranscribe}
                        onChange={(e) => setShouldTranscribe(e.target.checked)}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                      />
                      <label htmlFor="shouldTranscribeCategory" className="text-sm font-medium text-gray-700">
                        ✨ Transcribe audio automatically (after saving)
                      </label>
                    </div>

                    {/* Recording Status */}
                    {currentRecording && (
                      <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                        <div className="flex items-center justify-between">
                    <div className="flex-1">
                            <span className="text-blue-700 font-medium">🎤 Voice recorded ✓</span>
                            <p className="text-sm text-blue-600 mt-1">
                              {shouldTranscribe ? '⏳ Will transcribe after saving' : '📝 Manual transcription disabled'}
                            </p>
                          </div>
                          <button
                            onClick={() => setCurrentRecording(null)}
                            className="text-blue-500 hover:text-blue-700 transition-colors ml-2"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Photo Upload Section */}
                  <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl p-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-3">Add Photos</label>
                      <div className="relative">
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                          id="image-upload"
                        />
                        <label
                          htmlFor="image-upload"
                        className="flex items-center justify-center w-full px-4 py-4 bg-white/70 border border-gray-200/50 rounded-xl hover:bg-gray-50/50 transition-all duration-300 cursor-pointer group"
                        >
                        <Camera className="w-5 h-5 text-gray-500 mr-2 group-hover:text-gray-600 transition-colors" />
                        <span className="text-gray-600 group-hover:text-gray-700 transition-colors font-medium">Upload Images</span>
                        </label>
                  </div>

                  {/* Image Preview */}
                  {uploadedImages.length > 0 && (
                      <div className="grid grid-cols-3 gap-3 mt-4">
                      {uploadedImages.map((image, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={image}
                            alt={`Upload ${index + 1}`}
                              className="w-full h-20 object-cover rounded-xl shadow-sm"
                          />
                          <button
                            onClick={() => removeImage(index)}
                              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-lg hover:bg-red-600"
                          >
                              <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Footer */}
          <div className="bg-gray-50/50 p-6 flex space-x-4">
            <button
              onClick={() => setShowAddModal(false)}
              className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all duration-300 font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleAddItem}
              disabled={!newItem.title.trim() || (activeTab === 'event' && !newItem.dateTime)}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl hover:from-blue-600 hover:to-cyan-600 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 shadow-lg font-semibold"
            >
              Add {currentTab?.label.slice(0, -1)}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderTabContent = () => {
    const activeTabData = tabs.find(tab => tab.type === activeTab);
    
    switch (activeTab) {
      case 'todo':
        return (
          <div className="bg-white/60 backdrop-blur-xl rounded-2xl shadow-lg border border-white/30 overflow-hidden">
            {filteredItems.map((item, index) => {
              const isCompleted = item.completed;
              const priority = item.metadata?.priority || 'medium';
              const isExpanded = expandedItem === item.id;
              const isEditing = editingItem === item.id;
              
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

              const overdue = isOverdue(item.dueDate);
              const dueToday = isDueToday(item.dueDate);
              
              return (
              <div 
                key={item.id} 
                  className={`group relative transition-all duration-300 hover:bg-white/80 ${
                    index !== filteredItems.length - 1 ? 'border-b border-gray-200/50' : ''
                  } ${isCompleted ? 'opacity-60' : ''}`}
                  onClick={() => !isEditing && handleItemClick(item.id)}
                  onDoubleClick={() => !isEditing && startEditingItem(item)}
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
                            value={item.title}
                            onChange={(e) => {
                              setItems(items.map(i => 
                                i.id === item.id ? { ...i, title: e.target.value, updatedAt: new Date() } : i
                              ));
                            }}
                            className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300"
                            autoFocus
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                          <textarea
                            value={item.text}
                            onChange={(e) => {
                              setItems(items.map(i => 
                                i.id === item.id ? { ...i, text: e.target.value, updatedAt: new Date() } : i
                              ));
                            }}
                            className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300 resize-none overflow-hidden"
                            rows={3}
                          />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Due Date</label>
                            <input
                              type="date"
                              value={item.dueDate instanceof Date && !isNaN(item.dueDate.getTime()) 
                                ? item.dueDate.toISOString().slice(0, 10) 
                                : ''}
                              onChange={(e) => {
                                setItems(items.map(i => 
                                  i.id === item.id 
                                    ? { ...i, dueDate: e.target.value ? new Date(e.target.value) : undefined, updatedAt: new Date() } 
                                    : i
                                ));
                              }}
                              className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300"
                              min={new Date().toISOString().slice(0, 10)}
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Priority</label>
                            <select
                              value={item.metadata?.priority || 'medium'}
                              onChange={(e) => {
                                setItems(items.map(i => 
                                  i.id === item.id 
                                    ? { ...i, metadata: { ...i.metadata, priority: e.target.value as 'low' | 'medium' | 'high' }, updatedAt: new Date() } 
                                    : i
                                ));
                              }}
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
                            onClick={() => setEditingItem(null)}
                            className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all duration-300 flex items-center justify-center font-semibold"
                          >
                            <Save className="w-4 h-4 mr-2" />
                            Save
                          </button>
                          <button
                            onClick={() => setEditingItem(null)}
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
                              toggleItemCompletion(item.id);
                            }}
                            className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all duration-300 flex-shrink-0 ${
                              isCompleted 
                        ? 'bg-green-500 border-green-500 text-white' 
                                : 'border-gray-300 hover:border-blue-500'
                    }`}
                  >
                            {isCompleted && <CheckCircle2 className="w-4 h-4" />}
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
                      {item.title}
                    </h3>
                              <span className="text-sm">{getPriorityIcon(priority)}</span>
                            </div>
                            
                            <div className="flex items-center space-x-4 text-sm text-gray-500">
                              <span className="flex items-center">
                                {category?.icon} {category?.name}
                              </span>
                              
                      {item.dueDate && (
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
                                   item.dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
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
                            
                            {isExpanded && item.text && (
                              <p className={`mt-3 text-gray-600 leading-relaxed ${isCompleted ? 'line-through opacity-60' : ''}`}>
                                {item.text}
                              </p>
                      )}
                    </div>
                  </div>
                        
                        {/* Right side - Actions */}
                        <div className={`flex items-center space-x-2 transition-opacity ${
                          isExpanded ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        }`}>
                          {!isEditing && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditingItem(item);
                              }}
                              className="p-2 hover:bg-yellow-100 rounded-lg transition-colors"
                            >
                              <Edit3 className="w-4 h-4 text-yellow-600" />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteItem(item.id);
                            }}
                            className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                </div>
              </div>
                    )}
                  </div>
                </div>
              );
            })}
            {filteredItems.length === 0 && (
              <div className="p-20 text-center">
                <div className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-xl border border-white/30 p-12 max-w-md mx-auto">
                  <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-4">No todos yet</h3>
                  <p className="text-gray-600 leading-relaxed">
                    Click the + button to add your first todo for this category!
                  </p>
                </div>
              </div>
            )}
          </div>
        );

      case 'event':
        return (
          <div className="space-y-4">
            {filteredItems.map((item) => {
              const isExpanded = expandedItem === item.id;
              const isEditing = editingItem === item.id;
              
              const formatTime = (date: Date) => {
                return date.toLocaleTimeString('en-US', { 
                  hour: 'numeric', 
                  minute: '2-digit',
                  hour12: true 
                });
              };
              
              return (
              <div 
                key={item.id} 
                  className={`group bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/30 overflow-hidden transition-all duration-500 hover:shadow-2xl hover:scale-[1.02] cursor-pointer ${
                    isExpanded ? 'transform scale-[1.01]' : ''
                  }`}
                  onClick={() => !isEditing && handleItemClick(item.id)}
                  onDoubleClick={() => !isEditing && startEditingItem(item)}
                >
                  <div className="p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div 
                          className="w-4 h-4 rounded-full mt-1 flex-shrink-0"
                          style={{ backgroundColor: category?.color || '#3b82f6' }}
                        />
                        <span className="text-sm font-medium text-gray-600">
                          {category?.icon} {category?.name}
                        </span>
                        <div className="flex items-center space-x-2 text-sm">
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                            Event
                          </span>
                        </div>
                      </div>
                      
                      <div className={`flex items-center space-x-2 transition-opacity ${isExpanded ? 'opacity-100' : 'opacity-0'}`}>
                        {!isEditing && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditingItem(item);
                            }}
                            className="p-2 hover:bg-amber-100 rounded-lg transition-colors"
                          >
                            <Edit3 className="w-4 h-4 text-amber-600" />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteItem(item.id);
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
                        <input
                          type="text"
                          value={item.title}
                          onChange={(e) => {
                            setItems(items.map(i => 
                              i.id === item.id ? { ...i, title: e.target.value, updatedAt: new Date() } : i
                            ));
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Event title..."
                        />
                        <textarea
                          value={item.text}
                          onChange={(e) => {
                            setItems(items.map(i => 
                              i.id === item.id ? { ...i, text: e.target.value, updatedAt: new Date() } : i
                            ));
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                          placeholder="Event description..."
                          rows={2}
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <input
                            type="datetime-local"
                            value={item.dateTime instanceof Date && !isNaN(item.dateTime.getTime()) 
                              ? item.dateTime.toISOString().slice(0, 16) 
                              : ''}
                            onChange={(e) => {
                              setItems(items.map(i => 
                                i.id === item.id 
                                  ? { ...i, dateTime: new Date(e.target.value), updatedAt: new Date() } 
                                  : i
                              ));
                            }}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            min={new Date().toISOString().slice(0, 16)}
                          />
                          <input
                            type="text"
                            value={item.metadata?.location || ''}
                            onChange={(e) => {
                              setItems(items.map(i => 
                                i.id === item.id 
                                  ? { ...i, metadata: { ...i.metadata, location: e.target.value }, updatedAt: new Date() } 
                                  : i
                              ));
                            }}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Location..."
                          />
                        </div>
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => setEditingItem(null)}
                            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => setEditingItem(null)}
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
                            <h4 className="font-semibold text-gray-800 text-lg">{item.title}</h4>
                {item.text && (
                              <p className="text-gray-600 mt-1">{item.text}</p>
                            )}
                            <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                              <div className="flex items-center">
                                <Clock className="w-4 h-4 mr-1" />
                                {item.dateTime instanceof Date && !isNaN(item.dateTime.getTime()) && formatTime(item.dateTime)}
                              </div>
                              {item.metadata?.location && (
                                <div className="flex items-center">
                                  <MapPin className="w-4 h-4 mr-1" />
                                  {item.metadata.location}
                                </div>
                              )}
                              <div className="flex items-center">
                                <span className="text-xs">{category?.icon} {category?.name}</span>
                              </div>
                            </div>
                            
                            {/* Full Date Display when expanded */}
                            {isExpanded && item.dateTime && (
                              <div className="mt-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
                                <div className="font-medium text-gray-700">
                        {item.dateTime instanceof Date && !isNaN(item.dateTime.getTime())
                                    ? item.dateTime.toLocaleDateString('en-US', { 
                                        weekday: 'long', 
                                        year: 'numeric', 
                                        month: 'long', 
                                        day: 'numeric' 
                                      })
                          : 'Invalid date'}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {item.dateTime instanceof Date && !isNaN(item.dateTime.getTime())
                                    ? item.dateTime.toLocaleTimeString('en-US', { 
                                        hour: '2-digit', 
                                        minute: '2-digit' 
                                      })
                                    : 'Invalid time'}
                                </div>
                    </div>
                  )}
                          </div>
                        </div>
                    </div>
                  )}
                </div>
              </div>
              );
            })}
            {filteredItems.length === 0 && (
              <div className="text-center py-20">
                <div className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-xl border border-white/30 p-12 max-w-md mx-auto">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Calendar className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-4">No events yet</h3>
                  <p className="text-gray-600 leading-relaxed">
                    Click the + button to add your first event for this category!
                  </p>
                </div>
              </div>
            )}
          </div>
        );

      case 'note':
        return (
          <LocalCategoryNotes 
            categoryId={categoryId} 
            items={items} 
            setItems={setItems} 
            categories={categories}
            onAIAssistantToggle={setIsAIAssistantOpen}
            isGlobalAIAssistantOpen={isGlobalAIAssistantOpen}
          />
        );

      case 'routine':
        return (
          <div className="space-y-4">
            {filteredItems.map((item) => {
              const isExpanded = expandedItem === item.id;
              const isEditing = editingItem === item.id;
              const isCompleted = item.metadata?.completedToday || false;
              
              return (
              <div 
                key={item.id} 
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
                        value={item.title}
                        onChange={(e) => {
                          setItems(items.map(i => 
                            i.id === item.id ? { ...i, title: e.target.value, updatedAt: new Date() } : i
                          ));
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        placeholder="Routine title..."
                      />
                      <textarea
                        value={item.text}
                        onChange={(e) => {
                          setItems(items.map(i => 
                            i.id === item.id ? { ...i, text: e.target.value, updatedAt: new Date() } : i
                          ));
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 h-20 resize-none"
                        placeholder="Routine description..."
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <select
                          value={item.metadata?.frequency || 'daily'}
                          onChange={(e) => {
                            setItems(items.map(i => 
                              i.id === item.id 
                                ? { ...i, metadata: { ...i.metadata, frequency: e.target.value as 'daily' | 'weekly' }, updatedAt: new Date() } 
                                : i
                            ));
                          }}
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        >
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                        </select>
                        <input
                          type="number"
                          value={item.metadata?.duration || 30}
                          onChange={(e) => {
                            setItems(items.map(i => 
                              i.id === item.id 
                                ? { ...i, metadata: { ...i.metadata, duration: parseInt(e.target.value) || 30 }, updatedAt: new Date() } 
                                : i
                            ));
                          }}
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                          placeholder="Duration (minutes)"
                          min="1"
                        />
                  </div>
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => setEditingItem(null)}
                          className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => setEditingItem(null)}
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
                      onClick={() => setFullscreenRoutine(item.id)}
                      onDoubleClick={() => startEditingItem(item)}
                    >
                      <div className="flex items-center space-x-4 flex-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setItems(items.map(i => {
                              if (i.id === item.id) {
                                const wasCompleted = i.metadata?.completedToday || false;
                                const currentStreak = i.metadata?.currentStreak || 0;
                                const bestStreak = i.metadata?.bestStreak || 0;
                                
                                return {
                                  ...i,
                                  metadata: {
                                    ...i.metadata,
                                    completedToday: !wasCompleted,
                                    currentStreak: !wasCompleted ? currentStreak + 1 : Math.max(0, currentStreak - 1),
                                    bestStreak: !wasCompleted ? Math.max(bestStreak, currentStreak + 1) : bestStreak
                                  },
                                  updatedAt: new Date()
                                };
                              }
                              return i;
                            }));
                          }}
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                            isCompleted 
                              ? 'bg-green-500 border-green-500 text-white' 
                              : 'border-gray-300 hover:border-green-400'
                          }`}
                        >
                          {isCompleted && <CheckCircle2 className="w-4 h-4" />}
                        </button>
                        
                        <div 
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{ backgroundColor: category?.color }}
                        />
                        
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-gray-800">{item.title}</h3>
                            <div className="flex items-center space-x-4 text-sm text-gray-500">
                              <div className="flex items-center">
                                <RotateCcw className="w-4 h-4 mr-1" />
                                <span>{item.metadata?.frequency || 'daily'}</span>
                  </div>
                              <div className="flex items-center">
                                <Clock className="w-4 h-4 mr-1" />
                                <span>{item.metadata?.duration || 30}min</span>
                    </div>
                            </div>
                          </div>
                          {item.text && (
                            <p className="text-gray-600 text-sm mt-1">{item.text}</p>
                  )}
                </div>
              </div>
                    </div>
                  )}
                </div>
              );
            })}
            {filteredItems.length === 0 && (
              <div className="text-center py-20">
                <div className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-xl border border-white/30 p-12 max-w-md mx-auto">
                  <div className="w-20 h-20 bg-gradient-to-br from-purple-400 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <RotateCcw className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-4">No routines yet</h3>
                  <p className="text-gray-600 leading-relaxed">
                    Click the + button to add your first routine for this category!
                  </p>
                </div>
              </div>
            )}
          </div>
        );

      case 'goal':
        return (
          <div className="space-y-4">
            {filteredItems.map((item) => {
              const isExpanded = expandedItem === item.id;
              const isEditing = editingItem === item.id;
              const progress = item.metadata?.progress || 0;
              
              return (
              <div 
                key={item.id} 
                  className={`group bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/30 overflow-hidden transition-all duration-500 hover:shadow-2xl hover:scale-[1.02] cursor-pointer ${
                    isExpanded ? 'md:col-span-2 lg:col-span-2 transform scale-[1.01]' : ''
                  }`}
                  onClick={() => !isEditing && handleItemClick(item.id)}
                  onDoubleClick={() => !isEditing && startEditingItem(item)}
                >
                  <div className="p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div 
                          className="w-3 h-3 rounded-full shadow-sm"
                          style={{ backgroundColor: category?.color || '#3b82f6' }}
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
                              onClick={(e) => {
                                e.stopPropagation();
                                setFullscreenGoal(item.id);
                              }}
                              className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                              title="Fullscreen"
                            >
                              <Maximize2 className="w-4 h-4 text-blue-600" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditFromFullscreen(item.id, item);
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
                            deleteItem(item.id);
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
                            value={editGoal.text}
                            onChange={(e) => setEditGoal({ ...editGoal, text: e.target.value })}
                            className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-500/50 focus:border-gray-500 transition-all duration-300 resize-none"
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
                            onClick={() => saveEditedItem(item.id)}
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
                            {item.title}
                          </h3>
                          <p className={`text-gray-600 leading-relaxed ${isExpanded ? 'text-base' : 'text-sm'}`}>
                            {isExpanded ? item.text : (
                              item.text.length > 100 ? item.text.substring(0, 100) + '...' : item.text
                            )}
                          </p>
                          
                          {!isExpanded && item.text.length > 100 && (
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
                              className="h-3 rounded-full transition-all duration-500 bg-gradient-to-r from-gray-300 to-gray-400"
                              style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>
                
                        {/* Notes */}
                {item.metadata?.target && (
                          <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-200">
                            <div className="flex items-start space-x-2">
                              <div>
                                <span className="text-sm font-semibold text-gray-700 block">Notes:</span>
                                <span className="text-sm text-gray-600">{item.metadata.target}</span>
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
                                updateGoalProgress(item.id, Math.max(0, progress - 10));
                              }}
                              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium transition-all duration-300"
                              disabled={progress <= 0}
                            >
                              -10%
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateGoalProgress(item.id, Math.max(0, progress - 5));
                              }}
                              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium transition-all duration-300"
                              disabled={progress <= 0}
                            >
                              -5%
                            </button>
                            {progress < 100 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateGoalProgress(item.id, 100);
                                }}
                                className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium transition-all duration-300"
                              >
                                Complete Goal
                              </button>
                )}
              </div>
                          
                          <div className="text-xs text-gray-500">
                            {item.updatedAt instanceof Date && !isNaN(item.updatedAt.getTime())
                              ? item.updatedAt.toLocaleDateString('en-US', { 
                                  month: 'short',
                                  day: 'numeric'
                                })
                              : 'Invalid date'}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            {filteredItems.length === 0 && (
              <div className="text-center py-20">
                <div className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-xl border border-white/30 p-12 max-w-md mx-auto">
                  <div className="w-20 h-20 bg-gradient-to-br from-red-400 to-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <BowArrow className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-4">No goals yet</h3>
                  <p className="text-gray-600 leading-relaxed">
                    Click the + button to add your first goal for this category!
                  </p>
                </div>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50">
      <div className="p-6 max-w-7xl mx-auto">
        {/* Floating Header */}
        <div className="sticky top-6 z-40 mb-8">
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={onBack}
                  className="p-3 bg-white/70 border border-gray-200/50 rounded-xl hover:bg-gray-50 transition-all duration-300"
                >
                  <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
                
                <div>
                  <h1 className="text-4xl font-bold text-gray-800 flex items-center">
                    <span className="text-5xl mr-4">{category.icon}</span>
                    {category.name}
                  </h1>
                  <p className="text-gray-600 mt-2 text-lg">
                    {categoryItems.length} total items • Focus on {category.name.toLowerCase()} goals
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                {/* Local Filters Button */}
                <div className="relative">
                  <button
                    onClick={() => setShowLocalFilters(!showLocalFilters)}
                    className={`p-3 border border-gray-200/50 rounded-xl transition-all duration-300 flex items-center space-x-2 ${
                      showLocalFilters || localPriorityFilter !== 'all' || localCompletionFilter !== 'all' || localSortBy !== 'recent' || localDateFilter !== 'all' || localProgressFilter !== 'all' || localFrequencyFilter !== 'all' || localRoutineStatusFilter !== 'all' || localNotesFilter !== 'all'
                        ? 'bg-blue-100 text-blue-700 border-blue-200'
                        : 'bg-white/70 hover:bg-gray-50 text-gray-600'
                    }`}
                  >
                    <Settings className="w-4 h-4" />
                    <span className="text-sm font-medium">Filters</span>
                    {(localPriorityFilter !== 'all' || localCompletionFilter !== 'all' || localSortBy !== 'recent' || localDateFilter !== 'all' || localProgressFilter !== 'all' || localFrequencyFilter !== 'all' || localRoutineStatusFilter !== 'all' || localNotesFilter !== 'all') && (
                      <span className="bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        {[localPriorityFilter !== 'all', localCompletionFilter !== 'all', localSortBy !== 'recent', localDateFilter !== 'all', localProgressFilter !== 'all', localFrequencyFilter !== 'all', localRoutineStatusFilter !== 'all', localNotesFilter !== 'all'].filter(Boolean).length}
                      </span>
                    )}
                  </button>

                  {/* Local Filters Dropdown */}
                  {showLocalFilters && (
                    <div className="absolute right-0 top-full mt-2 w-80 bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-white/30 z-50">
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                            <Filter className="w-4 h-4 mr-2 text-gray-600" />
                            Local Filters
                          </h3>
                          <button
                            onClick={() => setShowLocalFilters(false)}
                            className="p-1 hover:bg-gray-100 rounded-lg"
                          >
                            <X className="w-4 h-4 text-gray-600" />
                          </button>
                        </div>

                        <div className="space-y-4">
                          {/* Sort Filter */}
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Sort by</label>
                            <select
                              value={localSortBy}
                              onChange={(e) => setLocalSortBy(e.target.value as 'recent' | 'priority' | 'due_date' | 'alphabetical' | 'progress' | 'date_time')}
                              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                            >
                              <option value="recent">🕒 Most Recent</option>
                              {(activeTab === 'todo' || activeTab === 'goal') && <option value="priority">🔥 Priority</option>}
                              {activeTab === 'todo' && <option value="due_date">📅 Due Date</option>}
                              {activeTab === 'goal' && <option value="progress">📊 Progress</option>}
                              {activeTab === 'event' && <option value="date_time">⏰ Event Time</option>}
                              <option value="alphabetical">🔤 Alphabetical</option>
                            </select>
                          </div>

                          {/* Priority Filter - Only for todos and goals */}
                          {(activeTab === 'todo' || activeTab === 'goal') && (
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-2">Priority</label>
                              <select
                                value={localPriorityFilter}
                                onChange={(e) => setLocalPriorityFilter(e.target.value as 'all' | 'high' | 'medium' | 'low')}
                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                              >
                                <option value="all">All Priorities</option>
                                <option value="high">🔴 High Priority</option>
                                <option value="medium">🟡 Medium Priority</option>
                                <option value="low">🟢 Low Priority</option>
                              </select>
                            </div>
                          )}

                          {/* Completion Filter - Only for todos */}
                          {activeTab === 'todo' && (
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
                              <select
                                value={localCompletionFilter}
                                onChange={(e) => setLocalCompletionFilter(e.target.value as 'all' | 'completed' | 'incomplete')}
                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                              >
                                <option value="all">All Items</option>
                                <option value="completed">✅ Completed</option>
                                <option value="incomplete">⏳ Incomplete</option>
                              </select>
                            </div>
                          )}

                          {/* Date Filter - For todos and events */}
                          {(activeTab === 'todo' || activeTab === 'event') && (
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-2">
                                {activeTab === 'todo' ? 'Due Date' : 'Event Date'}
                              </label>
                              <select
                                value={localDateFilter}
                                onChange={(e) => setLocalDateFilter(e.target.value as 'all' | 'today' | 'this_week' | 'upcoming' | 'overdue')}
                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                              >
                                <option value="all">All Dates</option>
                                <option value="today">📅 Today</option>
                                <option value="this_week">📆 This Week</option>
                                <option value="upcoming">⏭️ Upcoming</option>
                                {activeTab === 'todo' && <option value="overdue">⚠️ Overdue</option>}
                              </select>
                            </div>
                          )}

                          {/* Progress Filter - Only for goals */}
                          {activeTab === 'goal' && (
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-2">Progress Status</label>
                              <select
                                value={localProgressFilter}
                                onChange={(e) => setLocalProgressFilter(e.target.value as 'all' | 'not_started' | 'in_progress' | 'completed')}
                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                              >
                                <option value="all">All Goals</option>
                                <option value="not_started">🎯 Not Started</option>
                                <option value="in_progress">🔄 In Progress</option>
                                <option value="completed">✅ Completed</option>
                              </select>
                            </div>
                          )}

                          {/* Frequency Filter - Only for routines */}
                          {activeTab === 'routine' && (
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-2">Frequency</label>
                              <select
                                value={localFrequencyFilter}
                                onChange={(e) => setLocalFrequencyFilter(e.target.value as 'all' | 'daily' | 'weekly' | 'monthly' | 'yearly')}
                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                              >
                                <option value="all">All Frequencies</option>
                                <option value="daily">📅 Daily</option>
                                <option value="weekly">📆 Weekly</option>
                                <option value="monthly">🗓️ Monthly</option>
                                <option value="yearly">📊 Yearly</option>
                              </select>
                            </div>
                          )}

                          {/* Routine Status Filter - Only for routines */}
                          {activeTab === 'routine' && (
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-2">Today's Status</label>
                              <select
                                value={localRoutineStatusFilter}
                                onChange={(e) => setLocalRoutineStatusFilter(e.target.value as 'all' | 'completed_today' | 'pending_today' | 'streak_active')}
                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                              >
                                <option value="all">All Routines</option>
                                <option value="completed_today">✅ Completed Today</option>
                                <option value="pending_today">⏳ Pending Today</option>
                                <option value="streak_active">🔥 Active Streak</option>
                              </select>
                            </div>
                          )}

                          {/* Notes Filter - Only for notes */}
                          {activeTab === 'note' && (
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-2">Note Type</label>
                              <select
                                value={localNotesFilter}
                                onChange={(e) => setLocalNotesFilter(e.target.value as 'all' | 'voice_notes' | 'text_notes' | 'with_images' | 'recent_week')}
                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                              >
                                <option value="all">All Notes</option>
                                <option value="voice_notes">🎤 Voice Notes</option>
                                <option value="text_notes">📝 Text Notes</option>
                                <option value="with_images">📷 With Images</option>
                                <option value="recent_week">📅 Recent Week</option>
                              </select>
                            </div>
                          )}

                          {/* Active Filters */}
                          <div className="border-t pt-3">
                            <div className="flex flex-wrap gap-2">
                              {localPriorityFilter !== 'all' && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                  Priority: {localPriorityFilter}
                                  <button
                                    onClick={() => setLocalPriorityFilter('all')}
                                    className="ml-1 text-orange-600 hover:text-orange-800"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              )}
                              {localCompletionFilter !== 'all' && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  Status: {localCompletionFilter}
                                  <button
                                    onClick={() => setLocalCompletionFilter('all')}
                                    className="ml-1 text-green-600 hover:text-green-800"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              )}
                              {localSortBy !== 'recent' && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  Sort: {localSortBy.replace('_', ' ')}
                                  <button
                                    onClick={() => setLocalSortBy('recent')}
                                    className="ml-1 text-blue-600 hover:text-blue-800"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              )}
                              {localDateFilter !== 'all' && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                  Date: {localDateFilter.replace('_', ' ')}
                                  <button
                                    onClick={() => setLocalDateFilter('all')}
                                    className="ml-1 text-purple-600 hover:text-purple-800"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              )}
                              {localProgressFilter !== 'all' && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                  Progress: {localProgressFilter.replace('_', ' ')}
                                  <button
                                    onClick={() => setLocalProgressFilter('all')}
                                    className="ml-1 text-yellow-600 hover:text-yellow-800"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              )}
                              {localFrequencyFilter !== 'all' && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                  Frequency: {localFrequencyFilter}
                                  <button
                                    onClick={() => setLocalFrequencyFilter('all')}
                                    className="ml-1 text-indigo-600 hover:text-indigo-800"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              )}
                              {localRoutineStatusFilter !== 'all' && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-pink-100 text-pink-800">
                                  Status: {localRoutineStatusFilter.replace('_', ' ')}
                                  <button
                                    onClick={() => setLocalRoutineStatusFilter('all')}
                                    className="ml-1 text-pink-600 hover:text-pink-800"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              )}
                              {localNotesFilter !== 'all' && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
                                  Notes: {localNotesFilter.replace('_', ' ')}
                                  <button
                                    onClick={() => setLocalNotesFilter('all')}
                                    className="ml-1 text-teal-600 hover:text-teal-800"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              )}
                            </div>
                            
                            {/* Clear All Filters */}
                            {(localPriorityFilter !== 'all' || localCompletionFilter !== 'all' || localSortBy !== 'recent' || localDateFilter !== 'all' || localProgressFilter !== 'all' || localFrequencyFilter !== 'all' || localRoutineStatusFilter !== 'all' || localNotesFilter !== 'all') && (
                              <button
                                onClick={() => {
                                  setLocalPriorityFilter('all');
                                  setLocalCompletionFilter('all');
                                  setLocalSortBy('recent');
                                  setLocalDateFilter('all');
                                  setLocalProgressFilter('all');
                                  setLocalFrequencyFilter('all');
                                  setLocalRoutineStatusFilter('all');
                                  setLocalNotesFilter('all');
                                }}
                                className="text-xs text-gray-500 hover:text-gray-700 mt-2"
                              >
                                Clear all filters
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Knowledge Chat Button */}
                <button
                  onClick={() => setShowKnowledgeModal(true)}
                  className="p-3 bg-white/70 border border-gray-200/50 rounded-xl hover:bg-gray-50 transition-all duration-300 flex items-center space-x-2"
                >
                  <Brain className="w-5 h-5 text-purple-600" />
                  <span className="text-sm font-medium text-gray-700">Knowledge</span>
                  <span className="bg-purple-500 text-white text-xs rounded-full px-2 py-1">
                    AI
                  </span>
                </button>
                
                {/* Context Links & Google Drive */}
                <div className="relative">
                  <button
                    onClick={() => setShowContextMenu(!showContextMenu)}
                    className="p-3 bg-white/70 border border-gray-200/50 rounded-xl hover:bg-gray-50 transition-all duration-300 flex items-center space-x-2"
                  >
                    <FolderOpen className="w-5 h-5 text-gray-600" />
                    <span className="text-sm font-medium text-gray-700">Context</span>
                    {contextLinks.length > 0 && (
                      <span className="bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        {contextLinks.length}
                      </span>
                    )}
                  </button>

                  {/* Context Menu Dropdown */}
                  {showContextMenu && (
                    <div className="absolute right-0 top-full mt-2 w-80 bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-white/30 z-50">
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold text-gray-800">Context & Resources</h3>
                          <button
                            onClick={() => setShowContextMenu(false)}
                            className="p-1 hover:bg-gray-100 rounded-lg"
                          >
                            <X className="w-4 h-4 text-gray-600" />
                          </button>
                        </div>

                        {/* Quick Actions */}
                        <div className="space-y-2 mb-4">
                          <button
                            onClick={handleGoogleDriveConnect}
                            className="w-full flex items-center space-x-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 rounded-xl border border-green-200/50 transition-all duration-300"
                          >
                            <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                              <FolderOpen className="w-4 h-4 text-white" />
                            </div>
                            <div className="text-left">
                              <div className="font-medium text-green-800">Connect Google Drive</div>
                              <div className="text-xs text-green-600">Quick access to category files</div>
                            </div>
                          </button>

                          <button
                            onClick={() => {
                              setShowAddLinkModal(true);
                              setShowContextMenu(false);
                            }}
                            className="w-full flex items-center space-x-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 rounded-xl border border-blue-200/50 transition-all duration-300"
                          >
                            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                              <Link className="w-4 h-4 text-white" />
                            </div>
                            <div className="text-left">
                              <div className="font-medium text-blue-800">Add Link</div>
                              <div className="text-xs text-blue-600">Save important references</div>
                            </div>
                          </button>
                        </div>

                        {/* Existing Links */}
                        {contextLinks.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium text-gray-700 border-t pt-3">Saved Links</h4>
                            {contextLinks.map((link) => (
                              <div key={link.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg group">
                                <button
                                  onClick={() => openLink(link.url)}
                                  className="flex items-center space-x-2 text-left flex-1"
                                >
                                  {link.type === 'drive' ? (
                                    <FolderOpen className="w-4 h-4 text-green-600" />
                                  ) : link.type === 'document' ? (
                                    <FileText className="w-4 h-4 text-blue-600" />
                                  ) : (
                                    <Globe className="w-4 h-4 text-gray-600" />
                                  )}
                                  <span className="text-sm font-medium text-gray-800 truncate">{link.title}</span>
                                  <ExternalLink className="w-3 h-3 text-gray-400" />
                                </button>
                                <button
                                  onClick={() => deleteLink(link.id)}
                                  className="p-1 hover:bg-red-100 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Trash2 className="w-3 h-3 text-red-600" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div 
                  className="w-4 h-4 rounded-full shadow-lg"
                  style={{ backgroundColor: category.color }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Tesla-Style Tab Navigation */}
        <div className="mb-8">
          <div className="bg-white/60 backdrop-blur-xl rounded-2xl shadow-lg border border-white/30 p-2">
            <div className="flex space-x-2">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.type;
                const stats = getTabStats(tab.type);
                
                return (
                  <button
                    key={tab.type}
                    onClick={() => setActiveTab(tab.type)}
                    className={`flex-1 relative overflow-hidden rounded-xl px-6 py-4 transition-all duration-300 ${
                      isActive 
                        ? 'bg-white shadow-lg transform scale-105' 
                        : 'hover:bg-white/50'
                    }`}
                  >
                    {isActive && (
                      <div className={`absolute inset-0 bg-gradient-to-r ${tab.gradient} opacity-10`} />
                    )}
                    
                    <div className="relative z-10 flex items-center justify-center space-x-3">
                      <div className={`${isActive ? 'text-gray-800' : 'text-gray-600'}`}>
                        {tab.icon}
                      </div>
                      <div className="text-left">
                        <div className={`font-semibold ${isActive ? 'text-gray-800' : 'text-gray-600'}`}>
                          {tab.label}
                        </div>
                        <div className={`text-sm ${isActive ? 'text-gray-600' : 'text-gray-500'}`}>
                          {stats}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="transition-all duration-300">
          {renderTabContent()}
        </div>
      </div>

      {/* Floating Action Button - Hidden when AI Assistant is open */}
      {!isAIAssistantOpen && (
        <button
          onClick={() => setShowAddModal(true)}
          className="fixed bottom-8 right-8 w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-110 z-40 flex items-center justify-center"
        >
          <Plus className="w-8 h-8" />
        </button>
      )}

      {renderAddModal()}

      {/* Recurring Event Delete Modal */}
      {showRecurringDeleteModal && recurringDeleteData && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-600" />
              </div>
              
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Delete Recurring Event
              </h3>
              
              <p className="text-gray-600 mb-6">
                "{recurringDeleteData.eventTitle}" is a recurring event with{' '}
                <span className="font-semibold text-gray-900">
                  {recurringDeleteData.occurrenceCount} occurrences
                </span>.
              </p>
              
              <div className="space-y-3">
                <button
                  onClick={() => handleRecurringDelete(false)}
                  className="w-full px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-colors"
                >
                  Delete Only This Event
                </button>
                
                <button
                  onClick={() => handleRecurringDelete(true)}
                  className="w-full px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-colors"
                >
                  Delete All {recurringDeleteData.occurrenceCount} Events
                </button>
                
                <button
                  onClick={() => {
                    setShowRecurringDeleteModal(false);
                    setRecurringDeleteData(null);
                  }}
                  className="w-full px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Link Modal */}
      {showAddLinkModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl border border-white/30">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Link className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {newLink.type === 'drive' ? 'Connect Google Drive' : 'Add Context Link'}
              </h3>
              <p className="text-gray-600">
                {newLink.type === 'drive' 
                  ? `Connect your Google Drive folder for ${category?.name}` 
                  : `Save important resources for ${category?.name}`
                }
              </p>
              
              {newLink.type === 'drive' && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm">
                  <div className="font-semibold text-blue-800 mb-2">📋 Setup Instructions:</div>
                  <ol className="list-decimal list-inside space-y-1 text-blue-700">
                    <li>Create or open your Google Drive folder</li>
                    <li>Click "Share" and set to "Anyone with the link can view"</li>
                    <li>Copy and paste the share link below</li>
                  </ol>
                </div>
              )}
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Link Title</label>
                <input
                  type="text"
                  value={newLink.title}
                  onChange={(e) => setNewLink(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300"
                  placeholder="e.g., Study Materials"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">URL</label>
                <input
                  type="url"
                  value={newLink.url}
                  onChange={(e) => setNewLink(prev => ({ ...prev, url: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300"
                  placeholder={newLink.type === 'drive' ? 'https://drive.google.com/drive/folders/...' : 'https://...'}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Type</label>
                <select
                  value={newLink.type}
                  onChange={(e) => setNewLink(prev => ({ ...prev, type: e.target.value as 'link' | 'drive' | 'document' }))}
                  className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300"
                >
                  <option value="link">General Link</option>
                  <option value="drive">Google Drive</option>
                  <option value="document">Document</option>
                </select>
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowAddLinkModal(false);
                  setNewLink({ title: '', url: '', type: 'link' });
                }}
                className="flex-1 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddLink}
                disabled={!newLink.title.trim() || !newLink.url.trim()}
                className="flex-1 px-4 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors"
              >
                Add Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Apple Notes-Style Fullscreen Modal */}
      {fullscreenNote && (() => {
        const note = items.find(item => item.id === fullscreenNote);
        
        if (!note) return null;
        
        return (
          <div className="fixed inset-0 bg-white z-50 flex flex-col">
            {/* Header */}
            <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setFullscreenNote(null)}
                  className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: category?.color || '#fbbf24' }}
                  />
                  <span className="text-sm font-medium text-gray-600">
                    {category?.icon} {category?.name}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500">
                  {note.updatedAt instanceof Date && !isNaN(note.updatedAt.getTime())
                    ? note.updatedAt.toLocaleDateString('en-US', { 
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : 'Invalid date'}
                </span>
                <button
                  onClick={() => startEditingItem(note)}
                  className="p-2 hover:bg-amber-100 rounded-lg transition-colors"
                >
                  <Edit3 className="w-5 h-5 text-amber-600" />
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-4xl mx-auto px-8 py-12">
                {editingItem === note.id ? (
                  <div className="space-y-6">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full text-lg leading-relaxed bg-transparent border-none outline-none resize-none min-h-[60vh] text-gray-800 placeholder-gray-400"
                      placeholder="Start writing..."
                      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
                      autoFocus
                    />
                    <div className="flex space-x-4">
                      <button
                        onClick={() => saveEditedItem(note.id)}
                        className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        Save
                      </button>
                      <button
                        onClick={cancelEditing}
                        className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {/* Voice Note Controls in Fullscreen */}
                    {note.type === 'voiceNote' && note.attachment && (
                      <div className="mb-8 p-6 bg-yellow-50 rounded-2xl border border-yellow-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-lg font-semibold text-yellow-800 mb-2">Voice Recording</h3>
                            <p className="text-sm text-yellow-700">Click play to listen to your voice note</p>
                          </div>
                          <button
                            onClick={() => playVoiceNote(note.id, note.attachment!)}
                            className="px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl transition-colors flex items-center space-x-3 shadow-lg hover:shadow-xl transform hover:scale-105"
                          >
                            {playingNote === note.id ? (
                              <>
                                <Pause className="w-5 h-5" />
                                <span className="font-medium">Pause</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-5 h-5" />
                                <span className="font-medium">Play Recording</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                    
                    <div 
                      className="text-lg leading-relaxed text-gray-800 whitespace-pre-wrap cursor-text"
                      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
                      onClick={() => startEditingItem(note)}
                    >
                      {note.text || 'Tap to start writing...'}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Footer */}
            <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-4 text-sm text-gray-500">
                <span>{note.text.split(' ').length} words</span>
                <span>{note.text.length} characters</span>
              </div>
              
              <div className="flex items-center space-x-2">
                {note.type === 'voiceNote' && note.attachment && (
                  <button
                    onClick={() => playVoiceNote(note.id, note.attachment!)}
                    className="flex items-center text-yellow-600 hover:text-yellow-700 transition-colors px-3 py-1.5 hover:bg-yellow-50 rounded-lg"
                  >
                    {playingNote === note.id ? (
                      <>
                        <Pause className="w-4 h-4 mr-1" />
                        <span className="text-sm font-medium">Pause</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-1" />
                        <span className="text-sm font-medium">Play voice note</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
    </div>
  );
      })()}

      {/* Fullscreen Routine View Modal */}
      {fullscreenRoutine && (() => {
        const routine = items.find(item => item.id === fullscreenRoutine);
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
                      onClick={() => window.print()}
                      className="p-3 hover:bg-white/20 rounded-xl transition-colors"
                      title="Print Routine"
                    >
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setFullscreenRoutine(null)}
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
                    onClick={() => {
                      setItems(items.map(i => {
                        if (i.id === routine.id) {
                          const wasCompleted = i.metadata?.completedToday || false;
                          const currentStreak = i.metadata?.currentStreak || 0;
                          const bestStreak = i.metadata?.bestStreak || 0;
                          
                          return {
                            ...i,
                            metadata: {
                              ...i.metadata,
                              completedToday: !wasCompleted,
                              currentStreak: !wasCompleted ? currentStreak + 1 : Math.max(0, currentStreak - 1),
                              bestStreak: !wasCompleted ? Math.max(bestStreak, currentStreak + 1) : bestStreak
                            },
                            updatedAt: new Date()
                          };
                        }
                        return i;
                      }));
                    }}
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
                <div className="hidden print:block mt-12">
                  <div className="border-t-2 border-gray-200 pt-8">
                    <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
                      {routine.title} - Routine Guide
                    </h2>
                    
                    <div className="mb-8">
                      <h3 className="text-xl font-semibold text-gray-800 mb-4">Instructions:</h3>
                      <div className="bg-gray-50 rounded-lg p-6 border">
                        <ol className="list-decimal list-inside space-y-3 text-gray-700">
                          <li>Set aside {duration} minutes for this routine</li>
                          <li>Find a quiet, comfortable space</li>
                          <li>Follow the routine description above</li>
                          <li>Mark completion in the tracking grid below</li>
                          <li>Stay consistent for best results</li>
                        </ol>
                      </div>
                    </div>
                    
                    <div className="mb-8">
                      <h3 className="text-xl font-semibold text-gray-800 mb-4">4-Week Tracking Grid:</h3>
                      <div className="grid grid-cols-7 gap-1 mb-4">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                          <div key={day} className="text-center font-semibold text-sm text-gray-600 p-2">
                            {day}
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {Array.from({ length: 28 }, (_, i) => (
                          <div key={i} className="aspect-square border border-gray-300 rounded flex items-center justify-center text-sm text-gray-400">
                            {i + 1}
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 rounded-lg p-6 border">
                      <h3 className="text-lg font-semibold text-gray-800 mb-3">Tips for Success:</h3>
                      <ul className="list-disc list-inside space-y-2 text-gray-700">
                        <li>Do this routine at the same time each day</li>
                        <li>Start small and build consistency</li>
                        <li>Track your progress daily</li>
                        <li>Celebrate small wins along the way</li>
                        <li>Don't break the chain - aim for daily completion</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Category Knowledge Modal */}
      {showKnowledgeModal && (
        <CategoryKnowledge
          categoryId={categoryId}
          category={category}
          items={categoryItems}
          contextLinks={contextLinks}
          onClose={() => setShowKnowledgeModal(false)}
        />
      )}
    </div>
  );
};

export default CategoryPage; 