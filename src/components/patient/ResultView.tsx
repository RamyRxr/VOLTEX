"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { SessionResultDto } from "@/app/api/sessions/route";
import { PatientStatusBadge } from "@/components/PatientStatusBadge";
import { Icon } from "@/components/ui/Icon";
import { mmss, useCountdown } from "@/lib/client/timers";
import { CONFIG } from "@/lib/domain/config";
import { tierOf } from "@/lib/domain/thresholds";
import type { BP } from "@/lib/domain/types";
import { bpText, t } from "@/lib/i18n";
import { TONE_COLOR, toneVar } from "@/lib/tone";

interface ResultViewProps {
  readonly result: SessionResultDto;
  readonly target: BP;
  readonly restEndsAt: number | null;
  readonly onRemeasure: () => void;
  readonly onAgain: () => void;
}

/** The instruction keeps the real rest time; demo mode only shortens the countdown. */
const REST_MINUTES = Math.round(CONFIG.restBeforeConfirmSeconds / 60);

export function ResultView({ result, target, restEndsAt, onRemeasure, onAgain }: ResultViewProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  const left = useCountdown(restEndsAt);
  const bp = { sys: result.session.avgSys, dia: result.session.avgDia };
  useEffect(() => heading.current?.focus(), [result.session.id]);

  if (result.outcome === "CALL_14") {
    return (
      <section className="result result--danger" aria-labelledby="result-title">
        <h2 id="result-title" ref={heading} tabIndex={-1} className="result__word">
          {t("result.call14.title")}
        </h2>
        <p className="result__msg">{t("result.call14.body")}</p>
        <a className="call14 call14--big" href="tel:14">
          <Icon name="phone" size={22} />
          {t("result.call14.button")}
        </a>
        <p className="result__ev num">{bpText(bp)}</p>
        <Link href="/p" className="btn btn--block btn--outline-light">
          {t("result.home")}
        </Link>
      </section>
    );
  }

  if (result.outcome === "REMEASURE") {
    const low = tierOf(bp, target) === "LOW";
    return (
      <section className="result" style={toneVar("var(--royal-3)")} aria-labelledby="result-title">
        <p className="eyebrow">{t("result.recorded")}</p>
        <h2 id="result-title" ref={heading} tabIndex={-1} className="result__word result__word--sm">
          {t("result.remeasure.title", { minutes: REST_MINUTES })}
        </h2>
        <p className="result__msg">{t(low ? "result.remeasure.bodyLow" : "result.remeasure.bodyHigh", { bp: bpText(bp) })}</p>
        <p className="result__ev">{result.advice}</p>
        <div className="countdown" aria-hidden>
          <span className="countdown__n num">{mmss(left)}</span>
        </div>
        <button type="button" className="cta" disabled={left > 0} onClick={onRemeasure}>
          {left > 0 ? t("result.remeasure.countdown", { time: mmss(left) }) : t("result.remeasure.go")}
          <Icon name="arrow-right" size={18} />
        </button>
        <p className="sr-only" role="status">
          {left === 0 ? t("result.remeasure.go") : ""}
        </p>
      </section>
    );
  }

  const urgent = result.status.word === "URGENT";
  return (
    <>
      <section className="result" style={toneVar(TONE_COLOR[result.status.tone])} aria-labelledby="result-title">
        <p className="eyebrow">{t("result.recorded")}</p>
        <h2 id="result-title" ref={heading} tabIndex={-1} className="result__word">
          <PatientStatusBadge status={result.status} large />
        </h2>
        <p className="result__msg">{result.advice}</p>
        <p className="result__ev num">
          {t("result.sent", { bp: bpText(bp) })}
          {urgent ? ` · ${t("result.notified")}` : ""}
        </p>
      </section>
      <div className="toggle-row result__next">
        <Link href="/p" className="toggle">
          {t("result.home")}
        </Link>
        <button type="button" className="toggle" onClick={onAgain}>
          {t("result.again")}
        </button>
      </div>
    </>
  );
}
