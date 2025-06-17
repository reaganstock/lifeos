# OpenAI Realtime API Integration

This document describes the implementation of OpenAI's Realtime API for voice chat functionality in lifeOS AI.

## Overview

The OpenAI Realtime API enables low-latency, multimodal interactions including speech-to-speech conversational experiences. This implementation uses **WebRTC** for browser-based applications with ephemeral tokens for security.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Client  │    │  Backend Server │    │  OpenAI API     │
│                 │    │                 │    │                 │
│ 1. Request      │───▶│ 2. Create       │───▶│ 3. Generate     │
│    Voice Chat   │    │    Ephemeral    │    │    Session      │
│                 │    │    Token        │    │                 │
│ 4. WebRTC       │◀───│                 │◀───│                 │
│    Connection   │    │                 │    │                 │
│                 │    │                 │    │                 │
│ 5. Voice Chat   │◀──────────────────────────▶│ 6. AI Response  │
│    with AI      │         Direct WebRTC      │    with Audio   │
└─────────────────┘                            └─────────────────┘
```

## Components

### 1. OpenAI Realtime Service (`src/services/openaiRealtimeService.ts`)

**Key Features:**
- WebRTC peer connection management
- Ephemeral token authentication
- Real-time audio streaming
- Function calling integration with geminiService
- Voice Activity Detection (VAD)

**Main Methods:**
- `connect(config)` - Establishes WebRTC connection
- `startListening()` - Enables microphone
- `stopListening()` - Disables microphone
- `disconnect()` - Closes all connections

### 2. OpenAI Voice Chat Modal (`src/components/OpenAIVoiceChatModal.tsx`)

**Features:**
- ChatGPT-style voice interface
- Real-time transcript display
- Voice settings (voice type, temperature)
- Audio level visualization
- Connection status indicators

**UI Elements:**
- Animated voice orb (ChatGPT style)
- Settings panel
- Transcript panel
- Control buttons (mic, pause, mute)

### 3. Backend Server (`server.js`)

**Purpose:**
- Creates ephemeral tokens for secure client authentication
- Proxies requests to OpenAI API with server-side API key
- Handles CORS for development

**Endpoints:**
- `POST /api/realtime/session` - Creates ephemeral token
- `GET /health` - Health check

## Setup Instructions

### 1. Install Dependencies

```bash
npm install express cors node-fetch
```

### 2. Environment Variables

Ensure these are set in your environment:

```bash
REACT_APP_OPENAI_API_KEY=your_openai_api_key
```

### 3. Start the Backend Server

```bash
node server.js
```

This starts the server on port 3001 for ephemeral token creation.

### 4. Start the React App

```bash
npm start
```

This starts the React app on port 3000.

### 5. Test Voice Chat

1. Click the voice chat button in the AI Assistant
2. Allow microphone permissions when prompted
3. Wait for "Connected" status
4. Start speaking naturally

## Configuration

### Voice Settings

Available voices:
- `alloy` - Neutral, balanced
- `echo` - Clear, expressive
- `fable` - Warm, engaging
- `onyx` - Deep, authoritative
- `nova` - Bright, energetic
- `shimmer` - Gentle, soothing
- `verse` - Conversational, natural

### Model Settings

- **Model**: `gpt-4o-realtime-preview-2024-12-17`
- **Temperature**: 0.8 (adjustable)
- **Audio Format**: PCM16 at 24kHz
- **Turn Detection**: Server-side VAD

## Function Calling

The service integrates with the existing `geminiService` for function calling:

- `createItem` - Create tasks, events, notes, etc.
- `updateItem` - Update existing items
- `deleteItem` - Delete items
- `searchItems` - Search through items
- `bulkCreateItems` - Create multiple items

## Security

### Ephemeral Tokens

- Tokens are created server-side using your API key
- Tokens expire after 1 minute
- Client never sees the main API key
- WebRTC connection is encrypted

### Best Practices

1. **Never expose API keys in client code**
2. **Use HTTPS in production**
3. **Implement rate limiting on token endpoint**
4. **Monitor token usage**

## Troubleshooting

### Common Issues

1. **"Connection Failed"**
   - Check API key is valid
   - Ensure backend server is running
   - Verify internet connection

2. **"Microphone Access Denied"**
   - Allow microphone permissions in browser
   - Check browser security settings
   - Try HTTPS instead of HTTP

3. **"No Audio Output"**
   - Check browser audio settings
   - Verify speakers/headphones
   - Check volume levels

4. **"Function Calls Not Working"**
   - Verify geminiService integration
   - Check localStorage permissions
   - Review function call logs

### Debug Logs

Enable detailed logging by checking browser console:

```javascript
// Look for these log prefixes:
// 🔊 OPENAI REALTIME SERVICE
// 🎙️ OPENAI VOICE CHAT
// 🔑 SERVER
```

## Development vs Production

### Development
- Direct API key fallback
- CORS enabled
- Detailed logging
- Local backend server

### Production
- Ephemeral tokens only
- Secure backend deployment
- Error handling
- Rate limiting

## API Reference

### WebRTC Connection

```javascript
const service = new OpenAIRealtimeService();

await service.connect({
  apiKey: 'your-api-key',
  model: 'gpt-4o-realtime-preview-2024-12-17',
  voice: 'alloy',
  instructions: 'You are a helpful assistant...',
  temperature: 0.8
});
```

### Event Listeners

```javascript
service.onConnectionState(connected => {
  console.log('Connected:', connected);
});

service.onTranscript(transcript => {
  console.log('Transcript:', transcript.text);
});

service.onFunctionCall(functionCall => {
  console.log('Function called:', functionCall.name);
});
```

## Performance

### Latency
- WebRTC provides ~100-300ms latency
- Voice Activity Detection is server-side
- Audio streaming is real-time

### Bandwidth
- Audio: ~24kbps (PCM16 at 24kHz)
- Data channel: Minimal for events
- Total: ~30-50kbps per session

## Future Enhancements

1. **Multi-language support**
2. **Custom voice training**
3. **Advanced audio processing**
4. **Mobile app integration**
5. **Group voice conversations**

## Support

For issues or questions:
1. Check browser console for errors
2. Verify API key and permissions
3. Test with simple voice commands
4. Review OpenAI API status page 