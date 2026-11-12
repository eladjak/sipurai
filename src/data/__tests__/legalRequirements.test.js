// Legal requirements found in the 12.11.2026 review (Codex + Grok). Each test names its source.
import { describe, it, expect } from 'vitest';
import { termsContent } from '../termsContent.js';
import { policyContent, gateCopy, CONTROLLER } from '../privacyPolicyContent.js';
import heCancel from '../../components/i18n/locales/he/cancelSubscription.js';

const terms = (termsContent.he || termsContent).sections.map((s) => s.heading + '\n' + s.body).join('\n');
const policy = policyContent.he.sections.map((s) => s.heading + '\n' + s.body).join('\n');

describe('legal requirements (Israel)', () => {
  it('names the business: name, number, address (Privacy Law s.11(2a), CPL s.14C)', () => {
    expect(CONTROLLER.businessId).toBe('021983085');
    expect(terms).toContain('021983085');
    expect(policy).toContain('021983085');
    expect(policy).toContain('מגדל העמק');
  });
  it('registered mail counts six business days from posting (CPL s.13D)', () => {
    expect(terms).toContain('שישה ימי עסקים מהיום שבו מסרתם את המכתב לדואר');
  });
  it('a cancellation notice asks for name and ID number (CPL s.14T(c))', () => {
    expect(terms).toContain('תעודת הזהות');
    expect(heCancel.cancelSubscription.mail1).toContain('תעודת זהות');
  });
  it('no cancellation fee when the cancellation is due to our breach (CPL s.14E(a))', () => {
    expect(terms).toContain('לא נגבה דמי ביטול');
  });
  it('only a parent or guardian may enter a child (no "or got their consent")', () => {
    expect(terms).not.toContain('או שקיבלתם את הסכמתם');
  });
  it('marketing messages need separate explicit consent (Communications Law s.30A)', () => {
    expect(terms).toContain('30א');
    expect(policy).toContain('פרסומת');
  });
  it('consent box names account details and the main destinations abroad (transfer regulations r.2(1))', () => {
    expect(gateCopy.he.privacyItem).toContain('פרטי החשבון');
    expect(gateCopy.he.privacyItem).toContain('ארצות הברית');
  });
  it('access refusal within 21 days (access regulations r.5)', () => {
    expect(policy).toContain('21 יום');
  });
});
