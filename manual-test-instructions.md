# Manual Testing Instructions for All 24 Functions

## Quick Test (Recommended)

1. **Open the app**: Go to http://localhost:3000
2. **Open browser console**: Press F12 (or Cmd+Option+I on Mac)
3. **Run the comprehensive test**: Type and execute:
   ```javascript
   testGeminiFunctions()
   ```
4. **Watch the results**: You should see test results for all 24 functions

## Expected Output

You should see output like:
```
🧪 COMPREHENSIVE TESTING OF ALL 24 FUNCTIONS
🔧 Testing createItem...
✅ createItem: PASS
🔧 Testing bulkCreateItems with JSON...
✅ bulkCreateItems: PASS
...
📊 TEST SUMMARY:
Total Functions Tested: 24
Functions Working: 24
Functions Failed: 0
Success Rate: 100%
🎉 ALL FUNCTIONS ARE WORKING PERFECTLY!
```

## Individual Function Tests

If you want to test specific functions, use:

```javascript
// Test individual functions
debugGemini.testFunctionCalling()

// Or test specific functions manually:
geminiService.executeFunction('createItem', {
  title: 'Test Item',
  text: 'Test description',
  type: 'todo',
  categoryId: 'self-regulation'
})
```

## All 24 Functions List

1. **createItem** - Create single items
2. **bulkCreateItems** - Create multiple items from JSON
3. **updateItem** - Update single items
4. **deleteItem** - Delete single items
5. **bulkUpdateItems** - Update multiple items
6. **bulkDeleteItems** - Delete multiple items
7. **searchItems** - Search through items
8. **consolidateItems** - Consolidate similar items
9. **removeAsterisks** - Remove asterisks from items
10. **executeMultipleUpdates** - Execute multiple updates from JSON
11. **copyRoutineFromPerson** - Copy routines from people
12. **generateFullDaySchedule** - Generate full day schedules
13. **createCalendarFromNotes** - Create calendar events from notes
14. **bulkRescheduleEvents** - Reschedule multiple events
15. **createRecurringEvent** - Create recurring events
16. **createMultipleDateEvents** - Create events across multiple dates
17. **deleteRecurringEvent** - Delete recurring events
18. **intelligentReschedule** - Intelligently reschedule events
19. **createItemWithConflictOverride** - Create items with conflict resolution
20. **createRecurringMultipleDays** - Create recurring events across multiple days
21. **createCategory** - Create new categories
22. **updateCategory** - Update categories
23. **deleteCategory** - Delete categories
24. **reorganizeCategories** - Reorganize category structure

## Troubleshooting

### If testGeminiFunctions() is not defined:
1. Make sure the app is fully loaded
2. Try refreshing the page
3. Check if there are any console errors
4. Try: `window.testGeminiFunctions()`

### If some functions fail:
1. Check the specific error messages in console
2. Make sure you have categories set up (especially 'self-regulation')
3. Check localStorage for existing data
4. Try: `localStorage.clear()` and refresh if needed

## Success Criteria

✅ **PASS**: All 24 functions return success responses
✅ **PASS**: No JavaScript errors in console
✅ **PASS**: Functions create/update/delete items as expected
✅ **PASS**: JSON parsing works for bulkCreateItems and executeMultipleUpdates

## Next Steps

After testing passes:
1. Test the AI Assistant interface by creating items through chat
2. Test function execution by clicking "Execute Function" buttons
3. Verify all 3 modes work: Ask, Adaptive, and Agent modes
4. Test with your 100+ real use cases