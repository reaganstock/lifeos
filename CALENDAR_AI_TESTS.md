# 🧪 Calendar AI Test Suite

## Test Environment Setup
1. Start the app: `npm start`
2. Navigate to any category page
3. Press 'i' to open AI chat interface
4. Run tests in order (some depend on previous test data)

---

## 🗓️ **TEST 1: Multiple Date Scheduling**

### Test 1A: Basic Multiple Date Creation
**Input:** "Schedule gym sessions for December 16th, 18th, and 20th at 7 AM"

**Expected Result:**
- ✅ Creates 3 separate gym events
- ✅ All events at 7:00 AM on specified dates
- ✅ All categorized as "gym-calisthenics"
- ✅ Each event has proper start/end times
- ✅ Success message: "Created 3 events: gym sessions"

### Test 1B: Multiple Dates with Conflicts
**Setup:** First create a conflicting event: "Schedule dentist appointment for December 16th at 7 AM"
**Input:** "Schedule workout sessions for December 16th, 17th, 18th at 7 AM"

**Expected Result:**
- ✅ Reports conflict for December 16th
- ✅ Creates events for December 17th and 18th
- ✅ Message: "Created 2 events (1 conflict/error)"
- ✅ Lists the conflict details

### Test 1C: Multiple Dates with Time Range
**Input:** "Book meetings for December 19th, 20th, 21st from 2 PM to 3 PM"

**Expected Result:**
- ✅ Creates 3 meeting events
- ✅ All events from 14:00 to 15:00
- ✅ Proper duration calculation (60 minutes)
- ✅ Work-productivity category

---

## 🔄 **TEST 2: Fixed Bulk Reschedule**

### Test 2A: Push All Events Back
**Setup:** Ensure you have several events in your calendar
**Input:** "Push all events back 1 week"

**Expected Result:**
- ✅ All events moved forward by 7 days
- ✅ Start and end times preserved
- ✅ Success message with count: "Successfully rescheduled X events by +1 week"
- ✅ Shows first 5 rescheduled events with new times

### Test 2B: Pull Events Forward
**Input:** "Move all my events back 3 days"

**Expected Result:**
- ✅ All events moved backward by 3 days
- ✅ Proper date arithmetic
- ✅ Success message: "Successfully rescheduled X events by -3 days"

### Test 2C: Reschedule Specific Category
**Input:** "Push all gym events forward 2 days"

**Expected Result:**
- ✅ Only gym-calisthenics events moved
- ✅ Other events unchanged
- ✅ Filtered reschedule confirmation

### Test 2D: Reschedule with Date Range
**Input:** "Move all events from December 16-20 back 1 day"

**Expected Result:**
- ✅ Only events in specified range moved
- ✅ Events outside range unchanged
- ✅ Proper date range filtering

---

## 🔁 **TEST 3: Recurring Event Deletion**

### Test 3A: Create Recurring Event First
**Input:** "Create a daily standup meeting at 9 AM starting tomorrow for 2 weeks"

**Expected Result:**
- ✅ Creates multiple recurring events
- ✅ All linked with same recurrenceId
- ✅ Each marked as isRecurring: true

### Test 3B: Delete Single Occurrence (UI Test)
**Steps:**
1. Go to calendar view
2. Find one of the recurring standup meetings
3. Click delete button
4. In confirmation dialog, click "Cancel" (delete only this occurrence)

**Expected Result:**
- ✅ Shows confirmation dialog with options
- ✅ Only selected occurrence deleted
- ✅ Other occurrences remain
- ✅ Dialog text: "Delete only this occurrence" vs "Delete all X occurrences"

### Test 3C: Delete All Occurrences (UI Test)
**Steps:**
1. Find another recurring standup meeting
2. Click delete button  
3. In confirmation dialog, click "OK" (delete all occurrences)

**Expected Result:**
- ✅ All recurring events with same recurrenceId deleted
- ✅ Calendar cleared of all standup meetings
- ✅ Confirmation message shows total deleted

### Test 3D: Delete via AI Chat
**Input:** "Delete my daily standup meeting - all occurrences"

**Expected Result:**
- ✅ AI uses deleteRecurringEvent function
- ✅ Asks for confirmation about all occurrences
- ✅ Deletes all when confirmed

---

## 🧠 **TEST 4: Intelligent Rescheduling**

### Test 4A: Missed Workout Rescheduling
**Setup:** Create a workout event for this morning at 6 AM
**Input:** "I missed my morning workout, reschedule it intelligently"

**Expected Result:**
- ✅ Original workout event deleted
- ✅ New workout event created for next available slot
- ✅ Searches from 6 AM to 10 PM for free time
- ✅ Avoids conflicts with existing events
- ✅ Message: "Canceled [workout] and intelligently rescheduled 1 related events"
- ✅ Shows new time and reason: "Missed workout - automatically rescheduled"

### Test 4B: Canceled Work Meeting Shift
**Setup:** 
1. Create work meeting at 10 AM
2. Create another work meeting at 11 AM  
3. Create third work meeting at 12 PM
**Input:** "Cancel my 10 AM meeting and shift other work events intelligently"

**Expected Result:**
- ✅ 10 AM meeting deleted
- ✅ 11 AM meeting moved to 10 AM
- ✅ 12 PM meeting moved to 11 AM
- ✅ Work events shifted earlier to fill gap
- ✅ Reason: "Shifted earlier due to canceled meeting"

