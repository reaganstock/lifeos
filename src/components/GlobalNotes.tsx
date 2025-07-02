import React, { useState, useRef, useEffect } from 'react';
import { StickyNote, Plus, Search, Mic, MicOff, Play, Pause, Camera, X, Edit3, Save, Maximize2, Trash2, Loader2, Filter, Clock, Image, Type, Settings, Calendar } from 'lucide-react';
import { Item, Category } from '../types';
import { voiceService, VoiceRecording } from '../services/voiceService';
import { AIService } from '../services/aiService';
import { chatService } from '../services/ChatService';
import AIAssistant from './AIAssistant';
import { copyToClipboard, showCopyFeedback } from '../utils/clipboard';
import { getAudioUrl } from '../utils/audioStorage';
import { hybridSyncService } from '../services/hybridSyncService';

interface GlobalNotesProps {
  items: Item[];
  setItems: React.Dispatch<React.SetStateAction<Item[]>>;
  categories: Category[];
}

const GlobalNotes: React.FC<GlobalNotesProps> = ({ items, setItems, categories }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [sortBy, setSortBy] = useState<'recent' | 'title' | 'category'>('recent');
  const [mediaFilter, setMediaFilter] = useState<'all' | 'text' | 'voice' | 'images'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [expandedNote, setExpandedNote] = useState<string | null>(null);
  const [fullscreenNote, setFullscreenNote] = useState<string | null>(null);
  const [fullscreenCreate, setFullscreenCreate] = useState(false);
  const [playingNote, setPlayingNote] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [currentRecording, setCurrentRecording] = useState<VoiceRecording | null>(null);
  const [shouldTranscribe, setShouldTranscribe] = useState(true);
  
  // AI Assistant state
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [aiSidebarWidth, setAiSidebarWidth] = useState(Math.min(400, window.innerWidth / 2));
  const [isAiSidebarCollapsed, setIsAiSidebarCollapsed] = useState(false);
  
  const [newNote, setNewNote] = useState({
    title: '',
    text: '',
    categoryId: categories[0]?.id || '',
    voice: null as Blob | null,
    voiceRecordings: [] as Array<{ id: string; blob: Blob; transcription?: string; isTranscribing?: boolean; customTitle?: string }>,
    transcription: '',
    images: [] as File[],
    isTranscribingImages: false,
    autoTranscribeImages: true,
    autoTranscribeVoice: true
  });
  const [editText, setEditText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Slash command state
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashMenuPosition, setSlashMenuPosition] = useState({ x: 0, y: 0 });
  const [slashQuery, setSlashQuery] = useState('');
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  
  const [selectedVoiceRecording, setSelectedVoiceRecording] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<number | null>(null);

  // Slash commands
  const slashCommands = [
    {
      id: 'ai-chat',
      label: 'AI Chat',
      description: 'Open AI Assistant for real-time help',
      icon: '🤖',
      action: async () => {
        // Create a new session for this interaction
        const newSession = await chatService.createSession('Note Assistant');
        chatService.switchToSession(newSession.id);
        setShowAIAssistant(true);
      }
    },
    {
      id: 'ai-summary',
      label: 'AI Summary',
      description: 'Generate a smart summary of your note',
      icon: '📝',
      action: () => generateAISummary()
    },
    {
      id: 'ai-improve',
      label: 'AI Improve',
      description: 'Enhance and improve your writing',
      icon: '✨',
      action: () => improveWithAI()
    },
    {
      id: 'voice-record',
      label: 'Record Voice',
      description: 'Start voice recording',
      icon: '🎤',
      action: () => handleVoiceNote()
    },
    {
      id: 'add-image',
      label: 'Add Image',
      description: 'Upload an image',
      icon: '📷',
      action: () => document.getElementById('imageUploadFS')?.click()
    },
    {
      id: 'extract-text',
      label: 'Extract Text',
      description: 'Extract text from images',
      icon: '📝',
      action: () => newNote.images.length > 0 && extractImageText()
    }
  ];

  // Dark mode detection based on time
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const hour = new Date().getHours();
    return hour >= 20 || hour < 7; // Dark mode from 8 PM to 7 AM
  });
  
  // Update dark mode based on time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      const hour = new Date().getHours();
      setIsDarkMode(hour >= 20 || hour < 7);
    }, 60000);
    
    return () => clearInterval(interval);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command / to open AI Assistant (only in fullscreen mode)
      if (e.key === '/' && (e.metaKey || e.ctrlKey)) {
        if (fullscreenCreate) {
          e.preventDefault();
          setShowAIAssistant(!showAIAssistant);
        }
      }
      // Press 'Escape' to close modals
      if (e.key === 'Escape') {
        setShowAddForm(false);
        setFullscreenCreate(false);
        setFullscreenNote(null);
        setShowSlashMenu(false);
        setEditingNoteId(null);
        setShowAIAssistant(false);
      }
      // Arrow keys for slash menu navigation
      if (showSlashMenu) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedCommandIndex(prev => 
            prev < filteredCommands.length - 1 ? prev + 1 : 0
          );
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedCommandIndex(prev => 
            prev > 0 ? prev - 1 : filteredCommands.length - 1
          );
        } else if (e.key === 'Enter') {
          e.preventDefault();
          executeSlashCommand(filteredCommands[selectedCommandIndex]);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showAddForm, fullscreenCreate, fullscreenNote, showSlashMenu, selectedCommandIndex, showAIAssistant]);

  // Filter commands based on slash query
  const filteredCommands = slashCommands.filter(cmd =>
    cmd.label.toLowerCase().includes(slashQuery.toLowerCase()) ||
    cmd.description.toLowerCase().includes(slashQuery.toLowerCase())
  );

  // Execute slash command
  const executeSlashCommand = (command: any) => {
    // Remove the "/" and command text from the note
    const textarea = document.querySelector('textarea[data-fullscreen="true"]') as HTMLTextAreaElement;
    if (textarea) {
      const text = textarea.value;
      const slashIndex = text.lastIndexOf('/');
      const newText = text.substring(0, slashIndex);
      setNewNote(prev => ({ ...prev, text: newText }));
    }
    
    setShowSlashMenu(false);
    setSlashQuery('');
    setSelectedCommandIndex(0);
    
    // Execute the command
    command.action();
  };

  // Handle text change to detect slash commands
  const handleTextChange = (value: string) => {
    setNewNote(prev => ({ ...prev, text: value }));
    
    // Check for slash command
    const textarea = document.querySelector('textarea[data-fullscreen="true"]') as HTMLTextAreaElement;
    if (textarea) {
      const cursorPosition = textarea.selectionStart;
      const textBeforeCursor = value.substring(0, cursorPosition);
      const lastSlashIndex = textBeforeCursor.lastIndexOf('/');
      
      if (lastSlashIndex !== -1) {
        const afterSlash = textBeforeCursor.substring(lastSlashIndex + 1);
        const hasSpace = afterSlash.includes(' ') || afterSlash.includes('\n');
        
        if (!hasSpace && lastSlashIndex === textBeforeCursor.length - afterSlash.length - 1) {
          // Show slash menu
          setSlashQuery(afterSlash);
          setShowSlashMenu(true);
          setSelectedCommandIndex(0);
          
          // Position the menu near the cursor
          const rect = textarea.getBoundingClientRect();
          const textBeforeCursor = value.substring(0, cursorPosition);
          const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 20;
          const lines = textBeforeCursor.split('\n');
          const currentLineIndex = lines.length - 1;
          
          setSlashMenuPosition({
            x: rect.left + 20,
            y: rect.top + (currentLineIndex * lineHeight) + lineHeight + 5
          });
        } else {
          setShowSlashMenu(false);
        }
      } else {
        setShowSlashMenu(false);
      }
    }
  };

  const aiService = new AIService();

  const notes = items.filter(item => item.type === 'note' || item.type === 'voiceNote');
  
  const filteredNotes = notes.filter(note => {
    // Category filter
    const categoryMatch = selectedCategory === 'all' || note.categoryId === selectedCategory;
    
    // Search filter
    const searchMatch = searchQuery === '' || 
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.text.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Media type filter
    const mediaMatch = mediaFilter === 'all' || 
      (mediaFilter === 'text' && note.type === 'note' && !note.metadata?.isVoiceNote && (!note.metadata?.imageUrls || note.metadata.imageUrls.length === 0)) ||
      (mediaFilter === 'voice' && (note.type === 'voiceNote' || note.metadata?.isVoiceNote)) ||
      (mediaFilter === 'images' && note.metadata?.imageUrls && note.metadata.imageUrls.length > 0);
    
    // Date filter
    const now = new Date();
    const noteDate = new Date(note.updatedAt);
    let dateMatch = true;
    
    if (dateFilter === 'today') {
      dateMatch = noteDate.toDateString() === now.toDateString();
    } else if (dateFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      dateMatch = noteDate >= weekAgo;
    } else if (dateFilter === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      dateMatch = noteDate >= monthAgo;
    }
    
    return categoryMatch && searchMatch && mediaMatch && dateMatch;
  });

  const sortedNotes = [...filteredNotes].sort((a, b) => {
    switch (sortBy) {
      case 'title':
        return a.title.localeCompare(b.title);
      case 'category':
        return a.categoryId.localeCompare(b.categoryId);
      default:
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    }
  });

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [editText]);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    // Just add the images, don't transcribe yet - transcription happens after note creation
    setNewNote(prev => ({ 
      ...prev, 
      images: [...prev.images, ...imageFiles]
    }));
  };

  const removeImage = (indexToRemove: number) => {
    setNewNote(prev => ({
      ...prev,
      images: prev.images.filter((_, index) => index !== indexToRemove)
    }));
  };

  const handleAddNote = () => {
    if (!newNote.text.trim() && !newNote.voice && !newNote.images.length) return;

    // Generate a smart title if none provided
    const generatedTitle = newNote.title.trim() || 
      (newNote.text.length > 50 
        ? newNote.text.substring(0, 50) + '...' 
        : newNote.text) || 
      (newNote.images.length > 0 
        ? `Image Note - ${new Date().toLocaleDateString()}`
        : `Note - ${new Date().toLocaleDateString()}`);

    if (editingNoteId) {
      // Update existing note
      setItems(prevItems => prevItems.map(item => 
        item.id === editingNoteId 
          ? {
              ...item,
              title: generatedTitle,
              text: newNote.text,
              categoryId: newNote.categoryId,
              updatedAt: new Date(),
            }
          : item
      ));
      
      // Trigger immediate sync after updating note (with small delay)
      setTimeout(() => {
        hybridSyncService.manualSync().catch(error => {
          console.log('Background sync failed (note still saved locally):', error);
        });
      }, 500); // 500ms delay to ensure localStorage is updated
    } else {
      // Create new note
    const note: Item = {
      id: Date.now().toString(),
      categoryId: newNote.categoryId,
      type: newNote.voice ? 'voiceNote' : 'note',
      title: generatedTitle,
      text: newNote.text || '', // Start with just the text content
      attachment: newNote.voice ? URL.createObjectURL(newNote.voice) : undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        aiGenerated: false, // Will be updated after transcriptions
        isTranscribing: !!(newNote.voice && shouldTranscribe), // Voice transcribing status
        isTranscribingImages: !!(newNote.images.length && newNote.autoTranscribeImages), // Image transcribing status
        hasImage: !!newNote.images.length,
        imageUrls: newNote.images.map(image => URL.createObjectURL(image)),
        hasCustomTitle: !!newNote.title.trim()
      }
    };

    // Add the note immediately
    setItems(prevItems => [...prevItems, note]);
    
    // Handle background voice transcription if needed
    if (newNote.voice && shouldTranscribe) {
      handleBackgroundTranscription(note.id, newNote.voice);
    }
    
    // Handle background image transcription if needed
    if (newNote.images.length && newNote.autoTranscribeImages) {
      handleBackgroundImageTranscription(note.id, newNote.images);
      }
      
      // Trigger immediate sync after creating new note (with small delay)
      setTimeout(() => {
        hybridSyncService.manualSync().catch(error => {
          console.log('Background sync failed (note still saved locally):', error);
        });
      }, 500); // 500ms delay to ensure localStorage is updated
    }
    
    // Reset form
    setNewNote({
      title: '',
      text: '',
      categoryId: categories[0]?.id || '',
      voice: null,
      voiceRecordings: [],
      transcription: '',
      images: [],
      isTranscribingImages: false,
      autoTranscribeImages: true,
      autoTranscribeVoice: true
    });
    setCurrentRecording(null);
    setShouldTranscribe(true);
    setShowAddForm(false);
    setFullscreenCreate(false);
    setEditingNoteId(null);
  };

  const handleBackgroundTranscription = async (noteId: string, voiceBlob: Blob) => {
    try {
      const transcriptionResult = await voiceService.transcribeWithContext(voiceBlob);
      
      // Update the note with transcription
      setItems(prevItems => prevItems.map(item => {
        if (item.id === noteId) {
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
      // Update note to remove transcribing status
      setItems(prevItems => prevItems.map(item => {
        if (item.id === noteId) {
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

  const handleBackgroundImageTranscription = async (noteId: string, imageFiles: File[]) => {
    try {
      console.log('Starting background image transcription for', imageFiles.length, 'images');
      const transcriptions = await Promise.all(
        imageFiles.map(file => aiService.transcribeImage(file))
      );
      
      const combinedTranscription = transcriptions.filter(t => t.trim()).join('\n\n');
      console.log('Image transcription result:', combinedTranscription);
      
      // Update the note with image transcription
      setItems(prevItems => prevItems.map(item => {
        if (item.id === noteId) {
          const updatedText = item.text 
            ? (combinedTranscription ? `${item.text}\n\n${combinedTranscription}` : item.text)
            : combinedTranscription;
          
          return {
            ...item,
            text: updatedText,
            metadata: {
              ...item.metadata,
              transcription: combinedTranscription || undefined,
              aiGenerated: item.metadata?.aiGenerated || !!combinedTranscription,
              isTranscribingImages: false
            },
            updatedAt: new Date()
          };
        }
        return item;
      }));
    } catch (error) {
      console.error('Background image transcription failed:', error);
      // Update note to remove transcribing status
      setItems(prevItems => prevItems.map(item => {
        if (item.id === noteId) {
          return {
            ...item,
            metadata: {
              ...item.metadata,
              isTranscribingImages: false
            }
          };
        }
        return item;
      }));
    }
  };

  const startRecording = async () => {
    try {
      setIsTranscribing(false);
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
      
      // Add to voice recordings array instead of replacing
      const newVoiceRecording = {
        id: Date.now().toString(),
        blob: recording.blob,
        isTranscribing: false,
        customTitle: undefined as string | undefined
      };
      
      setNewNote(prev => ({
        ...prev,
        voice: recording.blob, // Keep for backwards compatibility
        voiceRecordings: [...prev.voiceRecordings, newVoiceRecording]
      }));
      
    } catch (error) {
      console.error('Error with voice recording:', error);
      setIsRecording(false);
    }
  };

  const handleVoiceNote = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Extract text from specific voice recording
  const extractVoiceText = async (recordingId: string) => {
    const recording = newNote.voiceRecordings.find(r => r.id === recordingId);
    if (!recording) return;

    // Update transcribing status
    setNewNote(prev => ({
      ...prev,
      voiceRecordings: prev.voiceRecordings.map(r => 
        r.id === recordingId ? { ...r, isTranscribing: true } : r
      )
    }));

    try {
      const result = await voiceService.transcribeWithContext(recording.blob);
      
      // Update the recording with transcription and append to main text
      setNewNote(prev => ({
        ...prev,
        text: prev.text + (prev.text ? '\n\n' : '') + result.text,
        voiceRecordings: prev.voiceRecordings.map(r => 
          r.id === recordingId 
            ? { ...r, transcription: result.text, isTranscribing: false }
            : r
        )
      }));
    } catch (error) {
      console.error('Voice transcription failed:', error);
      // Remove transcribing status
      setNewNote(prev => ({
        ...prev,
        voiceRecordings: prev.voiceRecordings.map(r => 
          r.id === recordingId ? { ...r, isTranscribing: false } : r
        )
      }));
    }
  };

  // Remove specific voice recording
  const removeVoiceRecording = (recordingId: string) => {
    setNewNote(prev => ({
      ...prev,
      voiceRecordings: prev.voiceRecordings.filter(r => r.id !== recordingId),
      voice: prev.voiceRecordings.length > 1 ? prev.voiceRecordings[prev.voiceRecordings.length - 2]?.blob || null : null
    }));
  };

  // Extract text from images manually
  const extractImageText = async () => {
    if (newNote.images.length === 0) return;

    setNewNote(prev => ({ ...prev, isTranscribingImages: true }));
    
    try {
      const transcriptions = await Promise.all(
        newNote.images.map(file => aiService.transcribeImage(file))
      );
      
      const combinedTranscription = transcriptions.filter(t => t.trim()).join('\n\n');
      
      if (combinedTranscription) {
        setNewNote(prev => ({
          ...prev,
          text: prev.text + (prev.text ? '\n\n' : '') + combinedTranscription,
          isTranscribingImages: false
        }));
      } else {
        setNewNote(prev => ({ ...prev, isTranscribingImages: false }));
      }
    } catch (error) {
      console.error('Image transcription failed:', error);
      setNewNote(prev => ({ ...prev, isTranscribingImages: false }));
    }
  };

  // AI Summary generation
  const generateAISummary = async () => {
    if (!newNote.text.trim()) return;

    try {
      const summary = await aiService.generateSummary(newNote.text);
      setNewNote(prev => ({
        ...prev,
        text: prev.text + '\n\n## AI Summary\n' + summary
      }));
    } catch (error) {
      console.error('AI summary failed:', error);
    }
  };

  // AI content improvement
  const improveWithAI = async () => {
    if (!newNote.text.trim()) return;

    try {
      const improved = await aiService.improveText(newNote.text);
      setNewNote(prev => ({
        ...prev,
        text: improved
      }));
    } catch (error) {
      console.error('AI improvement failed:', error);
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
      
      // Get audio URL from localStorage first, fallback to provided URL
      const storedAudioUrl = getAudioUrl(noteId, audioUrl);
      
      if (!storedAudioUrl) {
        console.error('No audio URL available for note:', noteId);
        return;
      }
      
      // Create new audio and play
      const audio = new Audio(storedAudioUrl);
      audioRef.current = audio;
      
      audio.onended = () => {
        setPlayingNote(null);
      };
      
      audio.onerror = () => {
        console.error('Error playing audio for note:', noteId);
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

  const deleteNote = (noteId: string) => {
    setItems(items.filter(item => item.id !== noteId));
    setExpandedNote(null);
    setEditingNote(null);
    if (playingNote === noteId) {
      setPlayingNote(null);
      if (audioRef.current) {
        audioRef.current.pause();
      }
    }
  };

  const startEditing = (note: Item) => {
    setEditingNote(note.id);
    setEditText(note.text);
    setExpandedNote(note.id);
  };

  const saveEdit = (noteId: string) => {
    setItems(items.map(item => 
      item.id === noteId 
        ? { 
            ...item, 
            text: editText,
            title: editText.length > 50 ? editText.substring(0, 50) + '...' : editText,
            updatedAt: new Date()
          }
        : item
    ));
    setEditingNote(null);
    setEditText('');
  };

  const cancelEdit = () => {
    setEditingNote(null);
    setEditText('');
  };

  const handleNoteClick = (noteId: string) => {
    if (expandedNote === noteId) {
      setExpandedNote(null);
    } else {
      setExpandedNote(noteId);
    }
  };

  const totalNotes = filteredNotes.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <div className="p-6 max-w-7xl mx-auto">
        {/* Floating Header */}
        <div className="sticky top-6 z-30 mb-8">
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-yellow-600 to-orange-500 bg-clip-text text-transparent flex items-center">
                  <StickyNote className="w-10 h-10 text-yellow-600 mr-4" />
                  Notes
                </h1>
                <p className="text-gray-600 mt-2 text-lg">
                  {totalNotes} {totalNotes === 1 ? 'note' : 'notes'} • Tap to expand, double-tap to edit
                </p>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowAddForm(true)}
                  className="group relative overflow-hidden bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-8 py-4 rounded-2xl flex items-center transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
                >
                  <div className="absolute inset-0 bg-white/20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                  <Plus className="w-5 h-5 mr-3 relative z-10" />
                  <span className="font-semibold relative z-10">New Note</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Filter Controls */}
        <div className="mb-8">
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
              {/* Search */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Search Notes</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by content..."
                    className="w-full pl-10 pr-4 py-4 bg-white/70 border border-gray-200/50 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300 text-gray-800"
                  />
                </div>
              </div>

              {/* Category Filter */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-4 py-4 bg-white/70 border border-gray-200/50 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300 text-gray-800"
                >
                  <option value="all">All Categories</option>
                  {categories.map((category: Category) => (
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
                  onChange={(e) => setSortBy(e.target.value as 'recent' | 'title' | 'category')}
                  className="w-full px-4 py-4 bg-white/70 border border-gray-200/50 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300 text-gray-800"
                >
                  <option value="recent">Most Recent</option>
                  <option value="title">Title</option>
                  <option value="category">Category</option>
                </select>
              </div>
            </div>

            {/* Advanced Filters */}
            {showAdvancedFilters && (
              <div className="border-t border-gray-200/50 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Media Type Filter */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 flex items-center">
                      <Type className="w-4 h-4 mr-2 text-blue-600" />
                      Media Type
                    </label>
                    <select
                      value={mediaFilter}
                      onChange={(e) => setMediaFilter(e.target.value as 'all' | 'text' | 'voice' | 'images')}
                      className="w-full px-4 py-4 bg-white/70 border border-gray-200/50 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300 text-gray-800"
                    >
                      <option value="all">All Types</option>
                      <option value="text">📝 Text Only</option>
                      <option value="voice">🎤 Voice Notes</option>
                      <option value="images">🖼️ With Images</option>
                    </select>
                  </div>

                  {/* Date Filter */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 flex items-center">
                      <Calendar className="w-4 h-4 mr-2 text-blue-600" />
                      Date Range
                    </label>
                    <select
                      value={dateFilter}
                      onChange={(e) => setDateFilter(e.target.value as 'all' | 'today' | 'week' | 'month')}
                      className="w-full px-4 py-4 bg-white/70 border border-gray-200/50 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300 text-gray-800"
                    >
                      <option value="all">All Time</option>
                      <option value="today">📅 Today</option>
                      <option value="week">📆 This Week</option>
                      <option value="month">🗓️ This Month</option>
                    </select>
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
                  {mediaFilter !== 'all' && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Type: {mediaFilter}
                      <button
                        onClick={() => setMediaFilter('all')}
                        className="ml-2 text-green-600 hover:text-green-800"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {dateFilter !== 'all' && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      Date: {dateFilter}
                      <button
                        onClick={() => setDateFilter('all')}
                        className="ml-2 text-purple-600 hover:text-purple-800"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {searchQuery && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                      Search: "{searchQuery}"
                      <button
                        onClick={() => setSearchQuery('')}
                        className="ml-2 text-orange-600 hover:text-orange-800"
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

        {/* Revolutionary Notes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedNotes.map((note) => {
            const category = categories.find((c: Category) => c.id === note.categoryId);
            const isExpanded = expandedNote === note.id;
            const isEditing = editingNote === note.id;
            const isVoiceNote = note.type === 'voiceNote';
            const isPlaying = playingNote === note.id;
            
            return (
              <div
                key={note.id}
                className={`group relative bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/30 overflow-hidden transition-all duration-500 hover:shadow-2xl hover:scale-[1.02] cursor-pointer ${
                  isExpanded ? 'md:col-span-2 lg:col-span-2 transform scale-[1.01]' : ''
                }`}
                onClick={() => !isEditing && handleNoteClick(note.id)}
                onDoubleClick={(e) => {
                  if (!isEditing) {
                    e.preventDefault();
                    // Populate the creation modal with this note's content for editing
                    // Convert voice attachment back to blob format if available
                    let voiceRecordings: Array<{ id: string; blob: Blob; transcription?: string; isTranscribing?: boolean; customTitle?: string }> = [];
                    if (isVoiceNote && note.attachment) {
                      // Convert URL back to blob (this is a simplified approach)
                      fetch(note.attachment)
                        .then(response => response.blob())
                        .then(blob => {
                          const voiceRecording = {
                            id: Date.now().toString(),
                            blob: blob,
                            transcription: note.metadata?.transcription,
                            isTranscribing: false,
                            customTitle: note.title
                          };
                          setNewNote(prev => ({
                            ...prev,
                            voiceRecordings: [voiceRecording],
                            voice: blob
                          }));
                        })
                        .catch(err => console.error('Error converting voice attachment:', err));
                    }
                    
                    // Convert image URLs back to File objects if available
                    let imageFiles: File[] = [];
                    if (note.metadata?.imageUrls && note.metadata.imageUrls.length > 0) {
                      // Convert URLs back to files (this is a simplified approach)
                      Promise.all(
                        note.metadata.imageUrls.map((url, index) => 
                          fetch(url)
                            .then(response => response.blob())
                            .then(blob => new File([blob], `image-${index}.jpg`, { type: blob.type || 'image/jpeg' }))
                        )
                      ).then(files => {
                        setNewNote(prev => ({
                          ...prev,
                          images: files
                        }));
                      }).catch(err => console.error('Error converting image URLs:', err));
                    }
                    
                    setNewNote({
                      title: note.title,
                      text: note.text,
                      categoryId: note.categoryId,
                      voice: null, // Will be set asynchronously if voice exists
                      voiceRecordings: [], // Will be set asynchronously if voice exists
                      transcription: note.metadata?.transcription || '',
                      images: [], // Will be set asynchronously if images exist
                      isTranscribingImages: false,
                      autoTranscribeImages: true,
                      autoTranscribeVoice: true
                    });
                    setEditingNoteId(note.id);
                    setFullscreenCreate(true);
                  }
                }}
              >
                {/* Gradient Border */}
                <div 
                  className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r opacity-80"
                  style={{ 
                    background: `linear-gradient(90deg, ${category?.color || '#fbbf24'}, ${category?.color || '#f59e0b'})` 
                  }}
                />
                
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-3 h-3 rounded-full shadow-sm"
                        style={{ backgroundColor: category?.color || '#fbbf24' }}
                      />
                      <span className="text-sm font-medium text-gray-600">
                        {category?.icon} {category?.name}
                      </span>
                      {isVoiceNote && (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (note.attachment) {
                                playVoiceNote(note.id, note.attachment);
                              }
                            }}
                            className="p-1.5 hover:bg-orange-100 rounded-lg transition-colors flex items-center"
                          >
                            {isPlaying ? (
                              <Pause className="w-4 h-4 text-orange-600" />
                            ) : (
                              <Play className="w-4 h-4 text-orange-600" />
                            )}
                          </button>
                          <span className="text-xs text-orange-600 font-medium">
                            {note.metadata?.isTranscribing ? 'Transcribing...' : 'Voice Note'}
                          </span>
                        </div>
                      )}
                      {note.metadata?.hasImage && (
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-blue-600 font-medium">
                            📷 {note.metadata.imageUrls?.length || 1} Image{(note.metadata.imageUrls?.length || 1) > 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div className={`flex items-center space-x-2 transition-opacity ${isExpanded ? 'opacity-100' : 'opacity-0'}`}>
                      {!isEditing && (
                        <>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              const success = await copyToClipboard(note.id);
                              if (success) {
                                showCopyFeedback(e.target as HTMLElement);
                              }
                            }}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Copy ID for AI chat"
                          >
                            <StickyNote className="w-4 h-4 text-gray-500" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // Populate the creation modal with this note's content
                              // Convert voice attachment back to blob format if available
                              if (isVoiceNote && note.attachment) {
                                fetch(note.attachment)
                                  .then(response => response.blob())
                                  .then(blob => {
                                    const voiceRecording = {
                                      id: Date.now().toString(),
                                      blob: blob,
                                      transcription: note.metadata?.transcription,
                                      isTranscribing: false,
                                      customTitle: note.title
                                    };
                                    setNewNote(prev => ({
                                      ...prev,
                                      voiceRecordings: [voiceRecording],
                                      voice: blob
                                    }));
                                  })
                                  .catch(err => console.error('Error converting voice attachment:', err));
                              }
                              
                              // Convert image URLs back to File objects if available
                              if (note.metadata?.imageUrls && note.metadata.imageUrls.length > 0) {
                                Promise.all(
                                  note.metadata.imageUrls.map((url, index) => 
                                    fetch(url)
                                      .then(response => response.blob())
                                      .then(blob => new File([blob], `image-${index}.jpg`, { type: blob.type || 'image/jpeg' }))
                                  )
                                ).then(files => {
                                  setNewNote(prev => ({
                                    ...prev,
                                    images: files
                                  }));
                                }).catch(err => console.error('Error converting image URLs:', err));
                              }
                              
                              setNewNote({
                                title: note.title,
                                text: note.text,
                                categoryId: note.categoryId,
                                voice: null, // Will be set asynchronously if voice exists
                                voiceRecordings: [], // Will be set asynchronously if voice exists
                                transcription: note.metadata?.transcription || '',
                                images: [], // Will be set asynchronously if images exist
                                isTranscribingImages: false,
                                autoTranscribeImages: true,
                                autoTranscribeVoice: true
                              });
                              setEditingNoteId(note.id);
                              setFullscreenCreate(true);
                            }}
                            className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                            title="Edit in Fullscreen"
                          >
                            <Maximize2 className="w-4 h-4 text-blue-600" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditing(note);
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
                          deleteNote(note.id);
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
                      <textarea
                        ref={textareaRef}
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="w-full p-4 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300 resize-none overflow-hidden"
                        placeholder="Write your thoughts..."
                        autoFocus
                      />
                      <div className="flex space-x-3">
                        <button
                          onClick={() => saveEdit(note.id)}
                          className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all duration-300 flex items-center justify-center"
                        >
                          <Save className="w-4 h-4 mr-2" />
                          Save
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all duration-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Seamless Content Flow */}
                      <div className="space-y-6">
                        {/* Content Preview */}
                        <div className="space-y-4">
                          {/* Note Title */}
                          {note.title && (
                            <h3 
                              className="text-xl font-semibold text-gray-900 leading-tight"
                              style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
                            >
                              {note.title}
                            </h3>
                          )}
                          
                          {/* Note Text */}
                          <div 
                            className={`text-lg leading-relaxed transition-colors duration-300 text-gray-800 ${
                              isExpanded ? '' : 'line-clamp-3'
                            }`}
                            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
                          >
                            {note.text || 'No content yet...'}
                          </div>

                          {/* Read More/Less Toggle */}
                          {note.text && note.text.length > 150 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNoteClick(note.id);
                              }}
                              className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
                            >
                              {isExpanded ? 'Show less' : 'Read more...'}
                            </button>
                        )}

                          {/* Note Images Preview - Always show but small */}
                        {note.metadata?.imageUrls && note.metadata.imageUrls.length > 0 && (
                            <div className="space-y-2">
                              <div className={`grid gap-2 ${
                                note.metadata.imageUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
                          }`}>
                            {note.metadata.imageUrls.slice(0, isExpanded ? undefined : 2).map((imageUrl, index) => (
                              <div key={index} className="relative group">
                                <img
                                  src={imageUrl}
                                      alt={`Note image ${index + 1}`}
                                      className={`w-full object-cover rounded-lg shadow-sm transition-all duration-300 border border-gray-200 hover:shadow-md ${
                                        isExpanded ? 'max-h-32' : 'h-20'
                                      }`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        // Optional: Could open image in fullscreen here
                                      }}
                                    />
                                    {/* Small overlay on hover */}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all duration-200 rounded-lg"></div>
                                    </div>
                                ))}
                              </div>
                              {!isExpanded && note.metadata.imageUrls.length > 2 && (
                                <div className="text-xs text-center text-gray-500">
                                  +{note.metadata.imageUrls.length - 2} more images
                                  </div>
                                )}
                            </div>
                          )}
                        </div>

                        {/* Seamlessly Integrated Images */}
                        {false && newNote.images.length > 0 && (
                          <div className="space-y-4">
                            {newNote.images.map((image, index) => (
                              <div
                                key={index}
                                onClick={() => setSelectedImage(selectedImage === index ? null : index)}
                                className={`relative group cursor-pointer transition-all duration-300 ${
                                  selectedImage === index 
                                    ? 'ring-2 ring-blue-500 ring-offset-4' 
                                    : 'hover:ring-2 hover:ring-blue-300 hover:ring-offset-2'
                                }`}
                                draggable
                                onDragStart={(e) => {
                                  e.dataTransfer.setData('text/plain', index.toString());
                                }}
                              >
                                <img
                                  src={URL.createObjectURL(image)}
                                  alt={`Upload ${index + 1}`}
                                  className={`w-full max-w-2xl object-cover rounded-2xl shadow-lg transition-all duration-300 ${
                                    isDarkMode ? 'border border-gray-700' : 'border border-gray-200'
                                  }`}
                                  style={{ maxHeight: '400px' }}
                                />
                                
                                {/* Hover Controls */}
                                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex space-x-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeImage(index);
                                    }}
                                    className="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                                
                                {/* Extract Text Button - Only shows when selected */}
                                {selectedImage === index && (
                                  <div className="absolute top-4 left-4">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        extractImageText();
                                      }}
                                      disabled={newNote.isTranscribingImages}
                                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-lg text-sm transition-colors font-medium shadow-lg"
                                    >
                                      {newNote.isTranscribingImages ? 'Processing...' : 'Extract Text'}
                                    </button>
                                  </div>
                                )}
                                
                                {/* Image Caption */}
                                <div className="mt-2">
                                  <input
                                    type="text"
                                    placeholder="Add a caption..."
                                    onClick={(e) => e.stopPropagation()}
                                    className={`w-full text-sm bg-transparent border-none outline-none transition-colors duration-300 ${
                                      isDarkMode 
                                        ? 'text-gray-400 placeholder-gray-600' 
                                        : 'text-gray-600 placeholder-gray-400'
                                    }`}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Voice Note Integration */}
                        {isVoiceNote && note.attachment && (
                          <div className="p-4 bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-xl transition-all duration-300">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div>
                                  <span className="text-sm font-semibold text-orange-800">
                                    Voice Recording
                                </span>
                                  {note.metadata?.isTranscribing && (
                                    <div className="text-xs text-orange-600 mt-1">
                                      Processing audio...
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  playVoiceNote(note.id, note.attachment!);
                                }}
                                className={`px-4 py-2 rounded-xl transition-all duration-300 flex items-center space-x-2 transform hover:scale-105 ${
                                  isPlaying 
                                    ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg' 
                                    : 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg hover:shadow-xl'
                                }`}
                              >
                                {isPlaying ? (
                                  <>
                                    <Pause className="w-4 h-4" />
                                    <span className="font-medium">Pause</span>
                                  </>
                                ) : (
                                  <>
                                    <Play className="w-4 h-4" />
                                    <span className="font-medium">Play</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Show image count if more than displayed - REMOVED since images show directly */}

                        {/* Record Button */}
                        {false && !isRecording && (
                          <button
                            onClick={handleVoiceNote}
                            className={`p-2 rounded-lg transition-colors ${
                              isDarkMode 
                                ? 'hover:bg-gray-700 text-gray-300' 
                                : 'hover:bg-gray-100 text-gray-600'
                            }`}
                            title="Record Voice"
                          >
                            <Mic className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                  
                  {/* Footer */}
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                    <span className="text-xs text-gray-500">
                      {new Date(note.updatedAt).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                    {isExpanded && (
                      <span className="text-xs text-gray-400">
                        {note.text.split(' ').length} words
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {sortedNotes.length === 0 && (
          <div className="text-center py-20">
            <div className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-xl border border-white/30 p-12 max-w-md mx-auto">
              <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <StickyNote className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-4">No notes yet</h3>
              <p className="text-gray-600 mb-8 leading-relaxed">
                {searchQuery || selectedCategory !== 'all' 
                  ? 'Try adjusting your filters to find what you\'re looking for'
                  : 'Start capturing your thoughts, ideas, and inspirations'
                }
              </p>
              <button
                onClick={() => setShowAddForm(true)}
                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-8 py-4 rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-lg"
              >
                <Plus className="w-5 h-5 mr-3 inline" />
                Create Your First Note
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Revolutionary Add Note Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/30 max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-yellow-500 to-orange-500 p-6 text-white flex-shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold">New Note</h3>
                <div className="flex items-center space-x-2">
                  {/* Extract Button - Shows when voice recording or image is selected */}
                  {(selectedVoiceRecording || selectedImage !== null) && (
                    <button
                      onClick={() => {
                        if (selectedVoiceRecording) {
                          extractVoiceText(selectedVoiceRecording);
                        } else if (selectedImage !== null) {
                          extractImageText();
                        }
                      }}
                      disabled={
                        (selectedVoiceRecording && newNote.voiceRecordings.find(r => r.id === selectedVoiceRecording)?.isTranscribing) ||
                        (selectedImage !== null && newNote.isTranscribingImages)
                      }
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-lg text-sm font-medium transition-colors shadow-lg"
                    >
                      {(selectedVoiceRecording && newNote.voiceRecordings.find(r => r.id === selectedVoiceRecording)?.isTranscribing) ||
                       (selectedImage !== null && newNote.isTranscribingImages) 
                        ? 'Processing...' 
                        : 'Extract Text'
                      }
                    </button>
                  )}
                  
                  <button
                    onClick={() => setFullscreenCreate(true)}
                    className="p-2 hover:bg-white/25 rounded-xl transition-all duration-200 ease-in-out transform hover:scale-110"
                    title="Fullscreen"
                  >
                    <Maximize2 className="w-6 h-6" />
                  </button>
                  <button
                    onClick={() => {
                      setShowAddForm(false);
                      setEditingNoteId(null);
                    }}
                    className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </div>
            
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-5 space-y-5">
              {/* Note Title */}
              <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Title (optional)
                </label>
                <input
                  type="text"
                  value={newNote.title}
                  onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                  placeholder="Give your note a title..."
                  className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300"
                />
              </div>

              {/* Note Content */}
              <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                  What's on your mind?
                </label>
                <textarea
                  value={newNote.text}
                    onChange={(e) => setNewNote(prev => ({ ...prev, text: e.target.value }))}
                    placeholder="Write your thoughts, add images, record voice..."
                    rows={5}
                    className={`w-full px-4 py-4 bg-gray-50/50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300 resize-none text-gray-800 placeholder-gray-400`}
                  style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
                  autoFocus
                />
              </div>

              {/* Voice Recording Section */}
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Voice Recording
                  </label>
                  
                  {/* Voice Recording Controls */}
                  <div className="bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-2xl p-4 space-y-3">
                    {/* Recording Button */}
                    <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={handleVoiceNote}
                      disabled={isTranscribing}
                        className={`flex-1 px-6 py-3 rounded-xl flex items-center justify-center transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] ${
                        isRecording 
                            ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-xl animate-pulse' 
                            : 'bg-gradient-to-r from-orange-500 to-yellow-500 text-white hover:from-orange-600 hover:to-yellow-600 shadow-lg hover:shadow-xl'
                      }`}
                    >
                      {isRecording ? (
                        <>
                            <div className="w-3 h-3 bg-white rounded-full mr-3 animate-pulse" />
                            <MicOff className="w-5 h-5 mr-2" />
                            <span className="font-semibold">Stop Recording</span>
                        </>
                      ) : (
                        <>
                            <Mic className="w-5 h-5 mr-2" />
                            <span className="font-semibold">
                          {newNote.voiceRecordings.length > 0 ? 'Record Another' : 'Start Recording'}
                            </span>
                        </>
                      )}
                    </button>
                    </div>

                    {/* Auto-transcribe Voice Checkbox */}
                    <div className="flex items-center space-x-3 p-3 bg-white/60 rounded-xl border border-orange-300/50">
                      <input
                        type="checkbox"
                        id="autoTranscribeVoice"
                        checked={newNote.autoTranscribeVoice}
                        onChange={(e) => setNewNote(prev => ({ ...prev, autoTranscribeVoice: e.target.checked }))}
                        className="w-4 h-4 rounded text-orange-500 focus:ring-orange-500 border-orange-300"
                      />
                      <label htmlFor="autoTranscribeVoice" className="text-sm text-orange-800 font-medium flex items-center">
                        <span className="mr-2">🤖</span>
                        Auto-transcribe voice recordings when saving
                      </label>
                  </div>
                  
                    {/* Voice Recordings List */}
                  {newNote.voiceRecordings.length > 0 && (
                    <div className="space-y-2">
                        <div className="text-sm font-medium text-gray-600 flex items-center">
                          <span className="mr-2">🎵</span>
                          Recorded Audio ({newNote.voiceRecordings.length})
                        </div>
                        
                      {newNote.voiceRecordings.map((recording, index) => (
                          <div 
                            key={recording.id} 
                            onClick={() => setSelectedVoiceRecording(selectedVoiceRecording === recording.id ? null : recording.id)}
                            className={`relative p-3 rounded-xl border-2 transition-all duration-300 cursor-pointer transform hover:scale-[1.01] ${
                              selectedVoiceRecording === recording.id
                                ? 'bg-orange-100 border-orange-400 shadow-lg ring-2 ring-orange-300'
                                : 'bg-white/80 border-orange-200/70 hover:bg-orange-50 hover:border-orange-300'
                            }`}
                          >
                            <div className="flex items-center space-x-3">
                              <div className="w-3 h-3 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-full shadow-sm" />
                              <div className="flex-1">
                                <input
                                  type="text"
                                  value={recording.customTitle || `Voice Note ${index + 1}`}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    setNewNote(prev => ({
                                      ...prev,
                                      voiceRecordings: prev.voiceRecordings.map(r => 
                                        r.id === recording.id ? { ...r, customTitle: e.target.value } : r
                                      )
                                    }));
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className={`font-semibold bg-transparent border-none outline-none text-base ${
                                    selectedVoiceRecording === recording.id ? 'text-orange-800' : 'text-gray-700'
                                  } hover:bg-white/40 rounded px-2 py-1 transition-colors w-full`}
                                  placeholder={`Voice Note ${index + 1}`}
                                  onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    const input = e.target as HTMLInputElement;
                                    input.focus();
                                    input.select();
                                  }}
                                />
                                {recording.isTranscribing && (
                                  <div className="text-sm text-orange-600 mt-1 flex items-center">
                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                    Processing audio...
                                  </div>
                                )}
                                {selectedVoiceRecording === recording.id && (
                                  <div className="text-xs text-orange-600 mt-1 flex items-center">
                                    <span className="mr-1">✨</span>
                                    Selected for extraction
                                  </div>
                                )}
                              </div>
                            
                            <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeVoiceRecording(recording.id);
                                }}
                              disabled={recording.isTranscribing}
                                className="p-2 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white rounded-full transition-all duration-200 opacity-70 hover:opacity-100 transform hover:scale-110"
                                title="Remove recording"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Image Upload Section */}
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Images
                  </label>
                  
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 space-y-3">
                    {/* Upload Button */}
                    <div className="flex space-x-3">
                    <label 
                      htmlFor="imageUpload" 
                        className="flex-1 px-6 py-4 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl flex items-center justify-center transition-all duration-300 shadow-lg hover:from-blue-600 hover:to-indigo-600 cursor-pointer transform hover:scale-[1.02] hover:shadow-xl"
                    >
                        <Camera className="w-5 h-5 mr-2" />
                      {newNote.isTranscribingImages ? (
                        <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            <span className="font-semibold">Processing Images...</span>
                        </>
                      ) : (
                          <span className="font-semibold">
                            {newNote.images.length > 0 ? 'Add More Images' : 'Choose Images'}
                          </span>
                      )}
                    </label>
                  </div>
                  
                  <input
                    type="file"
                    id="imageUpload"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={newNote.isTranscribingImages}
                    multiple
                  />
                  
                    {/* Auto-transcribe Images Checkbox */}
                    <div className="flex items-center space-x-3 p-3 bg-white/60 rounded-xl border border-blue-300/50">
                    <input
                      type="checkbox"
                      id="autoTranscribeImages"
                      checked={newNote.autoTranscribeImages}
                      onChange={(e) => setNewNote(prev => ({ ...prev, autoTranscribeImages: e.target.checked }))}
                        className="w-4 h-4 rounded text-blue-500 focus:ring-blue-500 border-blue-300"
                    />
                      <label htmlFor="autoTranscribeImages" className="text-sm text-blue-800 font-medium flex items-center">
                        <span className="mr-2">🤖</span>
                      Auto-transcribe text from images when saving
                    </label>
                  </div>

                  {/* Image Previews */}
                  {newNote.images.length > 0 && (
                      <div className="space-y-3">
                        <div className="text-sm font-medium text-gray-600 flex items-center">
                          <span className="mr-2">🖼️</span>
                          Selected Images ({newNote.images.length})
                        </div>
                        
                    <div className="grid grid-cols-2 gap-3">
                      {newNote.images.map((image, index) => (
                            <div 
                              key={index} 
                              onClick={() => setSelectedImage(selectedImage === index ? null : index)}
                              className={`relative group cursor-pointer transition-all duration-300 transform hover:scale-[1.02] ${
                                selectedImage === index 
                                  ? 'ring-2 ring-blue-500 ring-offset-2 shadow-lg' 
                                  : 'hover:ring-2 hover:ring-blue-300 hover:ring-offset-1'
                              }`}
                            >
                          <img
                            src={URL.createObjectURL(image)}
                            alt={`Upload ${index + 1}`}
                                className="w-full h-24 object-cover rounded-xl border-2 border-blue-200"
                          />
                              
                              {selectedImage === index && (
                                <div className="absolute inset-0 bg-blue-500/20 rounded-xl flex items-center justify-center">
                                  <div className="bg-blue-500 text-white px-2 py-1 rounded-lg text-xs font-medium">
                                    ✨ Selected
                                  </div>
                                </div>
                              )}
                              
                          <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeImage(index);
                                }}
                                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-red-600 transform hover:scale-110"
                          >
                            <X className="w-3 h-3" />
                          </button>
                              
                          <div className="absolute bottom-1 left-1 bg-black/50 text-white text-xs px-1 rounded">
                            {image.name.length > 15 ? image.name.substring(0, 12) + '...' : image.name}
                          </div>
                        </div>
                      ))}
                        </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Category Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Category
                </label>
                <select
                  value={newNote.categoryId}
                  onChange={(e) => setNewNote({ ...newNote, categoryId: e.target.value })}
                  className="w-full px-4 py-4 bg-gray-50/50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300"
                >
                  {categories.map((category: Category) => (
                    <option key={category.id} value={category.id}>
                      {category.icon} {category.name}
                    </option>
                  ))}
                </select>
                </div>
              </div>
            </div>
            
            {/* Fixed Footer */}
            <div className="bg-gray-50/50 p-4 flex space-x-4 flex-shrink-0 border-t border-gray-200/50">
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setEditingNoteId(null);
                }}
                className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-2xl hover:bg-gray-200 transition-all duration-300 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleAddNote}
                disabled={!newNote.text.trim() && !newNote.voice && !newNote.images.length}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl hover:from-blue-600 hover:to-blue-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 shadow-lg font-semibold"
              >
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notion-Style Fullscreen Creation Modal */}
      {fullscreenCreate && (
        <div className={`fixed inset-0 z-50 flex transition-all duration-300 ${
          isDarkMode ? 'bg-gray-900' : 'bg-white'
        }`}>
          {/* Main Content Area */}
          <div 
            className="flex flex-col flex-1 transition-all duration-300"
            style={{ 
              marginRight: showAIAssistant && !isAiSidebarCollapsed ? `${aiSidebarWidth}px` : '0px' 
            }}
          >
          {/* Minimal Header */}
          <div className={`border-b px-6 py-4 flex items-center justify-between transition-colors duration-300 ${
            isDarkMode 
              ? 'bg-gray-800/50 border-gray-700' 
              : 'bg-gray-50/50 border-gray-200'
          }`}>
            <div className="flex items-center space-x-4">
              <button
                  onClick={() => {
                    setFullscreenCreate(false);
                    setEditingNoteId(null);
                    setShowAIAssistant(false);
                  }}
                className={`p-2 rounded-lg transition-colors ${
                  isDarkMode 
                    ? 'hover:bg-gray-700 text-gray-300' 
                    : 'hover:bg-gray-200 text-gray-600'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
                
                {editingNoteId ? (
                  // Show commands when editing existing note
              <div className={`text-sm font-medium ${
                isDarkMode ? 'text-gray-300' : 'text-gray-600'
              }`}>
                    Press '/' for commands • Command / for AI chat
              </div>
                ) : (
                  // Show instructions when creating new note
                  <div className={`text-sm font-medium ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                    Press '/' for commands • Command / for AI chat
                  </div>
                )}
            </div>
            
            <div className="flex items-center space-x-3">
                {/* Extract Button - Shows when voice recording or image is selected */}
                {(selectedVoiceRecording || selectedImage !== null) && (
                    <button
                    onClick={() => {
                      if (selectedVoiceRecording) {
                        extractVoiceText(selectedVoiceRecording);
                      } else if (selectedImage !== null) {
                        extractImageText();
                      }
                    }}
                    disabled={
                      (selectedVoiceRecording && newNote.voiceRecordings.find(r => r.id === selectedVoiceRecording)?.isTranscribing) ||
                      (selectedImage !== null && newNote.isTranscribingImages)
                    }
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-lg text-sm font-medium transition-colors shadow-lg"
                    >
                    {(selectedVoiceRecording && newNote.voiceRecordings.find(r => r.id === selectedVoiceRecording)?.isTranscribing) ||
                     (selectedImage !== null && newNote.isTranscribingImages) 
                      ? 'Processing...' 
                      : 'Extract Text'
                    }
                    </button>
                )}

                {editingNoteId ? (
                  // Show date and edit button when editing existing note
                  (() => {
                    const editingNote = items.find(item => item.id === editingNoteId);
                    return (
                      <>
                        <span className={`text-sm ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          {editingNote && new Date(editingNote.updatedAt).toLocaleDateString('en-US', { 
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long', 
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                <button
                          onClick={() => {
                            if (editingNote) {
                              setFullscreenCreate(false);
                              setEditingNoteId(null);
                              setShowAIAssistant(false);
                              startEditing(editingNote);
                            }
                          }}
                          className="p-2 hover:bg-yellow-100 rounded-lg transition-colors"
                          title="Edit in card view"
                        >
                          <Edit3 className="w-5 h-5 text-yellow-600" />
                </button>
                      </>
                    );
                  })()
                ) : (
                  // Show current date when creating new note
              <span className={`text-sm ${
                isDarkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>
                {new Date().toLocaleDateString('en-US', { 
                  weekday: 'long',
                  month: 'long', 
                  day: 'numeric'
                })}
              </span>
                )}
              
              <button
                onClick={handleAddNote}
                disabled={!newNote.text.trim() && !newNote.voice && !newNote.images.length}
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-gray-300 disabled:to-gray-400 text-white rounded-lg disabled:cursor-not-allowed transition-all"
              >
                  {editingNoteId ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
          
          {/* Notion-Style Content Area */}
          <div className="flex-1 overflow-y-auto">
              <div className="max-w-4xl mx-auto px-12 py-16 pb-32">
              {/* Title Field */}
              <input
                type="text"
                value={editingNoteId ? (() => {
                  const editingNote = items.find(item => item.id === editingNoteId);
                  return editingNote?.title || '';
                })() : newNote.title}
                onChange={(e) => {
                  if (editingNoteId) {
                    // Update existing note title directly in items state
                    setItems(prevItems => prevItems.map(item => 
                      item.id === editingNoteId 
                        ? { ...item, title: e.target.value, updatedAt: new Date() }
                        : item
                    ));
                  } else {
                    // Update new note title
                    setNewNote({ ...newNote, title: e.target.value });
                  }
                }}
                placeholder="Untitled"
                className={`w-full text-5xl font-bold bg-transparent border-none outline-none mb-8 transition-colors duration-300 ${
                  isDarkMode 
                    ? 'text-gray-100 placeholder-gray-500' 
                    : 'text-gray-900 placeholder-gray-400'
                }`}
                style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
              />
              
              {/* Seamless Content Flow */}
              <div className="space-y-6">
                {/* Text Content */}
                <textarea
                  value={editingNoteId ? (() => {
                    const editingNote = items.find(item => item.id === editingNoteId);
                    return editingNote?.text || '';
                  })() : newNote.text}
                  onChange={(e) => {
                    if (editingNoteId) {
                      // Update existing note directly in items state
                      setItems(prevItems => prevItems.map(item => 
                        item.id === editingNoteId 
                          ? { ...item, text: e.target.value, updatedAt: new Date() }
                          : item
                      ));
                    } else {
                      // Update new note
                      handleTextChange(e.target.value);
                    }
                  }}
                  placeholder="Press '/' for commands, drag images anywhere, record voice..."
                  className={`w-full text-lg leading-relaxed bg-transparent border-none outline-none resize-none min-h-[60vh] transition-colors duration-300 ${
                    isDarkMode 
                      ? 'text-gray-200 placeholder-gray-500' 
                      : 'text-gray-800 placeholder-gray-400'
                  }`}
                  style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
                  data-fullscreen="true"
                  autoFocus
                />

                {/* Seamlessly Integrated Images */}
                {newNote.images.length > 0 && (
                  <div className="space-y-4">
                    {newNote.images.map((image, index) => (
                      <div
                        key={index}
                          onClick={() => setSelectedImage(selectedImage === index ? null : index)}
                          className={`relative group cursor-pointer transition-all duration-300 ${
                            selectedImage === index 
                              ? 'ring-2 ring-blue-500 ring-offset-4' 
                              : 'hover:ring-2 hover:ring-blue-300 hover:ring-offset-2'
                          }`}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', index.toString());
                        }}
                      >
                        <img
                          src={URL.createObjectURL(image)}
                          alt={`Upload ${index + 1}`}
                          className={`w-full max-w-2xl object-cover rounded-2xl shadow-lg transition-all duration-300 ${
                            isDarkMode ? 'border border-gray-700' : 'border border-gray-200'
                          }`}
                          style={{ maxHeight: '400px' }}
                        />
                        
                        {/* Hover Controls */}
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex space-x-2">
                          <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeImage(index);
                              }}
                            className="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                          
                          {/* Extract Text Button - Only shows when selected */}
                          {selectedImage === index && (
                            <div className="absolute top-4 left-4">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  extractImageText();
                                }}
                                disabled={newNote.isTranscribingImages}
                                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-lg text-sm transition-colors font-medium shadow-lg"
                              >
                                {newNote.isTranscribingImages ? 'Processing...' : 'Extract Text'}
                              </button>
                            </div>
                          )}
                        
                        {/* Image Caption */}
                        <div className="mt-2">
                          <input
                            type="text"
                            placeholder="Add a caption..."
                              onClick={(e) => e.stopPropagation()}
                            className={`w-full text-sm bg-transparent border-none outline-none transition-colors duration-300 ${
                              isDarkMode 
                                ? 'text-gray-400 placeholder-gray-600' 
                                : 'text-gray-600 placeholder-gray-400'
                            }`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Voice Recording Integrated */}
                {(newNote.voiceRecordings.length > 0 || isRecording) && (
                  <div className={`p-6 rounded-2xl border transition-all duration-300 ${
                    isDarkMode 
                      ? 'bg-yellow-900/20 border-yellow-800/30' 
                      : 'bg-yellow-50 border-yellow-200'
                  }`}>
                    <div className="space-y-3">
                      {/* Recording Status */}
                      {isRecording && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                            <span className={`font-medium ${
                              isDarkMode ? 'text-yellow-300' : 'text-yellow-800'
                            }`}>
                              Recording in progress...
                            </span>
                          </div>
                          
                          <button
                            onClick={handleVoiceNote}
                            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-all duration-300 flex items-center space-x-2"
                          >
                            <MicOff className="w-4 h-4" />
                            <span>Stop</span>
                          </button>
                        </div>
                      )}

                      {/* Existing Recordings */}
                      {newNote.voiceRecordings.map((recording, index) => (
                          <div 
                            key={recording.id} 
                            onClick={() => setSelectedVoiceRecording(selectedVoiceRecording === recording.id ? null : recording.id)}
                            className={`relative p-4 rounded-xl border transition-all duration-300 cursor-pointer ${
                              selectedVoiceRecording === recording.id
                                ? 'bg-yellow-100 border-yellow-300 shadow-md'
                                : 'bg-white/30 border-yellow-200/50 hover:bg-white/50'
                            }`}
                          >
                            <div className="flex items-center space-x-4">
                              <div className="w-4 h-4 bg-yellow-500 rounded-full shadow-sm" />
                              <div className="flex-1">
                                <input
                                  type="text"
                                  value={recording.customTitle || `Voice Note ${index + 1}`}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    setNewNote(prev => ({
                                      ...prev,
                                      voiceRecordings: prev.voiceRecordings.map(r => 
                                        r.id === recording.id ? { ...r, customTitle: e.target.value } : r
                                      )
                                    }));
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className={`font-medium bg-transparent border-none outline-none text-lg ${
                              isDarkMode ? 'text-yellow-300' : 'text-yellow-800'
                                  } focus:bg-white/20 rounded px-2 py-1 transition-colors`}
                                  placeholder={`Voice Note ${index + 1}`}
                                  onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    const input = e.target as HTMLInputElement;
                                    input.focus();
                                    input.select();
                                  }}
                                />
                                {recording.isTranscribing && (
                                  <div className={`text-sm ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'} mt-1`}>
                                    Processing audio...
                                  </div>
                                )}
                          </div>
                          
                            <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeVoiceRecording(recording.id);
                                }}
                              disabled={recording.isTranscribing}
                                className="p-2 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white rounded-lg transition-colors opacity-70 hover:opacity-100"
                                title="Remove recording"
                              >
                                <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Floating Toolbar */}
          <div className={`fixed bottom-8 left-1/2 flex items-center space-x-2 px-6 py-3 rounded-2xl shadow-2xl backdrop-blur-lg border transition-all duration-300 ${
            isDarkMode 
              ? 'bg-gray-800/90 border-gray-700/50' 
              : 'bg-white/90 border-gray-200/50'
            }`}
              style={{ 
                transform: showAIAssistant && !isAiSidebarCollapsed 
                  ? `translateX(calc(-50% - ${aiSidebarWidth/2}px))` 
                  : 'translateX(-50%)'
              }}
            >
            {/* Stats */}
            <div className={`flex items-center space-x-4 text-sm mr-4 ${
              isDarkMode ? 'text-gray-400' : 'text-gray-500'
            }`}>
              <span>{newNote.text.split(' ').filter(w => w.trim()).length} words</span>
              {newNote.images.length > 0 && <span>{newNote.images.length} images</span>}
              {newNote.voiceRecordings.length > 0 && <span>{newNote.voiceRecordings.length} voice recordings</span>}
            </div>
            
            <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />
            
            {/* Quick Actions */}
            <label 
              htmlFor="imageUploadFS" 
              className={`p-2 rounded-lg transition-colors cursor-pointer ${
                isDarkMode 
                  ? 'hover:bg-gray-700 text-gray-300' 
                  : 'hover:bg-gray-100 text-gray-600'
              }`}
              title="Add Images"
            >
              <Camera className="w-5 h-5" />
            </label>
            <input
              type="file"
              id="imageUploadFS"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              multiple
            />
            
              <button
                onClick={handleVoiceNote}
                className={`p-2 rounded-lg transition-colors ${
                  isDarkMode 
                    ? 'hover:bg-gray-700 text-gray-300' 
                    : 'hover:bg-gray-100 text-gray-600'
                }`}
                title="Record Voice"
              >
                <Mic className="w-5 h-5" />
              </button>

            <select
              value={newNote.categoryId}
              onChange={(e) => setNewNote({ ...newNote, categoryId: e.target.value })}
              className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-gray-200' 
                  : 'bg-white border-gray-300 text-gray-700'
              }`}
            >
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.icon} {category.name}
                </option>
              ))}
            </select>
          </div>
        </div>

          {/* AI Assistant Sidebar */}
          {showAIAssistant && (
            <AIAssistant
              isOpen={showAIAssistant}
              onClose={() => setShowAIAssistant(false)}
              categories={categories}
              items={items}
              onAddItem={(item) => setItems(prev => [...prev, item])}
              onRefreshItems={() => {}}
              currentView="notes"
              isSidebarMode={true}
              sidebarWidth={aiSidebarWidth}
              isCollapsed={isAiSidebarCollapsed}
              onResize={setAiSidebarWidth}
              onToggleCollapse={() => setIsAiSidebarCollapsed(!isAiSidebarCollapsed)}
              // Pass note context for real-time editing
              currentNoteContent={editingNoteId ? (() => {
                const editingNote = items.find(item => item.id === editingNoteId);
                return editingNote?.text || '';
              })() : newNote.text}
              currentNoteTitle={editingNoteId ? (() => {
                const editingNote = items.find(item => item.id === editingNoteId);
                return editingNote?.title || '';
              })() : newNote.title}
              onUpdateNoteContent={(content) => {
                if (editingNoteId) {
                  // Update existing note in real-time
                  setItems(prevItems => prevItems.map(item => 
                    item.id === editingNoteId 
                      ? { ...item, text: content, updatedAt: new Date() }
                      : item
                  ));
                } else {
                  // Update new note
                  setNewNote(prev => ({ ...prev, text: content }));
                }
              }}
              onUpdateNoteTitle={(title) => {
                if (editingNoteId) {
                  // Update existing note title in real-time
                  setItems(prevItems => prevItems.map(item => 
                    item.id === editingNoteId 
                      ? { ...item, title: title, updatedAt: new Date() }
                      : item
                  ));
                } else {
                  // Update new note title
                  setNewNote(prev => ({ ...prev, title }));
                }
              }}
            />
                            )}
                      </div>
                    )}

      {/* Slash Command Menu */}
      {showSlashMenu && (
        <div 
          className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 py-2 min-w-64"
          style={{
            left: slashMenuPosition.x,
            top: slashMenuPosition.y,
          }}
        >
          {filteredCommands.map((command, index) => (
              <button
                key={command.id}
                onClick={() => executeSlashCommand(command)}
              className={`w-full px-4 py-2 text-left hover:bg-gray-100 transition-colors flex items-center space-x-3 ${
                index === selectedCommandIndex ? 'bg-gray-100' : ''
                }`}
              >
                <span className="text-lg">{command.icon}</span>
              <div>
                <div className="font-medium text-gray-900">{command.label}</div>
                <div className="text-sm text-gray-500">{command.description}</div>
                  </div>
              </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default GlobalNotes; 