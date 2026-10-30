"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { TriageRow } from "shared";
import { Icon } from "@/components/ui/Icon";
import { QueryState } from "@/components/ui/QueryState";
import { useNow } from "@/components/ui/useNow";
import { fr } from "@/lib/i18n/fr";
import { useLinkRequests, useTriage } from "@/lib/queries";
import { levelDisplay, type LevelDisplay } from "@/lib/status";
import { TriageTable } from "./TriageTable";
import styles from "./TriageView.module.css";

type Filter = "ALL" | "URGENT" | "HIGH" | "WATCH" | "SILENT" | "OK";

const FILTERS: readonly { key: Exclude<Filter, "ALL">; display: LevelDisplay }[] = [
  { key: "URGENT", display: levelDisplay("EMERGENCY") },
  { key: "HIGH", display: levelDisplay("HIGH") },
  { key: "WATCH", display: levelDisplay("WATCH") },
  { key: "SILENT", display: levelDisplay("SILENT") },
  { key: "OK", display: levelDisplay("OK") },
];

/** Filter group of a row; an unconfirmed severe reading counts as urgent (spec §6.5). */
function groupOf(row: TriageRow): Exclude<Filter, "ALL"> {
  if (row.level === "EMERGENCY" || row.level === "SEVERE" || row.unconfirmedSevere) return "URGENT";
  return row.level;
}

const URGENT_WORD = "Urgentes";

export function TriageView() {
  const triage = useTriage();
  const requests = useLinkRequests();
  const now = useNow();
  const [filter, setFilter] = useState<Filter>("ALL");
  const [search, setSearch] = useState("");

  const rows = useMemo(() => triage.data ?? [], [triage.data]);
  const counts = useMemo(
    () => rows.reduce<Record<string, number>>((acc, r) => ({ ...acc, [groupOf(r)]: (acc[groupOf(r)] ?? 0) + 1 }), {}),
    [rows],
  );
  const visible = rows.filter(
    (r) => (filter === "ALL" || groupOf(r) === filter) && r.fullName.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const pending = requests.data?.length ?? 0;

  return (
    <>
      <header className="page-head">
        <div>
          <h1>{fr.triage.title}</h1>
          <p>
            {fr.triage.subtitle} · <span className="subtle">{fr.common.updatedEvery}</span>
          </p>
        </div>
        <label className={styles.search}>
          <Icon name="search" />
          <span className="sr-only">{fr.triage.search}</span>
          <input
            className="input"
            type="search"
            placeholder={fr.triage.search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </header>

      {pending > 0 && (
        <Link href="/d/invites" className={styles.requests}>
          <Icon name="key" />
          <span>{fr.triage.pendingRequests(pending)}</span>
          <span className={styles.requestsAction}>
            {fr.triage.review}
            <Icon name="chevron-right" size={14} />
          </span>
        </Link>
      )}

      <div className={styles.summary} role="group" aria-label="Filtrer par niveau">
        <button type="button" className={styles.chip} aria-pressed={filter === "ALL"} onClick={() => setFilter("ALL")}>
          <span className={styles.chipCount}>{rows.length}</span>
          {fr.triage.all}
        </button>
        {FILTERS.map(({ key, display }) => (
          <button
            key={key}
            type="button"
            className={`${styles.chip} ${styles[`chip-${display.tone}`] ?? ""}`}
            aria-pressed={filter === key}
            onClick={() => setFilter(filter === key ? "ALL" : key)}
          >
            <Icon name={display.icon} size={14} />
            <span className={styles.chipCount}>{counts[key] ?? 0}</span>
            {key === "URGENT" ? URGENT_WORD : display.word}
          </button>
        ))}
      </div>

      <section className="panel" aria-label={fr.triage.title}>
        <QueryState query={triage} skeletonRows={8}>
          {rows.length === 0 ? (
            <p className="empty">{fr.triage.empty}</p>
          ) : visible.length === 0 ? (
            <p className="empty">{fr.triage.noMatch}</p>
          ) : (
            <TriageTable rows={visible} now={now} />
          )}
        </QueryState>
      </section>
    </>
  );
}
