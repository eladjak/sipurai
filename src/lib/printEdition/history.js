import { DEFAULT_OPENING_LAYOUT, DEFAULT_STORY_PANEL, editionDraft } from './model.js';

const MAX_EDITS = 30;
const MAX_VERSIONS = 12;
const GROUP_DELAY_MS = 900;
const inline = /^data:image\/(?:jpeg|png|webp);base64,/;
const artKey = ['printArt', 'spread'];

function snapshot(raw) {
  const { revision: _revision, ...draft } = editionDraft(raw);
  return draft;
}

// JSONB may return keys in a different order. Stable ordering keeps saved art references valid.
const orderedEntries = record => Object.keys(record).sort().map(key => [key, record[key]]);

function mapArt(draft, transform) {
  const artwork = Object.fromEntries(orderedEntries(draft.artwork).map(([key, value]) => [key, transform(value)]));
  const pages = Object.fromEntries(orderedEntries(draft.pages).map(([id, page]) => [id, {
    ...page,
    ...Object.fromEntries(artKey.filter(key => Object.hasOwn(page, key)).map(key => [key, transform(page[key])])),
  }]));
  return { ...draft, artwork, pages };
}

function inlineArt(draft) {
  const sources = new Set();
  mapArt(draft, value => {
    if (typeof value === 'string' && inline.test(value)) sources.add(value);
  });
  return [...sources];
}

export function openEditionWorkspace(raw) {
  // Only a newly opened, unsaved edition opts into the new treatment.
  const active = snapshot(raw == null ? {
    version: 1, defaultPanel: DEFAULT_STORY_PANEL, openingLayout: DEFAULT_OPENING_LAYOUT,
  } : raw);
  const { revision } = editionDraft(raw);
  const baseline = {
    entries: [active], cursor: 0, revision, group: null, dirty: false,
    versions: revision ? [{ revision, savedAt: null, draft: active }] : [],
  };
  const stored = raw?.history;
  if (stored?.version !== 1 || !Array.isArray(stored.entries) || !Array.isArray(stored.versions)
      || !Number.isInteger(stored.cursor) || stored.cursor < 0 || stored.cursor >= stored.entries.length
      || stored.entries.length > MAX_EDITS || stored.versions.length > MAX_VERSIONS
      || !stored.versions.every(item => Number.isInteger(item?.revision) && item.revision > 0)) return baseline;

  const sources = inlineArt(active);
  const decode = draft => mapArt(snapshot(draft), value => {
    if (!Array.isArray(value)) return value;
    const [type, index] = value;
    if (type === 'active') return sources[index] ?? null;
    if (type === 'past') return stored.images?.[index] ?? null;
    return value;
  });
  return {
    ...baseline,
    entries: stored.entries.map((draft, index) => index === stored.cursor ? active : decode(draft)),
    cursor: stored.cursor,
    versions: stored.versions.map(({ revision: savedRevision, savedAt, draft }) => ({
      revision: savedRevision,
      savedAt: typeof savedAt === 'string' && Number.isFinite(Date.parse(savedAt)) ? savedAt : null,
      draft: savedRevision === revision ? active : decode(draft),
    })),
  };
}

export function editEdition(workspace, updater, { key = undefined, now = Date.now() } = {}) {
  const active = workspace.entries[workspace.cursor];
  const next = updater(active);
  if (next === active) return workspace;
  const group = workspace.group;
  const merge = Boolean(key && group?.key === key && now - group.now < GROUP_DELAY_MS);
  const entries = [...workspace.entries.slice(0, workspace.cursor + (merge ? 0 : 1)), next].slice(-MAX_EDITS);
  return { ...workspace, entries, cursor: entries.length - 1, dirty: true, group: key ? { key, now } : null };
}

export function moveEdition(workspace, offset) {
  const cursor = workspace.cursor + offset;
  if (cursor < 0 || cursor >= workspace.entries.length) return workspace;
  return { ...workspace, cursor, dirty: true, group: null };
}

export function restoreEdition(workspace, revision) {
  const match = workspace.versions.find(item => item.revision === revision);
  if (!match) return workspace;
  const restored = editEdition(workspace, () => match.draft);
  if (restored === workspace) return workspace;
  const saved = workspace.versions.find(item => item.revision === workspace.revision);
  return { ...restored, dirty: !saved || !sameDraft(match.draft, saved.draft) };
}

function sameDraft(left, right) {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object'
      || Array.isArray(left) !== Array.isArray(right)) return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length
    && keys.every(key => Object.hasOwn(right, key) && sameDraft(left[key], right[key]));
}

/** The existing owner+revision compare-and-swap persists one editor and history together. */
export function editionSavePayload(workspace, savedAt = new Date().toISOString()) {
  const active = workspace.entries[workspace.cursor];
  const revision = workspace.revision + 1;
  const versions = [...workspace.versions, { revision, savedAt, draft: active }].slice(-MAX_VERSIONS);
  const activeSources = new Map(inlineArt(active).map((src, index) => [src, index]));
  const pastSources = new Map();
  function encode(draft) {
    return mapArt(draft, value => {
      if (typeof value !== 'string' || !inline.test(value)) return value;
      if (activeSources.has(value)) return ['active', activeSources.get(value)];
      if (!pastSources.has(value)) pastSources.set(value, pastSources.size);
      return ['past', pastSources.get(value)];
    });
  }
  return {
    ...active,
    revision: workspace.revision,
    history: {
      version: 1,
      cursor: workspace.cursor,
      entries: workspace.entries.map((draft, index) => index === workspace.cursor ? null : encode(draft)),
      versions: versions.map(item => ({ ...item, draft: item.revision === revision ? null : encode(item.draft) })),
      images: [...pastSources.keys()],
    },
  };
}
