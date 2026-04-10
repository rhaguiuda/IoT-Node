"use client";

import { motion, type TargetAndTransition } from "motion/react";

type AnimationType = "fade" | "slideUp" | "slideDown" | "fadeSlideUp";

const VARIANTS: Record<AnimationType, { initial: TargetAndTransition; animate: TargetAndTransition }> = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
  },
  slideUp: {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
  },
  slideDown: {
    initial: { opacity: 0, y: -12 },
    animate: { opacity: 1, y: 0 },
  },
  fadeSlideUp: {
    initial: { opacity: 0, y: 16, filter: "blur(4px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  },
};

interface AnimateInProps {
  children: React.ReactNode;
  type?: AnimationType;
  delay?: number;
  duration?: number;
  className?: string;
}

export default function AnimateIn({
  children,
  type = "fadeSlideUp",
  delay = 0,
  duration = 0.45,
  className,
}: AnimateInProps) {
  const variant = VARIANTS[type];
  return (
    <motion.div
      initial={variant.initial}
      animate={variant.animate}
      transition={{ type: "spring", stiffness: 280, damping: 28, delay, duration }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
