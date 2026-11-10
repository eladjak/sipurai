# Rules every contract inherits

Read this before your contract. Your contract wins where it is more specific.

## Where you work
- Your own git worktree on the server: `git -C /root/work/sipurai-ux-49eb82ff worktree add /root/work/sipurai-<contract-id>-<random> -b ux/<contract-id> origin/main`. Install with `bun install` inside it. Never work in the planning clone, never in `/root/work/sipurai-dash-*`.
- Private temp folder only: `mktemp -d /root/work/sipurai-tmp-XXXX`. Never `/tmp/msg.txt`-style shared paths, never `git commit -F <shared path>`; use `git commit -m`.
- Foreground commands with a `timeout`. No builds or browsers on the owner's PC.
- **Node on the server:** the system `node` is v18; use `/opt/node22/bin/node` (v22.11.0): `export PATH=/opt/node22/bin:$PATH`. With that version **Vitest needs** `NODE_OPTIONS=--experimental-require-module`, e.g. `NODE_OPTIONS=--experimental-require-module npx vitest run`. Say in your evidence which node ran the tests.
- **The language audit tool is not in the repository yet.** The planning copy (`/root/work/sipurai-ux-plan/tools/i18n-audit.mjs`) borrows Babel from another checkout and cannot run from a fresh clone. Contract I-02 commits it as `scripts/i18n-audit.mjs` with its dependencies declared (added to `package.json` by P1-02). Until I-02 merges, run the planning copy with `NODE_PATH=/root/work/sipurai-dash-1179515851/node_modules` and say so; after it merges, `node scripts/i18n-audit.mjs` only. Never copy the tool into a file you do not own.

## What you may touch
- **Only the files listed under "Owned files" in your contract.** Creating a file not listed, or editing any other file, is out of contract: stop and report.
- Locale text: never edit `src/components/i18n/locales/he.jsx`, `en.jsx` or `yi.jsx` unless your contract owns them. New strings go into your own **locale fragment** `src/components/i18n/locales/he/<area>.js` and `en/<area>.js` (format below). Yiddish fragments are owned by I-04b only.
- `package.json`, `bun.lock` and `package-lock.json` are owned by P1-02 only.

## Locale fragment format (merged by the provider, contract I-01)
```js
// src/components/i18n/locales/he/<area>.js
export default {
  <namespace>: {            // one top-level namespace per fragment, not present in he.jsx/en.jsx
    someKey: "טקסט בעברית",
  },
};
```
Use it as `t("<namespace>.someKey")`. Hebrew is the source; English is a faithful translation; no jargon.
**Hebrew punctuation goes at the end of the string as typed in the file** (`"ברוכים הבאים!"`, never `"!ברוכים הבאים"`): a string typed in a left-to-right editor often comes out reversed. `scripts/i18n-punctuation.mjs` (I-02) flags it. Keys are called with the path they really have in the file (the code calling `t("welcome.title")` while the file has `onboarding.welcome.title` shows a raw key).

## The switch
`import { isNewShell } from "@/lib/flags"` (contract P1-01). Anything new that a person could see renders only when `isNewShell()` is true. With the switch off, production must not change: no new style, font download, route, string or network request.

## Design rules
- Tokens and their names: `docs/ux-overhaul/DESIGN-DIRECTION.md` (the `--sp-*` table). Use Tailwind `sp-*` classes or `var(--sp-*)`; never raw hex, never `gray-*`/`purple-*` utilities, never gradients except the night radial glow.
- Logical properties only (`ms-/me-/ps-/pe-/start-/end-`, `text-start`); no `flex-row-reverse`, no `isRTL ? "left" : "right"`.
- Every interactive element: hover, active, `:focus-visible`; target at least 44x44; Lucide icons only, `aria-hidden` on decorative icons, Hebrew `aria-label` on icon-only buttons (from your fragment).
- Motion: transform and opacity only, at most 200ms for feedback, `motion-safe:`/reduced-motion respected.
- Skills to load before building UI: `ux-standard`, `wow-ui-standard`, `impeccable:impeccable` (audit mode). Name them in your report.

## Evidence you must return (in the PR description and your final message)
1. `git diff --stat` against `origin/main`, showing only owned files.
2. Test output with the **count** of tests run, and for each new test the **red run** you saw before the code made it green (paste the failure line).
3. `bun run build` result, and `node scripts/check-types.mjs` showing the error count is not above 295.
4. For anything visible: screenshots from `node scripts/ux/shoot.mjs` (contract P1-00) at 375 and 1280 for every state listed in your contract, the script's JSON report (overflow, small targets, contrast), and one line per screenshot saying what you saw when you looked at it.
5. The wow checklist from DESIGN-DIRECTION.md, item by item, with ✓/✗ and a reason for each ✗.
6. Anything you could not verify, named.

## Not allowed
Merging, pushing to `main`, deploying, changing Vercel or Clerk settings, creating accounts, sending anything to anyone, printing secrets, adding a dependency (except P1-02), editing files you do not own, deleting tests.

## Stop conditions
- Two failed attempts at the same step: stop, return what you tried, the exact error, and what you think is wrong.
- A needed change is in a file you do not own: stop and report which file and why.
- Your change would alter what production users see while the switch is off (phase 1 contracts): stop and report.
