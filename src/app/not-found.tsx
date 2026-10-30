import Link from "next/link";
import { t } from "@/lib/i18n";

export default function NotFound() {
  return (
    <main className="page error-page" id="contenu">
      <p className="eyebrow">{t("app.name")}</p>
      <h1 className="title">{t("notFound.title")}</h1>
      <p className="sub">{t("notFound.body")}</p>
      <div className="alert-block__actions not-found__links">
        <Link href="/d" className="btn btn--royal">
          {t("cover.doctor")}
        </Link>
        <Link href="/p" className="btn btn--ghost">
          {t("cover.patient")}
        </Link>
      </div>
    </main>
  );
}
