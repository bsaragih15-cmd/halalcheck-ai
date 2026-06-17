import { next } from '@vercel/edge';

// Gate the whole site behind a single shared username + password (HTTP Basic
// Auth). Credentials are read from Vercel environment variables so nothing
// secret is committed — this repository is public.
//
// Protection is ACTIVE only once SITE_PASS is set. If SITE_PASS is unset the
// site is served normally, so deploying this file can never lock you out
// before you've configured the credentials. Configure in Vercel:
//   SITE_USER  (optional, defaults to "admin")
//   SITE_PASS  (required to turn the gate on)
// then redeploy, and turn off "Vercel Authentication" so guests can reach it.
export const config = {
  // Run on every route (static pages, assets and the /api function) except
  // Vercel's internal endpoints.
  matcher: '/((?!_vercel).*)',
};

export default function middleware(request) {
  const USER = process.env.SITE_USER || 'admin';
  const PASS = process.env.SITE_PASS;

  // No password configured → gate disabled, serve the site unchanged.
  if (!PASS) return next();

  const header = request.headers.get('authorization') || '';
  const [scheme, encoded] = header.split(' ');
  if (scheme === 'Basic' && encoded) {
    let decoded = '';
    try { decoded = atob(encoded); } catch { decoded = ''; }
    const i = decoded.indexOf(':');
    const user = decoded.slice(0, i);
    const pass = decoded.slice(i + 1);
    if (user === USER && pass === PASS) return next();
  }

  return new Response('Authentication required.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="OreSight AI", charset="UTF-8"',
      'content-type': 'text/plain; charset=utf-8',
    },
  });
}
