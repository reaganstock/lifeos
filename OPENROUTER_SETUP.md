# OpenRouter Setup Guide

## Overview

This app now uses **OpenRouter** to provide access to multiple AI models including:

- **Claude Sonnet 4** (Anthropic) - State-of-the-art coding model (72.7% SWE-bench)
- **Claude Opus 4** (Anthropic) - Most powerful model for complex tasks (72.5% SWE-bench)  
- **GPT-4.1** (OpenAI) - Latest GPT model with improved efficiency
- **Gemini 2.5 Pro** (Google) - Advanced multimodal model with thinking capabilities
- **300+ other models** available through one API

## Why OpenRouter?

✅ **One API key** for all models - no more juggling multiple accounts  
✅ **No tier limitations** - bypass individual provider restrictions  
✅ **Smart routing** - automatically selects the best model for each task  
✅ **Cost effective** - only ~5% markup for massive convenience  
✅ **Fallback system** - if one model is down, routes to another  

## Setup Instructions

### 1. Get Your OpenRouter API Key

1. Go to [OpenRouter](https://openrouter.ai)
2. Sign up for an account
3. Navigate to [API Keys](https://openrouter.ai/settings/keys)
4. Create a new API key
5. Add some credits to your account (you can start with $5-10)

### 2. Configure Environment Variable

Create a `.env` file in your project root and add:

```bash
REACT_APP_OPENROUTER_API_KEY=your_api_key_here
```

**Important**: Replace `your_api_key_here` with your actual OpenRouter API key.

### 3. Restart Your Development Server

```bash
npm start
```

## Using the Model Selector

Once configured, you'll see a **Model Selector** dropdown in the AI Assistant:

- **Claude Sonnet 4** - Best for coding and reasoning (state-of-the-art)
- **Claude Opus 4** - Most powerful for complex autonomous tasks
- **GPT-4.1** - Fast and efficient for general use
- **Gemini 2.5 Pro** - Advanced multimodal with video understanding
- **Gemini 2.5 Flash (Thinking)** - Fast with built-in reasoning capabilities

## Pricing (OpenRouter rates)

OpenRouter uses a credit system:

- **Claude Sonnet 4**: $3/$15 per 1M tokens (input/output)
- **Claude Opus 4**: $15/$75 per 1M tokens (input/output)  
- **GPT-4.1**: ~$2/$8 per 1M tokens
- **Gemini 2.5 Pro**: $1.25/$10 per 1M tokens
- **Gemini 2.5 Flash**: $0.15/$3.50 per 1M tokens

## Latest Model Capabilities

### Claude Sonnet 4 🏆
- **72.7% SWE-bench** score (state-of-the-art coding)
- Enhanced autonomous codebase navigation
- Reduced error rates in agent workflows
- Perfect for daily development work

### Claude Opus 4 🚀
- **72.5% SWE-bench** score (world's best coding model)
- Can work continuously for several hours
- Sustained performance on long-running tasks
- Best for complex autonomous coding agents

### GPT-4.1 ⚡
- Improved efficiency and speed
- 1M token context window
- Cost-effective for high-volume use
- Great for general coding and API development

### Gemini 2.5 Pro 🎥
- State-of-the-art video understanding
- Built-in thinking capabilities  
- Multimodal excellence
- Perfect for creative and educational projects

## Troubleshooting

**Error: "OpenRouter API key not found"**
- Make sure your `.env` file is in the project root
- Restart your development server after adding the key
- Check that the variable name is exactly `REACT_APP_OPENROUTER_API_KEY`

**Models not responding**
- Check your OpenRouter account has sufficient credits
- Try switching to a different model
- Check the browser console for error details

**Compilation errors**
- Make sure you're using the latest model IDs
- Clear browser cache and restart the development server

## Benefits for Your Life Management App

- **Superior Coding**: Claude 4 models lead all benchmarks
- **Reliability**: Fallback system ensures AI is always available
- **Cost Optimization**: Choose cheaper models for simple tasks
- **Performance**: Select faster models when speed matters
- **Future-Proof**: Easy access to new models as they're released

Your AI assistant is now powered by the world's most advanced models! 🚀 