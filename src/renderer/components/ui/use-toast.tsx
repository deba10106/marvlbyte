import * as React from 'react';
import { ToastViewport } from './toast';

type ToastVariant = 'default' | 'destructive';

interface ToastProps {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
}

type ToastOptions = Omit<ToastProps, 'id'> & { duration?: number };

interface ToastContextValue {
  toast: (props: ToastOptions) => string;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

interface ToastProviderProps {
  children: React.ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = React.useState<ToastProps[]>([]);
  const timersRef = React.useRef<Record<string, NodeJS.Timeout>>({});

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
  }, []);

  const toast = React.useCallback((options: ToastOptions): string => {
    const { duration = 3000, ...rest } = options;
    const id = Math.random().toString(36).substr(2, 9);
    
    setToasts((prev) => [...prev, { ...rest, id }]);

    if (duration > 0) {
      if (timersRef.current[id]) {
        clearTimeout(timersRef.current[id]);
      }
      
      timersRef.current[id] = setTimeout(() => {
        dismiss(id);
      }, duration);
    }

    return id;
  }, [dismiss]);

  React.useEffect(() => {
    const timerRefs = timersRef.current;
    return () => {
      Object.values(timerRefs).forEach(clearTimeout);
    };
  }, []);

  const contextValue = React.useMemo(() => ({
    toast,
    dismiss,
  }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastViewport toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = React.useContext(ToastContext);
  if (context === null) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
