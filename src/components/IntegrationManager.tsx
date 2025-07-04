import React, { useState, useEffect } from 'react';
import { integrationManager } from '../services/integrations/IntegrationManager';
import { IntegrationProvider, ImportResult } from '../services/integrations/types';
import { 
  Check, 
  ExternalLink,
  Settings,
  X,
  RefreshCw,
  Download,
  AlertCircle,
  Zap
} from 'lucide-react';

interface IntegrationManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onImport?: (results: ImportResult[]) => void;
  categories?: Array<{ id: string; name: string; icon: string; color: string }>;
}

export default function IntegrationManager({ isOpen, onClose, onImport, categories = [] }: IntegrationManagerProps) {
  const [availableProviders, setAvailableProviders] = useState<any[]>([]);
  const [connectedIntegrations, setConnectedIntegrations] = useState<any[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<IntegrationProvider | null>(null);
  const [credentials, setCredentials] = useState({ apiKey: '', accessToken: '', refreshToken: '' });
  const [isConnecting, setIsConnecting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [activeTab, setActiveTab] = useState<'available' | 'connected' | 'results'>('available');

  // YouTube specific states
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  
  // Category selection for imports
  const [showCategorySelector, setShowCategorySelector] = useState<{
    provider: IntegrationProvider;
    integrationId: string;
    isVisible: boolean;
  }>({ provider: 'todoist', integrationId: '', isVisible: false });
  const [selectedImportCategory, setSelectedImportCategory] = useState<string>('');

  const initializeAndLoadIntegrations = async () => {
    try {
      console.log('🔄 Initializing IntegrationManager...');
      
      // Force re-initialization to ensure fresh state
      await integrationManager.initialize();
      
      console.log('✅ IntegrationManager initialized, loading integrations...');
      
      // Add a small delay to ensure async initialization completes
      setTimeout(() => {
        loadIntegrations();
        console.log('📊 Integration loading complete');
      }, 100);
      
    } catch (error) {
      console.error('Failed to initialize integrations:', error);
      
      // Still try to load what we can
      setTimeout(() => {
        loadIntegrations();
      }, 100);
    }
  };

  useEffect(() => {
    if (isOpen) {
      // Clear previous state to avoid stale data
      setAvailableProviders([]);
      setConnectedIntegrations([]);
      setImportResults([]);
      
      initializeAndLoadIntegrations();
      
      // Auto-connect if returning from OAuth
      const shouldAutoConnectNotion = sessionStorage.getItem('notion_auto_connect');
      const shouldAutoConnectGoogle = sessionStorage.getItem('google_auto_connect');
      const shouldAutoConnectMicrosoft = sessionStorage.getItem('microsoft_auto_connect');
      const shouldAutoConnectOneNote = sessionStorage.getItem('onenote_auto_connect');
      
      if (shouldAutoConnectNotion === 'true') {
        console.log('🔗 Auto-connecting Notion after OAuth...');
        setSelectedProvider('notion');
        // Auto-trigger connection after setting provider
        setTimeout(async () => {
          try {
            const storedToken = sessionStorage.getItem('notion_access_token');
            if (storedToken) {
              setIsConnecting(true);
              
              const integrationId = await integrationManager.createIntegration(
                'notion',
                {},
                { accessToken: storedToken }
              );

              await integrationManager.authenticateIntegration(integrationId);
              
              // Clear stored tokens
              sessionStorage.removeItem('notion_access_token');
              sessionStorage.removeItem('notion_workspace');
              sessionStorage.removeItem('notion_auto_connect');
              
              // Reload and switch to connected tab
              loadIntegrations();
              setActiveTab('connected');
              setSelectedProvider(null);
              setIsConnecting(false);
              
              console.log('✅ Notion auto-connection successful');
            }
          } catch (error) {
            console.error('❌ Notion auto-connection failed:', error);
            setIsConnecting(false);
          }
        }, 500);
      } else if (shouldAutoConnectGoogle === 'true') {
        console.log('🔗 Auto-connecting Google Calendar after OAuth...');
        setSelectedProvider('google-calendar');
        // Auto-trigger connection after setting provider
        setTimeout(async () => {
          try {
            const storedAccessToken = sessionStorage.getItem('google_access_token');
            const storedRefreshToken = sessionStorage.getItem('google_refresh_token');
            if (storedAccessToken) {
              setIsConnecting(true);
              
              const integrationId = await integrationManager.createIntegration(
                'google-calendar',
                {},
                { 
                  accessToken: storedAccessToken,
                  refreshToken: storedRefreshToken || undefined
                }
              );

              await integrationManager.authenticateIntegration(integrationId);
              
              // Clear stored tokens
              sessionStorage.removeItem('google_access_token');
              sessionStorage.removeItem('google_refresh_token');
              sessionStorage.removeItem('google_auto_connect');
              
              // Reload and switch to connected tab
              loadIntegrations();
              setActiveTab('connected');
              setSelectedProvider(null);
              setIsConnecting(false);
              
              console.log('✅ Google Calendar auto-connection successful');
            }
          } catch (error) {
            console.error('❌ Google Calendar auto-connection failed:', error);
            setIsConnecting(false);
          }
        }, 500);
      } else if (shouldAutoConnectMicrosoft === 'true') {
        console.log('🔗 Auto-connecting Microsoft Calendar after OAuth...');
        setSelectedProvider('microsoft-calendar');
        // Auto-trigger connection after setting provider
        setTimeout(async () => {
          try {
            const storedAccessToken = sessionStorage.getItem('microsoft_access_token');
            const storedRefreshToken = sessionStorage.getItem('microsoft_refresh_token');
            if (storedAccessToken) {
              setIsConnecting(true);
              
              const integrationId = await integrationManager.createIntegration(
                'microsoft-calendar',
                {},
                { 
                  accessToken: storedAccessToken,
                  refreshToken: storedRefreshToken || undefined
                }
              );

              await integrationManager.authenticateIntegration(integrationId);
              
              // Clear stored tokens
              sessionStorage.removeItem('microsoft_access_token');
              sessionStorage.removeItem('microsoft_refresh_token');
              sessionStorage.removeItem('microsoft_auto_connect');
              
              // Reload and switch to connected tab
              loadIntegrations();
              setActiveTab('connected');
              setSelectedProvider(null);
              setIsConnecting(false);
              
              console.log('✅ Microsoft Calendar auto-connection successful');
            }
          } catch (error) {
            console.error('❌ Microsoft Calendar auto-connection failed:', error);
            setIsConnecting(false);
          }
        }, 500);
      } else if (shouldAutoConnectOneNote === 'true') {
        console.log('🔗 Auto-connecting OneNote after OAuth...');
        setSelectedProvider('onenote');
        // Auto-trigger connection after setting provider
        setTimeout(async () => {
          try {
            const storedAccessToken = sessionStorage.getItem('onenote_access_token');
            const storedRefreshToken = sessionStorage.getItem('onenote_refresh_token');
            if (storedAccessToken) {
              setIsConnecting(true);
              
              const integrationId = await integrationManager.createIntegration(
                'onenote',
                {},
                { 
                  accessToken: storedAccessToken,
                  refreshToken: storedRefreshToken || undefined
                }
              );

              await integrationManager.authenticateIntegration(integrationId);
              
              // Clear stored tokens
              sessionStorage.removeItem('onenote_access_token');
              sessionStorage.removeItem('onenote_refresh_token');
              sessionStorage.removeItem('onenote_auto_connect');
              
              // Reload and switch to connected tab
              loadIntegrations();
              setActiveTab('connected');
              setSelectedProvider(null);
              setIsConnecting(false);
              
              console.log('✅ OneNote auto-connection successful');
            }
          } catch (error) {
            console.error('❌ OneNote auto-connection failed:', error);
            setIsConnecting(false);
          }
        }, 500);
      }
    }
  }, [isOpen]); // initializeAndLoadIntegrations is defined within useEffect scope

  const loadIntegrations = () => {
    try {
      const providers = integrationManager.getAvailableProviders();
      const connected = integrationManager.getAllIntegrations();
      
      // Filter out any integrations that failed to load properly
      const validConnected = connected.filter(({ integration }) => {
        try {
          return integration && typeof integration.isConnected === 'function';
        } catch (error) {
          console.warn('Invalid integration found and filtered out:', error);
          return false;
        }
      });
      
      console.log('📊 Loading integrations:', {
        availableProviders: providers.length,
        connectedIntegrations: validConnected.length,
        connectedDetails: validConnected.map(({ id, integration }) => {
          try {
            return {
              id,
              provider: integration.getProvider(),
              name: integration.getName(),
              isConnected: integration.isConnected(),
              status: integration.getStatus()
            };
          } catch (error) {
            console.error('Error getting integration details:', error);
            return { id, error: true };
          }
        })
      });
      
      setAvailableProviders(providers);
      setConnectedIntegrations(validConnected);
    } catch (error) {
      console.error('Error loading integrations:', error);
      // Set empty arrays as fallback
      setAvailableProviders([]);
      setConnectedIntegrations([]);
    }
  };

  const handleRefresh = async () => {
    console.log('🔄 Manually refreshing integrations...');
    await initializeAndLoadIntegrations();
  };

  const handleConnect = async () => {
    if (!selectedProvider) return;

    setIsConnecting(true);
    try {
      // Check for stored OAuth tokens (from callback)
      let finalCredentials = {
        apiKey: credentials.apiKey || undefined,
        accessToken: credentials.accessToken || undefined,
        refreshToken: credentials.refreshToken || undefined
      };
      
      if (selectedProvider === 'notion') {
        const storedToken = sessionStorage.getItem('notion_access_token');
        const storedWorkspace = sessionStorage.getItem('notion_workspace');
        
        if (storedToken) {
          finalCredentials.accessToken = storedToken;
          console.log('🔗 Using stored Notion access token for workspace:', storedWorkspace);
          
          // Clear the stored tokens after use
          sessionStorage.removeItem('notion_access_token');
          sessionStorage.removeItem('notion_workspace');
          sessionStorage.removeItem('notion_auto_connect');
        }
      } else if (selectedProvider === 'google-calendar') {
        const storedAccessToken = sessionStorage.getItem('google_access_token');
        const storedRefreshToken = sessionStorage.getItem('google_refresh_token');
        
        if (storedAccessToken) {
          finalCredentials.accessToken = storedAccessToken;
          finalCredentials.refreshToken = storedRefreshToken || undefined;
          console.log('🔗 Using stored Google Calendar access token');
          
          // Clear the stored tokens after use
          sessionStorage.removeItem('google_access_token');
          sessionStorage.removeItem('google_refresh_token');
          sessionStorage.removeItem('google_auto_connect');
        }
      } else if (selectedProvider === 'microsoft-calendar') {
        const storedAccessToken = sessionStorage.getItem('microsoft_access_token');
        const storedRefreshToken = sessionStorage.getItem('microsoft_refresh_token');
        
        if (storedAccessToken) {
          finalCredentials.accessToken = storedAccessToken;
          finalCredentials.refreshToken = storedRefreshToken || undefined;
          console.log('🔗 Using stored Microsoft Calendar access token');
          
          // Clear the stored tokens after use
          sessionStorage.removeItem('microsoft_access_token');
          sessionStorage.removeItem('microsoft_refresh_token');
          sessionStorage.removeItem('microsoft_auto_connect');
        }
      } else if (selectedProvider === 'onenote') {
        const storedAccessToken = sessionStorage.getItem('onenote_access_token');
        const storedRefreshToken = sessionStorage.getItem('onenote_refresh_token');
        
        if (storedAccessToken) {
          finalCredentials.accessToken = storedAccessToken;
          finalCredentials.refreshToken = storedRefreshToken || undefined;
          console.log('🔗 Using stored OneNote access token');
          
          // Clear the stored tokens after use
          sessionStorage.removeItem('onenote_access_token');
          sessionStorage.removeItem('onenote_refresh_token');
          sessionStorage.removeItem('onenote_auto_connect');
        }
      }

      const integrationId = await integrationManager.createIntegration(
        selectedProvider,
        {},
        finalCredentials
      );

      await integrationManager.authenticateIntegration(integrationId);
      
      // Reload integrations with a small delay to ensure state is updated
      setTimeout(() => {
        loadIntegrations();
      }, 500);
      
      // Reset form
      setSelectedProvider(null);
      setCredentials({ apiKey: '', accessToken: '', refreshToken: '' });
      setActiveTab('connected');
      
      console.log('✅ Integration connected successfully');
    } catch (error) {
      console.error('❌ Failed to connect integration:', error);
      alert(`Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleImport = async (integrationId?: string, provider?: IntegrationProvider) => {
    // Show category selector for single integration imports
    if (integrationId && provider) {
      setShowCategorySelector({
        provider,
        integrationId,
        isVisible: true
      });
      return;
    }
    
    // For bulk imports, proceed directly
    setIsImporting(true);
    try {
      let results: ImportResult[];
      
      // Bulk import from all connected integrations
      const connectedIds = connectedIntegrations
        .filter(({ integration }) => integration.isConnected())
        .map(({ id }) => id);
      
      results = await integrationManager.bulkImport(connectedIds);
      
      setImportResults(results);
      setActiveTab('results');
      
      if (onImport) {
        onImport(results);
      }
      
      console.log('📥 Import completed:', results);
    } catch (error) {
      console.error('❌ Import failed:', error);
      alert(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleCategorySelectedImport = async () => {
    if (!selectedImportCategory || !showCategorySelector.integrationId) return;
    
    setIsImporting(true);
    setShowCategorySelector({ provider: 'todoist', integrationId: '', isVisible: false });
    
    try {
      const isForceImport = showCategorySelector.integrationId.startsWith('force-');
      const actualIntegrationId = isForceImport 
        ? showCategorySelector.integrationId.replace('force-', '')
        : showCategorySelector.integrationId;

      if (isForceImport) {
        // Clear existing items from this provider first
        const existingItems = JSON.parse(localStorage.getItem('lifeStructureItems') || '[]');
        const filteredItems = existingItems.filter((item: any) => 
          item.metadata?.source !== showCategorySelector.provider
        );
        localStorage.setItem('lifeStructureItems', JSON.stringify(filteredItems));
        console.log(`🗑️ Cleared existing ${showCategorySelector.provider} items for re-import`);
      }

      // Import from specific integration with selected category
      const result = await integrationManager.importData(
        actualIntegrationId,
        selectedImportCategory
      );
      
      setImportResults([result]);
      setActiveTab('results');
      
      if (onImport) {
        onImport([result]);
      }
      
      console.log('📥 Import completed:', result);
    } catch (error) {
      console.error('❌ Import failed:', error);
      alert(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsImporting(false);
      setSelectedImportCategory('');
    }
  };

  const handleForceReimport = async (integrationId: string, provider: IntegrationProvider) => {
    const confirmed = window.confirm(`This will clear all existing ${provider} items and re-import them. Are you sure?`);
    if (!confirmed) return;

    // Show category selector for force re-import
    setShowCategorySelector({
      provider,
      integrationId: `force-${integrationId}`, // Mark as force import
      isVisible: true
    });
  };

  const handleYouTubeImport = async () => {
    if (!youtubeUrl) return;

    const youtubeIntegration = connectedIntegrations.find(
      ({ integration }) => integration.getProvider() === 'youtube'
    );

    if (!youtubeIntegration) {
      alert('Please connect YouTube integration first');
      return;
    }

    setIsImporting(true);
    try {
      const item = await integrationManager.importYouTubeTranscript(
        youtubeIntegration.id,
        youtubeUrl,
        selectedCategory || undefined
      );
      
      console.log('📺 YouTube transcript imported:', item);
      setYoutubeUrl('');
      alert('YouTube transcript imported successfully!');
    } catch (error) {
      console.error('❌ YouTube import failed:', error);
      alert(`YouTube import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleDisconnect = async (integrationId: string) => {
    try {
      const success = integrationManager.removeIntegration(integrationId);
      if (success) {
        console.log('🔌 Integration disconnected successfully');
        // Reload integrations with a delay to ensure state is updated
        setTimeout(() => {
          loadIntegrations();
        }, 100);
      } else {
        console.error('Failed to disconnect integration');
        alert('Failed to disconnect integration. Please try again.');
      }
    } catch (error) {
      console.error('Error disconnecting integration:', error);
      alert('Error disconnecting integration. Please try again.');
    }
  };

  const getOAuthUrl = async (provider: IntegrationProvider): Promise<string | null> => {
    switch (provider) {
      case 'notion':
        return (integrationManager.constructor as any).getNotionOAuthUrl();
      case 'todoist':
        // Keep existing logic for other providers if they need custom URLs
        const clientId = process.env.REACT_APP_CLIENT_ID || 'your-client-id';
        const redirectUri = `https://app.lifely.dev/oauth/callback`;
        return (integrationManager.constructor as any).getTodoistOAuthUrl(clientId, redirectUri);
      case 'google-calendar':
        const gcClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || 'your-client-id';
        const gcRedirectUri = `https://app.lifely.dev/oauth/callback`;
        return (integrationManager.constructor as any).getGoogleCalendarOAuthUrl(gcClientId, gcRedirectUri);
      case 'microsoft-calendar':
        const msClientId = process.env.REACT_APP_MICROSOFT_CLIENT_ID || 'your-client-id';
        const msRedirectUri = `https://app.lifely.dev/oauth/callback`;
        return await (integrationManager.constructor as any).getMicrosoftCalendarOAuthUrl(msClientId, msRedirectUri);
      case 'onenote':
        const oneNoteClientId = process.env.REACT_APP_MICROSOFT_CLIENT_ID || 'your-client-id';
        const oneNoteRedirectUri = `https://app.lifely.dev/oauth/callback`;
        return await (integrationManager.constructor as any).getOneNoteOAuthUrl(oneNoteClientId, oneNoteRedirectUri);
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-lifeos-50 via-lifeos-100 to-lifeos-200 dark:from-lifeos-dark dark:via-gray-900 dark:to-lifeos-dark/80 z-50 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-transparent hover:scrollbar-thumb-gray-500">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-20 h-20 bg-gradient-to-br from-lifeos-primary/20 to-lifeos-secondary/20 rounded-full blur-xl animate-float" style={{animationDelay: '0s'}}></div>
        <div className="absolute top-40 right-20 w-16 h-16 bg-gradient-to-br from-lifeos-secondary/30 to-purple-400/30 rounded-lg blur-lg animate-pulse" style={{animationDelay: '1s', animationDuration: '6s'}}></div>
        <div className="absolute bottom-32 left-1/4 w-12 h-12 bg-gradient-to-br from-lifeos-primary/25 to-blue-400/25 rounded-full blur-md animate-ping" style={{animationDelay: '2s', animationDuration: '8s'}}></div>
        <div className="absolute top-1/3 right-1/3 w-24 h-24 bg-gradient-to-br from-purple-400/20 to-lifeos-secondary/20 rounded-xl blur-lg animate-float-delayed"></div>
        <div className="absolute bottom-20 right-10 w-14 h-14 bg-gradient-to-br from-lifeos-primary/30 to-pink-400/30 rounded-full blur-sm animate-bounce" style={{animationDelay: '4s', animationDuration: '7s'}}></div>
      </div>

      <div className="relative z-10 min-h-screen flex flex-col max-h-screen">
        {/* Header */}
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-br from-lifeos-primary to-lifeos-secondary rounded-2xl flex items-center justify-center shadow-xl transition-all duration-300 hover:scale-110 hover:rotate-6">
                <Settings className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-lifeos-dark dark:text-white tracking-tight">
                  Integration Manager
                </h1>
                <p className="text-lifeos-gray-400 dark:text-gray-300 mt-1">
                  Connect and manage your third-party app integrations
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-3 hover:bg-white/20 dark:hover:bg-gray-700/50 rounded-xl transition-all duration-200 hover:scale-105 backdrop-blur-sm border border-white/20"
            >
              <X className="w-6 h-6 text-lifeos-dark dark:text-white" />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex space-x-2 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl p-2 border border-white/20 dark:border-gray-700/30 shadow-xl">
            {[
              { id: 'available', label: 'Available', icon: ExternalLink },
              { id: 'connected', label: 'Connected', icon: Check },
              { id: 'results', label: 'Results', icon: Zap }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-lifeos-primary to-lifeos-secondary text-white shadow-lg'
                    : 'text-lifeos-gray-400 dark:text-gray-300 hover:text-lifeos-dark dark:hover:text-white hover:bg-white/40 dark:hover:bg-gray-700/40'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 px-8 pb-8 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-transparent hover:scrollbar-thumb-gray-500">
          {/* Available Integrations Tab */}
          {activeTab === 'available' && (
            <div className="space-y-8">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {availableProviders.map(provider => {
                  const isSelected = selectedProvider === provider.provider;
                  const isComingSoon = !provider.isImplemented;
                  
                  return (
                    <div
                      key={provider.provider}
                      className={`bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl p-6 border border-white/20 dark:border-gray-700/30 hover:shadow-xl hover:scale-105 transition-all duration-300 group cursor-pointer ${
                        isComingSoon ? 'opacity-70' : ''
                      } ${
                        isSelected ? 'ring-2 ring-lifeos-primary/50 shadow-lifeos-primary/20' : ''
                      }`}
                      onClick={() => provider.isImplemented && setSelectedProvider(provider.provider)}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className={`p-3 rounded-2xl bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm border border-white/30 dark:border-gray-600/30 shadow-lg group-hover:scale-110 transition-transform duration-300 ${
                          isComingSoon ? 'grayscale' : ''
                        }`}>
                          {provider.icon.startsWith('/') ? (
                            <img src={provider.icon} alt={provider.name} className="w-8 h-8" />
                          ) : (
                            <span className="text-2xl">{provider.icon}</span>
                          )}
                        </div>
                        {isSelected && (
                          <div className="w-8 h-8 bg-gradient-to-r from-lifeos-primary to-lifeos-secondary rounded-full flex items-center justify-center shadow-lg animate-in fade-in duration-300">
                            <Check className="w-5 h-5 text-white" />
                          </div>
                        )}
                      </div>
                      
                      <h3 className={`text-lifeos-dark dark:text-white font-semibold mb-2 ${
                        isComingSoon ? 'opacity-60' : ''
                      }`}>
                        {provider.name}
                        {isComingSoon && (
                          <span className="ml-2 text-xs bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded-full">
                            Coming Soon
                          </span>
                        )}
                      </h3>
                      <p className={`text-lifeos-gray-400 dark:text-gray-400 text-sm mb-4 ${
                        isComingSoon ? 'opacity-60' : ''
                      }`}>
                        {provider.description}
                      </p>
                      
                      {isComingSoon && (
                        <div className="w-full bg-lifeos-gray-200 dark:bg-gray-600 text-lifeos-gray-400 dark:text-gray-400 py-3 px-4 rounded-xl font-medium text-center border border-lifeos-gray-300 dark:border-gray-600">
                          Coming Soon
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Connection Form */}
              {selectedProvider && (
                <div className="bg-gradient-to-r from-lifeos-primary/10 to-lifeos-secondary/10 dark:from-lifeos-primary/20 dark:to-lifeos-secondary/20 border border-lifeos-primary/30 dark:border-lifeos-primary/40 rounded-2xl p-6 shadow-lg backdrop-blur-sm">
                  <h3 className="font-semibold text-lifeos-dark dark:text-white mb-4 text-lg">
                    Connect {availableProviders.find(p => p.provider === selectedProvider)?.name}
                  </h3>
                  
                  <div className="space-y-4">
                    {['todoist'].includes(selectedProvider) && (
                      <div>
                        <label className="block text-sm font-medium text-lifeos-dark dark:text-gray-300 mb-2">
                          API Key
                        </label>
                        <input
                          type="password"
                          value={credentials.apiKey}
                          onChange={(e) => setCredentials(prev => ({ ...prev, apiKey: e.target.value }))}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-lifeos-primary focus:border-transparent dark:bg-gray-700 dark:text-white transition-all duration-200"
                          placeholder="Enter your API key"
                        />
                      </div>
                    )}

                    {selectedProvider === 'youtube' && (
                      <div className="space-y-2">
                        <p className="text-sm text-lifeos-dark dark:text-gray-300">
                          YouTube integration is ready to use! No API key required.
                        </p>
                        <p className="text-xs text-lifeos-gray-400 dark:text-gray-400">
                          Simply click Connect to start importing video transcripts.
                        </p>
                      </div>
                    )}

                    {['google-calendar', 'microsoft-calendar', 'onenote', 'notion'].includes(selectedProvider) && (
                      <div className="space-y-3">
                        <p className="text-sm text-lifeos-dark dark:text-gray-300">
                          This integration uses OAuth authentication.
                        </p>
                        <button
                          onClick={async () => {
                            const url = await getOAuthUrl(selectedProvider);
                            if (url) {
                              console.log('🔗 Opening OAuth URL:', url);
                              window.open(url, '_blank', 'noopener,noreferrer');
                            }
                          }}
                          className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-xl"
                        >
                          <ExternalLink className="w-5 h-5" />
                          <span>Authorize with {availableProviders.find(p => p.provider === selectedProvider)?.name}</span>
                        </button>
                      </div>
                    )}

                    <div className="flex space-x-3">
                      <button
                        onClick={handleConnect}
                        disabled={isConnecting || (!credentials.apiKey && !['google-calendar', 'microsoft-calendar', 'onenote', 'notion', 'youtube'].includes(selectedProvider))}
                        className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-xl"
                      >
                        {isConnecting ? (
                          <>
                            <RefreshCw className="w-5 h-5 animate-spin" />
                            <span>Connecting...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-5 h-5" />
                            <span>Connect</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => setSelectedProvider(null)}
                        className="px-6 py-3 bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm text-lifeos-dark dark:text-white rounded-xl hover:bg-white/80 dark:hover:bg-gray-700/80 transition-all duration-200 border border-white/20 dark:border-gray-600/20"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Connected Integrations Tab */}
          {activeTab === 'connected' && (
            <div className="space-y-8">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <Check className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-lifeos-dark dark:text-white">
                      Connected Integrations
                    </h3>
                    <p className="text-lifeos-gray-400 dark:text-gray-400">
                      {connectedIntegrations.length} integration{connectedIntegrations.length !== 1 ? 's' : ''} connected
                    </p>
                  </div>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={handleRefresh}
                    className="flex items-center space-x-2 px-4 py-3 bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm text-lifeos-dark dark:text-white rounded-xl hover:bg-white/80 dark:hover:bg-gray-700/80 transition-all duration-200 hover:scale-105 border border-white/20 dark:border-gray-600/20"
                  >
                    <RefreshCw className="w-5 h-5" />
                    <span>Refresh</span>
                  </button>
                  <button
                    onClick={() => handleImport()}
                    disabled={isImporting || connectedIntegrations.length === 0}
                    className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-lifeos-primary to-lifeos-secondary text-white rounded-xl hover:from-lifeos-primary/90 hover:to-lifeos-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-xl"
                  >
                    {isImporting ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        <span>Importing...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-5 h-5" />
                        <span>Import All</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {connectedIntegrations.map(({ id, integration }) => {
                  const isConnected = integration.isConnected();
                  
                  return (
                    <div key={id} className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl p-6 border border-white/20 dark:border-gray-700/30 shadow-lg hover:shadow-xl transition-all duration-300 group">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="p-3 rounded-2xl bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm border border-white/30 dark:border-gray-600/30 shadow-lg group-hover:scale-110 transition-transform duration-300">
                            {integration.getConfig().icon.startsWith('/') ? (
                              <img src={integration.getConfig().icon} alt={integration.getName()} className="w-8 h-8" onError={(e) => {
                                // Fallback to text icon if image fails to load
                                const target = e.target as HTMLImageElement;
                                const parent = target.parentElement;
                                if (parent) {
                                  parent.innerHTML = `<span class="text-2xl">📋</span>`;
                                }
                              }} />
                            ) : (
                              <span className="text-2xl">{integration.getConfig().icon}</span>
                            )}
                          </div>
                          <div>
                            <h4 className="font-semibold text-lifeos-dark dark:text-white">
                              {integration.getName()}
                            </h4>
                            <div className="flex items-center space-x-2">
                              <div className={`w-2 h-2 rounded-full ${
                                isConnected ? 'bg-green-500' : 'bg-red-500'
                              }`}></div>
                              <p className={`text-sm ${
                                isConnected ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                              }`}>
                                {isConnected ? 'Connected' : 'Disconnected'}
                              </p>
                            </div>
                          </div>
                        </div>
                        {isConnected && (
                          <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-lg">
                            <Check className="w-5 h-5 text-white" />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleImport(id, integration.getProvider())}
                          disabled={isImporting || !integration.isConnected()}
                          className="flex items-center space-x-1 px-3 py-2 text-sm bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 transition-all duration-200 hover:scale-105 shadow-md"
                        >
                          <Download className="w-4 h-4" />
                          <span>Import</span>
                        </button>
                        {integration.getProvider() === 'todoist' && (
                          <button
                            onClick={() => handleForceReimport(id, integration.getProvider())}
                            disabled={isImporting || !integration.isConnected()}
                            className="flex items-center space-x-1 px-3 py-2 text-sm bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 transition-all duration-200 hover:scale-105 shadow-md"
                            title="Clear existing Todoist items and re-import"
                          >
                            <RefreshCw className="w-4 h-4" />
                            <span>Re-import</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleDisconnect(id)}
                          className="flex items-center space-x-1 px-3 py-2 text-sm bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-200 hover:scale-105 shadow-md"
                        >
                          <X className="w-4 h-4" />
                          <span>Disconnect</span>
                        </button>
                      </div>
                    </div>
                  );
                })}

                {connectedIntegrations.length === 0 && (
                  <div className="col-span-2 text-center py-12">
                    <div className="w-16 h-16 bg-gradient-to-br from-lifeos-gray-200 to-lifeos-gray-300 dark:from-gray-700 dark:to-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <AlertCircle className="w-8 h-8 text-lifeos-gray-400 dark:text-gray-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-lifeos-dark dark:text-white mb-2">
                      No integrations connected
                    </h3>
                    <p className="text-lifeos-gray-400 dark:text-gray-400 mb-6">
                      Connect your favorite apps to start syncing data
                    </p>
                    <button
                      onClick={() => setActiveTab('available')}
                      className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-lifeos-primary to-lifeos-secondary text-white rounded-xl hover:from-lifeos-primary/90 hover:to-lifeos-secondary/90 transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-xl"
                    >
                      <ExternalLink className="w-5 h-5" />
                      <span>Browse Integrations</span>
                    </button>
                  </div>
                )}
              </div>

              {/* YouTube Special Import */}
              {connectedIntegrations.some(({ integration }) => integration.getProvider() === 'youtube') && (
                <div className="md:col-span-2 bg-gradient-to-r from-red-500/10 to-red-600/10 dark:from-red-900/20 dark:to-red-800/20 border border-red-400/30 dark:border-red-600/30 rounded-2xl p-6 shadow-lg backdrop-blur-sm">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center shadow-lg">
                      <span className="text-white text-xl">📺</span>
                    </div>
                    <div>
                      <h4 className="font-semibold text-lifeos-dark dark:text-white text-lg">
                        YouTube Transcript Import
                      </h4>
                      <p className="text-red-600 dark:text-red-400 text-sm">
                        Extract insights from your favorite videos
                      </p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <input
                      type="url"
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="w-full px-4 py-3 border border-red-300 dark:border-red-600/50 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700/50 dark:text-white backdrop-blur-sm transition-all duration-200"
                    />
                    <button
                      onClick={handleYouTubeImport}
                      disabled={isImporting || !youtubeUrl}
                      className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 disabled:opacity-50 transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-xl"
                    >
                      {isImporting ? (
                        <>
                          <RefreshCw className="w-5 h-5 animate-spin" />
                          <span>Importing...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-5 h-5" />
                          <span>Import Transcript</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Import Results Tab */}
          {activeTab === 'results' && (
            <div className="space-y-8">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-lifeos-primary to-lifeos-secondary rounded-2xl flex items-center justify-center shadow-lg">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-lifeos-dark dark:text-white">
                    Import Results
                  </h3>
                  <p className="text-lifeos-gray-400 dark:text-gray-400">
                    Recent integration import activity
                  </p>
                </div>
              </div>
              
              {importResults.map((result, index) => (
                <div key={index} className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl p-6 border border-white/20 dark:border-gray-700/30 shadow-lg hover:shadow-xl transition-all duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-lifeos-dark dark:text-white capitalize text-lg">
                      {result.provider}
                    </h4>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      result.failedItems === 0
                        ? 'bg-gradient-to-r from-green-500/20 to-green-600/20 text-green-700 dark:text-green-300 border border-green-400/30'
                        : 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 text-yellow-700 dark:text-yellow-300 border border-yellow-400/30'
                    }`}>
                      {result.importedItems}/{result.totalItems} imported
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-lifeos-dark dark:text-white">{result.totalItems}</div>
                      <div className="text-sm text-lifeos-gray-400 dark:text-gray-400">Total Items</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">{result.importedItems}</div>
                      <div className="text-sm text-lifeos-gray-400 dark:text-gray-400">Imported</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600 dark:text-red-400">{result.failedItems}</div>
                      <div className="text-sm text-lifeos-gray-400 dark:text-gray-400">Failed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-lifeos-gray-400 dark:text-gray-400 mb-1">Types</div>
                      <div className="space-y-1">
                        {Object.entries(result.summary).map(([type, count]) => (
                          <div key={type} className="text-xs bg-lifeos-primary/10 dark:bg-lifeos-primary/20 text-lifeos-primary dark:text-lifeos-primary px-2 py-1 rounded-full">
                            {type}: {count}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {result.errors.length > 0 && (
                    <div className="mt-4 p-4 bg-gradient-to-r from-red-500/10 to-red-600/10 dark:from-red-900/20 dark:to-red-800/20 border border-red-400/30 dark:border-red-600/30 rounded-xl">
                      <div className="flex items-center space-x-2 mb-2">
                        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                        <h5 className="font-medium text-red-800 dark:text-red-200">Import Errors</h5>
                      </div>
                      <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                        {result.errors.map((error, i) => (
                          <li key={i} className="flex items-start space-x-2">
                            <span className="text-red-500 mt-0.5">•</span>
                            <span>{error}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}

              {importResults.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gradient-to-br from-lifeos-gray-200 to-lifeos-gray-300 dark:from-gray-700 dark:to-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Zap className="w-8 h-8 text-lifeos-gray-400 dark:text-gray-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-lifeos-dark dark:text-white mb-2">
                    No import results yet
                  </h3>
                  <p className="text-lifeos-gray-400 dark:text-gray-400 mb-6">
                    Run an import from the Connected tab to see results here
                  </p>
                  <button
                    onClick={() => setActiveTab('connected')}
                    className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-lifeos-primary to-lifeos-secondary text-white rounded-xl hover:from-lifeos-primary/90 hover:to-lifeos-secondary/90 transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-xl"
                  >
                    <Download className="w-5 h-5" />
                    <span>Start Importing</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Category Selection Modal */}
      {showCategorySelector.isVisible && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-md border border-white/20 dark:border-gray-700/30">
            <div className="p-8">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-lifeos-primary to-lifeos-secondary rounded-2xl flex items-center justify-center shadow-lg">
                  <span className="text-white text-xl">📁</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-lifeos-dark dark:text-white">
                    Select Import Category
                  </h3>
                  <p className="text-lifeos-gray-400 dark:text-gray-400 text-sm">
                    Choose destination for {showCategorySelector.provider} items
                  </p>
                </div>
              </div>
              
              <div className="space-y-3 max-h-60 overflow-y-auto mb-6 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-transparent hover:scrollbar-thumb-gray-500">
                {categories.map(category => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedImportCategory(category.id)}
                    className={`w-full p-4 rounded-xl border-2 transition-all duration-200 text-left hover:scale-102 ${
                      selectedImportCategory === category.id
                        ? 'border-lifeos-primary bg-lifeos-primary/10 dark:bg-lifeos-primary/20 shadow-lg'
                        : 'border-white/30 dark:border-gray-600/30 hover:border-lifeos-primary/50 bg-white/50 dark:bg-gray-700/50'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-2 rounded-lg bg-white/80 dark:bg-gray-600/80 shadow-sm">
                        <span className="text-xl">{category.icon}</span>
                      </div>
                      <div>
                        <div className="font-medium text-lifeos-dark dark:text-white">
                          {category.name}
                        </div>
                      </div>
                      {selectedImportCategory === category.id && (
                        <div className="ml-auto">
                          <Check className="w-5 h-5 text-lifeos-primary" />
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={handleCategorySelectedImport}
                  disabled={!selectedImportCategory}
                  className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-lifeos-primary to-lifeos-secondary text-white rounded-xl hover:from-lifeos-primary/90 hover:to-lifeos-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-xl"
                >
                  <Download className="w-5 h-5" />
                  <span>Import to Category</span>
                </button>
                <button
                  onClick={() => {
                    setShowCategorySelector({ provider: 'todoist', integrationId: '', isVisible: false });
                    setSelectedImportCategory('');
                  }}
                  className="px-6 py-3 bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm text-lifeos-dark dark:text-white rounded-xl hover:bg-white/80 dark:hover:bg-gray-700/80 transition-all duration-200 border border-white/20 dark:border-gray-600/20"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}