"use client";

import { useRouter } from "next/navigation";
import type { TriageRow } from "shared";
import { Icon } from "@/components/ui/Icon";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatBp, formatWeek, relativeTime } from "@/lib/format";
import { fr } from "@/lib/i18n/fr";
import { usePrefetchPatient } from "@/lib/queries";
import { isUrgent, riskTone } from "@/lib/status";
import styles from "./TriageView.module.css";

export function TriageTable({ rows, now }: { rows: readonly TriageRow[]; now: Date }) {
  const router = useRouter();
  const prefetch = usePrefetchPatient();
  const cols = fr.triage.columns;
  return (
    <div className="table-scroll">
      <table className={`table ${styles.table}`}>
        <thead>
          <tr>
            <th scope="col">{cols.status}</th>
            <th scope="col">{cols.patient}</th>
            <th scope="col">{cols.week}</th>
            <th scope="col">{cols.lastReading}</th>
            <th scope="col">{cols.risk}</th>
            <th scope="col">{cols.reason}</th>
            <th scope="col">
              <span className="sr-only">Ouvrir</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const href = `/d/patients/${row.patientId}`;
            const urgent = isUrgent(row.level, row.unconfirmedSevere != null);
            return (
              <tr
                key={row.patientId}
                className={urgent ? `${styles.row} ${styles.rowUrgent}` : styles.row}
                onClick={() => router.push(href)}
                {...prefetch(row.patientId)}
              >
                <td>
                  <StatusBadge level={row.level} unconfirmedSevere={row.unconfirmedSevere != null} />
                </td>
                <td>
                  <a
                    href={href}
                    className={styles.name}
                    onClick={(e) => {
                      e.preventDefault();
                      router.push(href);
                    }}
                  >
                    {row.fullName}
                  </a>
                  <div className={styles.tags}>
                    {row.silent && row.level !== "SILENT" && <span className="pill tone-neutral">{fr.triage.silentTag}</span>}
                    {row.openAlerts > 0 && <span className="subtle">{fr.triage.openAlerts(row.openAlerts)}</span>}
                  </div>
                </td>
                <td className={`tabular ${styles.week}`}>{formatWeek(row.pregnancyWeek)}</td>
                <td>
                  {row.lastSession ? (
                    <>
                      <span className={`tabular ${styles.bp}`}>{formatBp(row.lastSession)}</span>
                      <span className="subtle"> · {relativeTime(row.lastSession.takenAt, now)}</span>
                    </>
                  ) : (
                    <span className="subtle">{fr.triage.noReading}</span>
                  )}
                </td>
                <td>
                  {row.riskCategory && (
                    <span className={`pill tone-${riskTone(row.riskCategory)}`}>
                      <span className="pill-dot" aria-hidden />
                      {fr.risk.short[row.riskCategory]}
                    </span>
                  )}
                </td>
                <td className={styles.reason}>{row.reason ?? <span className="subtle">{fr.common.none}</span>}</td>
                <td className={styles.chevron}>
                  <Icon name="chevron-right" />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
