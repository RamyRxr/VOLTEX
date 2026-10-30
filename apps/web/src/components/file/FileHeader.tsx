import Link from "next/link";
import type { PatientFile } from "shared";
import { Icon } from "@/components/ui/Icon";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatBp, formatWeek, relativeTime } from "@/lib/format";
import { fr } from "@/lib/i18n/fr";
import { riskTone } from "@/lib/status";
import styles from "./file.module.css";

export function FileHeader({ file, now }: { file: PatientFile; now: Date }) {
  const last = file.sessions[0];
  return (
    <header className={styles.header}>
      <Link href="/d" className={styles.back}>
        <Icon name="chevron-left" size={14} />
        {fr.common.back}
      </Link>
      <div className={styles.headerMain}>
        <div>
          <h1>{file.fullName}</h1>
          <p className={styles.facts}>
            <span>{fr.file.age(file.age)}</span>
            <span className="tabular">{formatWeek(file.pregnancyWeek)}</span>
            {file.phone && (
              <a href={`tel:${file.phone}`}>
                <Icon name="phone" size={14} />
                {file.phone}
              </a>
            )}
            {last && (
              <span>
                {fr.triage.columns.lastReading} : <strong className="tabular">{formatBp(last)}</strong>{" "}
                <span className="subtle">{relativeTime(last.takenAt, now)}</span>
              </span>
            )}
          </p>
        </div>
        <div className={styles.headerStatus}>
          <StatusBadge level={file.level} unconfirmedSevere={file.unconfirmedSevere != null} large />
          {file.risk && (
            <span className={`pill tone-${riskTone(file.risk.category)}`}>
              <span className="pill-dot" aria-hidden />
              {fr.risk[file.risk.category]}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
