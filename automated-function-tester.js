#!/usr/bin/env node

// Automated Function Tester using Puppeteer
// This script opens the app in a headless browser and runs all function tests

const puppeteer = require('puppeteer');
const fs = require('fs');

async function runAutomatedTests() {
  let browser;
  
  try {
    console.log('🚀 Starting automated function testing...');
    
    // Launch browser
    browser = await puppeteer.launch({
      headless: false, // Set to true for headless mode
      defaultViewport: { width: 1200, height: 800 },
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Enable console logging from the page
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      
      // Filter and format console messages from the page
      if (text.includes('🧪') || text.includes('✅') || text.includes('❌') || text.includes('📊')) {
        console.log(`[PAGE] ${text}`);
      }
    });
    
    // Navigate to the app
    console.log('🌐 Navigating to localhost:3000...');
    await page.goto('http://localhost:3000', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Wait for the app to load
    console.log('⏳ Waiting for app to load...');
    await page.waitForTimeout(5000);
    
    // Check if we need to skip auth or onboarding
    const skipAuthExists = await page.$('[data-testid="skip-auth"]') || await page.$('button:contains("Skip")');
    if (skipAuthExists) {
      console.log('🔓 Skipping authentication...');
      await page.click('[data-testid="skip-auth"], button:contains("Skip")').catch(() => {});
      await page.waitForTimeout(2000);
    }
    
    // Wait for React and services to load
    await page.waitForFunction(() => {
      return window.React && window.testGeminiFunctions;
    }, { timeout: 15000 }).catch(() => {
      console.log('⚠️ testGeminiFunctions not found, but continuing...');
    });
    
    console.log('🧪 Running comprehensive function tests...');
    
    // Inject and run our test suite
    const testResults = await page.evaluate(async () => {
      // Wait for gemini service to be available
      let attempts = 0;
      while (!window.testGeminiFunctions && attempts < 20) {
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
      }
      
      if (!window.testGeminiFunctions) {
        return { error: 'testGeminiFunctions not available after waiting' };
      }
      
      console.log('🚀 STARTING AUTOMATED FUNCTION TESTS');
      
      try {
        // Run the comprehensive test suite
        await window.testGeminiFunctions();
        return { success: true, message: 'Tests completed successfully' };
      } catch (error) {
        return { error: error.message, stack: error.stack };
      }
    });
    
    console.log('\n📊 TEST RESULTS:');
    if (testResults.error) {
      console.log('❌ Test execution failed:', testResults.error);
    } else {
      console.log('✅ Automated tests completed successfully!');
      console.log('📋 Check the [PAGE] console output above for detailed results');
    }
    
    // Take a screenshot for verification
    await page.screenshot({ 
      path: 'test-results-screenshot.png',
      fullPage: true 
    });
    console.log('📸 Screenshot saved as test-results-screenshot.png');
    
    // Wait a bit to see final results
    await page.waitForTimeout(3000);
    
  } catch (error) {
    console.error('❌ Automated testing error:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Simple test without Puppeteer if it's not available
async function runSimpleTest() {
  console.log('🧪 Running simple test (manual verification required)...');
  console.log('📋 Please open http://localhost:3000 in your browser');
  console.log('🔧 Open browser console and run: testGeminiFunctions()');
  console.log('📊 This will test all 24 functions automatically');
  
  // Try to use curl to check if specific endpoints work
  const { spawn } = require('child_process');
  
  console.log('\n🌐 Checking app accessibility...');
  const curl = spawn('curl', ['-s', 'http://localhost:3000']);
  
  curl.stdout.on('data', (data) => {
    if (data.toString().includes('<title>')) {
      console.log('✅ App is accessible at localhost:3000');
    }
  });
  
  curl.on('close', (code) => {
    if (code === 0) {
      console.log('✅ App connectivity test passed');
      console.log('\n🚀 Ready for manual testing!');
      console.log('📋 Instructions:');
      console.log('1. Open http://localhost:3000');
      console.log('2. Open browser console (F12)');
      console.log('3. Run: testGeminiFunctions()');
      console.log('4. Watch the test results');
    } else {
      console.log('❌ App connectivity test failed');
    }
  });
}

// Check if puppeteer is available
async function main() {
  try {
    require.resolve('puppeteer');
    console.log('🎭 Puppeteer found, running automated tests...');
    await runAutomatedTests();
  } catch (error) {
    console.log('⚠️ Puppeteer not found, running simple test...');
    await runSimpleTest();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { runAutomatedTests, runSimpleTest };