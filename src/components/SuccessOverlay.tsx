"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";
import { wedding } from "@/config/wedding";
import { easeSoft, fadeUp, stagger, tap } from "./motion";
import Ornament from "./Ornament";

const CONFETTI_TONES = ["#E4B6AC", "#F0D2CA", "#B6C4AD", "#E3CDA0", "#FFFDFA"];

function seeded(i: number, salt: number) {
  const x = Math.sin((i + 1) * 91.3 + salt * 47.7) * 43758.5453;
  return x - Math.floor(x);
}

export default function SuccessOverlay({
  count,
  guest,
  onMore,
}: {
  count: number;
  guest: string;
  onMore: () => void;
}) {
  const reduce = useReducedMotion();

  // Салют із центру: кожна частинка летить у свій бік і плавно осідає.
  const confetti = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => {
        const angle = (i / 26) * Math.PI * 2 + seeded(i, 1);
        const distance = 90 + seeded(i, 2) * 190;
        return {
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance - 40,
          size: 5 + seeded(i, 3) * 7,
          delay: 0.35 + seeded(i, 4) * 0.35,
          rotate: seeded(i, 5) * 720 - 360,
          tone: CONFETTI_TONES[i % CONFETTI_TONES.length],
          round: seeded(i, 6) > 0.5,
        };
      }),
    [],
  );

  const plural = count === 1 ? "фотографія" : count < 5 ? "фотографії" : "фотографій";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-cream/98 px-6 py-16"
      role="status"
      aria-live="polite"
    >
      <motion.div
        variants={stagger(0.1, 0.15)}
        initial="hidden"
        animate="show"
        className="relative flex w-full max-w-md flex-col items-center text-center"
      >
        {/* Салют */}
        {!reduce && (
          <div aria-hidden className="pointer-events-none absolute left-1/2 top-16 h-0 w-0">
            {confetti.map((c, i) => (
              <motion.span
                key={i}
                className="absolute block"
                style={{
                  width: c.size,
                  height: c.round ? c.size : c.size * 0.4,
                  background: c.tone,
                  borderRadius: c.round ? "50%" : "2px",
                }}
                initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                animate={{
                  x: [0, c.x * 0.7, c.x],
                  y: [0, c.y, c.y + 130],
                  opacity: [0, 1, 0],
                  scale: [0, 1, 0.85],
                  rotate: [0, c.rotate],
                }}
                transition={{
                  duration: 2.1,
                  delay: c.delay,
                  ease: easeSoft,
                  times: [0, 0.35, 1],
                }}
              />
            ))}
          </div>
        )}

        {/* Галочка, що малюється у колі, яке саме себе обводить */}
        <motion.div
          variants={{
            hidden: { scale: 0.6, opacity: 0 },
            show: {
              scale: 1,
              opacity: 1,
              transition: { type: "spring", stiffness: 260, damping: 18 },
            },
          }}
          className="relative flex h-28 w-28 items-center justify-center"
        >
          <motion.span
            className="absolute inset-0 rounded-full bg-sage-100"
            animate={reduce ? undefined : { scale: [1, 1.14, 1] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
          />
          <svg viewBox="0 0 100 100" className="relative h-full w-full" aria-hidden>
            <motion.circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="#94A889"
              strokeWidth="1.5"
              initial={{ pathLength: 0, rotate: -90 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.1, delay: 0.2, ease: easeSoft }}
              style={{ transformOrigin: "50% 50%", rotate: -90 }}
            />
            <motion.path
              d="M32 51.5 L44.5 63.5 L69 38"
              fill="none"
              stroke="#75886B"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.5, delay: 0.75, ease: "easeOut" }}
            />
          </svg>
        </motion.div>

        <motion.h2
          variants={fadeUp}
          className="mt-8 font-display text-[clamp(2.1rem,8vw,3rem)] font-light leading-tight text-ink-900"
        >
          Дякуємо{guest ? `, ${guest.split(" ")[0]}` : ""}!
        </motion.h2>

        <motion.div variants={fadeUp} className="mt-5 flex w-full justify-center">
          <Ornament />
        </motion.div>

        <motion.p variants={fadeUp} className="mt-6 text-balance leading-relaxed text-ink-600">
          <strong className="font-semibold text-ink-800">
            {count} {plural}
          </strong>{" "}
          вже на Диску {wedding.bride} та {wedding.groom} — в оригінальній якості,
          такими, якими ви їх зняли.
        </motion.p>

        <motion.div variants={fadeUp} className="mt-10 flex flex-col items-center gap-4">
          <motion.button
            type="button"
            onClick={onMore}
            whileTap={tap}
            whileHover={{ y: -3 }}
            className="btn-primary"
          >
            Додати ще фото
          </motion.button>
          <p className="max-w-xs text-xs leading-relaxed text-ink-400">
            Знімайте ще — сторінку можна відкрити скільки завгодно разів
            за тим самим QR-кодом.
          </p>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
