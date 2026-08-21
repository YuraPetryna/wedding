/**
 * Мінімальний клієнт Google API на fetch — без важкої залежності googleapis.
 *
 * Автентифікація: OAuth2 refresh_token акаунта наречених.
 * Чому не Service Account: у сервісного акаунта немає власної квоти Google Drive,
 * тож завантажені ним файли або впираються в 0 байт квоти, або потребують
 * Shared Drive (тільки Google Workspace). Refresh token звичайного Gmail-акаунта
 * працює безкоштовно, і файли одразу лежать «у наречених».
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

export type Env = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  folderId: string;
  sheetId?: string;
  createGuestSubfolders: boolean;
  maxFileBytes: number;
};

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function readEnv(): Env {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const folderId = process.env.DRIVE_FOLDER_ID;

  const missing = Object.entries({
    GOOGLE_CLIENT_ID: clientId,
    GOOGLE_CLIENT_SECRET: clientSecret,
    GOOGLE_REFRESH_TOKEN: refreshToken,
    DRIVE_FOLDER_ID: folderId,
  })
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length) {
    throw new ApiError(500, `Не налаштовані змінні оточення: ${missing.join(", ")}`);
  }

  return {
    clientId: clientId!,
    clientSecret: clientSecret!,
    refreshToken: refreshToken!,
    folderId: folderId!,
    sheetId: process.env.GUESTBOOK_SHEET_ID?.trim() || undefined,
    createGuestSubfolders: process.env.CREATE_GUEST_SUBFOLDERS?.trim() !== "false",
    maxFileBytes: positiveNumber(process.env.MAX_FILE_MB, 512) * 1024 * 1024,
  };
}

/**
 * Порожня змінна оточення дала б Number("") === 0, а з нульовим лімітом
 * сервер відхиляв би геть усі фото зі словами «більший за 0 МБ».
 * Тому будь-що, крім додатного числа, вважаємо незаданим.
 */
function positiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value?.trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/* ------------------------------------------------------------------ */
/* Access token з кешем у пам'яті інстансу                             */
/* ------------------------------------------------------------------ */

let tokenCache: { token: string; expiresAt: number } | null = null;

export async function getAccessToken(env: Env): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) return tokenCache.token;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.clientId,
      client_secret: env.clientSecret,
      refresh_token: env.refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiError(
      502,
      `Google відхилив refresh_token (${res.status}). Перевипустіть його: npm run auth. ${text.slice(0, 300)}`,
    );
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = {
    token: data.access_token,
    // Оновлюємо за 60 секунд до реального закінчення.
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return tokenCache.token;
}

/* ------------------------------------------------------------------ */
/* Папки                                                               */
/* ------------------------------------------------------------------ */

const folderCache = new Map<string, string>();

