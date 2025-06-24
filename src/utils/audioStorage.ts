/**
 * Utility functions for storing and retrieving audio blobs in localStorage
 */

export interface StoredAudioData {
  dataUrl: string;
  mimeType: string;
  duration: number;
  timestamp: number; // Add timestamp for cleanup
}

/**
 * Convert a blob to a data URL for persistent storage
 */
export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Store audio blob data in localStorage with a unique key
 */
export async function storeAudioBlob(audioId: string, blob: Blob, duration: number): Promise<string> {
  try {
    const dataUrl = await blobToDataUrl(blob);
    const audioData: StoredAudioData = {
      dataUrl,
      mimeType: blob.type,
      duration,
      timestamp: Date.now()
    };
    
    localStorage.setItem(`audio_${audioId}`, JSON.stringify(audioData));
    console.log('🎵 Audio stored successfully:', audioId);
    return dataUrl;
  } catch (error) {
    console.error('❌ Failed to store audio:', error);
    // Fallback to blob URL
    return URL.createObjectURL(blob);
  }
}

/**
 * Retrieve audio data from localStorage
 */
export function getStoredAudioData(audioId: string): StoredAudioData | null {
  try {
    const stored = localStorage.getItem(`audio_${audioId}`);
    if (!stored) return null;
    
    const audioData = JSON.parse(stored) as StoredAudioData;
    
    // Validate the stored data
    if (!audioData.dataUrl || !audioData.dataUrl.startsWith('data:')) {
      console.warn('⚠️ Invalid stored audio data for:', audioId);
      return null;
    }
    
    return audioData;
  } catch (error) {
    console.error('❌ Failed to retrieve audio:', error);
    return null;
  }
}

/**
 * Get audio URL from storage (returns data URL if available, otherwise blob URL)
 */
export function getAudioUrl(audioId: string, fallbackBlobUrl?: string): string | null {
  const stored = getStoredAudioData(audioId);
  if (stored) {
    return stored.dataUrl;
  }
  
  return fallbackBlobUrl || null;
}

/**
 * Check if audio is stored locally
 */
export function hasStoredAudio(audioId: string): boolean {
  return getStoredAudioData(audioId) !== null;
}

/**
 * Convert stored audio data URL back to blob
 */
export async function storedAudioToBlob(audioId: string): Promise<Blob | null> {
  const storedData = getStoredAudioData(audioId);
  if (!storedData) return null;
  
  try {
    const response = await fetch(storedData.dataUrl);
    return await response.blob();
  } catch (error) {
    console.error('❌ Failed to convert stored audio to blob:', error);
    return null;
  }
}

/**
 * Remove audio data from localStorage
 */
export function removeStoredAudio(audioId: string): void {
  localStorage.removeItem(`audio_${audioId}`);
}

/**
 * Get all stored audio IDs
 */
export function getStoredAudioIds(): string[] {
  const keys = Object.keys(localStorage).filter(key => key.startsWith('audio_'));
  return keys.map(key => key.replace('audio_', ''));
}

/**
 * Clean up old audio files (optional, can be called periodically)
 */
export function cleanupOldAudio(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): void {
  const now = Date.now();
  const keys = Object.keys(localStorage).filter(key => key.startsWith('audio_'));
  
  keys.forEach(key => {
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return;
      
      const audioData = JSON.parse(stored) as StoredAudioData;
      
      if (audioData.timestamp && (now - audioData.timestamp) > maxAgeMs) {
        localStorage.removeItem(key);
        console.log('🧹 Cleaned up old audio:', key.replace('audio_', ''));
      }
    } catch (error) {
      // Skip invalid entries
      localStorage.removeItem(key);
    }
  });
}

/**
 * Migrate notes with blob URLs to use localStorage storage
 */
export async function migrateNotesToLocalStorage(items: any[]): Promise<any[]> {
  const migratedItems = [...items];
  
  for (const item of migratedItems) {
    if (item.type === 'voiceNote' && item.attachment && item.attachment.startsWith('blob:')) {
      try {
        // Fetch the blob and store it properly
        const response = await fetch(item.attachment);
        const blob = await response.blob();
        
        const audioUrl = await storeAudioBlob(item.id, blob, 0);
        
        // Update the item
        item.attachment = audioUrl;
        if (!item.metadata) item.metadata = {};
        item.metadata.audioStorageId = item.id;
        
        console.log('🔄 Migrated note to localStorage:', item.id);
      } catch (error) {
        console.error('❌ Failed to migrate note:', item.id, error);
      }
    }
  }
  
  return migratedItems;
}