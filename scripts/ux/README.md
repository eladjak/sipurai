# UX screenshot and acceptance harness

One command shoots a list of screens and checks them. Used by every UI contract of the UX overhaul as its evidence.

```
node scripts/ux/shoot.mjs --url http://localhost:4173 \
     --states scripts/ux/states.example.json --out /root/work/sipurai-tmp-xxxx/shots
node scripts/ux/shoot.mjs --self-test      # proves every check and every guard, see below
```

| Flag | Meaning |
|---|---|
| `--url` | Base address of the running app (required). |
| `--states` | JSON file listing the screens to shoot (required). |
| `--out` | Folder for the PNGs and `report.json` (required). Created if missing. A non-empty folder is refused unless `--overwrite`. |
| `--overwrite` | Allow writing into a non-empty `--out` (only the files this run produces are replaced). |
| `--allow-host a,b` | Non-local hosts (a preview deployment) that may receive credential-like state. Never a production host. |
| `--chromium <path>` | Use this Chromium, e.g. `/root/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`. Also read from `UX_CHROMIUM`. **Trusted operator input**: it is executed. |
| `--only a,b` | Only the states with these names. |
| `--report-only` | Exit 0 even when checks fail; fatal errors and refusals still exit 2. |
| `--self-test` | Run the built-in fixtures and guard cases (no app, no network). Exit 1 if any behaves unexpectedly. |

Exit code: `0` no check failed, `1` at least one check failed, `2` bad arguments, refused run, or no browser. It uses the repo's own `@playwright/test`; no dependency is added.

## Serving the app locally

```
bun run build
PORT=4173 node scripts/e2e-server.mjs &
```

## Output

Per state, three full-page PNGs: `<name>-375.png` (375x812, DPR 2, touch), `<name>-1280.png`, `<name>-375-reduced.png` (reduced motion), plus `report.json`. The script prints every file it wrote. Each shot gets a verdict:

- `PASS`: no check failed and every text node could be judged.
- `FAIL`: at least one check failed (this is what makes the exit code 1).
- `REVIEW` (`needs-human-eye`): nothing failed, but some text could not be judged. It is **never** counted as a pass; look at the PNG.

## States file

```json
[{
  "name": "home-empty",
  "path": "/",
  "setup": { "localStorage": { "key": "value" }, "sessionStorage": {}, "query": "?state=empty" },
  "actions": [{ "click": "[data-ux=help-quota]" }],
  "waitFor": "[data-ux=ready]"
}]
```

- `name`: starts with a letter, digit or `_`; then letters, digits, `_ . -`; no `..`. Becomes the file name. Unique.
- `path`: a plain absolute path (`/x`). `//host`, backslashes and `scheme:` are refused; it must resolve to the base origin.
- `setup.localStorage` / `sessionStorage`: written before the page's scripts run, on the base origin only (objects stored as JSON). There is no way to load a saved login, cookies or headers.
- `waitFor`: a selector that must appear (10 s) before the checks run.
- `actions`, in order after `waitFor`: `{ "click": sel }`, `{ "hover": sel }`, `{ "waitFor": sel }`, `{ "fill": sel, "value": "x" }`, `{ "press": "Enter" }` / `{ "press": "Tab", "on": sel }`, `{ "throttle": "slow-4g" }` (first action: from the first request), `{ "offline": true|false }`.

## Security policy

All decisions use the parsed hostname, never a substring (`sipurai.ai.evil.com` and `notsipurai.ai` are not production).

1. **Production** is `sipurai.ai` and every subdomain. A run against production is refused if there is ANY credential-like input: any localStorage/sessionStorage entry (whatever the key), cookies, headers, a `fill` action, URL userinfo, a credential-like query parameter or a credential-like option (`--cookie`, `--header`, `--storage-state`, `--auth-*`...). Signed-out shots only.
2. Credential-like input is refused for every host except `localhost`, `127.0.0.1`, `::1` and hosts passed with `--allow-host`.
3. A run that carries such input aborts **every** request, redirect and frame to a production host (listed under `blockedRequests` in the report, not counted as page errors). Storage is injected only on the base origin.
4. **Output**: only inside the real path of `--out`; file names are validated; files are created exclusively and refuse symlinks; a symlinked `--out` is refused.
5. `--chromium` and the states file are trusted operator input. Never run an untrusted browser binary or states file.

## What each check claims

| Check | Claim, and its limits |
|---|---|
| Overflow | The **document** scrolls sideways (`scrollWidth > clientWidth`, on `html` or `body`). The widest offending elements are listed. Content clipped by `overflow-x:hidden` on the root is not seen. |
| Touch target | The element's hit area is at least **44x44 CSS px**: border box including padding; a wrapped inline element uses its largest line box; a form control may use its label. This is the project rule (WCAG 2.5.5, AAA), not the AA minimum (2.5.8). Exempt: a link inside a sentence (WCAG inline exception: the surrounding text holds at least two words outside any control, so a row of nav links is NOT exempt), disabled controls, and truly visually-hidden helpers (clipped `sr-only`). A visible 1px-wide button is a target. |
| Contrast | WCAG 1.4.3. Large text is **24px regular or 18.66px bold** (3:1); everything else 4.5:1. Judged from computed CSS colours: ancestor backgrounds are composited, text, form values and placeholders included. If the real background cannot be established from CSS (an image or gradient, a photo or video, any other layer overlapping the text, a coloured ancestor pseudo-element, partial group opacity) or the text is generated by `::before/::after`, the node is reported under `contrast.needsHumanEye` (count and list), not judged and **not counted as passing**. A passing report is not a conformance claim. |
| Alt | Visible `<img>` with no `alt` attribute (`alt=""` = decorative, allowed); `role=img` with no label. |
| Names | Visible links, buttons and inputs with no accessible name (aria-label/labelledby, label, text, image alt, svg title, title). |
| Console | Anything logged as an error or thrown (except requests this harness blocked on purpose). |

## Proof that the checks work: `--self-test`

For every check there is a tiny fixture page with a known pass and a known fail (for example 30x30 and 1px-wide buttons fail, 48px and padded links pass; 20px regular `#8c8c8c` fails at 3.36:1 against 4.5, the same grey at 24px passes; text on a gradient is "needs human eye"; a 900px box overflows). It also exercises the production and credential guard and the output boundary (traversal names, symlinked `report.json`, symlinked `--out`, non-empty directory). It prints one PASS/FAIL line per case.

## Things to know

- **Entry splash.** The app plays a 2 s splash on the first visit (localStorage `sipurai-entry-seen-v1`). The example states set that flag; the harness also waits up to 6 s for finite animations to finish.
- **Sign-in locally.** A local build has no Clerk key, so `/sign-in` shows the error screen. Shoot sign-in on a preview deployment, signed out.
- **Fixed bars in full-page shots** appear once, where the viewport was; that is how a full-page PNG works.
- Read the PNGs. The checks measure what a script can measure.

## Reading `report.json`

`totals` (pass / fail / needsHumanEye / textNodesNeedingHumanEye) and one entry per shot: `finalUrl`, `status`, `lang`, `dir`, `scrollWidth`/`clientWidth`, `overflowOffenders`, `smallTargets` (tag, name, size), `contrast` (`checked`, `passed`, `failures`, `needsHumanEye`), `imagesWithoutAlt`, `unnamedControls`, `consoleErrors`, `blockedRequests`, `failures`, `verdict`.
