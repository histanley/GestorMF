// Ponto de entrada principal da aplicação GestorMF (MegaFilmes & Mega Print)
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './index.css';
import './App.css';
import App from './App.jsx';

// Inicializa a renderização raiz do React no elemento 'root'
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Registro do Service Worker para suporte a PWA e Notificações (P1-10)
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('[GestorMF PWA] Service Worker registrado com escopo:', reg.scope);
      })
      .catch((err) => {
        console.warn('[GestorMF PWA] Falha ao registrar Service Worker:', err);
      });
  });
}
