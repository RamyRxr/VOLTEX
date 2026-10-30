"use client";

import Link from "next/link";
import { MiniChart } from "@/components/charts/MiniChart";
import { PatientStatusBadge } from "@/components/PatientStatusBadge";
import { Icon } from "@/components/ui/Icon";
import { useSelf } from "@/lib/client/queries";
import { CONFIG } from "@/lib/domain/config";
import { isValidForStats } from "@/lib/domain/session";
import { elapsed, stamp, weekdayDate } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { PatientSelfView } from "@/lib/services/views";
import { TONE_COLOR, toneVar } from "@/lib/tone";
import { PhoneBrand, PhoneFrame } from "./PhoneFrame";

const WEEK_MS = CONFIG.averageWindowDays * 86_400_000;

export function PatientHome({ initial, smsNumber }: { initial: PatientSelfView; smsNumber: string | null }) {
  const { data } = useSelf(initial.patientId, initial);
  const v = data ?? initial;
  const last = v.last;
  const fromDoctor = [...v.messages].reverse().find((m) => m.from === "DOCTOR");
  const week = v.sessions
    .filter((s) => isValidForStats(s) && Date.parse(v.generatedAt) - Date.parse(s.startedAt) <= WEEK_MS)
    .map((s) => ({ at: s.startedAt, sys: s.avgSys, dia: s.avgDia }));

  return (
    <PhoneFrame
      note={{ eyebrow: t("phome.stage.eyebrow"), title: t("phome.stage.title"), body: t("phome.stage.body") }}
      barStart={t("cover.patient")}
      barEnd={weekdayDate(v.generatedAt)}
    >
      <PhoneBrand end={t("phome.hello", { name: v.firstName })} />

      <section className="status-hero" style={toneVar(TONE_COLOR[v.status.tone])} aria-labelledby="status-title">
        <p className="eyebrow" id="status-title">
          {t("phome.status")}
        </p>
        <div className="status-hero__word">
          <PatientStatusBadge status={v.status} large />
        </div>
        <p className="status-hero__line">{v.advice}</p>
        <div className="status-hero__bp">
          <b className="num">{last ? `${last.avgSys}/${last.avgDia}` : t("common.none")}</b>
          <span>{last ? `${t("phome.last")} · ${elapsed(last.startedAt, v.generatedAt)}` : t("phome.noReading")}</span>
        </div>
      </section>

      {fromDoctor && (
        <section className="doctor-note" aria-live="polite">
          <p className="eyebrow">{t("phome.fromDoctor")}</p>
          <p className="doctor-note__body">{fromDoctor.body}</p>
          <span className="micro">{stamp(fromDoctor.createdAt)}</span>
        </section>
      )}

      <Link href="/p/add" className="cta">
        {t("phome.add")}
        <Icon name="arrow-right" size={18} />
      </Link>

      <div className="mini">
        <div className="mini__cell">
          <div className="mini__k">{t("phome.thisWeek")}</div>
          <div className="mini__v num">
            {t("phome.weekCount", { n: v.weekCount, expected: v.expectedReadingsPerWeek })} <small>{t("phome.weekUnit")}</small>
          </div>
        </div>
        <div className="mini__cell">
          <div className="mini__k">{t("dossier.target")}</div>
          <div className="mini__v num">
            {v.target.sys}/{v.target.dia}
          </div>
        </div>
      </div>

      <div className="phone__section">
        <div className="phone__section-head">
          <h2>{t("phome.week")}</h2>
          <span className="micro">{t("common.mmhg")}</span>
        </div>
        <MiniChart points={week} target={v.target} />
      </div>

      <nav className="phone-links" aria-label={t("nav.main")}>
        <Link href="/p/history" className="toggle">
          {t("phome.history")}
        </Link>
        <Link href="/p/contact" className="toggle">
          {t("phome.contact")}
        </Link>
      </nav>

      {smsNumber && <p className="micro phone__tip">{t("phome.smsTip", { number: smsNumber })}</p>}
      <p className="safety">
        <Icon name="phone" size={13} /> {t("phome.safety")}
      </p>
    </PhoneFrame>
  );
}
