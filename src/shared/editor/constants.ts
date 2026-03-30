export const IMAGE_EXT_REGEX = /\.(apng|avif|bmp|gif|ico|jpe?g|png|svg|webp)$/i;
export const KB_IMAGE_PREVIEW_EVENT = 'kb:image-preview';
export const PREVIEW_SCALE_MIN = 0.5;
export const PREVIEW_SCALE_MAX = 4;
export const PREVIEW_SCALE_STEP = 0.25;

export const clampPreviewScale = (value: number) => Math.min(PREVIEW_SCALE_MAX, Math.max(PREVIEW_SCALE_MIN, value));
