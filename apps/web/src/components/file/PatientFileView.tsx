"use client";

import { useState } from "react";
import type { PatientFile } from "shared";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { QueryState } from "@/components/ui/QueryState";
import { useNow } from "@/components/ui/useNow";
import { fr } from "@/lib/i18n/fr";
import { usePatientFile } from "@/lib/queries";
import { BpChart } from "./BpChart";
import { FileHeader } from "./FileHeader";
import { Findings } from "./Findings";
import { AlertsHistory, QuestionnairesTable, ReadingsTable } from "./History";
import { ProfilePanel, RiskFactors, RiskTimeline } from "./RiskAndProfile";
import { NotesPanel, SummaryCard } from "./SideRail";
import styles from "./file.module.css";

type Tab = keyof typeof fr.file.tabs;
const TABS = Object.keys(fr.file.tabs) as Tab[];
const RANGES = [14, 30, 90] as const;
type Range = (typeof RANGES)[number];

function ChartPanel({ file, now }: { file: PatientFile; now: Date }) {
  const [range, setRange] = useState<Range>(14);
  return (
    <section className="panel" aria-labelledby="chart-title">
      <div className="panel-head">
        <h2 id="chart-title">{fr.file.chart}</h2>
        <div className={styles.segmented} role="group" aria-label={fr.file.chart}>
          {RANGES.map((r) => (
            <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)}>
              {fr.file.chartRange[r]}
            </button>
          ))}
        </div>
      </div>
      <div className="panel-body">
        <BpChart sessions={file.sessions} days={range} now={now} />
      </div>
    </section>
  );
}

function TabContent({ tab, file, now }: { tab: Tab; file: PatientFile; now: Date }) {
  switch (tab) {
    case "overview":
      return (
        <>
          <Findings file={file} now={now} />
          <ChartPanel file={file} now={now} />
          <div className={styles.twoCols}>
            <RiskFactors risk={file.risk} />
            <ProfilePanel file={file} />
          </div>
        </>
      );
    case "readings":
      return (
        <>
          <ChartPanel file={file} now={now} />
          <section className="panel">
            <ReadingsTable sessions={file.sessions} />
          </section>
        </>
      );
    case "questionnaires":
      return (
        <section className="panel">
          <QuestionnairesTable questionnaires={file.questionnaires} />
        </section>
      );
    case "alerts":
      return (
        <section className="panel">
          <AlertsHistory alerts={file.alerts} />
        </section>
      );
    case "risk":
      return (
        <>
          <RiskFactors risk={file.risk} />
          <RiskTimeline risks={file.risks} />
        </>
      );
  }
}

export function PatientFileView({ id }: { id: string }) {
  const file = usePatientFile(id);
  const now = useNow();
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <QueryState query={file} skeletonRows={10}>
      {file.data && (
        <>
          <FileHeader file={file.data} now={now} />
          <div className={styles.layout}>
            <div className={styles.mainCol}>
              <div className="tabs" role="tablist" aria-label={file.data.fullName}>
                {TABS.map((t) => (
                  <button key={t} type="button" role="tab" className="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
                    {fr.file.tabs[t]}
                    {t === "alerts" && file.data.alerts.some((a) => a.status === "OPEN") && <span className={styles.tabDot} aria-hidden />}
                  </button>
                ))}
              </div>
              <div className={styles.tabPanel} role="tabpanel">
                <TabContent tab={tab} file={file.data} now={now} />
              </div>
            </div>
            <aside className={styles.rail}>
              <SummaryCard text={file.data.aiSummary} />
              <ChatPanel linkId={file.data.linkId} patientName={file.data.fullName} />
              <NotesPanel patientId={file.data.id} notes={file.data.notes} />
            </aside>
          </div>
        </>
      )}
    </QueryState>
  );
}
