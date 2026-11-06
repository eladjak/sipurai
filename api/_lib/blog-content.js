import DEMO_POSTS from '../../src/data/blogPosts.js';
export const esc = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const query = `*[_type == "post" && siteId == "eyai-kids" && status == "published" && !(_id in path("drafts.**")) && defined(slug.current) && defined(publishedAt)] | order(publishedAt desc) {_id,slug,title,excerpt,publishedAt,language,body,"mainImageUrl":mainImage.asset->url,author->{name}}`;
export async function getPublishedPosts() {
  const url = new URL('https://b0hm1i34.api.sanity.io/v2024-01-01/data/query/production');
  url.searchParams.set('query',query); url.searchParams.set('perspective','published');
  const response = await fetch(url); if (!response.ok) throw Error(`Sanity HTTP ${response.status}`);
  const data = await response.json(); if (!Array.isArray(data.result)) throw Error('Invalid Sanity result');
  const chosen = new Map();
  for (const post of data.result) {
    const slug=post.slug?.current; if (!slug) continue;
    const previous=chosen.get(slug);
    if (!previous || (previous.language !== 'he' && post.language === 'he')) chosen.set(slug,post);
  }
  return [...chosen.values()].sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
}
export async function findPost(slug) {
  const local = DEMO_POSTS.find(p => p.slug === slug);
  try { const posts = await getPublishedPosts(); return posts.find(p => p.slug.current === slug) ?? local ?? null; }
  catch (error) { if (local) return local; throw error; }
}
export function renderBody(blocks) {
  return (blocks ?? []).filter(b=>b._type === 'block').map(b=>{
    const text=(b.children ?? []).map(s=>{
      let value=esc(s.text);
      for (const mark of s.marks ?? []) {
        if(mark==='strong') value=`<strong>${value}</strong>`;
        else if(mark==='em') value=`<em>${value}</em>`;
        else { const href=b.markDefs?.find(d=>d._key===mark)?.href; if(typeof href==='string' && /^(https?:\/\/|\/(?!\/))/i.test(href)) value=`<a href="${esc(href)}">${value}</a>`; }
      }
      return value;
    }).join('');
    const tag=['h2','h3','h4','blockquote'].includes(b.style) ? b.style : 'p';
    return `<${tag}>${text}</${tag}>`;
  }).join('');
}
export function renderPost(post, base) {
  const slug=typeof post.slug==='string'?post.slug:post.slug.current;
  const canonical=`${base}/blog/${encodeURIComponent(slug)}`;
  const schema={'@context':'https://schema.org','@type':'BlogPosting',headline:post.title,description:post.excerpt,datePublished:post.publishedAt,inLanguage:post.language || 'he',mainEntityOfPage:canonical};
  return `<!doctype html><html lang="${esc(post.language || 'he')}" dir="${post.language === 'en' ? 'ltr' : 'rtl'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(post.title)} | סיפוראי</title><meta name="description" content="${esc(post.excerpt)}"><link rel="canonical" href="${esc(canonical)}"><script type="application/ld+json">${JSON.stringify(schema).replaceAll('<','\\u003c')}</script><style>body{margin:0;background:#faf8ff;color:#242136;font-family:system-ui,sans-serif;line-height:1.9}main{max-width:760px;margin:auto;padding:32px 24px}nav a{display:inline-block;padding:12px 0;color:#6344ae}article{background:white;border:1px solid #ece6f8;border-radius:24px;padding:clamp(24px,6vw,48px)}img{width:100%;height:auto;border-radius:16px}h1{font-size:clamp(2rem,7vw,3rem);line-height:1.25}h2{margin-top:2em}p{font-size:1.1rem}</style></head><body><main><nav><a href="/blog">← לכל המאמרים</a></nav><article><h1>${esc(post.title)}</h1><p>${esc(post.excerpt)}</p>${post.mainImageUrl ? `<img src="${esc(post.mainImageUrl)}" alt="">` : ''}${renderBody(post.body)}</article></main></body></html>`;
}
