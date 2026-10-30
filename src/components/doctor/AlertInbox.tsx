"use client";

import Link from "next/link";
import { useState } from "react";
import { MessageComposer } from "@/components/MessageComposer";
import { StatusMark } from "@/components/StatusMark";
import { useAlertAction, useAlerts } from "@/lib/client/queries";
import { useNow } from "@/lib/client/useNow";
import type { AlertStatus } from "@/lib/domain/types";
import { elapsed, longDate } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { AlertDto } from "@/lib/services/views";
import { LEVEL_COLOR, toneVar } from "@/lib/tone";

const TABS: readonly AlertStatus[] = ["OPEN", "ACKNOWLEDGED", "CLOSED"];
const QUICK = [t("dossier.quick.1"), t("dossier.quick.2"), t("dossier.quick.3"), t("dossier.quick.4")];

/** Acknowledge / close / message: shared by the inbox and the patient page. */
export function AlertActions({ alert, onMessage }: { alert: AlertDto; onMessage?: () => void }) {
  const action = useAlertAction();
  return (
    <div className="alert-block__actions">
      {alert.status === "OPEN" && (
        <button type="button" className="btn btn--sm btn--royal" disabled={action.isPending} onClick={() => action.mutate({ id: alert.id, status: "ACKNOWLEDGED" })}>
          {t("alerts.ack")}
        </button>
      )}
      {onMessage && (
        <button type="button" className="btn btn--sm btn--ghost" onClick={onMessage}>
          {t("alerts.message")}
        </button>
      )}
      {alert.status !== "CLOSED" && (
        <button type="button" className="btn btn--sm btn--ghost" disabled={action.isPending} onClick={() => action.mutate({ id: alert.id, status: "CLOSED" })}>
          {t("alerts.close")}
        </button>
      )}
      <span className="micro alert-block__decision">{t("dossier.decision")}</span>
      {action.isError && (
        <span className="field__error" role="alert">
          {t("alerts.error")}
        </span>
      )}
    </div>
  );
}

function AlertCard({ alert, now }: { alert: AlertDto; now: string }) {
  const [composing, setComposing] = useState(false);
  return (
    <article className="alert-block" style={toneVar(LEVEL_COLOR[alert.level])}>
      <div className="alert-block__top">
        <StatusMark level={alert.level} />
        <span className="alert-block__meta">
          <span className="rule-id">{t(`evidence.${alert.evidence}` as const)}</span>
          <span className="micro">
            {t("alerts.created", { elapsed: elapsed(alert.createdAt, now) })}
            {alert.ackAt ? ` · ${t("alerts.ackAt", { elapsed: elapsed(alert.ackAt, now) })}` : ""}
          </span>
        </span>
      </div>
      <h2 className="alert-block__who">
        <Link href={`/d/patients/${alert.patientId}`}>{alert.patientName}</Link>
      </h2>
      <p className="alert-block__body">{alert.reason}</p>
      <AlertActions alert={alert} onMessage={() => setComposing((v) => !v)} />
      {composing && (
        <div className="alert-block__compose">
          <MessageComposer patientId={alert.patientId} placeholder={t("dossier.messagePlaceholder")} quickReplies={QUICK} autoFocus onSent={() => setComposing(false)} />
        </div>
      )}
    </article>
  );
}

export function AlertInbox({ initial, serverNow }: { initial: AlertDto[]; serverNow: string }) {
  const [tab, setTab] = useState<AlertStatus>("OPEN");
  const { data, isError, isPending } = useAlerts(tab, tab === "OPEN" ? initial : undefined);
  const now = useNow(serverNow);
  const alerts = data ?? [];

  return (
    <>
      <div className="page-head">
        <div className="page-head__left">
          <p className="eyebrow">{t("alerts.eyebrow", { date: longDate(serverNow) })}</p>
          <h1 className="title">{t("alerts.title")}</h1>
          <p className="sub">{t("alerts.sub")}</p>
        </div>
      </div>

      <div className="filing tabs" role="tablist" aria-label={t("alerts.title")}>
        {TABS.map((s) => (
          <button key={s} type="button" role="tab" className="chip" aria-selected={tab === s} onClick={() => setTab(s)}>
            {t(`alerts.tab.${s}` as const)}
          </button>
        ))}
      </div>

      {isError && (
        <p className="banner-error" role="status">
          {t("common.error")}
        </p>
      )}
      <div className="alert-list" role="tabpanel">
        {isPending && <p className="empty">{t("common.loading")}</p>}
        {!isPending && alerts.length === 0 && <p className="empty">{t("alerts.empty")}</p>}
        {alerts.map((a) => (
          <AlertCard key={a.id} alert={a} now={now} />
        ))}
      </div>
    </>
  );
}
