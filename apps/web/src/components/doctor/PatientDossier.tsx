"use client";

import Link from "next/link";
import { BpChart, ChartLegend } from "@/components/charts/BpChart";
import { MessageComposer, Thread } from "@/components/MessageComposer";
import { StatusMark } from "@/components/StatusMark";
import { Icon } from "@/components/ui/Icon";
import { useDoctorPatient } from "@/lib/client/queries";
import { elapsed, longDate, shortDate } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { DoctorPatientView } from "@/lib/services/views";
import { LEVEL_COLOR, toneVar } from "@/lib/tone";
import { AlertActions } from "./AlertInbox";
import { DossierHead } from "./dossier/DossierHead";
import { Journal } from "./dossier/Journal";
import { SettingsForm } from "./dossier/SettingsForm";

const CHART_DAYS = 21;
const COMPOSER_ID = "dossier-message";
const QUICK = [t("dossier.quick.1"), t("dossier.quick.2"), t("dossier.quick.3"), t("dossier.quick.4")];

const focusComposer = () => document.getElementById(COMPOSER_ID)?.focus();

function AlertSection({ view }: { view: DoctorPatientView }) {
  const open = view.alerts.filter((a) => a.status !== "CLOSED");
  if (open.length === 0) {
    return (
      <div className="alert-block alert-block--calm" style={toneVar(LEVEL_COLOR[view.level])}>
        <div className="alert-block__top">
          <StatusMark level={view.level} />
          <span className="micro">{t("dossier.noAlert")}</span>
        </div>
        <p className="alert-block__body">{view.reason}</p>
      </div>
    );
  }
  return (
    <>
      {open.map((a) => (
        <div key={a.id} className="alert-block" style={toneVar(LEVEL_COLOR[a.level])}>
          <div className="alert-block__top">
            <StatusMark level={a.level} />
            <span className="alert-block__meta">
              <span className="rule-id">{t(`evidence.${a.evidence}` as const)}</span>
              <span className="micro">
                {t(`alertStatus.${a.status}` as const)} · {elapsed(a.createdAt, view.generatedAt)}
              </span>
            </span>
          </div>
          <p className="alert-block__body">{a.reason}</p>
          <AlertActions alert={a} onMessage={focusComposer} />
        </div>
      ))}
    </>
  );
}

function ClinicalReading({ view }: { view: DoctorPatientView }) {
  const lines = [
    ...view.info.map((i) => ({ key: i.id, title: t(`info.title.${i.id}` as const), body: i.text, emphasis: i.emphasis })),
    ...view.unconfirmed.map((u) => ({ key: u.id, title: t("dossier.unconfirmed"), body: `${shortDate(u.startedAt)} · ${u.text}`, emphasis: u.status !== "NOT_CONFIRMED" })),
  ];
  return (
    <section>
      <div className="section-head">
        <h2>{t("dossier.reading")}</h2>
        <span className="micro num">{lines.length}</span>
      </div>
      {lines.length === 0 && <p className="sub">{t("dossier.readingEmpty")}</p>}
      {lines.map((n, i) => (
        <div className="note" key={n.key} data-emphasis={n.emphasis || undefined}>
          <span className="note__n num">{i + 1}.</span>
          <div>
            <p className="note__title">{n.title}</p>
            <p className="note__body">{n.body}</p>
          </div>
        </div>
      ))}
    </section>
  );
}

/** Doctor's patient page, refreshed every second so a new reading appears live. */
export function PatientDossier({ initial }: { initial: DoctorPatientView }) {
  const { data, isError } = useDoctorPatient(initial.patient.id, initial);
  const view = data ?? initial;

  return (
    <>
      <div className="crumbs no-print">
        <Link href="/d">{t("nav.triage")}</Link>
        <span aria-hidden>/</span>
        <span>{t("dossier.crumb")}</span>
        <button type="button" className="crumbs__print btn btn--sm btn--ghost" onClick={() => window.print()}>
          <Icon name="printer" size={13} />
          {t("common.print")}
        </button>
      </div>

      <DossierHead view={view} />
      {isError && (
        <p className="banner-error" role="status">
          {t("common.error")}
        </p>
      )}

      <div className="dossier-alerts">
        <AlertSection view={view} />
      </div>

      <div className="detail">
        <div>
          <div className="section-head">
            <h2>{t("dossier.chart")}</h2>
            <span className="micro">{t("dossier.chartSub", { days: CHART_DAYS })}</span>
          </div>
          <div className="chart-frame">
            <BpChart sessions={view.sessions} target={view.patient.target} now={view.generatedAt} windowDays={CHART_DAYS} />
            <ChartLegend />
          </div>
          <Journal sessions={view.sessions} />
        </div>

        <aside className="dossier-side">
          <ClinicalReading view={view} />

          <div className="panel dossier-messages no-print">
            <div className="panel__head">
              <span className="eyebrow">{t("dossier.messages")}</span>
              <span className="micro">{t("channel.WEB")}</span>
            </div>
            <div className="panel__body">
              <Thread messages={view.messages} mine="DOCTOR" />
              <MessageComposer patientId={view.patient.id} placeholder={t("dossier.messagePlaceholder")} quickReplies={QUICK} inputId={COMPOSER_ID} />
            </div>
          </div>

          <section className="dossier-notes">
            <div className="section-head">
              <h2>{t("dossier.notes")}</h2>
            </div>
            <p className="dossier-notes__body">{view.patient.doctorNotes || t("dossier.notesEmpty")}</p>
          </section>

          <SettingsForm key={view.patient.id} view={view} />
        </aside>
      </div>

      <p className="sub dossier-foot">{t("dossier.footer", { date: longDate(view.generatedAt) })}</p>
    </>
  );
}
