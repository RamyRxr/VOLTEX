"use client";

import Link from "next/link";
import { useState } from "react";
import { BpChart } from "@/components/charts/BpChart";
import { useSelf } from "@/lib/client/queries";
import { clock, shortDate } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { PatientSelfView } from "@/lib/services/views";
import { PhoneBrand, PhoneFrame } from "./PhoneFrame";

const RANGES = [7, 30, 90] as const;
const DAY = 86_400_000;

export function HistoryView({ initial }: { initial: PatientSelfView }) {
  const { data } = useSelf(initial.patientId, initial);
  const v = data ?? initial;
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const inRange = v.sessions.filter((s) => Date.parse(v.generatedAt) - Date.parse(s.startedAt) <= days * DAY);

  return (
    <PhoneFrame barStart={<Link href="/p">← {t("common.back")}</Link>} barEnd={t("history.title")}>
      <PhoneBrand end={t("history.title")} />
      <div className="toggle-row toggle-row--3" role="group" aria-label={t("history.title")}>
        {RANGES.map((r) => (
          <button key={r} type="button" className="toggle" aria-pressed={days === r} onClick={() => setDays(r)}>
            {t("history.range", { n: r })}
          </button>
        ))}
      </div>

      <div className="chart-frame chart-frame--phone">
        <BpChart sessions={inRange} target={v.target} now={v.generatedAt} windowDays={days} />
      </div>

      <div className="phone__section">
        <div className="phone__section-head">
          <h2>{t("history.list")}</h2>
          <span className="micro num">{inRange.length}</span>
        </div>
        {inRange.length === 0 && <p className="sub">{t("history.empty")}</p>}
        <div className="history">
          {[...inRange].reverse().map((s) => (
            <div className="history__row" key={s.id}>
              <span className="history__d num">
                {shortDate(s.startedAt)} {clock(s.startedAt)}
              </span>
              <span className="history__bp num">
                {s.avgSys}/{s.avgDia}
              </span>
              <span className="history__tag">
                {t(`sessionStatus.${s.status}` as const)} · {t(`pill.${s.pillStatus}` as const)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </PhoneFrame>
  );
}
