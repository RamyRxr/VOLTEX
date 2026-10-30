"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { StatusMark } from "./StatusMark";
import { Sparkline } from "./Sparkline";
import { elapsed } from "@/lib/format";
import { LEVEL_COLOR } from "@/lib/tone";
import type { RegistryRow } from "@/lib/data";
import type { Level } from "@/lib/alerts/rules";

type Filter = "all" | "action" | "drift" | "silence" | "stable";

const FILTERS: { id: Filter; label: string; test?: (r: RegistryRow) => boolean }[] = [
  { id: "all", label: "Tous" },
  { id: "action", label: "À traiter", test: (r) => r.rank <= 3 },
  { id: "drift", label: "Dérive", test: (r) => r.level === "YELLOW" },
  { id: "silence", label: "Silence", test: (r) => r.level === "SILENT" },
  { id: "stable", label: "Stables", test: (r) => r.level === "GREEN" },
];

export function Ledger({ rows, nowIso }: { rows: RegistryRow[]; nowIso: string }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const now = useMemo(() => new Date(nowIso), [nowIso]);

  const visible = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter);
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (f?.test && !f.test(r)) return false;
      if (q && !r.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, filter, query]);

  return (
    <>
      <div className="filing no-print">
        {FILTERS.map((f) => {
          const count = f.test ? rows.filter(f.test).length : rows.length;
          return (
            <button
              key={f.id}
              type="button"
              className="chip"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
              <span style={{ opacity: 0.55, marginLeft: 6 }}>{count}</span>
            </button>
          );
        })}
        <label className="search">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
            <circle cx="6" cy="6" r="4.2" />
            <path d="m9.2 9.2 3.2 3.2" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un patient"
            aria-label="Rechercher un patient"
          />
        </label>
      </div>

      <div className="ledger">
        <div className="ledger__head" aria-hidden>
          <span>#</span>
          <span>Patient</span>
          <span>Dernière</span>
          <span>Moy. 7 j</span>
          <span>Tendance</span>
          <span>Observance</span>
          <span>Motif de triage</span>
          <span />
        </div>

        {visible.length === 0 && (
          <p className="empty">Aucun patient ne correspond à ce filtre.</p>
        )}

        {visible.map((r, i) => {
          const bp = r.pending ?? (r.lastSys != null ? { sys: r.lastSys, dia: r.lastDia! } : null);
          const color = LEVEL_COLOR[r.level as Level];
          return (
            <Link
              key={r.id}
              href={`/doctor/patients/${r.id}`}
              className="row"
              data-severe={r.rank <= 1 ? "true" : undefined}
              style={{ "--c": color } as React.CSSProperties}
            >
              <span className="row__rank num">
                {String(i + 1).padStart(2, "0")}
              </span>

              <span className="row__person">
                <span className="row__name">{r.name}</span>
                <span className="row__meta">
                  <StatusMark level={r.level} />
                  <span className="num">
                    {r.age} ans · {r.sex}
                  </span>
                  {r.highRisk && (
                    <span
                      className="tag"
                      title="Patient à risque élevé : âge, diabète ou antécédent cardiovasculaire"
                    >
                      risque
                    </span>
                  )}
                  {r.notes > 0 && (
                    <span className="tag tag--gold" title="Annotation clinique à lire">
                      note
                    </span>
                  )}
                </span>
              </span>

              <span className="row__bp num">
                {bp ? (
                  <>
                    {bp.sys}/{bp.dia}
                    {r.pending && <small>attente</small>}
                  </>
                ) : (
                  <span className="row__bp--flat">—</span>
                )}
                <span
                  style={{
                    display: "block",
                    fontSize: 9.5,
                    fontWeight: 400,
                    color: "var(--ink-3)",
                    letterSpacing: "0.04em",
                  }}
                >
                  {r.lastAt ? elapsed(new Date(r.lastAt), now) : "jamais"}
                </span>
              </span>

              <span className="row__avg num">
                {r.avgSys != null ? `${r.avgSys}/${r.avgDia}` : "—"}
              </span>

              <span className="row__trend">
                <Sparkline
                  values={r.spark}
                  color={r.trendPerWeek != null && r.trendPerWeek >= 2 ? "var(--ochre)" : "var(--royal)"}
                />
                {r.trendPerWeek != null && Math.abs(r.trendPerWeek) >= 2 && (
                  <span className="num" style={{ fontSize: 9.5 }}>
                    {r.trendPerWeek > 0 ? "+" : ""}
                    {r.trendPerWeek}
                  </span>
                )}
              </span>

              <span className="row__adherence">
                <span className="bar">
                  <i style={{ width: `${Math.round((r.adherence ?? 0) * 100)}%` }} />
                </span>
                <span className="bar__label num">
                  {r.adherence != null ? `${Math.round(r.adherence * 100)} %` : "—"}
                </span>
              </span>

              <span className="row__reason" title={r.reason}>
                {r.reason}
              </span>

              <span className="row__chev" aria-hidden>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4">
                  <path d="m4 2 4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
