#!/usr/bin/env node
/**
 * Тимчасові фонові зображення — «золота година» в розфокусі.
 *
 *   npm run placeholders
 *
 * Це НЕ спроба підробити фотографію. Це свідомо абстрактні м'які плями
 * світла: такий кадр читається як плівковий боке-фон, добре тримає текст
 * поверх себе і не виглядає як сіра заглушка. Рівно до того моменту, поки
 * ви не покладете справжні знімки пари.
 *
 * Замінити просто: киньте свої файли в public/photos і видаліть ті,
 * що мають у назві «placeholder».
 *
 *   npm run placeholders -- --clean     видалити згенеровані
 */

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const OUT_DIR = path.join(process.cwd(), "public", "photos");

/* Палітра золотої години: тепле світло, пил у повітрі, трохи зелені. */
const PALETTES = {
  goldenHour: {
    base: ["#7A5638", "#A8763F", "#C99A5B"],
    bokeh: ["#F5D9A8", "#E8B87A", "#FFF1D6", "#C98F5B", "#8FA37A"],
  },
  blushDusk: {
    base: ["#8C5F5A", "#B98277", "#D9A99A"],
    bokeh: ["#F8DFD4", "#EFC4B4", "#FFF3EC", "#C98D7E", "#A8B59A"],
  },
  sageMorning: {
    base: ["#5F6B55", "#8A9A79", "#B3C0A2"],
    bokeh: ["#E6EEDC", "#C7D6B6", "#FFFDF6", "#9AAE86", "#E8CFA8"],
  },
};

const TARGETS = [
  { name: "01-hero-placeholder.jpg", w: 2400, h: 1600, palette: "goldenHour", seed: 7, blur: 34 },
  { name: "02-portrait-placeholder.jpg", w: 1400, h: 1900, palette: "blushDusk", seed: 21, blur: 30 },
  { name: "03-placeholder.jpg", w: 1400, h: 1400, palette: "sageMorning", seed: 38, blur: 26 },
  { name: "04-placeholder.jpg", w: 1400, h: 1400, palette: "goldenHour", seed: 55, blur: 26 },
];

/* Детермінований псевдовипадок: та сама команда дає той самий результат. */
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

const svg = (w, h, body, defs = "") =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
      `<defs>${defs}</defs>${body}</svg>`,
  );

/** Шар 1: тло з великими плямами світла. Іде під сильне розмиття. */
function baseLayer({ w, h, palette, seed }) {
  const p = PALETTES[palette];
  const rand = rng(seed);
  const diag = Math.hypot(w, h);

  const defs =
    `<linearGradient id="bg" x1="0" y1="0" x2="0.6" y2="1">
      <stop offset="0%" stop-color="${p.base[0]}"/>
      <stop offset="55%" stop-color="${p.base[1]}"/>
      <stop offset="100%" stop-color="${p.base[2]}"/>
    </linearGradient>` +
    p.bokeh
      .slice(0, 3)
      .map(
        (tone, i) =>
          `<radialGradient id="glow${i}">
            <stop offset="0%" stop-color="${tone}" stop-opacity="0.9"/>
            <stop offset="100%" stop-color="${tone}" stop-opacity="0"/>
          </radialGradient>`,
      )
      .join("");

  const glows = Array.from({ length: 5 }, (_, i) => {
    const r = diag * (0.22 + rand() * 0.3);
    return `<circle cx="${rand() * w}" cy="${rand() * h}" r="${r}"
              fill="url(#glow${i % 3})" opacity="${0.35 + rand() * 0.35}"/>`;
  }).join("");

  return svg(w, h, `<rect width="${w}" height="${h}" fill="url(#bg)"/>${glows}`, defs);
}

/**
 * Шар 2: дрібні вогники на чорному. Накладається режимом screen — чорне
 * не додає нічого, а кола підсвічують кадр. Саме різниця в різкості між
 * цим шаром і тлом читається оком як глибина різкості, а не як градієнт.
 */
function bokehLayer({ w, h, palette, seed }) {
  const p = PALETTES[palette];
  const rand = rng(seed + 991);
  const diag = Math.hypot(w, h);

  const circles = Array.from({ length: 26 }, () => {
    // Степінь 2.6 зміщує розподіл до дрібних кіл: кілька великих,
    // решта — розсип, як у справжньому боке.
    const r = diag * (0.008 + rand() ** 2.6 * 0.06);
    const tone = p.bokeh[Math.floor(rand() * p.bokeh.length)];
    const opacity = 0.18 + rand() * 0.5;
    return (
      `<circle cx="${rand() * w}" cy="${rand() * h}" r="${r}" fill="${tone}" opacity="${opacity}"/>` +
      // Тонке яскравіше кільце по краю — характерна ознака боке.
      `<circle cx="${rand() * w}" cy="${rand() * h}" r="${r * 0.96}" fill="none"
               stroke="${tone}" stroke-width="${r * 0.09}" opacity="${opacity * 0.5}"/>`
    );
  }).join("");

  return svg(w, h, `<rect width="${w}" height="${h}" fill="#000000"/>${circles}`);
}

/** Шар 3: віньєтка. Найдешевший спосіб зробити кадр фотографічним. */
function vignetteLayer({ w, h }) {
  const defs = `<radialGradient id="v" cx="0.5" cy="0.46" r="0.78">
      <stop offset="45%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#1A120C" stop-opacity="0.62"/>
    </radialGradient>`;
  return svg(w, h, `<rect width="${w}" height="${h}" fill="url(#v)"/>`, defs);
}

/* ------------------------------------------------------------------ */

if (process.argv.includes("--clean")) {
  let removed = 0;
  for (const name of fs.existsSync(OUT_DIR) ? fs.readdirSync(OUT_DIR) : []) {
    if (name.includes("placeholder")) {
      fs.unlinkSync(path.join(OUT_DIR, name));
      removed += 1;
    }
  }
  console.log(`\n  Видалено тимчасових зображень: ${removed}\n`);
  process.exit(0);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

for (const t of TARGETS) {
  // Тло розмиваємо сильно, вогники — помітно слабше. Різниця в різкості
  // і дає ефект «знято на світлий об'єктив», а не «намальовано градієнтом».
  const background = await sharp(baseLayer(t)).blur(t.blur).png().toBuffer();
  const lights = await sharp(bokehLayer(t))
    .blur(t.blur * 0.42)
    .png()
    .toBuffer();

  await sharp(background)
    .composite([
      { input: lights, blend: "screen" },
      { input: vignetteLayer(t), blend: "over" },
    ])
    .modulate({ saturation: 1.14, brightness: 0.98 })
    .linear(1.08, -8) // трохи контрасту: світле світліше, тіні глибші
    .jpeg({ quality: 86, mozjpeg: true })
    .toFile(path.join(OUT_DIR, t.name));

  console.log(`  ✓ public/photos/${t.name}  ${t.w}×${t.h}`);
}

console.log(`
  Це тимчасові фони. Коли будуть справжні фото пари:
    1. покладіть їх у public/photos з іменами 01-, 02-, 03-, 04-
    2. npm run placeholders -- --clean
`);
