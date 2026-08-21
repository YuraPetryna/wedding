/**
 * Завантаження файлу напряму в Google Drive через resumable-сесію.
 *
 * Байти йдуть з браузера гостя одразу на сервери Google — наш бекенд лише
 * відкриває сесію. Наслідки:
 *   1. Файл потрапляє на Диск байт-у-байт, без жодного перекодування.
 *   2. Ми не впираємось у ліміт тіла запиту serverless-функції (4.5 МБ на Vercel).
 *   3. Прогрес рахується з реальних подій XHR, а не «на око».
 */

/** Кратно 256 КБ — вимога Google для проміжних чанків. */
const CHUNK_SIZE = 8 * 256 * 1024; // 2 МБ
/** Файли, менші за це, вантажимо одним запитом: менше точок відмови. */
const SINGLE_SHOT_LIMIT = 24 * 1024 * 1024; // 24 МБ
const MAX_RETRIES = 4;

export type DriveFile = {
  id: string;
  name: string;
  webViewLink?: string;
};

export type UploadOptions = {
  file: File;
  uploadUrl: string;
  /** progress у діапазоні 0..1 */
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
};

export class UploadAbortedError extends Error {
  constructor() {
    super("Завантаження скасовано");
    this.name = "UploadAbortedError";
  }
}

/* ------------------------------------------------------------------ */
/* Публічний API                                                       */
/* ------------------------------------------------------------------ */

export async function uploadToDrive(opts: UploadOptions): Promise<DriveFile> {
  const { file, uploadUrl, onProgress, signal } = opts;
  const contentType = file.type || "application/octet-stream";

  if (file.size <= SINGLE_SHOT_LIMIT) {
    const res = await sendChunk({
      uploadUrl,
      body: file,
      contentType,
      signal,
      onProgress: (loaded, total) => onProgress?.(total ? loaded / total : 0),
    });

    if (isSuccess(res.status)) {
      onProgress?.(1);
      return parseDriveFile(res.responseText, file.name);
    }
    throw new Error(describeFailure(res));
  }

  return uploadChunked(opts, contentType);
}

/* ------------------------------------------------------------------ */
/* Чанковане завантаження з відновленням після обриву                  */
/* ------------------------------------------------------------------ */

async function uploadChunked(opts: UploadOptions, contentType: string): Promise<DriveFile> {
  const { file, uploadUrl, onProgress, signal } = opts;
  const total = file.size;
  let offset = 0;
  let attempts = 0;

  while (offset < total) {
    throwIfAborted(signal);

    const end = Math.min(offset + CHUNK_SIZE, total);
    const chunk = file.slice(offset, end);
    const chunkStart = offset;

    let res: XhrResult;
    try {
      res = await sendChunk({
        uploadUrl,
        body: chunk,
        contentType,
        signal,
        contentRange: `bytes ${chunkStart}-${end - 1}/${total}`,
        onProgress: (loaded) => onProgress?.((chunkStart + loaded) / total),
      });
    } catch (err) {
      if (err instanceof UploadAbortedError) throw err;
      // Мережа впала — з'ясовуємо в Google, скільки байтів він реально отримав.
      if (++attempts > MAX_RETRIES) throw err;
      await backoff(attempts);
      offset = await queryUploadedOffset(uploadUrl, total, signal, offset);
      continue;
    }

    if (isSuccess(res.status)) {
      onProgress?.(1);
      return parseDriveFile(res.responseText, file.name);
    }

    if (res.status === 308) {
      attempts = 0;
      // Range: bytes=0-262143 -> наступний офсет = 262144
      const range = res.headers["range"];
      const confirmed = range ? Number(range.split("-").pop()) + 1 : NaN;
      offset = Number.isFinite(confirmed) && confirmed > offset ? confirmed : end;
      onProgress?.(offset / total);
      continue;
    }

    if (isRetryable(res.status)) {
      if (++attempts > MAX_RETRIES) throw new Error(describeFailure(res));
      await backoff(attempts);
      offset = await queryUploadedOffset(uploadUrl, total, signal, offset);
      continue;
    }

    throw new Error(describeFailure(res));
  }

  // Усі байти надіслані, але фінальної відповіді не було — уточнюємо статус.
  const probe = await queryStatus(uploadUrl, total, signal);
  if (isSuccess(probe.status)) return parseDriveFile(probe.responseText, file.name);
  throw new Error(describeFailure(probe));
}

