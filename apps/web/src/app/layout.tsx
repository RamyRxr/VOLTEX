import type { Metadata, Viewport } from "next";
import { Archivo, Instrument_Serif } from "next/font/google";
import { QueryProvider } from "@/components/ui/QueryProvider";
import { fr } from "@/lib/i18n/fr";
import "./globals.css";

const sans = Archivo({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600", "700"], variable: "--font-grotesque", display: "swap" });
const serif = Instrument_Serif({
  subsets: ["latin", "latin-ext"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: `${fr.app.name} — Espace médecin`,
  description: fr.app.tagline,
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#14213d" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const demoMode = process.env.DEMO_MODE === "true";
  return (
    <html lang="fr" className={`${sans.variable} ${serif.variable}`}>
      <body>
        <a href="#contenu" className="skip-link">
          {fr.app.skip}
        </a>
        {demoMode && (
          <div className="demo-strip" role="note">
            {fr.app.demoBanner}
          </div>
        )}
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
