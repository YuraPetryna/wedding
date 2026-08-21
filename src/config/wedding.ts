/**
 * Уся «текстова» частина сайту — в одному місці.
 * Значення можна перевизначити через змінні оточення NEXT_PUBLIC_* (див. .env.example),
 * але за замовчуванням достатньо відредагувати цей файл.
 */
export const wedding = {
  bride: process.env.NEXT_PUBLIC_BRIDE ?? "Олена",
  groom: process.env.NEXT_PUBLIC_GROOM ?? "Андрій",
  /** Формат: YYYY-MM-DD */
  date: process.env.NEXT_PUBLIC_WEDDING_DATE ?? "2026-09-12",
  hashtag: process.env.NEXT_PUBLIC_HASHTAG ?? "#ОленаІАндрій2026",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.vercel.app",
} as const;

export const prettyDate = (iso: string) => {
  const months = [
    "січня", "лютого", "березня", "квітня", "травня", "червня",
    "липня", "серпня", "вересня", "жовтня", "листопада", "грудня",
  ];
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

/** Ліміти, які має знати клієнт (сервер перевіряє їх ще раз). */
export const limits = {
  maxFileMb: Number(process.env.NEXT_PUBLIC_MAX_FILE_MB ?? 512),
  maxFilesPerBatch: 60,
};
