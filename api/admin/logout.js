import { json, clearCookie, sameOrigin } from '../_lib/http.js';

export function POST(request) {
  if (!sameOrigin(request)) return json({ ok: false, error: 'forbidden' }, 403);
  return json({ ok: true }, 200, { 'Set-Cookie': clearCookie() });
}
