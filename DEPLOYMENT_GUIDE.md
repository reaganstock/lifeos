# LifeOS Netlify Deployment Guide

## 🔐 Security Setup

### 1. Environment Variables in Netlify
**NEVER commit your `.env` file!** Instead, add these environment variables in your Netlify dashboard:

1. Go to your Netlify site dashboard
2. Navigate to **Site settings** → **Environment variables**
3. Add each variable from your `.env` file:

```bash
# AI Service API Keys
REACT_APP_OPENROUTER_API_KEY=your_actual_key
REACT_APP_GEMINI_API_KEY=your_actual_key
REACT_APP_OPENAI_API_KEY=your_actual_key

# Supabase Configuration
REACT_APP_SUPABASE_URL=your_actual_url
REACT_APP_SUPABASE_ANON_KEY=your_actual_key

# OAuth Configuration
REACT_APP_GOOGLE_CLIENT_ID=your_actual_id
REACT_APP_GOOGLE_CLIENT_SECRET=your_actual_secret
REACT_APP_MICROSOFT_CLIENT_ID=your_actual_id
REACT_APP_MICROSOFT_CLIENT_SECRET=your_actual_secret
REACT_APP_NOTION_CLIENT_ID=your_actual_id
REACT_APP_NOTION_CLIENT_SECRET=your_actual_secret
```

### 2. OAuth Redirect URLs
Update your OAuth app settings to include your Netlify domain:

**Google OAuth:**
- Add: `https://your-netlify-domain.netlify.app/oauth/callback`

**Microsoft OAuth:**
- Add: `https://your-netlify-domain.netlify.app/oauth/callback`

**Notion OAuth:**
- Add: `https://your-netlify-domain.netlify.app/oauth/callback`

## 🚀 Deployment Steps

### 1. Prepare Repository
```bash
# Make sure .env is in .gitignore (already done)
git add .
git commit -m "Prepare for Netlify deployment"
git push origin main
```

### 2. Deploy to Netlify
1. Connect your GitHub repository to Netlify
2. Build settings will be automatically detected from `netlify.toml`
3. Add environment variables in Netlify dashboard
4. Deploy!

### 3. Post-Deployment
1. Update OAuth redirect URLs with your new Netlify domain
2. Test all integrations (Google Calendar, Microsoft, Notion)
3. Verify Supabase connection works
4. Test AI functions

## 🔧 Configuration Files Created

- **`.env.example`** - Template for environment variables
- **`netlify.toml`** - Netlify deployment configuration
- **Security headers** - CSP, XSS protection, etc.
- **SPA routing** - Handles React Router properly
- **OAuth redirects** - Maps auth callbacks correctly

## 🛡️ Security Features

✅ **Environment variables** secured in Netlify dashboard
✅ **Security headers** prevent XSS and clickjacking
✅ **Content Security Policy** restricts resource loading
✅ **Source maps disabled** in production
✅ **API keys hidden** from client bundle

## 🧪 Testing Checklist

After deployment, test:
- [ ] User authentication works
- [ ] AI functions (create/edit/delete items)
- [ ] Supabase sync
- [ ] Google Calendar integration
- [ ] Microsoft Calendar integration
- [ ] Notion integration
- [ ] Voice features
- [ ] File uploads

## 🚨 Security Reminders

1. **NEVER** commit `.env` files
2. **ALWAYS** use Netlify environment variables
3. **UPDATE** OAuth redirect URLs for production
4. **MONITOR** API usage and set up billing alerts
5. **ROTATE** API keys regularly