"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import Botanical from "./Botanical";
import { easeSoft } from "./motion";

/**
 * Портрет в арці — форма, на якій тримається половина весільної поліграфії.
 *
 * Якщо фото ще не поклали в public/photos, компонент не показує «битої
 * картинки» і не лишає порожньої діри: малює текстуровану арку з гілочкою.
 * Виглядає як задуманий елемент, а не як недоробка.
 */
export default function ArchPhoto({
  src,
  alt,
  className = "",
  priority = false,
  sizes = "(max-width: 768px) 80vw, 420px",
  /** Повільний наїзд камери, поки фото на екрані */
  kenBurns = false,
  delay = 0,
}: {
  src?: string;
  alt: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
  kenBurns?: boolean;
  delay?: number;
}) {
  const [loaded, setLoaded] = useState(false);
  const reduce = useReducedMotion();

  return (
    <motion.figure
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.9, delay, ease: easeSoft }}
      className={`relative overflow-hidden rounded-t-[999px] bg-blush-50 shadow-lift ${className}`}
    >
      {/* Тонка золота обвідка всередині арки — деталь, яку помічають не одразу */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-[6px] z-20 rounded-t-[999px] border border-gold-300/45"
      />

      {src ? (
        <>
          {/* Мерехтіння, поки вантажиться: без нього арка блимає порожнечею */}
          {!loaded && (
            <span
              aria-hidden
              className="absolute inset-0 z-10 animate-shimmer bg-[linear-gradient(100deg,#F8E7E2_20%,#FDF4F2_40%,#F8E7E2_60%)] bg-[length:200%_100%]"
            />
          )}
          <motion.div
            className="absolute inset-0"
            animate={kenBurns && !reduce ? { scale: [1, 1.09] } : undefined}
            transition={{ duration: 22, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
          >
            <Image
              src={src}
              alt={alt}
              fill
              sizes={sizes}
              priority={priority}
              onLoad={() => setLoaded(true)}
              className="object-cover"
            />
          </motion.div>
        </>
      ) : (
        <EmptyArch />
      )}
    </motion.figure>
  );
}

/** Порожня арка: паперова текстура, гілочка, ледь помітний вензель. */
function EmptyArch() {
  return (
    <div className="grain absolute inset-0 flex items-center justify-center bg-gradient-to-b from-blush-50 via-ivory to-sage-100">
      <Botanical
        variant="olive"
        className="absolute -left-2 bottom-0 h-2/3 w-2/3 text-sage-300/70"
      />
      <Botanical
        variant="olive"
        flip
        className="absolute -right-2 bottom-0 h-2/3 w-2/3 text-sage-300/70"
      />
      <svg viewBox="0 0 60 60" className="relative h-16 w-16 text-gold-400/70" aria-hidden>
        <motion.path
          d="M30 14 C 20 22, 20 34, 30 46 C 40 34, 40 22, 30 14 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.4, ease: easeSoft }}
        />
        <motion.path
          d="M30 20 L30 46"
          stroke="currentColor"
          strokeWidth="0.7"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay: 0.6, ease: easeSoft }}
        />
      </svg>
    </div>
  );
}
