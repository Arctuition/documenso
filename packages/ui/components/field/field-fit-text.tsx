import { useFitText } from '@documenso/lib/client-only/hooks/use-fit-text';

import { cn } from '../../lib/utils';

export type FieldFitTextProps = {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
  maxFontSize: number;
  minFontSize?: number;
  step?: number;
  /** Re-measure whenever this value changes. */
  refitKey?: unknown;
};

/**
 * ArcSite: field text that shrinks to fit small field boxes on mobile.
 */
export const FieldFitText = ({
  children,
  className,
  containerClassName,
  maxFontSize,
  minFontSize = 0.2,
  step = 0.05,
  refitKey,
}: FieldFitTextProps) => {
  const { containerRef, textRef, fontSize } = useFitText<HTMLDivElement, HTMLParagraphElement>({
    maxFontSize,
    minFontSize,
    step,
    refitKey,
  });

  return (
    <div
      ref={containerRef}
      className={cn('flex h-full w-full items-center justify-center overflow-hidden', containerClassName)}
    >
      {/* Only transition colour: a font-size transition would make the fit measurements read stale sizes. */}
      <p
        ref={textRef}
        style={{ fontSize: `${fontSize}rem`, transitionProperty: 'color' }}
        className={cn('leading-none', className)}
      >
        {children}
      </p>
    </div>
  );
};
