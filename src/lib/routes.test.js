import { describe, it, expect } from 'vitest';
import { redirects, resolveRedirect, protectedPaths } from './routes';

describe('phase 1 routes', () => {
  it.each(Object.entries({ '/Library':'/shelf', '/Characters':'/heroes', '/Settings':'/parents', '/Profile':'/parents', '/BookWizard':'/new', '/StoryIdeas':'/new', '/Contact':'/help/contact', '/contact':'/help/contact', '/Accessibility':'/help/accessibility', '/accessibility':'/help/accessibility', '/Pricing':'/pricing', '/Blog':'/blog', '/PrivacyPolicy':'/privacy', '/TermsOfService':'/terms', '/Home':'/', '/Dashboard':'/', '/LandingPage':'/' }))('%s redirects to %s', (from, to) => expect(redirects[from]).toBe(to));
  it('preserves query and hash', () => expect(resolveRedirect('/Library', '?tab=drafts', '#x')).toBe('/shelf?tab=drafts#x'));
  it('marks the new wizard protected', () => expect(protectedPaths).toContain('/new'));
});
