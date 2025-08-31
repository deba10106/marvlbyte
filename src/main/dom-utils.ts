import { BrowserView } from 'electron';
import { 
  ExtractElementOptions, 
  ExtractTableOptions, 
  ExtractImagesOptions, 
  ExtractLinksOptions, 
  ExtractMetaOptions,
  ToolResponse
} from '../shared/tools';

export class DOMUtils {
  static async extractElement(
    view: BrowserView | null | undefined,
    selector: string,
    options: ExtractElementOptions = {}
  ): Promise<ToolResponse> {
    if (!view) {
      return this.createErrorResponse('No active tab found');
    }

    try {
      const result = await view.webContents.executeJavaScript(`
        (() => {
          const elements = Array.from(document.querySelectorAll('${selector.replace(/'/g, "\\'")}'));
          return elements.map(el => {
            const result: any = {};
            
            if (${options.includeText !== false}) {
              result.text = el.textContent?.trim() || '';
            }
            
            if (${options.includeHtml !== false}) {
              result.html = el.innerHTML;
            }
            
            if (${options.attributes?.length ? 'true' : 'false'}) {
              result.attributes = {};
              ${options.attributes?.map(attr => 
                `result.attributes['${attr}'] = el.getAttribute('${attr}');`
              ).join('\n')}
            }
            
            return result;
          });
        })()
      `);

      return this.createSuccessResponse(result);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return this.createErrorResponse(`Failed to extract element: ${errorMessage}`);
    }
  }

  static async extractTable(
    view: BrowserView | null | undefined,
    selector: string,
    options: ExtractTableOptions = {}
  ): Promise<ToolResponse> {
    if (!view) {
      return this.createErrorResponse('No active tab found');
    }

    try {
      const result = await view.webContents.executeJavaScript(`
        (() => {
          const table = document.querySelector('${selector.replace(/'/g, "\\'")}');
          if (!table) return [];
          
          const rows = Array.from(table.querySelectorAll('tr'));
          const data = [];
          
          const processCell = (cell) => {
            return {
              text: cell.textContent?.trim() || '',
              rowSpan: cell.rowSpan || 1,
              colSpan: cell.colSpan || 1
            };
          };
          
          for (let i = 0; i < rows.length; i++) {
            const cells = Array.from(rows[i].querySelectorAll('th, td'));
            if (cells.length === 0) continue;
            
            const rowData = cells.map(processCell);
            data.push(rowData);
          }
          
          return data;
        })()
      `);

      return this.createSuccessResponse(result);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return this.createErrorResponse(`Failed to extract table: ${errorMessage}`);
    }
  }

  static async extractImages(
    view: BrowserView | null | undefined,
    selector: string = 'img',
    options: ExtractImagesOptions = {}
  ): Promise<ToolResponse> {
    if (!view) {
      return this.createErrorResponse('No active tab found');
    }

    try {
      const result = await view.webContents.executeJavaScript(`
        (() => {
          const images = Array.from(document.querySelectorAll('${selector.replace(/'/g, "\\'")}'));
          return images.map(img => {
            const result = {
              src: img.src,
              alt: img.alt || '',
              width: img.naturalWidth,
              height: img.naturalHeight
            };
            
            if (${options.includeSrcSet}) {
              result.srcSet = img.srcset || '';
            }
            
            return result;
          });
        })()
      `);

      return this.createSuccessResponse(result);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return this.createErrorResponse(`Failed to extract images: ${errorMessage}`);
    }
  }

  static async extractLinks(
    view: BrowserView | null | undefined,
    selector: string = 'a',
    options: ExtractLinksOptions = {}
  ): Promise<ToolResponse> {
    if (!view) {
      return this.createErrorResponse('No active tab found');
    }

    try {
      const result = await view.webContents.executeJavaScript(`
        (() => {
          const links = Array.from(document.querySelectorAll('${selector.replace(/'/g, "\\'")}'));
          return links
            .filter(link => {
              const href = link.href;
              return href && 
                (${options.filterDomain ? `new URL(href).hostname.includes('${options.filterDomain}')` : 'true'}) &&
                (${options.filterPattern ? `new RegExp('${options.filterPattern}').test(href)` : 'true'});
            })
            .map(link => ({
              href: link.href,
              text: ${options.includeText ? 'link.textContent?.trim() || ""' : 'undefined'},
              title: ${options.includeTitle ? 'link.title || ""' : 'undefined'}
            }));
        })()
      `);

      return this.createSuccessResponse(result);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return this.createErrorResponse(`Failed to extract links: ${errorMessage}`);
    }
  }

  static async extractMeta(
    view: BrowserView | null | undefined,
    options: ExtractMetaOptions = {}
  ): Promise<ToolResponse> {
    if (!view) {
      return this.createErrorResponse('No active tab found');
    }

    try {
      const result = await view.webContents.executeJavaScript(`
        (() => {
          const result = {
            title: document.title,
            meta: {},
            openGraph: {},
            twitter: {}
          };
          
          // Standard meta tags
          const metaTags = document.querySelectorAll('meta');
          metaTags.forEach(tag => {
            const name = tag.getAttribute('name') || tag.getAttribute('property') || '';
            const content = tag.getAttribute('content') || '';
            
            if (name.startsWith('og:') && ${options.includeOpenGraph !== false}) {
              result.openGraph[name.replace('og:', '')] = content;
            } else if (name.startsWith('twitter:') && ${options.includeTwitterCards !== false}) {
              result.twitter[name.replace('twitter:', '')] = content;
            } else if (${options.includeStandard !== false} && name) {
              result.meta[name] = result.meta[name] || [];
              result.meta[name].push(content);
            }
          });
          
          return result;
        })()
      `);

      return this.createSuccessResponse(result);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return this.createErrorResponse(`Failed to extract meta: ${errorMessage}`);
    }
  }

  private static createSuccessResponse(data: any): ToolResponse {
    return {
      success: true,
      data,
      timestamp: Date.now()
    };
  }

  private static createErrorResponse(message: string): ToolResponse {
    return {
      success: false,
      error: message,
      timestamp: Date.now()
    };
  }
}
