import { DOMUtils, SemanticUtils } from '../../main/dom-utils';

declare global {
  interface Window {
    electron: {
      dom: {
        extractElement(selector: string, attributes?: string[], tabId?: string): Promise<DOMUtils.ToolResponse>;
        extractTable(selector: string, options?: DOMUtils.ExtractTableOptions, tabId?: string): Promise<DOMUtils.ToolResponse>;
        extractImages(selector?: string, options?: DOMUtils.ExtractImagesOptions, tabId?: string): Promise<DOMUtils.ToolResponse>;
        extractLinks(selector?: string, options?: DOMUtils.ExtractLinksOptions, tabId?: string): Promise<DOMUtils.ToolResponse>;
        extractMeta(options?: DOMUtils.ExtractMetaOptions, tabId?: string): Promise<DOMUtils.ToolResponse>;
      };
      semantic: {
        extract(options?: any, tabId?: string): Promise<SemanticUtils.ToolResponse>;
        extract(content: string, options?: any, tabId?: string): Promise<SemanticUtils.ToolResponse>;
        summarize(options?: any, tabId?: string): Promise<SemanticUtils.ToolResponse>;
        recognizeEntities(options?: any, tabId?: string): Promise<SemanticUtils.ToolResponse>;
        classify(options: any, tabId?: string): Promise<SemanticUtils.ToolResponse>;
        extractSemanticTable(options: any, tabId?: string): Promise<SemanticUtils.ToolResponse>;
      };
    };
  }
}
