import Link from "next/link";
import { Ledger } from "@/components/Ledger";
import { StatusMark } from "@/components/StatusMark";
import { buildRegistry, countByLevel, toRow } from "@/lib/data";
import { elapsed, longDate, shortDate } from "@/lib/format";
import { LEVEL_COLOR, LEVEL_SHORT } from "@/lib/tone";
import type { Level } from "@/lib/alerts/rules";

export const dynamic = "force-dynamic";

const DISPATCH: Level[] = [
  "EMERGENCY",
  "PENDING",
  "ORANGE",
  "YELLOW",
  "SILENT",
  "GREEN",
];

export default function TriagePage() {
  const now = new Date();
  const registry = buildRegistry(now);
  const rows = registry.map(toRow);
  const counts = countByLevel(registry);
  const needsDoctor = registry.filter((p) => p.result.rank <= 5);

  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const receivedToday = registry.reduce(
    (n, p) => n + p.sessions.filter((s) => s.startedAt >= dayStart).length,
    0,
  );

  return (
    <>
      <div className="page-head">
        <div className="page-head__left">
          <p className="eyebrow">Registre · {longDate(now)}</p>
          <h1 className="title">Triage du jour</h1>
          <p className="sub">
            {registry.length} patients sous suivi · {receivedToday} mesures
            reçues aujourd&apos;hui · dernière synchronisation{" "}
            {shortDate(now)} à{" "}
            {`${String(now.getHours()).padStart(2, "0")}:${String(
              now.getMinutes(),
            ).padStart(2, "0")}`}
          </p>
        </div>

        <div className="dispatch" aria-label="Répartition par niveau">
          {DISPATCH.filter((l) => counts[l] > 0).map((l) => (
            <span
              key={l}
              className="dispatch__item"
              style={{ "--c": LEVEL_COLOR[l] } as React.CSSProperties}
            >
              <i
                className="dispatch__dot"
                style={{ background: "var(--c)", color: "var(--c)" }}
                aria-hidden
              />
              <span className="dispatch__n num">{counts[l]}</span>
              <span style={{ color: "var(--ink-3)" }}>{LEVEL_SHORT[l]}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="ledger-wrap">
        <div>
          <Ledger rows={rows} nowIso={now.toISOString()} />
          <p className="sub" style={{ marginTop: 14, fontSize: 11 }}>
            Trié par gravité, puis par fraîcheur de la dernière mesure. Le
            niveau est recalculé à chaque lecture ; il n&apos;est jamais stocké
            à la main.
          </p>
        </div>

        <aside className="aside no-print">
          <div className="aside__title">
            <h2 className="eyebrow" style={{ margin: 0 }}>
              À examiner
            </h2>
            <span className="num" style={{ fontSize: 11, color: "var(--ink-3)" }}>
              {needsDoctor.length}
            </span>
          </div>

          <div className="aside__list">
            {needsDoctor.slice(0, 5).map((p, i) => (
              <Link
                key={p.id}
                href={`/doctor/patients/${p.id}`}
                className="aside__item"
                style={{ color: "inherit" }}
              >
                <span className="aside__n">0{i + 1}</span>
                <span className="aside__body">
                  <span
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <span className="aside__who">{p.name}</span>
                    <StatusMark level={p.result.level} />
                  </span>
                  <p>{p.reason}</p>
                  <span className="micro" style={{ display: "block", marginTop: 5 }}>
                    {p.result.stats.lastSessionAt
                      ? elapsed(p.result.stats.lastSessionAt, now)
                      : "aucune mesure"}
                  </span>
                </span>
              </Link>
            ))}
          </div>

          <div className="note-card">
            <p className="eyebrow" style={{ margin: 0 }}>
              Règle de charge
            </p>
            <p>
              Seules les urgences et les crises notifient en temps réel. Tout le
              reste attend le résumé de 8 h.
            </p>
          </div>

          <div className="note-card" style={{ background: "var(--paper)" }}>
            <p className="eyebrow" style={{ margin: 0 }}>
              Ce que le système ne fait pas
            </p>
            <p style={{ fontSize: 14 }}>
              Il ne prescrit pas, ne modifie pas une dose et ne remplace pas la
              consultation. Il range, il signale, il rappelle.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
