#!/usr/bin/env node

// Simple Function Tester - Opens browser to run tests
const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 FUNCTION TESTING SUITE');
console.log('========================\n');

// Check if the app is running
function checkAppRunning() {
  return new Promise((resolve) => {
    const curl = exec('curl -s http://localhost:3000', (error, stdout) => {
      if (error) {
        resolve(false);
      } else {
        resolve(stdout.includes('<html>'));
      }
    });
  });
}

// Create an HTML test page that will run our tests
function createTestPage() {
  const testPageContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Function Tests</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #1a1a1a; color: #fff; }
        .container { max-width: 800px; margin: 0 auto; }
        .test-button { background: #4CAF50; color: white; padding: 10px 20px; border: none; border-radius: 5px; margin: 10px; cursor: pointer; }
        .test-button:hover { background: #45a049; }
        .results { background: #2a2a2a; padding: 20px; border-radius: 5px; margin: 10px 0; white-space: pre-wrap; font-family: monospace; }
        .success { color: #4CAF50; }
        .error { color: #f44336; }
        .info { color: #2196F3; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🧪 LifeOS Function Testing Suite</h1>
        <p>This page will test all 24 functions in your LifeOS AI Assistant.</p>
        
        <div>
            <button class="test-button" onclick="runBasicTest()">🔧 Run Basic Test</button>
            <button class="test-button" onclick="runFullTest()">🚀 Run All 24 Functions</button>
            <button class="test-button" onclick="openMainApp()">🏠 Open Main App</button>
            <button class="test-button" onclick="clearResults()">🧹 Clear Results</button>
        </div>
        
        <div id="results" class="results">
Ready to test! Click a button above to start.
        </div>
    </div>

    <script>
        const resultsDiv = document.getElementById('results');
        
        function log(message, type = 'info') {
            const timestamp = new Date().toLocaleTimeString();
            const className = type === 'success' ? 'success' : type === 'error' ? 'error' : 'info';
            resultsDiv.innerHTML += '<span class="' + className + '">[' + timestamp + '] ' + message + '</span>\\n';
            resultsDiv.scrollTop = resultsDiv.scrollHeight;
        }
        
        function clearResults() {
            resultsDiv.innerHTML = 'Results cleared.\\n';
        }
        
        function openMainApp() {
            window.open('http://localhost:3000', '_blank');
        }
        
        async function runBasicTest() {
            log('🔍 Testing connection to main app...', 'info');
            
            try {
                const response = await fetch('http://localhost:3000');
                if (response.ok) {
                    log('✅ Main app is accessible', 'success');
                    
                    // Try to get test functions from main app via postMessage
                    const mainWindow = window.open('http://localhost:3000', 'lifeostest');
                    
                    setTimeout(() => {
                        try {
                            // Try to communicate with the main app
                            mainWindow.postMessage({ type: 'TEST_FUNCTIONS_REQUEST' }, 'http://localhost:3000');
                            log('📡 Sent test request to main app', 'info');
                        } catch (e) {
                            log('⚠️ Could not communicate with main app: ' + e.message, 'error');
                            log('💡 Please manually run testGeminiFunctions() in the main app console', 'info');
                        }
                    }, 2000);
                    
                } else {
                    log('❌ Main app is not responding', 'error');
                }
            } catch (error) {
                log('❌ Error connecting to main app: ' + error.message, 'error');
                log('💡 Make sure the app is running on localhost:3000', 'info');
            }
        }
        
        async function runFullTest() {
            log('🚀 Starting comprehensive function test...', 'info');
            log('📋 Testing all 24 functions:', 'info');
            
            const functions = [
                'createItem', 'bulkCreateItems', 'updateItem', 'deleteItem',
                'bulkUpdateItems', 'bulkDeleteItems', 'searchItems', 'consolidateItems',
                'removeAsterisks', 'executeMultipleUpdates', 'copyRoutineFromPerson',
                'generateFullDaySchedule', 'createCalendarFromNotes', 'bulkRescheduleEvents',
                'createRecurringEvent', 'createMultipleDateEvents', 'deleteRecurringEvent',
                'intelligentReschedule', 'createItemWithConflictOverride', 
                'createRecurringMultipleDays', 'createCategory', 'updateCategory',
                'deleteCategory', 'reorganizeCategories'
            ];
            
            functions.forEach((func, index) => {
                log((index + 1) + '. ' + func, 'info');
            });
            
            log('\\n🔧 Opening main app for manual testing...', 'info');
            const mainWindow = window.open('http://localhost:3000', 'lifeostest');
            
            setTimeout(() => {
                log('\\n📋 MANUAL TESTING INSTRUCTIONS:', 'info');
                log('1. The main app should now be open in a new tab/window', 'info');
                log('2. Open browser console in that window (F12)', 'info');
                log('3. Run: testGeminiFunctions()', 'info');
                log('4. Watch the console for test results', 'info');
                log('5. All 24 functions will be tested automatically', 'info');
                log('\\n🎯 Expected result: "🎉 ALL FUNCTIONS ARE WORKING PERFECTLY!"', 'success');
            }, 1000);
        }
        
        // Listen for messages from main app
        window.addEventListener('message', (event) => {
            if (event.origin !== 'http://localhost:3000') return;
            
            if (event.data.type === 'TEST_RESULTS') {
                log('📊 Received test results from main app:', 'success');
                log(JSON.stringify(event.data.results, null, 2), 'info');
            }
        });
        
        // Initial check
        document.addEventListener('DOMContentLoaded', () => {
            log('🧪 Function Testing Suite Loaded', 'success');
            log('Click "Run Basic Test" to check app connectivity', 'info');
            log('Click "Run All 24 Functions" for comprehensive testing', 'info');
        });
    </script>
</body>
</html>`;

  fs.writeFileSync('function-test-page.html', testPageContent);
  return path.resolve('function-test-page.html');
}

async function main() {
  console.log('🔍 Checking if app is running on localhost:3000...');
  
  const isRunning = await checkAppRunning();
  
  if (!isRunning) {
    console.log('❌ App is not running on localhost:3000');
    console.log('🚀 Please start the app first:');
    console.log('   npm start');
    return;
  }
  
  console.log('✅ App is running on localhost:3000');
  console.log('🔧 Creating test page...');
  
  const testPagePath = createTestPage();
  console.log(`✅ Test page created: ${testPagePath}`);
  
  console.log('\\n🌐 Opening test page in browser...');
  
  // Try to open in browser (works on macOS)
  const open = spawn('open', [testPagePath]);
  
  open.on('error', () => {
    // If 'open' command fails, try other methods
    console.log('⚠️ Could not auto-open browser');
    console.log(`📂 Please manually open: file://${testPagePath}`);
  });
  
  open.on('close', (code) => {
    if (code === 0) {
      console.log('✅ Test page opened in browser');
    }
  });
  
  console.log('\\n📋 TEST INSTRUCTIONS:');
  console.log('1. Test page should open in your browser');
  console.log('2. Click "Run All 24 Functions" button');
  console.log('3. Follow the instructions in the test page');
  console.log('4. Check console output for results');
  
  console.log('\\n🎯 QUICK MANUAL TEST:');
  console.log('1. Open http://localhost:3000');
  console.log('2. Open browser console (F12)');
  console.log('3. Run: testGeminiFunctions()');
  console.log('4. Watch for "🎉 ALL FUNCTIONS ARE WORKING PERFECTLY!"');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { createTestPage, checkAppRunning };