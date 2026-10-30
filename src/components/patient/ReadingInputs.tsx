"use client";

import { Stepper } from "@/components/ui/Stepper";
import { Icon } from "@/components/ui/Icon";
import { CONFIG } from "@/lib/domain/config";
import { ALL_SYMPTOMS, isDangerSymptom } from "@/lib/domain/thresholds";
import type { PillStatus, SymptomType } from "@/lib/domain/types";
import { t } from "@/lib/i18n";

export interface ReadingDraft {
  readonly sys: number;
  readonly dia: number;
  readonly pulse: number;
}

export function ReadingSteppers({
  idPrefix,
  value,
  disabled,
  onChange,
}: {
  idPrefix: string;
  value: ReadingDraft;
  disabled?: boolean;
  onChange: (next: ReadingDraft) => void;
}) {
  const { plausible } = CONFIG;
  return (
    <div className="measure">
      <Stepper id={`${idPrefix}-sys`} label={t("add.sys")} unit={t("common.mmhg")} value={value.sys} min={plausible.sys.min} max={plausible.sys.max} disabled={disabled} onChange={(sys) => onChange({ ...value, sys })} />
      <Stepper id={`${idPrefix}-dia`} label={t("add.dia")} unit={t("common.mmhg")} value={value.dia} min={plausible.dia.min} max={plausible.dia.max} disabled={disabled} onChange={(dia) => onChange({ ...value, dia })} />
      <Stepper id={`${idPrefix}-pulse`} label={t("add.pulse")} unit={t("common.bpm")} value={value.pulse} min={plausible.pulse.min} max={plausible.pulse.max} disabled={disabled} onChange={(pulse) => onChange({ ...value, pulse })} />
    </div>
  );
}

const PILL_CHOICES: readonly PillStatus[] = ["TAKEN", "MISSED", "NOT_REPORTED"];

/** Taken / missed / don't know. Nothing is pre-selected: unanswered is NOT_REPORTED, never "missed". */
export function PillChoice({ value, onChange }: { value: PillStatus | null; onChange: (v: PillStatus) => void }) {
  return (
    <fieldset className="phone__section choice">
      <legend className="phone__section-head">
        <h2>{t("add.pill.title")}</h2>
      </legend>
      <div className="toggle-row toggle-row--3">
        {PILL_CHOICES.map((p) => (
          <button key={p} type="button" className="toggle" aria-pressed={value === p} onClick={() => onChange(p)}>
            {t(`add.pill.${p}` as const)}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function SymptomPicker({ value, onChange }: { value: readonly SymptomType[]; onChange: (v: SymptomType[]) => void }) {
  const toggle = (s: SymptomType) => onChange(value.includes(s) ? value.filter((x) => x !== s) : [...value, s]);
  return (
    <fieldset className="phone__section choice">
      <legend className="phone__section-head">
        <h2>{t("add.symptoms.title")}</h2>
        <span className="micro">{t("add.symptoms.hint")}</span>
      </legend>
      <div className="symptoms">
        {ALL_SYMPTOMS.map((s) => {
          const danger = isDangerSymptom(s);
          return (
            <button key={s} type="button" className={`sym ${danger ? "sym--danger" : ""}`} aria-pressed={value.includes(s)} onClick={() => toggle(s)}>
              <Icon name={danger ? "alert-triangle" : "check-circle"} size={14} />
              {t(`symptom.${s}` as const)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** A danger sign is never delayed by a re-measure: call 14 and send now. */
export function DangerPanel({ sending, onSend }: { sending: boolean; onSend: () => void }) {
  return (
    <section className="danger-panel" role="alert">
      <p className="danger-panel__title">
        <Icon name="alert-octagon" size={20} /> {t("add.danger.title")}
      </p>
      <p className="danger-panel__body">{t("add.danger.body")}</p>
      <a className="call14" href="tel:14">
        <Icon name="phone" size={18} />
        {t("add.danger.call")}
      </a>
      <button type="button" className="btn btn--block btn--paper" disabled={sending} onClick={onSend}>
        {sending ? t("add.submitting") : t("add.danger.send")}
      </button>
    </section>
  );
}
