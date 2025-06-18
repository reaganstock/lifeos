import React, { useState, useEffect, useCallback } from 'react';
import { AVAILABLE_MODELS, getCurrentModel, setCurrentModel } from '../services/aiActions';

interface ModelSelectorProps {
  className?: string;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({ className = '' }) => {
  const [selectedModel, setSelectedModel] = useState(getCurrentModel());
  const [isExpanded, setIsExpanded] = useState(false);
  const [animatingModel, setAnimatingModel] = useState<string | null>(null);

  // Force sync with global state
  const forceSync = useCallback(() => {
    const current = getCurrentModel();
    setSelectedModel(current);
  }, []);

  useEffect(() => {
    forceSync();
    
    // Listen for model change events
    const handleModelChange = (event: CustomEvent) => {
      console.log('🎯 Model change event received:', event.detail.modelId);
      setSelectedModel(event.detail.modelId);
    };
    
    window.addEventListener('modelChanged', handleModelChange as EventListener);
    
    // Set up less frequent interval to keep checking (backup) - reduced from 2s to 30s
    const interval = setInterval(forceSync, 30000);
    
    return () => {
      window.removeEventListener('modelChanged', handleModelChange as EventListener);
      clearInterval(interval);
    };
  }, [forceSync]);

  const handleModelSwitch = async (modelId: string) => {
    console.log('🚀 TESLA-STYLE MODEL SWITCH:', modelId);
    
    setAnimatingModel(modelId);
    
    // Force immediate local update
    setSelectedModel(modelId);
    
    // Update global state with multiple attempts
    setCurrentModel(modelId);
    
    // Force re-sync after a delay
    setTimeout(() => {
      setCurrentModel(modelId);
      setSelectedModel(modelId);
      setAnimatingModel(null);
      console.log('✅ Model locked in:', modelId);
    }, 300);
    
    setIsExpanded(false);
  };

  const selectedModelInfo = AVAILABLE_MODELS.find(m => m.id === selectedModel) || AVAILABLE_MODELS[0];

  const getProviderColor = (provider: string) => {
    switch (provider) {
      case 'OpenAI': return 'from-green-400 to-emerald-500';
      case 'Anthropic': return 'from-orange-400 to-red-500';
      case 'Google': return 'from-blue-400 to-indigo-500';
      case 'Google Direct': return 'from-blue-500 to-purple-500'; // Special color for direct API
      case 'DeepSeek': return 'from-purple-400 to-violet-500';
      case 'xAI': return 'from-gray-400 to-slate-500';
      default: return 'from-gray-400 to-gray-500';
    }
  };

  const getCostGlow = (cost: string) => {
    switch (cost) {
      case 'Free': return 'shadow-green-500/50 border-green-400/50';
      case 'Low': return 'shadow-blue-500/50 border-blue-400/50';
      case 'Medium': return 'shadow-yellow-500/50 border-yellow-400/50';
      case 'High': return 'shadow-red-500/50 border-red-400/50';
      default: return 'shadow-gray-500/50 border-gray-400/50';
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Compact Control Panel */}
      <div className="bg-black/80 backdrop-blur-2xl rounded-xl border border-white/10 p-0.5 shadow-xl">
        
        {/* Current Model Display - Compact */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full p-2 rounded-lg bg-gradient-to-r from-white/5 to-white/10 hover:from-white/10 hover:to-white/20 transition-all duration-300 group relative overflow-hidden"
        >
          {/* Tesla-style animated background */}
          <div className="absolute inset-0 bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-500 from-blue-500/10 to-purple-500/10"></div>
          
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Smaller Provider Orb */}
              <div className={`w-4 h-4 rounded-full bg-gradient-to-br ${getProviderColor(selectedModelInfo.provider)} shadow-sm animate-pulse`}></div>
              
              {/* Compact Model Info */}
              <div className="text-left">
                <div className="text-white font-medium text-xs tracking-wide">
                  {selectedModelInfo.name}
                </div>
                <div className="text-gray-400 text-[10px] font-light">
                  {selectedModelInfo.provider}
                </div>
              </div>
            </div>

            {/* Compact Status Indicators */}
            <div className="flex items-center gap-2">
              {/* Smaller Cost Badge */}
              <div className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${getCostGlow(selectedModelInfo.cost)} bg-black/50`}>
                <span className="text-white">{selectedModelInfo.cost}</span>
              </div>
              
              {/* Smaller Expand Arrow */}
              <div className={`transform transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </button>

        {/* Compact Tesla-Style Model Grid */}
        {isExpanded && (
          <div className="mt-1 space-y-0.5 max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
            {AVAILABLE_MODELS.map((model, index) => {
              const isSelected = selectedModel === model.id;
              const isAnimating = animatingModel === model.id;
              
              return (
                <button
                  key={model.id}
                  onClick={() => handleModelSwitch(model.id)}
                  className={`w-full p-2 rounded-lg transition-all duration-300 group relative overflow-hidden ${
                    isSelected 
                      ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-400/50 shadow-sm shadow-blue-500/25' 
                      : 'bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/20'
                  } ${isAnimating ? 'animate-pulse' : ''}`}
                  style={{
                    animationDelay: `${index * 30}ms`
                  }}
                >
                  {/* Tesla charging animation effect */}
                  {isSelected && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 animate-slide-right"></div>
                  )}
                  
                  <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {/* Smaller Provider Icon */}
                      <div className={`w-3 h-3 rounded-full bg-gradient-to-br ${getProviderColor(model.provider)} shadow-sm ${isSelected ? 'animate-pulse' : ''}`}></div>
                      
                      {/* Compact Model Details */}
                      <div className="text-left">
                        <div className="text-white text-xs font-medium">
                          {model.name}
                        </div>
                        <div className="text-gray-400 text-[10px]">
                          {model.description.substring(0, 25)}...
                        </div>
                      </div>
                    </div>

                    {/* Compact Right Side */}
                    <div className="flex items-center gap-1.5">
                      {/* Smaller Cost */}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${getCostGlow(model.cost)} bg-black/30 text-white`}>
                        {model.cost}
                      </span>
                      
                      {/* Smaller Selection Indicator */}
                      {isSelected && (
                        <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-blue-400 to-purple-400 animate-ping"></div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Subtle Apple-style glow */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/3 to-purple-500/3 -z-10 blur-lg"></div>
      
      {/* Compact Tesla-style scanning line */}
      {isExpanded && (
        <div className="absolute -right-0.5 top-0 bottom-0 w-0.5 bg-gradient-to-b from-transparent via-blue-400 to-transparent animate-pulse"></div>
      )}
    </div>
  );
};

export default ModelSelector;
 