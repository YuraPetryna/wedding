"use client";

import { useCallback } from "react";
import { motion } from "framer-motion";
import type { Photo } from "@/lib/photos";
import Ambience from "./Ambience";
import Botanical from "./Botanical";
import Collage from "./Collage";
import Hero from "./Hero";
import Ornament from "./Ornament";
import UploadFlow from "./UploadFlow";
import { fadeUp, inView, stagger } from "./motion";
import { wedding } from "@/config/wedding";

const UPLOAD_ANCHOR = "upload";

export default function PageShell({ photos }: { photos: Photo[] }) {
  const scrollToUpload = useCallback(() => {
    document.getElementById(UPLOAD_ANCHOR)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  return (
    <main className="relative">
      <Ambience petalCount={photos.length > 0 ? 8 : 14} />
      <Hero onStart={scrollToUpload} cover={photos[0]} />
      <Collage photos={photos} />
      <UploadFlow anchorId={UPLOAD_ANCHOR} />
      <Footer />
    </main>
  );
}

function Footer() {
  return (
    <motion.footer
      {...inView}
      variants={stagger(0.08)}
      className="relative overflow-hidden px-6 pb-24 pt-8 text-center"
    >
      <Botanical
        variant="olive"
        className="pointer-events-none absolute -left-8 bottom-0 h-32 w-32 text-sage-300/45"
      />
      <Botanical
        variant="olive"
        flip
        delay={0.25}
        className="pointer-events-none absolute -right-8 bottom-0 h-32 w-32 text-sage-300/45"
      />

      <motion.div variants={fadeUp} className="relative flex justify-center">
        <Ornament />
      </motion.div>
      <motion.p
        variants={fadeUp}
        className="relative mt-8 font-display text-3xl font-light text-ink-600"
      >
        {wedding.bride} &amp; {wedding.groom}
      </motion.p>
      <motion.p variants={fadeUp} className="relative mt-3 text-xs leading-relaxed text-ink-400">
        Дякуємо, що були поруч у цей день.
      </motion.p>
    </motion.footer>
  );
}
