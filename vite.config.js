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

// Preload the two main fonts so text shows in its final font sooner.
function preloadFonts() {
  return {
    name: 'cb-preload-fonts',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.bundle || ctx.filename.includes('/admin/')) return html;
        const files = Object.keys(ctx.bundle).filter((f) => /(inter|inter-tight)-latin-wght-normal-[\w-]+\.woff2$/.test(f));
        const tags = files.map((f) => `<link rel="preload" href="/${f}" as="font" type="font/woff2" crossorigin>`).join('\n    ');
        return html.replace('<link rel="preconnect"', `${tags}\n    <link rel="preconnect"`);
      },
    },
  };
}

export default defineConfig({
  plugins: [htmlIncludes(), preloadFonts()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: Object.fromEntries(Object.entries(pages).map(([k, v]) => [k, path.join(root, v)])),
    },
  },
});
