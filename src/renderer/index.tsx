import React, { Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/globals.css';
import { App } from './App';
import { ThemeProvider } from './components/theme-provider';
import { ToastProvider } from './components/ui/use-toast';

// Log React version info
const ReactInfo = {
  version: React.version,
  strictMode: false, // Will be updated in render function
};

console.log('React info:', ReactInfo);

// Error boundary component to catch React errors
class ErrorBoundary extends Component<{ children: ReactNode }> {
  state = { hasError: false, error: null as Error | null, errorInfo: null as ErrorInfo | null };
  
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      hasError: true,
      error,
      errorInfo
    });
    
    // Log error details to console
    console.error('React Error Boundary caught an error:', error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 text-red-900 border border-red-200 rounded">
          <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
          <details className="whitespace-pre-wrap">
            <summary className="cursor-pointer font-medium">View error details</summary>
            <p className="mt-2 font-mono text-sm">{this.state.error?.toString()}</p>
            <p className="mt-2 font-mono text-xs overflow-auto max-h-64">
              {this.state.errorInfo?.componentStack}
            </p>
          </details>
        </div>
      );
    }
    
    return this.props.children;
  }
}

// Add global error handlers to catch unhandled errors
window.addEventListener('error', (event) => {
  console.error('Global error caught:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

const rootEl = document.getElementById('root');
if (rootEl) {
  const root = createRoot(rootEl);
  
  // Log if we're potentially in React StrictMode
  console.log('React version:', React.version);
  
  // Add debugging hooks to track component mounts and renders
  const originalUseEffect = React.useEffect;
  const originalUseState = React.useState;
  
  // Track render counts for components
  const renderCounts: Record<string, number> = {};
  
  // Monitor Tool Playground renders
  const monitorComponent = (componentName: string) => {
    renderCounts[componentName] = (renderCounts[componentName] || 0) + 1;
    console.log(`[${componentName}] Render count:`, renderCounts[componentName]);
  };
  
  // Add this to global window for debugging
  (window as any).__monitorComponent = monitorComponent;

  root.render(
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <ToastProvider>
          <App />
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
