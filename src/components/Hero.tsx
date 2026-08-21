"use client";

import Image from "next/image";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { wedding, prettyDate } from "@/config/wedding";
import type { Photo } from "@/lib/photos";
import Botanical from "./Botanical";
import Ornament from "./Ornament";
import { fadeUp, letterIn, stagger, tap } from "./motion";

/** Розбиває рядок на літери; whitespace-pre зберігає пробіли між словами. */
function Letters({ text, delay = 0 }: { text: string; delay?: number }) {
  return (
    <motion.span
      variants={stagger(0.045, delay)}
      initial="hidden"
      animate="show"
      className="inline-block"
      aria-label={text}
    >
      {Array.from(text).map((ch, i) => (
        <motion.span key={i} variants={letterIn} className="inline-block whitespace-pre" aria-hidden>
          {ch}
        </motion.span>
      ))}
    </motion.span>
  );
}

export default function Hero({ onStart, cover }: { onStart: () => void; cover?: Photo }) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const onPhoto = Boolean(cover);

  // Легкий паралакс: шапка «відпливає» повільніше за скрол.
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", "22%"]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.75], [1, 0]);
  // Фон їде повільніше за текст — класичний прийом глибини.
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "12%"]);

  /* Дві палітри тексту: поверх фото світла, на кремовому тлі — темна. */
  const tone = onPhoto
    ? {
        eyebrow: "text-cream/75",
        title: "text-ivory",
        amp: "text-gold-300",
        date: "text-cream/90",
        body: "text-cream/85",
        hint: "text-cream/60",
        chevron: "text-cream/70",
        ornament: "text-gold-300",
        button:
          "relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-ivory px-8 py-4 text-base font-medium tracking-wide text-ink-900 shadow-lift",
      }
    : {
        eyebrow: "text-ink-400",
        title: "text-ink-900",
        amp: "text-gold-400",
        date: "text-ink-600",
        body: "text-ink-600",
        hint: "text-ink-400",
        chevron: "text-ink-400",
        ornament: "text-gold-400",
        button: "btn-primary",
      };

  return (
    <section
      ref={ref}
      className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-6 py-20 text-center"
    >
      {/* ---------- фон ---------- */}
      {cover ? (
        <motion.div
          aria-hidden
          style={reduce ? undefined : { y: bgY }}
          className="absolute inset-0 -z-[1]"
        >
          <motion.div
            className="absolute inset-0"
            initial={{ scale: 1.12 }}
            animate={{ scale: 1 }}
            transition={{ duration: 2.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <Image src={cover.src} alt="" fill priority sizes="100vw" className="object-cover" />
          </motion.div>
          {/* Затемнення заради читабельності тексту, а не заради ефекту:
              згори і знизу щільніше, у центрі фото лишається відкритим. */}
          <div className="absolute inset-0 bg-gradient-to-b from-ink-900/70 via-ink-900/35 to-ink-900/75" />
          <div className="grain absolute inset-0" />
        </motion.div>
      ) : (
        /* Без фото герой тримається на ботаніці — порожнечі не лишається. */
        <>
          <Botanical
            variant="eucalyptus"
            delay={1.6}
            className="pointer-events-none absolute -left-12 top-4 h-56 w-56 text-sage-300/55 sm:h-80 sm:w-80"
          />
          <Botanical
            variant="eucalyptus"
            flip
            delay={1.9}
            className="pointer-events-none absolute -right-12 bottom-4 h-56 w-56 text-sage-300/55 sm:h-80 sm:w-80"
          />
        </>
      )}

      {/* ---------- контент ---------- */}
      <motion.div
        style={reduce ? undefined : { y: contentY, opacity: contentOpacity }}
        className="relative flex w-full max-w-2xl flex-col items-center"
      >
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className={`text-[0.7rem] uppercase tracking-[0.42em] ${tone.eyebrow}`}
        >
          Наше весілля
        </motion.p>

        <h1
          className={`mt-7 font-display text-[clamp(2.9rem,13vw,5.5rem)] font-light leading-[1.05] ${tone.title}`}
        >
          <Letters text={wedding.bride} delay={0.25} />
          <motion.span
            initial={{ opacity: 0, scale: 0.5, rotate: -12 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ delay: 0.75, type: "spring", stiffness: 200, damping: 14 }}
            className={`mx-3 inline-block align-middle font-display sm:mx-5 ${tone.amp}`}
          >
            &amp;
          </motion.span>
          <Letters text={wedding.groom} delay={0.9} />
        </h1>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.35, duration: 0.8 }}
          className="mt-8 flex w-full justify-center"
        >
          <Ornament className={tone.ornament} />
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className={`mt-6 font-display text-xl tracking-[0.2em] ${tone.date}`}
        >
          {prettyDate(wedding.date)}
        </motion.p>

        <motion.div
          variants={stagger(0.12, 1.7)}
          initial="hidden"
          animate="show"
          className="mt-12 flex w-full flex-col items-center"
        >
          <motion.p
            variants={fadeUp}
            className={`max-w-md text-balance text-[0.98rem] leading-relaxed ${tone.body}`}
          >
            Найкращі кадри цього дня — у ваших телефонах. Поділіться ними з нами:
            фото збережуться в оригінальній якості, реєстрація не потрібна.
          </motion.p>

          <motion.div variants={fadeUp} className="mt-10">
            <motion.button
              type="button"
              onClick={onStart}
              whileTap={tap}
              whileHover={{ y: -3 }}
              transition={{ type: "spring", stiffness: 420, damping: 28 }}
              className={`group ${tone.button}`}
            >
              {/* Світловий блик, що пробігає по кнопці на ховері */}
              <span
                className={`absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent to-transparent transition-transform duration-[900ms] group-hover:translate-x-full ${
                  onPhoto ? "via-ink-900/10" : "via-white/25"
                }`}
              />
              <CameraIcon />
              <span className="relative">Додати фото</span>
            </motion.button>
          </motion.div>

          <motion.p variants={fadeUp} className={`mt-5 text-xs tracking-wide ${tone.hint}`}>
            {wedding.hashtag}
          </motion.p>
        </motion.div>
      </motion.div>

      {/* Підказка «гортай нижче» */}
      <motion.button
        type="button"
        onClick={onStart}
        aria-label="Прокрутити до завантаження"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.4, duration: 1 }}
        className={`absolute bottom-8 left-1/2 -translate-x-1/2 p-3 ${tone.chevron}`}
      >
        <motion.span
          animate={reduce ? undefined : { y: [0, 7, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="block"
        >
          <ChevronDown />
        </motion.span>
      </motion.button>
    </section>
  );
}

function CameraIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="relative"
      aria-hidden
    >
      <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.2a1 1 0 0 0 .83-.45l.94-1.4A1 1 0 0 1 9.3 3.7h5.4a1 1 0 0 1 .83.45l.94 1.4a1 1 0 0 0 .83.45h1.2A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z" />
      <circle cx="12" cy="12.5" r="3.4" />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
