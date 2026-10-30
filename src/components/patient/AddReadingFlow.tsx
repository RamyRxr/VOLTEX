"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import type { SessionResultDto } from "@/app/api/sessions/route";
import { Icon } from "@/components/ui/Icon";
import { apiSend } from "@/lib/client/api";
import { useCountdown, useOnline } from "@/lib/client/timers";
import { CONFIG } from "@/lib/domain/config";
import { averageReadings } from "@/lib/domain/session";
import { formatSmsBody } from "@/lib/domain/sms/parse";
import { isDangerSymptom } from "@/lib/domain/thresholds";
import type { BP, PillStatus, SymptomType } from "@/lib/domain/types";
import type { Timings } from "@/lib/demo";
import { bpText, t } from "@/lib/i18n";
import { PhoneBrand, PhoneFrame } from "./PhoneFrame";
import { DangerPanel, PillChoice, ReadingSteppers, SymptomPicker, type ReadingDraft } from "./ReadingInputs";
import { ResultView } from "./ResultView";

interface TimedReading extends ReadingDraft {
  readonly takenAt: string;
}

const DEFAULT_DRAFT: ReadingDraft = CONFIG.stepperDefaults;

const NOTE = {
  eyebrow: t("add.stage.eyebrow"),
  title: t("add.stage.title"),
  body: t("add.stage.body"),
  steps: [
    { title: t("add.stage.step1"), body: t("add.stage.step1Body") },
    { title: t("add.stage.step2"), body: t("add.stage.step2Body") },
    { title: t("add.stage.step3"), body: t("add.stage.step3Body") },
  ],
};

function SmsFallback({ number, body }: { number: string | null; body: string }) {
  return (
    <div className="sms-fallback">
      <a className="btn btn--block btn--ghost" href={`sms:${number ?? ""}?body=${encodeURIComponent(body)}`}>
        <Icon name="message" size={14} />
        {t("add.sms")}
      </a>
      <p className="micro">{t("add.smsHint")}</p>
    </div>
  );
}

/**
 * One screen (spec §4.1): two readings a minute apart with big steppers,
 * pill status and symptoms on the same screen; a danger sign sends at once.
 */
