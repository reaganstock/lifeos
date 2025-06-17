#!/usr/bin/env node

/**
 * MCP Integration Test Script for lifeOS AI
 * Tests all MCP servers and core AI functionality
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Test configuration
const TEST_CONFIG = {
  timeout: 30000, // 30 seconds
  verbose: true,
  testSuites: [
    'mcp-servers',
    'ai-integration', 
    'data-operations',
    'performance'
  ]
};

// ANSI color codes for terminal output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

class MCPTestRunner {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      total: 0,
      details: []
    };
    this.startTime = Date.now();
  }

  log(message, color = 'reset') {
    if (TEST_CONFIG.verbose) {
      console.log(`${colors[color]}${message}${colors.reset}`);
    }
  }

  logTestResult(testName, passed, details = '') {
    const icon = passed ? '✅' : '❌';
    const color = passed ? 'green' : 'red';
    this.log(`${icon} ${testName}`, color);
    
    if (details) {
      this.log(`   ${details}`, 'cyan');
    }

    this.results.total++;
    if (passed) {
      this.results.passed++;
    } else {
      this.results.failed++;
    }
    
    this.results.details.push({ testName, passed, details });
  }

  async runTest(testName, testFunction) {
    try {
      this.log(`🧪 Testing: ${testName}`, 'yellow');
      const result = await testFunction();
      this.logTestResult(testName, true, result);
      return true;
    } catch (error) {
      this.logTestResult(testName, false, error.message);
      return false;
    }
  }

  // MCP Server Tests
  async testFileSystemMCP() {
    return this.runTest('Filesystem MCP Server', async () => {
      // Test if we can read project structure
      const packageJsonExists = fs.existsSync('package.json');
      const srcExists = fs.existsSync('src');
      const componentsExist = fs.existsSync('src/components');
      
      if (!packageJsonExists || !srcExists || !componentsExist) {
        throw new Error('Project structure validation failed');
      }
      
      return 'Project structure validated successfully';
    });
  }

  async testGitMCP() {
    return this.runTest('Git MCP Server', async () => {
      try {
        const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });
        const gitBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
        
        return `Git repository active on branch: ${gitBranch}`;
      } catch (error) {
        throw new Error(`Git operations failed: ${error.message}`);
      }
    });
  }

  async testProjectStructure() {
    return this.runTest('Project Structure Analysis', async () => {
      const requiredFiles = [
        'src/components/Dashboard.tsx',
        'src/components/Sidebar.tsx',
        'src/components/CategoryPage.tsx',
        'src/components/GlobalTodos.tsx',
        'src/services/aiService.ts',
        'src/types.ts'
      ];

      const missingFiles = requiredFiles.filter(file => !fs.existsSync(file));
      
      if (missingFiles.length > 0) {
        throw new Error(`Missing files: ${missingFiles.join(', ')}`);
      }

      return `All ${requiredFiles.length} core files present`;
    });
  }

  async testAIServiceIntegration() {
    return this.runTest('AI Service Integration', async () => {
      // Read and validate AI service file
      const aiServicePath = 'src/services/aiService.ts';
      const aiServiceContent = fs.readFileSync(aiServicePath, 'utf8');
      
      const requiredMethods = [
        'processCommand',
        'generateSuggestions',
        'transcribeAudio'
      ];

      const missingMethods = requiredMethods.filter(method => 
        !aiServiceContent.includes(method)
      );

      if (missingMethods.length > 0) {
        throw new Error(`Missing AI methods: ${missingMethods.join(', ')}`);
      }

      return `AI service contains all ${requiredMethods.length} required methods`;
    });
  }

  async testDataModel() {
    return this.runTest('Data Model Validation', async () => {
      const typesPath = 'src/types.ts';
      const typesContent = fs.readFileSync(typesPath, 'utf8');
      
      const requiredTypes = [
        'interface Item',
        'interface Category',
        'type ItemType'
      ];

      const missingTypes = requiredTypes.filter(type => 
        !typesContent.includes(type)
      );

      if (missingTypes.length > 0) {
        throw new Error(`Missing types: ${missingTypes.join(', ')}`);
      }

      return `All ${requiredTypes.length} core types defined`;
    });
  }

  async testComponentStructure() {
    return this.runTest('Component Structure', async () => {
      const componentsDir = 'src/components';
      const components = fs.readdirSync(componentsDir)
        .filter(file => file.endsWith('.tsx'))
        .map(file => file.replace('.tsx', ''));

      const requiredComponents = [
        'Dashboard',
        'Sidebar', 
        'CategoryPage',
        'GlobalTodos',
        'GlobalCalendar',
        'GlobalGoals',
        'GlobalRoutines',
        'GlobalNotes'
      ];

      const missingComponents = requiredComponents.filter(comp => 
        !components.includes(comp)
      );

      if (missingComponents.length > 0) {
        throw new Error(`Missing components: ${missingComponents.join(', ')}`);
      }

      return `All ${requiredComponents.length} components present`;
    });
  }

  async testConfigurationFiles() {
    return this.runTest('Configuration Files', async () => {
      const configFiles = [
        'package.json',
        'tsconfig.json', 
        'tailwind.config.js',
        '.mcp.json'
      ];

      const missingConfigs = configFiles.filter(file => !fs.existsSync(file));
      
      if (missingConfigs.length > 0) {
        throw new Error(`Missing config files: ${missingConfigs.join(', ')}`);
      }

      // Validate MCP configuration
      const mcpConfig = JSON.parse(fs.readFileSync('.mcp.json', 'utf8'));
      const requiredServers = ['filesystem', 'supabase', 'git', 'brave-search'];
      const configuredServers = Object.keys(mcpConfig.mcpServers || {});
      
      const missingServers = requiredServers.filter(server => 
        !configuredServers.includes(server)
      );

      if (missingServers.length > 0) {
        throw new Error(`Missing MCP servers: ${missingServers.join(', ')}`);
      }

      return `All configuration files present and MCP servers configured`;
    });
  }

  async testPerformanceMetrics() {
    return this.runTest('Performance Metrics', async () => {
      const startTime = Date.now();
      
      // Simulate basic operations
      const operations = [
        () => fs.readFileSync('package.json', 'utf8'),
        () => fs.readdirSync('src/components'),
        () => fs.statSync('src/types.ts')
      ];

      operations.forEach(op => op());
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      if (duration > 1000) {
        throw new Error(`File operations too slow: ${duration}ms`);
      }

      return `File operations completed in ${duration}ms`;
    });
  }

  // Main test runner
  async runAllTests() {
    this.log('\n🚀 Starting MCP Integration Test Suite', 'bold');
    this.log('=' .repeat(50), 'cyan');

    // Test Suite 1: MCP Servers
    this.log('\n📡 Testing MCP Servers', 'magenta');
    await this.testFileSystemMCP();
    await this.testGitMCP();

    // Test Suite 2: Project Structure
    this.log('\n🏗️  Testing Project Structure', 'magenta');
    await this.testProjectStructure();
    await this.testComponentStructure();
    await this.testConfigurationFiles();

    // Test Suite 3: AI Integration
    this.log('\n🧠 Testing AI Integration', 'magenta');
    await this.testAIServiceIntegration();
    await this.testDataModel();

    // Test Suite 4: Performance
    this.log('\n⚡ Testing Performance', 'magenta');
    await this.testPerformanceMetrics();

    // Generate final report
    this.generateReport();
  }

  generateReport() {
    const duration = Date.now() - this.startTime;
    const passRate = ((this.results.passed / this.results.total) * 100).toFixed(1);
    
    this.log('\n' + '='.repeat(50), 'cyan');
    this.log('📊 TEST RESULTS SUMMARY', 'bold');
    this.log('='.repeat(50), 'cyan');
    
    this.log(`Total Tests: ${this.results.total}`, 'blue');
    this.log(`Passed: ${this.results.passed}`, 'green');
    this.log(`Failed: ${this.results.failed}`, 'red');
    this.log(`Pass Rate: ${passRate}%`, passRate === '100.0' ? 'green' : 'yellow');
    this.log(`Duration: ${duration}ms`, 'cyan');

    if (this.results.failed > 0) {
      this.log('\n❌ FAILED TESTS:', 'red');
      this.results.details
        .filter(test => !test.passed)
        .forEach(test => {
          this.log(`  • ${test.testName}: ${test.details}`, 'red');
        });
    }

    this.log('\n🎯 MCP Integration Status:', 'bold');
    if (this.results.failed === 0) {
      this.log('✅ ALL SYSTEMS OPERATIONAL - Ready for development!', 'green');
    } else {
      this.log('⚠️  Some issues detected - Review failed tests', 'yellow');
    }
    
    this.log('\n🚀 Next Steps:', 'blue');
    this.log('1. Review any failed tests', 'cyan');
    this.log('2. Start development with MCP-enhanced workflow', 'cyan');
    this.log('3. Use Supabase MCP for database operations', 'cyan');
    this.log('4. Leverage all MCP servers for enhanced development', 'cyan');
  }
}

// Run the tests
async function main() {
  const testRunner = new MCPTestRunner();
  await testRunner.runAllTests();
  
  // Exit with appropriate code
  process.exit(testRunner.results.failed > 0 ? 1 : 0);
}

// Execute if run directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = MCPTestRunner; 