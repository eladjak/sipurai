import { request } from 'node:https';
import { createDailyQualitySnapshot } from './daily-quality.mjs';

const origin = 'https://www.sipurai.ai';
const probes = [
  ['home', '/', 'text/html'],
  ['sample', '/samples/demo-dragons-garden', 'text/html'],
  ['storybookArt', '/images/spx/styles/storybook.webp', 'image/webp'],
];
const MAX_HEADER_BYTES = 8192;
const REQUEST_TIMEOUT_MS = 5_000;

export function israelDay(now) {
  const fields = Object.fromEntries(new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now).map(({ type, value }) => [type, value]));
  return `${fields.year}-${fields.month}-${fields.day}`;
}

function head(url) {
  return new Promise((resolve, reject) => {
    const outbound = request(url, {
      method: 'HEAD',
      maxHeaderSize: MAX_HEADER_BYTES,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      agent: false,
      headers: { Accept: '*/*', 'User-Agent': 'SipuraiQualityPilot/1' },
    }, response => {
      // Inspect headers only. No redirects, page scripts, cookies or response bodies.
      resolve({ status: response.statusCode, contentType: response.headers['content-type'] });
      response.destroy();
    });
    outbound.on('error', reject);
    outbound.end();
  });
}

async function inspect(transport, path, expected) {
  try {
    const reply = await transport(new URL(path, origin));
    const status = Number.isInteger(reply?.status) && reply.status >= 100 && reply.status <= 599 ? reply.status : null;
    const mimeMatches = typeof reply?.contentType === 'string'
      ? reply.contentType.split(';', 1)[0].trim().toLowerCase() === expected : null;
    return { status, mimeMatches, reachable: status === null ? null : status === 200 && mimeMatches === true, issue: null };
  } catch (error) {
    const issue = error?.code === 'HPE_HEADER_OVERFLOW' ? 'header_budget'
      : error?.name === 'AbortError' ? 'timeout' : 'transport';
    return { status: null, mimeMatches: null, reachable: null, issue };
  }
}

export async function runPublicQualityPilot({ enabled, reserve, publish, now = new Date(), transport = head }) {
  if (!enabled()) return 'disabled';
  const day = israelDay(now);
  if (!await reserve(day)) return 'claimed';

  const results = {};
  for (const [key, path, expected] of probes) {
    if (!enabled()) return 'disabled';
    results[key] = await inspect(transport, path, expected);
  }
  if (!enabled()) return 'disabled';

  const snapshot = {
    ...createDailyQualitySnapshot({ schemaVersion: 1, day, current: {} }),
    source: 'public_route_probe',
    publicProbe: { method: 'HEAD', results },
  };
  return await publish(day, snapshot) ? 'written' : 'disabled';
}
