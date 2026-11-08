import { findPost, renderPost } from './_lib/blog-content.js';
export default async function handler(req,res) {
  const slug=req.query.slug;
  if(typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return res.status(404).send('Not found');
  try {
    const post=await findPost(slug);
    if(!post) return res.status(404).send('Not found');
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.setHeader('Cache-Control','public, s-maxage=60, stale-while-revalidate=300');
    return res.status(200).send(renderPost(post,'https://www.sipurai.ai'));
  } catch { return res.status(503).send('Content temporarily unavailable'); }
}
