const DAY_MS = 86_400_000;
export const MAX_INPUT_BYTES = 1_048_576;
const MAX_ROWS = 250;
const MAX_TEXT = 4_000;
const MAX_COUNT = 10_000_000;
const STUCK_MINUTES = 30;
const HEBREW_LETTER = /^[\u05D0-\u05EA\u05F0-\u05F2]$/u;
const VOWEL = /^[\u05B0-\u05BB\u05C7]$/u;
const MARK = /^\p{M}$/u;

export class QualityInputError extends Error {}
const requireInput = (ok, code) => {
  if (!ok) throw new QualityInputError(code);
};

function record(value) {
  requireInput(value && typeof value === 'object' && !Array.isArray(value), 'invalid_structure');
  return value;
}

function rows(value) {
  if (value === undefined || value === null) return null;
  requireInput(Array.isArray(value), 'invalid_structure');
  requireInput(value.length <= MAX_ROWS, 'row_budget');
  return value;
}

function count(value, max = MAX_COUNT) {
  requireInput(Number.isSafeInteger(value) && value >= 0 && value <= max, 'invalid_count');
  return value;
}

function day(value) {
  requireInput(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value), 'invalid_day');
  const instant = new Date(value);
  requireInput(Number.isFinite(+instant) && instant.toISOString().startsWith(value + 'T'), 'invalid_day');
  return +instant;
}

function coverage(text) {
  requireInput(typeof text === 'string', 'invalid_text');
  requireInput(text.length <= MAX_TEXT, 'text_budget');
  let letters = 0;
  let vowelMarked = 0;
  let hebrewBase = false;
  let counted = false;
  for (const codepoint of text.normalize('NFD')) {
    if (MARK.test(codepoint)) {
      if (hebrewBase && !counted && VOWEL.test(codepoint)) {
        vowelMarked++;
        counted = true;
      }
    } else {
      hebrewBase = HEBREW_LETTER.test(codepoint);
      counted = false;
      if (hebrewBase) letters++;
    }
  }
  return { letters, vowelMarked };
}

function sampleBooks(value) {
  const books = rows(value);
  if (!books) return null;
  const result = {
    books: books.length, pages: 0, missingIllustrations: 0,
    hebrewLetters: 0, vowelMarkedHebrewLetters: 0, testedTextPages: 0,
  };
  for (const entry of books) {
    const pages = rows(record(entry).pages);
    requireInput(pages, 'invalid_structure');
    result.pages += pages.length;
    requireInput(result.pages <= MAX_ROWS, 'page_budget');
    for (const page of pages) {
      record(page);
      requireInput(typeof page.illustrated === 'boolean', 'invalid_illustration');
      if (!page.illustrated) result.missingIllustrations++;
      if (page.text === undefined || page.text === null) continue;
      const { letters, vowelMarked } = coverage(page.text);
      result.hebrewLetters += letters;
      result.vowelMarkedHebrewLetters += vowelMarked;
      result.testedTextPages++;
    }
  }
  return result;
}

function generation(value) {
  const runs = rows(value);
  if (!runs) return null;
  const result = { sampled: runs.length, stuck: 0, oldestStuckMinutes: null, illustrationFailures: 0 };
  for (const run of runs) {
    record(run);
    requireInput(['queued', 'running', 'completed', 'failed'].includes(run.state), 'invalid_generation_state');
    const age = count(run.ageMinutes);
    if (['queued', 'running'].includes(run.state) && age >= STUCK_MINUTES) {
      result.stuck++;
      result.oldestStuckMinutes = Math.max(result.oldestStuckMinutes ?? 0, age);
    }
    if (run.state === 'failed' && run.failure === 'illustration') result.illustrationFailures++;
  }
  return result;
}

function counters(value, denominator, keys) {
  if (value === undefined || value === null) return null;
  record(value);
  const total = count(value[denominator]);
  return {
    [denominator]: total,
    ...Object.fromEntries(keys.map(key => [key, count(value[key], total)])),
  };
}

