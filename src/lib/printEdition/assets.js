import { createEditionManifest } from './model';
import { getApiAuthHeaders } from '@/lib/apiAuth';
import { imageAspectForBook } from '../printSpec';

const fileTypes = new Set(['image/jpeg', 'image/png']);
const proofTypes = new Set([...fileTypes, 'image/webp']);
const inlineArt = /^data:(image\/(?:jpeg|png|webp));base64,([a-zA-Z0-9+/]+={0,2})$/;
const maxBytes = 15 * 1024 * 1024;
export function validArtFile(file) {
  return Boolean(file?.size && file.size <= maxBytes && fileTypes.has(file.type));
}

function checkSpreadRatio(image, spreadRatio) {
  if (!spreadRatio) return;
  const relative = image.width / image.height / spreadRatio;
  if (relative < 0.82 || relative > 1.24) throw new Error('wide');
}

export async function uploadEditionArt(file, spreadRatio = 0) {
  if (!validArtFile(file)) throw new Error('file');
  const image = await createImageBitmap(file);
  try {
    checkSpreadRatio(image, spreadRatio);
  } finally {
    image.close();
  }
  const { UploadFile } = await import('@/integrations/Core');
  const { file_url: url } = await UploadFile({ file });
  if (!url?.startsWith('/api/img?')) throw new Error('file');
  return url;
}

