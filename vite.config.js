import { defineConfig } from 'vite';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
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

// Security check: every inline <script> must be allowed by its hash in the
// Content-Security-Policy in vercel.json, or the browser would block it.
// If you change an inline script, the build stops and prints the new hash to add.
function cspHashCheck() {
  return {
    name: 'cb-csp-hash-check',
    apply: 'build',
    closeBundle() {
      const csp = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'))
        .headers.flatMap((h) => h.headers).find((h) => h.key === 'Content-Security-Policy')?.value || '';
      const missing = new Set();
      const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((d) => {
        const f = path.join(dir, d.name);
        if (d.isDirectory()) return walk(f);
        if (!f.endsWith('.html')) return;
        const html = fs.readFileSync(f, 'utf8');
        for (const m of html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)) {
          if (/ld\+json/.test(m[1])) continue;
          const h = `'sha256-${crypto.createHash('sha256').update(m[2]).digest('base64')}'`;
          if (!csp.includes(h)) missing.add(h);
        }
      });
      walk(path.join(root, 'dist'));
      if (missing.size) throw new Error(`Inline script not allowed by the CSP in vercel.json. Add to script-src: ${[...missing].join(' ')}`);
    },
  };
}

export default defineConfig({
  plugins: [htmlIncludes(), preloadFonts(), cspHashCheck()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: Object.fromEntries(Object.entries(pages).map(([k, v]) => [k, path.join(root, v)])),
    },
  },
});
