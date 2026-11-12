import { describe, it, expect } from 'vitest';
import { missingProcessors } from './processor-inventory.js';
import { readFileSync } from 'node:fs';
import { policyContent } from '@/data/privacyPolicyContent';

describe('known processor discovery', () => {
  it('flags a known SDK or HTML domain omitted from the policy', () => {
    expect(missingProcessors({ dependencies: { 'posthog-js': '1' } }, '', '')).toContain('PostHog');
    expect(missingProcessors({ dependencies: { 'posthog-js': '1' } }, '', 'PostHog')).toEqual([]);
  });
  it('flags a known HTML domain omitted from the policy', () => {
    expect(missingProcessors({ dependencies: {} }, '<script src="https://cdn.segment.com/a.js"></script>', '')).toContain('Segment');
  });
  it('names known processors detected in dependencies and index.html in both policy lists', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    const html = readFileSync('index.html', 'utf8');
    for (const lang of ['he', 'en']) {
      expect(missingProcessors(pkg, html, policyContent[lang].sections[3].body), lang).toEqual([]);
    }
  });
});
