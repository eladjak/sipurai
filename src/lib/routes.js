// Phase-one aliases. Matching is case-sensitive so canonical lowercase URLs
// never redirect to themselves in React Router's case-insensitive matcher.
export const redirects = {
  '/Library': '/shelf', '/Characters': '/heroes', '/Settings': '/parents',
  '/Profile': '/parents', '/BookWizard': '/new', '/StoryIdeas': '/new',
  '/Contact': '/help/contact', '/contact': '/help/contact',
  '/Accessibility': '/help/accessibility', '/accessibility': '/help/accessibility',
  '/Pricing': '/pricing', '/Blog': '/blog', '/PrivacyPolicy': '/privacy',
  '/TermsOfService': '/terms', '/Home': '/', '/Dashboard': '/', '/LandingPage': '/',
};
export const resolveRedirect = (path, search = '', hash = '') => redirects[path] + search + hash;
