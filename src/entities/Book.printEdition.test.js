import { beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../lib/supabaseClient', () => ({ supabase: { from: fixture.from } }));
import { savePrintEdition } from './Book';
import { editEdition, editionSavePayload, openEditionWorkspace } from '../lib/printEdition/history';

let editionRow;
beforeEach(() => {
  editionRow = null;
  fixture.from.mockImplementation(() => {
    const predicates = {};
    let payload;
    const query = {
      update(value) { payload = value; return query; },
      eq(key, value) { predicates[key] = value; return query; },
      or(value) {
        expect(value).toBe('print_edition.is.null,print_edition->>revision.eq.0');
        predicates.revision = 0;
        return query;
      },
      filter(key, operator, value) {
        expect(key).toBe('print_edition->>revision');
        expect(operator).toBe('eq');
        predicates.revision = value;
        return query;
      },
      select() { return query; },
      async maybeSingle() {
        if (predicates.id !== 'book-1' || predicates.created_by !== 'owner-1' || (editionRow?.revision ?? 0) !== predicates.revision) return { data: null };
        editionRow = payload.print_edition;
        return { data: { id: 'book-1' } };
      },
    };
    return query;
  });
});

describe('owner print edition storage', () => {
  const payload = (creator, current = null) => editionSavePayload(editEdition(openEditionWorkspace(current), edition => ({ ...edition, creator })));

  it('saves exactly one of two same-revision submissions with their corresponding history', async () => {
    const [first, second] = await Promise.allSettled([
      savePrintEdition('book-1', 'owner-1', payload('first')),
      savePrintEdition('book-1', 'owner-1', payload('second')),
    ]);
    expect(first).toMatchObject({ status: 'fulfilled', value: { creator: 'first', revision: 1 } });
    expect(second).toMatchObject({ status: 'rejected', reason: expect.objectContaining({ message: 'conflict' }) });
    expect(openEditionWorkspace(editionRow).versions[0].draft.creator).toBe('first');
    await expect(savePrintEdition('book-1', 'owner-1', payload('fresh', editionRow))).resolves.toMatchObject({ creator: 'fresh', revision: 2 });
  });

  it('never writes a draft or history for a different account', async () => {
    await expect(savePrintEdition('book-1', 'non-owner', payload('forged'))).rejects.toThrow('conflict');
    expect(editionRow).toBeNull();
  });
});
