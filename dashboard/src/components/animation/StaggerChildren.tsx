"use client";

import { motion } from "motion/react";

interface StaggerChildrenProps {
  children: React.ReactNode;
  stagger?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function StaggerChildren({
  children,
  stagger = 0.04,
  className,
  style,
}: StaggerChildrenProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: stagger } },
      }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 10 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { type: "spring", stiffness: 380, damping: 32, duration: 0.4 },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
