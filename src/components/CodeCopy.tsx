"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRef, useState } from "react";
import { tap } from "./motion";

/**
 * Код + кнопка «Скопіювати».
 *
 * Головний сценарій — телефон, тому окрім navigator.clipboard тут є запасний
 * шлях через прихований textarea і document.execCommand: clipboard API мовчки
 * не працює поза HTTPS і в частині мобільних вебв'ю. А ще код показано в полі,
 * яке можна виділити пальцем — на випадок, якщо не спрацює жоден із двох.
 */
export default function CodeCopy({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = () => {
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2600);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      flash();
      return;
    } catch {
      // Нижче — запасний шлях.
    }

    const field = fieldRef.current;
    if (!field) return;
    field.focus();
    field.select();
    field.setSelectionRange(0, value.length);
    try {
      if (document.execCommand("copy")) flash();
    } catch {
      // Не вийшло скопіювати — текст лишається виділеним, можна вручну.
    }
  };

  return (
    <div className="flex w-full flex-col gap-3">
      <textarea
        ref={fieldRef}
        readOnly
        rows={3}
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        aria-label="Код доступу"
        className="w-full resize-none break-all rounded-2xl border border-blush-100 bg-white/80
                   p-3.5 text-center font-mono text-[11px] leading-relaxed text-ink-600
                   outline-none focus:border-blush-300 focus:ring-4 focus:ring-blush-100/60"
      />

      <motion.button
        type="button"
        onClick={copy}
        whileTap={tap}
        className="btn-primary w-full"
      >
        <AnimatePresence mode="wait" initial={false}>
          {copied ? (
            <motion.span
              key="done"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="relative flex items-center gap-2"
            >
              <CheckIcon />
              Скопійовано
            </motion.span>
          ) : (
            <motion.span
              key="copy"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="relative flex items-center gap-2"
            >
              <CopyIcon />
              Скопіювати код
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function CopyIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" {...stroke} aria-hidden>
      <rect x="9" y="9" width="11" height="11" rx="2.5" />
      <path d="M15 5.5A1.5 1.5 0 0 0 13.5 4h-8A1.5 1.5 0 0 0 4 5.5v8A1.5 1.5 0 0 0 5.5 15" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" {...stroke} aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}
