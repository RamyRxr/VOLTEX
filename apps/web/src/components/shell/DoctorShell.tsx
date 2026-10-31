"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { ConversationDto } from "shared";
import { Icon, type IconName } from "@/components/ui/Icon";
import { ApiCallError } from "@/lib/api";
import { initials } from "@/lib/format";
import { fr } from "@/lib/i18n/fr";
import { keys, useAlerts, useConversations, useLinkRequests, useMe } from "@/lib/queries";
import { isUrgent } from "@/lib/status";
import { supabaseBrowser } from "@/lib/supabase";
import styles from "./DoctorShell.module.css";
import { MessageToasts, type MessageToast } from "./MessageToasts";
import { useIncomingMessages, type IncomingMessage } from "./useIncomingMessages";

const BASE_TITLE = `${fr.app.name} — Espace médecin`;
const MAX_TOASTS = 3;

/**
 * Live new-message notifications: the Messages counter refreshes at once and a
 * card shows who wrote (not when the doctor is already on that patient's page).
 */
function useMessageNotifications(myId: string | null) {
  const qc = useQueryClient();
  const [toasts, setToasts] = useState<MessageToast[]>([]);
  const close = useCallback((id: string) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const onIncoming = useCallback(
    (message: IncomingMessage) => {
      const find = () => qc.getQueryData<ConversationDto[]>(keys.conversations)?.find((c) => c.linkId === message.linkId);
      const show = (conversation: ConversationDto | undefined) => {
        if (!conversation || window.location.pathname === `/d/patients/${conversation.patientId}`) return;
        const toast: MessageToast = {
          id: message.id,
          patientId: conversation.patientId,
          fullName: conversation.fullName,
          level: conversation.level,
          unconfirmedSevere: conversation.unconfirmedSevere,
          body: message.body,
        };
        setToasts((list) => [...list.filter((t) => t.id !== toast.id), toast].slice(-MAX_TOASTS));
      };
      // A patient who already wrote is in the cached list: the card and the counter update at
      // once, the server copy follows in the background. A first message waits for the refresh.
      const known = find();
      if (known) {
        show(known);
        const lastMessage = { body: message.body, createdAt: new Date().toISOString(), fromPatient: true };
        qc.setQueryData<ConversationDto[]>(keys.conversations, (list) =>
          list?.map((c) => (c.linkId === message.linkId ? { ...c, lastMessage, unanswered: c.unanswered + 1 } : c)),
        );
      }
      const refresh = qc.invalidateQueries({ queryKey: keys.conversations });
      if (!known) void refresh.then(() => show(find()));
    },
    [qc],
  );

  useIncomingMessages(myId, onIncoming);
  return { toasts, close };
}

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
  const conversations = useConversations();
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
  const awaiting = (conversations.data ?? []).filter((c) => c.unanswered > 0);
  const urgentAwaiting = awaiting.some((c) => isUrgent(c.level, c.unconfirmedSevere));
  const name = me.data?.fullName ?? "";
  const notifications = useMessageNotifications(me.data?.id ?? null);

  // Waiting conversations in the browser tab title, visible from another tab: "(3) SafeMaman — …"
  useEffect(() => {
    document.title = awaiting.length > 0 ? `(${awaiting.length}) ${BASE_TITLE}` : BASE_TITLE;
  }, [awaiting.length]);

  return (
    <>
    <aside className={styles.sidebar}>
      <Link href="/d" className={styles.brand}>
        <span className={styles.mark} aria-hidden />
        <span className={styles.brandText}>{fr.app.name}</span>
      </Link>
      <nav aria-label={fr.nav.menu} className={styles.nav}>
        <NavLink href="/d" icon="users" label={fr.nav.patients} />
        <NavLink href="/d/messages" icon="message" label={fr.nav.messages} count={awaiting.length} urgent={urgentAwaiting} />
        <NavLink href="/d/alerts" icon="bell" label={fr.nav.alerts} count={alerts.data?.length} urgent={urgentAlerts > 0} />
        <NavLink href="/d/invites" icon="key" label={fr.nav.invites} count={requests.data?.length} />
      </nav>
      <div className={styles.footer}>
        <span className={styles.avatar} aria-hidden>
          {initials(name)}
        </span>
        <span className={styles.doctorName}>{name}</span>
        <button type="button" className={styles.logout} onClick={logout} aria-label={fr.nav.logout} title={fr.nav.logout}>
          <Icon name="logout" size={18} />
        </button>
      </div>
    </aside>
    <MessageToasts toasts={notifications.toasts} onClose={notifications.close} />
    </>
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
