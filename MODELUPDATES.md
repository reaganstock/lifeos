# Model Selector Updates - January 2025

## Summary of Changes

### 🚀 New AI Models Added

#### DeepSeek Models (Latest 2025)
- **DeepSeek R1 0528 (Free)** - `deepseek/deepseek-r1-0528:free`
  - Latest R1 update with performance on par with OpenAI o1
  - **FREE** to use with OpenRouter
  - Strengths: Open reasoning, Math, Coding, Free

- **DeepSeek R1 0528** - `deepseek/deepseek-r1-0528`
  - Latest R1 update (paid version for higher usage)
  - Performance on par with OpenAI o1
  - Strengths: Open reasoning, Math, Coding, Transparency

- **DeepSeek R1** - `deepseek/deepseek-r1`
  - Original R1 - fully open reasoning model (671B params)
  - MIT licensed for commercial use
  - Strengths: Open reasoning, Transparent thinking, MIT license

- **DeepSeek V3 0324 (Free)** - `deepseek/deepseek-chat-v3-0324:free`
  - Latest V3 flagship model - excellent general capabilities
  - **FREE** to use with OpenRouter
  - Strengths: General tasks, Coding, Free, Fast

- **DeepSeek V3 0324** - `deepseek/deepseek-chat-v3-0324`
  - Latest V3 flagship model (paid version)
  - Low cost, excellent performance
  - Strengths: General tasks, Coding, Cost-effective, Fast

- **DeepSeek R1 Distill Qwen 32B** - `deepseek/deepseek-r1-distill-qwen-32b`
  - R1 distilled into 32B model - outperforms o1-mini
  - Great performance/cost ratio
  - Strengths: Math, Coding, Efficiency, Reasoning

- **DeepSeek R1 Distill Qwen 14B** - `deepseek/deepseek-r1-distill-qwen-14b`
  - R1 distilled into 14B model
  - Budget-friendly option with solid performance
  - Strengths: Math, Coding, Efficiency, Budget-friendly

#### xAI Grok Models (Latest 2025)
- **Grok 3 Beta** - `x-ai/grok-3-beta`
  - Latest flagship Grok model
  - Excels at enterprise use cases
  - Strengths: Data extraction, Domain knowledge, Enterprise, Structured tasks

- **Grok 3 Mini Beta** - `x-ai/grok-3-mini-beta`
  - Lightweight thinking model
  - Ideal for math and reasoning tasks
  - Strengths: Thinking model, Math, Reasoning, Transparent traces

- **Grok 2 1212** - `x-ai/grok-2-1212`
  - Enhanced accuracy and multilingual support
  - Strong instruction adherence
  - Strengths: Accuracy, Multilingual, Instruction following, Steerable

### 🔧 Model Selector Fixes

#### Event Handling Issues Fixed
1. **Click Events**: Improved event handling with proper preventDefault and stopPropagation
2. **Focus Management**: Added proper focus handling and mouseDown event management
3. **Outside Click Detection**: Implemented ref-based outside click detection for better UX
4. **Event Propagation**: Fixed event bubbling issues that prevented selection

#### UI/UX Improvements
1. **Scrolling**: Fixed dropdown scrolling with proper max-height and overflow management
2. **Visual Feedback**: Added proper hover states and focus indicators
3. **Provider Colors**: Added color-coded provider indicators (OpenAI=Green, Anthropic=Orange, Google=Blue, DeepSeek=Purple, xAI=Gray)
4. **Cost Indicators**: Enhanced cost labeling with proper color coding including "Free" tier
5. **Z-Index**: Increased z-index to 99999 for proper dropdown layering

#### Accessibility Enhancements
1. **Keyboard Navigation**: Improved keyboard accessibility
2. **Screen Reader Support**: Better ARIA attributes and semantic HTML
3. **Focus Management**: Proper focus trap and escape handling

### 📊 Model Organization

Models are now organized by provider with clear categorization:
- **OpenAI Models**: GPT-4.1, GPT-4o
- **Anthropic Models**: Claude Sonnet 4, Claude Opus 4, Claude 3.5 Sonnet
- **Google Models**: Gemini 2.5 Pro, Gemini 2.5 Flash (Thinking)
- **DeepSeek Models**: R1 variants, V3 models, Distilled models
- **xAI Grok Models**: Grok 3 Beta, Grok 3 Mini Beta, Grok 2 1212

### 💰 Cost Tiers
- **Free**: DeepSeek R1 0528 (Free), DeepSeek V3 0324 (Free)
- **Low**: DeepSeek distilled models, Grok 3 Mini, Gemini Flash
- **Medium**: Most flagship models (Claude Sonnet 4, GPT-4.1, etc.)
- **High**: Claude Opus 4, Grok 3 Beta

### 🎯 Key Features

#### Thinking Models
Several models now support transparent reasoning:
- DeepSeek R1 series (open reasoning tokens)
- Grok 3 Mini Beta (transparent thinking traces)
- Gemini 2.5 Flash (thinking capabilities)

#### Free Tier Options
Multiple high-quality free models available:
- DeepSeek R1 0528 (Free) - Performance on par with OpenAI o1
- DeepSeek V3 0324 (Free) - Excellent general capabilities

#### Enterprise & Specialized Models
- Grok 3 Beta: Enterprise data extraction and domain knowledge
- Claude Opus 4: Complex autonomous coding tasks
- DeepSeek R1: Open-source research and development

## Usage Instructions

1. **Selecting Models**: Click on the model selector dropdown in the AI Assistant panel
2. **Browsing Options**: Scroll through categorized models with provider color indicators
3. **Cost Awareness**: Check cost indicators before selecting (Free/Low/Medium/High)
4. **Strengths**: Review model strengths tags to pick the best model for your task

## Technical Notes

- All models use OpenRouter's unified API for consistent integration
- Model selection persists across sessions
- Enhanced error handling and logging for debugging
- Responsive design works on all screen sizes
- Dark mode support for all new UI elements

## Performance Recommendations

- **General Use**: Claude Sonnet 4 (default) or DeepSeek V3 0324
- **Complex Coding**: Claude Opus 4 or DeepSeek R1 0528
- **Math/Reasoning**: DeepSeek R1 series or Grok 3 Mini
- **Budget-Conscious**: DeepSeek free models or distilled variants
- **Enterprise**: Grok 3 Beta for structured data tasks 