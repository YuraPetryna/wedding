/**
 * Уся «текстова» частина сайту — в одному місці.
 * Значення можна перевизначити через змінні оточення NEXT_PUBLIC_* (див. .env.example),
 * але за замовчуванням достатньо відредагувати цей файл.
 */

/**
 * Змінна оточення, якої «немає», — це не лише undefined.
 * У Vercel цілком звично додати ключ і лишити значення порожнім, поки воно
 * ще невідоме. Оператор ?? такий рядок пропускає далі як валідний, і далі
 * він ламає все, куди потрапить. Тому скрізь читаємо env тільки через ці
 * помічники: порожнє й пробільне вважаємо відсутнім.
 */
function envText(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function envNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value?.trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function envUrl(value: string | undefined, fallback: string): string {
  const candidate = value?.trim();
  if (candidate) {
    try {
      new URL(candidate);
      return candidate;
    } catch {
      // Криву адресу мовчки замінюємо запасною: через неї в next/metadata
      // падає вся збірка, а користі від падіння тут нуль.
    }
  }
  return fallback;
}

/** Vercel сам віддає адресу деплою — зручний проміжний запасний варіант. */
const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL?.trim();

export const wedding = {
  bride: envText(process.env.NEXT_PUBLIC_BRIDE, "Олена"),
  groom: envText(process.env.NEXT_PUBLIC_GROOM, "Андрій"),
  /** Формат: YYYY-MM-DD */
  date: envText(process.env.NEXT_PUBLIC_WEDDING_DATE, "2026-09-12"),
  hashtag: envText(process.env.NEXT_PUBLIC_HASHTAG, "#ОленаІАндрій2026"),
  siteUrl: envUrl(
    process.env.NEXT_PUBLIC_SITE_URL,
    vercelUrl ? `https://${vercelUrl}` : "https://example.vercel.app",
  ),
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
  maxFileMb: envNumber(process.env.NEXT_PUBLIC_MAX_FILE_MB, 512),
  maxFilesPerBatch: 60,
};
