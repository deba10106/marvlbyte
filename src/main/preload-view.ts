// Preload script for BrowserViews to suppress DevTools console errors
import { contextBridge } from 'electron';

// Override console.error to filter out specific DevTools errors
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  const errorString = args.join(' ');
  
  // Filter out known harmless errors
  if (
    errorString.includes("'Autofill.enable' wasn't found") ||
    errorString.includes("'Autofill.setAddresses' wasn't found") ||
    errorString.includes("Frame tree node for given frame not found") ||
    errorString.includes("Unsupported pixel format") ||
    errorString.includes("ERR_BLOCKED_BY_CLIENT")
  ) {
    // Silently ignore these errors
    return;
  }
  
  // Pass through all other errors
  originalConsoleError(...args);
};

// Expose any needed APIs to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Add any APIs needed for BrowserViews here
});
