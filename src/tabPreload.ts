import { contextBridge, ipcRenderer } from 'electron';

function getReadableText(): string {
  try {
    // Prefer visible text
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (node: Node) => {
        if (!node.parentElement) return NodeFilter.FILTER_REJECT;
        const style = window.getComputedStyle(node.parentElement);
        if (style && (style.display === 'none' || style.visibility === 'hidden')) return NodeFilter.FILTER_REJECT;
        const text = node.textContent?.trim();
        return text ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    } as any);
    let acc = '';
    let current: Node | null = null;
    while ((current = walker.nextNode())) {
      const t = (current.textContent || '').replace(/\s+/g, ' ').trim();
      if (t) acc += t + '\n';
      if (acc.length > 120_000) break;
    }
    if (acc) return acc;
    // Fallback
    return document.body?.innerText?.slice(0, 120_000) || '';
  } catch {
    return '';
  }
}

// Expose function to page world
contextBridge.exposeInMainWorld('__comet_getReadableText', getReadableText);

// Also attempt direct assignment as a fallback
try {
  (window as any).__comet_getReadableText = getReadableText;
} catch {}

function navigateSearch(query: string): void {
  try {
    if (typeof query !== 'string') return;
    const q = query.trim();
    if (!q) return;
    ipcRenderer.invoke('omnibox:navigate', q);
  } catch {}
}

// Expose navigation helper so in-app search page can trigger new searches
contextBridge.exposeInMainWorld('__comet_navigateSearch', navigateSearch);
try {
  (window as any).__comet_navigateSearch = navigateSearch;
} catch {}
