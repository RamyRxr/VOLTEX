import type { Metadata } from "next";
import { Instrument_Serif, Archivo } from "next/font/google";
import "./globals.css";

const serif = Instrument_Serif({
  subsets: ["latin", "latin-ext"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

const grotesque = Archivo({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-grotesque",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TensioCare — Registre de suivi tensionnel",
  description:
    "Suivi continu de la tension artérielle entre deux consultations. La technologie aide, le médecin décide.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${serif.variable} ${grotesque.variable}`}>
      <body>{children}</body>
    </html>
  );
}
