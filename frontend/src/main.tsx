import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { QueryProvider } from './state/queryClient.js';
import { AppRouter } from './app/router.js';
import { Toaster } from './components/ui/sonner.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryProvider>
        <AppRouter />
        <Toaster />
      </QueryProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
