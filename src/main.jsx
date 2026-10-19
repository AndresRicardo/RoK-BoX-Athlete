import React from 'react';
import ReactDOM from 'react-dom/client';
import AppRoot from './AppRoot';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Registro automático de service worker PWA
registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppRoot />
  </React.StrictMode>
);
