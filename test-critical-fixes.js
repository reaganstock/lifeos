// Test script for critical calendar AI fixes
// Run this in browser console on localhost:3000

console.log('🧪 Testing Critical Calendar AI Fixes');
console.log('=====================================');

// Test 1: Date Parsing Fix
console.log('\n📅 Test 1: Date Parsing for "today" vs numbered dates');
const today = new Date();
console.log('Actual today:', today.toISOString().split('T')[0]);
console.log('Today date number:', today.getDate());

// Test 2: Intelligent Rescheduling Fix
console.log('\n🔄 Test 2: Intelligent Rescheduling (should move, not duplicate)');

async function testIntelligentReschedule() {
  try {
    // First, create a workout event for today at 6 AM
    console.log('Step 1: Creating workout event for today at 6 AM...');
    
    // Get current items count
    const initialItems = JSON.parse(localStorage.getItem('lifeOS_items') || '[]');
    const initialEventCount = initialItems.filter(item => item.type === 'event').length;
    console.log('Initial event count:', initialEventCount);
    
    // Create workout event
    const createMessage = 'add a workout event for today at 6 am';
    console.log('Sending message:', createMessage);
    
    // Simulate AI message (you'll need to actually send this through the UI)
    console.log('⚠️  Please manually send this message in the AI chat: "' + createMessage + '"');
    console.log('Then wait for it to complete and run the next test...');
    
    // Wait for user to complete the first step
    setTimeout(() => {
      console.log('\n📊 After creating workout event:');
      const afterCreateItems = JSON.parse(localStorage.getItem('lifeOS_items') || '[]');
      const afterCreateEventCount = afterCreateItems.filter(item => item.type === 'event').length;
      console.log('Event count after creation:', afterCreateEventCount);
      
      const workoutEvents = afterCreateItems.filter(item => 
        item.type === 'event' && 
        (item.title.toLowerCase().includes('workout') || item.title.toLowerCase().includes('gym'))
      );
      console.log('Workout events found:', workoutEvents.length);
      workoutEvents.forEach(event => {
        console.log('- Workout event:', event.title, 'at', event.dateTime);
      });
      
      console.log('\n🔄 Step 2: Now test intelligent rescheduling...');
      console.log('⚠️  Please manually send this message: "I missed my morning workout, reschedule it intelligently"');
      
      setTimeout(() => {
        console.log('\n📊 After intelligent rescheduling:');
        const afterRescheduleItems = JSON.parse(localStorage.getItem('lifeOS_items') || '[]');
        const afterRescheduleEventCount = afterRescheduleItems.filter(item => item.type === 'event').length;
        console.log('Event count after rescheduling:', afterRescheduleEventCount);
        
        const workoutEventsAfter = afterRescheduleItems.filter(item => 
          item.type === 'event' && 
          (item.title.toLowerCase().includes('workout') || item.title.toLowerCase().includes('gym'))
        );
        console.log('Workout events after rescheduling:', workoutEventsAfter.length);
        workoutEventsAfter.forEach(event => {
          console.log('- Workout event:', event.title, 'at', event.dateTime);
        });
        
        // Check if we have the same number of events (moved, not duplicated)
        if (afterRescheduleEventCount === afterCreateEventCount) {
          console.log('✅ SUCCESS: Event was moved, not duplicated!');
        } else {
          console.log('❌ FAILURE: Event count changed, likely created duplicate');
        }
        
        // Check if workout was actually rescheduled to a different time
        if (workoutEventsAfter.length === 1) {
          const originalTime = workoutEvents[0]?.dateTime;
          const newTime = workoutEventsAfter[0]?.dateTime;
          if (originalTime !== newTime) {
            console.log('✅ SUCCESS: Workout time was changed from', originalTime, 'to', newTime);
          } else {
            console.log('❌ FAILURE: Workout time was not changed');
          }
        }
        
      }, 10000); // Wait 10 seconds for rescheduling
      
    }, 5000); // Wait 5 seconds for creation
    
  } catch (error) {
    console.error('Test error:', error);
  }
}

// Test 3: Date Context Fix
console.log('\n📅 Test 3: Date Context (should use correct "today")');
console.log('When you create events for "today", they should use:', today.toISOString().split('T')[0]);
console.log('NOT the next day or wrong date');

console.log('\n🚀 Ready to test! Follow the manual steps above.');
console.log('Or run: testIntelligentReschedule()');

// Export the test function
window.testIntelligentReschedule = testIntelligentReschedule; 