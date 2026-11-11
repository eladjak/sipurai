// Fail closed for the production domain, including subdomains and a trailing dot.
export function targetFor(env = process.env) {
  const raw = env.SMOKE_BASE_URL || 'http://localhost:4173';
  let url;
  try { url = new URL(raw); } catch { throw new Error('Invalid smoke target URL'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Invalid smoke target URL');
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  const production = host === 'sipurai.ai' || host.endsWith('.sipurai.ai');
  if (production && env.SMOKE_ALLOW_PRODUCTION_READONLY !== '1') throw new Error('Production target refused; explicit read-only opt-in required');
  return { baseURL: url.origin, local: !env.SMOKE_BASE_URL, production, readOnly: production };
}
