"use client";

import Link from "next/link";
import { useState } from "react";
import { QueryState } from "@/components/ui/QueryState";
import { useNow } from "@/components/ui/useNow";
import { errorMessage } from "@/lib/api";
import { formatDateTime, relativeTime } from "@/lib/format";
import { fr } from "@/lib/i18n/fr";
import { useAlertAction, useAlerts, usePrefetchPatient, type AlertFilter } from "@/lib/queries";
import { AlertBadge } from "./AlertBadge";
import styles from "./AlertsView.module.css";

const FILTERS: readonly AlertFilter[] = ["OPEN", "ACKNOWLEDGED", "CLOSED"];

export function AlertsView() {
  const [filter, setFilter] = useState<AlertFilter>("OPEN");
  const alerts = useAlerts(filter);
  const action = useAlertAction();
  const prefetch = usePrefetchPatient();
  const now = useNow();

  return (
    <>
      <header className="page-head">
        <div>
          <h1>{fr.alerts.title}</h1>
          <p>{fr.alerts.subtitle}</p>
        </div>
      </header>

      <div className="tabs" role="tablist" aria-label={fr.alerts.title}>
        {FILTERS.map((f) => (
          <button key={f} type="button" role="tab" className="tab" aria-selected={filter === f} onClick={() => setFilter(f)}>
            {fr.alerts.filters[f]}
          </button>
        ))}
      </div>

      {action.isError && (
        <p className="notice tone-danger" role="alert" style={{ marginTop: 16 }}>
          {errorMessage(action.error)}
        </p>
      )}

      <section className={`panel ${styles.list}`} role="tabpanel">
        <QueryState query={alerts} skeletonRows={5}>
          {(alerts.data ?? []).length === 0 ? (
            <p className="empty">{fr.alerts.empty[filter]}</p>
          ) : (
            <ul className={styles.items}>
              {(alerts.data ?? []).map((a) => (
                <li key={a.id} className={a.level === "EMERGENCY" || a.level === "SEVERE" ? `${styles.item} ${styles.urgent}` : styles.item}>
                  <AlertBadge level={a.level} />
                  <div className={styles.body}>
                    <Link href={`/d/patients/${a.patientId}`} className={styles.patient} {...prefetch(a.patientId)}>
                      {a.patientName}
                    </Link>
                    <p>{a.reason}</p>
                    <p className="subtle">
                      <time dateTime={a.createdAt} title={formatDateTime(a.createdAt)}>
                        {relativeTime(a.createdAt, now)}
                      </time>
                      {a.ackAt && filter !== "OPEN" && <> · {fr.alerts.ackAt(relativeTime(a.ackAt, now))}</>}
                    </p>
                  </div>
                  <div className={styles.actions}>
                    {a.status === "OPEN" && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={action.isPending}
                        onClick={() => action.mutate({ id: a.id, action: "ACK" })}
                      >
                        {fr.alerts.ack}
                      </button>
                    )}
                    {a.status !== "CLOSED" && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={action.isPending}
                        onClick={() => action.mutate({ id: a.id, action: "CLOSE" })}
                      >
                        {fr.alerts.close}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </QueryState>
      </section>
    </>
  );
}
