import type { Metadata } from "next";
import CodeCopy from "@/components/CodeCopy";

/**
 * Сторінка, на яку Google повертає наречених після «Дозволити».
 *
 * Навіщо вона потрібна. Стандартний редірект іде на http://localhost:53682 —
 * і це працює, лише поки людина сидить за тим самим комп'ютером, де запущено
 * скрипт. З телефона такий перехід або впирається в помилку, або мобільний
 * браузер просто нікуди не йде, лишаючись на сторінці згоди. Дістати код із
 * рядка адреси на телефоні виявилось нереально.
 *
 * Тому редірект ведемо на цю сторінку: вона нормально відкривається будь-де,
 * показує код великим шрифтом і копіює його однією кнопкою.
 *
 * Код тут світиться відкрито — і це нормально: він одноразовий, живе близько
 * десяти хвилин, а обміняти його на токен без client_secret неможливо.
 * Секрет лишається на машині розробника.
 */

export const metadata: Metadata = {
  title: "Доступ надано",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function OAuthCallbackPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const code = first(params.code);
  const state = first(params.state);
  const error = first(params.error);

  if (error || !code) {
    return (
      <Shell tone="error" title={error ? "Доступ не надано" : "Чогось бракує"}>
        <p className="text-[0.95rem] leading-relaxed text-ink-600">
          {error === "access_denied"
            ? "Схоже, ви натиснули «Скасувати». Нічого страшного — просто відкрийте посилання ще раз і оберіть «Дозволити»."
            : "Ця сторінка відкрилась без потрібних даних. Відкрийте, будь ласка, посилання з повідомлення ще раз."}
        </p>
      </Shell>
    );
  }

  // Віддаємо код разом зі state: скрипт перевірить, що це відповідь саме
  // на його запит, а не з іншої спроби входу.
  const payload = state ? `code=${code}&state=${state}` : code;

  return (
    <Shell tone="ok" title="Дякуємо!">
      <p className="text-[0.95rem] leading-relaxed text-ink-600">
        Доступ надано. Лишилось передати цей код тому, хто робить сайт —
        натисніть кнопку і надішліть його у ваше листування.
      </p>
      <CodeCopy value={payload} />
      <p className="text-xs leading-relaxed text-ink-400">
        Код одноразовий і діє близько десяти хвилин. Сам по собі він нічого
        не відкриває — потрібен ще ключ, який є лише в розробника.
      </p>
    </Shell>
  );
}

function Shell({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "ok" | "error";
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-[100svh] items-center justify-center bg-gradient-to-b from-ivory via-cream to-blush-50 px-5 py-14">
      <div className="card-soft flex w-full max-w-md flex-col items-center gap-5 p-7 text-center sm:p-9">
        <span
          className={`flex h-16 w-16 items-center justify-center rounded-full ${
            tone === "ok" ? "bg-sage-100 text-sage-500" : "bg-blush-50 text-blush-500"
          }`}
        >
          {tone === "ok" ? <CheckIcon /> : <AlertIcon />}
        </span>

        <h1 className="font-display text-3xl font-light text-ink-900">{title}</h1>
        <div className="hairline w-full max-w-[200px]" />
        {children}
      </div>
    </main>
  );
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function CheckIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" {...stroke} aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" {...stroke} aria-hidden>
      <path d="M12 8v5" />
      <path d="M12 16.5v.01" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}
