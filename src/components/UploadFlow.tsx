"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { limits } from "@/config/wedding";
import { formatBytes, UploadAbortedError, uploadToDrive } from "@/lib/uploader";
import Dropzone from "./Dropzone";
import FileCard from "./FileCard";
import GuestForm from "./GuestForm";
import SuccessOverlay from "./SuccessOverlay";
import Ornament from "./Ornament";
import { fadeUp, inView, stagger, tap } from "./motion";
import type { QueueItem, SessionResponse } from "./types";

/** Скільки файлів вантажимо водночас. 3 — компроміс між швидкістю
 *  і стабільністю мобільного зв'язку на святі. */
const CONCURRENCY = 3;

type Phase = "collect" | "uploading" | "success";

export default function UploadFlow({ anchorId }: { anchorId: string }) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [guest, setGuest] = useState("");
  const [wish, setWish] = useState("");
  const [phase, setPhase] = useState<Phase>("collect");
  const [banner, setBanner] = useState<string | null>(null);
  const [uploadedCount, setUploadedCount] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  // Дзеркало стану для асинхронних колбеків: після await замикання
  // тримало б застарілий список, а ref завжди актуальний.
  const itemsRef = useRef<QueueItem[]>([]);
  itemsRef.current = items;
  // Тримаємо object URL-и окремо, щоб гарантовано звільнити їх на unmount.
  const urlsRef = useRef<Set<string>>(new Set());

  /* ---------------- життєвий цикл ---------------- */

  useEffect(() => {
    const urls = urlsRef.current;
    return () => {
      abortRef.current?.abort();
      urls.forEach((u) => URL.revokeObjectURL(u));
      urls.clear();
    };
  }, []);

  // Попереджаємо, якщо гість закриває вкладку посеред завантаження.
  useEffect(() => {
    if (phase !== "uploading") return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [phase]);

  /* ---------------- черга ---------------- */

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      const files = Array.from(incoming);
      const rejected: string[] = [];

      setItems((prev) => {
        const seen = new Set(prev.map(keyOf));
        const next = [...prev];

        for (const file of files) {
          if (next.length >= limits.maxFilesPerBatch) {
            rejected.push(`більше ${limits.maxFilesPerBatch} файлів за раз`);
            break;
          }
          if (seen.has(keyOf({ file }))) continue; // цей файл уже в черзі
          if (file.size > limits.maxFileMb * 1024 * 1024) {
            rejected.push(`${file.name} — більше ${limits.maxFileMb} МБ`);
            continue;
          }
          if (file.size === 0) {
            rejected.push(`${file.name} — порожній файл`);
            continue;
          }

          seen.add(keyOf({ file }));
          next.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            file,
            previewUrl: makePreview(file, urlsRef.current),
            status: "queued",
            progress: 0,
          });
        }
        return next;
      });

      setBanner(
        rejected.length ? `Не додано: ${[...new Set(rejected)].slice(0, 3).join("; ")}` : null,
      );
    },
    [],
  );

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
        urlsRef.current.delete(target.previewUrl);
      }
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const patch = useCallback((id: string, changes: Partial<QueueItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...changes } : i)));
  }, []);

  /* ---------------- завантаження ---------------- */

  const uploadBatch = useCallback(
    async (batch: QueueItem[]) => {
      if (batch.length === 0) return 0;

      const controller = new AbortController();
      abortRef.current = controller;

      // Крок 1: одним запитом відкриваємо resumable-сесії на всі файли.
      let sessions: SessionResponse["sessions"];
      try {
        const res = await fetch("/api/upload-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            guest,
            wish,
            files: batch.map((i) => ({
              name: i.file.name,
              mimeType: i.file.type || "application/octet-stream",
              size: i.file.size,
            })),
          }),
          signal: controller.signal,
        });

        const data = (await res.json()) as SessionResponse & { error?: string };
        if (!res.ok) throw new Error(data.error ?? `Сервер відповів ${res.status}`);
        sessions = data.sessions;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Не вдалося почати завантаження";
        batch.forEach((i) => patch(i.id, { status: "error", error: message }));
        setBanner(message);
        return 0;
      }

      // Крок 2: вантажимо байти напряму в Google, по CONCURRENCY водночас.
      batch.forEach((i) => patch(i.id, { status: "uploading", progress: 0, error: undefined }));

      let succeeded = 0;
      let cursor = 0;

      const worker = async () => {
        while (cursor < batch.length) {
          const index = cursor++;
          const item = batch[index];
          const session = sessions[index];

          try {
            await uploadToDrive({
              file: item.file,
              uploadUrl: session.uploadUrl,
              signal: controller.signal,
              onProgress: (p) => patch(item.id, { progress: p }),
            });
            succeeded += 1;
            patch(item.id, { status: "done", progress: 1, driveName: session.driveName });
          } catch (err) {
            if (err instanceof UploadAbortedError) {
              patch(item.id, { status: "queued", progress: 0 });
              return;
            }
            patch(item.id, {
              status: "error",
              error: err instanceof Error ? err.message : "Помилка завантаження",
            });
          }
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, batch.length) }, worker),
      );

      return succeeded;
    },
    [guest, wish, patch],
  );

  /** Книга побажань — окремо і без блокування: навіть якщо запит не пройде,
   *  фото вже на Диску, а ім'я з побажанням збережені в кожному файлі. */
  const logGuestbook = useCallback(
    (uploaded: number, fileNames: string[]) => {
      fetch("/api/guestbook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guest, wish, uploaded, fileNames }),
      }).catch(() => undefined);
    },
    [guest, wish],
  );

  const start = useCallback(async () => {
    const pending = itemsRef.current.filter(
      (i) => i.status === "queued" || i.status === "error",
    );
    if (pending.length === 0) return;

    const alreadyDone = itemsRef.current.filter((i) => i.status === "done").length;

    setBanner(null);
    setPhase("uploading");

    const succeeded = await uploadBatch(pending);
    const failed = pending.length - succeeded;

    if (succeeded > 0) {
      logGuestbook(
        succeeded,
        pending.map((i) => i.file.name),
      );
    }

    setUploadedCount(alreadyDone + succeeded);

    if (failed > 0) {
      // Показати екран подяки зараз означало б сховати те, що не долетіло.
      // Лишаємо гостя на місці: невдалі картки клікабельні для повтору.
      setPhase("collect");
      setBanner(
        succeeded > 0
          ? `Завантажено ${succeeded} з ${pending.length}. Торкніться рожевих карток, щоб надіслати решту ще раз.`
          : "Не вдалося завантажити фото. Перевірте зв'язок і спробуйте ще раз.",
      );
      return;
    }

    setPhase("success");
  }, [uploadBatch, logGuestbook]);

  const retryOne = useCallback(
    async (id: string) => {
      const item = itemsRef.current.find((i) => i.id === id);
      if (!item) return;

      setBanner(null);
      const succeeded = await uploadBatch([item]);
      if (succeeded === 0) return;

      logGuestbook(1, [item.file.name]);

      // Якщо це був останній проблемний файл — гість заслужив свій екран подяки.
      // Статус щойно надісланого файлу підставляємо самі: React міг ще не
      // встигнути перерендерити, і ref повернув би картину «до повтору».
      const rest = itemsRef.current.map((i) =>
        i.id === id ? { ...i, status: "done" as const } : i,
      );
      setUploadedCount(rest.filter((i) => i.status === "done").length);
      if (!rest.some((i) => i.status === "queued" || i.status === "error")) {
        setPhase("success");
      }
    },
    [uploadBatch, logGuestbook],
  );

  const reset = useCallback(() => {
    items.forEach((i) => {
      if (i.previewUrl) {
        URL.revokeObjectURL(i.previewUrl);
        urlsRef.current.delete(i.previewUrl);
      }
    });
    setItems([]);
    setWish("");
    setPhase("collect");
    setBanner(null);
    requestAnimationFrame(() => {
      document.getElementById(anchorId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [items, anchorId]);

  /* ---------------- похідні значення ---------------- */

  const stats = useMemo(() => {
    const pending = items.filter((i) => i.status === "queued" || i.status === "error");
    const totalBytes = items.reduce((sum, i) => sum + i.file.size, 0);
    // Зважений прогрес: великий файл важить більше за маленький.
    const sentBytes = items.reduce((sum, i) => sum + i.file.size * i.progress, 0);
    return {
      pendingCount: pending.length,
      doneCount: items.filter((i) => i.status === "done").length,
      errorCount: items.filter((i) => i.status === "error").length,
      totalBytes,
      overall: totalBytes ? sentBytes / totalBytes : 0,
    };
  }, [items]);

  // Повтор одного файлу не змінює phase, але кнопку «Надіслати»
  // на цей час теж треба заблокувати.
  const busy = phase === "uploading" || items.some((i) => i.status === "uploading");

  return (
    <section id={anchorId} className="relative px-5 pb-40 pt-10 sm:px-6">
      <motion.div
        {...inView}
        variants={stagger(0.1)}
        className="card-soft mx-auto flex w-full max-w-xl flex-col gap-7 p-6 sm:p-8"
      >
        <motion.header variants={fadeUp} className="flex flex-col items-center text-center">
          <h2 className="font-display text-3xl font-light text-ink-900 sm:text-4xl">
            Ваші кадри цього дня
          </h2>
          <div className="mt-4 flex w-full justify-center">
            <Ornament />
          </div>
          <p className="mt-4 max-w-sm text-balance text-sm leading-relaxed text-ink-600">
            Оберіть фото — вони підуть на Диск молодят в оригінальній якості.
            Нічого встановлювати чи реєструватися не треба.
          </p>
        </motion.header>

        <GuestForm
          guest={guest}
          wish={wish}
          onGuestChange={setGuest}
          onWishChange={setWish}
          disabled={busy}
        />

        <Dropzone onFiles={addFiles} disabled={busy} compact={items.length > 0} />

        {/* Попередження про відхилені файли */}
        <AnimatePresence>
          {banner && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <p className="rounded-2xl bg-blush-50 px-4 py-3 text-sm text-blush-500">{banner}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Сітка прев'ю */}
        <AnimatePresence initial={false}>
          {items.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-3"
            >
              <div className="flex items-baseline justify-between">
                <span className="text-[0.7rem] uppercase tracking-[0.18em] text-ink-400">
                  Обрано {items.length}
                </span>
                <span className="text-xs tabular-nums text-ink-400">
                  {formatBytes(stats.totalBytes)}
                </span>
              </div>

              <motion.ul
                layout
                className="grid grid-cols-3 gap-2.5 sm:grid-cols-4"
              >
                <AnimatePresence mode="popLayout">
                  {items.map((item) => (
                    <FileCard
                      key={item.id}
                      item={item}
                      onRemove={removeItem}
                      onRetry={retryOne}
                    />
                  ))}
                </AnimatePresence>
              </motion.ul>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Липка панель дії */}
      <AnimatePresence>
        {items.length > 0 && phase !== "success" && (
          <motion.div
            initial={{ y: 110, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 110, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
          >
            <div className="mx-auto flex w-full max-w-xl items-center gap-3 rounded-full border border-white/70 bg-white/95 p-2 pl-5 shadow-lift">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink-800">
                  {busy
                    ? `Завантажуємо… ${Math.round(stats.overall * 100)}%`
                    : stats.doneCount > 0 && stats.pendingCount > 0
                      ? `Ще ${stats.pendingCount} у черзі`
                      : `${items.length} до відправки`}
                </p>
                {/* Тонка смуга загального прогресу */}
                <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-blush-100">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-blush-300 to-sage-400"
                    animate={{ width: `${stats.overall * 100}%` }}
                    transition={{ type: "spring", stiffness: 120, damping: 26 }}
                  />
                </div>
              </div>

              <motion.button
                type="button"
                onClick={start}
                disabled={busy || stats.pendingCount === 0}
                whileTap={busy ? undefined : tap}
                className="btn-primary shrink-0 px-6 py-3.5 text-sm"
              >
                {busy ? <Spinner /> : <SendIcon />}
                <span className="relative">{busy ? "Зачекайте" : "Надіслати"}</span>
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {phase === "success" && (
          <SuccessOverlay count={uploadedCount} guest={guest} onMore={reset} />
        )}
      </AnimatePresence>
    </section>
  );
}

/* ---------------------------- helpers ---------------------------- */

/** Ключ дедуплікації: той самий файл не додасться двічі. */
function keyOf(i: { file: File }) {
  return `${i.file.name}:${i.file.size}:${i.file.lastModified}`;
}

/** Прев'ю робимо лише для картинок — для відео браузер тягнув би весь файл. */
function makePreview(file: File, registry: Set<string>): string | undefined {
  if (!file.type.startsWith("image/")) return undefined;
  const url = URL.createObjectURL(file);
  registry.add(url);
  return url;
}

function Spinner() {
  return (
    <motion.span
      animate={{ rotate: 360 }}
      transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
      className="relative block h-[15px] w-[15px] rounded-full border-2 border-cream/30 border-t-cream"
    />
  );
}

function SendIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="relative"
      aria-hidden
    >
      <path d="M21 3L10.5 13.5" />
      <path d="M21 3l-6.8 18-3.7-7.5L3 9.8z" />
    </svg>
  );
}
