// Comprehensive Test Suite for All 24 Gemini Service Functions
// Run this in browser console on localhost:3000 after app loads

console.log('🧪 COMPREHENSIVE TEST SUITE FOR ALL 24 FUNCTIONS...\n');

// Wait for app to load and test functions to be available
function waitForGeminiService() {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 20;
    
    const checkService = () => {
      attempts++;
      
      if (window.testGeminiFunctions && window.debugGemini) {
        console.log('✅ Gemini service functions found!');
        resolve(true);
      } else if (attempts >= maxAttempts) {
        console.error('❌ Gemini service functions not found after 10 seconds');
        reject(new Error('Gemini service not available'));
      } else {
        console.log(`⏳ Waiting for gemini service... (${attempts}/${maxAttempts})`);
        setTimeout(checkService, 500);
      }
    };
    
    checkService();
  });
}

// Main test runner
async function runComprehensiveTests() {
  try {
    console.log('🔄 Waiting for Gemini service to load...');
    await waitForGeminiService();
    
    console.log('🚀 Starting comprehensive function tests...\n');
    
    // Run the built-in test suite
    if (window.testGeminiFunctions) {
      await window.testGeminiFunctions();
    } else {
      console.error('❌ Test function not available');
      return;
    }
    
    console.log('\n🏁 COMPREHENSIVE TEST COMPLETE!');
    console.log('📊 Check the console output above for detailed results');
    
  } catch (error) {
    console.error('❌ Test suite error:', error);
  }
}

// Individual function tests for manual verification
const manualTests = [
  {
    name: 'Create Item Test',
    function: 'createItem',
    args: {
      title: 'Test Manual Todo',
      text: 'This is a manual test',
      type: 'todo',
      categoryId: 'self-regulation',
      priority: 'high'
    }
  },
  {
    name: 'Bulk Create Test',
    function: 'bulkCreateItems',
    args: {
      itemsJson: '[{"title": "Bulk Test 1", "text": "Test 1", "type": "todo", "categoryId": "self-regulation"}, {"title": "Bulk Test 2", "text": "Test 2", "type": "note", "categoryId": "self-regulation"}]'
    }
  },
  {
    name: 'Search Items Test',
    function: 'searchItems',
    args: {
      query: 'test',
      type: 'todo'
    }
  },
  {
    name: 'Create Recurring Event Test',
    function: 'createRecurringEvent',
    args: {
      title: 'Weekly Test Meeting',
      startDate: '2024-07-10',
      recurrencePattern: 'weekly',
      categoryId: 'self-regulation',
      duration: 60
    }
  }
];

// Manual test runner
async function runManualTest(testName) {
  const test = manualTests.find(t => t.name === testName);
  if (!test) {
    console.error(`❌ Test "${testName}" not found`);
    return;
  }
  
  console.log(`🔧 Running manual test: ${test.name}`);
  console.log('Args:', test.args);
  
  try {
    // Access gemini service directly if available
    if (window.geminiService) {
      const result = await window.geminiService.executeFunction(test.function, test.args);
      console.log('✅ Result:', result);
      return result;
    } else {
      console.error('❌ geminiService not available on window');
    }
  } catch (error) {
    console.error('❌ Manual test error:', error);
  }
}

// Expose functions globally
window.comprehensiveTests = {
  run: runComprehensiveTests,
  runManual: runManualTest,
  manualTests: manualTests.map(t => t.name),
  listFunctions: () => {
    const functionNames = [
      'createItem', 'bulkCreateItems', 'updateItem', 'deleteItem',
      'bulkUpdateItems', 'bulkDeleteItems', 'searchItems', 'consolidateItems',
      'removeAsterisks', 'executeMultipleUpdates', 'copyRoutineFromPerson',
      'generateFullDaySchedule', 'createCalendarFromNotes', 'bulkRescheduleEvents',
      'createRecurringEvent', 'createMultipleDateEvents', 'deleteRecurringEvent',
      'intelligentReschedule', 'createItemWithConflictOverride', 
      'createRecurringMultipleDays', 'createCategory', 'updateCategory',
      'deleteCategory', 'reorganizeCategories'
    ];
    console.log('📋 All 24 Available Functions:');
    functionNames.forEach((name, index) => {
      console.log(`${index + 1}. ${name}`);
    });
    return functionNames;
  }
};

// Instructions
console.log('📋 INSTRUCTIONS:');
console.log('1. Make sure the app is fully loaded');
console.log('2. Run: comprehensiveTests.run() - for full automated test');
console.log('3. Run: comprehensiveTests.listFunctions() - to see all functions');
console.log('4. Run: comprehensiveTests.runManual("Test Name") - for specific tests');
console.log('5. Available manual tests:');
manualTests.forEach((test, index) => {
  console.log(`   ${index + 1}. ${test.name}`);
});

console.log('\n🚀 Ready! Run comprehensiveTests.run() to start testing all 24 functions!');