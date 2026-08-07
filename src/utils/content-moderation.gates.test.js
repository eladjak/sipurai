/**
 * Guards the distinction that broke book creation for every user.
 *
 * checkAgeAppropriateLanguage is a READABILITY LINTER — its own docstring says
 * "Does NOT block content, but returns flags and suggestions". checkContentSafety
 * is the SAFETY GATE. Until 2026-08-07 BookWizard used the linter as a hard block,
 * so a "keep sentences under 15 words" hint was escalated into "this story is not
 * appropriate for children", and the wizard refused to leave the structure step.
 *
 * These tests pin the contract of each function. If someone makes the linter
 * blocking again, or lets the safety gate go soft, one of these fails.
 *
 * NOTE: src/pages/__tests__/pages-setup.js mocks checkAgeAppropriateLanguage to
 * always return isAppropriate:true. That mock is why no existing test could ever
 * have caught this. These tests import the real implementation deliberately.
 */
import { describe, it, expect } from 'vitest';
import { checkAgeAppropriateLanguage, checkContentSafety } from './content-moderation.js';

// The exact description production generated on 2026-08-07, captured off the wire.
const REAL_GENERATED_DESCRIPTION =
  'Barnaby was a little rabbit with twitchy whiskers and a big heart, always wondering ' +
  'what was beyond the tall fence. One sunny morning, his curiosity led him to a tiny ' +
  'gap, revealing a wondrous secret garden filled with colorful flowers.';

describe('checkAgeAppropriateLanguage — advisory linter, not a gate', () => {
  it('flags long sentences in real AI output at the default age range', () => {
    const r = checkAgeAppropriateLanguage(REAL_GENERATED_DESCRIPTION, '5-10');
    // This is the observed behaviour we must NOT treat as a safety verdict.
    expect(r.isAppropriate).toBe(false);
    expect(r.flags.join(' ')).toMatch(/too long/i);
  });

  it('control: short simple sentences produce no flags', () => {
    const r = checkAgeAppropriateLanguage('Pip is a rabbit. He found a garden. He was happy.', '5-10');
    expect(r.isAppropriate).toBe(true);
    expect(r.flags).toHaveLength(0);
  });

  it('control: the same text is unflagged for older readers', () => {
    // minAge >= 6 skips the sentence-length rule, proving the flag is about
    // readability for young children and not about the content being unsafe.
    const r = checkAgeAppropriateLanguage(REAL_GENERATED_DESCRIPTION, '8-10');
    expect(r.isAppropriate).toBe(true);
  });

  it('never reports long-sentence flags as a safety problem', () => {
    const linter = checkAgeAppropriateLanguage(REAL_GENERATED_DESCRIPTION, '5-10');
    const safety = checkContentSafety(REAL_GENERATED_DESCRIPTION);
    // The whole bug in one assertion: the linter objects, the safety gate does not.
    expect(linter.isAppropriate).toBe(false);
    expect(safety.isClean).toBe(true);
  });
});

describe('checkContentSafety — the real gate', () => {
  it('passes ordinary children-story prose', () => {
    expect(checkContentSafety(REAL_GENERATED_DESCRIPTION).isClean).toBe(true);
  });

  it('control: a non-string input does not throw and is treated as clean', () => {
    expect(checkContentSafety(undefined).isClean).toBe(true);
  });
});
