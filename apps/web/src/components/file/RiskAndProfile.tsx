import type { PatientFile, RiskDto } from "shared";
import { bmi, formatDate, formatDateTime } from "@/lib/format";
import { fr } from "@/lib/i18n/fr";
import { riskTone } from "@/lib/status";
import styles from "./file.module.css";

/** The risk is never a bare category: always its factors (spec §6.6). */
export function RiskFactors({ risk }: { risk: RiskDto | null }) {
  return (
    <section className="panel" aria-labelledby="risk-title">
      <div className="panel-head">
        <h2 id="risk-title">{fr.file.riskFactors}</h2>
        {risk && (
          <span className={`pill tone-${riskTone(risk.category)}`}>
            <span className="pill-dot" aria-hidden />
            {fr.risk[risk.category]}
          </span>
        )}
      </div>
      <div className="panel-body">
        {!risk || risk.factors.length === 0 ? (
          <p className="muted">{fr.file.noFactor}</p>
        ) : (
          <ul className={styles.factors}>
            {risk.factors.map((f) => (
              <li key={f.code}>
                <span className={`pill ${f.weight === "HIGH" ? "tone-warning" : "tone-watch"}`}>{fr.risk.weight[f.weight]}</span>
                <span>{f.label}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="subtle" style={{ marginTop: 12 }}>
          {fr.risk.disclaimer}
        </p>
      </div>
    </section>
  );
}

/** Every stored assessment, newest first. */
export function RiskTimeline({ risks }: { risks: readonly RiskDto[] }) {
  return (
    <section className="panel" aria-labelledby="timeline-title">
      <div className="panel-head">
        <h2 id="timeline-title">{fr.file.riskTimeline}</h2>
      </div>
      <ol className={styles.timeline}>
        {risks.map((r, i) => (
          <li key={`${r.createdAt}-${i}`}>
            <span className={`pill tone-${riskTone(r.category)}`}>
              <span className="pill-dot" aria-hidden />
              {fr.risk.short[r.category]}
            </span>
            <span className="tabular">{r.createdAt ? formatDateTime(r.createdAt) : fr.common.none}</span>
            <span className="subtle">{r.trigger ? fr.risk.trigger[r.trigger] : ""}</span>
            <span className="subtle">{r.factors.map((f) => f.label).join(" · ") || fr.file.noFactor}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

type Flag = keyof typeof fr.file.profileFields;
const FLAGS = Object.keys(fr.file.profileFields) as Flag[];

export function ProfilePanel({ file }: { file: PatientFile }) {
  const p = file.profile;
  const height = typeof p.heightCm === "number" ? p.heightCm : null;
  const weight = typeof p.weightKg === "number" ? p.weightKg : null;
  const history = FLAGS.filter((flag) => p[flag] === true);
  const treatments = typeof p.treatments === "string" && p.treatments ? p.treatments : null;
  return (
    <section className="panel" aria-labelledby="profile-title">
      <div className="panel-head">
        <h2 id="profile-title">{fr.file.profile}</h2>
      </div>
      <div className="panel-body">
        <dl className={styles.facts2}>
          {file.dueDate && (
            <div>
              <dt>{fr.file.dueDate}</dt>
              <dd>{formatDate(file.dueDate)}</dd>
            </div>
          )}
          {file.lmpDate && (
            <div>
              <dt>{fr.file.lmpDate}</dt>
              <dd>{formatDate(file.lmpDate)}</dd>
            </div>
          )}
          <div>
            <dt>{fr.file.height}</dt>
            <dd>{height ? `${height} cm` : fr.common.unknown}</dd>
          </div>
          <div>
            <dt>{fr.file.weight}</dt>
            <dd>{weight ? `${weight} kg` : fr.common.unknown}</dd>
          </div>
          <div>
            <dt>{fr.file.bmi}</dt>
            <dd>{bmi(height, weight) ?? fr.common.unknown}</dd>
          </div>
          <div>
            <dt>{fr.file.expectedPerDay}</dt>
            <dd>{file.expectedSessionsPerDay}</dd>
          </div>
        </dl>
        {history.length > 0 && (
          <ul className={styles.history}>
            {history.map((flag) => (
              <li key={flag}>{fr.file.profileFields[flag]}</li>
            ))}
          </ul>
        )}
        {treatments && (
          <p className={styles.treatments}>
            <strong>{fr.file.treatments} : </strong>
            {treatments}
          </p>
        )}
      </div>
    </section>
  );
}
