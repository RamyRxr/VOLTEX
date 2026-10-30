"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { apiSend } from "@/lib/client/api";
import { useTriage } from "@/lib/client/queries";
import { initials } from "@/lib/format";
import { t } from "@/lib/i18n";
import { Icon } from "./ui/Icon";

function AlertCount() {
  const { data } = useTriage();
  const n = data?.openRedAlerts.length ?? 0;
  if (n === 0) return null;
  return (
    <span className="nav__count num" aria-label={`${n} ${t("redbanner.title")}`}>
      {n}
    </span>
  );
}

function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="masthead__logout"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await apiSend("/api/auth/logout", "POST");
        } finally {
          router.replace("/login");
          router.refresh();
        }
      }}
    >
      <Icon name="logout" size={13} />
      <span>{t("common.logout")}</span>
    </button>
  );
}

export function Masthead({ role, who }: { role: "doctor" | "patient"; who: string }) {
  const path = usePathname();
  const isDoctor = role === "doctor";
  const current = (href: string) => (path === href || (href !== "/d" && path.startsWith(href)) ? "page" : undefined);

  return (
    <header className="masthead">
      <div className="masthead__inner">
        <Link href={isDoctor ? "/d" : "/p"} className="brand" aria-label={`${t("app.name")} — ${t("common.home")}`}>
          <span className="brand__mark" aria-hidden>
            T
          </span>
          <span className="brand__name">
            Tensio<em>Care</em>
          </span>
        </Link>

        {isDoctor && (
          <nav className="nav" aria-label={t("nav.main")}>
            <Link href="/d" aria-current={current("/d")}>
              {t("nav.triage")}
            </Link>
            <Link href="/d/alerts" aria-current={current("/d/alerts")}>
              {t("nav.alerts")}
              <AlertCount />
            </Link>
            <Link href="/d/indicators" aria-current={current("/d/indicators")}>
              {t("nav.indicators")}
            </Link>
          </nav>
        )}

        <div className="masthead__right">
          <span className="who">
            <span className="who__init" aria-hidden>
              {initials(who)}
            </span>
            <span>{who}</span>
          </span>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
