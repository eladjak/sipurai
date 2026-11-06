import { readFile } from 'node:fs/promises';
import { getPublishedPosts, esc } from './_lib/blog-content.js';
export default async function handler(req,res) {
  try {
    const [posts,xml]=await Promise.all([getPublishedPosts(),readFile('public/sitemap.xml','utf8')]);
    const entries=posts.map(p=>`<url><loc>https://www.sipurai.ai/blog/${esc(p.slug.current)}</loc><lastmod>${esc(p.publishedAt.slice(0,10))}</lastmod></url>`).join('');
    res.setHeader('Content-Type','application/xml; charset=utf-8'); return res.status(200).send(xml.replace('</urlset>',`${entries}</urlset>`));
  } catch { return res.status(503).send('Content temporarily unavailable'); }
}
