// Test inventory: extend the signatures when a new processor is introduced.
export const processors = ['Clerk', 'Supabase', 'Vercel', 'Google', 'OpenAI', 'Creem', 'Morning', 'BookPod', 'Sentry', 'Umami', 'Sanity', 'Google Fonts', 'jsDelivr', 'Cloudflare'];

const known = [
  { name: 'Clerk', sdk: /^@clerk\//, hosts: ['clerk.com'] },
  { name: 'Supabase', sdk: /^@supabase\//, hosts: ['supabase.co', 'supabase.com'] },
  { name: 'Google', sdk: /^(@google\/generative-ai|@google\/genai)$/, hosts: ['generativelanguage.googleapis.com'] },
  { name: 'Google Fonts', hosts: ['fonts.googleapis.com', 'fonts.gstatic.com'] },
  { name: 'OpenAI', sdk: /^openai$/, hosts: ['openai.com'] },
  { name: 'Sentry', sdk: /^@sentry\//, hosts: ['sentry.io'] },
  { name: 'Sanity', sdk: /^@sanity\//, hosts: ['sanity.io'] },
  { name: 'Umami', sdk: /^@umami\//, hosts: ['umami.is'] },
  { name: 'PostHog', sdk: /^(posthog-js|posthog-node)$/, hosts: ['posthog.com', 'posthog.co'] },
  { name: 'Segment', sdk: /^@segment\//, hosts: ['segment.com', 'segment.io'] },
  { name: 'Vercel', sdk: /^@vercel\/(analytics|speed-insights)$/, hosts: ['vercel-insights.com'] },
  { name: 'Creem', sdk: /^creem$/, hosts: ['creem.io'] },
  { name: 'jsDelivr', hosts: ['cdn.jsdelivr.net', 'jsdelivr.net'] },
  { name: 'Cloudflare', hosts: ['challenges.cloudflare.com'] },
];

export function missingProcessors(pkg, html, policy) {
  const dependencies = Object.keys(pkg.dependencies || {});
  const hosts = [...html.matchAll(/https?:\/\/([^\s/"'<>?#]+)/gi)].map((match) => match[1].toLowerCase().split(':')[0]);
  return known.filter(({ name, sdk, hosts: domains = [] }) =>
    (dependencies.some((dep) => sdk?.test(dep)) || hosts.some((host) => domains.some((domain) => host === domain || host.endsWith('.' + domain)))) && !policy.includes(name)
  ).map(({ name }) => name);
}
