import type { PatientFile } from "shared";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatBp, relativeTime } from "@/lib/format";
import { fr } from "@/lib/i18n/fr";
import styles from "./file.module.css";

/** Why the patient is at this level: every rule that fired, from the API (spec §4.2.5). */
export function Findings({ file, now }: { file: PatientFile; now: Date }) {
  const unconfirmed = file.unconfirmedSevere;
  const empty = file.findings.length === 0 && !unconfirmed;
  return (
    <section className="panel" aria-labelledby="why-title">
      <div className="panel-head">
        <h2 id="why-title">{fr.file.why}</h2>
      </div>
      <div className="panel-body">
        {empty ? (
          <p className="muted">{fr.file.nothingToReport}</p>
        ) : (
          <ul className={styles.findings}>
            {unconfirmed && (
              <li>
                <StatusBadge level="OK" unconfirmedSevere />
                <span>
                  {fr.session.SEVERE_EXPIRED} : <strong className="tabular">{formatBp(unconfirmed)}</strong>{" "}
                  <span className="subtle">{relativeTime(unconfirmed.takenAt, now)}</span>
                </span>
              </li>
            )}
            {file.findings.map((f) => (
              <li key={`${f.level}-${f.evidence}`}>
                <StatusBadge level={f.level} />
                <span>{f.reason}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
