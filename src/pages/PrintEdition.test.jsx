import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({ get: vi.fn(), rows: vi.fn(), save: vi.fn(), suggestNikud: vi.fn(), invoke: vi.fn(), download: vi.fn() }));
vi.mock('@/entities/Book', () => ({ Book: { get: fixture.get }, savePrintEdition: fixture.save }));
vi.mock('@/entities/Page', () => ({ Page: { filter: fixture.rows } }));
vi.mock('@/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user: { id: 'owner-1' }, isLoading: false }) }));
vi.mock('@/components/i18n/i18nProvider', async () => {
  const { default: print } = await import('@/components/i18n/locales/he/print');
  const t = (key, values = {}) => {
    const value = key.split('.').reduce((item, part) => item?.[part], print);
    return typeof value === 'string' ? value.replace(/\{(\w+)\}/g, (_, name) => values[name] ?? '') : value;
  };
  return { useI18n: () => ({ isRTL: true, language: 'hebrew', t }) };
});
vi.mock('@/lib/printEdition/localNikudClient', () => ({ createNikudClient: () => ({ close() {}, suggest: fixture.suggestNikud }) }));
vi.mock('@/integrations/Core', () => ({ InvokeLLM: fixture.invoke }));
vi.mock('@/lib/printEdition/assets', () => ({ downloadEditionBundle: fixture.download }));
vi.mock('@/screens/print-edition/ProofWorkspace', () => ({
  default: ({ onEdit, verifyHandoff }) => <>
    <button type="button" onClick={() => onEdit({ kind: 'story', storyIndex: 1, field: 'text' })}>Page two in proof</button>
    <button type="button" onClick={() => verifyHandoff({ requireApproval: false }).catch(() => {})}>Verify pending proof source</button>
  </>,
}));

import PrintEdition from './PrintEdition';
import { editionLabels } from '@/screens/print-edition/labels';

const labels = editionLabels(true);
const id = '12345678-1234-1234-1234-123456789012';
const pages = [
  { id: 'p1', page_number: 1, text_content: 'שלום עולם!', image_url: '/art/first.png' },
  { id: 'p2', page_number: 2, text_content: 'איך הולך?', image_url: '/art/second.png' },
];
const draft = {
  version: 1, revision: 3, creator: 'המשפחה', blurb: 'הסיפור שלנו', artwork: { closingArt: '/art/closing.png' },
  pages: Object.fromEntries(pages.map(page => [page.id, {
    source: page.text_content, text: page.text_content, approval: { mode: 'unpointed', text: page.text_content },
  }])),
};
const book = { id, title: 'ספר המשפחה', language: 'hebrew', created_by: 'owner-1', total_pages: 2, cover_image: '/art/cover.png' };
const enter = (bookId = id) => render(<MemoryRouter initialEntries={[`/PrintEdition?id=${bookId}`]}><PrintEdition /></MemoryRouter>);
const button = name => screen.getByRole('button', { name });

let stored;
const originalScroll = HTMLElement.prototype.scrollIntoView;
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  stored = structuredClone(draft);
  fixture.get.mockImplementation(async () => ({ ...book, printEdition: stored }));
  fixture.rows.mockResolvedValue(pages);
  fixture.save.mockImplementation(async (_id, _owner, next) => {
    stored = JSON.parse(JSON.stringify({ ...next, revision: next.revision + 1 }));
    return stored;
  });
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  HTMLElement.prototype.scrollIntoView = originalScroll;
});

