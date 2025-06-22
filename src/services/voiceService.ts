import OpenAI from 'openai';

// OpenAI client instance
const getOpenAIClient = () => {
  const apiKey = process.env.REACT_APP_OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OpenAI API key not found. Please set REACT_APP_OPENAI_API_KEY environment variable.');
  }

  return new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true // Note: In production, use server-side proxy
  });
};

export interface VoiceRecording {
  blob: Blob;
  duration: number;
  url: string;
}

export interface TranscriptionResult {
  text: string;
  confidence?: number;
  language?: string;
  duration?: number;
}

// Extended MediaRecorder options interface
interface ExtendedMediaRecorderOptions extends MediaRecorderOptions {
  audioBitsPerSecond?: number;
}

export class VoiceService {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private startTime: number = 0;
  private isRecording: boolean = false;

  /**
   * Initialize microphone access
   */
  async initializeMicrophone(): Promise<void> {
    try {
      // Request microphone access with optimal settings for speech
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000, // Optimal for Whisper
          channelCount: 1 // Mono for speech
        }
      });
    } catch (error) {
      console.error('Failed to access microphone:', error);
      throw new Error('Microphone access denied or not available');
    }
  }

  /**
   * Start recording voice
   */
  async startRecording(): Promise<void> {
    if (!this.stream) {
      await this.initializeMicrophone();
    }

    if (this.isRecording) {
      throw new Error('Recording already in progress');
    }

    // Reset recorded chunks
    this.recordedChunks = [];
    
    // Create MediaRecorder with optimal settings for Whisper
    const options: ExtendedMediaRecorderOptions = {
      mimeType: this.getSupportedMimeType(),
      audioBitsPerSecond: 64000 // Good quality for speech
    };

    this.mediaRecorder = new MediaRecorder(this.stream!, options);
    
    // Set up event handlers
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    // Start recording
    this.startTime = Date.now();
    this.mediaRecorder.start(1000); // Collect data every second
    this.isRecording = true;
  }

  /**
   * Stop recording and return the recorded audio
   */
  async stopRecording(): Promise<VoiceRecording> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.isRecording) {
        reject(new Error('No active recording found'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const duration = (Date.now() - this.startTime) / 1000;
        const mimeType = this.getSupportedMimeType();
        
        // Create blob from recorded chunks
        const blob = new Blob(this.recordedChunks, { type: mimeType });
        const url = URL.createObjectURL(blob);

        this.isRecording = false;
        this.recordedChunks = [];

        resolve({
          blob,
          duration,
          url
        });
      };

      this.mediaRecorder.onerror = (event) => {
        reject(new Error('Recording failed: ' + event));
      };

      this.mediaRecorder.stop();
    });
  }

  /**
   * Check if response has additional properties (verbose_json format)
   */
  private handleVerboseResponse(response: any): TranscriptionResult {
    const result: TranscriptionResult = {
      text: response.text
    };

    // Check if response has additional properties (verbose_json format)
    if (response.language && typeof response.language === 'string') {
      result.language = response.language;
    }
    
    if (response.duration && typeof response.duration === 'number') {
      result.duration = response.duration;
    }

    // Calculate confidence if segments available
    if (response.segments && Array.isArray(response.segments)) {
      const segments = response.segments as any[];
      const avgLogProb = segments.reduce((sum: number, seg: any) => 
        sum + (seg.avg_logprob || 0), 0) / segments.length;
      // Convert log probability to confidence percentage (rough approximation)
      result.confidence = Math.max(0, Math.min(100, (1 + avgLogProb) * 100));
    }

    return result;
  }

  /**
   * Transcribe audio using OpenAI Whisper API
   */
  async transcribeAudio(audioBlob: Blob, options?: {
    language?: string;
    prompt?: string;
    responseFormat?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
    temperature?: number;
  }): Promise<TranscriptionResult> {
    try {
      // Convert blob to supported format for OpenAI API with correct extension
      const audioFile = await this.blobToFile(audioBlob, 'recording');

      // Prepare transcription request
      const transcriptionOptions: any = {
        file: audioFile,
        model: 'whisper-1',
        response_format: options?.responseFormat || 'verbose_json',
        language: options?.language, // Auto-detect if not specified
        prompt: options?.prompt, // Context for better accuracy
        temperature: options?.temperature || 0 // Deterministic results
      };

      // Remove undefined values
      Object.keys(transcriptionOptions).forEach(key => 
        transcriptionOptions[key] === undefined && delete transcriptionOptions[key]
      );

      const response = await getOpenAIClient().audio.transcriptions.create(transcriptionOptions);

      // Handle different response formats
      if (typeof response === 'string') {
        return { text: response };
      }

      // Handle the response object using helper method
      return this.handleVerboseResponse(response);

    } catch (error) {
      console.error('Transcription failed:', error);
      
      // Handle specific OpenAI errors
      if (error instanceof Error) {
        if (error.message.includes('file_size_exceeded')) {
          throw new Error('Audio file too large (max 25MB)');
        } else if (error.message.includes('invalid_file_format')) {
          throw new Error('Unsupported audio format');
        }
      }
      
      throw new Error('Transcription failed: ' + (error as Error).message);
    }
  }

  /**
   * Enhanced transcription with Georgetown context
   */
  async transcribeWithContext(audioBlob: Blob, category?: string): Promise<TranscriptionResult> {
    // Create context-aware prompt for better transcription
    let prompt = "This is a voice note about personal goals, productivity, and life management.";
    
    if (category) {
      const categoryPrompts = {
        'self-regulation': 'This note is about self-regulation, habits, routines, and personal discipline.',
        'gym-calisthenics': 'This note is about fitness, gym workouts, calisthenics, exercises like backflip, planche, pull-ups, and physical training.',
        'mobile-apps': 'This note is about mobile app development, AI, entrepreneurship, business goals, and technology.',
        'catholicism': 'This note is about Catholic faith, Bible study, catechism, church history, and spiritual goals.',
        'social-charisma': 'This note is about social skills, charisma, dating, networking, and personal relationships.',
        'content': 'This note is about content creation, social media, educational content, and personal branding.'
      };
      
      prompt = categoryPrompts[category as keyof typeof categoryPrompts] || prompt;
    }

    // Add common terms for better recognition
    prompt += " Common terms: Georgetown, Cooper Flag, goals, routines, habits, progress, AI, development.";

    return this.transcribeAudio(audioBlob, {
      prompt,
      temperature: 0.1, // Lower temperature for more consistent results
      responseFormat: 'verbose_json'
    });
  }

  /**
   * Get supported MIME type for recording - prioritize OpenAI compatible formats
   */
  private getSupportedMimeType(): string {
    const types = [
      'audio/wav',           // WAV - supported by OpenAI
      'audio/mp4',           // MP4 - supported by OpenAI  
      'audio/mpeg',          // MP3 - supported by OpenAI
      'audio/webm;codecs=opus',
      'audio/webm'
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        console.log('🎤 Using MIME type:', type);
        return type;
      }
    }

    console.warn('⚠️ No supported MIME type found, using fallback');
    return 'audio/wav'; // Fallback to WAV which is widely supported
  }

  /**
   * Convert Blob to File for OpenAI API
   */
  private async blobToFile(blob: Blob, filename: string): Promise<File> {
    // Get the appropriate file extension based on MIME type
    const getExtensionFromMimeType = (mimeType: string): string => {
      if (mimeType.includes('wav')) return 'wav';
      if (mimeType.includes('mp4')) return 'mp4';
      if (mimeType.includes('mpeg')) return 'mp3';
      if (mimeType.includes('webm')) return 'webm';
      return 'wav'; // Default fallback
    };
    
    const extension = getExtensionFromMimeType(blob.type);
    const correctedFilename = `recording.${extension}`;
    
    return new File([blob], correctedFilename, { type: blob.type });
  }

  /**
   * Release microphone resources
   */
  cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
    }
    
    this.mediaRecorder = null;
    this.isRecording = false;
    this.recordedChunks = [];
  }

  /**
   * Check if recording is in progress
   */
  getRecordingState(): boolean {
    return this.isRecording;
  }

  /**
   * Get current recording duration
   */
  getCurrentDuration(): number {
    if (!this.isRecording) return 0;
    return (Date.now() - this.startTime) / 1000;
  }

  /**
   * Check browser support for voice recording
   */
  static isSupported(): boolean {
    return !!(
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function' &&
      typeof window !== 'undefined' &&
      'MediaRecorder' in window
    );
  }
}

// Export singleton instance
export const voiceService = new VoiceService(); 