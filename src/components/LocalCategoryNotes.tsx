import React, { useState, useRef, useEffect } from 'react';
import { StickyNote, Plus, Search, Mic, MicOff, Play, Pause, Camera, X, Edit3, Save, Maximize2, Trash2, FileText } from 'lucide-react';
import { Item, Category } from '../types';
import { voiceService, VoiceRecording } from '../services/voiceService';
import { AIService } from '../services/aiService';
import { chatService } from '../services/ChatService';
import AIAssistant from './AIAssistant';
import { getAudioUrl } from '../utils/audioStorage';
import { storeAudioBlob, getStoredAudioData } from '../utils/audioStorage';
import { storeImageFiles, getImageUrls, hasStoredImages, storedImagesToFiles } from '../utils/imageStorage';
import { hybridSyncService } from '../services/hybridSyncService';

interface LocalCategoryNotesProps {
  categoryId: string;
  items: Item[];
  setItems: React.Dispatch<React.SetStateAction<Item[]>>;
  categories: Category[];
  onAIAssistantToggle?: (isOpen: boolean) => void;
  isGlobalAIAssistantOpen?: boolean;
}

const LocalCategoryNotes: React.FC<LocalCategoryNotesProps> = ({ categoryId, items, setItems, categories, onAIAssistantToggle, isGlobalAIAssistantOpen }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [sortBy, setSortBy] = useState<'recent' | 'title'>('recent');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [expandedNote, setExpandedNote] = useState<string | null>(null);
  const [playingNote, setPlayingNote] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [currentRecording, setCurrentRecording] = useState<VoiceRecording | null>(null);
  const [shouldTranscribe, setShouldTranscribe] = useState(true);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [fullscreenCreate, setFullscreenCreate] = useState(false);
  
  // AI Assistant state
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [aiSidebarWidth, setAiSidebarWidth] = useState(Math.min(400, window.innerWidth / 2));
  const [isAiSidebarCollapsed, setIsAiSidebarCollapsed] = useState(false);
  
  const [newNote, setNewNote] = useState({
    title: '',
    text: '',
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

  // Get current category
  const category = categories.find((c: Category) => c.id === categoryId);

  // Filter notes to only show for this category
  const categoryNotes = items.filter(item => 
    item.categoryId === categoryId && (item.type === 'note' || item.type === 'voiceNote')
  );

  // Apply search and sort
  const filteredNotes = categoryNotes.filter(note => {
    const matchesSearch = !searchQuery || 
      note.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const sortedNotes = [...filteredNotes].sort((a, b) => {
    switch (sortBy) {
      case 'title':
        return a.title.localeCompare(b.title);
      case 'recent':
      default:
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    }
  });

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

  // Notify parent when AI Assistant state changes
  useEffect(() => {
    if (onAIAssistantToggle) {
      onAIAssistantToggle(showAIAssistant);
    }
  }, [showAIAssistant, onAIAssistantToggle]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Press 'N' to open fullscreen creation
      if (e.key === 'n' || e.key === 'N') {
        if (!showAddForm && !showAddModal && !expandedNote && !fullscreenCreate) {
          e.preventDefault();
          // Reset form state to ensure it's always a new note
          setNewNote({
            title: '',
            text: '',
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
          setEditingNoteId(null);
          setSelectedVoiceRecording(null);
          setSelectedImage(null);
          setShowSlashMenu(false);
          setSlashQuery('');
          setSelectedCommandIndex(0);
          setFullscreenCreate(true);
        }
      }
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
        setShowAddModal(false);
        setFullscreenCreate(false);
        setExpandedNote(null);
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
  }, [showAddForm, showAddModal, expandedNote, showSlashMenu, selectedCommandIndex, fullscreenCreate]);

  // Filter commands based on slash query
  const filteredCommands = slashCommands.filter(cmd =>
    cmd.label.toLowerCase().includes(slashQuery.toLowerCase()) ||
    cmd.description.toLowerCase().includes(slashQuery.toLowerCase())
  );

  // Execute slash command
  const executeSlashCommand = (command: any) => {
    command.action();
    setShowSlashMenu(false);
    setSlashQuery('');
    setSelectedCommandIndex(0);
  };

  const handleTextChange = (value: string) => {
    setNewNote({ ...newNote, text: value });
    
    // Handle slash commands
    const textarea = textareaRef.current;
    if (textarea && value.includes('/')) {
      const cursorPosition = textarea.selectionStart;
      const textBeforeCursor = value.substring(0, cursorPosition);
      const lastSlashIndex = textBeforeCursor.lastIndexOf('/');
      
      if (lastSlashIndex !== -1) {
        const textAfterSlash = textBeforeCursor.substring(lastSlashIndex + 1);
        
        // Check if it's a new slash command (no spaces before the slash or at start of line)
        const charBeforeSlash = lastSlashIndex > 0 ? textBeforeCursor[lastSlashIndex - 1] : '\n';
        const isNewCommand = charBeforeSlash === '\n' || charBeforeSlash === ' ';
        
        if (isNewCommand && !textAfterSlash.includes(' ')) {
          setSlashQuery(textAfterSlash);
          setSelectedCommandIndex(0);
          setShowSlashMenu(true);
          
          // Position the menu
          const rect = textarea.getBoundingClientRect();
          const lineHeight = 24; // Approximate line height
          const lines = textBeforeCursor.split('\n').length - 1;
          setSlashMenuPosition({
            x: rect.left + 10,
            y: rect.top + (lines * lineHeight) + 30
          });
        } else {
          setShowSlashMenu(false);
        }
      } else {
        setShowSlashMenu(false);
      }
    } else {
      setShowSlashMenu(false);
    }
  };

  const totalNotes = filteredNotes.length;

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setNewNote(prev => ({ ...prev, images: [...prev.images, ...files] }));
    
    if (newNote.autoTranscribeImages && files.length > 0) {
      setNewNote(prev => ({ ...prev, isTranscribingImages: true }));
      try {
        const aiService = new AIService();
        for (const file of files) {
          const result = await aiService.transcribeImage(file);
          if (result) {
            setNewNote(prev => ({ 
              ...prev, 
              text: prev.text + (prev.text ? '\n\n' : '') + `[Image: ${result}]` 
            }));
          }
        }
      } catch (error) {
        console.error('Error transcribing images:', error);
      } finally {
        setNewNote(prev => ({ ...prev, isTranscribingImages: false }));
      }
    }
  };

  const removeImage = (indexToRemove: number) => {
    setNewNote(prev => ({
      ...prev,
      images: prev.images.filter((_, index) => index !== indexToRemove)
    }));
  };

  const handleAddNote = () => {
    if (!newNote.text.trim() && !newNote.voice && !newNote.images.length && !newNote.voiceRecordings.length) return;

    const noteData: Partial<Item> = {
      id: editingNoteId || `note-${Date.now()}`,
      title: newNote.title || (newNote.text.length > 50 ? newNote.text.substring(0, 50) + '...' : newNote.text),
      text: newNote.text,
      type: newNote.voiceRecordings.length > 0 ? 'voiceNote' : 'note',
      categoryId: categoryId, // Use the current category
      createdAt: editingNoteId ? items.find(i => i.id === editingNoteId)?.createdAt || new Date() : new Date(),
      updatedAt: new Date(),
      metadata: {}
    };

    const noteId = noteData.id!;

    // Handle voice recordings with proper storage
    if (newNote.voiceRecordings.length > 0) {
      const primaryRecording = newNote.voiceRecordings[0];
      
      // Store audio in localStorage for persistence
      storeAudioBlob(noteId, primaryRecording.blob, 0).then(audioUrl => {
        const updatedNoteData = {
          ...noteData,
          attachment: audioUrl, // Use stored audio URL
          metadata: {
        ...noteData.metadata,
            transcription: primaryRecording.transcription,
            audioStorageId: noteId // Add storage ID for retrieval
          }
        };
        
        if (editingNoteId) {
          // Update existing note
          setItems(items.map(item => 
            item.id === editingNoteId 
              ? { ...item, ...updatedNoteData }
              : item
          ));
        } else {
          // Add new note
          setItems([...items, updatedNoteData as Item]);
        }
        
        // Trigger immediate sync after note is saved locally (with small delay)
        setTimeout(() => {
          hybridSyncService.manualSync().catch(error => {
            console.log('Background sync failed (note still saved locally):', error);
          });
        }, 500); // 500ms delay to ensure localStorage is updated
      });
    }

    // Handle images with proper storage
    if (newNote.images.length > 0) {
      storeImageFiles(noteId, newNote.images).then(storedImageUrls => {
                  const imageMetadata = {
        hasImage: true,
            imageCount: storedImageUrls.length, // Store count instead of URLs
            imageStorageId: noteId, // Add storage ID for retrieval
            imageUrls: undefined // Clear legacy URLs to prevent duplicates
          };
        
        // Update the note with image metadata
        setTimeout(() => {
          setItems(prevItems => prevItems.map(item => 
            item.id === noteId 
              ? { 
                  ...item,
                  metadata: {
                    ...item.metadata,
                    ...imageMetadata
                  }
                }
              : item
          ));
          
          // Trigger immediate sync after images are processed (with small delay)
          setTimeout(() => {
            hybridSyncService.manualSync().catch(error => {
              console.log('Background sync failed (note still saved locally):', error);
            });
          }, 500); // 500ms delay to ensure localStorage is updated
        }, 100);
      });
    }

    // Handle notes without voice or images
    if (newNote.voiceRecordings.length === 0 && newNote.images.length === 0) {
    if (editingNoteId) {
        // Update existing note without voice/images
      setItems(items.map(item => 
        item.id === editingNoteId 
          ? { ...item, ...noteData }
          : item
      ));
    } else {
        // Add new note without voice/images
      setItems([...items, noteData as Item]);
      }
      
      // Trigger immediate sync for text-only notes (with small delay)
      setTimeout(() => {
        hybridSyncService.manualSync().catch(error => {
          console.log('Background sync failed (note still saved locally):', error);
        });
      }, 500); // 500ms delay to ensure localStorage is updated
    }

    // Background transcription for voice notes
    if (newNote.voiceRecordings.length > 0 && newNote.autoTranscribeVoice) {
      newNote.voiceRecordings.forEach(recording => {
        if (!recording.transcription && !recording.isTranscribing) {
          handleBackgroundTranscription(noteData.id!, recording.blob);
        }
      });
    }

    // Background transcription for images
    if (newNote.images.length > 0 && newNote.autoTranscribeImages) {
      handleBackgroundImageTranscription(noteData.id!, newNote.images);
    }

    // Reset form
    setNewNote({
      title: '',
      text: '',
      voice: null,
      voiceRecordings: [],
      transcription: '',
      images: [],
      isTranscribingImages: false,
      autoTranscribeImages: true,
      autoTranscribeVoice: true
    });
    setEditingNoteId(null);
    setShowAddModal(false);
    setShowAddForm(false);
    setFullscreenCreate(false);
    setShowAIAssistant(false);
  };

  const handleBackgroundTranscription = async (noteId: string, voiceBlob: Blob) => {
    try {
      // Mark as transcribing
      setItems(prevItems => prevItems.map(item => 
        item.id === noteId 
          ? { 
              ...item, 
              metadata: { 
                ...item.metadata, 
                isTranscribing: true 
              } 
            }
          : item
      ));

      const result = await voiceService.transcribeAudio(voiceBlob);
      
      if (result && result.text) {
        setItems(prevItems => prevItems.map(item => 
          item.id === noteId 
            ? { 
                ...item, 
                text: item.text + (item.text ? '\n\n' : '') + `[Voice: ${result.text}]`,
                metadata: { 
                  ...item.metadata, 
                  transcription: result.text,
                  isTranscribing: false 
                },
                updatedAt: new Date()
              }
            : item
        ));
      }
    } catch (error) {
      console.error('Background transcription error:', error);
      setItems(prevItems => prevItems.map(item => 
        item.id === noteId 
          ? { 
              ...item, 
              metadata: { 
                ...item.metadata, 
                isTranscribing: false 
              } 
            }
          : item
      ));
    }
  };

  const handleBackgroundImageTranscription = async (noteId: string, imageFiles: File[]) => {
    try {
      setItems(prevItems => prevItems.map(item => 
        item.id === noteId 
          ? { 
              ...item, 
              metadata: { 
                ...item.metadata, 
                isTranscribingImages: true 
              } 
            }
          : item
      ));

      const aiService = new AIService();
      for (const file of imageFiles) {
        const result = await aiService.transcribeImage(file);
        if (result) {
          setItems(prevItems => prevItems.map(item => 
            item.id === noteId 
              ? { 
                  ...item, 
                  text: item.text + (item.text ? '\n\n' : '') + `[Image: ${result}]`,
                  updatedAt: new Date()
                }
              : item
          ));
        }
      }

      setItems(prevItems => prevItems.map(item => 
        item.id === noteId 
          ? { 
              ...item, 
              metadata: { 
                ...item.metadata, 
                isTranscribingImages: false 
              } 
            }
          : item
      ));
    } catch (error) {
      console.error('Background image transcription error:', error);
      setItems(prevItems => prevItems.map(item => 
        item.id === noteId 
          ? { 
              ...item, 
              metadata: { 
                ...item.metadata, 
                isTranscribingImages: false 
              } 
            }
          : item
      ));
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setAudioChunks(prev => [...prev, event.data]);
        }
      };
      
      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const stopRecording = async () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        const recordingId = Date.now().toString();
        
        setNewNote(prev => ({
          ...prev,
          voice: audioBlob,
          voiceRecordings: [...prev.voiceRecordings, {
            id: recordingId,
            blob: audioBlob,
            isTranscribing: shouldTranscribe,
            customTitle: `Voice Note ${prev.voiceRecordings.length + 1}`
          }]
        }));
        
        setAudioChunks([]);
        
        if (shouldTranscribe) {
          extractVoiceText(recordingId);
        }
      };
    }
  };

  const handleVoiceNote = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const extractVoiceText = async (recordingId: string) => {
    const recording = newNote.voiceRecordings.find(r => r.id === recordingId);
    if (!recording) return;

    setNewNote(prev => ({
      ...prev,
      voiceRecordings: prev.voiceRecordings.map(r => 
        r.id === recordingId ? { ...r, isTranscribing: true } : r
      )
    }));

    try {
      const result = await voiceService.transcribeAudio(recording.blob);
      
      if (result && result.text) {
        setNewNote(prev => ({
          ...prev,
          voiceRecordings: prev.voiceRecordings.map(r => 
            r.id === recordingId 
              ? { ...r, transcription: result.text, isTranscribing: false }
              : r
          ),
          text: prev.text + (prev.text ? '\n\n' : '') + `[Voice: ${result.text}]`
        }));
      }
    } catch (error) {
      console.error('Voice transcription error:', error);
      setNewNote(prev => ({
        ...prev,
        voiceRecordings: prev.voiceRecordings.map(r => 
          r.id === recordingId ? { ...r, isTranscribing: false } : r
        )
      }));
    }
  };

  const removeVoiceRecording = (recordingId: string) => {
    setNewNote(prev => ({
      ...prev,
      voiceRecordings: prev.voiceRecordings.filter(r => r.id !== recordingId)
    }));
  };

  const extractImageText = async () => {
    if (newNote.images.length === 0) return;
    
    setNewNote(prev => ({ ...prev, isTranscribingImages: true }));
    
    try {
      const aiService = new AIService();
      for (const image of newNote.images) {
        const result = await aiService.transcribeImage(image);
        if (result) {
          setNewNote(prev => ({ 
            ...prev, 
            text: prev.text + (prev.text ? '\n\n' : '') + `[Image: ${result}]` 
          }));
        }
      }
    } catch (error) {
      console.error('Error extracting image text:', error);
    } finally {
      setNewNote(prev => ({ ...prev, isTranscribingImages: false }));
    }
  };

  const generateAISummary = async () => {
    if (!newNote.text.trim()) return;
    
    try {
      const aiService = new AIService();
      const result = await aiService.generateSummary(newNote.text);
      if (result) {
        setNewNote(prev => ({ 
          ...prev, 
          text: prev.text + '\n\n## AI Summary\n' + result 
        }));
      }
    } catch (error) {
      console.error('Error generating summary:', error);
    }
  };

  const improveWithAI = async () => {
    if (!newNote.text.trim()) return;
    
    try {
      const aiService = new AIService();
      const result = await aiService.improveText(newNote.text);
      if (result) {
        setNewNote(prev => ({ ...prev, text: result }));
      }
    } catch (error) {
      console.error('Error improving text:', error);
    }
  };

  const playVoiceNote = (noteId: string, audioUrl: string) => {
    if (playingNote === noteId) {
      audioRef.current?.pause();
      setPlayingNote(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      
      // Get audio URL from localStorage first, fallback to provided URL
      const storedAudioUrl = getAudioUrl(noteId, audioUrl);
      
      if (!storedAudioUrl) {
        console.error('No audio URL available for note:', noteId);
        return;
      }
      
      const audio = new Audio(storedAudioUrl);
      audioRef.current = audio;
      setPlayingNote(noteId);
      
      audio.play();
      
      audio.onended = () => {
        setPlayingNote(null);
      };
      
      audio.onerror = () => {
        setPlayingNote(null);
        console.error('Error playing audio for note:', noteId);
      };
    }
  };

  const deleteNote = (noteId: string) => {
    setItems(items.filter(item => item.id !== noteId));
    if (expandedNote === noteId) setExpandedNote(null);
    if (editingNote === noteId) setEditingNote(null);
  };

  const startEditing = (note: Item) => {
    setEditingNote(note.id);
    setEditText(note.text);
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

  const openNoteForEditing = (note: Item) => {
    // Enhanced voice attachment recovery
    if (note.type === 'voiceNote' && (note.attachment || note.metadata?.audioStorageId)) {
      const audioStorageId = note.metadata?.audioStorageId || note.id;
      const storedAudioData = getStoredAudioData(audioStorageId);
      
      if (storedAudioData) {
        // Convert stored data URL back to blob
        fetch(storedAudioData.dataUrl)
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
          .catch(err => console.error('Error converting stored audio:', err));
      } else if (note.attachment) {
        // Fallback to fetching from attachment URL
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
    }
    
    // Enhanced image recovery with localStorage support
    if (note.metadata?.hasImage && note.metadata?.imageStorageId) {
      const imageStorageId = note.metadata.imageStorageId;
      
      if (hasStoredImages(imageStorageId)) {
        // Convert stored images back to File objects
        storedImagesToFiles(imageStorageId)
          .then(files => {
            setNewNote(prev => ({
              ...prev,
              images: files
            }));
          })
          .catch(err => console.error('Error converting stored images:', err));
      } else if (note.metadata?.imageUrls && note.metadata.imageUrls.length > 0) {
        // Fallback to fetching from image URLs (legacy support)
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
    }
    
    setNewNote({
      title: note.title,
      text: note.text,
      voice: null,
      voiceRecordings: [],
      transcription: note.metadata?.transcription || '',
      images: [],
      isTranscribingImages: false,
      autoTranscribeImages: true,
      autoTranscribeVoice: true
    });
    setEditingNoteId(note.id);
    setFullscreenCreate(true);
  };

  return (
    <div className="min-h-screen">
      {/* Notes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedNotes.length === 0 ? (
          <div className="col-span-full text-center py-20">
            <div className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-xl border border-white/30 p-12 max-w-md mx-auto">
              <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <FileText className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-4">No notes yet</h3>
              <p className="text-gray-600 leading-relaxed">
                Click the + button to add your first note for this category!
              </p>
            </div>
          </div>
        ) : (
          sortedNotes.map((note) => {
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
                    // Open in fullscreen edit mode
                    openNoteForEditing(note);
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
                            📷 {note.metadata.imageCount || 1} Image{(note.metadata.imageCount || 1) > 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div className={`flex items-center space-x-2 transition-opacity ${isExpanded ? 'opacity-100' : 'opacity-0'}`}>
                      {!isEditing && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openNoteForEditing(note);
                            }}
                            className="p-2 hover:bg-yellow-100 rounded-lg transition-colors"
                            title="Edit note"
                          >
                            <Edit3 className="w-4 h-4 text-yellow-600" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openNoteForEditing(note);
                            }}
                            className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                            title="View fullscreen"
                          >
                            <Maximize2 className="w-4 h-4 text-blue-600" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNote(note.id);
                            }}
                            className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                            title="Delete note"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  {isEditing ? (
                    <div className="space-y-4">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="w-full p-3 border border-gray-200 rounded-lg text-gray-800 resize-none"
                        rows={6}
                        autoFocus
                      />
                      <div className="flex space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            saveEdit(note.id);
                          }}
                          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center"
                        >
                          <Save className="w-4 h-4 mr-1" />
                          Save
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            cancelEdit();
                          }}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="min-h-[120px]">
                      <h3 className="font-semibold text-gray-800 mb-2 line-clamp-2">
                        {note.title || 'Untitled'}
                      </h3>
                      <p className={`text-gray-600 text-sm ${isExpanded ? '' : 'line-clamp-4'}`}>
                        {note.text}
                      </p>
                      
                      {/* Enhanced Images Display */}
                      {note.metadata?.hasImage && note.metadata?.imageStorageId && (
                        <div className="mt-3 space-y-2">
                          {(() => {
                            const storageId = note.metadata.imageStorageId;
                            const storedUrls = getImageUrls(storageId);
                            const imageCount = note.metadata.imageCount || storedUrls.length;
                            
                            if (storedUrls.length === 0) return null;
                            
                            return (
                              <>
                                <div className={`grid gap-2 ${
                                  storedUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
                                }`}>
                                  {storedUrls.slice(0, isExpanded ? undefined : 2).map((imageUrl, index) => (
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
                                        onError={(e) => {
                                          console.warn('Failed to load stored image:', imageUrl);
                                        }}
                                      />
                                      {/* Small overlay on hover */}
                                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all duration-200 rounded-lg"></div>
                                    </div>
                                  ))}
                                </div>
                                {!isExpanded && storedUrls.length > 2 && (
                                  <div className="text-xs text-center text-gray-500">
                                    +{storedUrls.length - 2} more images
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      )}
                      
                      {isExpanded && (
                        <div className="mt-4 text-xs text-gray-500">
                          {note.updatedAt instanceof Date && !isNaN(note.updatedAt.getTime())
                            ? note.updatedAt.toLocaleDateString('en-US', { 
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : 'Invalid date'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
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
                {/* Category Context */}
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl p-4 border border-gray-200">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: category?.color || '#fbbf24' }}
                    >
                      {category?.icon}
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-800">{category?.name}</h4>
                      <p className="text-sm text-gray-600">Creating note for this category</p>
                    </div>
                  </div>
                </div>

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
                    className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-all duration-300"
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
                    className="w-full px-4 py-4 bg-gray-50/50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-all duration-300 resize-none text-gray-800 placeholder-gray-400"
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
                        id="autoTranscribeVoiceLocal"
                        checked={newNote.autoTranscribeVoice}
                        onChange={(e) => setNewNote(prev => ({ ...prev, autoTranscribeVoice: e.target.checked }))}
                        className="w-4 h-4 rounded text-orange-500 focus:ring-orange-500 border-orange-300"
                      />
                      <label htmlFor="autoTranscribeVoiceLocal" className="text-sm text-orange-800 font-medium flex items-center">
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
                                />
                                {recording.isTranscribing && (
                                  <div className="text-sm text-orange-600 mt-1 flex items-center">
                                    <div className="w-3 h-3 mr-1 rounded-full bg-orange-500 animate-pulse" />
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
                        htmlFor="imageUploadModal" 
                        className="flex-1 px-6 py-4 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl flex items-center justify-center transition-all duration-300 shadow-lg hover:from-blue-600 hover:to-indigo-600 cursor-pointer transform hover:scale-[1.02] hover:shadow-xl"
                      >
                        <Camera className="w-5 h-5 mr-2" />
                        {newNote.isTranscribingImages ? (
                          <>
                            <div className="w-5 h-5 mr-2 rounded-full border-2 border-white border-t-transparent animate-spin" />
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
                      id="imageUploadModal"
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
                        id="autoTranscribeImagesLocal"
                        checked={newNote.autoTranscribeImages}
                        onChange={(e) => setNewNote(prev => ({ ...prev, autoTranscribeImages: e.target.checked }))}
                        className="w-4 h-4 rounded text-blue-500 focus:ring-blue-500 border-blue-300"
                      />
                      <label htmlFor="autoTranscribeImagesLocal" className="text-sm text-blue-800 font-medium flex items-center">
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
                              className={`relative group cursor-pointer transition-all duration-300 ${
                                selectedImage === index 
                                  ? 'ring-2 ring-blue-500 ring-offset-4' 
                                  : 'hover:ring-2 hover:ring-blue-300 hover:ring-offset-2'
                              }`}
                            >
                              <img
                                src={URL.createObjectURL(image)}
                                alt={`Upload ${index + 1}`}
                                className={`w-full max-w-2xl object-cover rounded-2xl shadow-lg transition-all duration-300 ${
                                  isDarkMode ? 'border border-gray-700' : 'border border-gray-200'
                                }`}
                                style={{ maxHeight: '400px' }}
                              />
                              
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
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
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
                className="flex-1 px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-2xl hover:from-yellow-600 hover:to-orange-600 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 shadow-lg font-semibold"
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
                
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: category?.color || '#fbbf24' }}
                  />
                  <span className={`text-sm font-medium ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    {category?.icon} {category?.name}
                  </span>
                </div>
                
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
                    Press 'N' for new note • Press '/' for commands • Command / for AI chat
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
                  className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 disabled:from-gray-300 disabled:to-gray-400 text-white rounded-lg disabled:cursor-not-allowed transition-all"
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
                    ref={textareaRef}
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
                        >
                          <img
                            src={URL.createObjectURL(image)}
                            alt={`Upload ${index + 1}`}
                            className={`w-full max-w-2xl object-cover rounded-2xl shadow-lg transition-all duration-300 ${
                              isDarkMode ? 'border border-gray-700' : 'border border-gray-200'
                            }`}
                            style={{ maxHeight: '400px' }}
                          />
                          
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
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Voice Recordings */}
                  {(newNote.voiceRecordings.length > 0 || isRecording) && (
                    <div className={`p-6 rounded-2xl border transition-all duration-300 ${
                      isDarkMode 
                        ? 'bg-yellow-900/20 border-yellow-800/30' 
                        : 'bg-yellow-50 border-yellow-200'
                    }`}>
                      <div className="space-y-3">
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

                        {newNote.voiceRecordings.map((recording, index) => (
                          <div 
                            key={recording.id} 
                            className="flex items-center justify-between p-4 bg-white/30 rounded-xl"
                          >
                            <div className="flex items-center space-x-4">
                              <div className="w-4 h-4 bg-yellow-500 rounded-full" />
                              <span className={`font-medium ${
                                isDarkMode ? 'text-yellow-300' : 'text-yellow-800'
                              }`}>
                                {recording.customTitle || `Voice Note ${index + 1}`}
                              </span>
                              {recording.isTranscribing && (
                                <span className="text-sm text-yellow-600">Processing...</span>
                              )}
                            </div>
                            
                            <button
                              onClick={(e) => removeVoiceRecording(recording.id)}
                              disabled={recording.isTranscribing}
                              className="p-2 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
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

      {/* Floating Action Button */}
      {!fullscreenCreate && !showAddForm && !showAIAssistant && (
        <button
          onClick={() => {
            // Reset form state to ensure it's always a new note
            setNewNote({
              title: '',
              text: '',
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
            setEditingNoteId(null);
            setSelectedVoiceRecording(null);
            setSelectedImage(null);
            setShowSlashMenu(false);
            setSlashQuery('');
            setSelectedCommandIndex(0);
            setUploadedImages([]);
            setShowAddForm(true);
          }}
          className="fixed bottom-8 right-8 w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-110 z-30 flex items-center justify-center"
          title="Create new note (Press 'N')"
        >
          <Plus className="w-8 h-8" />
        </button>
      )}
    </div>
  );
};

export default LocalCategoryNotes; 