/** Знаходить або створює підпапку з іменем гостя всередині кореневої папки. */
export async function ensureGuestFolder(
  env: Env,
  token: string,
  guestName: string,
): Promise<string> {
  const safe = sanitizeName(guestName).slice(0, 80) || "Без імені";
  const cacheKey = `${env.folderId}/${safe}`;
  const cached = folderCache.get(cacheKey);
  if (cached) return cached;

  const escaped = safe.split("'").join("\\'");
  const q = [
    `'${env.folderId}' in parents`,
    `mimeType = 'application/vnd.google-apps.folder'`,
    `name = '${escaped}'`,
    "trashed = false",
  ].join(" and ");

  const search = await fetch(
    `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1` +
      `&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );

  if (search.ok) {
    const { files } = (await search.json()) as { files?: { id: string }[] };
    if (files?.length) {
      folderCache.set(cacheKey, files[0].id);
      return files[0].id;
    }
  }

  const created = await fetch(`${DRIVE_API}/files?fields=id&supportsAllDrives=true`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: safe,
      mimeType: "application/vnd.google-apps.folder",
      parents: [env.folderId],
    }),
  });

  // Не критично: якщо підпапку створити не вдалося, складемо файли в корінь.
  if (!created.ok) return env.folderId;

  const { id } = (await created.json()) as { id: string };
  folderCache.set(cacheKey, id);
  return id;
}

/* ------------------------------------------------------------------ */
/* Resumable upload session                                            */
/* ------------------------------------------------------------------ */

/**
 * Створює resumable-сесію та повертає її URI.
 *
 * Ключова ідея архітектури: байти файлу НІКОЛИ не йдуть через наш сервер.
 * Браузер гостя вантажить їх напряму на сервери Google за цим URI.
 * Це обходить ліміт тіла запиту Vercel (4.5 МБ) і гарантує оригінальну
 * якість — ми ніде не декодуємо й не перепаковуємо зображення.
 */
export async function createResumableSession(opts: {
  env: Env;
  token: string;
  parentId: string;
  fileName: string;
  mimeType: string;
  size: number;
  guest?: string;
  wish?: string;
  origin?: string;
}): Promise<string> {
  const { env, token, parentId, fileName, mimeType, size, guest, wish, origin } = opts;
  void env;

  const metadata = {
    name: fileName,
    parents: [parentId],
    description: [guest && `Гість: ${guest}`, wish && `Побажання: ${wish}`]
      .filter(Boolean)
      .join("\n"),
    appProperties: {
      guest: (guest ?? "").slice(0, 120),
      wish: (wish ?? "").slice(0, 120),
      source: "wedding-photo-drop",
    },
  };

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json; charset=UTF-8",
    "X-Upload-Content-Type": mimeType,
    "X-Upload-Content-Length": String(size),
  };
  // Передаємо Origin гостя, щоб Google повернув коректні CORS-заголовки
  // для подальшого PUT напряму з браузера.
  if (origin) headers.Origin = origin;

  const res = await fetch(
    `${DRIVE_UPLOAD}?uploadType=resumable&supportsAllDrives=true&fields=id,name,webViewLink`,
    { method: "POST", headers, body: JSON.stringify(metadata), cache: "no-store" },
  );

  const location = res.headers.get("location");
  if (!res.ok || !location) {
    const text = await res.text().catch(() => "");
    throw new ApiError(
      502,
      `Google Drive не відкрив сесію завантаження (${res.status}). ${text.slice(0, 300)}`,
    );
  }
  return location;
}

/* ------------------------------------------------------------------ */
/* Книга побажань (Google Sheets, опційно)                             */
/* ------------------------------------------------------------------ */

export async function appendGuestbookRow(
  env: Env,
  token: string,
  row: (string | number)[],
): Promise<void> {
  if (!env.sheetId) return;

  const url =
    `${SHEETS_API}/${env.sheetId}/values/A1:F1:append` +
    `?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: [row] }),
  });

  if (!res.ok) {
    // Побажання — приємний бонус, а не критичний шлях: логуємо й не падаємо.
    console.error("Guestbook append failed:", res.status, await res.text().catch(() => ""));
  }
}

/* ------------------------------------------------------------------ */
/* Утиліти                                                             */
/* ------------------------------------------------------------------ */

/** Символи, які ламають імена файлів у Drive, Windows та macOS. */
const FORBIDDEN = new Set([..."\\/:*?\"<>|"]);

/** Прибирає керуючі й заборонені символи, схлопує пробіли. */
export function sanitizeName(raw: string): string {
  const cleaned = Array.from(raw)
    .map((ch) => {
      const code = ch.charCodeAt(0);
      if (code < 32 || code === 127) return " ";
      return FORBIDDEN.has(ch) ? " " : ch;
    })
    .join("");

  return cleaned.split(" ").filter(Boolean).join(" ");
}

/** `Оля Петренко` + `IMG_0042.HEIC` -> `2026-09-12_214305_Оля-Петренко_IMG_0042.heic` */
export function buildFileName(
  originalName: string,
  guest: string | undefined,
  now: Date,
): string {
  const clean = sanitizeName(originalName) || "photo.jpg";
  const dot = clean.lastIndexOf(".");
  const base = (dot > 0 ? clean.slice(0, dot) : clean).slice(0, 60).trim();
  const ext = dot > 0 ? clean.slice(dot).toLowerCase() : "";

  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

  const who = guest ? sanitizeName(guest).slice(0, 40).split(" ").join("-") : "";
  return [stamp, who, base].filter(Boolean).join("_") + ext;
}

const ALLOWED_PREFIXES = ["image/", "video/"];
const ALLOWED_EXACT = new Set([
  // Деякі Android-браузери віддають HEIC/DNG саме так.
  "application/octet-stream",
  "",
]);

export function isAllowedMime(mime: string): boolean {
  return ALLOWED_PREFIXES.some((p) => mime.startsWith(p)) || ALLOWED_EXACT.has(mime);
}
