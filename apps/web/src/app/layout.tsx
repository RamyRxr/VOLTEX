import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import { QueryProvider } from "@/components/ui/QueryProvider";
import { fr } from "@/lib/i18n/fr";
import "./globals.css";

/** The one typeface of the dashboard (variable font: every weight). */
const dmSans = DM_Sans({ subsets: ["latin", "latin-ext"], variable: "--font-dm-sans", display: "swap" });

export const metadata: Metadata = {
  title: `${fr.app.name} — Espace médecin`,
  description: fr.app.tagline,
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f6f4ef" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const demoMode = process.env.DEMO_MODE === "true";
  return (
    <html lang="fr" className={dmSans.variable}>
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
