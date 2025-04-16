import { useEffect, useState } from 'react';

import { useWindowSize } from './use-window-size';

export type UseIsMobileOptions = {
  /**
   * The breakpoint width in pixels below which a device is considered mobile
   * @default 768
   */
  breakpoint?: number;
};

/**
 * Hook to detect if the current viewport is mobile-sized
 * @param options Configuration options for mobile detection
 * @returns boolean indicating if the current viewport is mobile-sized
 */
export const useIsMobile = (options?: UseIsMobileOptions): boolean => {
  const { breakpoint = 768 } = options || {};
  const { width } = useWindowSize();
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    // Update isMobile state based on window width
    setIsMobile(width > 0 && width < breakpoint);
  }, [width, breakpoint]);

  return isMobile;
};
