import { defineConfig } from 'vite';
import path from 'node:path';
import { root, partialsDir, pages, processHtml } from './scripts/html-includes.mjs';

function htmlIncludes() {
  return {
    name: 'cb-html-includes',
    configureServer(server) {
      server.watcher.add(partialsDir);
      server.watcher.on('change', (file) => {
        if (file.startsWith(partialsDir)) server.ws.send({ type: 'full-reload' });
      });
    },
    transformIndexHtml: { order: 'pre', handler: processHtml },
  };
}

export default defineConfig({
  plugins: [htmlIncludes()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: Object.fromEntries(Object.entries(pages).map(([k, v]) => [k, path.join(root, v)])),
    },
  },
});
