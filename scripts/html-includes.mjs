import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOGO } from '../src/logo-data.js';
import { SITE } from '../src/site.config.js';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const partialsDir = path.join(root, 'src', 'partials');

export const pages = {
  main: 'index.html',
  websiteDevelopment: 'services/website-development/index.html',
  mobileApps: 'services/mobile-app-development/index.html',
  businessSoftware: 'services/business-software/index.html',
  customApplications: 'services/custom-applications/index.html',
  servicesOverview: 'services/index.html',
  process: 'process/index.html',
  experience: 'experience/index.html',
  clients: 'clients/index.html',
  contact: 'contact/index.html',
  privacy: 'privacy-policy/index.html',
  notFound: '404.html',
};

const vars = {
  logoGreen: LOGO.greenPath,
  logoDark: LOGO.darkPath,
  logoW: LOGO.width,
  logoH: LOGO.height,
  logoVW: LOGO.width + 12,
  logoVH: LOGO.height + 12,
  year: new Date().getFullYear(),
  siteUrl: SITE.url,
  email: SITE.email,
  tagline: SITE.tagline,
  whatsapp: SITE.whatsapp,
};

export function processHtml(html) {
  let out = html;
  for (let i = 0; i < 4; i++) {
    out = out.replace(/<!--#include ([\w-]+)-->/g, (_, name) =>
      fs.readFileSync(path.join(partialsDir, `${name}.html`), 'utf8'));
  }
  return out.replace(/\{\{(\w+)\}\}/g, (m, key) => (key in vars ? String(vars[key]) : m));
}
