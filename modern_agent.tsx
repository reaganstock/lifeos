// MODERN AGENTIC AI - Based on 2024/2025 best practices
// Inspired by Cursor AI and Claude Code behavior patterns

// Simple conversational detection - context-aware
const isConversationalMessage = (message: string): boolean => {
  const lower = message.toLowerCase().trim();
  
  // Simple greetings and check-ins
  const greetings = [
    /^(hi|hello|hey|yo|sup)(\s|$)/,
    /^how\s*(are\s*you|'s\s*it\s*going)/,
    /^what\s*(up|'s\s*up)/,
    /^good\s*(morning|afternoon|evening)/,
    /^thanks?(\s+you)?$/
  ];
  
  // Personal inquiries
  const personalQuestions = [
    /i was just wondering/,
    /how (are )?you (doing|feeling)/,
    /just curious/,
    /just checking/
  ];
  
  // Clear rejections
  const rejections = [
    /^no\s+(i\s+)?(don't|didn't|won't|wouldn't)/,
    /^(i\s+)?(don't|didn't|won't|wouldn't)\s+want/,
    /^nevermind/,
    /^forget\s+(it|that)/,
    /^cancel\s+that/
  ];
  
  return greetings.some(p => p.test(lower)) ||
         personalQuestions.some(p => p.test(lower)) ||
         rejections.some(p => p.test(lower));
};

// Modern intent detection - simple but effective
const detectUserIntent = (message: string): 'action' | 'conversation' | 'question' => {
  if (isConversationalMessage(message)) return 'conversation';
  
  const lower = message.toLowerCase();
  
  // Clear action words
  const actionPatterns = [
    /^(create|add|make|build|generate|set up)/,
    /^(delete|remove|clear|clean)/,
    /^(update|change|modify|edit)/,
    /^(help me|can you)/
  ];
  
  if (actionPatterns.some(p => p.test(lower))) return 'action';
  
  // Questions
  if (lower.includes('?') || lower.startsWith('what') || lower.startsWith('how') || lower.startsWith('why')) {
    return 'question';
  }
  
  return 'action'; // Default to action for ambiguous cases
};

// Silent execution handler - like Cursor/Claude Code
const executeAgentTask = async (message: string) => {
  const intent = detectUserIntent(message);
  
  console.log(`🤖 Agent detected intent: ${intent} for: "${message.substring(0, 50)}..."`);
  
  if (intent === 'conversation') {
    // Handle conversationally - no function calls
    const response = await chatService.processGeorgetownCommand(
      message,
      categories.find(cat => cat.id === currentView)?.id,
      items,
      categories,
      false // not agentic mode - just conversation
    );
    
    await chatService.addMessage('assistant', response.message);
    return;
  }
  
  if (intent === 'action') {
    // Agent mode: silent execution with function calls
    setIsAIThinking(true);
    
    try {
      const response = await chatService.processGeorgetownCommand(
        message,
        categories.find(cat => cat.id === currentView)?.id,
        items,
        categories,
        true // agentic mode
      );
      
      // Handle function calls silently (like Cursor)
      if (response.pendingFunctionCall) {
        const functionCallId = Date.now().toString();
        setPendingFunctionCalls(prev => [...prev, {
          id: functionCallId,
          name: response.pendingFunctionCall.name,
          args: response.pendingFunctionCall.args,
          timestamp: new Date()
        }]);
        
        // Silent execution - no user approval needed in agent mode
        console.log(`🔄 Agent executing: ${response.pendingFunctionCall.name}`);
        setTimeout(() => {
          handleApproveFunctionCall(functionCallId);
        }, 500);
      } else {
        // No function call needed, just respond
        await chatService.addMessage('assistant', response.message);
      }
      
    } catch (error) {
      console.error('Agent execution error:', error);
      await chatService.addMessage('assistant', 'I encountered an issue. Let me try a different approach.');
    } finally {
      setIsAIThinking(false);
    }
  }
  
  if (intent === 'question') {
    // Handle questions conversationally but with data context
    const response = await chatService.processGeorgetownCommand(
      message,
      categories.find(cat => cat.id === currentView)?.id,
      items,
      categories,
      false // not agentic - informational
    );
    
    await chatService.addMessage('assistant', response.message);
  }
};