import { defineConfig, loadEnv, type Plugin, type PreviewServer, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import wikiHandler from './api/wikisource.js';
import readHandler from './api/read.js';
import catalogHandler from './api/catalog.js';

function localApi(mode: string): Plugin {
  function configure(server: ViteDevServer | PreviewServer) {
    const env = { ...loadEnv(mode, process.cwd(), ''), NODE_ENV: mode === 'production' ? 'production' : 'development' };
    server.middlewares.use((req, res, next) => {
      const path = req.url?.split('?')[0];
      if (path === '/api/wikisource') { void wikiHandler(req, res); return; }
      if (path === '/api/read') { void readHandler(req, res, env); return; }
      if (path === '/api/catalog') { void catalogHandler(req, res); return; }
      next();
    });
  }
  return { name: 'lacervo-local-api', configureServer: configure, configurePreviewServer: configure };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), localApi(mode)],
  build: { chunkSizeWarningLimit: 650 }
}));
