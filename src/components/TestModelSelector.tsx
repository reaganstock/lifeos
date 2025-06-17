import React, { useState, useEffect } from 'react';
import ModelSelector from './ModelSelector';
import { getCurrentModel, setCurrentModel } from '../services/aiActions';

const TestModelSelector: React.FC = () => {
  const [currentModel, setCurrentModelState] = useState(getCurrentModel());

  // Update display when model changes
  useEffect(() => {
    const interval = setInterval(() => {
      const current = getCurrentModel();
      if (current !== currentModel) {
        setCurrentModelState(current);
        console.log('🔄 TestModelSelector: Model changed to:', current);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [currentModel]);

  const handleTestChange = (modelId: string) => {
    console.log('🧪 Testing manual model change to:', modelId);
    setCurrentModel(modelId);
    setCurrentModelState(modelId);
  };

  return (
    <div className="p-8 bg-gray-100 dark:bg-gray-900 min-h-screen">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          🧪 Model Selector Test Lab
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Test the new model selector design and functionality
        </p>

        {/* Current Model Display */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border">
          <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
            Current Selected Model
          </h2>
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <code className="text-blue-800 dark:text-blue-200 font-mono text-sm">
              {currentModel}
            </code>
          </div>
        </div>

        {/* Model Selector Test */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            Interactive Model Selector
          </h2>
          <ModelSelector className="w-full" />
        </div>

        {/* Quick Test Buttons */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            Quick Test Buttons
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleTestChange('deepseek/deepseek-r1-0528:free')}
              className="p-3 bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 rounded-lg text-sm font-medium text-purple-800 dark:text-purple-200 transition-colors"
            >
              🆓 DeepSeek R1 (Free)
            </button>
            <button
              onClick={() => handleTestChange('anthropic/claude-sonnet-4')}
              className="p-3 bg-orange-100 hover:bg-orange-200 dark:bg-orange-900/30 dark:hover:bg-orange-900/50 rounded-lg text-sm font-medium text-orange-800 dark:text-orange-200 transition-colors"
            >
              🧠 Claude Sonnet 4
            </button>
            <button
              onClick={() => handleTestChange('x-ai/grok-3-mini-beta')}
              className="p-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg text-sm font-medium text-gray-800 dark:text-gray-200 transition-colors"
            >
              ✨ Grok 3 Mini
            </button>
            <button
              onClick={() => handleTestChange('openai/gpt-4.1')}
              className="p-3 bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50 rounded-lg text-sm font-medium text-green-800 dark:text-green-200 transition-colors"
            >
              🤖 GPT-4.1
            </button>
          </div>
        </div>

        {/* Debug Info */}
        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg text-xs text-gray-600 dark:text-gray-400">
          <p>Click the dropdown above to test model selection</p>
          <p>Use the quick test buttons to verify model changes work</p>
          <p>Check browser console for detailed debugging logs</p>
        </div>
      </div>
    </div>
  );
};

export default TestModelSelector; 