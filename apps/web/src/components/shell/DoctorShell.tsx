"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { ApiCallError } from "@/lib/api";
import { initials } from "@/lib/format";
import { fr } from "@/lib/i18n/fr";
import { useAlerts, useLinkRequests, useMe } from "@/lib/queries";
import { supabaseBrowser } from "@/lib/supabase";
import styles from "./DoctorShell.module.css";

type AuthState = "checking" | "in" | "out";

/** Client-side guard: a Supabase session with the DOCTOR role, otherwise /login. */
function useDoctorSession(): AuthState {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<AuthState>("checking");

  useEffect(() => {
    const supabase = supabaseBrowser();
    const toLogin = () => router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) setState("in");
      else {
        setState("out");
        toLogin();
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setState("out");
        toLogin();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [router, pathname]);

  return state;
}

function NavLink({ href, icon, label, count, urgent }: { href: string; icon: IconName; label: string; count?: number; urgent?: boolean }) {
  const pathname = usePathname();
  const active = href === "/d" ? pathname === "/d" || pathname.startsWith("/d/patients") : pathname.startsWith(href);
  return (
    <Link href={href} className={styles.navLink} aria-current={active ? "page" : undefined}>
      <Icon name={icon} />
      <span>{label}</span>
      {count ? <span className={urgent ? `${styles.count} ${styles.countUrgent}` : styles.count}>{count}</span> : null}
    </Link>
  );
}

function Sidebar() {
  const me = useMe();
  const alerts = useAlerts("OPEN");
  const requests = useLinkRequests();
  const qc = useQueryClient();
  const router = useRouter();

  useEffect(() => {
    const forbidden = me.error instanceof ApiCallError && (me.error.status === 403 || me.error.status === 404);
    if (forbidden || (me.data && me.data.role !== "DOCTOR")) void supabaseBrowser().auth.signOut();
  }, [me.error, me.data]);

  async function logout() {
    await supabaseBrowser().auth.signOut();
    qc.clear();
    router.replace("/login");
  }

  const urgentAlerts = (alerts.data ?? []).filter((a) => a.level === "EMERGENCY" || a.level === "SEVERE").length;
  const name = me.data?.fullName ?? "";

  return (
    <aside className={styles.sidebar}>
      <Link href="/d" className={styles.brand}>
        <span className={styles.mark} aria-hidden />
        <span className={styles.brandText}>{fr.app.name}</span>
      </Link>
      <nav aria-label={fr.nav.menu} className={styles.nav}>
        <NavLink href="/d" icon="users" label={fr.nav.patients} />
        <NavLink href="/d/alerts" icon="bell" label={fr.nav.alerts} count={alerts.data?.length} urgent={urgentAlerts > 0} />
        <NavLink href="/d/invites" icon="key" label={fr.nav.invites} count={requests.data?.length} />
      </nav>
      <div className={styles.footer}>
        <div className={styles.doctor}>
          <span className={styles.avatar} aria-hidden>
            {initials(name)}
          </span>
          <span className={styles.doctorName}>{name}</span>
        </div>
        <button type="button" className="btn btn-ghost" onClick={logout}>
          <Icon name="logout" />
          <span className={styles.logoutLabel}>{fr.nav.logout}</span>
        </button>
        <p className={styles.principle}>{fr.app.principle}</p>
      </div>
    </aside>
  );
}

export function DoctorShell({ children }: { children: React.ReactNode }) {
  const state = useDoctorSession();
  if (state !== "in") {
    return (
      <div className={styles.checking} aria-busy="true">
        {fr.common.loading}
      </div>
    );
  }
  return (
    <div className={styles.shell}>
      <Sidebar />
      <main id="contenu" className={styles.main}>
        {children}
      </main>
    </div>
  );
}
