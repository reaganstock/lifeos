// localStorage Debug Script - Run this in browser console
console.log('🔍 DEBUGGING LOCALSTORAGE USAGE');

// Function to check user-specific data
function checkUserSpecificData() {
  const currentUser = window.currentUser;
  if (!currentUser) {
    console.log('❌ No currentUser found in window');
    return;
  }
  
  console.log('👤 Current User:', currentUser.email, '| ID:', currentUser.id);
  
  // Check user-specific keys
  const userPrefix = `lifely_user_${currentUser.id}_`;
  const userKeys = Object.keys(localStorage).filter(key => key.startsWith(userPrefix));
  
  console.log(`🔍 User-specific keys (${userPrefix}*):`, userKeys);
  
  // Check specific important keys
  const importantKeys = [
    'lifeStructureCategories',
    'lifeStructureItems', 
    'lifely_onboarding_type',
    'lifely_voice_memo_recording',
    'lifely_onboarding_completed'
  ];
  
  console.log('\n📊 STORAGE COMPARISON:');
  importantKeys.forEach(key => {
    const globalValue = localStorage.getItem(key);
    const userSpecificKey = `${userPrefix}${key}`;
    const userValue = localStorage.getItem(userSpecificKey);
    
    console.log(`\n🔑 ${key}:`);
    console.log(`  Global: ${globalValue ? (globalValue.length > 100 ? globalValue.substring(0,100) + '...' : globalValue) : 'null'}`);
    console.log(`  User-specific: ${userValue ? (userValue.length > 100 ? userValue.substring(0,100) + '...' : userValue) : 'null'}`);
    
    if (globalValue && !userValue) {
      console.log(`  ⚠️ Data exists in GLOBAL but NOT in user-specific storage!`);
    } else if (!globalValue && userValue) {
      console.log(`  ✅ Data exists in user-specific storage only`);
    } else if (globalValue && userValue) {
      console.log(`  📊 Data exists in BOTH storages`);
    } else {
      console.log(`  ❌ No data in either storage`);
    }
  });
}

// Function to migrate data from global to user-specific
function migrateToUserSpecific() {
  const currentUser = window.currentUser;
  if (!currentUser || !window.userStorageUtils) {
    console.log('❌ Cannot migrate - missing user or userStorageUtils');
    return;
  }
  
  const { setUserData } = window.userStorageUtils;
  const userId = currentUser.id;
  
  console.log('🔄 Migrating data from global to user-specific storage...');
  
  // Migrate categories
  const categories = localStorage.getItem('lifeStructureCategories');
  if (categories) {
    setUserData(userId, 'lifeStructureCategories', JSON.parse(categories));
    console.log('✅ Migrated categories');
  }
  
  // Migrate items
  const items = localStorage.getItem('lifeStructureItems');
  if (items) {
    setUserData(userId, 'lifeStructureItems', JSON.parse(items));
    console.log('✅ Migrated items');
  }
  
  // Migrate onboarding completion
  const completed = localStorage.getItem('lifely_onboarding_completed');
  if (completed) {
    setUserData(userId, 'lifely_onboarding_completed', completed === 'true');
    console.log('✅ Migrated onboarding completion');
  }
  
  console.log('✅ Migration complete! Refresh the page to see results.');
}

// Run the checks
checkUserSpecificData();

// Expose functions to console
window.debugStorage = {
  check: checkUserSpecificData,
  migrate: migrateToUserSpecific,
  clearAll: () => {
    localStorage.clear();
    console.log('🗑️ Cleared all localStorage');
  }
};

console.log('\n🔧 Debug functions available:');
console.log('  debugStorage.check() - Check current storage state');
console.log('  debugStorage.migrate() - Migrate global data to user-specific');
console.log('  debugStorage.clearAll() - Clear all localStorage');