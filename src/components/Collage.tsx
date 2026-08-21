"use client";

import Image from "next/image";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef, useState } from "react";
import type { Photo } from "@/lib/photos";
import ArchPhoto from "./ArchPhoto";
import Botanical from "./Botanical";
import Ornament from "./Ornament";
import { easeSoft, fadeUp, inView, stagger } from "./motion";

/**
 * Секція-колаж між героєм і завантаженням.
 *
 * Три знімки їдуть із різною швидкістю відносно скролу — саме різниця
 * швидкостей створює відчуття глибини, якого не дає жодна тінь.
 */
export default function Collage({ photos }: { photos: Photo[] }) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  // Різні амплітуди — різні «плани» сцени.
  const slow = useTransform(scrollYProgress, [0, 1], ["6%", "-6%"]);
  const medium = useTransform(scrollYProgress, [0, 1], ["12%", "-12%"]);
  const fast = useTransform(scrollYProgress, [0, 1], ["18%", "-18%"]);

  const [main, second, third] = [photos[1], photos[2], photos[3]];

  return (
    <section ref={ref} className="relative overflow-hidden px-5 py-24 sm:px-6 sm:py-32">
      {/* Гілки по кутах композиції */}
      <Botanical
        variant="eucalyptus"
        className="pointer-events-none absolute -left-10 top-8 h-44 w-44 text-sage-300/60 sm:h-64 sm:w-64"
      />
      <Botanical
        variant="eucalyptus"
        flip
        delay={0.3}
        className="pointer-events-none absolute -right-10 bottom-8 h-44 w-44 text-sage-300/60 sm:h-64 sm:w-64"
      />

      <div className="mx-auto grid w-full max-w-4xl items-center gap-8 sm:gap-10 md:grid-cols-[1.05fr_1fr]">
        {/* Головний портрет в арці */}
        <motion.div style={reduce ? undefined : { y: slow }} className="mx-auto w-full max-w-sm">
          <ArchPhoto
            src={main?.src}
            alt="Наречені"
            sizes="(max-width: 768px) 85vw, 420px"
            className="aspect-[3/4] w-full"
            kenBurns
          />
        </motion.div>

        {/* Текст і два дрібніші кадри */}
        <motion.div {...inView} variants={stagger(0.12)} className="flex flex-col gap-7">
          <motion.div style={reduce ? undefined : { y: medium }} className="flex justify-center md:justify-start">
            <Snapshot photo={second} alt="Кадр з нашої історії" rotate={-3} />
          </motion.div>

          <motion.blockquote variants={fadeUp} className="text-center md:text-left">
            <p className="font-display text-[1.6rem] font-light leading-snug text-ink-800 sm:text-3xl">
              Найкраще з цього дня побачите ви, а не фотограф.
            </p>
            <div className="mt-5 flex justify-center md:justify-start">
              <Ornament className="max-w-[180px] text-gold-400" />
            </div>
            <footer className="mt-4 text-xs uppercase tracking-[0.24em] text-ink-400">
              Тому ми просимо ваші кадри
            </footer>
          </motion.blockquote>

          <motion.div style={reduce ? undefined : { y: fast }} className="flex justify-center md:justify-end">
            <Snapshot photo={third} alt="Ще один кадр" rotate={2.5} />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

/**
 * Знімок у «полароїдній» рамці: біле поле, м'яка тінь, легкий нахил.
 * Нахил не випадковий — він задається пропом, щоб два сусідні кадри
 * гарантовано хилилися в різні боки.
 */
function Snapshot({
  photo,
  alt,
  rotate,
}: {
  photo?: Photo;
  alt: string;
  rotate: number;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <motion.figure
      initial={{ opacity: 0, y: 30, rotate: 0 }}
      whileInView={{ opacity: 1, y: 0, rotate }}
      viewport={{ once: true, amount: 0.4 }}
      whileHover={{ rotate: 0, y: -6, scale: 1.03 }}
      transition={{ duration: 0.8, ease: easeSoft }}
      className="relative w-40 shrink-0 rounded-sm bg-ivory p-2.5 pb-7 shadow-lift sm:w-48"
    >
      <div className="relative aspect-square overflow-hidden bg-blush-50">
        {photo ? (
          <>
            {!loaded && (
              <span
                aria-hidden
                className="absolute inset-0 z-10 animate-shimmer bg-[linear-gradient(100deg,#F8E7E2_20%,#FDF4F2_40%,#F8E7E2_60%)] bg-[length:200%_100%]"
              />
            )}
            <Image
              src={photo.src}
              alt={alt}
              fill
              sizes="(max-width: 640px) 40vw, 200px"
              onLoad={() => setLoaded(true)}
              className="object-cover"
            />
          </>
        ) : (
          <div className="grain flex h-full w-full items-center justify-center bg-gradient-to-br from-blush-50 to-sage-100">
            <Botanical variant="eucalyptus" className="h-3/4 w-3/4 text-sage-300/80" />
          </div>
        )}
      </div>
    </motion.figure>
  );
}
