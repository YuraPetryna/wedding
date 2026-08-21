#!/usr/bin/env node
/**
 * Одноразове налаштування Google для весільного фото-дропу.
 *
 * Що робить:
 *   1. Проводить наречених через вхід у Google і забирає refresh_token.
 *   2. Створює папку для фото.
 *   3. Створює таблицю «Книга побажань» усередині цієї папки.
 *   4. Друкує готовий блок для .env.local (і пропонує його дописати).
 *
 * Запуск:  npm run auth
 *
 * ВАЖЛИВО про scope. Використовуємо лише drive.file — це НЕ «чутливий»
 * scope у класифікації Google. Наслідки:
 *   • застосунок можна перевести в «In production» без перевірки Google;
 *   • refresh_token не протухає через 7 днів (як у режимі Testing);
 *   • застосунок бачить тільки те, що сам створив, а не весь Диск.
 * Саме тому папку й таблицю створює цей скрипт, а не людина руками:
 * інакше drive.file до них доступу не матиме.
 */

import http from "node:http";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const PORT = 53682;
const SCOPE = "https://www.googleapis.com/auth/drive.file";
const ENV_FILE = path.resolve(process.cwd(), ".env.local");

/**
 * --redirect https://ваш-сайт/oauth/callback
 *
 * Потрібен, коли наречені підтверджують доступ з телефона. Мобільні браузери
 * на редіректі в localhost або впираються в помилку, або взагалі нікуди не
 * переходять, і дістати код із рядка адреси пальцем неможливо. Сторінка
 * /oauth/callback на самому сайті відкривається будь-де й має кнопку
 * «Скопіювати код».
 *
 * Важливо: для такого redirect_uri потрібен OAuth-клієнт типу
 * «Web application» — Desktop app приймає лише localhost.
 */
const redirectFlag = process.argv.indexOf("--redirect");
const CUSTOM_REDIRECT =
  redirectFlag !== -1 ? process.argv[redirectFlag + 1] : undefined;

const REDIRECT_URI = CUSTOM_REDIRECT ?? `http://localhost:${PORT}/callback`;

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
};

/* Створюємо інтерфейс лише за першим питанням: інакше сам імпорт цього
   файлу (наприклад, з тесту) тримав би процес живим назавжди. */
let rl;
const ask = (question) => {
  rl ??= readline.createInterface({ input, output });
  return rl.question(question);
};

/**
 * --manual: наречені підтверджують доступ зі свого пристрою, а не з вашого,
 * і надсилають вам код. Власний --redirect означає manual автоматично:
 * локальний сервер у такому разі ніхто не викличе.
 */
const MANUAL = process.argv.includes("--manual") || Boolean(CUSTOM_REDIRECT);

/** Дістає code з повної адреси, на яку Google перекинув наречених. */
export function extractCode(pasted, expectedState) {
  if (!pasted) throw new Error("Порожній рядок");

  // Приймаємо і повну адресу, і голий код — люди вставляють по-різному.
  if (!pasted.includes("?") && !pasted.includes("=")) return pasted;

  let params;
  try {
    params = new URL(pasted).searchParams;
  } catch {
    // Могли вставити «хвіст» без схеми: /callback?code=...
    params = new URLSearchParams(pasted.slice(pasted.indexOf("?") + 1));
  }

  const error = params.get("error");
  if (error) throw new Error(`Google повернув відмову: ${error}`);

  const code = params.get("code");
  if (!code) {
    // Найчастіша помилка: адресу скопіювали ще на сторінці згоди, до того
    // як натиснули «Дозволити». Коду там ще фізично немає — тому не просто
    // кажемо «немає code», а пояснюємо, що саме зробити.
    if (pasted.includes("accounts.google.com")) {
      throw new Error(
        "Це адреса сторінки згоди, а не результат.\n" +
          "  Спочатку треба натиснути «Дозволити» і дочекатися наступного екрана —\n" +
          "  сторінки з кнопкою «Скопіювати код» або помилки «Не вдається\n" +
          "  відкрити сайт». Копіювати потрібно вже там.",
      );
    }
    throw new Error("У цій адресі немає параметра code");
  }

  const state = params.get("state");
  if (state && state !== expectedState) {
    throw new Error("Адреса з іншої спроби входу — попросіть надіслати свіжу");
  }
  return code;
}

