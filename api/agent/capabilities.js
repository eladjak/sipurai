/**
 * GET /api/agent/capabilities
 *
 * Self-describing manifest of what Sipurai can do for an external agent.
 * An agent (Kami / Box / Solis / any Claude / OpenClaw) reads this once to
 * learn the available actions, their params, and the auth scheme — then
 * drives the app.
 *
 * Auth: Bearer SIPURAI_AGENT_KEY (same as all /api/agent/* endpoints).
 *
 * Additive, read-only: performs no DB writes and touches no existing route.
 */

import { verifyAgentRequest } from '../_lib/verifyAgentKey.js';

export default function handler(req, res) {
  // CORS — restrict to our domains (matches the /api/ai/* routes).
  const allowedOrigins = ['https://sipurai.ai', 'https://www.sipurai.ai', 'http://localhost:5173'];
  const origin = req.headers.origin;
  const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = verifyAgentRequest(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  return res.status(200).json({
    name: 'סיפוראי (Sipurai)',
    description:
      'פלטפורמת AI ליצירת ספרי ילדים מותאמים אישית בעברית. ממשק הסוכנים מאפשר לסוכן חיצוני לייצר סיפור ילדים שלם ולהחזירו כ-JSON + טקסט מוכן לשליחה ב-WhatsApp.',
    version: '1.0.0',
    auth: {
      scheme: 'Bearer',
      header: 'Authorization: Bearer <SIPURAI_AGENT_KEY>',
      note: 'המפתח מוגדר בסביבת השרת בלבד (SIPURAI_AGENT_KEY). אין מפתח ברירת מחדל. הממשק נכשל-סגור (503) אם לא הוגדר.',
    },
    actions: [
      {
        id: 'generate_story',
        method: 'POST',
        path: '/api/agent/story',
        summary:
          'ייצור סיפור ילדים שלם (כותרת + עמודים) בעברית/אנגלית/ייִדיש לפי נושא, גיל ודמות, והחזרתו כ-JSON + בלוק טקסט מוכן לשליחה ב-WhatsApp.',
        params: {
          topic: 'string (חובה) — נושא הסיפור, למשל "ארנב אמיץ שמגלה אומץ".',
          childName: 'string (אופציונלי) — שם הילד/ה שיהיה הגיבור/ה.',
          age: 'number (אופציונלי) — גיל היעד (3–10). ברירת מחדל: 5.',
          language: 'string (אופציונלי) — "he" | "en" | "yi". ברירת מחדל: "he".',
          pages: 'number (אופציונלי) — מספר עמודים (4–12). ברירת מחדל: 6.',
          style: 'string (אופציונלי) — סגנון איור מבוקש (טקסט חופשי, לשילוב עתידי).',
        },
        returns:
          '{ story: { title, language, pages: [{ index, text }] }, whatsappText: string } — whatsappText מוכן להעברה לערוץ הודעות.',
      },
    ],
    sendChannel: {
      note: 'הסוכן אמור לקחת את whatsappText ולהעבירו לערוץ ההודעות שלו. סיפוראי אינו שולח WhatsApp בעצמו — השליחה היא שלב נפרד ומאושר.',
    },
  });
}
