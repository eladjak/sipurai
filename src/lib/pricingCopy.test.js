import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const FORBIDDEN = ['להתמצאות', 'for reference', 'USD_TO_NIS'];

describe('pricing copy never promises approximate shekels', () => {
  for (const f of [
    'src/components/i18n/locales/he.jsx',
    'src/components/i18n/locales/en.jsx',
    'src/components/i18n/locales/yi.jsx',
    'src/data/termsContent.js',
  ]) {
    it(`${f} has no stale conversion wording`, () => {
      const text = read(f);
      for (const bad of FORBIDDEN) expect(text).not.toContain(bad);
    });
  }

  it('chat-faq prompt has no 3.65 conversion and no approximate shekels', () => {
    const text = read('api/chat-faq.js');
    expect(text).not.toContain('3.65');
    expect(text).not.toContain('~₪');
    expect(text).toContain('14.90 ₪');
    expect(text).toContain('39 ₪');
  });

  it('terms keep existing subscribers billed as on their receipt', () => {
    expect(read('src/data/termsContent.js')).toContain('מנוי שהצטרף לפני המעבר לשקלים ממשיך להיות מחויב כפי שהופיע בקבלה שלו, עד שיבטל.');
  });
});
