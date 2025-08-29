import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/globals.css';
import { App } from './App';
import { ThemeProvider } from './components/theme-provider';

const rootEl = document.getElementById('root');
if (rootEl) {
  const root = createRoot(rootEl);
  root.render(
    <ThemeProvider defaultTheme="dark">
      <App />
    </ThemeProvider>
  );
}
