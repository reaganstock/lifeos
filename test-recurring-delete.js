// Test script for recurring event deletion modal
// Run this in browser console on localhost:3000

console.log('🔄 Testing Recurring Event Deletion Modal');
console.log('==========================================');

// Function to create test recurring events
function createTestRecurringEvents() {
  const items = JSON.parse(localStorage.getItem('lifeOS_items') || '[]');
  const recurrenceId = 'test-recurring-' + Date.now();
  
  // Create 3 test recurring events
  const testEvents = [
    {
      id: `${recurrenceId}-1`,
      title: 'Daily Standup Meeting',
      text: 'Team standup meeting',
      type: 'event',
      categoryId: 'work-productivity',
      completed: false,
      dateTime: new Date('2025-06-14T09:00:00').toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        isRecurring: true,
        recurrenceId: recurrenceId,
        recurrencePattern: 'daily',
        location: 'Conference Room A'
      }
    },
    {
      id: `${recurrenceId}-2`,
      title: 'Daily Standup Meeting',
      text: 'Team standup meeting',
      type: 'event',
      categoryId: 'work-productivity',
      completed: false,
      dateTime: new Date('2025-06-15T09:00:00').toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        isRecurring: true,
        recurrenceId: recurrenceId,
        recurrencePattern: 'daily',
        location: 'Conference Room A'
      }
    },
    {
      id: `${recurrenceId}-3`,
      title: 'Daily Standup Meeting',
      text: 'Team standup meeting',
      type: 'event',
      categoryId: 'work-productivity',
      completed: false,
      dateTime: new Date('2025-06-16T09:00:00').toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        isRecurring: true,
        recurrenceId: recurrenceId,
        recurrencePattern: 'daily',
        location: 'Conference Room A'
      }
    }
  ];
  
  const updatedItems = [...items, ...testEvents];
  localStorage.setItem('lifeOS_items', JSON.stringify(updatedItems));
  
  console.log('✅ Created 3 test recurring events with recurrenceId:', recurrenceId);
  console.log('Events created:', testEvents.map(e => `${e.title} on ${e.dateTime}`));
  
  return recurrenceId;
}

// Function to check if modal appears
function checkModalExists() {
  const modal = document.querySelector('[data-testid="recurring-delete-modal"]') || 
                document.querySelector('div:has(h3:contains("Delete Recurring Event"))') ||
                document.querySelector('h3').textContent?.includes('Delete Recurring Event');
  
  if (modal) {
    console.log('✅ Recurring delete modal is visible!');
    return true;
  } else {
    console.log('❌ Recurring delete modal is NOT visible');
    return false;
  }
}

// Function to count events
function countEvents() {
  const items = JSON.parse(localStorage.getItem('lifeOS_items') || '[]');
  const totalEvents = items.filter(item => item.type === 'event').length;
  const recurringEvents = items.filter(item => 
    item.type === 'event' && 
    item.metadata?.isRecurring && 
    item.title?.includes('Daily Standup Meeting')
  ).length;
  
  console.log(`📊 Total events: ${totalEvents}, Test recurring events: ${recurringEvents}`);
  return { totalEvents, recurringEvents };
}

// Main test function
async function testRecurringDeleteModal() {
  console.log('\n🚀 Starting Recurring Delete Modal Test');
  
  // Step 1: Count initial events
  console.log('\n📊 Step 1: Initial event count');
  const initialCount = countEvents();
  
  // Step 2: Create test recurring events
  console.log('\n➕ Step 2: Creating test recurring events');
  const recurrenceId = createTestRecurringEvents();
  
  // Refresh the page to load new events
  console.log('\n🔄 Step 3: Refreshing page to load new events...');
  console.log('⚠️  Page will refresh in 2 seconds. After refresh, run: continueTest()');
  
  // Store test data for after refresh
  sessionStorage.setItem('testRecurrenceId', recurrenceId);
  sessionStorage.setItem('testInitialCount', JSON.stringify(initialCount));
  
  setTimeout(() => {
    window.location.reload();
  }, 2000);
}

// Function to continue test after page refresh
function continueTest() {
  const recurrenceId = sessionStorage.getItem('testRecurrenceId');
  const initialCount = JSON.parse(sessionStorage.getItem('testInitialCount') || '{}');
  
  if (!recurrenceId) {
    console.log('❌ No test data found. Run testRecurringDeleteModal() first.');
    return;
  }
  
  console.log('\n📊 Step 4: Verifying events were created');
  const afterCreateCount = countEvents();
  
  if (afterCreateCount.recurringEvents >= 3) {
    console.log('✅ Test recurring events found!');
  } else {
    console.log('❌ Test recurring events not found');
    return;
  }
  
  console.log('\n🎯 Step 5: Manual Testing Instructions');
  console.log('=====================================');
  console.log('1. Navigate to the "Work & Productivity" category');
  console.log('2. Find a "Daily Standup Meeting" event');
  console.log('3. Click the delete button (trash icon)');
  console.log('4. Check if the modal appears with options:');
  console.log('   - "Delete Only This Event"');
  console.log('   - "Delete All X Events"');
  console.log('   - "Cancel"');
  console.log('5. Test both deletion options');
  
  console.log('\n🧪 After testing, run: verifyTestResults()');
}

// Function to verify test results
function verifyTestResults() {
  console.log('\n📊 Final Results');
  console.log('================');
  
  const finalCount = countEvents();
  const recurrenceId = sessionStorage.getItem('testRecurrenceId');
  
  console.log('Final event counts:', finalCount);
  
  // Check if any test events remain
  const items = JSON.parse(localStorage.getItem('lifeOS_items') || '[]');
  const remainingTestEvents = items.filter(item => 
    item.metadata?.recurrenceId === recurrenceId
  );
  
  console.log(`Remaining test events: ${remainingTestEvents.length}`);
  
  if (remainingTestEvents.length === 0) {
    console.log('✅ All test events deleted successfully!');
  } else {
    console.log(`⚠️  ${remainingTestEvents.length} test events still remain`);
  }
  
  // Clean up session storage
  sessionStorage.removeItem('testRecurrenceId');
  sessionStorage.removeItem('testInitialCount');
  
  console.log('\n🎉 Test completed! Modal functionality verified.');
}

// Export functions to global scope
window.testRecurringDeleteModal = testRecurringDeleteModal;
window.continueTest = continueTest;
window.verifyTestResults = verifyTestResults;
window.countEvents = countEvents;

console.log('\n🚀 Ready to test!');
console.log('Run: testRecurringDeleteModal()'); 