export function AddReadingFlow({ target, timings, smsNumber }: { target: BP; timings: Timings; smsNumber: string | null }) {
  const qc = useQueryClient();
  const online = useOnline();
  const [confirming, setConfirming] = useState(false);
  const [draft, setDraft] = useState<ReadingDraft>(DEFAULT_DRAFT);
  const [first, setFirst] = useState<TimedReading | null>(null);
  const [gapEndsAt, setGapEndsAt] = useState<number | null>(null);
  const [pill, setPill] = useState<PillStatus | null>(null);
  const [symptoms, setSymptoms] = useState<SymptomType[]>([]);
  const [result, setResult] = useState<SessionResultDto | null>(null);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const gapLeft = useCountdown(gapEndsAt);
  const step: 1 | "wait" | 2 = first == null ? 1 : gapLeft > 0 ? "wait" : 2;
  const danger = symptoms.some(isDangerSymptom);

  const send = useMutation({
    mutationFn: (readings: readonly TimedReading[]) =>
      apiSend<SessionResultDto>("/api/sessions", "POST", { readings, pillStatus: pill ?? "NOT_REPORTED", symptoms }),
    onSuccess: (res) => {
      setResult(res);
      setRestEndsAt(res.outcome === "REMEASURE" ? Date.now() + res.restSeconds * 1000 : null);
      void qc.invalidateQueries();
      window.scrollTo({ top: 0 });
    },
  });

  const readingsNow = (): TimedReading[] => {
    const current = { ...draft, takenAt: new Date().toISOString() };
    if (!first) return [current];
    return step === 2 ? [first, current] : [first];
  };

  const restart = (prefill: ReadingDraft, asConfirmation: boolean) => {
    setResult(null);
    setRestEndsAt(null);
    setFirst(null);
    setGapEndsAt(null);
    setDraft(prefill);
    setSymptoms([]);
    setConfirming(asConfirmation);
    send.reset();
  };

  if (result) {
    const again = { sys: result.session.avgSys, dia: result.session.avgDia, pulse: result.session.avgPulse ?? DEFAULT_DRAFT.pulse };
    return (
      <PhoneFrame note={NOTE} barStart={<Link href="/p">← {t("common.back")}</Link>} barEnd={t("result.recorded")}>
        <PhoneBrand end={bpText({ sys: result.session.avgSys, dia: result.session.avgDia })} />
        <ResultView result={result} target={target} restEndsAt={restEndsAt} onRemeasure={() => restart(again, true)} onAgain={() => restart(DEFAULT_DRAFT, false)} />
      </PhoneFrame>
    );
  }

  const avg = averageReadings(readingsNow());
  const smsBody = formatSmsBody({ sys: avg.avgSys, dia: avg.avgDia, pulse: avg.avgPulse, pillStatus: pill ?? "NOT_REPORTED", symptoms });

  return (
    <PhoneFrame note={NOTE} barStart={<Link href="/p">← {t("common.back")}</Link>} barEnd={confirming ? t("add.confirmTitle") : t("add.title")}>
      <PhoneBrand end={t("add.readingOf", { n: step === 1 ? 1 : 2 })} />

      <section className="guidance">
        <p className="guidance__title">{confirming ? t("add.confirmTitle") : t("add.guide.title")}</p>
        <ol className="guidance__list">
          <li>{t("add.guide.1")}</li>
          <li>{t("add.guide.2")}</li>
          <li>{t("add.guide.3")}</li>
        </ol>
      </section>

      {danger && <DangerPanel sending={send.isPending} onSend={() => send.mutate(readingsNow())} />}

      {first && (
        <p className="first-reading num">
          {t("add.firstSaved", { bp: bpText(first), pulse: first.pulse })}
          <button type="button" className="link-button" onClick={() => { setDraft(first); setFirst(null); setGapEndsAt(null); }}>
            {t("add.editFirst")}
          </button>
        </p>
      )}

      <h2 className="reading-title">{t("add.reading", { n: first ? 2 : 1 })}</h2>
      {step === "wait" && (
        <div className="countdown countdown--inline" role="timer" aria-live="off">
          <span className="countdown__n num">{gapLeft}</span>
          <span>
            {t("add.wait", { seconds: gapLeft })}
            <br />
            <span className="micro">{t("add.waitHint")}</span>
          </span>
        </div>
      )}
      {step === 2 && (
        <p className="ready" role="status">
          {t("add.ready")}
        </p>
      )}
      <ReadingSteppers idPrefix={first ? "r2" : "r1"} value={draft} disabled={step === "wait"} onChange={setDraft} />
      <p className="micro stepper-hint">{t("add.holdHint")}</p>

      <PillChoice value={pill} onChange={setPill} />
      <SymptomPicker value={symptoms} onChange={setSymptoms} />

      {step === 1 ? (
        <button type="button" className="cta" onClick={() => { setFirst({ ...draft, takenAt: new Date().toISOString() }); setGapEndsAt(Date.now() + timings.readingGapSeconds * 1000); }}>
          {t("add.validateFirst")}
          <Icon name="arrow-right" size={18} />
        </button>
      ) : (
        <button type="button" className="cta" disabled={step === "wait" || send.isPending} onClick={() => send.mutate(readingsNow())}>
          {send.isPending ? t("add.submitting") : t("add.submit")}
          <Icon name="arrow-right" size={18} />
        </button>
      )}

      {send.isError && (
        <p className="field__error" role="alert">
          {t("add.error")}
        </p>
      )}
      {(!online || send.isError) && <SmsFallback number={smsNumber} body={smsBody} />}
      <p className="safety">
        <Icon name="phone" size={13} /> {t("phome.safety")}
      </p>
    </PhoneFrame>
  );
}
