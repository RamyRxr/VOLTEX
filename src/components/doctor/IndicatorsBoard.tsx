"use client";

import { useState } from "react";
import { Sparkline } from "@/components/charts/Sparkline";
import { Glyph } from "@/components/StatusMark";
import { useIndicators } from "@/lib/client/queries";
import { CONFIG } from "@/lib/domain/config";
import type { AlertLevel } from "@/lib/domain/types";
import { longDate, pct } from "@/lib/format";
import { bpText, fixed, t } from "@/lib/i18n";
import { INDICATOR_PERIODS, type IndicatorPeriod } from "@/lib/services/indicatorPeriods";
import type { IndicatorsDto } from "@/lib/services/indicators";
import { LEVEL_COLOR, toneVar } from "@/lib/tone";

const LEVELS: readonly AlertLevel[] = ["RED_EMERGENCY", "RED_CRISIS", "ORANGE", "YELLOW", "GREY_SILENT"];
const DEFAULT_PERIOD: IndicatorPeriod = 8;
const SPARK = { width: 132, height: 26 } as const;

const series = (xs: readonly (number | null)[]) => xs.filter((x): x is number => x != null);

interface FigureProps {
  readonly label: string;
  readonly value: string | null;
  readonly unit: string;
  readonly caption: string;
  readonly spark?: readonly number[];
  readonly color?: string;
  readonly children?: React.ReactNode;
}

function Figure({ label, value, unit, caption, spark, color, children }: FigureProps) {
  return (
    <div className="figure">
      <span className="figure__label">{label}</span>
      <span className="figure__value num">
        {value ?? <span className="figure__none">{t("ind.noData")}</span>}
        {value != null && <span className="figure__unit">{unit}</span>}
      </span>
      {spark && spark.length > 1 && (
        <span className="figure__spark">
          <Sparkline values={[...spark]} width={SPARK.width} height={SPARK.height} color={color} fill />
        </span>
      )}
      {children}
      <span className="figure__cap">{caption}</span>
    </div>
  );
}

function BriefFigures({ ind }: { ind: IndicatorsDto }) {
  const evolution = ind.evolution.series;
  return (
    <div className="figures figures--4">
      <Figure
        label={t("ind.frequency.label")}
        value={ind.frequency.value == null ? null : fixed(ind.frequency.value)}
        unit={t("ind.frequency.unit")}
        caption={t("ind.frequency.cap")}
        spark={series(ind.frequency.series)}
      />
      <Figure
        label={t("ind.evolution.label")}
        value={ind.evolution.value ? bpText(ind.evolution.value) : null}
        unit={t("ind.evolution.unit")}
        caption={t("ind.evolution.cap")}
        spark={series(evolution.map((e) => e?.sys ?? null))}
      />
      <Figure
        label={t("ind.alerts.label")}
        value={String(ind.alerts.total)}
        unit={t("ind.alerts.unit")}
        caption={t("ind.alerts.cap")}
        spark={[...ind.alerts.series]}
        color="var(--amber)"
      >
        <span className="figure__levels">
          {LEVELS.filter((l) => ind.alerts.byLevel[l] > 0).map((l) => (
            <span key={l} className="mark" style={toneVar(LEVEL_COLOR[l])}>
              <Glyph level={l} size={11} />
              <span className="num">{ind.alerts.byLevel[l]}</span> {t(`level.${l}` as const)}
            </span>
          ))}
        </span>
      </Figure>
      <Figure
        label={t("ind.regularity.label")}
        value={ind.regularity.value == null ? null : pct(ind.regularity.value)}
        unit={t("ind.regularity.unit")}
        caption={t("ind.regularity.cap", { silent: ind.regularity.silentNow })}
        spark={series(ind.regularity.series)}
      />
    </div>
  );
}

function OutcomeFigures({ ind }: { ind: IndicatorsDto }) {
  return (
    <div className="figures figures--2">
      <Figure
        label={t("ind.control.label")}
        value={ind.control.value == null ? null : pct(ind.control.value)}
        unit={t("ind.control.unit")}
        caption={t("ind.control.cap", { bp: bpText(CONFIG.defaultTarget), evaluated: ind.control.evaluated })}
        spark={series(ind.control.series)}
        color="var(--emerald)"
      />
      <Figure
        label={t("ind.response.label")}
        value={ind.response.value == null ? null : fixed(ind.response.value, 0)}
        unit={t("ind.response.unit")}
        caption={t("ind.response.cap", { n: ind.response.count })}
        spark={series(ind.response.series)}
        color="var(--gold)"
      />
    </div>
  );
}

export function IndicatorsBoard({ initial }: { initial: IndicatorsDto }) {
  const [weeks, setWeeks] = useState<IndicatorPeriod>(DEFAULT_PERIOD);
  const { data, isError, isFetching } = useIndicators(weeks, weeks === DEFAULT_PERIOD ? initial : undefined);
  const ind = data ?? initial;

  return (
    <>
      <div className="page-head">
        <div className="page-head__left">
          <p className="eyebrow">{t("ind.eyebrow", { date: longDate(ind.generatedAt) })}</p>
          <h1 className="title">{t("ind.title")}</h1>
          <p className="sub">{t("ind.sub", { weeks, patients: ind.patients })}</p>
        </div>
        <div className="filing period" role="group" aria-label={t("ind.period")} aria-busy={isFetching}>
          {INDICATOR_PERIODS.map((w) => (
            <button key={w} type="button" className="chip" aria-pressed={weeks === w} onClick={() => setWeeks(w)}>
              {t("ind.weeks", { n: w })}
            </button>
          ))}
        </div>
      </div>
      {isError && (
        <p className="banner-error" role="status">
          {t("common.error")}
        </p>
      )}

      <h2 className="eyebrow figures__title">{t("ind.brief")}</h2>
      <BriefFigures ind={ind} />
      <h2 className="eyebrow figures__title">{t("ind.outcome")}</h2>
      <OutcomeFigures ind={ind} />

      <div className="lede-block">
        <p className="eyebrow">{t("ind.reserve.title")}</p>
        <p className="reserve">{t("ind.reserve.body")}</p>
      </div>
    </>
  );
}
