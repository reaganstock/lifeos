import React, { useState, useEffect } from 'react';
import { integrationManager } from '../services/integrations/IntegrationManager';
import { IntegrationProvider, ImportResult } from '../services/integrations/types';

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

  useEffect(() => {
    if (isOpen) {
      initializeAndLoadIntegrations();
      
      // Auto-connect if returning from OAuth
      const shouldAutoConnectNotion = sessionStorage.getItem('notion_auto_connect');
      const shouldAutoConnectGoogle = sessionStorage.getItem('google_auto_connect');
      const shouldAutoConnectMicrosoft = sessionStorage.getItem('microsoft_auto_connect');
      
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
      }
    }
  }, [isOpen]);

  const loadIntegrations = () => {
    const providers = integrationManager.getAvailableProviders();
    const connected = integrationManager.getAllIntegrations();
    
    console.log('📊 Loading integrations:', {
      availableProviders: providers.length,
      connectedIntegrations: connected.length,
      connectedDetails: connected.map(({ id, integration }) => ({
        id,
        provider: integration.getProvider(),
        name: integration.getName(),
        isConnected: integration.isConnected(),
        status: integration.getStatus()
      }))
    });
    
    setAvailableProviders(providers);
    setConnectedIntegrations(connected);
  };

  const initializeAndLoadIntegrations = async () => {
    try {
      console.log('🔄 Initializing IntegrationManager...');
      await integrationManager.initialize();
      console.log('✅ IntegrationManager initialized, loading integrations...');
      loadIntegrations();
      console.log('📊 Integration loading complete');
    } catch (error) {
      console.error('Failed to initialize integrations:', error);
      loadIntegrations(); // Load available providers even if initialization fails
    }
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
      }

      const integrationId = await integrationManager.createIntegration(
        selectedProvider,
        {},
        finalCredentials
      );

      await integrationManager.authenticateIntegration(integrationId);
      
      // Reload integrations
      loadIntegrations();
      
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
    const success = integrationManager.removeIntegration(integrationId);
    if (success) {
      loadIntegrations();
      console.log('🔌 Integration disconnected');
    }
  };

  const getOAuthUrl = async (provider: IntegrationProvider): Promise<string | null> => {
    switch (provider) {
      case 'notion':
        return (integrationManager.constructor as any).getNotionOAuthUrl();
      case 'todoist':
        // Keep existing logic for other providers if they need custom URLs
        const clientId = process.env.REACT_APP_CLIENT_ID || 'your-client-id';
        const redirectUri = `${window.location.origin}/oauth/callback`;
        return (integrationManager.constructor as any).getTodoistOAuthUrl(clientId, redirectUri);
      case 'google-calendar':
        const gcClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || 'your-client-id';
        const gcRedirectUri = `${window.location.origin}/oauth/callback`;
        return (integrationManager.constructor as any).getGoogleCalendarOAuthUrl(gcClientId, gcRedirectUri);
      case 'microsoft-calendar':
        const msClientId = process.env.REACT_APP_MICROSOFT_CLIENT_ID || 'your-client-id';
        const msRedirectUri = `${window.location.origin}/oauth/callback`;
        return await (integrationManager.constructor as any).getMicrosoftCalendarOAuthUrl(msClientId, msRedirectUri);
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                🔗 Third-Party Integrations
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Connect your favorite apps to sync data
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex mt-4 border-b border-gray-200 dark:border-gray-700">
            {[
              { id: 'available', label: 'Available', icon: '🔍' },
              { id: 'connected', label: 'Connected', icon: '✅' },
              { id: 'results', label: 'Results', icon: '📊' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Available Integrations Tab */}
          {activeTab === 'available' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availableProviders.map(provider => (
                  <div
                    key={provider.provider}
                    className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                      selectedProvider === provider.provider
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    } ${!provider.isImplemented ? 'opacity-50' : ''}`}
                    onClick={() => provider.isImplemented && setSelectedProvider(provider.provider)}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{provider.icon}</span>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {provider.name}
                          {!provider.isImplemented && (
                            <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 px-2 py-1 rounded-full">
                              Coming Soon
                            </span>
                          )}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {provider.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Connection Form */}
              {selectedProvider && (
                <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                    Connect {availableProviders.find(p => p.provider === selectedProvider)?.name}
                  </h3>
                  
                  <div className="space-y-4">
                    {['todoist', 'youtube'].includes(selectedProvider) && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          API Key
                        </label>
                        <input
                          type="password"
                          value={credentials.apiKey}
                          onChange={(e) => setCredentials(prev => ({ ...prev, apiKey: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                          placeholder="Enter your API key"
                        />
                      </div>
                    )}

                    {['google-calendar', 'microsoft-calendar', 'notion'].includes(selectedProvider) && (
                      <div className="space-y-2">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
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
                          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          🔗 Authorize with {availableProviders.find(p => p.provider === selectedProvider)?.name}
                        </button>
                      </div>
                    )}

                    <div className="flex space-x-3">
                      <button
                        onClick={handleConnect}
                        disabled={isConnecting || (!credentials.apiKey && !['google-calendar', 'microsoft-calendar', 'notion'].includes(selectedProvider))}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {isConnecting ? '🔄 Connecting...' : '✅ Connect'}
                      </button>
                      <button
                        onClick={() => setSelectedProvider(null)}
                        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
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
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Connected Integrations ({connectedIntegrations.length})
                </h3>
                <button
                  onClick={() => handleImport()}
                  disabled={isImporting || connectedIntegrations.length === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isImporting ? '📥 Importing...' : '📥 Import All'}
                </button>
              </div>

              <div className="space-y-4">
                {connectedIntegrations.map(({ id, integration }) => (
                  <div key={id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{integration.getConfig().icon}</span>
                        <div>
                          <h4 className="font-semibold text-gray-900 dark:text-white">
                            {integration.getName()}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Status: {integration.isConnected() ? '✅ Connected' : '❌ Disconnected'}
                          </p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleImport(id, integration.getProvider())}
                          disabled={isImporting || !integration.isConnected()}
                          className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                          📥 Import
                        </button>
                        {integration.getProvider() === 'todoist' && (
                          <button
                            onClick={() => handleForceReimport(id, integration.getProvider())}
                            disabled={isImporting || !integration.isConnected()}
                            className="px-3 py-1 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors"
                            title="Clear existing Todoist items and re-import"
                          >
                            🔄 Re-import
                          </button>
                        )}
                        <button
                          onClick={() => handleDisconnect(id)}
                          className="px-3 py-1 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                        >
                          🔌 Disconnect
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {connectedIntegrations.length === 0 && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No integrations connected yet. Go to the Available tab to connect some!
                  </div>
                )}
              </div>

              {/* YouTube Special Import */}
              {connectedIntegrations.some(({ integration }) => integration.getProvider() === 'youtube') && (
                <div className="mt-6 p-4 bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 rounded-xl border border-red-200 dark:border-red-800">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                    📺 Import YouTube Transcript
                  </h4>
                  <div className="space-y-3">
                    <input
                      type="url"
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:text-white"
                    />
                    <div className="flex space-x-3">
                      <button
                        onClick={handleYouTubeImport}
                        disabled={isImporting || !youtubeUrl}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        {isImporting ? '📥 Importing...' : '📺 Import Transcript'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Import Results Tab */}
          {activeTab === 'results' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Import Results
              </h3>
              
              {importResults.map((result, index) => (
                <div key={index} className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-900 dark:text-white capitalize">
                      {result.provider}
                    </h4>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      result.failedItems === 0
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                    }`}>
                      {result.importedItems}/{result.totalItems} imported
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Total</span>
                      <div className="font-semibold">{result.totalItems}</div>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Imported</span>
                      <div className="font-semibold text-green-600">{result.importedItems}</div>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Failed</span>
                      <div className="font-semibold text-red-600">{result.failedItems}</div>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Types</span>
                      <div className="font-semibold">
                        {Object.entries(result.summary).map(([type, count]) => (
                          <span key={type} className="mr-2">
                            {type}: {count}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {result.errors.length > 0 && (
                    <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <h5 className="font-medium text-red-800 dark:text-red-200 mb-2">Errors:</h5>
                      <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                        {result.errors.map((error, i) => (
                          <li key={i}>• {error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}

              {importResults.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No import results yet. Run an import from the Connected tab!
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Category Selection Modal */}
      {showCategorySelector.isVisible && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                📁 Select Import Category
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Choose which category to import your {showCategorySelector.provider} items into:
              </p>
              
              <div className="space-y-2 max-h-60 overflow-y-auto mb-6">
                {categories.map(category => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedImportCategory(category.id)}
                    className={`w-full p-3 rounded-lg border-2 transition-colors text-left ${
                      selectedImportCategory === category.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{category.icon}</span>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {category.name}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={handleCategorySelectedImport}
                  disabled={!selectedImportCategory}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  📥 Import to Category
                </button>
                <button
                  onClick={() => {
                    setShowCategorySelector({ provider: 'todoist', integrationId: '', isVisible: false });
                    setSelectedImportCategory('');
                  }}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
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