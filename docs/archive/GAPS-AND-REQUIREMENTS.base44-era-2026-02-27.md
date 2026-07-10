# Sipurai (סיפוראי) - Gaps & Requirements

**Last Updated:** 2026-02-27
**Purpose:** What Elad needs to provide so Claude Code can work with this Base44 project.

---

## RESOLVED: Entity Schemas (Reverse-Engineered from Code)

Base44 is **schemaless** - entities in the dashboard are empty by design.
The schemas below were extracted from actual code usage (create/update/filter/read calls).

### Book (20 fields)
| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Auto-generated |
| `title` | string | Book title |
| `description` | string | Short summary |
| `child_name` | string | Protagonist name |
| `child_age` | number | Default: 5 |
| `child_gender` | string | `"boy"` / `"girl"` / `"neutral"` |
| `genre` | string | `"adventure"`, `"fantasy"`, etc. |
| `age_range` | string | `"5-7"`, `"5-10"`, etc. |
| `tone` | string | `"exciting"`, etc. |
| `moral` | string | Moral/lesson |
| `length` | string | `"short"` / `"medium"` / `"long"` |
| `art_style` | string | `"disney"`, `"cartoon"`, etc. |
| `language` | string | `"english"` / `"hebrew"` / `"yiddish"` |
| `interests` | string | Child's interests (freeform) |
| `family_members` | string | Additional family (freeform) |
| `status` | string | `"draft"` / `"generating"` / `"complete"` |
| `cover_image` | string (URL) | Cover image |
| `childNames` | array[string] | All character names |
| `selectedCharacters` | array[object] | `{ name, age, gender, primary_image_url }` |
| `plot_points` | array[string] | Story plot beats |
| `character_development` | string | Character arc notes |
| `created_by` | string (email) | Auto-set by Base44 |

### Page (6 fields)
| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Auto-generated |
| `book_id` | string (FK -> Book) | Parent book |
| `page_number` | number | 0-based index |
| `text_content` | string | Story text |
| `image_url` | string (URL) | Illustration |
| `image_prompt` | string | Prompt used for image |
| `layout_type` | string | e.g. `"text-left"` |

### Character (9 fields)
| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Auto-generated |
| `name` | string | Required |
| `gender` | string | `"boy"` / `"girl"` / `"neutral"` |
| `age` | number | Default: 5 |
| `personality` | string | Required |
| `appearance` | string | Physical description, required |
| `art_style` | string | e.g. `"cartoon"` |
| `primary_image_url` | string (URL) | Portrait |
| `traits` | object | `{ bravery, kindness, curiosity, creativity }` (0-100) |

### StoryIdea (7 fields)
| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Auto-generated |
| `title` | string | Idea title |
| `description` | string | Brief description |
| `plot_points` | array[string] | 3-5 plot beats |
| `character_development` | string | Character arc |
| `moral_lesson` | string | Story lesson |
| `language` | string | `"english"` / `"hebrew"` / `"yiddish"` |
| `parameters` | string (JSON) | Serialized ideaParams |

### Community (11 fields)
| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Auto-generated |
| `book_id` | string (FK -> Book) | Shared book |
| `user_id` | string (FK -> User) | Who posted |
| `title` | string | Post title |
| `description` | string | Post body |
| `tags` | array[string] | e.g. `["adventure"]` |
| `visibility` | string | `"public"` |
| `likes` | number | Default: 0 |
| `is_featured` | boolean | Featured flag |
| `featured_date` | date | Sort key for featured |
| `created_date` | date | Auto-set |

### Comment (5 fields)
| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Auto-generated |
| `community_id` | string (FK -> Community) | Parent post |
| `user_id` | string (FK -> User) | Commenter |
| `content` | string | Comment text |
| `parent_id` | string/null | For threaded replies |
| `created_date` | date | Auto-set |

### Feedback (10 fields)
| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Auto-generated |
| `book_id` | string (FK -> Book) | |
| `page_id` | string (FK -> Page) | |
| `user_id` | string (FK -> User) | |
| `content` | string | Feedback text |
| `rating` | number | 1-5 stars |
| `feedback_type` | string | `"general"` / `"story"` / `"illustrations"` / `"language"` / `"age_appropriate"` |
| `is_suggestion` | boolean | |
| `privacy` | string | `"public"` / `"collaborators"` / `"private"` |
| `status` | string | `"pending"` / `"implemented"` |