function aggregate(value) {
  record(value);
  const a = value.aggregates ?? {};
  record(a);
  const timings = counters(a.timing, 'samples', []);
  if (timings) {
    timings.p95Ms = timings.samples ? count(a.timing.p95Ms) : null;
    requireInput(timings.samples || a.timing.p95Ms === null, 'invalid_timing');
  }
  const funnel = counters(a.funnel, 'started', ['manuscriptReady', 'bookReady']);
  requireInput(!funnel || funnel.bookReady <= funnel.manuscriptReady, 'invalid_funnel');
  const errors = counters(a.errors, 'attempts', ['failedAttempts', 'repeatedErrorAttempts']);
  requireInput(!errors || errors.repeatedErrorAttempts <= errors.failedAttempts, 'invalid_errors');
  requireInput(value.smokePassed === undefined || value.smokePassed === null || typeof value.smokePassed === 'boolean', 'invalid_smoke');
  return {
    sample: sampleBooks(value.sampleBooks),
    generation: generation(value.generations),
    visual: counters(a.visual, 'checkedPages', ['qualityIssues', 'textOverflow', 'faceOverlap']),
    timing: timings,
    funnel,
    errors,
    feedback: counters(a.feedback, 'responses', ['negative']),
    smokePassed: value.smokePassed ?? null,
  };
}

const priorities = [
  ['recover_stuck_generation', 'high', m => m.generation?.stuck, 'Reproduce recovery with a stalled test run.', 'Revert the local recovery change.'],
  ['repair_missing_illustrations', 'high', m => m.sample?.missingIllustrations, 'Reproduce missing art in a sample book.', 'Revert the local illustration change.'],
  ['fix_illustration_failures', 'high', m => m.generation?.illustrationFailures, 'Reproduce an illustration failure in an offline test.', 'Revert the local illustration change.'],
  ['review_face_overlap', 'medium', m => m.visual?.faceOverlap, 'Open the authorized sample and check where text covers a face.', 'Revert the local text placement change.'],
  ['review_text_overflow', 'medium', m => m.visual?.textOverflow, 'Check the text area at the reported trim size on a sample.', 'Revert the local layout change.'],
  ['review_visual_quality', 'medium', m => m.visual?.qualityIssues, 'Check the same visual issue on a sample.', 'Revert the local presentation change.'],
  ['investigate_recurring_errors', 'medium', m => m.errors?.repeatedErrorAttempts, 'Reproduce the repeated failure with test data.', 'Revert the local change.'],
];

function proposal(current, prior) {
  if (current.smokePassed === false) {
    return { code: 'repair_smoke_path', severity: 'high', evidence: { smokePassed: false },
      check: 'Run the offline smoke path and reproduce the failure.', rollback: 'Revert the test-path repair.' };
  }
  if (!prior) return null;
  for (const [code, severity, metric, check, rollback] of priorities) {
    const today = metric(current);
    const comparableDay = metric(prior);
    if (today > 0 && comparableDay > 0) return { code, severity, evidence: { today, comparableDay }, check, rollback };
  }
  return null;
}

export function createDailyQualitySnapshot(input) {
  record(input);
  requireInput(input.schemaVersion === 1, 'invalid_schema_version');
  const today = day(input.day);
  const current = aggregate(input.current);
  let comparison = null;
  if (input.comparison !== undefined && input.comparison !== null) {
    record(input.comparison);
    requireInput(day(input.comparison.day) === today - 7 * DAY_MS, 'invalid_comparison_day');
    comparison = { day: input.comparison.day, metrics: aggregate(input.comparison) };
  }
  return {
    schemaVersion: 1, day: input.day, source: 'offline_fixture', timeZone: 'Asia/Jerusalem',
    metrics: current, comparison, proposal: proposal(current, comparison?.metrics),
  };
}
