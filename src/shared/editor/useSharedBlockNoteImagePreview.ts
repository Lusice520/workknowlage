import { useCallback, useEffect, useState } from 'react';
import {
  clampPreviewScale,
  KB_IMAGE_PREVIEW_EVENT,
  PREVIEW_SCALE_STEP,
} from './constants';

export function useSharedBlockNoteImagePreview() {
  const [imagePreview, setImagePreview] = useState<{ url: string; name?: string } | null>(null);
  const [imagePreviewScale, setImagePreviewScale] = useState(1);

  const closeImagePreview = useCallback(() => {
    setImagePreview(null);
  }, []);

  const zoomInPreviewImage = useCallback(() => {
    setImagePreviewScale((prev) => clampPreviewScale(prev + PREVIEW_SCALE_STEP));
  }, []);

  const zoomOutPreviewImage = useCallback(() => {
    setImagePreviewScale((prev) => clampPreviewScale(prev - PREVIEW_SCALE_STEP));
  }, []);

  const resetPreviewImageZoom = useCallback(() => {
    setImagePreviewScale(1);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleOpenImagePreview = (event: CustomEvent) => {
      const url = String(event?.detail?.url || '').trim();
      if (!url) return;
      setImagePreview({
        url,
        name: String(event?.detail?.name || '图片预览'),
      });
      setImagePreviewScale(1);
    };

    window.addEventListener(KB_IMAGE_PREVIEW_EVENT, handleOpenImagePreview as EventListener);
    return () => {
      window.removeEventListener(KB_IMAGE_PREVIEW_EVENT, handleOpenImagePreview as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!imagePreview || typeof window === 'undefined') return undefined;

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setImagePreview(null);
        return;
      }
      if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        zoomInPreviewImage();
        return;
      }
      if (event.key === '-' || event.key === '_') {
        event.preventDefault();
        zoomOutPreviewImage();
        return;
      }
      if (event.key === '0') {
        event.preventDefault();
        resetPreviewImageZoom();
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
    };
  }, [imagePreview, resetPreviewImageZoom, zoomInPreviewImage, zoomOutPreviewImage]);

  return {
    closeImagePreview,
    imagePreview,
    imagePreviewScale,
    resetPreviewImageZoom,
    zoomInPreviewImage,
    zoomOutPreviewImage,
  };
}
