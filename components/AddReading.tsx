"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  DANGER_SYMPTOMS,
  T,
  evaluatePatient,
  type EvalResult,
  type Session,
  type Symptom,
} from "@/lib/alerts/rules";
import { SYMPTOM_LIST } from "@/lib/tone";
import { LEVEL_COLOR, LEVEL_WORD } from "@/lib/tone";

const PATIENT_MSG: Record<string, string> = {
  GREEN: "Bon, continuez comme ça. Votre médecin verra la mesure dans son registre.",
  YELLOW: "Continuez à mesurer. Pensez à votre traitement et au sel.",
  ORANGE: "Votre tension est élevée. Votre médecin a été informé.",
  SILENT: "Vous n'avez pas mesuré récemment.",
  CRISIS:
    "Reposez-vous trente minutes, remesurez, et contactez votre médecin aujourd'hui.",
  PENDING: "Reposez-vous cinq minutes et remesurez.",
  EMERGENCY: "Appelez le 14 maintenant.",
};

function Stepper({
  label,
  value,
  onChange,
  min,
  max,
  unit,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  unit: string;
}) {
  return (
    <div className="stepper">
      <button
        type="button"
        className="stepper__btn"
        aria-label={`Diminuer ${label}`}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        −
      </button>
      <div>
        <div className="stepper__label">{label}</div>
        <div className="stepper__value" aria-live="polite">
          {value}
        </div>
        <div className="stepper__label" style={{ letterSpacing: "0.06em" }}>
          {unit}
        </div>
      </div>
      <button
        type="button"
        className="stepper__btn"
        aria-label={`Augmenter ${label}`}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        +
      </button>
    </div>
  );
}

