/**
 * User-specific localStorage utilities to prevent data contamination between different accounts
 */

export const getUserStorageKey = (userId: string | null, baseKey: string): string => {
  if (!userId) {
    // For unauthenticated users, use global keys (temporary fallback)
    return baseKey;
  }
  
  // Create user-specific key to prevent data contamination
  return `${baseKey}_user_${userId}`;
};

export const getUserData = <T>(userId: string | null, baseKey: string, defaultValue: T): T => {
  const key = getUserStorageKey(userId, baseKey);
  const stored = localStorage.getItem(key);
  
  if (!stored) {
    return defaultValue;
  }
  
  try {
    // Try to parse as JSON first
    return JSON.parse(stored);
  } catch (error) {
    // If JSON parsing fails, check if it's a simple string value that should be returned as-is
    if (typeof defaultValue === 'string') {
      console.warn(`Using raw string value for key ${key}:`, stored);
      return stored as T;
    }
    
    console.error(`Error parsing stored data for key ${key}:`, error);
    // Clean up corrupted data
    localStorage.removeItem(key);
    return defaultValue;
  }
};

export const setUserData = <T>(userId: string | null, baseKey: string, data: T): void => {
  const key = getUserStorageKey(userId, baseKey);
  
  try {
    localStorage.setItem(key, JSON.stringify(data));
    console.log(`💾 Saved user data to ${key}`);
  } catch (error) {
    console.error(`Error saving data for key ${key}:`, error);
  }
};

export const removeUserData = (userId: string | null, baseKey: string): void => {
  const key = getUserStorageKey(userId, baseKey);
  localStorage.removeItem(key);
  console.log(`🗑️ Removed user data from ${key}`);
};

export const clearAllUserData = (userId: string | null): void => {
  if (!userId) return;
  
  const userPrefix = `_user_${userId}`;
  const keysToRemove: string[] = [];
  
  // Find all keys for this user
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.includes(userPrefix)) {
      keysToRemove.push(key);
    }
  }
  
  // Remove all user-specific keys
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
    console.log(`🗑️ Cleared user data: ${key}`);
  });
  
  console.log(`🧹 Cleared all data for user ${userId}`);
};

// Clean up onboarding data for specific user
export const clearUserOnboardingData = (userId: string | null): void => {
  const onboardingKeys = [
    // 'lifely_onboarding_completed', // CRITICAL FIX: Don't clear completion status - needed for refresh persistence
    'lifely_onboarding_progress',
    'lifely_onboarding_step',
    'lifely_onboarding_data',
    'lifely_onboarding_conversation',
    'lifely_onboarding_documents',
    'lifely_onboarding_integrations',
    'lifely_onboarding_type',
    'lifely_onboarding_method',
    'lifely_extracted_data',
    'lifely_voice_memo_recording'
  ];
  
  onboardingKeys.forEach(baseKey => {
    removeUserData(userId, baseKey);
  });
  
  console.log(`🧹 Cleared onboarding data for user ${userId}`);
};