const express = require('express');
const cors = require('cors');
// Node.js v18+ has built-in fetch, no need to import

const app = express();
const PORT = 3001;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Notion OAuth token exchange proxy
app.post('/api/notion/oauth/token', async (req, res) => {
  try {
    console.log('🔗 Proxying Notion OAuth token exchange...');
    
    const { code, clientId, clientSecret, redirectUri } = req.body;
    
    if (!code || !clientId || !clientSecret || !redirectUri) {
      return res.status(400).json({
        error: 'Missing required parameters: code, clientId, clientSecret, redirectUri'
      });
    }
    
    // Encode credentials for Basic auth
    const encoded = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    // Make request to Notion API
    const response = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Basic ${encoded}`,
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ Notion API error:', data);
      return res.status(response.status).json(data);
    }
    
    console.log('✅ OAuth token exchange successful');
    res.json(data);
    
  } catch (error) {
    console.error('❌ Proxy error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// General Notion API proxy for all other endpoints
app.use('/api/notion/v1', async (req, res) => {
  try {
    const path = req.originalUrl.replace('/api/notion', '');
    const url = `https://api.notion.com${path}`;
    
    console.log(`🔗 Proxying Notion API request: ${req.method} ${path}`);
    
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28'
    };
    
    // Forward authorization header if present
    if (req.headers.authorization) {
      headers['Authorization'] = req.headers.authorization;
    }
    
    const options = {
      method: req.method,
      headers
    };
    
    // Add body for POST/PATCH requests
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      options.body = JSON.stringify(req.body);
    }
    
    const response = await fetch(url, options);
    const data = await response.json();
    
    if (!response.ok) {
      console.error(`❌ Notion API error for ${path}:`, data);
      return res.status(response.status).json(data);
    }
    
    console.log(`✅ Notion API request successful: ${req.method} ${path}`);
    res.json(data);
    
  } catch (error) {
    console.error('❌ Proxy error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'OAuth proxy server is running' });
});

app.listen(PORT, () => {
  console.log(`🚀 OAuth proxy server running on http://localhost:${PORT}`);
  console.log(`📡 Notion OAuth endpoint: http://localhost:${PORT}/api/notion/oauth/token`);
}); 