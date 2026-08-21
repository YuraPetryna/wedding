import type { Easing, Transition, Variants } from "framer-motion";

/**
 * Спільна «мова руху» сайту. Один набір кривих і затримок на всі компоненти —
 * саме це дає відчуття цілісності, а не набору окремих ефектів.
 */

/** М'яке сповільнення без пружності — для появи контенту. */
export const easeSoft: Easing = [0.22, 1, 0.36, 1];

/** Пружина для інтерактиву: натискань, перемикань, layout-переїздів. */
export const springSnappy: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 32,
  mass: 0.7,
};

export const springGentle: Transition = {
  type: "spring",
  stiffness: 180,
  damping: 24,
};

/* ------------------------------------------------------------------ */
/* Каскад появи                                                        */
/* ------------------------------------------------------------------ */

export const stagger = (staggerChildren = 0.08, delayChildren = 0): Variants => ({
  hidden: {},
  show: {
    transition: { staggerChildren, delayChildren },
  },
});

/**
 * Поява знизу вгору.
 *
 * Без анімації filter: blur() — свідомо. Раніше вона тут була, і виглядало
 * гарно, але це найдорожчий спосіб отримати дуже скромний ефект: кожен із
 * двадцяти з гаком елементів, що використовують цей варіант, на час анімації
 * вимагає власного офскрін-буфера, а текст доводиться растеризувати заново.
 * Safari на iOS від такого напливу вичерпував пам'ять і вивантажував вкладку.
 * Зсув плюс прозорість дають практично те саме відчуття задарма.
 */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.75, ease: easeSoft },
  },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.9, ease: easeSoft } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.94 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.6, ease: easeSoft },
  },
};

/** Поява картки файлу в сітці + акуратний вихід при видаленні. */
export const cardIn: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.9 },
  show: { opacity: 1, y: 0, scale: 1, transition: springGentle },
  exit: {
    opacity: 0,
    scale: 0.85,
    transition: { duration: 0.22, ease: "easeIn" },
  },
};

/** Побуквений вихід імен у шапці. */
export const letterIn: Variants = {
  hidden: { opacity: 0, y: 18, rotate: 2 },
  show: {
    opacity: 1,
    y: 0,
    rotate: 0,
    transition: { duration: 0.9, ease: easeSoft },
  },
};

/** Малювання SVG-лінії від нуля до повної довжини. */
export const drawPath: Variants = {
  hidden: { pathLength: 0, opacity: 0 },
  show: {
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: { duration: 1.6, ease: easeSoft },
      opacity: { duration: 0.3 },
    },
  },
};

/** Тактильний відгук на дотик — однаковий на всіх кнопках. */
export const tap = { scale: 0.96 };
export const hoverLift = { y: -2 };

/** Налаштування whileInView, щоб не дублювати в кожному блоці. */
export const inView = {
  initial: "hidden" as const,
  whileInView: "show" as const,
  viewport: { once: true, amount: 0.25 },
};
