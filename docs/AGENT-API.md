# Sipurai — Agent API (`/api/agent/*`)

The **second front door** to Sipurai. Lets an external agent (Kami / Box /
Solis / any Claude / OpenClaw) command the app by voice or text — e.g.
*"תכין סיפור על ארנב אמיץ ושלח לי בוואטסאפ"* — without anyone opening the UI.

> Status: Phase 1 (generate a story). Implemented 2026-06-14 on branch
> `feat/agent-api-2026-06-14`. Mirrors the reference pattern in
> `bayit-beseder/docs/AGENT-API.md`.
>
> **Additive & non-invasive:** these are brand-new serverless functions
> (`api/agent/*.js` + `api/_lib/verifyAgentKey.js`). They do **not** touch the
> existing `/api/ai/*`, `/api/payments/*`, or `/api/webhooks/*` routes, the
> Clerk auth, the Supabase RLS, or any migration. No DB writes.

---

## Stack note

Sipurai is **Vite + React (JSX)**, deployed on Vercel; its backend is a set of
**Vercel serverless functions** under `api/` (`export default function handler(req, res)`),
not Next.js route handlers. The Agent API follows that same convention.

## Authentication

Every `/api/agent/*` request requires a bearer token:

```
Authorization: Bearer <SIPURAI_AGENT_KEY>
```

- The key is read **only** from the environment (`SIPURAI_AGENT_KEY`). There is
  no hardcoded default, and the API **fails closed** (HTTP 503) when the key is
  unset.
- `AGENT_API_TOKEN` is accepted as a documented alias; `SIPURAI_AGENT_KEY` wins.
- Comparison is constant-time (`crypto.timingSafeEqual`).
- This token is **separate** from the Clerk session JWT used by the human-facing
  `/api/ai/*` routes — an external agent has no Clerk session.

Generate a key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Set it in the Vercel project settings (or `.env` for local) as `SIPURAI_AGENT_KEY`.

### Error responses

| Status | Meaning |
|-------:|---------|
| 401 | Missing `Authorization: Bearer` header |
| 403 | Wrong token |
| 503 | `SIPURAI_AGENT_KEY` not configured on the server (API disabled) |
| 429 | Rate limit exceeded (10/min for `story`, per IP) |
| 400 | Invalid params |
| 422 | Content blocked by safety filters |
| 500 | `GEMINI_API_KEY` not configured |

---

## Endpoints

### `GET /api/agent/capabilities`

Self-describing manifest. An agent reads this once to learn the available
actions, params, and auth scheme.

```bash
curl -s https://sipurai.ai/api/agent/capabilities \
  -H "Authorization: Bearer $SIPURAI_AGENT_KEY"
```

Returns a JSON manifest: `{ name, description, version, auth, actions[], sendChannel }`.

---

### `POST /api/agent/story`

Generate a complete children's story. Returns the story as JSON **plus a
ready-to-send Hebrew WhatsApp text block** (`whatsappText`).

**Body:**

| Field | Type | Notes |
|-------|------|-------|
| `topic` | `string` (**required**) | Story subject, e.g. `"ארנב אמיץ שמגלה אומץ"`. Max 500 chars. |
| `childName` | `string` (optional) | Name of the child to make the hero. |
| `age` | `number` (optional) | Target age 3–10. Default `5`. |
| `language` | `string` (optional) | `"he"` \| `"en"` \| `"yi"`. Default `"he"`. |
| `pages` | `number` (optional) | Number of pages 4–12. Default `6`. |
| `style` | `string` (optional) | Free-text illustration style hint (reserved for future image wiring). |

```bash
curl -s -X POST https://sipurai.ai/api/agent/story \
  -H "Authorization: Bearer $SIPURAI_AGENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"topic":"ארנב אמיץ שמגלה אומץ","childName":"נועה","age":5,"pages":6}'
```

**Response:**

```jsonc
{
  "story": {
    "title": "נועה והארנב האמיץ",
    "language": "he",
    "pages": [
      { "index": 1, "text": "פעם אחת, בכפר קטן…" },
      { "index": 2, "text": "נועה פגשה ארנב לבן…" }
    ]
  },
  "whatsappText": "📖 *נועה והארנב האמיץ*\n…",
  "meta": { "requested": { "topic": "…", "age": 5, "language": "he", "pages": 6 }, "generatedAt": "…" }
}
```

Story generation performs **no DB writes** and has no side effects — it only
calls Google's text model (the same server-side `GEMINI_API_KEY` the existing
`/api/ai/generate` route uses).

---

## Example flow: external agent → generate story → send to WhatsApp

```bash
# 1. Agent generates the story
RESP=$(curl -s -X POST https://sipurai.ai/api/agent/story \
  -H "Authorization: Bearer $SIPURAI_AGENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"topic":"דרקון ידידותי שלומד לחלוק","childName":"איתי"}')

# 2. Agent extracts the ready-to-send block
TEXT=$(echo "$RESP" | jq -r '.whatsappText')

# 3. Agent forwards it to the user's WhatsApp via its OWN channel
#    (Sipurai does NOT send WhatsApp itself — see below.)
```

The Agent API deliberately **does not send WhatsApp itself** — sending is a
separate, approved step. `whatsappText` is produced for the calling agent to
forward to its own outbound channel:

```jsonc
POST https://my-agent.example.com/outbound
{
  "channel": "whatsapp",
  "to": "+972501234567",
  "text": "<story.whatsappText verbatim>"
}
```

> ⚠️ **Not wired here:** no real WhatsApp send is triggered by the Agent API.

---

## What Elad needs to do

1. **Set `SIPURAI_AGENT_KEY`** in the Vercel project (and `.env` for local).
   Until it's set the endpoints return 503 (fail-closed). Generate with the
   `node -e` snippet above.
2. **Approve the WhatsApp send path** — decide which channel forwards
   `whatsappText` (Kami / a webhook). No send is wired yet.
3. **Merge the branch** `feat/agent-api-2026-06-14` after review.

## Security summary

- Bearer `SIPURAI_AGENT_KEY`, env-only, fail-closed (503), constant-time compare.
- Per-IP in-memory rate limiting (10/min on `story`).
- Input validation on every field.
- No hardcoded secrets; reuses the existing server-side `GEMINI_API_KEY`.
- Additive: no existing route, auth, RLS, or migration is changed; no DB writes.
