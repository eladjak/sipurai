import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePrintedBook } from '../src/lib/printedBookLink.js';
const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function database({ owner, publicBook, shared }) {
  const calls = [];
  const client = { from(table) {
    const query = {table, filters: {}};
    calls.push(query);
    return {select(cols) { query.cols = cols; return this; },
      eq(key, val) { query.filters[key] = val; return this; },
      async maybeSingle() {
        if (table === 'books') return {data: owner && query.filters.created_by === owner ? {id} : null};
        return {data: shared && query.filters.is_public === true ? publicBook : null};
      }};
  }};
  return {client,calls};
}

test('private or invalid book gives a guest no metadata or owner-table read', async () => {
  const {client, calls} = database({owner:'parent',publicBook:{title:'hidden'},shared:false});
  assert.deepEqual(await resolvePrintedBook(client,id,null),{kind:'private'});
  assert.deepEqual(await resolvePrintedBook(client,'42079',null),{kind:'private'});
  assert.deepEqual(calls.map(c => c.table),['public_books']);
});

test('owner and other authenticated scanner are resolved independently', async () => {
  const {client} = database({owner:'parent',shared:false});
  assert.equal((await resolvePrintedBook(client,id,'parent')).kind,'owner');
  assert.equal((await resolvePrintedBook(client,id,'guest')).kind,'private');
  assert.equal((await resolvePrintedBook(client,id.toUpperCase(),'parent')).kind,'owner');
});

test('explicitly shared preview selects only the three presentation fields', async () => {
  const {client,calls} = database({shared:true,publicBook:{title:'Open book'}});
  assert.equal((await resolvePrintedBook(client,id,null)).book.title,'Open book');
  assert.equal(calls[0].cols,'title,cover_image,description');
  assert.deepEqual(calls[0].filters,{id,is_public:true});
});
