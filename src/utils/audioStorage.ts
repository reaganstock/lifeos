/**
 * Utility functions for storing and retrieving audio blobs in localStorage
 */

export interface StoredAudioData {
  dataUrl: string;
  mimeType: string;
  duration: number;
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
      duration
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
    
    return JSON.parse(stored) as StoredAudioData;
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
 * Remove audio data from localStorage
 */
export function removeStoredAudio(audioId: string): void {
  localStorage.removeItem(`audio_${audioId}`);
}

/**
 * Clean up old audio files (optional, can be called periodically)
 */
export function cleanupOldAudio(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): void {
  const now = Date.now();
  const keys = Object.keys(localStorage).filter(key => key.startsWith('audio_'));
  
  keys.forEach(key => {
    try {
      const audioId = key.replace('audio_', '');
      const timestamp = parseInt(audioId);
      
      if (!isNaN(timestamp) && (now - timestamp) > maxAgeMs) {
        localStorage.removeItem(key);
        console.log('🧹 Cleaned up old audio:', audioId);
      }
    } catch (error) {
      // Skip invalid entries
    }
  });
}