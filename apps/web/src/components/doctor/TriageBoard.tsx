"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { StatusMark } from "@/components/StatusMark";
import { Icon } from "@/components/ui/Icon";
import { useTriage } from "@/lib/client/queries";
import { clock, elapsed, longDate, shortDate } from "@/lib/format";
import { t, type MessageKey } from "@/lib/i18n";
import { GROUP_ORDER } from "@/lib/services/triageOrder";
import type { TriageDto, TriageGroup, TriageRowDto } from "@/lib/services/views";
import { GROUP_COLOR, toneVar } from "@/lib/tone";
import { TriageRow } from "./TriageRow";

type Filter = "all" | "act" | "watch" | "unconfirmed" | "silent" | "stable";

const FILTERS: readonly { id: Filter; test?: (r: TriageRowDto) => boolean }[] = [
  { id: "all" },
  { id: "act", test: (r) => r.group === "EMERGENCY" || r.group === "CRISIS" || r.group === "ORANGE" },
  { id: "watch", test: (r) => r.group === "YELLOW" },
  { id: "unconfirmed", test: (r) => r.unconfirmed != null },
  { id: "silent", test: (r) => r.silent != null },
  { id: "stable", test: (r) => r.group === "GREEN" },
];

const GROUP_WORD: Record<TriageGroup, MessageKey> = {
  EMERGENCY: "level.RED_EMERGENCY",
  CRISIS: "level.RED_CRISIS",
  ORANGE: "level.ORANGE",
  YELLOW: "level.YELLOW",
  UNCONFIRMED: "tag.unconfirmed",
  SILENT: "level.GREY_SILENT",
  GREEN: "level.GREEN",
};

const ASIDE_SIZE = 5;

function Dispatch({ counts }: { counts: TriageDto["counts"] }) {
  return (
    <div className="dispatch" aria-label={t("triage.dispatch")}>
      {GROUP_ORDER.filter((g) => counts[g] > 0).map((g) => (
        <span key={g} className="dispatch__item" style={toneVar(GROUP_COLOR[g])}>
          <i className="dispatch__dot" style={{ color: "var(--c)" }} aria-hidden />
          <span className="dispatch__n num">{counts[g]}</span>
          <span className="dispatch__word">{t(GROUP_WORD[g])}</span>
        </span>
      ))}
    </div>
  );
}

function Aside({ triage }: { triage: TriageDto }) {
  const needs = triage.rows.filter((r) => r.group !== "GREEN");
  return (
    <aside className="aside no-print">
      <div className="aside__title">
        <h2 className="eyebrow">{t("triage.aside")}</h2>
        <span className="num micro">{needs.length}</span>
      </div>
      <div className="aside__list">
        {needs.slice(0, ASIDE_SIZE).map((r, i) => (
          <Link key={r.patientId} href={`/d/patients/${r.patientId}`} className="aside__item">
            <span className="aside__n">{String(i + 1).padStart(2, "0")}</span>
            <span className="aside__body">
              <span className="aside__line">
                <span className="aside__who">{r.name}</span>
                <StatusMark level={r.level} />
              </span>
              <p>{r.reason}</p>
              <span className="micro">{r.last ? elapsed(r.last.at, triage.generatedAt) : t("time.never")}</span>
            </span>
          </Link>
        ))}
      </div>
      <div className="note-card">
        <p className="eyebrow">{t("triage.rule.title")}</p>
        <p>{t("triage.rule.body")}</p>
      </div>
      <div className="note-card note-card--plain">
        <p className="eyebrow">{t("triage.limits.title")}</p>
        <p>{t("triage.limits.body")}</p>
      </div>
    </aside>
  );
}

export function TriageBoard({ initial }: { initial: TriageDto }) {
  const { data, isError } = useTriage(initial);
  const triage = data ?? initial;
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const test = FILTERS.find((f) => f.id === filter)?.test;
    const q = query.trim().toLocaleLowerCase("fr");
    return triage.rows.filter((r) => (!test || test(r)) && (!q || r.name.toLocaleLowerCase("fr").includes(q)));
  }, [triage.rows, filter, query]);

  return (
    <>
      <div className="page-head">
        <div className="page-head__left">
          <p className="eyebrow">{t("triage.eyebrow", { date: longDate(triage.generatedAt) })}</p>
          <h1 className="title">{t("triage.title")}</h1>
          <p className="sub">
            {t("triage.sub", {
              patients: triage.rows.length,
              today: triage.receivedToday,
              time: `${shortDate(triage.generatedAt)} ${clock(triage.generatedAt)}`,
            })}
          </p>
        </div>
        <Dispatch counts={triage.counts} />
      </div>

      {isError && (
        <p className="banner-error" role="status">
          {t("common.error")}
        </p>
      )}

      <div className="ledger-wrap">
        <div>
          <div className="filing no-print">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" className="chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                {t(`triage.filter.${f.id}` as const)}
                <span className="chip__n num">{f.test ? triage.rows.filter(f.test).length : triage.rows.length}</span>
              </button>
            ))}
            <label className="search">
              <Icon name="search" size={13} />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("triage.search")} aria-label={t("triage.search")} />
            </label>
          </div>

          <div className="ledger">
            <div className="ledger__head" aria-hidden>
              <span>{t("triage.col.rank")}</span>
              <span>{t("triage.col.patient")}</span>
              <span>{t("triage.col.last")}</span>
              <span>{t("triage.col.avg")}</span>
              <span>{t("triage.col.trend")}</span>
              <span>{t("triage.col.adherence")}</span>
              <span>{t("triage.col.reason")}</span>
              <span />
            </div>
            {visible.length === 0 && <p className="empty">{t("triage.empty")}</p>}
            {visible.map((r, i) => (
              <TriageRow key={r.patientId} row={r} index={i} now={triage.generatedAt} />
            ))}
          </div>
          <p className="sub ledger-note">{t("triage.sortNote")}</p>
        </div>
        <Aside triage={triage} />
      </div>
    </>
  );
}
