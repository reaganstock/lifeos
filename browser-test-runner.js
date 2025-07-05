// Browser Test Runner - Copy and paste this into browser console at localhost:3000
// This will test all 24 functions automatically

console.log('🧪 BROWSER TEST RUNNER LOADING...');

async function runComprehensiveFunctionTest() {
  console.log('🚀 STARTING COMPREHENSIVE FUNCTION TEST');
  console.log('==========================================\n');
  
  // Check if test functions are available
  if (!window.testGeminiFunctions) {
    console.error('❌ testGeminiFunctions not available');
    console.log('💡 Waiting for app to load...');
    
    // Wait for functions to be available
    let attempts = 0;
    while (!window.testGeminiFunctions && attempts < 20) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
      console.log(`⏳ Waiting... (${attempts}/20)`);
    }
    
    if (!window.testGeminiFunctions) {
      console.error('❌ Functions still not available after waiting');
      console.log('🔧 Try refreshing the page and running this again');
      return;
    }
  }
  
  console.log('✅ Test functions found! Starting tests...\n');
  
  try {
    // Run the comprehensive test suite
    await window.testGeminiFunctions();
    
    console.log('\n🏁 TEST EXECUTION COMPLETE!');
    console.log('📊 Check the output above for detailed results');
    
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    console.log('🔧 Try running: debugGemini.testFunctionCalling() for basic test');
  }
}

// Also provide individual test functions
window.functionTestRunner = {
  runAll: runComprehensiveFunctionTest,
  
  testBasic: async () => {
    console.log('🔧 Running basic function test...');
    if (window.debugGemini && window.debugGemini.testFunctionCalling) {
      await window.debugGemini.testFunctionCalling();
    } else {
      console.error('❌ debugGemini.testFunctionCalling not available');
    }
  },
  
  listAvailable: () => {
    console.log('📋 Available Test Functions:');
    console.log('- functionTestRunner.runAll() - Run all 24 function tests');
    console.log('- functionTestRunner.testBasic() - Run basic test');
    console.log('- testGeminiFunctions() - Direct test call');
    console.log('- debugGemini.testFunctionCalling() - Basic function test');
  },
  
  checkFunctions: () => {
    console.log('🔍 Checking available functions...');
    const checks = {
      'testGeminiFunctions': !!window.testGeminiFunctions,
      'debugGemini': !!window.debugGemini,
      'geminiService': !!window.geminiService,
      'React': !!window.React
    };
    
    Object.entries(checks).forEach(([name, available]) => {
      const status = available ? '✅' : '❌';
      console.log(`${status} ${name}: ${available ? 'Available' : 'Not found'}`);
    });
    
    return checks;
  }
};

console.log('✅ Browser Test Runner Loaded!');
console.log('📋 Available commands:');
console.log('- functionTestRunner.runAll() - Run all tests');
console.log('- functionTestRunner.checkFunctions() - Check what\'s available');
console.log('- functionTestRunner.listAvailable() - List all commands');
console.log('\n🚀 To start testing, run: functionTestRunner.runAll()');

// Auto-run check to see what's available
functionTestRunner.checkFunctions();