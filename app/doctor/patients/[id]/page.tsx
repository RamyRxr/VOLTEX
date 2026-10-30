import Link from "next/link";
import { notFound } from "next/navigation";
import { BpChart } from "@/components/BpChart";
import { StatusMark } from "@/components/StatusMark";
import { Glyph } from "@/components/StatusMark";
import { buildRegistry, getPatient } from "@/lib/data";
import { elapsed, longDate, shortDate, stamp } from "@/lib/format";
import { LEVEL_COLOR, LEVEL_WORD } from "@/lib/tone";
import { T } from "@/lib/alerts/rules";

export const dynamic = "force-dynamic";

export default async function PatientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const now = new Date();
  const registry = buildRegistry(now);
  const patient = getPatient(registry, id);
  if (!patient) notFound();

  const { result, sessions, insights } = patient;
  const color = LEVEL_COLOR[result.level];
  const history = [...sessions].sort(
    (a, b) => b.startedAt.getTime() - a.startedAt.getTime(),
  );
  const flagged = (sys: number, dia: number) =>
    sys >= T.ORANGE_READING.sys || dia >= T.ORANGE_READING.dia;

  const meta: { k: string; v: string }[] = [
    { k: "Âge", v: `${patient.age} ans · ${patient.sex === "F" ? "femme" : "homme"}` },
    { k: "Traitement", v: patient.treatment },
    {
      k: "Cible",
      v: `${patient.target.sys}/${patient.target.dia} mmHg`,
    },
    {
      k: "Dernier cabinet",
      v: patient.lastOffice
        ? `${patient.lastOffice.sys}/${patient.lastOffice.dia} · ${shortDate(patient.lastOffice.at)}`
        : "—",
    },
    { k: "Rythme attendu", v: `${patient.expected} mesures / semaine` },
    { k: "Téléphone", v: patient.phone },
  ];

  return (
    <>
      <div className="crumbs">
        <Link href="/doctor">Triage</Link>
        <span aria-hidden>/</span>
        <span>Dossier {patient.id}</span>
      </div>

      <div className="patient-head">
        <div style={{ minWidth: 0 }}>
          <p className="eyebrow">
            {patient.highRisk ? "Suivi renforcé" : "Suivi standard"} · depuis{" "}
            {patient.lastOffice ? shortDate(patient.lastOffice.at) : "—"}
          </p>
          <h1 className="patient-name">{patient.name}</h1>

          <div className="meta">
            {meta.map((m) => (
              <div className="meta__row" key={m.k}>
                <span className="meta__k">{m.k}</span>
                <span className="meta__dots" aria-hidden />
                <span className="meta__v">{m.v}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="seal" style={{ "--c": color } as React.CSSProperties}>
          <span className="seal__inner">
            <Glyph level={result.level} />
            <span className="seal__word">{LEVEL_WORD[result.level]}</span>
            <span className="micro" style={{ fontSize: 8 }}>
              {result.notifyDoctorNow ? "notifié" : "résumé 8 h"}
            </span>
          </span>
        </div>
      </div>

      <div style={{ marginTop: 22 }}>
        <div
          className="alert-block"
          style={{ "--c": color } as React.CSSProperties}
        >
          <div className="alert-block__top">
            <StatusMark level={result.level} word={LEVEL_WORD[result.level]} />
            <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span className="rule-id">{result.ruleId}</span>
              <span className="micro">
                {patient.latestAny
                  ? elapsed(patient.latestAny.startedAt, now)
                  : "aucune mesure"}
              </span>
            </span>
          </div>
          <p className="alert-block__body">{patient.reason}</p>
          <div className="alert-block__actions">
            <button className="btn btn--sm btn--royal" type="button">
              Prendre en charge
            </button>
            <button className="btn btn--sm btn--ghost" type="button">
              Envoyer un message
            </button>
            <button className="btn btn--sm btn--ghost" type="button">
              Planifier un contrôle
            </button>
            <span className="micro" style={{ marginLeft: "auto", alignSelf: "center" }}>
              Décision médicale · non automatisée
            </span>
          </div>
        </div>
      </div>

      <div className="detail">
        <div>
          <div className="section-head">
            <h2>Tension artérielle</h2>
            <span className="micro">21 derniers jours · domicile</span>
          </div>

          <div className="chart-frame">
            <BpChart
              points={sessions
                .filter((s) => s.status === "CONFIRMED" && !s.supersededBySessionId)
                .map((s) => ({
                  at: s.startedAt,
                  sys: s.avgSys,
                  dia: s.avgDia,
                  pill: s.pillTaken,
                }))}
              target={patient.target}
              now={now}
            />
            <div className="legend">
              <span className="legend__key">
                <i className="legend__swatch" aria-hidden /> Systolique
              </span>
              <span className="legend__key">
                <i className="legend__swatch legend__swatch--dia" aria-hidden />{" "}
                Diastolique
              </span>
              <span className="legend__key">
                <i className="legend__swatch legend__swatch--band" aria-hidden />{" "}
                Zone cible
              </span>
              <span className="legend__key" style={{ marginLeft: "auto" }}>
                <span
                  style={{
                    width: 2,
                    height: 10,
                    background: "var(--crimson)",
                    opacity: 0.6,
                  }}
                  aria-hidden
                />{" "}
                Traitement oublié
              </span>
            </div>
          </div>

          <div className="section-head" style={{ marginTop: 30 }}>
            <h2>Journal des mesures</h2>
            <span className="micro">{history.length} sessions</span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="readings">
            <thead>
              <tr>
                <th>Date</th>
                <th>Heure</th>
                <th>Tension</th>
                <th>Pouls</th>
                <th>Traitement</th>
                <th>Canal</th>
                <th>État</th>
              </tr>
            </thead>
            <tbody>
              {history.slice(0, 9).map((s) => {
                const isFlag = flagged(s.avgSys, s.avgDia);
                return (
                  <tr
                    key={s.id}
                    className={isFlag ? "is-flag" : undefined}
                    style={
                      isFlag
                        ? ({ "--c": color } as React.CSSProperties)
                        : undefined
                    }
                  >
                    <td className="n">{shortDate(s.startedAt)}</td>
                    <td className="n">
                      {String(s.startedAt.getHours()).padStart(2, "0")}:
                      {String(s.startedAt.getMinutes()).padStart(2, "0")}
                    </td>
                    <td className="n">
                      {s.avgSys}/{s.avgDia}
                    </td>
                    <td className="num">{s.avgPulse ?? "—"}</td>
                    <td>
                      {s.pillTaken === true
                        ? "pris"
                        : s.pillTaken === false
                          ? "oublié"
                          : "non renseigné"}
                    </td>
                    <td>{s.channel === "SMS" ? "SMS" : "Web"}</td>
                    <td>
                      {s.status === "PENDING" ? "en attente" : "confirmée"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            </table>
          </div>
        </div>

        <aside>
          <div className="section-head">
            <h2>Lecture clinique</h2>
            <span className="micro">{insights.length} notes</span>
          </div>

          {insights.length === 0 && (
            <p className="sub" style={{ fontSize: 12 }}>
              Aucune annotation particulière sur la période.
            </p>
          )}

          {insights.map((n, i) => (
            <div className="note" key={n.id}>
              <span className="note__n num">{i + 1}.</span>
              <div>
                <p className="note__title">{n.title}</p>
                <p className="note__body">{n.body}</p>
              </div>
            </div>
          ))}

          <div className="panel" style={{ marginTop: 26 }}>
            <div className="panel__head">
              <span className="eyebrow" style={{ margin: 0 }}>
                Message au patient
              </span>
              <span className="micro">SMS</span>
            </div>
            <div className="panel__body">
              <div className="thread">
                <div className="msg msg--patient">
                  Bonjour docteur, j&apos;ai oublié mon comprimé pendant quelques
                  jours.
                  <span className="msg__time">{stamp(patient.lastOffice?.at ?? now)}</span>
                </div>
                <div className="msg msg--doctor">
                  Bonjour Fatima, merci de remesurer ce soir et demain matin.
                  Nous regarderons ensemble.
                  <span className="msg__time">{stamp(now)}</span>
                </div>
              </div>

              <div className="field" style={{ marginTop: 12 }}>
                <label className="field__label" htmlFor="reply">
                  Répondre
                </label>
                <textarea
                  id="reply"
                  rows={2}
                  defaultValue="Votre tension est restée élevée cette semaine. Passez au cabinet jeudi si possible."
                />
              </div>
              <button className="btn btn--block btn--sm" type="button">
                Envoyer le message
              </button>
            </div>
          </div>

          <div className="section-head" style={{ marginTop: 28 }}>
            <h2>Contexte</h2>
          </div>
          <p
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 16,
              lineHeight: 1.4,
              color: "var(--ink-2)",
              margin: 0,
            }}
          >
            {patient.notes}
          </p>

          <div className="note-card" style={{ marginTop: 24 }}>
            <p className="eyebrow" style={{ margin: 0 }}>
              Contact d&apos;urgence
            </p>
            <p style={{ fontSize: 14 }}>{patient.emergencyContact}</p>
            <p className="micro" style={{ marginTop: 6 }}>
              Prévenu sans détail clinique en cas d&apos;urgence
            </p>
          </div>
        </aside>
      </div>

      <p className="sub" style={{ marginTop: 40, fontSize: 10.5 }}>
        Dossier consulté le {longDate(now)}. Les niveaux et les annotations sont
        recalculés à partir des mesures ; aucune valeur n&apos;est saisie à la
        main.
      </p>
    </>
  );
}
