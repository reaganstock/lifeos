// Quick Test Script for Calendar AI Fixes
// Run this in browser console on localhost:3000

console.log('🧪 STARTING CALENDAR AI QUICK TESTS...\n');

// Test data
const testEvents = [
  {
    title: 'Morning Workout',
    type: 'event',
    categoryId: 'gym-calisthenics',
    dateTime: new Date('2024-06-15T06:00:00'),
  },
  {
    title: 'Team Meeting',
    type: 'event', 
    categoryId: 'work-productivity',
    dateTime: new Date('2024-06-15T10:00:00'),
  }
];

// Test functions
const tests = [
  {
    name: 'Test 1: Intelligent Reschedule',
    command: 'I missed my morning workout, reschedule it intelligently',
    expectedKeywords: ['canceled', 'rescheduled', 'workout'],
    critical: true
  },
  {
    name: 'Test 2: Multiple Day Recurring',
    command: 'Schedule team meetings every Tuesday and Thursday at 3 PM for the next month',
    expectedKeywords: ['created', 'events', 'tuesday', 'thursday'],
    critical: true
  },
  {
    name: 'Test 3: Bulk Reschedule',
    command: 'Push all events back 1 week',
    expectedKeywords: ['rescheduled', 'events', 'week'],
    critical: true
  },
  {
    name: 'Test 4: Category Mapping',
    command: 'Schedule date night tomorrow at 7 PM',
    expectedKeywords: ['created', 'event', 'social'],
    critical: false
  },
  {
    name: 'Test 5: Multiple Dates',
    command: 'Schedule dentist appointments for December 16th, 20th, and 24th at 10 AM',
    expectedKeywords: ['created', '3 events', 'appointments'],
    critical: false
  }
];

// Test runner
async function runTests() {
  let passed = 0;
  let failed = 0;
  let criticalFailed = 0;
  
  for (const test of tests) {
    console.log(`\n🔍 ${test.name}`);
    console.log(`Command: "${test.command}"`);
    
    try {
      // Simulate AI command (you'll need to run these manually)
      console.log(`⏳ Run this command in AI chat and check results...`);
      console.log(`Expected keywords: ${test.expectedKeywords.join(', ')}`);
      
      // Manual verification prompt
      const result = prompt(`Did "${test.name}" pass? (y/n)`);
      
      if (result?.toLowerCase() === 'y') {
        console.log(`✅ PASS: ${test.name}`);
        passed++;
      } else {
        console.log(`❌ FAIL: ${test.name}`);
        failed++;
        if (test.critical) criticalFailed++;
      }
      
    } catch (error) {
      console.log(`❌ ERROR: ${test.name} - ${error.message}`);
      failed++;
      if (test.critical) criticalFailed++;
    }
  }
  
  // Results
  console.log('\n🏁 TEST RESULTS:');
  console.log(`✅ Passed: ${passed}/${tests.length}`);
  console.log(`❌ Failed: ${failed}/${tests.length}`);
  console.log(`🚨 Critical Failed: ${criticalFailed}`);
  
  if (criticalFailed === 0) {
    console.log('🎉 ALL CRITICAL TESTS PASSED! Calendar AI fixes are working!');
  } else {
    console.log('⚠️  Some critical tests failed. Review the fixes.');
  }
}

// Manual test instructions
console.log('📋 MANUAL TEST INSTRUCTIONS:');
console.log('1. Open AI chat in the app');
console.log('2. Run each test command below');
console.log('3. Verify the expected results');
console.log('4. Check calendar UI for actual events\n');

tests.forEach((test, index) => {
  console.log(`${index + 1}. ${test.name}`);
  console.log(`   Command: "${test.command}"`);
  console.log(`   Expected: ${test.expectedKeywords.join(', ')}`);
  console.log(`   Critical: ${test.critical ? 'YES' : 'No'}\n`);
});

console.log('🚀 Ready to test! Run runTests() to start interactive testing.');

// Export for manual use
window.calendarTests = {
  runTests,
  tests,
  testEvents
}; 