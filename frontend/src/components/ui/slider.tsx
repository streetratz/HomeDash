import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

interface SliderProps
  extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  /** Accent colour applied to the filled range and thumb border */
  accentColor?: string;
  /** Track height variant */
  trackSize?: "xs" | "sm" | "md";
  /** Thumb diameter variant */
  thumbSize?: "xs" | "sm" | "md";
}

const trackSizeMap = { xs: "h-0.5", sm: "h-1", md: "h-1.5" } as const;
const thumbSizeMap = {
  xs: "h-2 w-2",
  sm: "h-3 w-3",
  md: "h-4 w-4",
} as const;

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(
  (
    {
      className,
      accentColor,
      trackSize = "sm",
      thumbSize = "sm",
      ...props
    },
    ref,
  ) => (
    <SliderPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex w-full touch-none select-none items-center",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track
        className={cn(
          "relative w-full grow overflow-hidden rounded-full bg-white/10",
          trackSizeMap[trackSize],
        )}
      >
        <SliderPrimitive.Range
          className="absolute h-full rounded-full bg-white/30"
          style={accentColor ? { backgroundColor: accentColor } : undefined}
        />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        className={cn(
          "block rounded-full bg-white shadow-md transition-[color,transform] duration-150 ease-out active:scale-90",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
          "disabled:pointer-events-none disabled:opacity-50",
          thumbSizeMap[thumbSize],
        )}
      />
    </SliderPrimitive.Root>
  ),
);
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
export type { SliderProps };
