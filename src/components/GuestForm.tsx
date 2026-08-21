"use client";

import { motion } from "framer-motion";
import { useId, useState } from "react";
import { fadeUp } from "./motion";

/**
 * Ім'я та побажання. Обидва поля необов'язкові — жодних бар'єрів
 * між гостем і кнопкою «надіслати».
 */
export default function GuestForm({
  guest,
  wish,
  onGuestChange,
  onWishChange,
  disabled,
}: {
  guest: string;
  wish: string;
  onGuestChange: (v: string) => void;
  onWishChange: (v: string) => void;
  disabled?: boolean;
}) {
  const guestId = useId();
  const wishId = useId();
  const [wishOpen, setWishOpen] = useState(false);
  const WISH_LIMIT = 300;

  return (
    <motion.div variants={fadeUp} className="flex flex-col gap-3">
      <Field
        id={guestId}
        label="Як вас звати?"
        hint="Підпишемо ваші фото — так ми знатимемо, кому дякувати"
      >
        <input
          id={guestId}
          type="text"
          value={guest}
          disabled={disabled}
          maxLength={80}
          autoComplete="name"
          enterKeyHint="next"
          onChange={(e) => onGuestChange(e.target.value)}
          placeholder="Оля Петренко"
          className="field"
        />
      </Field>

      {/* Побажання ховаємо за посиланням: коротка форма менше лякає */}
      {!wishOpen && !wish ? (
        <motion.button
          type="button"
          onClick={() => setWishOpen(true)}
          whileTap={{ scale: 0.98 }}
          className="self-start text-sm font-medium text-blush-500 underline decoration-blush-200 decoration-1 underline-offset-4 transition-colors hover:text-ink-800"
        >
          + Додати побажання молодятам
        </motion.button>
      ) : (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden"
        >
          <Field id={wishId} label="Кілька теплих слів" hint="Збережемо разом із вашими фото">
            <textarea
              id={wishId}
              value={wish}
              disabled={disabled}
              maxLength={WISH_LIMIT}
              rows={3}
              onChange={(e) => onWishChange(e.target.value)}
              placeholder="Нехай кожен ваш день буде таким же світлим, як сьогоднішній..."
              className="field resize-none"
            />
            <div className="mt-1.5 flex justify-end">
              <span className="text-[11px] tabular-nums text-ink-400">
                {wish.length} / {WISH_LIMIT}
              </span>
            </div>
          </Field>
        </motion.div>
      )}
    </motion.div>
  );
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-[0.7rem] uppercase tracking-[0.18em] text-ink-400"
      >
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-ink-400">{hint}</p>}
    </div>
  );
}
