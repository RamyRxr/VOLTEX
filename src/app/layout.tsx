import type { Metadata, Viewport } from "next";
import { Archivo, Instrument_Serif } from "next/font/google";
import { QueryProvider } from "@/components/ui/QueryProvider";
import { currentSession } from "@/lib/auth/server";
import { isDemoMode } from "@/lib/demo";
import { dirOf, htmlLang, t } from "@/lib/i18n";
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
  title: `${t("app.name")} — ${t("app.tagline")}`,
  description: t("cover.lede"),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0c1233",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const lang = (await currentSession())?.lang ?? "FR";
  return (
    <html lang={htmlLang(lang)} dir={dirOf(lang)} className={`${serif.variable} ${grotesque.variable}`}>
      <body>
        <a href="#contenu" className="skip-link">
          {t("common.skip")}
        </a>
        {isDemoMode() && (
          <div className="demo-strip" role="note">
            <i aria-hidden />
            {t("demo.banner")}
          </div>
        )}
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
