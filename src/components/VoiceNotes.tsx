import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Play, Pause, Trash2, Download, Save, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { voiceService, VoiceRecording, TranscriptionResult, VoiceService } from '../services/voiceService';

interface VoiceNote {
  id: string;
  title: string;
  transcription: string;
  audioUrl: string;
  duration: number;
  confidence?: number;
  language?: string;
  category?: string;
  createdAt: Date;
  isPlaying?: boolean;
}

interface VoiceNotesProps {
  category?: string;
  onSaveNote?: (note: Omit<VoiceNote, 'id' | 'createdAt'>) => void;
}

const VoiceNotes: React.FC<VoiceNotesProps> = ({ category, onSaveNote }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [currentRecording, setCurrentRecording] = useState<VoiceRecording | null>(null);
  const [transcriptionResult, setTranscriptionResult] = useState<TranscriptionResult | null>(null);
  const [notes, setNotes] = useState<VoiceNote[]>([]);
  const [playingNoteId, setPlayingNoteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check browser support on mount
  useEffect(() => {
    if (!VoiceService.isSupported()) {
      setError('Voice recording is not supported in this browser. Please use a modern browser like Chrome, Firefox, or Safari.');
      return;
    }

    // Initialize microphone access
    const initializeMicrophone = async () => {
      try {
        await voiceService.initializeMicrophone();
        setIsInitialized(true);
        setError(null);
      } catch (err) {
        setError('Microphone access denied. Please allow microphone access and refresh the page.');
      }
    };

    initializeMicrophone();

    // Cleanup on unmount
    return () => {
      voiceService.cleanup();
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, []);

  // Update recording duration
  useEffect(() => {
    if (isRecording) {
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration(voiceService.getCurrentDuration());
      }, 100);
    } else {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    }

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, [isRecording]);

  const startRecording = async () => {
    try {
      setError(null);
      setCurrentRecording(null);
      setTranscriptionResult(null);
      setShowSaveForm(false);
      
      await voiceService.startRecording();
      setIsRecording(true);
      setRecordingDuration(0);
    } catch (err) {
      setError('Failed to start recording: ' + (err as Error).message);
    }
  };

  const stopRecording = async () => {
    try {
      const recording = await voiceService.stopRecording();
      setIsRecording(false);
      setCurrentRecording(recording);
      setRecordingDuration(recording.duration);
      
      // Auto-transcribe
      await transcribeRecording(recording);
    } catch (err) {
      setError('Failed to stop recording: ' + (err as Error).message);
      setIsRecording(false);
    }
  };

  const transcribeRecording = async (recording: VoiceRecording) => {
    setIsTranscribing(true);
    setError(null);

    try {
      const result = await voiceService.transcribeWithContext(recording.blob, category);
      setTranscriptionResult(result);
      setShowSaveForm(true);
      
      // Generate title from first few words
      const words = result.text.split(' ').slice(0, 5).join(' ');
      setNoteTitle(words + (result.text.split(' ').length > 5 ? '...' : ''));
    } catch (err) {
      setError('Transcription failed: ' + (err as Error).message);
    } finally {
      setIsTranscribing(false);
    }
  };

  const saveNote = () => {
    if (!currentRecording || !transcriptionResult) return;

    const newNote: VoiceNote = {
      id: Date.now().toString(),
      title: noteTitle.trim() || 'Untitled Voice Note',
      transcription: transcriptionResult.text,
      audioUrl: currentRecording.url,
      duration: currentRecording.duration,
      confidence: transcriptionResult.confidence,
      language: transcriptionResult.language,
      category,
      createdAt: new Date()
    };

    setNotes(prev => [newNote, ...prev]);
    
    // Call parent callback if provided
    if (onSaveNote) {
      onSaveNote({
        title: newNote.title,
        transcription: newNote.transcription,
        audioUrl: newNote.audioUrl,
        duration: newNote.duration,
        confidence: newNote.confidence,
        language: newNote.language,
        category
      });
    }

    // Reset form
    setCurrentRecording(null);
    setTranscriptionResult(null);
    setShowSaveForm(false);
    setNoteTitle('');
  };

  const playNote = (note: VoiceNote) => {
    if (playingNoteId === note.id) {
      // Pause current
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPlayingNoteId(null);
    } else {
      // Play new
      if (audioRef.current) {
        audioRef.current.src = note.audioUrl;
        audioRef.current.play();
        setPlayingNoteId(note.id);
      }
    }
  };

  const deleteNote = (noteId: string) => {
    setNotes(prev => prev.filter(note => note.id !== noteId));
    if (playingNoteId === noteId) {
      setPlayingNoteId(null);
      if (audioRef.current) {
        audioRef.current.pause();
      }
    }
  };

  const downloadNote = (note: VoiceNote) => {
    const element = document.createElement('a');
    element.href = note.audioUrl;
    element.download = `${note.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.webm`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getConfidenceColor = (confidence?: number): string => {
    if (!confidence) return 'text-gray-500';
    if (confidence >= 80) return 'text-green-600';
    if (confidence >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (!isInitialized && !error) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        <span>Initializing microphone...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-medium text-red-900">Error</h3>
            <p className="text-red-700 text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Recording Controls */}
      {isInitialized && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-center space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {category ? `${category.charAt(0).toUpperCase() + category.slice(1)} Voice Notes` : 'Voice Notes'}
            </h3>
            
            {/* Recording Button */}
            <div className="flex justify-center">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isTranscribing}
                className={`p-4 rounded-full transition-all duration-200 ${
                  isRecording 
                    ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                    : 'bg-blue-500 hover:bg-blue-600'
                } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isRecording ? (
                  <MicOff className="w-8 h-8" />
                ) : (
                  <Mic className="w-8 h-8" />
                )}
              </button>
            </div>

            {/* Recording Status */}
            {isRecording && (
              <div className="space-y-2">
                <div className="text-red-600 font-medium">Recording...</div>
                <div className="text-2xl font-mono text-gray-900">
                  {formatDuration(recordingDuration)}
                </div>
              </div>
            )}

            {/* Transcription Status */}
            {isTranscribing && (
              <div className="flex items-center justify-center space-x-2 text-blue-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Transcribing audio...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Save Form */}
      {showSaveForm && transcriptionResult && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-green-600">
              <CheckCircle className="w-5 h-5" />
              <h3 className="font-semibold">Transcription Complete</h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Note Title
                </label>
                <input
                  type="text"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter a title for this note..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Transcription
                </label>
                <div className="p-3 bg-gray-50 rounded-md border">
                  <p className="text-gray-900">{transcriptionResult.text}</p>
                  <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                    <span>Duration: {formatDuration(currentRecording?.duration || 0)}</span>
                    {transcriptionResult.confidence && (
                      <span className={getConfidenceColor(transcriptionResult.confidence)}>
                        Confidence: {Math.round(transcriptionResult.confidence)}%
                      </span>
                    )}
                    {transcriptionResult.language && (
                      <span>Language: {transcriptionResult.language}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={saveNote}
                  className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors flex items-center justify-center space-x-2"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Note</span>
                </button>
                <button
                  onClick={() => setShowSaveForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Saved Notes */}
      {notes.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Saved Notes</h3>
          <div className="space-y-3">
            {notes.map((note) => (
              <div key={note.id} className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 truncate">{note.title}</h4>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{note.transcription}</p>
                    <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                      <span>{formatDuration(note.duration)}</span>
                      <span>{note.createdAt.toLocaleDateString()}</span>
                      {note.confidence && (
                        <span className={getConfidenceColor(note.confidence)}>
                          {Math.round(note.confidence)}% confident
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => playNote(note)}
                      className="p-2 text-gray-400 hover:text-blue-500 transition-colors"
                      title={playingNoteId === note.id ? 'Pause' : 'Play'}
                    >
                      {playingNoteId === note.id ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => downloadNote(note)}
                      className="p-2 text-gray-400 hover:text-green-500 transition-colors"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteNote(note.id)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hidden audio element for playback */}
      <audio
        ref={audioRef}
        onEnded={() => setPlayingNoteId(null)}
        onError={() => setPlayingNoteId(null)}
      />
    </div>
  );
};

export default VoiceNotes; 