async function main() {
  console.log(c.bold("\n  Налаштування Google Drive для весільного сайту\n"));
  console.log(
    c.dim(
      "  Спершу створіть OAuth-клієнт типу «Desktop app» у Google Cloud Console\n" +
        "  (докладна інструкція — в README, розділ «Крок 1»).\n" +
        "  Якщо наречені не поруч, запустіть з прапорцем --manual.\n",
    ),
  );

  const existing = readEnvFile();

  const clientId = (
    await ask(prompt("Client ID", existing.GOOGLE_CLIENT_ID))
  ).trim() || existing.GOOGLE_CLIENT_ID;

  const clientSecret = (
    await ask(prompt("Client secret", existing.GOOGLE_CLIENT_SECRET))
  ).trim() || existing.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error(c.red("\n  Без Client ID і Client secret продовжити не вийде.\n"));
    process.exit(1);
  }

  const folderName =
    (await ask(prompt("Назва папки на Диску", "Весілля — фото від гостей"))).trim() ||
    "Весілля — фото від гостей";

  /* -------------------- 1. OAuth -------------------- */

  const state = Math.random().toString(36).slice(2);
  const authUrl =
    "https://accounts.google.com/o/oauth2/v2/auth?" +
    new URLSearchParams({
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: SCOPE,
      access_type: "offline",
      // prompt=consent змушує Google видати refresh_token навіть якщо
      // цей акаунт уже давав дозвіл раніше.
      prompt: "consent",
      state,
    });

  let code;

  if (MANUAL) {
    console.log(c.bold("\n  РУЧНИЙ РЕЖИМ\n"));
    console.log(c.dim(`  Редірект: ${REDIRECT_URI}\n`));
    console.log("  Надішліть нареченим це посилання:\n");
    console.log("  " + c.cyan(authUrl) + "\n");

    console.log(
      c.dim(
        CUSTOM_REDIRECT
          ? "  Вони увійдуть, дозволять доступ і потраплять на сторінку з\n" +
              "  кнопкою «Скопіювати код». Нехай надішлють вам те, що скопіюють.\n" +
              "  Працює і з телефона.\n"
          : "  Вони увійдуть, дозволять доступ і побачать сторінку помилки\n" +
              "  «Не вдається відкрити сайт» — так і має бути. Нехай скопіюють\n" +
              "  УСЮ адресу з рядка адреси й надішлють вам.\n" +
              "  З телефона це часто не працює: тоді запустіть скрипт із\n" +
              "  --redirect https://ваш-сайт/oauth/callback\n",
      ),
    );

    // Даємо кілька спроб: інакше одна невдала вставка означала б повний
    // перезапуск і нове посилання, яке треба знову надсилати нареченим.
    const ATTEMPTS = 5;
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      const pasted = (await ask("  Вставте адресу (або лише code): ")).trim();
      try {
        code = extractCode(pasted, state);
        break;
      } catch (err) {
        console.log(c.red(`\n  ${err.message}\n`));
        if (attempt === ATTEMPTS) throw err;
        console.log(c.dim(`  Спроба ${attempt} з ${ATTEMPTS}. Спробуйте ще раз.\n`));
      }
    }
  } else {
    console.log(c.bold("\n  Відкриваю браузер. Увійдіть акаунтом НАРЕЧЕНИХ.\n"));
    console.log(c.dim("  Якщо вікно не відкрилось — скопіюйте посилання:\n"));
    console.log("  " + c.cyan(authUrl) + "\n");
    openBrowser(authUrl);

    code = await waitForCode(state);
  }

  console.log(c.green("  ✓ Дозвіл отримано"));

  /* -------------------- 2. Обмін коду на токени -------------------- */

  const tokens = await postForm("https://oauth2.googleapis.com/token", {
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: REDIRECT_URI,
    grant_type: "authorization_code",
  });

  if (!tokens.refresh_token) {
    console.error(
      c.red(
        "\n  Google не повернув refresh_token.\n" +
          "  Заберіть доступ на https://myaccount.google.com/permissions і запустіть скрипт ще раз.\n",
      ),
    );
    process.exit(1);
  }
  console.log(c.green("  ✓ refresh_token отримано"));

  const access = tokens.access_token;

  /* -------------------- 3. Папка -------------------- */

  const folder = await api("https://www.googleapis.com/drive/v3/files?fields=id,name", access, {
    name: folderName,
    mimeType: "application/vnd.google-apps.folder",
  });
  console.log(c.green(`  ✓ Папку створено: ${folder.name}`));

  /* -------------------- 4. Книга побажань -------------------- */

  let sheetId = "";
  try {
    const sheet = await api("https://www.googleapis.com/drive/v3/files?fields=id", access, {
      name: "Книга побажань",
      mimeType: "application/vnd.google-apps.spreadsheet",
      parents: [folder.id],
    });
    sheetId = sheet.id;

    await api(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A1?valueInputOption=RAW`,
      access,
      { values: [["Час", "Гість", "Побажання", "Файлів", "Імена файлів"]] },
      "PUT",
    );
    console.log(c.green("  ✓ Таблицю «Книга побажань» створено"));
  } catch (err) {
    console.log(c.dim(`  · Таблицю пропущено (${err.message}) — сайт працюватиме й без неї`));
  }

  /* -------------------- 5. Результат -------------------- */

  const env = [
    `GOOGLE_CLIENT_ID=${clientId}`,
    `GOOGLE_CLIENT_SECRET=${clientSecret}`,
    `GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`,
    `DRIVE_FOLDER_ID=${folder.id}`,
    sheetId ? `GUESTBOOK_SHEET_ID=${sheetId}` : "# GUESTBOOK_SHEET_ID=",
  ].join("\n");

  console.log(c.bold("\n  Готово. Ось ваші змінні оточення:\n"));
  console.log(env.split("\n").map((l) => "  " + l).join("\n"));
  console.log(
    "\n  " + c.cyan(`Папка на Диску: https://drive.google.com/drive/folders/${folder.id}`) + "\n",
  );

  const save = (await ask(`  Дописати це у ${path.basename(ENV_FILE)}? [Y/n] `))
    .trim()
    .toLowerCase();

  if (save === "" || save === "y" || save === "yes" || save === "т") {
    const prefix = fs.existsSync(ENV_FILE) ? "\n" : "";
    fs.appendFileSync(ENV_FILE, prefix + env + "\n", "utf8");
    console.log(c.green(`\n  ✓ Записано у ${ENV_FILE}`));
    console.log(c.dim("    Цей файл у .gitignore — у репозиторій він не потрапить.\n"));
  } else {
    console.log(c.dim("\n  Скопіюйте значення вручну в .env.local та в налаштування Vercel.\n"));
  }

  rl?.close();
}

