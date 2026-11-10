# UX screenshot and acceptance harness

One command shoots a list of screens and checks them. Used by every UI contract of the UX overhaul as its evidence.

```
node scripts/ux/shoot.mjs --url http://localhost:4173 \
     --states scripts/ux/states.example.json --out /root/work/sipurai-tmp-xxxx/shots
```

| Flag | Meaning |
|---|---|
| `--url` | Base address of the running app (required). |
| `--states` | JSON file listing the screens to shoot (required). |
| `--out` | Folder for the PNGs and `report.json`; created if missing (required). |
| `--chromium <path>` | Use this Chromium. Needed on the server if the installed Playwright wants a build that is not there: `/root/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`. Also read from `UX_CHROMIUM`. |
| `--only a,b` | Only the states with these names. |
| `--report-only` | Always exit 0; still prints and writes every failure. |

Exit code: `0` all checks pass, `1` at least one check failed, `2` bad arguments or no browser.

It uses the repo's own `@playwright/test`; no dependency is added. It is headless, so it runs on the server with no display.

## Serving the app locally

```
bun run build
PORT=4173 node scripts/e2e-server.mjs &     # serves dist/ and the api/ handlers, no secrets needed
```

## What it produces

For every state, three PNGs (full page): `<name>-375.png` (375x812, device pixel ratio 2, touch), `<name>-1280.png` (1280x800) and `<name>-375-reduced.png` (375, `prefers-reduced-motion: reduce`). Plus one `report.json`. The script prints the list of files it wrote.

## States file

```json
[{
  "name": "home-empty",
  "path": "/",
  "setup": {
    "localStorage": { "key": "value" },
    "sessionStorage": { "key": "value" },
    "query": "?state=empty"
  },
  "actions": [{ "click": "[data-ux=help-quota]" }],
  "waitFor": "[data-ux=ready]"
}]
```

- `name`: letters, digits, `_ . -`; becomes the file name. Unique.
- `path`: starts with `/`. `setup.query` is appended to it.
- `setup.localStorage` / `sessionStorage`: written before the page's own scripts run (objects are stored as JSON). This is the only way to put the app into a state; there is no way to load a saved login.
- `waitFor`: a selector that must appear (10 s) before the checks run. If it never appears the shot fails.
- `actions`, run in order after `waitFor`:
  - `{ "click": sel }`, `{ "hover": sel }`, `{ "waitFor": sel }`
  - `{ "fill": sel, "value": "text" }`
  - `{ "press": "Enter" }` or `{ "press": "Tab", "on": sel }`
  - `{ "throttle": "slow-4g" }`: when it is the first action it applies from the first request (use it to see loading states); later it applies from that point on.
  - `{ "offline": true }` / `{ "offline": false }`: switch the network off or on at that point.

## Things to know

- **Entry splash.** The app plays a 2 s book-opening splash on the very first visit (flag `sipurai-entry-seen-v1` in localStorage). The example states set that flag so shots are of the page, not of the splash. The harness also waits (max 6 s) for finite animations to finish before measuring; endless loops are ignored.
- **Sign-in locally.** A local build has no Clerk key, so `/sign-in` shows the error screen ("SignIn can only be used within ClerkProvider"). Shoot sign-in on a preview deployment, signed out, not locally.
- **Fixed bars in full-page shots.** A fixed tab bar or header appears once, at the position where the viewport was, in a full-page PNG. That is how a full-page screenshot works, not a layout bug.
- **Contrast is measured from CSS, not from pixels.** Ancestor colours (with opacity) are composited; layers behind the text that are not ancestors (absolute background divs, `::before`/`::after`) are found by position, and if one of them is an image, a gradient, a photo or a video the text is counted under `skippedBackgroundImage` and not judged. Stacking order between sibling layers is not known (a solid layer is assumed to sit above the nearest opaque ancestor). Symbol-only text such as bullets is treated as decoration. Treat a contrast failure as a lead to confirm with the screenshot, and a skip as "look at it yourself".

## Safety

- Never loads cookies or a stored session.
- On `sipurai.ai` hosts it refuses to start if any state injects storage keys that look like a session (clerk, token, auth, session, supabase, jwt) or cookies. Production is for signed-out states only.

## How to read the report

`report.json` has `totals` and one entry per shot (state x viewport):

| Field | Look for |
|---|---|
| `finalUrl`, `status` | Did a redirect land where you expect? Anything 400 or above fails. |
| `lang`, `dir` | A Hebrew screen should say `he` / `rtl`. Recorded, not a failure by itself. |
| `scrollWidth` vs `clientWidth` | Larger scrollWidth means sideways scrolling. Fails. `failures` names up to 8 offending elements. |
| `smallTargets` | Interactive elements under 44x44: tag, accessible name, size. Fails. Skipped on purpose: disabled controls, 1px visually hidden inputs, and a plain inline link inside a sentence (WCAG 2.5.8 exception). |
| `contrast` | Text colour against the real background: below 4.5:1 for normal text, below 3:1 for text of 18px or more. Colours with opacity and transparent layers are composited. `skippedBackgroundImage` counts text sitting on an image or gradient: it cannot be measured honestly, so look at those by eye. |
| `imagesWithoutAlt` | `<img>` with no `alt` attribute (an empty `alt=""` is allowed, it means decorative), and `role=img` with no label. |
| `unnamedControls` | Icon-only buttons, links and inputs with no accessible name. |
| `consoleErrors` | Anything the page logged as an error or threw. |
| `failures` | The plain-language list; empty means the shot passes. `pass` is true when it is empty. |

The checks measure what a script can measure. They do not replace looking at the PNGs: open at least the 375 shot of every state.

## Files

`shoot.mjs` (the runner), `checks.mjs` (the in-page measurements and the pass/fail rules), `states.example.json` (signed-out pages of the app), this README.
