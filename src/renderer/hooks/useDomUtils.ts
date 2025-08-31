import { useState } from 'react';

type DomUtils = {
  extractElement: (selector: string, attributes?: string[], tabId?: string) => Promise<any>;
  extractTable: (selector: string, options?: any, tabId?: string) => Promise<any>;
  extractImages: (selector?: string, options?: any, tabId?: string) => Promise<any>;
  extractLinks: (selector?: string, options?: any, tabId?: string) => Promise<any>;
  extractMeta: (options?: any, tabId?: string) => Promise<any>;
  getActiveTabId: () => Promise<string | null>;
  getTabs: () => Promise<Array<{ id: string; title: string; url: string }>>;
};

type SemanticUtils = {
  extract: (options?: any, tabId?: string) => Promise<any>;
  summarize: (options?: any, tabId?: string) => Promise<any>;
  recognizeEntities: (options?: any, tabId?: string) => Promise<any>;
  classify: (options: any, tabId?: string) => Promise<any>;
  extractSemanticTable: (options: any, tabId?: string) => Promise<any>;
};

declare global {
  interface Window {
    electron: {
      dom: DomUtils;
      semantic: SemanticUtils;
    };
  }
}

export function useDomUtils() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<any>(null);

  const callWithErrorHandling = async (fn: () => Promise<any>) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fn();
      setResult(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const dom = {
    getActiveTabId: async () => {
      try {
        const tabs = await window.comet.tabs.list();
        const activeTab = tabs.find(tab => tab.active);
        return activeTab?.id || null;
      } catch (error) {
        console.error('Failed to get active tab:', error);
        return null;
      }
    },
    getTabs: async () => {
      try {
        return await window.comet.tabs.list();
      } catch (error) {
        console.error('Failed to get tabs:', error);
        return [];
      }
    },
    extractElement: (selector: string, attributes: string[] = [], tabId?: string) =>
      callWithErrorHandling(() => 
        window.electron.dom.extractElement(selector, attributes, tabId)
      ),
    
    extractTable: (selector: string, options: any = {}, tabId?: string) =>
      callWithErrorHandling(() => 
        window.electron.dom.extractTable(selector, options, tabId)
      ),
    
    extractImages: (selector?: string, options: any = {}, tabId?: string) =>
      callWithErrorHandling(() => 
        window.electron.dom.extractImages(selector, options, tabId)
      ),
    
    extractLinks: (selector?: string, options: any = {}, tabId?: string) =>
      callWithErrorHandling(() => 
        window.electron.dom.extractLinks(selector, options, tabId)
      ),
    
    extractMeta: (options: any = {}, tabId?: string) =>
      callWithErrorHandling(() => 
        window.electron.dom.extractMeta(options, tabId)
      ),
  };

  const semantic = {
    extract: (options?: any, tabId?: string) =>
      callWithErrorHandling(() => 
        // Call overload (options, tabId) to omit content when a tab is targeted
        window.electron.semantic.extract(options, tabId)
      ),
    
    summarize: (options?: any, tabId?: string) =>
      callWithErrorHandling(() => 
        window.electron.semantic.summarize(options, tabId)
      ),
    
    recognizeEntities: (options?: any, tabId?: string) =>
      callWithErrorHandling(() => 
        window.electron.semantic.recognizeEntities(options, tabId)
      ),
    
    classify: (options: any, tabId?: string) =>
      callWithErrorHandling(() => 
        window.electron.semantic.classify(options, tabId)
      ),
    
    extractSemanticTable: (options: any, tabId?: string) =>
      callWithErrorHandling(() => 
        window.electron.semantic.extractSemanticTable(options, tabId)
      ),
  };

  return {
    dom,
    semantic,
    isLoading,
    error,
    result,
  };
}
