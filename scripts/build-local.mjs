// Builds a self-contained copy of the site that works by double-clicking local-preview/index.html
// (no server, no Node needed to view it). For hosting, use `npm run build` instead.
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'vite';
import { root, pages, processHtml } from './html-includes.mjs';

const out = path.join(root, 'local-preview');
fs.rmSync(out, { recursive: true, force: true });

await build({
  configFile: false,
  root,
  logLevel: 'warn',
  publicDir: false,
  build: {
    outDir: path.join(out, 'assets'),
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      input: path.join(root, 'src/main.js'),
      output: { format: 'iife', entryFileNames: 'app.js', assetFileNames: (a) => (a.names?.[0]?.endsWith('.css') ? 'app.css' : '[name][extname]') },
    },
  },
});

fs.cpSync(path.join(root, 'public'), out, { recursive: true });

const rel = (prefix, url) => {
  const [p, hash = ''] = url.split('#');
  let target = p.replace(/^\//, '');
  if (target === '' || target.endsWith('/')) target += 'index.html';
  return prefix + target + (hash ? '#' + hash : '');
};

for (const file of Object.values(pages)) {
  const depth = file.split('/').length - 1;
  const prefix = '../'.repeat(depth);
  let html = processHtml(fs.readFileSync(path.join(root, file), 'utf8'));
  html = html.replace(/\b(href|src)="(\/[^"]*)"/g, (m, attr, url) => (url.startsWith('//') ? m : `${attr}="${rel(prefix, url)}"`));
  html = html.replace(/<script type="module" src="[^"]*main\.js"><\/script>/, `<link rel="stylesheet" href="${prefix}assets/app.css"><script src="${prefix}assets/app.js" defer></script>`);
  const dest = path.join(out, file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, html);
}

const missing = [];
for (const file of Object.values(pages)) {
  const html = fs.readFileSync(path.join(out, file), 'utf8');
  for (const [, url] of html.matchAll(/\b(?:href|src)="(?!https?:|mailto:|#|data:)([^"#]+)/g)) {
    if (!fs.existsSync(path.join(out, path.dirname(file), url))) missing.push(`${file} -> ${url}`);
  }
}
console.log(missing.length ? 'Missing targets:\n' + missing.join('\n') : 'local-preview built: all links resolve.');
