// Prints every skipped test together with WHY it was skipped, and (in GitHub Actions) puts the same
// list into the job summary. A skipped test must never look like a green one.
import { appendFileSync } from 'node:fs';

export default class SkipReasons {
  constructor() {
    this.skipped = [];
    this.counts = { passed: 0, failed: 0, skipped: 0 };
  }
  onTestEnd(test, result) {
    if (result.status === 'skipped') {
      const note = test.annotations.find((a) => a.type === 'skip');
      this.skipped.push({ title: test.titlePath().slice(1).join(' > '), reason: note?.description || 'no reason given' });
      this.counts.skipped += 1;
    } else if (result.status === 'passed') this.counts.passed += 1;
    else this.counts.failed += 1;
  }
  onEnd() {
    const lines = [];
    if (this.skipped.length) {
      lines.push(`SKIPPED ${this.skipped.length} test(s), NOT passed:`);
      for (const s of this.skipped) lines.push(`  - ${s.title}\n      ${s.reason}`);
    }
    if (lines.length) console.log(`\n${lines.join('\n')}\n`);
    const file = process.env.GITHUB_STEP_SUMMARY;
    if (file) {
      const md = [`### E2E result`, `passed ${this.counts.passed} · failed ${this.counts.failed} · skipped ${this.counts.skipped}`];
      if (this.skipped.length) {
        md.push('', '**Skipped (these did NOT run and are NOT green):**');
        for (const s of this.skipped) md.push(`- ${s.title}: ${s.reason}`);
      }
      try {
        appendFileSync(file, md.join('\n') + '\n');
      } catch {
        /* summary is a convenience */
      }
    }
  }
}
