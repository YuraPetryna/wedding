"use client";

import { motion } from "framer-motion";
import { drawPath, inView } from "./motion";

/**
 * Золотий вензель-роздільник. Лінії малюються зліва направо,
 * ромб у центрі з'являється, коли лінії вже зійшлися.
 */
export default function Ornament({ className = "text-gold-400" }: { className?: string }) {
  return (
    <motion.svg
      {...inView}
      viewBox="0 0 240 24"
      fill="none"
      aria-hidden
      /* Колір навмисно не зашитий у базові класи: два класи text-* мають
         однакову специфічність, і хто переможе, вирішував би порядок у CSS,
         а не порядок у рядку. Тому колір приходить лише ззовні. */
      className={`h-6 w-full max-w-[240px] ${className}`}
    >
      <motion.path
        d="M4 12 C 40 12, 60 4, 96 12"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        variants={drawPath}
      />
      <motion.path
        d="M236 12 C 200 12, 180 20, 144 12"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        variants={drawPath}
      />
      <motion.path
        d="M120 5 L 127 12 L 120 19 L 113 12 Z"
        stroke="currentColor"
        strokeWidth="1"
        variants={{
          hidden: { scale: 0, opacity: 0, rotate: -90 },
          show: {
            scale: 1,
            opacity: 1,
            rotate: 0,
            transition: { delay: 0.85, duration: 0.6, ease: [0.22, 1, 0.36, 1] },
          },
        }}
        style={{ transformOrigin: "120px 12px" }}
      />
      <motion.circle
        cx="102"
        cy="12"
        r="1.6"
        fill="currentColor"
        variants={{
          hidden: { scale: 0 },
          show: { scale: 1, transition: { delay: 1.05, duration: 0.4 } },
        }}
      />
      <motion.circle
        cx="138"
        cy="12"
        r="1.6"
        fill="currentColor"
        variants={{
          hidden: { scale: 0 },
          show: { scale: 1, transition: { delay: 1.15, duration: 0.4 } },
        }}
      />
    </motion.svg>
  );
}
