import type { PatientStatus } from "@/lib/domain/levels";
import { t } from "@/lib/i18n";
import { TONE_COLOR, toneVar } from "@/lib/tone";
import { Icon } from "./ui/Icon";

/** CLAUDE.md §6.4 patient mapping: icon + colour + word (Urgent / Attention / À suivre / Bon). */
export function PatientStatusBadge({ status, large = false }: { status: PatientStatus; large?: boolean }) {
  return (
    <span className={`pstatus ${large ? "pstatus--large" : ""}`} style={toneVar(TONE_COLOR[status.tone])}>
      <Icon name={status.icon} size={large ? 30 : 16} />
      <span className="pstatus__word">{t(`patient.word.${status.word}` as const)}</span>
    </span>
  );
}