export async function downloadEditionBundle(book, pages, edition) {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const assets = new Map();
  const usePath = (src) => {
    if (!src) throw new Error('Missing illustration');
    if (!assets.has(src)) assets.set(src, `art/image-${assets.size + 1}`);
    return assets.get(src);
  };
  const manifest = createEditionManifest(book, pages, edition, usePath);
  const headers = await getApiAuthHeaders();
  for (const [src, path] of assets) {
    const blob = await readEditionArt(src, headers);
    zip.file(path, blob);
  }
  zip.file('edition.json', JSON.stringify(manifest, null, 2));
  const url = URL.createObjectURL(await zip.generateAsync({ type: 'blob' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'sipurai-print-proof.zip';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function readEditionArt(src, headers, signal = undefined) {
  if (!src) throw new Error('Missing illustration');
  if (src.startsWith('data:')) {
    const match = inlineArt.exec(src);
    if (!match) throw new Error('Invalid inline illustration');
    return new Blob([Uint8Array.from(atob(match[2]), char => char.charCodeAt(0))], { type: match[1] });
  }
  // Only the first-party image proxy receives bearer credentials.
  const response = await fetch(src, src.startsWith('/api/img?') ? { headers, signal, cache: 'no-store', redirect: 'error' } : { signal, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
  if (!response.ok) throw new Error('Illustration unavailable');
  const blob = await response.blob();
  if (!proofTypes.has(blob.type)) throw new Error('Illustration format unsupported');
  return blob;
}

async function generateEditionArt(book, characterSheet, prompt, aspectRatio, spreadRatio = 0) {
  const { GenerateImage } = await import('@/integrations/Core');
  // New books use their cover as the identity reference throughout generation.
  // An owner-supplied reference sheet may make the cast clearer for an older book.
  const source = characterSheet || book.cover_image;
  const blob = await readEditionArt(source, await getApiAuthHeaders());
  // Normalize inline and stored art, including WebP. The existing image
  // provider contract expects PNG reference bytes.
  const bitmap = await createImageBitmap(blob);
  let referenceImageBase64;
  try {
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    context.fillStyle = 'white';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    referenceImageBase64 = canvas.toDataURL('image/png').split(',')[1];
  } finally {
    bitmap.close();
  }
  const { url } = await GenerateImage({
    prompt,
    aspectRatio,
    referenceImageBase64,
    quality: undefined,
    size: undefined,
    modelId: spreadRatio ? 'gemini-2-5-flash-image' : undefined,
  });
  if (!url?.startsWith('/api/img?')) throw new Error('Generated illustration could not be stored');
  if (spreadRatio) {
    const created = await createImageBitmap(await readEditionArt(url, await getApiAuthHeaders()));
    try { checkSpreadRatio(created, spreadRatio); }
    finally { created.close(); }
  }
  return url;
}

export function makeClosingArt(book, ending, characterSheet, instruction = '') {
  const prompt = [
    'Create one new square end-page illustration for this children’s picture book.',
    'The reader has already read the ending. Imagine a small wordless moment immediately after it: a gesture, gentle joke, or meaningful detail that pays off an object or action from the actual story.',
    'Make a fresh composition, not a repeat of the last illustration. Do not put any writing or letters in the image.',
    'The reference image is the identity and style guide. Keep the characters’ precise features, outfits, ages, colors, and medium. Keep faces away from the trim edge.',
    'Book title: ' + book.title,
    'Illustration style: ' + book.art_style,
    'Story ending: ' + ending.text_content.slice(0, 800),
    'Final scene artwork notes: ' + String(ending.image_prompt || '').slice(0, 800),
    instruction && 'Parent’s visual direction: ' + instruction.trim(),
  ].join(' ');
  return generateEditionArt(book, characterSheet, prompt, imageAspectForBook(book));
}

export function makeSpreadArt(book, first, second, characterSheet, intendedRatio, instruction = '') {
  const beat = (page) => [
    page.text_content.slice(0, 500),
    String(page.image_prompt || '').slice(0, 600),
  ].join(' ');
  const prompt = [
    'Use the attached character reference as the identity and art style guide. Create one continuous children’s picture-book panorama covering both halves of an open book.',
    'Use one shared viewpoint, setting, palette and light. No frames, panels, text, signs, numbers or seam. Leave calm areas for captions and keep faces and objects necessary to the story far from the center fold and outer trim.',
    'The book is read right to left. On the right side show this beat: ' + beat(first),
    'Continue that scene on the left with this beat: ' + beat(second),
    'Book illustration style: ' + book.art_style,
    instruction && 'Parent’s visual direction: ' + instruction.trim(),
  ].join(' ');
  return generateEditionArt(book, characterSheet, prompt, intendedRatio >= 1.64 ? '16:9' : '4:3', intendedRatio);
}

export function makeSceneArt(book, page, characterSheet, instruction) {
  const prompt = [
    'Illustrate this one scene for a children’s picture book. Use the attached character reference to preserve faces, ages, outfits, colors, and style.',
    'Make the requested visual adjustment while keeping the scene’s events and all relevant characters. No writing, lettering, signs or frames.',
    'Leave calm space for the caption, with important objects and faces inside the trim area.',
    'Scene text: ' + page.text_content.slice(0, 900),
    'Original visual notes: ' + String(page.image_prompt || '').slice(0, 800),
    'Book illustration style: ' + book.art_style,
    'Parent’s visual direction: ' + instruction.trim(),
  ].join(' ');
  return generateEditionArt(book, characterSheet, prompt, imageAspectForBook(book));
}

// Use the same high-resolution raster in the on-screen dedication and proof
// handoff. Derive the palette and motif from this book's art in the browser.
export async function makeEndpaper(source) {
  const bitmap = await createImageBitmap(await readEditionArt(source, await getApiAuthHeaders()));
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 24;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  try {
    context.fillStyle = 'white';
    context.fillRect(0, 0, 24, 24);
    context.drawImage(bitmap, 0, 0, 24, 24);
  } finally {
    bitmap.close();
  }
  const pixels = context.getImageData(0, 0, 24, 24).data;
  const colors = new Map();
  let seed = 0;
  for (let offset = 0; offset < pixels.length; offset += 4) {
    const rgb = [pixels[offset], pixels[offset + 1], pixels[offset + 2]];
    const key = rgb.map(channel => channel >> 5).join('');
    const bucket = colors.get(key) || { count: 0, sum: [0, 0, 0] };
    bucket.count++;
    rgb.forEach((channel, i) => { bucket.sum[i] += channel; });
    colors.set(key, bucket);
    seed = (Math.imul(seed, 31) + rgb[0] + 3 * rgb[1] + 5 * rgb[2]) >>> 0;
  }
  const main = [...colors.values()].sort((a, b) => b.count - a.count)[0];
  const tone = strength => `rgb(${main.sum.map(value => Math.round(248 * (1 - strength) + value / main.count * strength)).join(',')})`;
  canvas.width = canvas.height = 2680;
  context.fillStyle = tone(0.14);
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = tone(0.33);
  const spacing = 215 + (seed % 43);
  for (let row = 0, y = spacing / 2; y < canvas.height; row++, y += spacing) {
    for (let col = 0, x = spacing / 2 + (row % 2) * spacing / 3; x < canvas.width; col++, x += spacing) {
      const motif = (seed + 3 * row + 5 * col) % 7;
      const radius = 11 + motif;
      context.beginPath();
      if (motif % 3 === 0) {
        context.arc(x, y, radius * 0.48, 0, 2 * Math.PI);
      } else {
        const diagonal = radius * (motif % 2 ? 0.25 : 0.42);
        for (let point = 0; point < 8; point++) {
          const angle = Math.PI * point / 4;
          const distance = point % 2 ? diagonal : radius;
          context.lineTo(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance);
        }
        context.closePath();
      }
      context.fill();
    }
  }
  return canvas.toDataURL('image/png');
}
