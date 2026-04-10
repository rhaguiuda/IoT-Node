"use client";

import { useEffect, useRef } from "react";
import { animate } from "motion";

interface CountUpProps {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export default function CountUp({
  value,
  duration = 0.5,
  decimals = 0,
  prefix = "",
  suffix = "",
  className,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const prevValue = useRef(0);

  useEffect(() => {
    if (!ref.current) return;
    const from = prevValue.current;
    const to = value;
    prevValue.current = value;

    const controls = animate(from, to, {
      duration,
      ease: [0.25, 0.1, 0.25, 1],
      onUpdate(v) {
        if (ref.current) {
          const formatted =
            decimals > 0 ? v.toFixed(decimals) : Math.round(v).toLocaleString();
          ref.current.textContent = `${prefix}${formatted}${suffix}`;
        }
      },
    });

    return () => controls.stop();
  }, [value, duration, decimals, prefix, suffix]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {decimals > 0 ? value.toFixed(decimals) : value.toLocaleString()}
      {suffix}
    </span>
  );
}
