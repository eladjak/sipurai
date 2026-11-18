import { describe, it, expect, vi } from 'vitest';
import { generateBookIncremental } from '@/lib/bookGeneration';
import { BOOK_STATUS, summarizeBook } from '@/lib/bookProgress';

// Real generation pipeline, with writes kept solely in this in-memory fixture.
it('persists an edited manuscript and settles partial when one illustration fails', async () => {
  const books = new Map(), pages = new Map(); let next = 0;
  const Book = { create: vi.fn(async row => { const value={id:`b${++next}`,...row}; books.set(value.id,value); return {...value}; }), get: vi.fn(async id => books.get(id)), update: vi.fn(async (id,patch) => { const value={...books.get(id),...patch}; books.set(id,value); return {...value}; }) };
  const Page = { create: vi.fn(async row => { const value={id:`p${++next}`,...row}; pages.set(value.id,value); return {...value}; }), update: vi.fn(async (id,patch) => { const value={...pages.get(id),...patch}; pages.set(id,value); return {...value}; }), filter: vi.fn(async ({book_id}) => [...pages.values()].filter(p => p.book_id === book_id)) };
  const events=[];
  const recipe = { pageCount:2, bookFields:{ title:'Family title', language:'english' }, outlinePrompt:'outline', outlineSchema:{type:'object'}, coverPrompt:'cover', manuscriptRequest:()=>({prompt:'edit'}), pageTextPrompt:()=> 'unexpected page call', pageTextSchema:()=>({type:'object'}), imagePrompt:(_page,i)=>`draw ${i}`, layoutFor:()=> 'full', sanitize:s=>String(s||'').trim(), readPageText:r=>r?.text_content||'' };
  const ai = { InvokeLLM:vi.fn(async ({prompt})=>{ if(prompt==='outline') return {title:'Family title',outline:[{description:'start'},{description:'end'}]}; if(prompt==='edit') return {pages:[0,1].map(i=>({page_number:i,text_content:`Edited page ${i}`,image_prompt:`scene ${i}`}))}; throw Error('Unexpected per-page text call'); }), GenerateImage:vi.fn(async ({prompt})=>{ if(prompt==='cover') return {url:'local-cover'}; if(prompt==='draw 1') throw Error('synthetic image failure'); return {url:'local-image'}; }) };
  const result=await generateBookIncremental({entities:{Book,Page},ai,recipe,onEvent:e=>events.push(e),lock:()=>()=>{},fetchReference:async()=>null});
  const saved=[...pages.values()].sort((a,b)=>a.page_number-b.page_number);
  expect(saved.map(p=>p.text_content)).toEqual(['Edited page 0','Edited page 1']);
  expect(events.some(e=>e.type==='phase' && e.phase==='editing')).toBe(true);
  expect(result.status).toBe(BOOK_STATUS.PARTIAL);
  expect(books.get(result.bookId).status).toBe(BOOK_STATUS.PARTIAL);
  expect(summarizeBook(books.get(result.bookId), saved).missingImage).toHaveLength(1);
});
