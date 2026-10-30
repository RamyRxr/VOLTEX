import { t } from "@/lib/i18n";

export function Footer() {
  return (
    <footer className="footer">
      <span>{t("app.footer")}</span>
      <span className="num">{t("app.version")}</span>
    </footer>
  );
}
