export const DEFAULT_CAPTION_STYLE = Object.freeze({
  textColor: '#24243b',
  backdropColor: '#fff4e1',
  backdropOpacity: 0.95,
});

const hex = /^#[a-fA-F0-9]{6}$/;

export function isCaptionStyle(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === 3
    && Object.hasOwn(value, 'textColor') && typeof value.textColor === 'string' && value.textColor.length === 7 && hex.test(value.textColor)
    && Object.hasOwn(value, 'backdropColor') && typeof value.backdropColor === 'string' && value.backdropColor.length === 7 && hex.test(value.backdropColor)
    && Object.hasOwn(value, 'backdropOpacity') && Number.isFinite(value.backdropOpacity)
    && value.backdropOpacity >= 0 && value.backdropOpacity <= 1);
}

export const CAPTION_HEIGHT_MM = Object.freeze({ min: 28, max: 64, initial: 46 });
export const CAPTION_WIDTH_MM = Object.freeze({ min: 55, max: 176 });

export function isCaptionHeights(value, count) {
  return Array.isArray(value) && value.length === count
    && value.every(height => height === null || (Number.isFinite(height)
      && height >= CAPTION_HEIGHT_MM.min && height <= CAPTION_HEIGHT_MM.max));
}