### Collaboration (3 fields - minimal use)
| Field | Type | Notes |
|-------|------|-------|
| `book_id` | string (FK -> Book) | |
| `collaborator_email` | string | |
| `status` | string | `"accepted"` / `"pending"` / `"rejected"` |

### Revision - NO USAGE FOUND IN CODE (dead entity)

### User (via `base44.auth`)
| Field | Type | Notes |
|-------|------|-------|
| `id` | string | User ID |
| `email` | string | Used as ownership key |
| `full_name` | string | Display name |
| `language` | string | Preferred language |

### AI Integrations
**InvokeLLM:** `{ prompt: string, response_json_schema?: object }` -> string or JSON
**GenerateImage:** `{ prompt: string, model?: string, quality?: string, size?: string }` -> `{ url: string }`

---

## STILL OPEN - What I Need From You

### ~~1. Environment Variables~~ RESOLVED

`.env` file created with:
```env
VITE_BASE44_APP_ID=67d05d6e21a4eb95306dbd07
VITE_BASE44_BACKEND_URL=https://eyai-kids-playground-306dbd07.base44.app
```
- [x] `.env` file created with both values

---

### 2. Missing Entity: UserBadge (MEDIUM)

`UserBadge` exists in Base44 dashboard but has **no entity file** in the code.
The gamification system (Leaderboard, Profile) might need it.

**Questions:**
- Is UserBadge used? Should I create `src/entities/UserBadge.js`?
- What fields does it have? (badge_name, user_id, earned_date, etc.)

- [ ] Confirm whether UserBadge is needed

---

### 3. Dead Entity: Revision (LOW)

`Revision` has an entity file but is **never used** in any component.
Can I delete `src/entities/Revision.js` and remove from `src/entities/index.js`?

- [ ] Confirm Revision can be deleted

---

### 4. Auth Configuration (MEDIUM)

From the dashboard: **Public app + Require login to access**.

Still unknown:
| Question | Why It Matters |
|----------|---------------|
| Auth methods? (email/password, Google, etc.) | Login UI |
| User roles? (admin, parent, child) | Permissions |
| Guest/demo mode? | New visitor experience |

- [ ] Auth methods documented

---

### 5. AI Model Details (LOW - Nice to Have)

| Question | Why It Matters |
|----------|---------------|
| Which LLM model behind `InvokeLLM`? | Prompt optimization |
| Default image model for `GenerateImage`? | Some code uses `"gemini-3-pro-nano-banana"` explicitly |
| Rate limits per user? | `rateLimiter.js` config |
| Cost per call? | Dev budget awareness |

- [ ] AI model info provided

---

### ~~6. Deployment~~ PARTIALLY RESOLVED

| Question | Status |
|----------|--------|
| Production URL? | `https://eyai-kids-playground-306dbd07.base44.app` |
| Custom domain? | `sipurai.ai` (configured) |
| Email sender | `no-reply@base44-apps.com` (Sender: Sipurai App) |
| Vercel? | `vercel.json` exists but may be for local dev only - Base44 hosts the app |

- [x] Production URL confirmed
- [ ] Clarify: is Vercel used separately, or only Base44 hosting?

---

## Summary Checklist

| Priority | Item | Status |
|----------|------|--------|
| RESOLVED | Entity schemas (all 10) | Extracted from code |
| RESOLVED | Dashboard entity list | Screenshot received |
| RESOLVED | `.env` file (APP_ID + BACKEND_URL) | Created |
| MEDIUM | UserBadge entity - create or ignore? | Waiting |
| LOW | Revision entity - delete? | Waiting |
| MEDIUM | Auth methods | Waiting |
| LOW | AI model details | Waiting |
| RESOLVED | Deployment URL | `eyai-kids-playground-306dbd07.base44.app` |

---

*Generated by Claude Code on 2026-02-25. Entity schemas reverse-engineered from codebase.*
