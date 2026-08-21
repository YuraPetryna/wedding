"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";

/**
 * Фонова атмосфера: дві пастельні плями, що повільно дихають, і пелюстки,
 * які злітають угору. Все декоративне — aria-hidden і pointer-events-none,
 * щоб не заважати скрін-рідерам і дотикам.
 */

type Petal = {
  left: number;
  size: number;
  delay: number;
  duration: number;
  drift: number;
  spin: number;
  tone: string;
};

const TONES = ["#F0D2CA", "#F8E7E2", "#D7E0D1", "#E3CDA0"];

/** Детермінований псевдовипадок: без нього SSR і клієнт малюють різне. */
function seeded(i: number, salt: number) {
  const x = Math.sin((i + 1) * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export default function Ambience({ petalCount = 14 }: { petalCount?: number }) {
  const reduce = useReducedMotion();

  const petals = useMemo<Petal[]>(
    () =>
      Array.from({ length: petalCount }, (_, i) => ({
        left: seeded(i, 1) * 100,
        size: 8 + seeded(i, 2) * 14,
        delay: seeded(i, 3) * 14,
        duration: 16 + seeded(i, 4) * 14,
        drift: (seeded(i, 5) - 0.5) * 140,
        spin: 180 + seeded(i, 6) * 360,
        tone: TONES[i % TONES.length],
      })),
    [petalCount],
  );

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Базовий градієнт сторінки */}
      <div className="absolute inset-0 bg-gradient-to-b from-ivory via-cream to-blush-50" />

      {/* Дві плями, що дихають у протифазі */}
      <motion.div
        className="absolute -left-[20%] top-[-10%] h-[70vmin] w-[70vmin] rounded-full blur-[90px]"
        style={{ background: "radial-gradient(circle, #F8E7E2 0%, transparent 68%)" }}
        animate={reduce ? undefined : { scale: [1, 1.18, 1], x: [0, 40, 0], y: [0, 30, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -right-[15%] top-[35%] h-[60vmin] w-[60vmin] rounded-full blur-[90px]"
        style={{ background: "radial-gradient(circle, #E1E9DC 0%, transparent 68%)" }}
        animate={reduce ? undefined : { scale: [1.15, 1, 1.15], x: [0, -30, 0], y: [0, -40, 0] }}
        transition={{ duration: 32, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Пелюстки */}
      {!reduce &&
        petals.map((p, i) => (
          <motion.span
            key={i}
            className="absolute bottom-[-10vh] block"
            style={{
              left: `${p.left}%`,
              width: p.size,
              height: p.size * 0.72,
              background: p.tone,
              borderRadius: "60% 40% 55% 45% / 55% 60% 40% 45%",
              opacity: 0.5,
            }}
            /* Усі доріжки мають однакову кількість кадрів — інакше спільний
               `times` не збігається з keyframes і рух стає рваним. */
            animate={{
              y: ["0vh", "-30vh", "-92vh", "-118vh"],
              x: [0, p.drift * 0.6, p.drift, p.drift * 0.35],
              rotate: [0, p.spin * 0.3, p.spin * 0.8, p.spin],
              opacity: [0, 0.55, 0.55, 0],
            }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              repeat: Infinity,
              ease: "linear",
              times: [0, 0.15, 0.85, 1],
            }}
          />
        ))}

      {/* Зерно поверх усього — прибирає «пластиковість» градієнтів */}
      <div className="grain absolute inset-0" />
    </div>
  );
}
