"use client";

import { useState } from "react";
import { symptomLabel } from "@/lib/domain/describe";
import { isValidForStats } from "@/lib/domain/session";
import { clock, shortDate } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { SessionDto } from "@/lib/services/views";

const FIRST_ROWS = 12;

/** Every session, newest first: unconfirmed ones stay visible, flagged, never averaged. */
export function Journal({ sessions }: { sessions: readonly SessionDto[] }) {
  const [all, setAll] = useState(false);
  const rows = [...sessions].reverse();
  const shown = all ? rows : rows.slice(0, FIRST_ROWS);

  return (
    <section className="journal">
      <div className="section-head">
        <h2>{t("dossier.journal")}</h2>
        <span className="micro">{t("dossier.sessions", { n: sessions.length })}</span>
      </div>
      <div className="table-scroll">
        <table className="readings">
          <thead>
            <tr>
              <th scope="col">{t("dossier.col.date")}</th>
              <th scope="col">{t("dossier.col.time")}</th>
              <th scope="col">{t("dossier.col.bp")}</th>
              <th scope="col">{t("dossier.col.pulse")}</th>
              <th scope="col">{t("dossier.col.pill")}</th>
              <th scope="col">{t("dossier.col.channel")}</th>
              <th scope="col">{t("dossier.col.symptoms")}</th>
              <th scope="col">{t("dossier.col.status")}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((s) => (
              <tr key={s.id} data-status={s.status} className={isValidForStats(s) ? undefined : "is-unconfirmed"}>
                <td className="n">{shortDate(s.startedAt)}</td>
                <td className="n">{clock(s.startedAt)}</td>
                <td className="n">
                  {s.avgSys}/{s.avgDia}
                </td>
                <td className="num">{s.avgPulse ?? t("common.none")}</td>
                <td>{t(`pill.${s.pillStatus}` as const)}</td>
                <td>{t(`channel.${s.channel}` as const)}</td>
                <td className="readings__symptoms">{s.symptoms.map((x) => symptomLabel(x)).join(", ") || t("common.none")}</td>
                <td>{t(`sessionStatus.${s.status}` as const)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > FIRST_ROWS && (
        <button type="button" className="btn btn--sm btn--ghost journal__more no-print" onClick={() => setAll((v) => !v)}>
          {all ? `− ${FIRST_ROWS}` : `+ ${rows.length - FIRST_ROWS}`}
        </button>
      )}
    </section>
  );
}