/* ------------------------------------------------------------------ */
/* Допоміжне                                                          */
/* ------------------------------------------------------------------ */

function prompt(label, current) {
  return current
    ? `  ${label} ${c.dim(`[${String(current).slice(0, 18)}…]`)}: `
    : `  ${label}: `;
}

function readEnvFile() {
  if (!fs.existsSync(ENV_FILE)) return {};
  const out = {};
  for (const line of fs.readFileSync(ENV_FILE, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    out[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return out;
}

/** Піднімає локальний сервер і чекає, поки Google перекине на нього код. */
function waitForCode(expectedState) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${PORT}`);
      if (url.pathname !== "/callback") {
        res.writeHead(404).end();
        return;
      }

      const error = url.searchParams.get("error");
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(page(error ? "Щось пішло не так" : "Готово!", error ?? "Можна закрити цю вкладку."));

      server.close();
      if (error) reject(new Error(error));
      else if (state !== expectedState) reject(new Error("state не збігається"));
      else resolve(code);
    });

    server.on("error", (err) =>
      reject(
        new Error(
          err.code === "EADDRINUSE"
            ? `Порт ${PORT} зайнятий. Закрийте програму, що його тримає, і спробуйте ще раз.`
            : err.message,
        ),
      ),
    );

    server.listen(PORT, "127.0.0.1");
  });
}

function page(title, subtitle) {
  return `<!doctype html><html lang="uk"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<body style="margin:0;height:100vh;display:grid;place-items:center;background:#FBF7F2;
             font-family:system-ui,sans-serif;color:#38312D;text-align:center">
  <div>
    <div style="font-size:44px">💍</div>
    <h1 style="font-weight:400;margin:16px 0 8px">${title}</h1>
    <p style="color:#8A817B;margin:0">${subtitle}</p>
  </div>
</body></html>`;
}

async function postForm(url, params) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description ?? data.error ?? `HTTP ${res.status}`);
  return data;
}

async function api(url, token, body, method = "POST") {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message ?? `HTTP ${res.status}`);
  return data;
}

function openBrowser(url) {
  const cmd =
    process.platform === "win32" ? "cmd" : process.platform === "darwin" ? "open" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  try {
    spawn(cmd, args, { detached: true, stdio: "ignore" }).unref();
  } catch {
    // Не біда — посилання вже надруковане вище.
  }
}

// Запускаємо, лише коли файл викликали напряму: так extractCode можна
// імпортувати з тестів, не тягнучи за собою весь інтерактивний сценарій.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(c.red(`\n  Помилка: ${err.message}\n`));
    rl?.close();
    process.exit(1);
  });
}
