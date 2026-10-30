"use client";

import Link from "next/link";
import { t } from "@/lib/i18n";

/** Never a white screen: a readable message and a way back. */
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="page error-page" id="contenu">
      <p className="eyebrow">{t("app.name")}</p>
      <h1 className="title">{t("common.error")}</h1>
      <div className="alert-block__actions">
        <button type="button" className="btn btn--royal" onClick={reset}>
          {t("common.retry")}
        </button>
        <Link href="/" className="btn btn--ghost">
          {t("common.home")}
        </Link>
      </div>
    </main>
  );
}
