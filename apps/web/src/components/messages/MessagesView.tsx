"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { QueryState } from "@/components/ui/QueryState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useNow } from "@/components/ui/useNow";
import { formatDateTime, relativeTime } from "@/lib/format";
import { fr } from "@/lib/i18n/fr";
import { useConversations } from "@/lib/queries";
import { isUrgent } from "@/lib/status";
import styles from "./MessagesView.module.css";

type Filter = "all" | "awaiting";

/**
 * Patients who wrote, most urgent first (same order as the triage list), then
 * the most recent message. A row opens the patient's file on the chat.
 */
export function MessagesView() {
  const conversations = useConversations();
  const now = useNow();
  const [filter, setFilter] = useState<Filter>("all");

  const all = conversations.data ?? [];
  const awaitingCount = all.filter((c) => c.unanswered > 0).length;
  const visible = filter === "awaiting" ? all.filter((c) => c.unanswered > 0) : all;
  const t = fr.messages;

  return (
    <>
      <header className="page-head">
        <div>
          <h1>{t.title}</h1>
          <p>
            {t.subtitle} · <span className="subtle">{fr.common.updatedEvery}</span>
          </p>
        </div>
      </header>

      <div className={styles.filters} role="group" aria-label={t.title}>
        <button type="button" className={styles.chip} aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
          <span className={styles.chipCount}>{all.length}</span>
          {t.filters.all}
        </button>
        <button type="button" className={styles.chip} aria-pressed={filter === "awaiting"} onClick={() => setFilter("awaiting")}>
          <span className={styles.chipCount}>{awaitingCount}</span>
          {t.filters.awaiting}
        </button>
      </div>

      <section className="panel" aria-label={t.title}>
        <QueryState query={conversations} skeletonRows={6}>
          {visible.length === 0 ? (
            <p className="empty">{filter === "awaiting" ? t.emptyAwaiting : t.empty}</p>
          ) : (
            <ul className={styles.list}>
              {visible.map((c) => {
                const urgent = isUrgent(c.level, c.unconfirmedSevere);
                return (
                  <li key={c.linkId}>
                    <Link href={`/d/patients/${c.patientId}#chat`} className={styles.row} aria-label={`${t.open} : ${c.fullName}`}>
                      <span className={styles.status}>
                        <StatusBadge level={c.level} unconfirmedSevere={c.unconfirmedSevere} />
                      </span>
                      <span className={styles.body}>
                        <span className={urgent ? `${styles.name} ${styles.nameUrgent}` : styles.name}>{c.fullName}</span>
                        <span className={c.unanswered > 0 ? `${styles.preview} ${styles.previewUnread}` : styles.preview}>
                          {c.lastMessage.fromPatient ? "" : t.you}
                          {c.lastMessage.body}
                        </span>
                      </span>
                      <span className={styles.meta}>
                        <time dateTime={c.lastMessage.createdAt} title={formatDateTime(c.lastMessage.createdAt)} className="subtle">
                          {relativeTime(c.lastMessage.createdAt, now)}
                        </time>
                        {c.unanswered > 0 ? (
                          <span className={urgent ? `${styles.unread} ${styles.unreadUrgent}` : styles.unread}>{t.unanswered(c.unanswered)}</span>
                        ) : (
                          <span className={styles.replied}>
                            <Icon name="check" size={14} />
                            {t.replied}
                          </span>
                        )}
                      </span>
                      <span className={styles.chevron} aria-hidden>
                        <Icon name="chevron-right" />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </QueryState>
      </section>
    </>
  );
}
