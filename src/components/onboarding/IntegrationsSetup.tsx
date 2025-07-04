import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowRight, 
  Check, 
  ExternalLink,
  Settings,
  Loader2
} from 'lucide-react';
import { IntegrationManager } from '../../services/integrations/IntegrationManager';
import { useAuthContext } from '../AuthProvider';
import { getUserData, setUserData } from '../../utils/userStorage';

export default function IntegrationsSetup() {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const [connectedIntegrations, setConnectedIntegrations] = useState<string[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
    isVisible: boolean;
  }>({ message: '', type: 'info', isVisible: false });

  // Load saved connections on mount
  useEffect(() => {
    if (user?.id) {
      const savedConnections = getUserData(user.id, 'lifely_onboarding_integrations', []);
      setConnectedIntegrations(savedConnections);
      console.log('🔗 Loaded saved integrations for user:', user.email, savedConnections);
    }
  }, [user?.id]);

  // Handle OAuth callback success
  useEffect(() => {
    // Check for auto-connect flags set by App.tsx OAuth callback handler
    const autoConnectIntegrations = [
      { flag: 'google_auto_connect', id: 'google-calendar', name: 'Google Calendar' },
      { flag: 'microsoft_auto_connect', id: 'microsoft-calendar', name: 'Microsoft Calendar' },
      { flag: 'notion_auto_connect', id: 'notion', name: 'Notion' },
      { flag: 'onenote_auto_connect', id: 'onenote', name: 'OneNote' }
    ];

    autoConnectIntegrations.forEach(({ flag, id, name }) => {
      if (sessionStorage.getItem(flag) === 'true') {
        console.log('✅ Auto-connecting integration:', name);
        
        // Add to connected integrations if not already connected
        if (!connectedIntegrations.includes(id)) {
          const newConnections = [...connectedIntegrations, id];
          setConnectedIntegrations(newConnections);
          
          if (user?.id) {
            setUserData(user.id, 'lifely_onboarding_integrations', newConnections);
          }
          
          // Show success notification
          showNotification(`✅ Successfully connected to ${name}!`, 'success');
        }
        
        // Clear the auto-connect flag
        sessionStorage.removeItem(flag);
      }
    });
  }, [connectedIntegrations, user?.id]);

  const integrations = [
    {
      id: 'google-calendar',
      name: 'Google Calendar',
      description: 'Sync events and create smart scheduling',
      icon: '/google-calendar.svg',
      color: 'from-blue-500 to-blue-600',
      status: 'available',
      authType: 'oauth'
    },
    {
      id: 'microsoft-calendar', 
      name: 'Microsoft Calendar',
      description: 'Outlook Calendar integration',
      icon: '/outlook-calendar.png',
      color: 'from-blue-600 to-blue-700',
      status: 'available',
      authType: 'oauth'
    },
    {
      id: 'notion',
      name: 'Notion',
      description: 'Import pages and databases',
      icon: '/notion.svg',
      color: 'from-gray-800 to-black',
      status: 'available',
      authType: 'oauth'
    },
    {
      id: 'onenote',
      name: 'OneNote',
      description: 'Import your notes and ideas',
      icon: '/onenote.svg',
      color: 'from-purple-500 to-purple-600',
      status: 'available',
      authType: 'oauth'
    },
    {
      id: 'todoist',
      name: 'Todoist',
      description: 'Import tasks and projects',
      icon: '/todoist.svg',
      color: 'from-red-500 to-red-600',
      status: 'available',
      authType: 'api_key'
    },
    {
      id: 'youtube',
      name: 'YouTube',
      description: 'Extract insights from your videos',
      icon: '/youtube.svg',
      color: 'from-red-600 to-red-700',
      status: 'available',
      authType: 'api_key'
    },
    {
      id: 'apple-calendar',
      name: 'Apple Calendar',
      description: 'iCloud Calendar sync',
      icon: '/apple-calendar.png',
      color: 'from-gray-700 to-gray-800',
      status: 'coming-soon',
      authType: 'oauth'
    },
    {
      id: 'apple-notes',
      name: 'Apple Notes',
      description: 'Import your notes and ideas',
      icon: '/apple-notes.svg',
      color: 'from-yellow-500 to-orange-500',
      status: 'coming-soon',
      authType: 'oauth'
    }
  ];

  const handleConnect = async (integrationId: string) => {
    if (!user?.id) {
      console.error('❌ No authenticated user found');
      return;
    }

    const integration = integrations.find(i => i.id === integrationId);
    if (!integration) {
      console.error('❌ Integration not found:', integrationId);
      return;
    }

    setConnecting(integrationId);
    
    try {
      console.log('🔗 Starting OAuth flow for:', integration.name);

      if (integration.authType === 'oauth') {
        await handleOAuthConnection(integration);
      } else if (integration.authType === 'api_key') {
        await handleApiKeyConnection(integration);
      }
    } catch (error) {
      console.error('❌ Connection failed:', error);
      setConnecting(null);
      showNotification(`Failed to connect to ${integration.name}: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  };

  const handleOAuthConnection = async (integration: any) => {
    const redirectUri = `${window.location.origin}/oauth/callback`;
    
    try {
      let oauthUrl = '';
      
      switch (integration.id) {
        case 'google-calendar':
          const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
          if (!googleClientId) {
            throw new Error('Google Client ID not configured');
          }
          oauthUrl = IntegrationManager.getGoogleCalendarOAuthUrl(googleClientId, redirectUri);
          break;
          
        case 'microsoft-calendar':
          const microsoftClientId = process.env.REACT_APP_MICROSOFT_CLIENT_ID;
          if (!microsoftClientId) {
            throw new Error('Microsoft Client ID not configured');
          }
          oauthUrl = await IntegrationManager.getMicrosoftCalendarOAuthUrl(microsoftClientId, redirectUri);
          break;
          
        case 'notion':
          oauthUrl = IntegrationManager.getNotionOAuthUrl();
          break;
          
        case 'onenote':
          const oneNoteClientId = process.env.REACT_APP_MICROSOFT_CLIENT_ID;
          if (!oneNoteClientId) {
            throw new Error('Microsoft Client ID not configured for OneNote');
          }
          oauthUrl = await IntegrationManager.getOneNoteOAuthUrl(oneNoteClientId, redirectUri);
          break;
          
        default:
          throw new Error(`OAuth not implemented for ${integration.id}`);
      }
      
      console.log('🔗 Redirecting to OAuth URL for:', integration.name);
      // Store which integration we're connecting for callback handling
      sessionStorage.setItem('connecting_integration', integration.id);
      sessionStorage.setItem('connecting_integration_name', integration.name);
      
      // Redirect to OAuth
      window.location.href = oauthUrl;
      
    } catch (error) {
      console.error('❌ OAuth setup failed:', error);
      throw error;
    }
  };

  const handleApiKeyConnection = async (integration: any) => {
    // For API key integrations, show a prompt (in a real app, you'd use a modal)
    const apiKey = prompt(`Enter your ${integration.name} API key:`);
    
    if (!apiKey) {
      setConnecting(null);
      return;
    }
    
    // Simulate API key validation
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Add to connected integrations
    const newConnections = [...connectedIntegrations, integration.id];
    setConnectedIntegrations(newConnections);
    setUserData(user!.id, 'lifely_onboarding_integrations', newConnections);
    
    console.log('✅ Connected via API key:', integration.name);
    setConnecting(null);
  };

  const handleContinue = () => {
    if (!user?.id) return;
    
    // Save connected integrations (user-specific)
    setUserData(user.id, 'lifely_onboarding_integrations', connectedIntegrations);
    
    // Save progress and navigate to processing
    setUserData(user.id, 'lifely_onboarding_progress', '/onboarding/processing');
    navigate('/onboarding/processing');
  };

  const handleSkipAll = () => {
    if (!user?.id) return;
    
    setUserData(user.id, 'lifely_onboarding_progress', '/onboarding/processing');
    navigate('/onboarding/processing');
  };

  const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
    setNotification({ message, type, isVisible: true });
    setTimeout(() => {
      setNotification(prev => ({ ...prev, isVisible: false }));
    }, 5000);
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-lifeos-50 via-lifeos-100 to-lifeos-200 font-sans overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-20 h-20 bg-gradient-to-br from-lifeos-primary/20 to-lifeos-secondary/20 rounded-full blur-xl animate-float" style={{animationDelay: '0s'}}></div>
        <div className="absolute top-40 right-20 w-16 h-16 bg-gradient-to-br from-lifeos-secondary/30 to-purple-400/30 rounded-lg blur-lg animate-pulse" style={{animationDelay: '1s', animationDuration: '6s'}}></div>
        <div className="absolute bottom-32 left-1/4 w-12 h-12 bg-gradient-to-br from-lifeos-primary/25 to-blue-400/25 rounded-full blur-md animate-ping" style={{animationDelay: '2s', animationDuration: '8s'}}></div>
        <div className="absolute top-1/3 right-1/3 w-24 h-24 bg-gradient-to-br from-purple-400/20 to-lifeos-secondary/20 rounded-xl blur-lg animate-float-delayed"></div>
        <div className="absolute bottom-20 right-10 w-14 h-14 bg-gradient-to-br from-lifeos-primary/30 to-pink-400/30 rounded-full blur-sm animate-bounce" style={{animationDelay: '4s', animationDuration: '7s'}}></div>
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-8">
        <div className="w-full max-w-5xl">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="w-20 h-20 bg-gradient-to-br from-lifeos-primary to-lifeos-secondary rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl transition-all duration-300 hover:scale-110 hover:rotate-6">
              <Settings className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-lifeos-dark mb-4 tracking-tight">
              Connect Your Apps
            </h1>
            <p className="text-lifeos-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
              Connect your favorite productivity apps so our AI can build a unified dashboard that works with your existing workflow.
            </p>
          </div>

          {/* Integrations Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {integrations.map((integration) => {
              const isConnected = connectedIntegrations.includes(integration.id);
              const isConnecting = connecting === integration.id;
              const isComingSoon = integration.status === 'coming-soon';
              
              return (
                <div
                  key={integration.id}
                  className={`bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/20 hover:shadow-xl hover:scale-105 transition-all duration-300 group ${
                    isComingSoon ? 'opacity-70' : ''
                  } ${
                    isConnected ? 'ring-2 ring-green-400/50 shadow-green-100' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-3 rounded-2xl bg-white/80 backdrop-blur-sm border border-white/30 shadow-lg group-hover:scale-110 transition-transform duration-300 ${
                      isComingSoon ? 'grayscale' : ''
                    }`}>
                      <img 
                        src={integration.icon} 
                        alt={integration.name}
                        className="w-8 h-8"
                      />
                    </div>
                    {isConnected && (
                      <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-lg animate-in fade-in duration-300">
                        <Check className="w-5 h-5 text-white" />
                      </div>
                    )}
                  </div>
                  
                  <h3 className={`text-lifeos-dark font-semibold mb-2 ${isComingSoon ? 'opacity-60' : ''}`}>
                    {integration.name}
                  </h3>
                  <p className={`text-lifeos-gray-400 text-sm mb-2 ${isComingSoon ? 'opacity-60' : ''}`}>
                    {integration.description}
                  </p>
                  {!isComingSoon && (
                    <p className={`text-lifeos-gray-500 text-xs mb-4 ${
                      integration.authType === 'oauth' ? 'text-blue-600' : 'text-orange-600'
                    }`}>
                      {integration.authType === 'oauth' ? '🔐 Secure OAuth authentication' : '🔑 Requires API key'}
                    </p>
                  )}
                  
                  {isComingSoon ? (
                    <div className="w-full bg-lifeos-gray-200 text-lifeos-gray-400 py-3 px-4 rounded-xl font-medium text-center border border-lifeos-gray-300">
                      Coming Soon
                    </div>
                  ) : isConnected ? (
                    <div className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-3 px-4 rounded-xl font-medium text-center flex items-center justify-center gap-2 shadow-lg">
                      <Check className="w-5 h-5" />
                      Connected
                    </div>
                  ) : (
                    <button
                      onClick={() => handleConnect(integration.id)}
                      disabled={isConnecting}
                      className={`w-full bg-gradient-to-r ${integration.color} hover:opacity-90 text-white py-3 px-4 rounded-xl font-medium transition-all duration-200 hover:scale-105 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl ${
                        isConnecting ? 'opacity-70 cursor-not-allowed' : ''
                      }`}
                    >
                      {isConnecting ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          {integration.authType === 'oauth' ? 'Redirecting...' : 'Connecting...'}
                        </>
                      ) : (
                        <>
                          <ExternalLink className="w-5 h-5" />
                          {integration.authType === 'oauth' ? 'Connect with OAuth' : 'Enter API Key'}
                        </>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Connected Summary */}
          {connectedIntegrations.length > 0 && (
            <div className="bg-gradient-to-r from-green-500/10 to-green-600/10 border border-green-400/30 rounded-2xl p-6 mb-8 shadow-lg backdrop-blur-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-lg">
                  <Check className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-green-700 font-semibold">
                  {connectedIntegrations.length} Integration{connectedIntegrations.length !== 1 ? 's' : ''} Connected
                </h3>
              </div>
              <p className="text-green-600 text-sm">
                Your AI agent will now be able to access data from these apps to build a more personalized dashboard.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4 justify-center">
            <button
              onClick={handleSkipAll}
              className="px-8 py-4 bg-white/60 backdrop-blur-sm hover:bg-white/80 text-lifeos-dark rounded-2xl font-semibold transition-all duration-200 border border-white/20 hover:scale-105 shadow-lg hover:shadow-xl"
            >
              Skip Integrations
            </button>
            <button
              onClick={handleContinue}
              className="bg-gradient-to-r from-lifeos-primary to-lifeos-secondary hover:from-lifeos-primary/90 hover:to-lifeos-secondary/90 text-white px-12 py-4 rounded-2xl font-semibold transition-all duration-200 hover:scale-105 flex items-center gap-3 shadow-xl hover:shadow-2xl hover:shadow-lifeos-primary/25"
            >
              Build My Dashboard
              <ArrowRight className="w-6 h-6" />
            </button>
          </div>

          {/* Helper Text */}
          <div className="text-center mt-8">
            <p className="text-lifeos-gray-400 text-sm leading-relaxed">
              You can connect more integrations later in Settings.
              <br />
              Our AI works great even without any integrations.
            </p>
          </div>
        </div>
      </div>

      {/* Notification */}
      {notification.isVisible && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-lg border ${
          notification.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
          notification.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
          'bg-blue-50 border-blue-200 text-blue-800'
        } max-w-md animate-in slide-in-from-top-5 duration-300`}>
          <div className="flex items-center gap-3">
            <div className={`w-5 h-5 ${
              notification.type === 'success' ? 'text-green-500' :
              notification.type === 'error' ? 'text-red-500' :
              'text-blue-500'
            }`}>
              {notification.type === 'success' ? <Check className="w-5 h-5" /> :
               notification.type === 'error' ? '❌' :
               'ℹ️'}
            </div>
            <p className="text-sm font-medium">{notification.message}</p>
            <button
              onClick={() => setNotification(prev => ({ ...prev, isVisible: false }))}
              className="ml-auto text-gray-400 hover:text-gray-600 transition-colors"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}