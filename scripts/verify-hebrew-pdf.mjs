/**
 * verify-hebrew-pdf.mjs — offline proof that the Hebrew PDF export pipeline
 * (Heebo TTF embedding + UAX#9 visual reordering) produces readable Hebrew.
 *
 * Mirrors the exact drawing path of src/utils/pdfExporter.js (font VFS +
 * splitTextToSize + linesToVisualRTL + right-align) without the browser-only
 * parts (fetch/Image/save). Writes out/hebrew-pdf-proof.pdf for visual review.
 *
 * Run: node scripts/verify-hebrew-pdf.mjs
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jsPDF } from 'jspdf';
import { linesToVisualRTL, containsHebrew, arrayBufferToBase64 } from '../src/utils/hebrewText.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const book = {
  title: 'הגן הסודי של הדרקון',
  child_name: 'דניאל',
  language: 'hebrew',
  description: 'סיפור על אומץ, חברות (וגם דרקון אחד קטן) — נוצר בסיפוראי',
};
const pages = [
  {
    text_content:
      'בוקר אחד גילה דניאל שביל מוזר בקצה הגינה. השביל היה מכוסה בפרחים זוהרים בכל צבעי הקשת, ובסופו עמד שער עץ ישן ועליו כתובת קטנה: "רק ילדים אמיצים מוזמנים להיכנס". דניאל נשם עמוק, אחז חזק בתרמיל שלו, ופתח את השער בזהירות.',
  },
  {
    text_content:
      'מאחורי השער חיכה לו דרקון קטן וירוק בשם ציקו. "שלום דניאל!" קרא צ׳יקו בשמחה, "חיכיתי לך כבר 100 ימים!" דניאל צחק. הוא לא פחד בכלל — הדרקון היה בגודל של חתול, ועיניו נצצו כמו 2 כוכבים.',
  },
  {
    text_content: 'A mixed-language line: דניאל said "Hello, Chiko!" and they became friends.',
  },
];

const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
const pageWidth = 210;
const pageHeight = 297;
const margin = 15;
const contentWidth = pageWidth - margin * 2;

// Same font registration as tryLoadHebrewFont (fs instead of fetch)
const ttf = readFileSync(join(root, 'public/fonts/Heebo-Regular.ttf'));
doc.addFileToVFS('Heebo-Regular.ttf', arrayBufferToBase64(ttf.buffer.slice(ttf.byteOffset, ttf.byteOffset + ttf.byteLength)));
doc.addFont('Heebo-Regular.ttf', 'Heebo', 'normal');
doc.setFont('Heebo', 'normal');

const drawText = async (text, x, y, { maxWidth, align = 'left' } = {}) => {
  const lines = maxWidth ? doc.splitTextToSize(text, maxWidth) : [text];
  const visual = await linesToVisualRTL(lines);
  doc.text(visual, x, y, { align });
};

// Cover
doc.setFillColor(124, 58, 237);
doc.rect(0, 0, pageWidth, pageHeight, 'F');
doc.setTextColor(255, 255, 255);
doc.setFontSize(32);
await drawText(book.title, pageWidth / 2, pageHeight / 3, { align: 'center', maxWidth: contentWidth });
doc.setFontSize(18);
await drawText(`סיפור עבור ${book.child_name}`, pageWidth / 2, pageHeight / 3 + 20, { align: 'center' });
doc.setFontSize(12);
doc.setTextColor(220, 220, 255);
await drawText(book.description, pageWidth / 2, pageHeight / 2 + 10, { align: 'center', maxWidth: contentWidth });

// Pages
for (let i = 0; i < pages.length; i++) {
  doc.addPage();
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(10);
  doc.text(`${i + 1}`, pageWidth / 2, pageHeight - 10, { align: 'center' });

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(14);
  const isRTL = containsHebrew(pages[i].text_content);
  await drawText(pages[i].text_content, isRTL ? pageWidth - margin : margin, margin + 10, {
    maxWidth: contentWidth,
    align: isRTL ? 'right' : 'left',
  });
}

mkdirSync(join(root, 'out'), { recursive: true });
const outPath = join(root, 'out', 'hebrew-pdf-proof.pdf');
writeFileSync(outPath, Buffer.from(doc.output('arraybuffer')));
console.log('WROTE', outPath, `(${Math.round(doc.output('arraybuffer').byteLength / 1024)}KB)`);