/** Питає Google `скільки ти вже отримав?` і повертає офсет для продовження. */
async function queryUploadedOffset(
  uploadUrl: string,
  total: number,
  signal: AbortSignal | undefined,
  fallback: number,
): Promise<number> {
  try {
    const res = await queryStatus(uploadUrl, total, signal);
    if (res.status === 308) {
      const range = res.headers["range"];
      if (range) {
        const next = Number(range.split("-").pop()) + 1;
        if (Number.isFinite(next)) return next;
      }
      // Google отримав нуль байтів — починаємо файл спочатку.
      return 0;
    }
  } catch {
    // Не змогли дізнатись — пробуємо з того ж місця.
  }
  return fallback;
}

function queryStatus(
  uploadUrl: string,
  total: number,
  signal: AbortSignal | undefined,
): Promise<XhrResult> {
  return sendChunk({
    uploadUrl,
    body: null,
    contentType: null,
    signal,
    contentRange: `bytes */${total}`,
  });
}

/* ------------------------------------------------------------------ */
/* XHR-обгортка (fetch не вміє прогрес аплоаду)                        */
/* ------------------------------------------------------------------ */

type XhrResult = {
  status: number;
  responseText: string;
  headers: Record<string, string>;
};

function sendChunk(args: {
  uploadUrl: string;
  body: Blob | null;
  contentType: string | null;
  signal?: AbortSignal;
  contentRange?: string;
  onProgress?: (loaded: number, total: number) => void;
}): Promise<XhrResult> {
  const { uploadUrl, body, contentType, signal, contentRange, onProgress } = args;

  return new Promise<XhrResult>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new UploadAbortedError());
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl, true);
    if (contentType) xhr.setRequestHeader("Content-Type", contentType);
    if (contentRange) xhr.setRequestHeader("Content-Range", contentRange);

    const onAbort = () => xhr.abort();
    signal?.addEventListener("abort", onAbort, { once: true });

    const cleanup = () => signal?.removeEventListener("abort", onAbort);

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(e.loaded, e.total);
      };
    }

    xhr.onload = () => {
      cleanup();
      resolve({
        status: xhr.status,
        responseText: xhr.responseText,
        headers: parseHeaders(xhr.getAllResponseHeaders()),
      });
    };

    xhr.onerror = () => {
      cleanup();
      reject(new Error("Немає зв'язку з Google. Перевірте інтернет і спробуйте ще раз."));
    };

    xhr.ontimeout = () => {
      cleanup();
      reject(new Error("Час очікування вичерпано."));
    };

    xhr.onabort = () => {
      cleanup();
      reject(new UploadAbortedError());
    };

    xhr.send(body);
  });
}

function parseHeaders(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of raw.trim().split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    out[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Дрібниці                                                            */
/* ------------------------------------------------------------------ */

const isSuccess = (status: number) => status === 200 || status === 201;
const isRetryable = (status: number) =>
  status === 0 || status === 408 || status === 429 || status >= 500;

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new UploadAbortedError();
}

const backoff = (attempt: number) =>
  new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** (attempt - 1), 8000)));

function parseDriveFile(responseText: string, fallbackName: string): DriveFile {
  try {
    const parsed = JSON.parse(responseText) as DriveFile;
    if (parsed?.id) return parsed;
  } catch {
    // Google повернув успіх без тіла — не привід валити завантаження.
  }
  return { id: "", name: fallbackName };
}

function describeFailure(res: XhrResult): string {
  if (res.status === 401 || res.status === 403) {
    return "Сесія завантаження застаріла. Оновіть сторінку і спробуйте ще раз.";
  }
  if (res.status === 404) {
    return "Сесію завантаження не знайдено. Спробуйте додати фото заново.";
  }
  const detail = res.responseText ? ` ${res.responseText.slice(0, 160)}` : "";
  return `Google Drive повернув помилку ${res.status}.${detail}`;
}

/* ------------------------------------------------------------------ */
/* Форматування розміру для UI                                         */
/* ------------------------------------------------------------------ */

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} ГБ`;
}
