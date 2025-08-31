// Types for DOM Parsing APIs
export interface ExtractElementOptions {
  attributes?: string[];
  includeHtml?: boolean;
  includeText?: boolean;
}

export interface ExtractTableOptions {
  hasHeaders?: boolean;
  asJson?: boolean;
  includeHeaders?: boolean;
}

export interface ExtractImagesOptions {
  includeDimensions?: boolean;
  includeAlt?: boolean;
  includeSrcSet?: boolean;
}

export interface ExtractLinksOptions {
  filterDomain?: string;
  filterPattern?: string;
  includeText?: boolean;
  includeTitle?: boolean;
}

export interface ExtractMetaOptions {
  includeOpenGraph?: boolean;
  includeTwitterCards?: boolean;
  includeStandard?: boolean;
}

// Types for Semantic Extraction APIs
export interface SemanticExtractOptions {
  schema: Record<string, any>;
  selector?: string;
  content?: string;
}

export interface SummarizeOptions {
  selector?: string;
  content?: string;
  maxLength?: number;
  format?: 'text' | 'bullets' | 'paragraph';
}

export interface EntityRecognitionOptions {
  types?: string[];
  selector?: string;
  content?: string;
  language?: string;
}

export interface ClassifyOptions {
  categories: string[];
  selector?: string;
  content?: string;
  confidenceThreshold?: number;
}

export interface SemanticTableExtractOptions {
  selector: string;
  schema?: Record<string, any>;
  includeHeaders?: boolean;
}

// Response types
export interface ToolResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  tabId?: string;
  timestamp: number;
}

// Tab-related types
export interface TabTarget {
  tabId?: string;
}

// DOM Parsing API function types
export type ExtractElementFn = (
  tabId: string | undefined,
  selector: string,
  options?: ExtractElementOptions
) => Promise<ToolResponse>;

export type ExtractTableFn = (
  tabId: string | undefined,
  selector: string,
  options?: ExtractTableOptions
) => Promise<ToolResponse>;

export type ExtractImagesFn = (
  tabId: string | undefined,
  selector?: string,
  options?: ExtractImagesOptions
) => Promise<ToolResponse>;

export type ExtractLinksFn = (
  tabId: string | undefined,
  selector?: string,
  options?: ExtractLinksOptions
) => Promise<ToolResponse>;

export type ExtractMetaFn = (
  tabId: string | undefined,
  options?: ExtractMetaOptions
) => Promise<ToolResponse>;

// Semantic Extraction API function types
export type SemanticExtractFn = (
  tabId: string | undefined,
  options: SemanticExtractOptions
) => Promise<ToolResponse>;

export type SummarizeFn = (
  tabId: string | undefined,
  options?: SummarizeOptions
) => Promise<ToolResponse>;

export type EntityRecognitionFn = (
  tabId: string | undefined,
  options: EntityRecognitionOptions
) => Promise<ToolResponse>;

export type ClassifyFn = (
  tabId: string | undefined,
  options: ClassifyOptions
) => Promise<ToolResponse>;

export type SemanticTableExtractFn = (
  tabId: string | undefined,
  options: SemanticTableExtractOptions
) => Promise<ToolResponse>;
