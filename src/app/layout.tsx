import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { wedding, prettyDate } from "@/config/wedding";
import "./globals.css";

const display = Cormorant_Garamond({
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-display",
  display: "swap",
});

const sans = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});

const title = `${wedding.bride} та ${wedding.groom} — фото з весілля`;
const description = `Поділіться своїми фотографіями з весілля ${wedding.bride} та ${wedding.groom}, ${prettyDate(wedding.date)}. Без реєстрації — просто оберіть фото і надішліть.`;

export const metadata: Metadata = {
  title,
  description,
  metadataBase: new URL(wedding.siteUrl),
  openGraph: {
    title,
    description,
    type: "website",
    locale: "uk_UA",
  },
  // Сторінка суто для гостей — індексувати її ні до чого.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#FBF7F2",
  width: "device-width",
  initialScale: 1,
  // Дозволяємо зум: гості мають могти роздивитися прев'ю.
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk" className={`${display.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
