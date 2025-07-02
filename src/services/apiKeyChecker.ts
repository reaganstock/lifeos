/**
 * API Key Configuration Checker for lifeOS AI
 * Helps troubleshoot and validate API key setup
 */

export interface APIKeyStatus {
  openrouter: {
    configured: boolean;
    present: boolean;
    masked?: string;
  };
  gemini: {
    configured: boolean;
    present: boolean;
    masked?: string;
  };
  recommendation: string;
}

export class APIKeyChecker {
  
  static checkConfiguration(): APIKeyStatus {
    const openrouterKey = process.env.REACT_APP_OPENROUTER_API_KEY;
    const geminiKey = process.env.REACT_APP_GEMINI_API_KEY;
    
    const openrouterConfigured = Boolean(openrouterKey && openrouterKey.length > 10);
    const geminiConfigured = Boolean(geminiKey && geminiKey.length > 10);
    
    let recommendation = '';
    
    if (!openrouterConfigured && !geminiConfigured) {
      recommendation = '⚠️ No API keys configured. Please add REACT_APP_OPENROUTER_API_KEY or REACT_APP_GEMINI_API_KEY to your .env file.';
    } else if (!openrouterConfigured) {
      recommendation = '💡 Only Gemini configured. Add REACT_APP_OPENROUTER_API_KEY for access to 300+ models (Claude, GPT, etc.).';
    } else if (!geminiConfigured) {
      recommendation = '💡 Only OpenRouter configured. Add REACT_APP_GEMINI_API_KEY for direct Gemini API access.';
    } else {
      recommendation = '✅ Both APIs configured! You have access to all models.';
    }
    
    return {
      openrouter: {
        configured: openrouterConfigured,
        present: Boolean(openrouterKey),
        masked: openrouterKey ? `${openrouterKey.substring(0, 8)}...${openrouterKey.substring(openrouterKey.length - 4)}` : undefined
      },
      gemini: {
        configured: geminiConfigured,
        present: Boolean(geminiKey),
        masked: geminiKey ? `${geminiKey.substring(0, 8)}...${geminiKey.substring(geminiKey.length - 4)}` : undefined
      },
      recommendation
    };
  }
  
  static logConfiguration(): void {
    // Only log API configuration in development mode
    if (process.env.NODE_ENV !== 'development') {
      return;
    }
    
    const status = this.checkConfiguration();
    
    console.log('\n🔧 lifeOS AI - API Configuration Status');
    console.log('=====================================');
    console.log(`OpenRouter: ${status.openrouter.configured ? '✅ Configured' : '❌ Missing'}`);
    console.log(`Gemini:     ${status.gemini.configured ? '✅ Configured' : '❌ Missing'}`);
    console.log('\n💡 Recommendation:');
    console.log(status.recommendation);
    console.log('\n📚 Setup guide: See GEMINI_INTEGRATION.md');
    console.log('=====================================\n');
  }
  
  static getAvailableModels(): string[] {
    const status = this.checkConfiguration();
    const models: string[] = [];
    
    if (status.gemini.configured) {
      models.push('gemini-2.5-flash-preview-05-20', 'gemini-1.5-pro', 'gemini-1.5-flash');
    }
    
    if (status.openrouter.configured) {
      models.push(
        'claude-sonnet-4', 'claude-opus-4', 'gpt-4.1', 
        'deepseek-r1', 'grok-3-beta', 'gemini-via-openrouter'
      );
    }
    
    return models;
  }
  
  static validateEnvironment(): boolean {
    const status = this.checkConfiguration();
    return status.openrouter.configured || status.gemini.configured;
  }
}

// Auto-log configuration on import in development
if (process.env.NODE_ENV === 'development') {
  setTimeout(() => {
    APIKeyChecker.logConfiguration();
  }, 1000);
} 