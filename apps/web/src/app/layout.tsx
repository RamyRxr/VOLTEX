import type { Metadata, Viewport } from "next";
import { Public_Sans, Source_Serif_4 } from "next/font/google";
import { QueryProvider } from "@/components/ui/QueryProvider";
import { fr } from "@/lib/i18n/fr";
import "./globals.css";

const sans = Public_Sans({ subsets: ["latin", "latin-ext"], variable: "--font-public-sans", display: "swap" });
const serif = Source_Serif_4({ subsets: ["latin", "latin-ext"], variable: "--font-source-serif", display: "swap" });

export const metadata: Metadata = {
  title: `${fr.app.name} — Espace médecin`,
  description: fr.app.tagline,
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f6f4ef" };

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
