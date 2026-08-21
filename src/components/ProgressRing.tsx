"use client";

import { motion } from "framer-motion";

/**
 * Кільце прогресу поверх прев'ю. Малюється через strokeDashoffset —
 * дешево для GPU і плавно навіть на слабких телефонах.
 */
export default function ProgressRing({
  progress,
  size = 46,
  stroke = 3,
}: {
  /** 0..1 */
  progress: number;
  size?: number;
  stroke?: number;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, progress));

  return (
    <svg width={size} height={size} className="-rotate-90" aria-hidden>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth={stroke}
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#FFFDFA"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        animate={{ strokeDashoffset: circumference * (1 - clamped) }}
        initial={{ strokeDashoffset: circumference }}
        transition={{ type: "spring", stiffness: 120, damping: 26 }}
      />
    </svg>
  );
}
