import { NextRequest, NextResponse } from "next/server";
import { ApiError, appendGuestbookRow, getAccessToken, readEnv } from "@/lib/google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  guest?: string;
  wish?: string;
  uploaded?: number;
  fileNames?: string[];
};

/**
 * Записує ім'я та побажання гостя окремим рядком у Google Таблицю.
 * Викликається один раз, коли всі файли партії вже на Диску.
 *
 * Це необов'язковий шлях: ім'я і побажання вже збережені в назві файлу,
 * в описі та в appProperties кожного фото. Якщо GUESTBOOK_SHEET_ID не заданий
 * або таблиця недоступна, гість цього навіть не помітить.
 */
export async function POST(req: NextRequest) {
  try {
    // Це фоновий виклик, який клієнт навіть не читає. Якщо Google не
    // налаштований — тихо пропускаємо, а не засмічуємо логи п'ятисотками.
    let env;
    try {
      env = readEnv();
    } catch {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const body = (await req.json()) as Body;

    const guest = (body.guest ?? "").toString().trim().slice(0, 80);
    const wish = (body.wish ?? "").toString().trim().slice(0, 1000);
    const uploaded = Number(body.uploaded) || 0;
    const fileNames = Array.isArray(body.fileNames) ? body.fileNames.slice(0, 60) : [];

    if (!guest && !wish && uploaded === 0) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    if (!env.sheetId) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const token = await getAccessToken(env);
    await appendGuestbookRow(env, token, [
      new Date().toISOString(),
      guest || "Анонімний гість",
      wish,
      uploaded,
      fileNames.join(", ").slice(0, 40000),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("guestbook failed:", err);
    // Побажання не повинні ламати радість від успішного завантаження.
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