describe('print edition owner editing flow', () => {
  it('jumps from proof to the actual text field, invalidates exact approval, and persists undo and redo', async () => {
    const view = enter();
    fireEvent.click(await screen.findByRole('button', { name: 'Page two in proof' }));
    const editor = screen.getByLabelText(labels.text);
    await waitFor(() => expect(editor).toHaveFocus());
    expect(editor).toHaveValue('איך הולך?');
    fireEvent.change(editor, { target: { value: 'איך הולך לך?' } });
    expect(screen.getByText(labels.needsReview)).toBeInTheDocument();
    expect(button(labels.export)).toBeDisabled();
    fireEvent.click(button(labels.save));
    await screen.findByText(labels.saved);
    expect(stored.pages.p2.rewrite).toBe('איך הולך לך?');
    expect(stored.pages.p2.approval).toBeNull();
    view.unmount();
    enter();
    fireEvent.click(await screen.findByRole('button', { name: 'Page two in proof' }));
    fireEvent.click(button(labels.undo));
    expect(screen.getByLabelText(labels.text)).toHaveValue('איך הולך?');
    fireEvent.click(button(labels.redo));
    expect(screen.getByLabelText(labels.text)).toHaveValue('איך הולך לך?');
  });

  it('restores a saved version as a draft, saves it as a new revision and keeps undo after reopening', async () => {
    const view = enter();
    const editor = await screen.findByLabelText(labels.text);
    fireEvent.change(editor, { target: { value: 'העריכה האחרונה' } });
    fireEvent.click(button(labels.save));
    await screen.findByText(labels.saved);

    fireEvent.click(screen.getByText(labels.versions));
    fireEvent.click(button(labels.restoreVersion(3)));
    expect(editor).toHaveValue('שלום עולם!');
    expect(screen.getByText(labels.restoredDraft(3))).toBeInTheDocument();
    expect(fixture.save).toHaveBeenCalledOnce();

    fireEvent.click(button(labels.undo));
    expect(editor).toHaveValue('העריכה האחרונה');
    fireEvent.click(button(labels.redo));
    expect(editor).toHaveValue('שלום עולם!');
    fireEvent.click(button(labels.save));
    await screen.findByText(labels.saved);
    expect(stored.revision).toBe(5);
    expect(stored.history.versions.map(version => version.revision)).toEqual([3, 4, 5]);

    view.unmount();
    enter();
    const reopened = await screen.findByLabelText(labels.text);
    expect(reopened).toHaveValue('שלום עולם!');
    fireEvent.click(button(labels.undo));
    expect(reopened).toHaveValue('העריכה האחרונה');
  });

  it('restores the last saved version without asking for a duplicate save', async () => {
    enter();
    const editor = await screen.findByLabelText(labels.text);
    fireEvent.change(editor, { target: { value: 'טיוטה מקומית' } });
    fireEvent.click(screen.getByText(labels.versions));
    fireEvent.click(button(labels.restoreVersion(stored.revision)));
    expect(editor).toHaveValue('שלום עולם!');
    expect(button(labels.save)).toBeDisabled();
    expect(screen.getByText(labels.restoredSaved)).toBeInTheDocument();
    expect(screen.getByText(labels.versions).closest('summary')).toHaveFocus();
    expect(fixture.save).not.toHaveBeenCalled();
    fireEvent.click(button(labels.undo));
    expect(editor).toHaveValue('טיוטה מקומית');
    expect(button(labels.save)).toBeEnabled();
  });

  it('recognizes content identical to the last save when restoring an earlier version', async () => {
    enter();
    const editor = await screen.findByLabelText(labels.text);
    fireEvent.change(editor, { target: { value: 'גרסה אחרת' } });
    fireEvent.click(button(labels.save));
    await screen.findByText(labels.saved);
    fireEvent.click(screen.getByText(labels.versions));
    fireEvent.click(button(labels.restoreVersion(3)));
    fireEvent.click(button(labels.save));
    await screen.findByText(labels.saved);

    fireEvent.change(editor, { target: { value: 'טיוטה חדשה' } });
    fireEvent.click(button(labels.restoreVersion(3)));
    expect(editor).toHaveValue('שלום עולם!');
    expect(button(labels.save)).toBeDisabled();
    expect(screen.getByText(labels.versions).closest('summary')).toHaveFocus();
    expect(fixture.save).toHaveBeenCalledTimes(2);
  });

  it('leaves a restored draft in place when the save detects a newer revision', async () => {
    enter();
    const editor = await screen.findByLabelText(labels.text);
    fireEvent.change(editor, { target: { value: 'העריכה האחרונה' } });
    fireEvent.click(button(labels.save));
    await screen.findByText(labels.saved);

    fireEvent.click(screen.getByText(labels.versions));
    fireEvent.click(button(labels.restoreVersion(3)));
    stored = { ...stored, revision: 5 };
    fixture.save.mockImplementationOnce(async (_id, _owner, next) => {
      if (next.revision !== stored.revision) throw new Error('conflict');
      throw new Error('expected a stale revision');
    });
    fireEvent.click(button(labels.save));
    expect(await screen.findByRole('alert')).toHaveTextContent(labels.conflict);
    expect(editor).toHaveValue('שלום עולם!');
    expect(stored.revision).toBe(5);
    expect(stored.pages.p1.rewrite).toBe('העריכה האחרונה');
    expect(button(labels.save)).toBeDisabled();
    fireEvent.click(button(labels.undo));
    expect(editor).toHaveValue('העריכה האחרונה');
  });

  it('shows a PC proofreading suggestion for the reviewed book and opens the matching story field without edits', async () => {
    const text = 'הוּא הִסְתַּכֵּל בְּעֵינַיִים גְּדוֹלוֹת.';
    const source = 'הוא הסתכל בעיניים גדולות.';
    stored.pages.p2 = { source, text };
    fixture.rows.mockResolvedValueOnce([pages[0], { ...pages[1], text_content: source }]);
    enter('201398c5-7ce0-4e16-98eb-b2be6ba09daf');
    fireEvent.click(await screen.findByText(labels.proofreadingNotes));
    expect(screen.getByText('בְּעֵינַיִם')).toBeVisible();
    expect(screen.getByText('אָזְנַיִם')).toBeVisible();
    expect(screen.queryByRole('button', { name: labels.editProofreadingLocation(12) })).not.toBeInTheDocument();
    fireEvent.click(button(labels.editProofreadingLocation(2)));
    const editor = screen.getByLabelText(labels.text);
    await waitFor(() => expect(editor).toHaveFocus());
    expect(editor).toHaveValue(text);
    expect(button(labels.save)).toBeDisabled();
    expect(fixture.save).not.toHaveBeenCalled();
    const creator = screen.getByLabelText(labels.creator);
    expect(creator).toHaveValue('המשפחה');
    fireEvent.click(button(labels.useCreatorCredit));
    await waitFor(() => expect(creator).toHaveFocus());
    expect(creator).toHaveValue('נוצר בסיפוראי');
    expect(fixture.save).not.toHaveBeenCalled();
  });

  it('holds the old text while AI is pending and applies only an explicitly accepted rewrite', async () => {
    let finishRewrite;
    fixture.invoke.mockImplementationOnce(() => new Promise(resolve => { finishRewrite = resolve; }));
    enter();
    await screen.findByLabelText(labels.text);
    expect(screen.queryByText(labels.rewriteWithAI)).not.toBeInTheDocument();
    expect(screen.queryByText(labels.regenerateArt)).not.toBeInTheDocument();
    expect(screen.queryByText(labels.generateClosingArt)).not.toBeInTheDocument();
    expect(fixture.invoke).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText(labels.allowAI));
    fireEvent.click(screen.getByText(labels.rewriteWithAI));
    fireEvent.change(screen.getByLabelText(labels.rewriteInstruction), { target: { value: 'תוסיפו הומור' } });
    fireEvent.click(button(labels.requestRewrite));
    const editor = screen.getByLabelText(labels.text);
    expect(editor).toBeDisabled();
    fireEvent.submit(editor.closest('form'));
    expect(fixture.save).not.toHaveBeenCalled();
    expect(editor).toHaveValue('שלום עולם!');
    await waitFor(() => expect(fixture.invoke).toHaveBeenCalledOnce());
    await act(async () => finishRewrite({ text: 'הירח חייך לכל הילדים!' }));
    expect(await screen.findByText('הירח חייך לכל הילדים!')).toBeInTheDocument();
    expect(screen.getByLabelText(labels.text)).toHaveValue('שלום עולם!');
    expect(fixture.invoke).toHaveBeenCalledWith(expect.objectContaining({ prompt: expect.stringContaining('תוסיפו הומור') }));
    fireEvent.click(button(labels.useRewrite));
    expect(screen.getByLabelText(labels.text)).toHaveValue('הירח חייך לכל הילדים!');
    expect(screen.getByText(labels.needsReview)).toBeInTheDocument();
  });

  it('submits only once during a save and leaves the local text intact on revision conflict', async () => {
    let failSave;
    fixture.save.mockImplementationOnce(() => new Promise((_resolve, reject) => { failSave = reject; }));
    enter();
    const editor = await screen.findByLabelText(labels.text);
    fireEvent.change(editor, { target: { value: 'תיקון מקומי' } });
    const form = editor.closest('form');
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(fixture.save).toHaveBeenCalledTimes(1);
    expect(editor).toBeDisabled();
    await act(async () => failSave(new Error('conflict')));
    expect(screen.getByRole('alert')).toHaveTextContent(labels.conflict);
    expect(editor).toHaveValue('תיקון מקומי');
    expect(editor).not.toBeDisabled();
    expect(screen.getByRole('link', { name: labels.openLatest })).toHaveAttribute('target', '_blank');
  });

  it('rechecks the current story source before downloading an approved bundle', async () => {
    enter();
    await waitFor(() => expect(button(labels.export)).toBeEnabled());
    fixture.rows.mockResolvedValueOnce([{ ...pages[0], text_content: 'מקור שהשתנה' }, pages[1]]);
    fireEvent.click(button(labels.export));
    expect(await screen.findByRole('alert')).toHaveTextContent(labels.conflict);
    expect(fixture.download).not.toHaveBeenCalled();
    expect(button(labels.export)).toBeDisabled();
  });

  it('rejects a pending handoff on source artwork changes and preserves unsaved words', async () => {
    enter();
    const editor = await screen.findByLabelText(labels.text);
    fireEvent.change(editor, { target: { value: 'הטקסט החדש נשאר כאן' } });
    fixture.rows.mockResolvedValueOnce([{ ...pages[0], image_url: '/art/changed.png' }, pages[1]]);
    fireEvent.click(button('Verify pending proof source'));
    expect(await screen.findByRole('alert')).toHaveTextContent(labels.conflict);
    expect(editor).toHaveValue('הטקסט החדש נשאר כאן');
    expect(screen.getByRole('link', { name: labels.openLatest })).toHaveAttribute('target', '_blank');
  });

  it('adds a private story page with existing art, saves the font and restores both on reload', async () => {
    const open = enter();
    fireEvent.click(await screen.findByRole('button', { name: labels.addPrintPage }));
    const editor = screen.getByLabelText(labels.text);
    expect(editor).toHaveValue('');
    fireEvent.change(editor, { target: { value: 'ובסוף כולם חייכו.' } });
    fireEvent.click(button(labels.unpointed));
    fireEvent.change(screen.getByLabelText(labels.reuseArt), { target: { value: 'p1' } });
    fireEvent.change(screen.getByLabelText(labels.storyFont), { target: { value: 'rubik' } });
    fireEvent.click(button(labels.save));
    await screen.findByText(labels.saved);
    expect(stored.extraPages).toHaveLength(1);
    const child = stored.pages[stored.extraPages[0]];
    expect(child.rewrite).toBe('ובסוף כולם חייכו.');
    expect(child.printArt).toBe('/art/first.png');
    expect(stored.storyFont).toBe('rubik');
    open.unmount();
    enter();
    fireEvent.click(await screen.findByRole('button', { name: labels.next }));
    fireEvent.click(button(labels.next));
    expect(screen.getByLabelText(labels.text)).toHaveValue('ובסוף כולם חייכו.');
    expect(screen.getByLabelText(labels.storyFont)).toHaveValue('rubik');
    fireEvent.click(button(labels.removePrintPage));
    expect(screen.getByLabelText(labels.text)).toHaveValue('איך הולך?');
    fireEvent.click(button(labels.undo));
    fireEvent.click(button(labels.next));
    expect(screen.getByLabelText(labels.text)).toHaveValue('ובסוף כולם חייכו.');
  });

  it('rechecks the saved revision after assembling a source bundle and before releasing it', async () => {
    const released = vi.fn();
    fixture.download.mockImplementationOnce(async (_book, _pages, _edition, verifyAgain) => {
      stored = { ...stored, revision: stored.revision + 1 };
      await verifyAgain();
      released();
    });
    enter();
    await waitFor(() => expect(button(labels.export)).toBeEnabled());
    fireEvent.click(button(labels.export));
    expect(await screen.findByRole('alert')).toHaveTextContent(labels.conflict);
    expect(fixture.get).toHaveBeenCalledTimes(3);
    expect(released).not.toHaveBeenCalled();
    expect(button(labels.export)).toBeDisabled();
  });
});
