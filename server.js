const express = require('express');
const cors = require('cors');

// Use built-in fetch for Node.js 18+ or fallback to node-fetch
const fetch = globalThis.fetch || require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// OpenAI API Key - MUST be provided via environment variables
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY environment variable is required');
  console.error('💡 Please set OPENAI_API_KEY in your environment or .env file');
  process.exit(1);
}

// Endpoint to create ephemeral tokens for OpenAI Realtime API
app.post('/api/realtime/session', async (req, res) => {
  console.log('🔑 SERVER: Creating ephemeral token for OpenAI Realtime API...');
  
  try {
    const { model, voice, instructions } = req.body;
    
    console.log('📝 SERVER: Session request:', {
      model: model || 'gpt-4o-realtime-preview-2024-12-17',
      voice: voice || 'alloy',
      hasInstructions: !!instructions
    });

    console.log('📡 SERVER: Making request to OpenAI API...');
    
    const requestBody = {
      model: model || 'gpt-4o-realtime-preview-2024-12-17',
      voice: voice || 'alloy',
      instructions: instructions || 'You are a helpful voice assistant for lifeOS AI.',
    };
    
    console.log('📝 SERVER: Request body:', requestBody);
    
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    
    console.log('📡 SERVER: Response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ SERVER: OpenAI API error:', errorData);
      return res.status(response.status).json({
        error: errorData.error?.message || 'Failed to create session'
      });
    }

    const sessionData = await response.json();
    console.log('✅ SERVER: Session created successfully:', {
      id: sessionData.id,
      hasClientSecret: !!sessionData.client_secret
    });

    // Return the session data to the client
    res.json(sessionData);

  } catch (error) {
    console.error('❌ SERVER: Error creating session:', error);
    res.status(500).json({
      error: 'Internal server error while creating session'
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 OpenAI Realtime API server running on port ${PORT}`);
  console.log(`📡 Ephemeral token endpoint: http://localhost:${PORT}/api/realtime/session`);
  console.log(`🔍 Health check: http://localhost:${PORT}/health`);
});

module.exports = app; 