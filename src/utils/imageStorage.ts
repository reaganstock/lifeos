/**
 * Utility functions for storing and retrieving image files in localStorage
 */

export interface StoredImageData {
  dataUrl: string;
  mimeType: string;
  filename: string;
  size: number;
  originalSize: number;
  timestamp: number;
  compressed: boolean;
}

// Storage limits and configuration
const MAX_IMAGE_SIZE = 500 * 1024; // 500KB per image
const MAX_TOTAL_STORAGE = 8 * 1024 * 1024; // 8MB total for images
const COMPRESSION_QUALITY = 0.7; // 70% quality for JPEG compression
const MAX_DIMENSION = 1200; // Max width/height for images

/**
 * Compress an image file to reduce storage size
 */
async function compressImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      // Calculate new dimensions while maintaining aspect ratio
      let { width, height } = img;
      
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = (height * MAX_DIMENSION) / width;
          width = MAX_DIMENSION;
        } else {
          width = (width * MAX_DIMENSION) / height;
          height = MAX_DIMENSION;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // Draw and compress
      ctx?.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob((blob) => {
        if (blob) {
          const compressedFile = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now()
          });
          resolve(compressedFile);
        } else {
          resolve(file); // Fallback to original
        }
      }, 'image/jpeg', COMPRESSION_QUALITY);
    };
    
    img.onerror = () => resolve(file); // Fallback to original
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Check available localStorage space
 */
function getAvailableSpace(): number {
  try {
    const used = new Blob(Object.values(localStorage)).size;
    const limit = 10 * 1024 * 1024; // Assume 10MB localStorage limit
    return Math.max(0, limit - used);
  } catch (error) {
    return 0;
  }
}

/**
 * Get current image storage usage
 */
export function getStoredImagesSize(): number {
  const keys = Object.keys(localStorage).filter(key => key.startsWith('image_'));
  let totalSize = 0;
  
  keys.forEach(key => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const imageData = JSON.parse(stored) as StoredImageData;
        totalSize += imageData.size || 0;
      }
    } catch (error) {
      // Skip invalid entries
    }
  });
  
  return totalSize;
}

/**
 * Clean up storage to make space
 */
function makeSpace(requiredSpace: number): boolean {
  const currentUsage = getStoredImagesSize();
  
  if (currentUsage + requiredSpace <= MAX_TOTAL_STORAGE) {
    return true; // No cleanup needed
  }
  
  // Get all stored images with timestamps
  const imageEntries: Array<{key: string, timestamp: number, size: number}> = [];
  
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('image_')) {
      try {
        const stored = localStorage.getItem(key);
        if (stored) {
          const imageData = JSON.parse(stored) as StoredImageData;
          imageEntries.push({
            key,
            timestamp: imageData.timestamp || 0,
            size: imageData.size || 0
          });
        }
      } catch (error) {
        // Remove invalid entries
        localStorage.removeItem(key);
      }
    }
  });
  
  // Sort by timestamp (oldest first)
  imageEntries.sort((a, b) => a.timestamp - b.timestamp);
  
  // Remove oldest images until we have enough space
  let freedSpace = 0;
  for (const entry of imageEntries) {
    localStorage.removeItem(entry.key);
    freedSpace += entry.size;
    
    if (currentUsage - freedSpace + requiredSpace <= MAX_TOTAL_STORAGE) {
      console.log(`🧹 Freed ${(freedSpace / 1024).toFixed(1)}KB of image storage`);
      return true;
    }
  }
  
  return false; // Still not enough space
}

/**
 * Convert a file to a data URL for persistent storage
 */
export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Store image file data in localStorage with compression and size management
 */
export async function storeImageFile(imageId: string, file: File): Promise<string> {
  try {
    // Compress image if it's too large
    let processedFile = file;
    let compressed = false;
    
    if (file.size > MAX_IMAGE_SIZE) {
      console.log(`🔄 Compressing large image: ${file.name} (${(file.size / 1024).toFixed(1)}KB)`);
      processedFile = await compressImage(file);
      compressed = true;
    }
    
    const dataUrl = await fileToDataUrl(processedFile);
    const estimatedSize = dataUrl.length * 0.75; // Rough estimate of base64 size
    
    // Check if we have enough space
    if (!makeSpace(estimatedSize)) {
      console.warn('⚠️ Not enough localStorage space for image, using blob URL fallback');
      return URL.createObjectURL(file);
    }
    
    const imageData: StoredImageData = {
      dataUrl,
      mimeType: processedFile.type,
      filename: file.name,
      size: estimatedSize,
      originalSize: file.size,
      timestamp: Date.now(),
      compressed
    };
    
    const key = `image_${imageId}`;
    localStorage.setItem(key, JSON.stringify(imageData));
    
    console.log(`🖼️ Image stored successfully: ${imageId} (${(estimatedSize / 1024).toFixed(1)}KB${compressed ? ', compressed' : ''})`);
    return dataUrl;
  } catch (error) {
    console.error('❌ Failed to store image:', error);
    // Fallback to blob URL
    return URL.createObjectURL(file);
  }
}

/**
 * Store multiple images with a base ID
 */
export async function storeImageFiles(baseId: string, files: File[]): Promise<string[]> {
  const results: string[] = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const imageId = `${baseId}_image_${i}`;
    
    try {
      const storedUrl = await storeImageFile(imageId, file);
      results.push(storedUrl);
    } catch (error) {
      console.error(`❌ Failed to store image ${i}:`, error);
      // Use blob URL as fallback
      results.push(URL.createObjectURL(file));
    }
  }
  
  console.log(`🖼️ Stored ${results.length} images for note: ${baseId}`);
  return results;
}

