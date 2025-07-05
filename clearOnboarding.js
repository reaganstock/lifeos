// Debugging script to clear all onboarding data for fresh testing
// Run this in the browser console to reset everything

function clearAllOnboardingData() {
  console.log('🧹 Clearing all onboarding data for fresh start...');
  
  // Clear all onboarding-related localStorage keys
  const keys = Object.keys(localStorage).filter(key => 
    key.includes('lifely_onboarding') || 
    key.includes('lifely_extracted') ||
    key.includes('lifely_voice_memo') ||
    key.includes('lifely_dashboard') ||
    key.includes('onboarding')
  );
  
  console.log('Found onboarding keys:', keys);
  
  keys.forEach(key => {
    localStorage.removeItem(key);
    console.log('Removed:', key);
  });
  
  // Also clear categories and items for complete reset
  localStorage.removeItem('lifeStructureCategories');
  localStorage.removeItem('lifeStructureItems');
  
  console.log('✅ All onboarding data cleared. Refresh the page to start fresh.');
}

// Also clear user-specific data
function clearUserSpecificData(userId) {
  console.log('🧹 Clearing user-specific data for:', userId);
  
  const userKeys = Object.keys(localStorage).filter(key => 
    key.includes(`_user_${userId}`)
  );
  
  console.log('Found user-specific keys:', userKeys);
  
  userKeys.forEach(key => {
    localStorage.removeItem(key);
    console.log('Removed:', key);
  });
}

// Export for console use
window.clearAllOnboardingData = clearAllOnboardingData;
window.clearUserSpecificData = clearUserSpecificData;

console.log('🔧 Debugging functions loaded:');
console.log('- clearAllOnboardingData() - Clear all onboarding data');
console.log('- clearUserSpecificData(userId) - Clear data for specific user');