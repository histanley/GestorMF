import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import pkg from './package.json' with { type: 'json' }

// Configuração principal do Vite para o sistema GestorMF
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version || '6.3.8'),
  },
  server: {
    host: true, // Libera o acesso para qualquer dispositivo na rede local (Wi-Fi)
    port: 5173,
  },
  css: {
    devSourcemap: true,
  },
})