export function AddReading({
  history,
  target,
  expected,
  highRisk,
  lastOffice,
}: {
  history: Session[];
  target: { sys: number; dia: number };
  expected: number;
  highRisk: boolean;
  lastOffice: { sys: number; dia: number } | null;
}) {
  const [sys, setSys] = useState(128);
  const [dia, setDia] = useState(82);
  const [pulse, setPulse] = useState(76);
  const [pill, setPill] = useState<boolean | null>(true);
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [phase, setPhase] = useState<"form" | "pending" | "result">("form");
  const [pending, setPending] = useState<Session | null>(null);
  const [result, setResult] = useState<EvalResult | null>(null);
  const [shown, setShown] = useState<{ sys: number; dia: number }>({ sys: 0, dia: 0 });

  const isHigh = sys >= T.ORANGE_READING.sys || dia >= T.ORANGE_READING.dia;
  const hasDanger = symptoms.some((s) => DANGER_SYMPTOMS.includes(s));

  const toggleSymptom = (id: Symptom) =>
    setSymptoms((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );

  const submit = () => {
    const now = new Date();
    const base = {
      avgPulse: pulse,
      channel: "WEB" as const,
      pillTaken: pill,
      symptoms: [...symptoms],
      confirmedAt: now,
      supersededBySessionId: null,
    };

    if (phase === "pending" && pending) {
      /* Second measure: fold both sessions into one confirmed session. */
      const merged: Session = {
        id: `live-${now.getTime()}-b`,
        startedAt: now,
        avgSys: Math.round((pending.avgSys + sys) / 2),
        avgDia: Math.round((pending.avgDia + dia) / 2),
        status: "CONFIRMED",
        ...base,
      };
      const first: Session = {
        ...pending,
        status: "CONFIRMED",
        supersededBySessionId: merged.id,
      };
      const r = evaluatePatient({
        patient: {
          targetSys: target.sys,
          targetDia: target.dia,
          expectedReadingsPerWeek: expected,
          highRisk,
          lastOfficeSys: lastOffice?.sys ?? null,
          lastOfficeDia: lastOffice?.dia ?? null,
        },
        sessions: [...history, first, merged],
        now,
      });
      setResult(r);
      setShown({ sys: merged.avgSys, dia: merged.avgDia });
      setPhase("result");
      return;
    }

    const entry: Session = {
      id: `live-${now.getTime()}-a`,
      startedAt: now,
      avgSys: sys,
      avgDia: dia,
      status: hasDanger ? "CONFIRMED" : isHigh ? "PENDING" : "CONFIRMED",
      ...base,
    };

    const r = evaluatePatient({
      patient: {
        targetSys: target.sys,
        targetDia: target.dia,
        expectedReadingsPerWeek: expected,
        highRisk,
        lastOfficeSys: lastOffice?.sys ?? null,
        lastOfficeDia: lastOffice?.dia ?? null,
      },
      sessions: [...history, entry],
      now,
    });

    if (r.level === "PENDING") {
      setPending(entry);
      setPhase("pending");
      return;
    }

    setResult(r);
    setShown({ sys, dia });
    setPhase("result");
  };

  const reset = () => {
    setPhase("form");
    setPending(null);
    setResult(null);
    setSymptoms([]);
    setSys(128);
    setDia(82);
    setPulse(76);
  };

  const color = result ? LEVEL_COLOR[result.level] : "var(--royal-3)";

  const guidance = useMemo(() => {
    if (hasDanger)
      return "Un signe d'alerte a été coché. La mesure part immédiatement, sans seconde prise.";
    if (phase === "pending")
      return "Restez assis cinq minutes, puis mesurez une seconde fois. Les deux mesures seront moyennées.";
    if (isHigh)
      return "Au-dessus de 160/100, TensioCare demandera une seconde mesure avant de conclure.";
    return "Assis, cinq minutes de repos, deux mesures espacées d'une minute. Saisissez la moyenne.";
  }, [hasDanger, isHigh, phase]);

  return (
    <div className="phone">
      <div className="phone__bar">
        <Link href="/patient" style={{ color: "inherit" }}>
          ← Retour
        </Link>
        <span>{phase === "pending" ? "Seconde mesure" : "Nouvelle mesure"}</span>
      </div>

      <div className="phone__body">
        <div className="phone__brand">
          <span className="brand__name">
            Tensio<em>Care</em>
          </span>
          <span className="micro">
            {phase === "pending" ? "Étape 2 / 2" : "Étape 1 / 2"}
          </span>
        </div>

        {phase === "result" && result ? (
          <>
            <div
              className={`result ${result.level === "EMERGENCY" ? "result--danger" : ""}`}
              style={{ "--c": color } as React.CSSProperties}
            >
              <p className="eyebrow" style={{ margin: 0, color: "inherit", opacity: 0.7 }}>
                Mesure enregistrée
              </p>
              <p className="result__word">{LEVEL_WORD[result.level]}</p>
              <p className="result__msg">{PATIENT_MSG[result.level]}</p>
              <p className="result__ev">
                <span className="num">
                  {shown.sys}/{shown.dia}
                </span>{" "}
                · transmise au Dr. Benali
                {result.notifyDoctorNow ? " · notification immédiate" : ""}
              </p>

              {result.level === "EMERGENCY" && (
                <a className="call14" href="tel:14">
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                    <path d="M4.2 2.6h2.3l1 2.9-1.5 1.1a9 9 0 0 0 4.4 4.4l1.1-1.5 2.9 1v2.3c0 .8-.6 1.4-1.4 1.4A12.6 12.6 0 0 1 2.8 4c0-.8.6-1.4 1.4-1.4Z" strokeLinejoin="round" />
                  </svg>
                  Appeler le 14
                </a>
              )}
            </div>

            {result.level !== "EMERGENCY" && (
              <div className="guidance" style={{ marginTop: 14 }}>
                {result.notifyDoctorNow
                  ? "Votre médecin a reçu l'alerte. Il décide de la suite ; TensioCare ne modifie aucun traitement."
                  : "Votre mesure rejoint le registre. Elle sera lue au prochain résumé, sauf si elle change de niveau."}
              </div>
            )}

            <div className="toggle-row" style={{ marginTop: 14 }}>
              <button type="button" className="toggle" onClick={reset}>
                Nouvelle mesure
              </button>
              <Link
                href="/patient"
                className="toggle"
                style={{ display: "grid", placeItems: "center" }}
              >
                Terminer
              </Link>
            </div>
          </>
        ) : (
          <>
            {phase === "pending" && pending && (
              <div
                className="result"
                style={{ "--c": "var(--royal-3)" } as React.CSSProperties}
              >
                <p className="eyebrow" style={{ margin: 0 }}>
                  Première mesure
                </p>
                <p className="result__word" style={{ fontSize: 30 }}>
                  À confirmer
                </p>
                <p className="result__msg" style={{ fontSize: 16 }}>
                  Votre mesure de {pending.avgSys}/{pending.avgDia} est élevée.
                  Reposez-vous cinq minutes, puis mesurez à nouveau.
                </p>
              </div>
            )}

            <div className="measure" style={{ marginTop: phase === "pending" ? 18 : 0 }}>
              <Stepper
                label="Systolique"
                value={sys}
                onChange={setSys}
                min={70}
                max={260}
                unit="mmHg"
              />
              <Stepper
                label="Diastolique"
                value={dia}
                onChange={setDia}
                min={40}
                max={160}
                unit="mmHg"
              />
              <Stepper
                label="Pouls"
                value={pulse}
                onChange={setPulse}
                min={35}
                max={200}
                unit="battements / min"
              />
            </div>

            <div className="phone__section">
              <div className="phone__section-head">
                <h2>Traitement</h2>
                <span className="micro">aujourd&apos;hui</span>
              </div>
              <div className="toggle-row">
                <button
                  type="button"
                  className="toggle"
                  aria-pressed={pill === true}
                  onClick={() => setPill(true)}
                >
                  Prise faite
                </button>
                <button
                  type="button"
                  className="toggle"
                  aria-pressed={pill === false}
                  onClick={() => setPill(false)}
                >
                  Oubliée
                </button>
              </div>
            </div>

            <div className="phone__section">
              <div className="phone__section-head">
                <h2>Ressentez-vous quelque chose ?</h2>
                <span className="micro">facultatif</span>
              </div>
              <div className="symptoms">
                {SYMPTOM_LIST.map((s) => {
                  const id = s.id as Symptom;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={`sym ${s.danger ? "sym--danger" : ""}`}
                      aria-pressed={symptoms.includes(id)}
                      onClick={() => toggleSymptom(id)}
                    >
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 14 14"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.3"
                        aria-hidden
                      >
                        {s.danger ? (
                          <path d="M7 1.8 12.6 12.2H1.4Z" strokeLinejoin="round" />
                        ) : (
                          <circle cx="7" cy="7" r="5" />
                        )}
                      </svg>
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              className="guidance"
              style={{
                marginTop: 16,
                borderColor: hasDanger ? "var(--crimson)" : undefined,
                color: hasDanger ? "var(--crimson)" : undefined,
              }}
            >
              {guidance}
            </div>

            <button
              type="button"
              className="cta"
              style={{ marginTop: 16 }}
              onClick={submit}
            >
              {phase === "pending" ? "Envoyer la seconde mesure" : "Enregistrer la mesure"}
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden>
                <path d="M2 9h14M10 3l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <p className="micro" style={{ marginTop: 14, lineHeight: 1.6 }}>
              Aucun diagnostic n&apos;est posé par l&apos;application. En cas de
              malaise, appelez le 14.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
