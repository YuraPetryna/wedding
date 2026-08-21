"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { formatBytes } from "@/lib/uploader";
import { cardIn, springSnappy, tap } from "./motion";
import ProgressRing from "./ProgressRing";
import type { QueueItem } from "./types";

export default function FileCard({
  item,
  onRemove,
  onRetry,
}: {
  item: QueueItem;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  const [previewFailed, setPreviewFailed] = useState(false);
  const showPreview = Boolean(item.previewUrl) && !previewFailed;
  const busy = item.status === "uploading";

  return (
    <motion.li
      layout
      variants={cardIn}
      initial="hidden"
      animate="show"
      exit="exit"
      transition={springSnappy}
      className="group relative aspect-square overflow-hidden rounded-2xl bg-blush-50 shadow-soft"
    >
      {showPreview ? (
        <motion.img
          src={item.previewUrl}
          alt={item.file.name}
          loading="lazy"
          decoding="async"
          onError={() => setPreviewFailed(true)}
          initial={{ opacity: 0, scale: 1.08 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="h-full w-full object-cover"
        />
      ) : (
        /* HEIC з iPhone та відео браузер часто не показує — не біда,
           на Диск файл усе одно піде в оригіналі. */
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-sage-100 text-sage-500">
          {item.file.type.startsWith("video/") ? <FilmIcon /> : <ImageIcon />}
          <span className="px-2 text-center text-[10px] leading-tight text-sage-500">
            {item.file.name.split(".").pop()?.toUpperCase()}
          </span>
        </div>
      )}

      {/* Затемнення + індикатор під час завантаження */}
      <AnimatePresence>
        {busy && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-ink-900/55"
          >
            <ProgressRing progress={item.progress} />
            <span className="text-[11px] font-medium tabular-nums text-cream">
              {Math.round(item.progress * 100)}%
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Успіх */}
      <AnimatePresence>
        {item.status === "done" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-sage-400/45"
          >
            <motion.span
              initial={{ scale: 0, rotate: -25 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 16 }}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-ivory/95 text-sage-500 shadow-soft"
            >
              <CheckIcon />
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Помилка з можливістю повторити */}
      <AnimatePresence>
        {item.status === "error" && (
          <motion.button
            type="button"
            onClick={() => onRetry(item.id)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            whileTap={tap}
            title={item.error}
            className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-blush-500/90 px-2 text-center text-cream"
          >
            <RetryIcon />
            <span className="text-[11px] font-medium">Повторити</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Видалити — доступно, поки файл ще не пішов */}
      {item.status !== "done" && !busy && (
        <motion.button
          type="button"
          onClick={() => onRemove(item.id)}
          whileTap={tap}
          aria-label={`Прибрати ${item.file.name}`}
          className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-ink-900/70 text-cream opacity-0 transition-opacity duration-200 focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-100"
        >
          <CloseIcon />
        </motion.button>
      )}

      {/* Розмір файлу знизу — щоб гість розумів, що саме летить */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-900/55 to-transparent px-2 pb-1.5 pt-5">
        <span className="text-[10px] font-medium tabular-nums text-cream/90">
          {formatBytes(item.file.size)}
        </span>
      </div>
    </motion.li>
  );
}

/* ---------------------------- іконки ---------------------------- */

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" {...stroke} aria-hidden>
      <motion.path
        d="M5 12.5l4.5 4.5L19 7.5"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.45, delay: 0.1, ease: "easeOut" }}
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" {...stroke} strokeWidth={2.2} aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function RetryIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" {...stroke} aria-hidden>
      <path d="M20 12a8 8 0 1 1-2.5-5.8" />
      <path d="M20 4v4.5h-4.5" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" {...stroke} aria-hidden>
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <circle cx="8.5" cy="9.5" r="1.6" />
      <path d="M4 17l5-5 4 4 2.5-2.5L20 17" />
    </svg>
  );
}

function FilmIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" {...stroke} aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M10 9.5l5 2.5-5 2.5z" />
    </svg>
  );
}
