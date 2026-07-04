import { containsHebrew, firstStrongIsRTL, linesToVisualRTL, arrayBufferToBase64 } from './hebrewText';

/**
 * Export a book with its pages to a PDF document.
 *
 * Hebrew/Yiddish support (2026-07-05): embeds Heebo TTF (fetched on demand
 * from /fonts/, zero main-bundle impact) and reorders every line to visual
 * order via UAX#9 (bidi-js) — jsPDF's default Helvetica has no Hebrew
 * glyphs and draws characters in visual order, so without this Hebrew
 * exports were garbled. See rules/hebrew-rtl-web-gotchas.md.
 *
 * @param {Object} book - The book entity
 * @param {Array} pages - Array of page entities (sorted by page_number)
 * @param {Object} options
 * @param {string} options.format - 'a4' | 'letter' (default: 'a4')
 * @param {Function} options.onProgress - Progress callback (0-100)
 * @returns {Promise<void>} - Downloads the PDF
 */
export async function exportBookToPDF(book, pages, { format = 'a4', onProgress } = {}) {
  const { default: jsPDF } = await import('jspdf');
  const isA4 = format === 'a4';
  const pageWidth = isA4 ? 210 : 215.9;
  const pageHeight = isA4 ? 297 : 279.4;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: isA4 ? 'a4' : 'letter'
  });

  // Detect Hebrew content (book language or actual text) and set up the font.
  const bookIsRTL =
    book.language === 'hebrew' ||
    book.language === 'yiddish' ||
    containsHebrew(book.title) ||
    pages.some((p) => containsHebrew(p.text_content));
  let hebrewFontReady = false;
  if (bookIsRTL) {
    hebrewFontReady = await tryLoadHebrewFont(doc);
  }
  const setBodyFont = () => {
    doc.setFont(hebrewFontReady ? 'Heebo' : 'helvetica', 'normal');
  };
  setBodyFont();

  /**
   * Draw text with correct direction handling.
   * - Wraps with splitTextToSize on the LOGICAL string (width is order-independent)
   * - Reorders each wrapped line to visual order when it contains Hebrew
   * - RTL body text is right-aligned at the right margin
   */
  const drawText = async (text, x, y, { maxWidth, align = 'left' } = {}) => {
    if (!text) return;
    const lines = maxWidth ? doc.splitTextToSize(text, maxWidth) : [text];
    const visual = await linesToVisualRTL(lines);
    doc.text(visual, x, y, { align });
  };

  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  const totalSteps = pages.length + 1; // +1 for cover
  let completedSteps = 0;

  const reportProgress = () => {
    completedSteps++;
    onProgress?.(Math.round((completedSteps / totalSteps) * 100));
  };

  // Cover page
  doc.setFillColor(124, 58, 237); // purple-600
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  let coverDrawn = false;
  if (book.cover_image) {
    try {
      const img = await loadImage(book.cover_image);
      const imgRatio = img.width / img.height;
      const maxImgWidth = contentWidth;
      const maxImgHeight = pageHeight * 0.5;
      let imgW, imgH;

      if (imgRatio > maxImgWidth / maxImgHeight) {
        imgW = maxImgWidth;
        imgH = maxImgWidth / imgRatio;
      } else {
        imgH = maxImgHeight;
        imgW = maxImgHeight * imgRatio;
      }

      const imgX = (pageWidth - imgW) / 2;
      doc.addImage(img.src, 'JPEG', imgX, 30, imgW, imgH);

      // Title below image
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(28);
      const titleY = 30 + imgH + 20;
      await drawText(book.title || 'My Book', pageWidth / 2, titleY, {
        align: 'center',
        maxWidth: contentWidth
      });
      coverDrawn = true;
    } catch {
      coverDrawn = false;
    }
  }
  if (!coverDrawn) {
    await drawTextCover(doc, book, pageWidth, pageHeight, contentWidth, drawText, bookIsRTL);
  }

  reportProgress();

  // Content pages
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    doc.addPage();

    // Page number
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(10);
    doc.text(`${i + 1}`, pageWidth / 2, pageHeight - 10, { align: 'center' });

    let yPos = margin;

    // Illustration
    if (page.image_url) {
      try {
        const img = await loadImage(page.image_url);
        const imgRatio = img.width / img.height;
        const maxH = pageHeight * 0.4;
        let imgW = contentWidth;
        let imgH = contentWidth / imgRatio;

        if (imgH > maxH) {
          imgH = maxH;
          imgW = maxH * imgRatio;
        }

        const imgX = (pageWidth - imgW) / 2;
        doc.addImage(img.src, 'JPEG', imgX, yPos, imgW, imgH);
        yPos += imgH + 10;
      } catch {
        // Skip image if it fails to load
      }
    }

    // Text content — RTL pages are right-aligned at the right margin
    if (page.text_content) {
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(14);
      const pageIsRTL = firstStrongIsRTL(page.text_content);
      await drawText(page.text_content, pageIsRTL ? pageWidth - margin : margin, yPos + 5, {
        maxWidth: contentWidth,
        align: pageIsRTL ? 'right' : 'left'
      });
    }

    reportProgress();
  }

  // Download
  const fileName = (book.title || 'my-book').replace(/[^a-zA-Z0-9֐-׿ ]/g, '').replace(/\s+/g, '-');
  doc.save(`${fileName}.pdf`);
}

/**
 * Fetch Heebo from our own static assets and register it in jsPDF's VFS.
 * Returns true on success; on failure the caller falls back to Helvetica
 * (previous behavior) instead of blocking the export.
 */
async function tryLoadHebrewFont(doc) {
  try {
    const res = await fetch('/fonts/Heebo-Regular.ttf');
    if (!res.ok) throw new Error(`font fetch ${res.status}`);
    const buf = await res.arrayBuffer();
    doc.addFileToVFS('Heebo-Regular.ttf', arrayBufferToBase64(buf));
    doc.addFont('Heebo-Regular.ttf', 'Heebo', 'normal');
    return true;
  } catch (err) {
    if (import.meta.env?.DEV) console.warn('[pdfExporter] Hebrew font load failed, falling back:', err);
    return false;
  }
}

async function drawTextCover(doc, book, pageWidth, pageHeight, contentWidth, drawText, isRTL) {
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(32);
  await drawText(book.title || 'My Book', pageWidth / 2, pageHeight / 3, {
    align: 'center',
    maxWidth: contentWidth
  });

  if (book.child_name) {
    doc.setFontSize(18);
    const dedication = isRTL ? `סיפור עבור ${book.child_name}` : `A story for ${book.child_name}`;
    await drawText(dedication, pageWidth / 2, pageHeight / 3 + 20, { align: 'center' });
  }

  if (book.description) {
    doc.setFontSize(12);
    doc.setTextColor(220, 220, 255);
    await drawText(book.description, pageWidth / 2, pageHeight / 2 + 10, {
      align: 'center',
      maxWidth: contentWidth
    });
  }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
