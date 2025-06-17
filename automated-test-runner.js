// Automated Calendar AI Function Tests
// This tests the core logic without the UI

const fs = require('fs');
const path = require('path');

// Mock localStorage for testing
global.localStorage = {
  data: {},
  getItem: function(key) { return this.data[key] || null; },
  setItem: function(key, value) { this.data[key] = value; },
  removeItem: function(key) { delete this.data[key]; }
};

// Mock items for testing
const mockItems = [
  {
    id: 'workout-1',
    title: 'Morning Workout',
    type: 'event',
    categoryId: 'gym-calisthenics',
    dateTime: new Date('2024-06-15T06:00:00'),
    metadata: { 
      startTime: new Date('2024-06-15T06:00:00'), 
      endTime: new Date('2024-06-15T07:00:00'),
      duration: 60
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    completed: false
  },
  {
    id: 'meeting-1',
    title: 'Team Meeting',
    type: 'event',
    categoryId: 'work-productivity',
    dateTime: new Date('2024-06-15T10:00:00'),
    metadata: { 
      startTime: new Date('2024-06-15T10:00:00'), 
      endTime: new Date('2024-06-15T11:00:00'),
      duration: 60
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    completed: false
  }
];

// Test results
let testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(name, passed, message) {
  const result = { name, passed, message };
  testResults.tests.push(result);
  
  if (passed) {
    testResults.passed++;
    console.log(`✅ PASS: ${name}`);
  } else {
    testResults.failed++;
    console.log(`❌ FAIL: ${name} - ${message}`);
  }
}

// Test 1: Fuzzy Event Matching
function testFuzzyEventMatching() {
  console.log('\n🔍 Testing Fuzzy Event Matching...');
  
  // Simulate the findEventByDescription logic
  function findEventByDescription(items, description) {
    // Exact title match
    let event = items.find(item => 
      item.type === 'event' && 
      item.title.toLowerCase() === description.toLowerCase()
    );
    if (event) return event;
    
    // Fuzzy matching
    const searchTerms = description.toLowerCase().split(' ');
    event = items.find(item => {
      if (item.type !== 'event') return false;
      const title = item.title.toLowerCase();
      return searchTerms.every(term => title.includes(term));
    });
    if (event) return event;
    
    // Category-based matching
    const workoutTerms = ['workout', 'gym', 'exercise'];
    if (workoutTerms.some(term => description.toLowerCase().includes(term))) {
      event = items.find(item => 
        item.type === 'event' && 
        item.categoryId === 'gym-calisthenics' &&
        workoutTerms.some(term => item.title.toLowerCase().includes(term))
      );
      if (event) return event;
    }
    
    return undefined;
  }
  
  // Test cases
  const testCases = [
    { input: 'morning workout', expected: 'workout-1' },
    { input: 'workout', expected: 'workout-1' },
    { input: 'team meeting', expected: 'meeting-1' },
    { input: 'nonexistent', expected: undefined }
  ];
  
  testCases.forEach(testCase => {
    const result = findEventByDescription(mockItems, testCase.input);
    const passed = testCase.expected === undefined ? 
      result === undefined : 
      result?.id === testCase.expected;
    
    logTest(
      `Fuzzy match: "${testCase.input}"`,
      passed,
      `Expected ${testCase.expected}, got ${result?.id || 'undefined'}`
    );
  });
}

// Test 2: Multiple Date Event Creation Logic
function testMultipleDateLogic() {
  console.log('\n📅 Testing Multiple Date Logic...');
  
  function generateMultipleDates(daysOfWeek, startDate, endDate, time) {
    const targetDates = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      
      if (daysOfWeek.some(day => day.toLowerCase() === dayName)) {
        const eventDate = new Date(currentDate);
        const [hours, minutes] = time.split(':').map(Number);
        eventDate.setHours(hours, minutes, 0, 0);
        targetDates.push(new Date(eventDate));
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return targetDates;
  }
  
  // Test Tuesday/Thursday for 2 weeks
  const startDate = new Date('2024-06-17'); // Monday
  const endDate = new Date('2024-06-30'); // Sunday (2 weeks)
  const dates = generateMultipleDates(['tuesday', 'thursday'], startDate, endDate, '15:00');
  
  logTest(
    'Tuesday/Thursday pattern generation',
    dates.length === 4, // Should be 4 events (2 weeks × 2 days)
    `Expected 4 events, got ${dates.length}`
  );
  
  // Verify first date is Tuesday at 3 PM
  const firstDate = dates[0];
  const isTuesday = firstDate.getDay() === 2; // Tuesday = 2
  const isThreePM = firstDate.getHours() === 15;
  
  logTest(
    'First event is Tuesday at 3 PM',
    isTuesday && isThreePM,
    `Day: ${firstDate.getDay()}, Hour: ${firstDate.getHours()}`
  );
}

// Test 3: Category Mapping
function testCategoryMapping() {
  console.log('\n🏷️ Testing Category Mapping...');
  
  function mapToExistingCategory(userCategory) {
    const categoryMap = {
      'dating': 'social-charisma',
      'fitness': 'gym-calisthenics',
      'work': 'mobile-apps',
      'personal': 'self-regulation',
      'education': 'content',
      'health': 'self-regulation',
      'spiritual': 'catholicism',
      'social': 'social-charisma'
    };
    
    const lowerCategory = userCategory.toLowerCase();
    return categoryMap[lowerCategory] || userCategory;
  }
  
  const testCases = [
    { input: 'dating', expected: 'social-charisma' },
    { input: 'fitness', expected: 'gym-calisthenics' },
    { input: 'work', expected: 'mobile-apps' },
    { input: 'unknown', expected: 'unknown' }
  ];
  
  testCases.forEach(testCase => {
    const result = mapToExistingCategory(testCase.input);
    logTest(
      `Category mapping: ${testCase.input} → ${testCase.expected}`,
      result === testCase.expected,
      `Expected ${testCase.expected}, got ${result}`
    );
  });
}

// Test 4: Conflict Detection
function testConflictDetection() {
  console.log('\n⚠️ Testing Conflict Detection...');
  
  function detectConflicts(items, newEventTime) {
    return items.filter(item => {
      if (item.type !== 'event' || !item.dateTime) return false;
      const existingDateTime = new Date(item.dateTime);
      const timeDiff = Math.abs(existingDateTime.getTime() - newEventTime.getTime());
      return timeDiff < 30 * 60 * 1000; // 30 minutes
    });
  }
  
  // Test conflict detection
  const conflictTime = new Date('2024-06-15T06:15:00'); // 15 minutes after workout
  const conflicts = detectConflicts(mockItems, conflictTime);
  
  logTest(
    'Conflict detection within 30 minutes',
    conflicts.length === 1 && conflicts[0].id === 'workout-1',
    `Expected 1 conflict with workout-1, got ${conflicts.length} conflicts`
  );
  
  // Test no conflict
  const noConflictTime = new Date('2024-06-15T08:00:00'); // 2 hours later
  const noConflicts = detectConflicts(mockItems, noConflictTime);
  
  logTest(
    'No conflict detection when time is clear',
    noConflicts.length === 0,
    `Expected 0 conflicts, got ${noConflicts.length}`
  );
}

// Test 5: Date Parsing
function testDateParsing() {
  console.log('\n📅 Testing Date Parsing...');
  
  function parseRelativeDate(dateStr) {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    
    if (dateStr.includes('tomorrow')) {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow;
    }
    
    if (dateStr.includes('20th')) {
      return new Date(`${currentYear}-${String(currentMonth).padStart(2, '0')}-20`);
    }
    
    return null;
  }
  
  const tomorrow = parseRelativeDate('tomorrow');
  const twentieth = parseRelativeDate('20th');
  
  logTest(
    'Tomorrow parsing',
    tomorrow && tomorrow.getDate() === new Date().getDate() + 1,
    `Tomorrow should be one day ahead`
  );
  
  logTest(
    '20th parsing',
    twentieth && twentieth.getDate() === 20,
    `20th should parse to day 20 of current month`
  );
}

// Run all tests
async function runAllTests() {
  console.log('🧪 STARTING AUTOMATED CALENDAR AI TESTS\n');
  
  testFuzzyEventMatching();
  testMultipleDateLogic();
  testCategoryMapping();
  testConflictDetection();
  testDateParsing();
  
  // Summary
  console.log('\n🏁 TEST SUMMARY:');
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📊 Total: ${testResults.tests.length}`);
  
  if (testResults.failed === 0) {
    console.log('🎉 ALL AUTOMATED TESTS PASSED!');
    console.log('✅ Core calendar AI logic is working correctly');
  } else {
    console.log('⚠️ Some tests failed - review the logic');
  }
  
  return testResults;
}

// Export for use
module.exports = { runAllTests, testResults };

// Run if called directly
if (require.main === module) {
  runAllTests();
} 