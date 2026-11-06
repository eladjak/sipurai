import { getPublishedPosts } from './_lib/blog-content.js';
export default async function handler(req,res) {
  try {
    const posts=(await getPublishedPosts()).map(p=>({...p,mainImage:p.mainImageUrl || null}));
    res.setHeader('Cache-Control','public, s-maxage=60, stale-while-revalidate=300');
    if (typeof req.query.slug === 'string') return res.status(200).json(posts.find(p=>p.slug.current===req.query.slug) || null);
    return res.status(200).json(posts);
  } catch { return res.status(503).json({error:'Content temporarily unavailable'}); }
}
