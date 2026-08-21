import fs from "node:fs";
import path from "node:path";

/**
 * Фотографії пари беруться з теки public/photos — просто киньте файли туди.
 * Ніяких конфігів і списків: тека читається на сервері під час збірки,
 * файли сортуються за іменем.
 *
 * Рекомендований порядок імен:
 *   01-hero.jpg   — горизонтальна, піде фоном на перший екран
 *   02.jpg, 03.jpg, ...  — решта, підуть у колаж
 */

const PHOTO_DIR = path.join(process.cwd(), "public", "photos");
const EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);

export type Photo = {
  src: string;
  /** Ім'я файлу без розширення — іде в alt, якщо нічого кращого немає */
  label: string;
};

export function getPhotos(): Photo[] {
  if (!fs.existsSync(PHOTO_DIR)) return [];

  return fs
    .readdirSync(PHOTO_DIR)
    .filter((name) => EXTENSIONS.has(path.extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, "uk"))
    .map((name) => ({
      src: `/photos/${name}`,
      label: path.basename(name, path.extname(name)),
    }));
}
