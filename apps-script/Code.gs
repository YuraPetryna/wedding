/**
 * ═══════════════════════════════════════════════════════════════════
 *  АЛЬТЕРНАТИВНИЙ БЕКЕНД — Google Apps Script
 * ═══════════════════════════════════════════════════════════════════
 *
 *  Це запасний варіант на випадок, якщо не хочеться возитися з OAuth
 *  і Vercel. Тоді фронтенд можна покласти на будь-який статичний хостинг,
 *  а цей скрипт працюватиме як безкоштовний бекенд.
 *
 *  ЧЕСНО ПРО ОБМЕЖЕННЯ (прочитайте до того, як обрати цей шлях):
 *
 *   • Файл летить у base64 → розмір зростає на ~33%. Ліміт тіла запиту
 *     в Apps Script ~50 МБ, тож реальна стеля на файл — приблизно 35 МБ.
 *     Відео з телефона в це часто НЕ вміщається.
 *   • Немає докачки після обриву зв'язку. Впав інтернет — файл з нуля.
 *   • Немає прогресу по чанках: браузер бачить лише один довгий запит.
 *   • Денна квота Apps Script на трафік — 50 МБ/добу для безкоштовних
 *     акаунтів на URL Fetch, а на запис у Drive ліміти теж скромніші.
 *     Для весілля на 100 гостей цього може не вистачити.
 *
 *  ЯКІСТЬ ФОТО тут теж оригінальна: Utilities.base64Decode повертає
 *  ті самі байти, DriveApp їх кладе як є. Стиснення немає ніде.
 *
 *  Основний варіант (Next.js + resumable upload) кращий за всіма
 *  пунктами вище. Використовуйте цей, лише якщо перший не підходить.
 *
 * ───────────────────────────────────────────────────────────────────
 *  ЯК РОЗГОРНУТИ
 *
 *  1. script.google.com → New project.
 *  2. Вставте цей код, замініть FOLDER_ID нижче.
 *  3. Deploy → New deployment → тип «Web app»:
 *       Execute as:      Me (ваш акаунт)
 *       Who has access:  Anyone
 *     Саме ця пара і дає анонімність: гість не входить у Google,
 *     а файл створюється від імені власника скрипта.
 *  4. Скопіюйте URL вигляду https://script.google.com/macros/s/.../exec
 *  5. Дозвольте доступ, коли Google попросить.
 * ═══════════════════════════════════════════════════════════════════
 */

/** ID папки на Диску, куди складати фото. */
var FOLDER_ID = 'ВСТАВТЕ_СЮДИ_ID_ПАПКИ';

/** ID таблиці для побажань. Залиште порожнім, якщо не потрібна. */
var SHEET_ID = '';

/** Створювати підпапку на кожного гостя. */
var GUEST_SUBFOLDERS = true;

/** Стеля на файл, байт. Вище — Apps Script просто не прийме запит. */
var MAX_BYTES = 35 * 1024 * 1024;

/* ------------------------------------------------------------------ */

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);

    var guest = String(payload.guest || '').trim().slice(0, 80);
    var wish = String(payload.wish || '').trim().slice(0, 500);
    var base64 = payload.data || '';
    var mimeType = payload.mimeType || 'application/octet-stream';
    var originalName = payload.name || 'photo.jpg';

    if (!base64) {
      return json({ error: 'Порожній файл' });
    }

    // base64 роздуває дані на ~33% — рахуємо реальний розмір.
    var approxBytes = Math.floor(base64.length * 0.75);
    if (approxBytes > MAX_BYTES) {
      return json({ error: 'Файл завеликий для цього бекенда (максимум ~35 МБ)' });
    }

    var folder = targetFolder(guest);

    var blob = Utilities.newBlob(
      Utilities.base64Decode(base64),
      mimeType,
      buildFileName(originalName, guest)
    );

    var file = folder.createFile(blob);
    file.setDescription(
      (guest ? 'Гість: ' + guest + '\n' : '') + (wish ? 'Побажання: ' + wish : '')
    );

    logWish(guest, wish, file.getName());

    return json({ ok: true, id: file.getId(), name: file.getName() });
  } catch (err) {
    return json({ error: String(err) });
  }
}

/** Apps Script не вміє CORS-preflight, тож GET служить перевіркою живості. */
function doGet() {
  return json({ ok: true, service: 'wedding-photo-drop' });
}

/* ------------------------------------------------------------------ */

function targetFolder(guest) {
  var root = DriveApp.getFolderById(FOLDER_ID);
  if (!GUEST_SUBFOLDERS || !guest) return root;

  var safe = sanitize(guest);
  var existing = root.getFoldersByName(safe);
  return existing.hasNext() ? existing.next() : root.createFolder(safe);
}

function buildFileName(originalName, guest) {
  var clean = sanitize(originalName);
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmmss');
  var who = guest ? sanitize(guest).replace(/\s+/g, '-') : '';
  return [stamp, who, clean].filter(String).join('_');
}

function sanitize(text) {
  return String(text).replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim();
}

function logWish(guest, wish, fileName) {
  if (!SHEET_ID) return;
  try {
    SpreadsheetApp.openById(SHEET_ID)
      .getSheets()[0]
      .appendRow([new Date(), guest || 'Анонімний гість', wish, fileName]);
  } catch (err) {
    // Побажання не критичні — фото вже збережене.
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
