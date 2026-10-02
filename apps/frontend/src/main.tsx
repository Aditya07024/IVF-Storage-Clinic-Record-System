import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Capture PWA install prompt globally as early as possible so it is never missed
window.addEventListener('beforeinstallprompt', (e: Event) => {
  e.preventDefault();
  (window as any).deferredInstallPrompt = e;
  window.dispatchEvent(new CustomEvent('pwa-prompt-available'));
});

// Register Service Worker for PWA eligibility
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.log('PWA ServiceWorker registration failed:', err);
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
