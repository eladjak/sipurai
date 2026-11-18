// Restrict redirects to local, absolute paths. Reject protocol-relative and backslash forms.
export function safeAuthReturn(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || /[\u0000-\u001f]/.test(value)) return '/';
  try {
    const url = new URL(value, 'https://sipurai.invalid');
    const decodedPath = decodeURIComponent(url.pathname);
    if (url.origin !== 'https://sipurai.invalid' || decodedPath.startsWith('//') || decodedPath.includes('\\') || /[\u0000-\u001f]/.test(decodedPath)) return '/';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return '/'; }
}
export const authLink = (path, target) => `${path}?redirect_url=${encodeURIComponent(safeAuthReturn(target))}`;
