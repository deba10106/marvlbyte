import React, { useState, KeyboardEvent, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { DomSemanticTools } from './DomSemanticTools';
import type { CometApi } from '../../preload';

// Use the CometApi interface from preload
declare const window: Window & {
  comet: CometApi;
};

type TabInfo = {
  id: string;
  title: string;
  url: string;
  active: boolean;
};

type ApiCall = {
  id: string;
  method: string;
  params: Record<string, any>;
  result?: any;
  timestamp: Date;
};

export const ToolPlayground = () => {
  const [url, setUrl] = useState('');
  const [tabId, setTabId] = useState('');
  const [script, setScript] = useState('// Example: document.title');
  const [apiCalls, setApiCalls] = useState<ApiCall[]>([]);
  const [tabs, setTabs] = useState<TabInfo[]>([]);

  const logApiCall = (method: string, params: Record<string, any>, result?: any) => {
    const call: ApiCall = {
      id: Date.now().toString(),
      method,
      params,
      result,
      timestamp: new Date(),
    };
    setApiCalls(prev => [call, ...prev]);
  };

  const refreshTabs = async () => {
    try {
      const tabs = await window.comet.tabs.list();
      setTabs(tabs);
      if (tabs.length > 0 && !tabs.some(tab => tab.id === tabId)) {
        setTabId(tabs[0].id);
      }
      return tabs;
    } catch (error) {
      console.error('Failed to refresh tabs:', error);
      return [];
    }
  };

  const handleNavigate = async () => {
    try {
      const result = await window.comet.tabs.create(url || undefined);
      const message = result ? `New tab created with ID: ${result.id}` : 'Failed to create tab';
      logApiCall('tabs.create', { url }, result || { error: 'Failed to create tab' });
      if (result) {
        setTabId(result.id);
        await refreshTabs();
      }
      return message;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logApiCall('tabs.create', { url }, { error: errorMessage });
      return `Error: ${errorMessage}`;
    }
  };

  const handleRefresh = async () => {
    try {
      if (!tabId) {
        const tabs = await refreshTabs();
        if (tabs.length === 0) return 'No active tab found';
        setTabId(tabs[0].id);
      }
      await window.comet.refresh(tabId);
      const result = `Refreshed tab ${tabId}`;
      logApiCall('refresh', { tabId }, result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logApiCall('refresh', { tabId }, { error: errorMessage });
      return `Error: ${errorMessage}`;
    }
  };

  const handleGoBack = async () => {
    try {
      if (!tabId) {
        const tabs = await refreshTabs();
        if (tabs.length === 0) return 'No active tab found';
        setTabId(tabs[0].id);
      }
      await window.comet.goBack(tabId);
      const result = `Navigated back in tab ${tabId}`;
      logApiCall('goBack', { tabId }, result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logApiCall('goBack', { tabId }, { error: errorMessage });
      return `Error: ${errorMessage}`;
    }
  };

  const handleGoForward = async () => {
    try {
      if (!tabId) {
        const tabs = await refreshTabs();
        if (tabs.length === 0) return 'No active tab found';
        setTabId(tabs[0].id);
      }
      await window.comet.goForward(tabId);
      const result = `Navigated forward in tab ${tabId}`;
      logApiCall('goForward', { tabId }, result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logApiCall('goForward', { tabId }, { error: errorMessage });
      return `Error: ${errorMessage}`;
    }
  };

  const handleExecuteScript = async () => {
    try {
      if (!tabId) {
        const tabs = await refreshTabs();
        if (tabs.length === 0) return 'No active tab to execute script in';
        setTabId(tabs[0].id);
      }
      const result = await window.comet.executeScript(script, tabId);
      logApiCall('executeScript', { script, tabId }, result);
      return `Script executed in tab ${tabId}`;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logApiCall('executeScript', { script, tabId }, { error: errorMessage });
      return `Error: ${errorMessage}`;
    }
  };

  const handleGetCurrentUrl = async () => {
    try {
      if (!tabId) {
        const tabs = await refreshTabs();
        if (tabs.length === 0) return 'No active tab found';
        setTabId(tabs[0].id);
      }
      const currentUrl = await window.comet.getCurrentURL(tabId);
      const result = `Current URL for tab ${tabId}: ${currentUrl}`;
      logApiCall('getCurrentURL', { tabId }, result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logApiCall('getCurrentURL', { tabId }, { error: errorMessage });
      return `Error: ${errorMessage}`;
    }
  };

  const openDevTools = async () => {
    try {
      await window.comet.openDevTools();
      logApiCall('openDevTools', {}, 'DevTools opened');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logApiCall('openDevTools', {}, { error: errorMessage });
    }
  };

  const inspectElement = async () => {
    try {
      let targetTabId = tabId;
      
      // If no tab is selected, try to get the first available tab
      if (!targetTabId) {
        const availableTabs = await refreshTabs();
        if (availableTabs.length === 0) {
          const errorMsg = 'No tabs available for inspection';
          logApiCall('inspectElement', {}, { error: errorMsg });
          return;
        }
        targetTabId = availableTabs[0].id;
        setTabId(targetTabId);
      }
      
      // Ensure we have a valid tab ID before proceeding
      if (!targetTabId) {
        const errorMsg = 'Failed to determine target tab for inspection';
        logApiCall('inspectElement', {}, { error: errorMsg });
        return;
      }
      
      // Call the inspect element function with the resolved tab ID
      await window.comet.inspectElement(targetTabId);
      logApiCall('inspectElement', { tabId: targetTabId }, 'Inspect element mode activated');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logApiCall('inspectElement', { tabId: tabId || 'none' }, { error: errorMessage });
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleNavigate();
  };

  // Load tabs on component mount
  useEffect(() => {
    refreshTabs();
  }, []);

  return (
    <div className="space-y-4 p-4">
      {/* Global active tab selector */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">Active Tab:</span>
          <select
            value={tabId || ''}
            onChange={(e) => setTabId(e.target.value)}
            className="text-sm rounded-md border border-input bg-background px-3 py-1"
          >
            {tabs.map((tab) => (
              <option key={tab.id} value={tab.id}>
                {tab.title || tab.url || `Tab ${tab.id}`}
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={refreshTabs}>
            Refresh Tabs
          </Button>
        </div>
      </div>

      <Tabs defaultValue="tabs" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="tabs">Tabs</TabsTrigger>
          <TabsTrigger value="devtools">DevTools</TabsTrigger>
          <TabsTrigger value="dom-tools">DOM Tools</TabsTrigger>
        </TabsList>

        <TabsContent value="tabs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Browser Navigation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex space-x-2">
                  <Input
                    type="text"
                    placeholder="Enter URL"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="flex-1"
                  />
                  <Button onClick={handleNavigate}>New Tab</Button>
                </div>
                {/* Active Tab selector moved to global header */}
              </div>
              <div className="flex space-x-2">
                <Button variant="outline" onClick={handleGoBack}>
                  ← Back
                </Button>
                <Button variant="outline" onClick={handleGoForward}>
                  Forward →
                </Button>
                <Button variant="outline" onClick={handleRefresh}>
                  ↻ Refresh
                </Button>
                <Button variant="outline" onClick={handleGetCurrentUrl}>
                  Get Current URL
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="devtools" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Developer Tools</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Button onClick={openDevTools}>Open DevTools</Button>
                <Button onClick={inspectElement} variant="outline" className="ml-2">
                  Inspect Element
                </Button>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Execute Script</label>
                <div className="flex space-x-2">
                  <Input
                    value={script}
                    onChange={(e) => setScript(e.target.value)}
                    className="flex-1 font-mono text-sm"
                  />
                  <Button onClick={handleExecuteScript}>Run</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dom-tools" className="space-y-4">
          <DomSemanticTools tabId={tabId} />
        </TabsContent>
      </Tabs>

      <div className="mt-4">
        <h3 className="text-sm font-medium mb-2">API Call Log</h3>
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="h-64">
              <div className="p-4">
                {apiCalls.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No API calls have been made yet.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {apiCalls.map((call) => (
                      <div key={call.id} className="border rounded-md p-3 text-sm">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-mono font-semibold">{call.method}</div>
                            <div className="text-muted-foreground text-xs">
                              {call.timestamp.toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                        <div className="mt-2">
                          <div className="font-medium">Parameters:</div>
                          <pre className="bg-muted p-2 rounded text-xs overflow-x-auto mt-1">
                            {JSON.stringify(call.params, null, 2)}
                          </pre>
                        </div>
                        {call.result && (
                          <div className="mt-2">
                            <div className="font-medium">Result:</div>
                            <pre className="bg-muted p-2 rounded text-xs overflow-x-auto mt-1">
                              {typeof call.result === 'string'
                                ? call.result
                                : JSON.stringify(call.result, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ToolPlayground;
