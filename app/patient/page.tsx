import Link from "next/link";
import { notFound } from "next/navigation";
import { MiniChart } from "@/components/MiniChart";
import { StatusMark } from "@/components/StatusMark";
import { buildRegistry, getPatient } from "@/lib/data";
import { elapsed, shortDate, weekdayDate } from "@/lib/format";
import { LEVEL_COLOR, LEVEL_WORD } from "@/lib/tone";
import { Footer } from "@/components/Footer";

export const dynamic = "force-dynamic";

/** The patient demo is always Ahmed: stable, then unwell on stage. */
const DEMO_PATIENT = "p-05";

const PATIENT_MSG: Record<string, string> = {
  GREEN: "Bon, continuez comme ça.",
  YELLOW: "Continuez à mesurer. Pensez à votre traitement et au sel.",
  ORANGE: "Votre tension est élevée. Votre médecin a été informé.",
  SILENT: "Vous n'avez pas mesuré récemment.",
  CRISIS: "Reposez-vous 30 minutes, remesurez, et contactez votre médecin aujourd'hui.",
  PENDING: "Reposez-vous 5 minutes et remesurez.",
  EMERGENCY: "Appelez le 14 maintenant.",
};

export default function PatientHome() {
  const now = new Date();
  const registry = buildRegistry(now);
  const patient = getPatient(registry, DEMO_PATIENT);
  if (!patient) notFound();

  const first = patient.name.split(" ")[0];
  const confirmed = patient.sessions
    .filter((s) => s.status === "CONFIRMED" && !s.supersededBySessionId)
    .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
  const last = confirmed.at(-1) ?? null;
  const week = confirmed.filter((s) => now.getTime() - s.startedAt.getTime() <= 7 * 86_400_000);
  const color = LEVEL_COLOR[patient.result.level];

  return (
    <div className="stage">
      <div className="stage__note no-print">
        <p className="eyebrow">Canal patient · mobile</p>
        <h1
          className="display"
          style={{ fontSize: "clamp(34px, 4vw, 54px)", margin: "12px 0 18px" }}
        >
          Trente secondes,
          <br />
          une fois par jour.
        </h1>
        <p>
          Pas d&apos;application à installer, pas de compte à créer. Le patient
          ouvre un lien, saisit deux chiffres, et referme. La même page accepte
          une réponse par SMS pour les téléphones à clavier.
        </p>

        <div className="stage__steps">
          <div className="stage__step">
            <span className="aside__n">01</span>
            <div>
              <h3>Mesurer</h3>
              <p>Assis, cinq minutes de repos, deux mesures espacées d&apos;une minute.</p>
            </div>
          </div>
          <div className="stage__step">
            <span className="aside__n">02</span>
            <div>
              <h3>Envoyer</h3>
              <p>La moyenne des deux mesures part en une session, pas deux chiffres isolés.</p>
            </div>
          </div>
          <div className="stage__step">
            <span className="aside__n">03</span>
            <div>
              <h3>Rassurer</h3>
              <p>Une réponse immédiate et non médicale. Si la mesure est élevée, on demande de remesurer — jamais on ne dramatise.</p>
            </div>
          </div>
        </div>

        <div className="note-card">
          <p className="eyebrow" style={{ margin: 0 }}>
            Côté médecin
          </p>
          <p style={{ fontSize: 15 }}>
            La mesure arrive dans le registre avec sa tendance et son contexte.
            Aucun message médical n&apos;est envoyé sans qu&apos;un médecin
            l&apos;ait décidé.
          </p>
        </div>

        <div style={{ marginTop: 30 }}>
          <Link
            href={`/doctor/patients/${patient.id}`}
            className="micro"
            style={{ borderBottom: "1px solid var(--line-strong)", paddingBottom: 2 }}
          >
            Voir ce que le médecin lit →
          </Link>
        </div>
      </div>

      <div className="phone">
        <div className="phone__bar">
          <span>Espace patient</span>
          <span>{weekdayDate(now)}</span>
        </div>

        <div className="phone__body">
          <div className="phone__brand">
            <span className="brand__name">
              Tensio<em>Care</em>
            </span>
            <span className="micro">{first}</span>
          </div>

          <div className="status-hero" style={{ "--c": color } as React.CSSProperties}>
            <StatusMark level={patient.result.level} />
            <p className="status-hero__word">{LEVEL_WORD[patient.result.level]}</p>
            <p className="status-hero__line">
              {PATIENT_MSG[patient.result.level]}
            </p>
            <div className="status-hero__bp">
              <b className="num">
                {last ? `${last.avgSys}/${last.avgDia}` : "—"}
              </b>
              <span>
                {last ? `${elapsed(last.startedAt, now)}` : "aucune mesure"}
              </span>
            </div>
          </div>

          <div className="mini">
            <div className="mini__cell">
              <div className="mini__k">Prochaine mesure</div>
              <div className="mini__v">Demain, 7 h</div>
            </div>
            <div className="mini__cell">
              <div className="mini__k">Cette semaine</div>
              <div className="mini__v num">
                {week.length} <span style={{ fontSize: 12, color: "var(--ink-3)" }}>/ {patient.expected}</span>
              </div>
            </div>
          </div>

          <Link href="/patient/add" className="cta">
            Ajouter une mesure
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden>
              <path d="M2 9h14M10 3l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>

          <div className="phone__section">
            <div className="phone__section-head">
              <h2>Sept derniers jours</h2>
              <span className="micro">mmHg</span>
            </div>
            <MiniChart
              points={confirmed.slice(-8).map((s) => ({
                at: s.startedAt,
                sys: s.avgSys,
                dia: s.avgDia,
              }))}
              target={patient.target}
            />
          </div>

          <div className="phone__section">
            <div className="phone__section-head">
              <h2>Historique</h2>
              <span className="micro">{confirmed.length} mesures</span>
            </div>
            <div className="history">
              {confirmed
                .slice()
                .reverse()
                .slice(0, 5)
                .map((s) => (
                  <div className="history__row" key={s.id}>
                    <span className="history__d num">{shortDate(s.startedAt)}</span>
                    <span className="history__bp num">
                      {s.avgSys}/{s.avgDia}
                    </span>
                    <span className="history__tag">
                      {s.pillTaken === true
                        ? "traitement pris"
                        : s.pillTaken === false
                          ? "oublié"
                          : "—"}
                    </span>
                  </div>
                ))}
            </div>
          </div>

          <p className="micro" style={{ marginTop: 24, lineHeight: 1.6 }}>
            Données de démonstration. En cas de malaise, appelez le 14.
          </p>
        </div>
      </div>

      <div style={{ gridColumn: "1 / -1", marginTop: 40 }}>
        <Footer />
      </div>
    </div>
  );
}
