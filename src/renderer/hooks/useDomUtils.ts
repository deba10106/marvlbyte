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
  extract: (content: string, options?: any) => Promise<any>;
  summarize: (options?: any) => Promise<any>;
  recognizeEntities: (options?: any) => Promise<any>;
  classify: (options: any) => Promise<any>;
  extractSemanticTable: (options: any) => Promise<any>;
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
    extract: (content: string, options?: any) =>
      callWithErrorHandling(() => 
        window.electron.semantic.extract(content, options)
      ),
    
    summarize: (options?: any) =>
      callWithErrorHandling(() => 
        window.electron.semantic.summarize(options)
      ),
    
    recognizeEntities: (options?: any) =>
      callWithErrorHandling(() => 
        window.electron.semantic.recognizeEntities(options)
      ),
    
    classify: (options: any) =>
      callWithErrorHandling(() => 
        window.electron.semantic.classify(options)
      ),
    
    extractSemanticTable: (options: any) =>
      callWithErrorHandling(() => 
        window.electron.semantic.extractSemanticTable(options)
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