/**
 * Retrieve image data from localStorage
 */
export function getStoredImageData(imageId: string): StoredImageData | null {
  try {
    const stored = localStorage.getItem(`image_${imageId}`);
    if (!stored) return null;
    
    const imageData = JSON.parse(stored) as StoredImageData;
    
    // Validate the stored data
    if (!imageData.dataUrl || !imageData.dataUrl.startsWith('data:')) {
      console.warn('⚠️ Invalid stored image data for:', imageId);
      return null;
    }
    
    return imageData;
  } catch (error) {
    console.error('❌ Failed to retrieve image:', error);
    return null;
  }
}

/**
 * Get image URLs from storage for a note
 */
export function getImageUrls(baseId: string, fallbackUrls?: string[]): string[] {
  const storedUrls: string[] = [];
  let index = 0;
  
  // Try to get stored images
  while (true) {
    const imageId = `${baseId}_image_${index}`;
    const stored = getStoredImageData(imageId);
    
    if (stored) {
      storedUrls.push(stored.dataUrl);
      index++;
    } else {
      break;
    }
  }
  
  // Return stored URLs if found, otherwise fallback URLs
  return storedUrls.length > 0 ? storedUrls : (fallbackUrls || []);
}

/**
 * Check if images are stored locally for a note
 */
export function hasStoredImages(baseId: string): boolean {
  return getStoredImageData(`${baseId}_image_0`) !== null;
}

/**
 * Convert stored image data URLs back to File objects
 */
export async function storedImagesToFiles(baseId: string): Promise<File[]> {
  const files: File[] = [];
  let index = 0;
  
  while (true) {
    const imageId = `${baseId}_image_${index}`;
    const storedData = getStoredImageData(imageId);
    
    if (!storedData) break;
    
    try {
      const response = await fetch(storedData.dataUrl);
      const blob = await response.blob();
      const file = new File([blob], storedData.filename, { type: storedData.mimeType });
      files.push(file);
      index++;
    } catch (error) {
      console.error('❌ Failed to convert stored image to file:', error);
      break;
    }
  }
  
  return files;
}

/**
 * Remove image data from localStorage for a note
 */
export function removeStoredImages(baseId: string): void {
  let index = 0;
  
  while (true) {
    const imageId = `${baseId}_image_${index}`;
    const key = `image_${imageId}`;
    
    if (localStorage.getItem(key)) {
      localStorage.removeItem(key);
      index++;
    } else {
      break;
    }
  }
  
  if (index > 0) {
    console.log(`🗑️ Removed ${index} stored images for note:`, baseId);
  }
}

/**
 * Get all stored image IDs
 */
export function getStoredImageIds(): string[] {
  const keys = Object.keys(localStorage).filter(key => key.startsWith('image_'));
  return keys.map(key => key.replace('image_', ''));
}

/**
 * Clean up old image files (optional, can be called periodically)
 */
export function cleanupOldImages(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): void {
  const now = Date.now();
  const keys = Object.keys(localStorage).filter(key => key.startsWith('image_'));
  let cleanedCount = 0;
  let freedSpace = 0;
  
  keys.forEach(key => {
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return;
      
      const imageData = JSON.parse(stored) as StoredImageData;
      
      if (imageData.timestamp && (now - imageData.timestamp) > maxAgeMs) {
        freedSpace += imageData.size || 0;
        localStorage.removeItem(key);
        cleanedCount++;
      }
    } catch (error) {
      // Skip invalid entries
      localStorage.removeItem(key);
      cleanedCount++;
    }
  });
  
  if (cleanedCount > 0) {
    console.log(`🧹 Cleaned up ${cleanedCount} old images, freed ${(freedSpace / 1024).toFixed(1)}KB`);
  }
}

/**
 * Get storage usage summary
 */
export function getStorageInfo(): {totalImages: number, totalSize: number, availableSpace: number} {
  const keys = Object.keys(localStorage).filter(key => key.startsWith('image_'));
  let totalSize = 0;
  
  keys.forEach(key => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const imageData = JSON.parse(stored) as StoredImageData;
        totalSize += imageData.size || 0;
      }
    } catch (error) {
      // Skip invalid entries
    }
  });
  
  return {
    totalImages: keys.length,
    totalSize,
    availableSpace: getAvailableSpace()
  };
}

/**
 * Migrate notes with blob image URLs to use localStorage storage
 */
export async function migrateImagesToLocalStorage(items: any[]): Promise<any[]> {
  const migratedItems = [...items];
  
  for (const item of migratedItems) {
    if (item.metadata?.imageUrls && Array.isArray(item.metadata.imageUrls)) {
      const blobUrls = item.metadata.imageUrls.filter((url: string) => url.startsWith('blob:'));
      
      if (blobUrls.length > 0) {
        try {
          // Fetch the blobs and store them properly
          const files: File[] = [];
          
          for (let i = 0; i < blobUrls.length; i++) {
            const response = await fetch(blobUrls[i]);
            const blob = await response.blob();
            const file = new File([blob], `image-${i}.jpg`, { type: blob.type || 'image/jpeg' });
            files.push(file);
          }
          
          const storedUrls = await storeImageFiles(item.id, files);
          
          // Update the item
          item.metadata.imageUrls = storedUrls;
          if (!item.metadata.imageStorageId) {
            item.metadata.imageStorageId = item.id;
          }
          
          console.log('🔄 Migrated images to localStorage:', item.id);
        } catch (error) {
          console.error('❌ Failed to migrate images for note:', item.id, error);
        }
      }
    }
  }
  
  return migratedItems;
} 