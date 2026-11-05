# Sipurai lifecycle review, round 4

Reviewed commit: d717b00. Baseline: origin/main. Date: 2026-11-04.

Scope: introduced blockers only; lifecycle fallback, secret exposure, story generation, and the four round-3 fixes. No product edits, paid provider probes, deployment, or publication.

Executed verification:
- Five added test files: 54 tests passed.
- bookGeneration, bookProgress, smartModelPicker, useBook: 58 tests passed.
- check-api-modules: all 10 modules parsed.
- Vite production build exited 0; .Codex/round4-build/index.html was generated (20196 bytes).
- thinking-control.mjs: the flash-override assertion failed on HEAD^ and passed on HEAD; default pro options were preserved in both revisions. Fetch was mocked; no upstream call.

The initial bare `npm run build` resolved through C:/Windows/system32/npm and emitted no output; this was NOT counted as build evidence. The actual verification ran Node against scripts/check-api-modules.mjs and node_modules/vite/bin/vite.js explicitly.

Delegation: backend review and frontend negative-control packets requested gpt-5.6-luna through explicit model routing. Both workers self-reported the generic model name GPT-5; no independent provider model identifier is exposed, so the precise executed model is unverified. Token/account usage and monetary cost are not exposed and were not measured. Lead owns synthesis and final blocking decision.

Independent frontend controls completed: .Codex/round4-frontend/run-negative-controls.mjs runs the same three tests on copied HEAD^ and HEAD snapshots. All three fail on HEAD^ and pass on HEAD: cancellation of active browser fallback, browser-failure notice, and stable auto-narrate effect during TTS state changes. The BookView control extracts its exact memo/effect code rather than mounting the complete page. Product files were not modified.

Independent backend review found no introduced blockers. Current official Google model and speech-generation documentation supports the replacement model names and legacy TTS request shape. The worker's separate npm test command produced no usable output, so it is not counted as a second test run. The authoritative completed test executions above used direct Node invocation.

Final review decision: SHIP. No introduced blocking issue reproduced. Four round-3 fixes have paired before/after controls, and 112 existing/added targeted tests passed. This is a code-review verdict, not production acceptance.

Limits: no paid model calls, no live voice playback, and no 375px screenshots. Unit tests and production bundling are local evidence, not deployed/human acceptance.

Nonblocking pre-existing accessibility observations for the required checklist: speed buttons/auto toggle/engine selector use h-7, below the 44px target; the new dismiss button uses h-11/w-11 and has a label, and the new notice uses role=status and logical end positioning.
