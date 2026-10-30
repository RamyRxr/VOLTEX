"use client";

import Link from "next/link";
import { Glyph } from "@/components/StatusMark";
import { useAlertAction, useTriage } from "@/lib/client/queries";
import { elapsed } from "@/lib/format";
import { t } from "@/lib/i18n";

const MAX_SHOWN = 3;

/** Only red alerts notify instantly (spec §6.7): this banner is that notification. */
export function RedAlertBanner() {
  const { data } = useTriage();
  const action = useAlertAction();
  const alerts = data?.openRedAlerts ?? [];
  if (!data || alerts.length === 0) return null;

  return (
    <div className="redbanner no-print" role="alert">
      <div className="redbanner__inner">
        {alerts.slice(0, MAX_SHOWN).map((a) => (
          <div key={a.id} className="redbanner__item">
            <span className="redbanner__title">
              <Glyph level={a.level} />
              {t("redbanner.title")}
            </span>
            <span className="redbanner__text">
              <b>{a.patientName}</b> · {a.reason} · <span className="num">{elapsed(a.createdAt, data.generatedAt)}</span>
            </span>
            <span className="redbanner__actions">
              <Link href={`/d/patients/${a.patientId}`} className="btn btn--sm btn--paper">
                {t("redbanner.open")}
              </Link>
              <button
                type="button"
                className="btn btn--sm btn--outline-light"
                disabled={action.isPending}
                onClick={() => action.mutate({ id: a.id, status: "ACKNOWLEDGED" })}
              >
                {t("redbanner.ack")}
              </button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
