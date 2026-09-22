import { useTextOverflow } from '../../hooks/useTextOverflow';

interface MarqueeTextProps {
  text: string;
  isPlaying: boolean;
  className?: string;
}

/** Check if the user prefers reduced motion */
function usePrefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Calculate marquee duration based on text length — longer text scrolls proportionally */
function getMarqueeDuration(text: string): string {
  const seconds = Math.max(6, Math.min(20, text.length * 0.2));
  return `${seconds}s`;
}

/**
 * Text component that conditionally applies marquee animation.
 * - When text fits: renders static with truncation
 * - When text overflows + playing: renders with marquee animation (duplicated for seamless loop)
 * - When text overflows + paused: renders static truncated
 * - Respects prefers-reduced-motion: always static
 * - Duration scales with text length for natural pacing
 */
export function MarqueeText({ text, isPlaying, className = '' }: MarqueeTextProps) {
  const [ref, overflows] = useTextOverflow<HTMLDivElement>();
  const reducedMotion = usePrefersReducedMotion();

  const shouldAnimate = overflows && isPlaying && !reducedMotion;

  return (
    <div className="overflow-hidden" ref={ref as React.RefObject<HTMLDivElement>}>
      {shouldAnimate ? (
        <div
          key={text}
          className="inline-flex whitespace-nowrap animate-marquee"
          style={{ animationDuration: getMarqueeDuration(text) }}
        >
          <span className={`px-12 ${className}`}>{text}</span>
          <span className={`px-12 ${className}`}>{text}</span>
        </div>
      ) : (
        <div className={`truncate ${className}`}>
          {text}
        </div>
      )}
    </div>
  );
}
