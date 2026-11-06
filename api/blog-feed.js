import { getPublishedPosts, esc } from './_lib/blog-content.js';
export default async function handler(req,res) {
  try {
    const posts=await getPublishedPosts(); const base='https://www.sipurai.ai';
    const entries=posts.map(p=>`<item><title>${esc(p.title)}</title><link>${base}/blog/${esc(p.slug.current)}</link><guid>${base}/blog/${esc(p.slug.current)}</guid><description>${esc(p.excerpt)}</description><pubDate>${new Date(p.publishedAt).toUTCString()}</pubDate></item>`).join('');
    res.setHeader('Content-Type','application/rss+xml; charset=utf-8'); return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>סיפוראי</title><link>${base}/blog</link><description>מאמרי סיפוראי</description>${entries}</channel></rss>`);
  } catch { return res.status(503).send('Content temporarily unavailable'); }
}
