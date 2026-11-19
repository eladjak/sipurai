import { createDailyQualitySnapshot } from './daily-quality.mjs';

// Fixed, reviewable instructions only. Never copy input text into a work item.
const contracts = Object.freeze({
  repair_smoke_path: ['Restore the offline smoke path', 'Reproduce the smoke failure; run the offline smoke path successfully.', 'Revert the smoke-path change and rerun the prior test.'],
  recover_stuck_generation: ['Investigate stalled generation', 'Reproduce a stalled test run; prove safe recovery and no duplicate work.', 'Revert the recovery change; retain existing saved runs.'],
  repair_missing_illustrations: ['Investigate missing illustration recovery', 'Reproduce missing art with a fixture; prove recovery without overwriting existing art.', 'Revert the illustration recovery change.'],
  fix_illustration_failures: ['Investigate illustration failures', 'Reproduce an illustration failure offline; verify safe retry behavior.', 'Revert the illustration change.'],
  review_face_overlap: ['Investigate text covering faces', 'Verify placement against an authorized sample and an offline regression.', 'Revert the text placement change.'],
  review_text_overflow: ['Investigate text overflow', 'Verify the affected trim size on an authorized sample and an offline regression.', 'Revert the layout change.'],
  review_visual_quality: ['Investigate visual quality', 'Reproduce the issue on an authorized sample and document a visual comparison.', 'Revert the presentation change.'],
  investigate_recurring_errors: ['Investigate recurring errors', 'Reproduce the repeated failure with test data and add a regression.', 'Revert the local fix.'],
});

/** Consume only validated aggregate input, never a caller-provided proposal. */
export function createCorrectiveWork(input) {
  const snapshot = createDailyQualitySnapshot(input);
  const proposal = snapshot.proposal;
  const work = proposal && contracts[proposal.code];
  if (proposal && !work) throw new Error('unsupported_proposal');
  return {
    schemaVersion: 1, day: snapshot.day, source: snapshot.source,
    budget: { maxItems: 1, paidCalls: 0, writes: 0 },
    item: work ? { code: proposal.code, severity: proposal.severity, evidence: proposal.evidence,
      title: work[0], acceptance: work[1], rollback: work[2], execution: 'human_review_required' } : null,
  };
}
