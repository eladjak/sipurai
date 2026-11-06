import { test, expect, afterEach } from 'bun:test';
import { getPublishedPosts, renderPost } from '../../api/_lib/blog-content.js';
import handler from '../../api/blog-read.js';
const original=globalThis.fetch;
afterEach(()=>{globalThis.fetch=original});
test('query is published-only and Hebrew wins duplicate slugs', async()=>{
 let query=''; globalThis.fetch=async url=>{query=new URL(url).searchParams.get('query');return {ok:true,json:async()=>({result:[{slug:{current:'test'},title:'English',language:'en',publishedAt:'2026-01-01'},{slug:{current:'test'},title:'עברית',language:'he',publishedAt:'2026-01-01'}]})}};
 const posts=await getPublishedPosts(); expect(posts).toHaveLength(1); expect(posts[0].title).toBe('עברית'); expect(query).toContain('status == "published"'); expect(query).toContain('drafts.**');
});
test('missing or draft slug returns 404 and output escapes hostile markup',async()=>{
 globalThis.fetch=async()=>({ok:true,json:async()=>({result:[]})});
 const res={code:0,status(n){this.code=n;return this},send(){return this},setHeader(){return this}};
 await handler({query:{slug:'private-draft'}},res); expect(res.code).toBe(404);
 const html=renderPost({slug:{current:'a'},title:'<script>x</script>',body:[]},'https://example.org'); expect(html).not.toContain('<script>x</script>'); expect(html).toContain('application/ld+json');
});
