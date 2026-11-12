/**
 * Turn a parent's photo into an illustrated character WITHOUT ever storing the photo.
 *
 * What happens to the photo, exactly:
 *   1. it is read in the browser and redrawn small as a PNG (this also drops hidden camera data such as location),
 *   2. that PNG is sent once to our server (/api/ai/generate, held in memory only, never written to storage),
 *   3. our server passes it to the image provider (Google or OpenAI, named in the privacy policy) to draw the character,
 *   4. only the DRAWING that comes back is uploaded to storage and kept.
 * Nothing here calls UploadFile / uploadFileToSupabase with the photo, so there is no stored original to
 * delete, and no orphan to forget if the drawing fails. tests/photo-to-character cover this.
 *
 * What we do not control: how the provider handles the photo during and after the request. The privacy policy
 * says so plainly.
 */
import { GenerateImage } from '@/integrations/Core';
import { buildSafetyPromptPrefix } from '@/utils/content-moderation';

export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
const MAX_SIDE = 768;
const MAX_BASE64_CHARS = 3_000_000; // the serverless request body limit is about 4.5 MB

export class PhotoError extends Error {
  constructor(code) {
    super(code);
    this.name = 'PhotoError';
    this.code = code;
  }
}

/** Redraws the photo at most MAX_SIDE px as a PNG and returns base64 without the data: prefix. */
export async function photoToPngBase64(file, { maxSide = MAX_SIDE } = {}) {
  const bitmap = await createImageBitmap(file);
  try {
    let side = maxSide;
    for (;;) {
      const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/png');
      const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
      if (b64.length <= MAX_BASE64_CHARS || side <= 256) return b64;
      side = Math.round(side * 0.7);
    }
  } finally {
    bitmap.close?.();
  }
}

export function validatePhoto(file) {
  if (!file || !PHOTO_TYPES.includes(file.type)) throw new PhotoError('format');
  if (file.size > PHOTO_MAX_BYTES) throw new PhotoError('size');
}

export function buildPhotoPrompt(style = 'cartoon') {
  return (
    buildSafetyPromptPrefix('5-10') +
    `Turn the person in the reference photo into a friendly storybook illustration of a character. Style: ${style}, colorful and child-friendly. ` +
    'Keep hair colour, skin tone, glasses and general look. Plain soft background, head and shoulders, no text, no letters, nothing from the photo background.'
  );
}

/**
 * @returns {Promise<{ url: string, base64: string }>} the DRAWING (url of the stored illustration)
 */
export async function createAvatarFromPhoto(file, { style = 'cartoon', generate = GenerateImage, toBase64 = photoToPngBase64 } = {}) {
  validatePhoto(file);
  const referenceImageBase64 = await toBase64(file);
  const result = await generate({ prompt: buildPhotoPrompt(style), aspectRatio: '1:1', referenceImageBase64 });
  if (!result?.url) throw new PhotoError('no_result');
  return { url: result.url, base64: result.base64 };
}

/** Shown next to every photo upload. Must stay true: see the header and the privacy policy. */
export const photoNote = {
  he: 'התמונה נשלחת פעם אחת כדי לצייר את הדמות, ולא נשמרת אצלנו. נשמר רק הציור. לצורך הציור היא עוברת לשירות הציור (Google או OpenAI, כמו שמופיע במדיניות הפרטיות), וכמה זמן היא נשמרת שם נקבע בתנאים שלו. הציור נשמר באחסון סגור ורק אתם רואים אותו. העלאת תמונה אינה חובה.',
  en: 'The photo is sent once to draw the character and is not kept by us. Only the drawing is kept. To be drawn it passes to the drawing service (Google or OpenAI, as listed in the privacy policy), and how long it is kept there is set by that service\'s terms. The drawing is kept in closed storage that only you can open. Uploading a photo is optional.',
};

/** The separate, just-in-time approval the parent ticks before choosing a photo (not stored). */
export const photoConsent = {
  he: 'זו תמונה שלי, או של ילד שאני ההורה או האפוטרופוס שלו. אני מסכים או מסכימה שהתמונה תישלח ל-Google או ל-OpenAI, שנמצאות בארצות הברית, שבה ההגנה על מידע עשויה להיות שונה מבישראל, כדי לצייר ממנה דמות לתמונת הפרופיל.',
  en: 'This is a photo of me, or of a child I am the parent or guardian of. I agree that the photo is sent to Google or OpenAI in the United States, where data protection may differ from Israel, to draw a profile character from it.',
};