### Test 4C: Non-Workout/Work Event
**Setup:** Create a social event
**Input:** "Cancel my dinner party and reschedule intelligently"

**Expected Result:**
- ✅ Event canceled
- ✅ No automatic rescheduling (not workout/work category)
- ✅ Message: "Canceled [dinner party] (no related events to reschedule)"

---

## 📅 **TEST 5: Advanced Scheduling Scenarios**

### Test 5A: Weekly Recurring with Multiple Dates
**Input:** "Schedule team meetings every Tuesday and Thursday at 3 PM for the next month"

**Expected Result:**
- ✅ Creates recurring events for both days
- ✅ Proper recurrence pattern
- ✅ All events linked with recurrenceId

### Test 5B: Complex Bulk Operations
**Input:** "Create workout sessions for every weekday next week at 6 AM, then push them all back 2 hours"

**Expected Result:**
- ✅ Step 1: Creates 5 workout events (Mon-Fri at 6 AM)
- ✅ Step 2: Moves all to 8 AM
- ✅ Both operations succeed

### Test 5C: Conflict Resolution with Alternatives
**Setup:** Create event at 2 PM
**Input:** "Schedule important meeting at 2 PM tomorrow"

**Expected Result:**
- ✅ Detects conflict
- ✅ Suggests alternative times (1:30 PM, 2:30 PM, etc.)
- ✅ Asks user preference
- ✅ Options: different time, cancel existing, create anyway

---

## 🔍 **TEST 6: Error Handling & Edge Cases**

### Test 6A: Invalid Time Shift Format
**Input:** "Push all events back next week"

**Expected Result:**
- ✅ Error message: "Invalid time shift format"
- ✅ Suggests correct format: "+1 week", "-3 days", "+2 months"

### Test 6B: No Events to Reschedule
**Input:** "Push all gym events back 1 week" (when no gym events exist)

**Expected Result:**
- ✅ Message: "No events found to reschedule with the given criteria"
- ✅ Shows search criteria used

### Test 6C: Mixed Date Object Handling
**Setup:** Have events with different date formats in storage
**Input:** "Push all events back 1 day"

**Expected Result:**
- ✅ Handles both Date objects and date strings
- ✅ No parsing errors
- ✅ All events moved correctly

### Test 6D: Partial Success Scenarios
**Setup:** Create mix of valid and problematic events
**Input:** "Push all events back 1 week"

**Expected Result:**
- ✅ Reschedules valid events
- ✅ Reports errors for problematic ones
- ✅ Message: "Successfully rescheduled X events (Y errors)"
- ✅ Lists first 3 errors

---

## 🎯 **TEST 7: Integration Tests**

### Test 7A: Full Workflow Test
**Steps:**
1. "Schedule gym sessions for Monday, Wednesday, Friday at 6 AM"
2. "Make them recurring weekly for 4 weeks"
3. "Push all gym events back 1 hour"
4. Delete one occurrence via UI
5. "Cancel Wednesday's workout and reschedule intelligently"

**Expected Result:**
- ✅ All steps work seamlessly
- ✅ Proper state management
- ✅ No data corruption

### Test 7B: Category Mapping Integration
**Input:** "Schedule dating events for Saturday and Sunday at 7 PM"

**Expected Result:**
- ✅ Events created with "social-charisma" category (not "dating")
- ✅ Category mapping works with multiple dates
- ✅ Proper categorization

### Test 7C: Conflict Detection Across Features
**Setup:** Create overlapping events using different methods
**Input:** Various scheduling commands that should conflict

**Expected Result:**
- ✅ Consistent conflict detection
- ✅ 30-minute window respected
- ✅ Alternative suggestions provided

---

## 📊 **SUCCESS CRITERIA**

### ✅ **PASS Requirements:**
- All basic functionality works without errors
- Proper error messages for invalid inputs
- UI confirmation dialogs work correctly
- Date handling is robust (no parsing errors)
- Category mapping functions properly
- Conflict detection is accurate

### 🚨 **CRITICAL Issues to Report:**
- Any TypeScript compilation errors
- Calendar events not appearing correctly
- Data loss or corruption
- Infinite loops or crashes
- Incorrect date calculations
- Missing confirmation dialogs

---

## 🔧 **Debugging Tips**

1. **Check Browser Console:** Look for JavaScript errors
2. **Verify Data Storage:** Check localStorage for corrupted data
3. **Test Date Formats:** Ensure consistent date handling
4. **Category Validation:** Confirm category IDs exist
5. **Conflict Logic:** Verify 30-minute window calculation

---

## 📝 **Test Results Template**

```
TEST RESULTS - [Date]

✅ PASSED:
- Test 1A: Multiple Date Scheduling
- Test 2A: Bulk Reschedule
- [etc...]

❌ FAILED:
- Test X: [Description]
  Error: [Details]
  Expected: [What should happen]
  Actual: [What happened]

🔧 ISSUES FOUND:
- [List any bugs or improvements needed]

OVERALL STATUS: [PASS/FAIL]
```

Run these tests systematically and report any failures. The calendar AI should handle all scenarios gracefully with proper error messages and user feedback. 