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
        // Força busca imediata de atualizações no servidor
        try {
          reg.update();
        } catch (e) {}

        // Atualização automática assim que novo Service Worker estiver pronto
        reg.onupdatefound = () => {
          const installingWorker = reg.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[GestorMF PWA] Nova versão detectada. Atualizando página...');
                window.location.reload();
              }
            };
          }
        };
      })
      .catch((err) => {
        console.warn('[GestorMF PWA] Falha ao registrar Service Worker:', err);
      });
  });
}
