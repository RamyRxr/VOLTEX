import type { LearnedRiskDto } from "shared";
import { fr } from "@/lib/i18n/fr";
import styles from "./file.module.css";

const percent = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const auc = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
const millions = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });

/** Bar scale: 40 % covers the riskiest profiles of the test year. */
const BAR_MAX = 0.4;
const barWidth = (p: number): string => `${Math.min(100, (p / BAR_MAX) * 100).toFixed(1)}%`;

/** Experimental learned risk, doctor only: never a bare number, always its factors (spec §6.6). */
export function LearnedRiskCard({ risk }: { risk: LearnedRiskDto }) {
  const t = fr.file.learned;
  return (
    <section className="panel" aria-labelledby="learned-title">
      <div className="panel-head">
        <h2 id="learned-title">{t.title}</h2>
        <span className="pill tone-neutral">{t.badge}</span>
      </div>
      <div className="panel-body">
        {!risk.applicable ? (
          <p className="muted">{t.notApplicable}</p>
        ) : (
          <>
            <p className={styles.learnedValue}>
              <strong className="tabular">{percent.format(risk.probability)}</strong>
              <span className="subtle">{t.relative(`×${decimal.format(risk.probability / risk.averageRisk)}`)}</span>
            </p>
            <div className={styles.learnedBar} aria-hidden>
              <span className={styles.learnedFill} style={{ width: barWidth(risk.probability) }} />
              <span className={styles.learnedAverage} style={{ left: barWidth(risk.averageRisk) }} />
            </div>
            <p className="subtle">{t.average(percent.format(risk.averageRisk))}</p>

            <h3 className={styles.learnedHeading}>{t.drivers}</h3>
            {risk.factors.length === 0 ? (
              <p className="muted">{t.noDriver}</p>
            ) : (
              <ul className={styles.learnedFactors}>
                {risk.factors.map((f) => (
                  <li key={f.code}>
                    <span>{f.label}</span>
                    <span className="tabular">×{decimal.format(f.oddsRatio)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="subtle" style={{ marginTop: 12 }}>
              {t.about(millions.format(risk.testBirths), auc.format(risk.testRocAuc))}
            </p>
          </>
        )}
        <p className="subtle" style={{ marginTop: 8 }}>
          {t.disclaimer}
        </p>
      </div>
    </section>
  );
}
