#!/usr/bin/env node
/**
 * Генерує QR-код на сайт і готову до друку картку для столів.
 *
 * Запуск:
 *   npm run qr -- https://nashe-vesillya.vercel.app
 *   npm run qr                      (візьме NEXT_PUBLIC_SITE_URL з .env.local)
 *
 * На виході:
 *   public/qr.svg          — сам код, векторний
 *   public/qr.png          — те саме растром, 1200 px (для месенджерів)
 *   public/table-card.html — A6-картка: відкрити в браузері і надрукувати
 *
 * Рівень корекції помилок — H (30%). Це важливо: на святі картку заллють
 * шампанським, і код усе одно має читатися.
 */

import fs from "node:fs";
import path from "node:path";
import QRCode from "qrcode";

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, "public");

function readEnv(key) {
  const file = path.join(ROOT, ".env.local");
  if (!fs.existsSync(file)) return undefined;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith(`${key}=`)) return trimmed.slice(key.length + 1).trim();
  }
  return undefined;
}

const url = process.argv[2] || readEnv("NEXT_PUBLIC_SITE_URL");

if (!url || !url.startsWith("http")) {
  console.error(
    "\n  Вкажіть адресу сайту:\n" +
      "    npm run qr -- https://nashe-vesillya.vercel.app\n" +
      "  або задайте NEXT_PUBLIC_SITE_URL у .env.local\n",
  );
  process.exit(1);
}

const bride = readEnv("NEXT_PUBLIC_BRIDE") || "Олена";
const groom = readEnv("NEXT_PUBLIC_GROOM") || "Андрій";

const options = {
  errorCorrectionLevel: "H",
  margin: 1,
  color: { dark: "#38312D", light: "#FFFFFF" },
};

fs.mkdirSync(PUBLIC_DIR, { recursive: true });

const svg = await QRCode.toString(url, { ...options, type: "svg", width: 600 });
fs.writeFileSync(path.join(PUBLIC_DIR, "qr.svg"), svg, "utf8");

await QRCode.toFile(path.join(PUBLIC_DIR, "qr.png"), url, { ...options, width: 1200 });

const dataUrl = await QRCode.toDataURL(url, { ...options, width: 900 });
fs.writeFileSync(path.join(PUBLIC_DIR, "table-card.html"), card({ url, bride, groom, dataUrl }), "utf8");

console.log(`
  ✓ public/qr.svg
  ✓ public/qr.png
  ✓ public/table-card.html   ← відкрийте у браузері та натисніть Ctrl+P

  Код веде на: ${url}
`);

/* ------------------------------------------------------------------ */

function card({ url, bride, groom, dataUrl }) {
  return `<!doctype html>
<html lang="uk">
<meta charset="utf-8">
<title>Картка на стіл — ${bride} та ${groom}</title>
<style>
  /* Дві картки A6 на аркуш A5, або чотири на A4 — ріжеться навпіл. */
  @page { size: A6; margin: 0; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: Georgia, "Times New Roman", serif;
    color: #38312D;
    background: #EFEAE3;
  }
  .card {
    width: 105mm;
    height: 148mm;
    padding: 12mm 10mm;
    margin: 0 auto 6mm;
    background: #FBF7F2;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    text-align: center;
    page-break-after: always;
    border: 0.4mm solid #E3CDA0;
  }
  .eyebrow { font-size: 8pt; letter-spacing: 0.4em; text-transform: uppercase; color: #8A817B;
             font-family: system-ui, sans-serif; }
  .names { font-size: 26pt; font-weight: 400; margin: 4mm 0 0; line-height: 1.15; }
  .amp { color: #CFAE73; }
  .rule { width: 28mm; height: 0.3mm; background: #E3CDA0; margin: 5mm auto; }
  .qr { width: 55mm; height: 55mm; display: block; }
  .frame { padding: 4mm; background: #fff; border-radius: 3mm;
           box-shadow: 0 1mm 3mm rgba(56,49,45,0.10); }
  .cta { font-size: 13pt; margin: 5mm 0 2mm; }
  .hint { font-size: 8.5pt; color: #5B534E; line-height: 1.6; font-family: system-ui, sans-serif;
          max-width: 72mm; }
  .url { font-size: 7pt; color: #8A817B; font-family: ui-monospace, monospace; word-break: break-all; }
  @media screen {
    body { padding: 10mm; }
    .card { box-shadow: 0 4mm 16mm rgba(0,0,0,0.14); }
  }
</style>

${[1, 2]
  .map(
    () => `<div class="card">
  <div>
    <div class="eyebrow">Наше весілля</div>
    <h1 class="names">${bride} <span class="amp">&amp;</span> ${groom}</h1>
    <div class="rule"></div>
  </div>

  <div class="frame">
    <img class="qr" src="${dataUrl}" alt="QR-код">
  </div>

  <div>
    <div class="cta">Наведіть камеру — і поділіться фото</div>
    <p class="hint">
      Ваші знімки одразу потраплять до нас в оригінальній якості.
      Реєструватися не потрібно.
    </p>
    <div class="url">${url}</div>
  </div>
</div>`,
  )
  .join("\n")}
</html>`;
}
