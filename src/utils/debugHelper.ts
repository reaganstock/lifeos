// Debug helper for AI function calling issues
export class AIDebugHelper {
  static logFunctionCall(functionName: string, args: any, result: any) {
    console.group(`🔧 FUNCTION CALL DEBUG: ${functionName}`);
    console.log('📥 Input Args:', JSON.stringify(args, null, 2));
    console.log('📤 Result:', JSON.stringify(result, null, 2));
    console.log('✅ Success:', !result.error);
    if (result.error) {
      console.error('❌ Error:', result.error);
    }
    console.groupEnd();
  }

  static logAPIResponse(response: any) {
    console.group('🤖 GEMINI API RESPONSE DEBUG');
    console.log('📥 Full Response:', JSON.stringify(response, null, 2));
    
    if (response.candidates) {
      console.log('📊 Candidates Count:', response.candidates.length);
      response.candidates.forEach((candidate: any, index: number) => {
        console.log(`📄 Candidate ${index}:`, candidate);
        if (candidate.content?.parts) {
          console.log(`📝 Parts Count:`, candidate.content.parts.length);
          candidate.content.parts.forEach((part: any, partIndex: number) => {
            console.log(`📋 Part ${partIndex}:`, part);
            if (part.functionCall) {
              console.log(`🎯 Function Call Found:`, part.functionCall);
            }
            if (part.text) {
              console.log(`💬 Text Found:`, part.text.substring(0, 100) + '...');
            }
          });
        }
      });
    }
    
    if (response.error) {
      console.error('❌ API Error:', response.error);
    }
    
    console.groupEnd();
  }

  static logItemsState(items: any[], context: string) {
    console.group(`📊 ITEMS STATE: ${context}`);
    console.log('📈 Total Items:', items.length);
    
    const byType = items.reduce((acc: any, item: any) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    }, {});
    
    console.log('📋 By Type:', byType);
    
    const byCategory = items.reduce((acc: any, item: any) => {
      acc[item.categoryId] = (acc[item.categoryId] || 0) + 1;
      return acc;
    }, {});
    
    console.log('📁 By Category:', byCategory);
    
    if (items.length > 0) {
      console.log('📋 Sample Items:', items.slice(0, 3).map(item => ({
        id: item.id,
        title: item.title,
        type: item.type,
        categoryId: item.categoryId
      })));
    }
    
    console.groupEnd();
  }

  static async testBasicFunctionCall() {
    console.group('🧪 TESTING BASIC FUNCTION CALL');
    
    try {
      const testItem = {
        title: 'Test Debug Item',
        text: 'This is a test item for debugging',
        type: 'todo',
        categoryId: 'academics',
        completed: false
      };
      
      console.log('🎯 Testing createItem function directly...');
      
      // This would need to be implemented in the actual service
      console.log('✅ Test completed - check implementation');
      
    } catch (error) {
      console.error('❌ Test failed:', error);
    }
    
    console.groupEnd();
  }
}