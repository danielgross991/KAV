"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export function AnimatedLinePercent({
  className,
  value,
}: {
  className?: string;
  value: number;
}) {
  const target = Math.max(0, Math.min(100, Math.round(value)));
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let frame = 0;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      frame = window.requestAnimationFrame(() => setDisplayValue(target));
      return () => window.cancelAnimationFrame(frame);
    }

    const duration = 1250;
    const startedAt = performance.now();

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(target * eased));
      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
      }
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [target]);

  return (
    <span className={cn("kav-num tabular-nums", className)} aria-label={`${target}%`}>
      {displayValue}%
    </span>
  );
}
