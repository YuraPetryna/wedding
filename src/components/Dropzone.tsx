"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useCallback, useRef, useState } from "react";
import { fadeUp, tap } from "./motion";

/**
 * Дві дії в один дотик: обрати з галереї або зняти камерою.
 * Drag-and-drop — бонус для десктопа; на телефоні працюють кнопки.
 */
export default function Dropzone({
  onFiles,
  disabled,
  compact,
}: {
  onFiles: (files: FileList | File[]) => void;
  disabled?: boolean;
  /** Компактний вигляд, коли в черзі вже є фото */
  compact?: boolean;
}) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      if (disabled) return;
      if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files);
    },
    [disabled, onFiles],
  );

  // dragenter/dragleave спрацьовують на кожному вкладеному елементі —
  // рахуємо глибину, інакше рамка блимає.
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current += 1;
    if (!disabled) setDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };

  const pick = (ref: React.RefObject<HTMLInputElement | null>) => () => {
    if (disabled) return;
    ref.current?.click();
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) onFiles(e.target.files);
    // Скидаємо, щоб повторний вибір того самого файлу теж спрацював.
    e.target.value = "";
  };

  return (
    <motion.div variants={fadeUp} className="w-full">
      <input
        ref={galleryRef}
        type="file"
        accept="image/*,video/*"
        multiple
        hidden
        onChange={onInputChange}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        // capture відкриває камеру одразу, минаючи галерею
        capture="environment"
        hidden
        onChange={onInputChange}
      />

      <motion.div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        animate={{
          scale: dragging ? 1.015 : 1,
          borderColor: dragging ? "#D69A8E" : "#F0D2CA",
          backgroundColor: dragging ? "rgba(253,244,242,0.9)" : "rgba(255,255,255,0.55)",
        }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        className={`relative flex flex-col items-center justify-center rounded-3xl border-2 border-dashed ${
          compact ? "gap-3 px-5 py-6" : "gap-4 px-6 py-10"
        }`}
      >
        <AnimatePresence mode="wait">
          {!compact && (
            <motion.div
              key="icon"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center gap-3"
            >
              <motion.div
                animate={
                  dragging
                    ? { y: -6, rotate: -4, scale: 1.08 }
                    : { y: [0, -5, 0], rotate: 0, scale: 1 }
                }
                transition={
                  dragging
                    ? { type: "spring", stiffness: 320, damping: 18 }
                    : { duration: 4.5, repeat: Infinity, ease: "easeInOut" }
                }
                className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blush-100 to-sage-100 text-ink-600 shadow-soft"
              >
                <UploadIcon />
              </motion.div>

              <p className="text-center text-sm text-ink-600">
                {dragging ? "Відпустіть — і готово" : "Перетягніть фото сюди"}
              </p>
              <span className="text-[11px] uppercase tracking-[0.2em] text-ink-400">або</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:justify-center">
          <motion.button
            type="button"
            onClick={pick(galleryRef)}
            disabled={disabled}
            whileTap={tap}
            whileHover={{ y: -2 }}
            className="btn-ghost flex-1 sm:flex-none"
          >
            <GalleryIcon />
            Обрати з галереї
          </motion.button>

          <motion.button
            type="button"
            onClick={pick(cameraRef)}
            disabled={disabled}
            whileTap={tap}
            whileHover={{ y: -2 }}
            className="btn-ghost flex-1 sm:flex-none"
          >
            <ShutterIcon />
            Зняти зараз
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ---------------------------- іконки ---------------------------- */

const s = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function UploadIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" {...s} aria-hidden>
      <path d="M12 16V4.5" />
      <path d="M7.5 9L12 4.5 16.5 9" />
      <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" />
    </svg>
  );
}

function GalleryIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" {...s} aria-hidden>
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="M4 17l5-5 4 4 2.5-2.5L20 17" />
    </svg>
  );
}

function ShutterIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" {...s} aria-hidden>
      <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.2a1 1 0 0 0 .83-.45l.94-1.4A1 1 0 0 1 9.3 3.7h5.4a1 1 0 0 1 .83.45l.94 1.4a1 1 0 0 0 .83.45h1.2A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z" />
      <circle cx="12" cy="12.5" r="3.4" />
    </svg>
  );
}
