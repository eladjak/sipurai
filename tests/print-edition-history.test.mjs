import assert from 'node:assert/strict';
import { it } from 'node:test';
import { editEdition, editionSavePayload, moveEdition, openEditionWorkspace, restoreEdition } from '../src/lib/printEdition/history.js';
import { printEditionCapabilities } from '../src/lib/printEdition/policy.js';

const active = workspace => workspace.entries[workspace.cursor];
const persisted = workspace => JSON.parse(JSON.stringify({ ...editionSavePayload(workspace, '2026-11-18T14:00:00Z'), revision: workspace.revision + 1 }));
const save = workspace => openEditionWorkspace(persisted(workspace));
const field = (key, value) => draft => ({ ...draft, [key]: value });

it('groups continuous typing and persists both undo and redo across reload', () => {
  let workspace = openEditionWorkspace(null);
  workspace = editEdition(workspace, field('dedication', 'ל'), { key: 'dedication', now: 10 });
  workspace = editEdition(workspace, field('dedication', 'לילדה'), { key: 'dedication', now: 100 });
  workspace = editEdition(workspace, field('cover', 'hardcover'));
  assert.equal(workspace.entries.length, 3);
  assert.equal(active(moveEdition(workspace, -1)).dedication, 'לילדה');
  workspace = save(moveEdition(workspace, -1));
  assert.equal(workspace.revision, 1);
  assert.equal(workspace.dirty, false);
  assert.equal(active(workspace).cover, 'softcover');
  assert.equal(active(moveEdition(workspace, 1)).cover, 'hardcover');
  assert.equal(active(moveEdition(workspace, -1)).dedication, '');
});

it('restores saved versions and preserves them when a new change discards redo', () => {
  let workspace = openEditionWorkspace({ version: 1, revision: 3, creator: 'שם קודם' });
  workspace = save(editEdition(workspace, field('creator', 'שם חדש')));
  workspace = moveEdition(workspace, -1);
  workspace = save(editEdition(workspace, field('dedication', 'לכולם')));
  assert.equal(moveEdition(workspace, 1), workspace);
  assert.deepEqual(workspace.versions.map(version => version.revision), [3, 4, 5]);
  workspace = restoreEdition(workspace, 4);
  assert.equal(workspace.revision, 5);
  assert.equal(workspace.dirty, true);
  assert.equal(active(workspace).creator, 'שם חדש');
  assert.equal(active(moveEdition(workspace, -1)).dedication, 'לכולם');
});

it('stores each unique inline image once across historical art and JSONB key order', () => {
  const activeArt = 'data:image/png;base64,AAA=';
  const oldArt = 'data:image/png;base64,BBB=';
  const extraActive = 'data:image/png;base64,CCC=';
  const prep = openEditionWorkspace({ version: 1, revision: 2, artwork: { closingArt: oldArt, coverArt: extraActive }, pages: { p2: { printArt: activeArt } } });
  const draft = editEdition(prep, old => ({ ...old, artwork: { endpaperArt: '/api/img?file=r', coverArt: extraActive, closingArt: activeArt }, pages: {} }));
  const stored = persisted(draft);
  assert.equal(JSON.stringify(stored).split(activeArt).length - 1, 1);
  assert.equal(JSON.stringify(stored).split(oldArt).length - 1, 1);
  assert.equal(JSON.stringify(stored).split(extraActive).length - 1, 1);
  stored.artwork = Object.fromEntries(Object.entries(stored.artwork).reverse());
  const restored = openEditionWorkspace(stored);
  assert.equal(active(restored).artwork.closingArt, activeArt);
  assert.equal(active(moveEdition(restored, -1)).pages.p2.printArt, activeArt);
  assert.equal(active(moveEdition(restored, -1)).artwork.closingArt, oldArt);
  assert.equal(active(moveEdition(restored, -1)).artwork.coverArt, extraActive);
});

it('bounds both timelines and degrades corrupt history to the active edition', () => {
  let workspace = openEditionWorkspace(null);
  for (let i = 0; i < 48; i++) workspace = save(editEdition(workspace, field('creator', String(i))));
  assert.equal(workspace.entries.length, 30);
  assert.equal(workspace.versions.length, 12);
  const raw = persisted(workspace);
  raw.history.versions.push(null);
  workspace = openEditionWorkspace(raw);
  assert.equal(workspace.entries.length, 1);
  assert.equal(active(workspace).creator, '47');
});

it('opens optional pilot features for everyone by default and recognizes existing premium and family plans', () => {
  const open = printEditionCapabilities();
  assert.ok(Object.values(open).every(Boolean));
  assert.deepEqual(printEditionCapabilities('subscriber-preview', 'premium'), open);
  assert.deepEqual(printEditionCapabilities('subscriber-preview', 'family'), open);
  for (const plan of ['free', 'lite', 'invalid']) assert.ok(Object.values(printEditionCapabilities('subscriber-preview', plan)).every(value => !value));
  assert.ok(Object.values(printEditionCapabilities('manual-only', 'family')).every(value => !value));
});

it('defaults only newly opened editions to integrated and retains it after save', () => {
  const fresh = openEditionWorkspace(null);
  assert.equal(active(fresh).defaultPanel, 'integrated');
  assert.equal(fresh.dirty, false);
  assert.equal(active(save(editEdition(fresh, field('creator', 'משפחה')))).defaultPanel, 'integrated');
  assert.equal(active(openEditionWorkspace({ version: 1, revision: 1 })).defaultPanel, undefined);
});
