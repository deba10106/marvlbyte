import { DOMUtils, SemanticUtils } from '../../main/dom-utils';

declare global {
  interface Window {
    electron: {
      dom: {
        extractElement(selector: string, attributes?: string[]): Promise<DOMUtils.ToolResponse>;
        extractTable(selector: string, options?: DOMUtils.ExtractTableOptions): Promise<DOMUtils.ToolResponse>;
        extractImages(selector?: string, options?: DOMUtils.ExtractImagesOptions): Promise<DOMUtils.ToolResponse>;
        extractLinks(selector?: string, options?: DOMUtils.ExtractLinksOptions): Promise<DOMUtils.ToolResponse>;
        extractMeta(options?: DOMUtils.ExtractMetaOptions): Promise<DOMUtils.ToolResponse>;
      };
      semantic: {
        extract(content: string, options?: any): Promise<SemanticUtils.ToolResponse>;
        summarize(options?: any): Promise<SemanticUtils.ToolResponse>;
        recognizeEntities(options?: any): Promise<SemanticUtils.ToolResponse>;
        classify(options: any): Promise<SemanticUtils.ToolResponse>;
        extractSemanticTable(options: any): Promise<SemanticUtils.ToolResponse>;
      };
    };
  }
}
