import { NextRequest, NextResponse } from "next/server";
import {
  ApiError,
  buildFileName,
  createResumableSession,
  ensureGuestFolder,
  getAccessToken,
  isAllowedMime,
  readEnv,
} from "@/lib/google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Відкриття 60 сесій — це 60 запитів до Google. Дефолтних 10 с може не вистачити.
export const maxDuration = 60;

type RequestedFile = { name: string; mimeType: string; size: number };
type Body = { guest?: string; wish?: string; files?: RequestedFile[] };

const MAX_FILES_PER_REQUEST = 60;

/* ------------------------------------------------------------------ */
/* Найпростіший rate limit: захист від випадкового шторму,             */
/* не від зловмисника. Пам'ять інстансу, тож best-effort.              */
/* ------------------------------------------------------------------ */

const WINDOW_MS = 60_000;
const MAX_SESSIONS_PER_WINDOW = 240;
const buckets = new Map<string, { count: number; resetAt: number }>();

function allow(ip: string, cost: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(ip);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(ip, { count: cost, resetAt: now + WINDOW_MS });
    if (buckets.size > 5000) buckets.clear();
    return true;
  }

  bucket.count += cost;
  return bucket.count <= MAX_SESSIONS_PER_WINDOW;
}

/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest) {
  try {
    const env = readEnv();
    const body = (await req.json()) as Body;

    const files = Array.isArray(body.files) ? body.files : [];
    if (files.length === 0) {
      throw new ApiError(400, "Не передано жодного файлу.");
    }
    if (files.length > MAX_FILES_PER_REQUEST) {
      throw new ApiError(400, `За один раз можна надіслати не більше ${MAX_FILES_PER_REQUEST} файлів.`);
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    if (!allow(ip, files.length)) {
      throw new ApiError(429, "Забагато запитів. Зачекайте хвилинку і спробуйте знову.");
    }

    const guest = (body.guest ?? "").toString().trim().slice(0, 80) || undefined;
    const wish = (body.wish ?? "").toString().trim().slice(0, 500) || undefined;

    for (const f of files) {
      if (!f || typeof f.name !== "string" || typeof f.size !== "number") {
        throw new ApiError(400, "Некоректний опис файлу.");
      }
      if (f.size <= 0) {
        throw new ApiError(400, `Файл «${f.name}» порожній.`);
      }
      if (f.size > env.maxFileBytes) {
        const mb = Math.round(env.maxFileBytes / 1024 / 1024);
        throw new ApiError(413, `Файл «${f.name}» більший за ${mb} МБ.`);
      }
      if (!isAllowedMime(f.mimeType ?? "")) {
        throw new ApiError(415, `Тип файлу «${f.name}» не підтримується. Надсилайте фото або відео.`);
      }
    }

    const token = await getAccessToken(env);

    const parentId =
      env.createGuestSubfolders && guest
        ? await ensureGuestFolder(env, token, guest)
        : env.folderId;

    // Google дозволяє відкривати сесії паралельно — робимо це одним заходом,
    // щоб гість не чекав на послідовні round-trip'и.
    const origin = req.headers.get("origin") ?? undefined;
    const now = new Date();

    const sessions = await Promise.all(
      files.map(async (f) => {
        const driveName = buildFileName(f.name, guest, now);
        const uploadUrl = await createResumableSession({
          env,
          token,
          parentId,
          fileName: driveName,
          mimeType: f.mimeType || "application/octet-stream",
          size: f.size,
          guest,
          wish,
          origin,
        });
        return { name: f.name, driveName, uploadUrl };
      }),
    );

    return NextResponse.json({ sessions }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}

function errorResponse(err: unknown) {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error("upload-session failed:", err);
  return NextResponse.json(
    { error: "Несподівана помилка сервера. Спробуйте ще раз." },
    { status: 500 },
  );
}
