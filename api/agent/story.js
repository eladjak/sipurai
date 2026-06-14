/**
 * POST /api/agent/story
 *
 * Generate a complete children's story for an external agent. Returns the story
 * as structured JSON plus a ready-to-send Hebrew WhatsApp text block.
 *
 * Target use-case (Elad): an agent says "תכין סיפור על ארנב אמיץ ושלח לי בוואטסאפ" —
 * it calls this endpoint, gets `whatsappText`, and forwards it to the user's
 * WhatsApp / push channel. (Actual WhatsApp send is a separate, approved step.)
 *
 * Auth: Bearer SIPURAI_AGENT_KEY. Rate-limited per IP.
 *
 * Additive & side-effect free: no DB writes, no Clerk/RLS/migration changes, and
 * it reuses the SAME server-side GEMINI_API_KEY + text model as /api/ai/generate
 * without touching that route. The only network call is to Google's text API.
 */

import { verifyAgentRequest } from '../_lib/verifyAgentKey.js';

// ─── Constants (mirror /api/ai/generate.js) ──────────────────────────────────

const GEMINI_TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

const ALLOWED_LANGUAGES = ['he', 'en', 'yi'];
const LANGUAGE_LABEL = { he: 'עברית', en: 'אנגלית', yi: 'ייִדיש' };
const MAX_TOPIC_LENGTH = 500;

// ─── Simple in-memory rate limiter (per IP, resets every minute) ─────────────
// Same shape as /api/ai/generate.js. Story generation is heavier than the FAQ
// chat, so keep it tight (10/min/IP).

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
const ipHits = new Map(); // ip -> { count, windowStart }

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = ipHits.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    ipHits.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count += 1;
  return true;
}

// ─── Input validation (dependency-free; the project ships no zod) ─────────────

function validateBody(body) {
  const b = body || {};
  const errors = [];

  const topic = typeof b.topic === 'string' ? b.topic.trim() : '';
  if (!topic) errors.push('topic חובה (string לא ריק)');
  if (topic.length > MAX_TOPIC_LENGTH) errors.push(`topic ארוך מדי (מקסימום ${MAX_TOPIC_LENGTH} תווים)`);

  const childName =
    typeof b.childName === 'string' && b.childName.trim() ? b.childName.trim().slice(0, 60) : null;

  let age = 5;
  if (b.age !== undefined) {
    const n = Number(b.age);
    if (!Number.isFinite(n) || n < 3 || n > 10) errors.push('age חייב להיות בין 3 ל-10');
    else age = Math.round(n);
  }

  let language = 'he';
  if (b.language !== undefined) {
    if (!ALLOWED_LANGUAGES.includes(b.language)) errors.push('language חייב להיות he | en | yi');
    else language = b.language;
  }

  let pages = 6;
  if (b.pages !== undefined) {
    const n = Number(b.pages);
    if (!Number.isFinite(n) || n < 4 || n > 12) errors.push('pages חייב להיות בין 4 ל-12');
    else pages = Math.round(n);
  }

  const style = typeof b.style === 'string' && b.style.trim() ? b.style.trim().slice(0, 120) : null;

  return { errors, value: { topic, childName, age, language, pages, style } };
}

// ─── Gemini story generation (structured JSON output) ─────────────────────────

async function generateStory(apiKey, { topic, childName, age, language, pages }) {
  const langLabel = LANGUAGE_LABEL[language] || 'עברית';
  const heroLine = childName
    ? `הגיבור/ה של הסיפור הוא ${childName}.`
    : 'בחרו שם גיבור/ה מתאים בעצמכם.';

  const prompt = `אתה סופר ילדים מקצועי בפלטפורמת סיפוראי.
כתוב סיפור ילדים שלם בשפת ${langLabel}.
נושא: ${topic}.
${heroLine}
גיל יעד: ${age}.
מספר עמודים: בדיוק ${pages} (כל עמוד 2-4 משפטים).
חובה: תוכן בטוח, חם ומתאים לגיל. בלי אלימות, בלי פחד, בלי תוכן מפחיד.
החזר כותרת קצרה וקולעת + ${pages} עמודי טקסט.`;

  const responseSchema = {
    type: 'OBJECT',
    properties: {
      title: { type: 'STRING' },
      pages: {
        type: 'ARRAY',
        items: { type: 'STRING' },
      },
    },
    required: ['title', 'pages'],
  };

  const response = await fetch(`${GEMINI_BASE_URL}/${GEMINI_TEXT_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema,
        temperature: 0.8,
        maxOutputTokens: 2048,
        // Without a thinking budget, gemini-2.5-flash can burn the budget on
        // hidden reasoning and return an empty visible answer (see chat-faq.js).
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: { message: response.statusText } }));
    const error = new Error(`Story generation failed: ${err.error?.message || response.statusText}`);
    error.status = response.status >= 500 ? 502 : response.status;
    throw error;
  }

  const data = await response.json();
  if (data.candidates?.[0]?.finishReason === 'SAFETY') {
    const error = new Error('הסיפור נחסם ע"י מסנני הבטיחות. נסו נושא אחר.');
    error.status = 422;
    throw error;
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    const error = new Error('לא נוצר סיפור (תשובה ריקה מהמודל).');
    error.status = 502;
    throw error;
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const error = new Error('המודל החזיר JSON לא תקין. נסו שוב.');
    error.status = 502;
    throw error;
  }

  const title = typeof parsed.title === 'string' ? parsed.title.trim() : 'סיפור חדש';
  const pageTexts = Array.isArray(parsed.pages)
    ? parsed.pages.filter((p) => typeof p === 'string' && p.trim()).map((p) => p.trim())
    : [];

  return {
    title,
    language,
    pages: pageTexts.map((t, i) => ({ index: i + 1, text: t })),
  };
}

// ─── WhatsApp text builder ────────────────────────────────────────────────────

function buildWhatsAppText(story) {
  const header = `📖 *${story.title}*\n_סיפור שנוצר בסיפוראי_`;
  const body = story.pages.map((p) => `*עמוד ${p.index}*\n${p.text}`).join('\n\n');
  return `${header}\n\n${body}\n\n--- סיפוראי · sipurai.ai ---`;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // CORS — restrict to our domains (matches the /api/ai/* routes).
  const allowedOrigins = ['https://sipurai.ai', 'https://www.sipurai.ai', 'http://localhost:5173'];
  const origin = req.headers.origin;
  const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Auth (Bearer SIPURAI_AGENT_KEY, fail-closed)
  const auth = verifyAgentRequest(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  // 2. Rate limit
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'יותר מדי בקשות. נסו שוב עוד דקה.' });
  }

  // 3. API key configured?
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'שירות ה-AI אינו מוגדר (חסר GEMINI_API_KEY).' });
  }

  // 4. Validate body
  const { errors, value } = validateBody(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ error: 'פרמטרים לא תקינים', details: errors });
  }

  // 5. Generate
  try {
    const story = await generateStory(apiKey, value);
    if (story.pages.length === 0) {
      return res.status(502).json({ error: 'הסיפור נוצר ריק. נסו שוב.' });
    }
    const whatsappText = buildWhatsAppText(story);
    return res.status(200).json({
      story,
      whatsappText,
      meta: {
        requested: value,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'יצירת הסיפור נכשלה.' });
  }
}
