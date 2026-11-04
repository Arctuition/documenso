import { useCallback, useLayoutEffect, useRef, useState } from 'react';

export type UseFitTextOptions = {
  /** Starting (largest) font size in rem. */
  maxFontSize: number;
  /** Smallest font size in rem the text may shrink to. */
  minFontSize: number;
  /** Amount in rem to shrink by on each step. */
  step: number;
  /** Only measure while enabled, e.g. while the element is rendered. */
  enabled?: boolean;
  /** Re-measure whenever this value changes, e.g. the rendered text. */
  refitKey?: unknown;
};

/**
 * ArcSite: shrink a text element's font size until it fits inside its container.
 *
 * Attach `containerRef` to the bounding element and `textRef` to the text element.
 */
export const useFitText = <TContainer extends HTMLElement, TText extends HTMLElement>({
  maxFontSize,
  minFontSize,
  step,
  enabled = true,
  refitKey,
}: UseFitTextOptions) => {
  const containerRef = useRef<TContainer>(null);
  const textRef = useRef<TText>(null);

  const [fontSize, setFontSize] = useState(maxFontSize);

  const fitText = useCallback(() => {
    const container = containerRef.current;
    const text = textRef.current;

    if (!container || !text) {
      return;
    }

    let size = maxFontSize;
    text.style.fontSize = `${size}rem`;

    while (
      (text.scrollWidth > container.clientWidth || text.scrollHeight > container.clientHeight) &&
      size > minFontSize
    ) {
      size -= step;
      text.style.fontSize = `${size}rem`;
    }

    setFontSize(size);
  }, [maxFontSize, minFontSize, step]);

  // `refitKey` is only a dependency so that changing it triggers a re-measure.
  useLayoutEffect(() => {
    if (!enabled || !containerRef.current || !textRef.current) {
      return;
    }

    const resizeObserver = new ResizeObserver(fitText);
    resizeObserver.observe(containerRef.current);

    fitText();

    return () => resizeObserver.disconnect();
  }, [enabled, fitText, refitKey]);

  return { containerRef, textRef, fontSize, fitText };
};
