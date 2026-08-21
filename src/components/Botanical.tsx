"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import { easeSoft } from "./motion";

/**
 * Ботанічні гілки, які самі себе малюють.
 *
 * Листя не намальоване вручну по одному, а розставлене вздовж квадратичної
 * кривої Безьє: позиція береться з B(t), нахил — з дотичної B'(t), сторона
 * чергується. Через це гілка виглядає вирощеною, а не зібраною з копій,
 * і будь-яка зміна кривої одразу дає нову природну форму.
 */

type Point = [number, number];

type BranchSpec = {
  p0: Point;
  p1: Point;
  p2: Point;
  /** Скільки листків посадити вздовж стебла */
  count: number;
  /** Розмір листка біля основи та біля кінчика */
  leaf: { from: [number, number]; to: [number, number] };
  /** Наскільки листок відсунутий від стебла */
  offset: number;
  /** Довернути листок відносно дотичної, градуси */
  tilt: number;
};

const PRESETS: Record<"eucalyptus" | "olive", BranchSpec> = {
  // Евкаліпт: округле листя, майже перпендикулярне до стебла.
  eucalyptus: {
    p0: [8, 96],
    p1: [46, 74],
    p2: [96, 12],
    count: 11,
    leaf: { from: [8.5, 6.5], to: [4, 3] },
    offset: 6.5,
    tilt: 74,
  },
  // Олива: вузьке довге листя, притиснуте до стебла.
  olive: {
    p0: [6, 92],
    p1: [52, 82],
    p2: [94, 20],
    count: 13,
    leaf: { from: [10, 3.2], to: [5, 1.8] },
    offset: 4.5,
    tilt: 26,
  },
};

/* ------------------------------------------------------------------ */
/* Математика кривої                                                   */
/* ------------------------------------------------------------------ */

function pointAt(s: BranchSpec, t: number): Point {
  const u = 1 - t;
  return [
    u * u * s.p0[0] + 2 * u * t * s.p1[0] + t * t * s.p2[0],
    u * u * s.p0[1] + 2 * u * t * s.p1[1] + t * t * s.p2[1],
  ];
}

/** Кут дотичної в точці t, у градусах. */
function angleAt(s: BranchSpec, t: number): number {
  const u = 1 - t;
  const dx = 2 * u * (s.p1[0] - s.p0[0]) + 2 * t * (s.p2[0] - s.p1[0]);
  const dy = 2 * u * (s.p1[1] - s.p0[1]) + 2 * t * (s.p2[1] - s.p1[1]);
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* ------------------------------------------------------------------ */

export default function Botanical({
  variant = "eucalyptus",
  className = "",
  delay = 0,
  flip = false,
}: {
  variant?: "eucalyptus" | "olive";
  className?: string;
  delay?: number;
  /** Дзеркалить гілку — для протилежного кута композиції */
  flip?: boolean;
}) {
  const spec = PRESETS[variant];

  const leaves = useMemo(() => {
    return Array.from({ length: spec.count }, (_, i) => {
      // Починаємо не від самої основи: біля зрізу стебло голе.
      const t = 0.16 + (i / (spec.count - 1)) * 0.82;
      const [x, y] = pointAt(spec, t);
      const angle = angleAt(spec, t);
      const side = i % 2 === 0 ? 1 : -1;

      // Листя дрібнішає до кінчика — так гілка не виглядає штампованою.
      const rx = lerp(spec.leaf.from[0], spec.leaf.to[0], t);
      const ry = lerp(spec.leaf.from[1], spec.leaf.to[1], t);

      // Зсув перпендикулярно до стебла, у бік поточної сторони.
      const normal = ((angle + 90) * Math.PI) / 180;
      const push = spec.offset * side;

      return {
        cx: x + Math.cos(normal) * push,
        cy: y + Math.sin(normal) * push,
        rx,
        ry,
        rotate: angle + spec.tilt * side,
        delay: delay + 0.5 + i * 0.055,
      };
    });
  }, [spec, delay]);

  const stem = `M ${spec.p0[0]} ${spec.p0[1]} Q ${spec.p1[0]} ${spec.p1[1]} ${spec.p2[0]} ${spec.p2[1]}`;

  return (
    <motion.svg
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.4 }}
      className={className}
      style={flip ? { transform: "scaleX(-1)" } : undefined}
    >
      <motion.path
        d={stem}
        stroke="currentColor"
        strokeWidth="0.9"
        strokeLinecap="round"
        variants={{
          hidden: { pathLength: 0, opacity: 0 },
          show: {
            pathLength: 1,
            opacity: 1,
            transition: {
              pathLength: { duration: 1.5, delay, ease: easeSoft },
              opacity: { duration: 0.3, delay },
            },
          },
        }}
      />

      {leaves.map((leaf, i) => (
        <motion.ellipse
          key={i}
          cx={leaf.cx}
          cy={leaf.cy}
          rx={leaf.rx}
          ry={leaf.ry}
          stroke="currentColor"
          strokeWidth="0.75"
          fill="currentColor"
          fillOpacity="0.08"
          style={{ transformOrigin: `${leaf.cx}px ${leaf.cy}px` }}
          variants={{
            hidden: { scale: 0, opacity: 0, rotate: leaf.rotate },
            show: {
              scale: 1,
              opacity: 1,
              rotate: leaf.rotate,
              transition: { duration: 0.55, delay: leaf.delay, ease: easeSoft },
            },
          }}
        />
      ))}
    </motion.svg>
  );
}
