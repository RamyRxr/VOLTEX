import Link from "next/link";
import { Sparkline } from "@/components/charts/Sparkline";
import { StatusMark } from "@/components/StatusMark";
import { Icon } from "@/components/ui/Icon";
import { isRed } from "@/lib/domain/levels";
import { elapsed, pct } from "@/lib/format";
import { fixed, t } from "@/lib/i18n";
import type { TriageRowDto } from "@/lib/services/views";
import { GROUP_COLOR, toneVar } from "@/lib/tone";

/** A red alert raised less than this long ago makes its row pulse on stage. */
const FRESH_MS = 15_000;

const TREND_ICON = { up: "trend-up", down: "trend-down", flat: "trend-flat" } as const;
const TREND_WORD = { up: "triage.trendUp", down: "triage.trendDown", flat: "triage.trendFlat" } as const;

export function TriageRow({ row, index, now }: { row: TriageRowDto; index: number; now: string }) {
  const red = isRed(row.level);
  const fresh = red && row.alert != null && Date.parse(now) - Date.parse(row.alert.createdAt) < FRESH_MS;
  const pending = row.last?.status === "PENDING";

  return (
    <Link
      href={`/d/patients/${row.patientId}`}
      className="row"
      data-severe={red || undefined}
      data-fresh={fresh || undefined}
      style={toneVar(GROUP_COLOR[row.group])}
    >
      <span className="row__rank num">{String(index + 1).padStart(2, "0")}</span>

      <span className="row__person">
        <span className="row__name">{row.name}</span>
        <span className="row__meta">
          <StatusMark level={row.level} />
          <span className="num">
            {t("common.age", { n: row.age })} · {t(`common.sexShort.${row.sex}` as const)}
          </span>
          {row.unconfirmed && <span className="tag tag--key tag--royal">{t("tag.unconfirmed")}</span>}
          {row.silent && row.level !== "GREY_SILENT" && <span className="tag tag--key">{t("tag.silent")}</span>}
          {row.alert?.status === "ACKNOWLEDGED" && <span className="tag tag--key">{t("tag.acknowledged")}</span>}
        </span>
      </span>

      <span className="row__bp num">
        {row.last ? (
          <>
            {row.last.sys}/{row.last.dia}
            {pending && <small>{t("triage.pending")}</small>}
          </>
        ) : (
          <span className="row__bp--flat">{t("common.none")}</span>
        )}
        <span className="row__when">{row.last ? elapsed(row.last.at, now) : t("time.never")}</span>
      </span>

      <span className="row__avg num">{row.avg7 ? `${row.avg7.sys}/${row.avg7.dia}` : t("common.none")}</span>

      <span className="row__trend">
        <Sparkline values={[...row.spark]} color={row.trend?.direction === "up" ? "var(--ochre)" : "var(--royal)"} />
        {row.trend && (
          <span className="row__slope num" title={t(TREND_WORD[row.trend.direction])}>
            <Icon name={TREND_ICON[row.trend.direction]} size={11} />
            <span className="sr-only">{t(TREND_WORD[row.trend.direction])}</span>
            {row.trend.direction !== "flat" && fixed(Math.abs(row.trend.perWeek))}
          </span>
        )}
      </span>

      <span className="row__adherence">
        <span className="bar">
          <i style={{ width: `${Math.round((row.adherence ?? 0) * 100)}%` }} />
        </span>
        <span className="bar__label num">{row.adherence != null ? pct(row.adherence) : t("common.none")}</span>
      </span>

      <span className="row__reason" title={row.reason}>
        {row.reason}
      </span>

      <span className="row__chev" aria-hidden>
        <Icon name="chevron" size={12} />
      </span>
    </Link>
  );
}
