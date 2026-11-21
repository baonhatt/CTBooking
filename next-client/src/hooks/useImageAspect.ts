// Hook to get the natural aspect ratio (height / width) of an image URL
import { useState, useEffect } from 'react';

/**
 * Returns the aspect ratio of the provided image URL.
 * The hook loads the image once (or when the URL changes) and calculates
 * height / width as a decimal. If the image fails to load, the hook returns 0.
 */
export default function useImageAspect(imageUrl: string): number {
  const [aspect, setAspect] = useState(0);

  useEffect(() => {
    if (!imageUrl) {
      setAspect(0);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.src = imageUrl;
    img.onload = () => {
      if (!cancelled) {
        const ratio = img.naturalHeight / img.naturalWidth;
        setAspect(ratio);
      }
    };
    img.onerror = () => {
      if (!cancelled) setAspect(0);
    };
    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  return aspect;
}
