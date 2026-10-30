import { Glyph } from "@/components/StatusMark";
import { isRed } from "@/lib/domain/levels";
import { displayPhone, longDate } from "@/lib/format";
import { bpText, t } from "@/lib/i18n";
import type { DoctorPatientView } from "@/lib/services/views";
import { LEVEL_COLOR, toneVar } from "@/lib/tone";

export function DossierHead({ view }: { view: DoctorPatientView }) {
  const p = view.patient;
  const none = t("common.none");
  const meta: readonly [string, string][] = [
    [t("dossier.age"), `${t("common.age", { n: p.age })} · ${t(`common.sex.${p.sex}` as const)}`],
    [t("dossier.treatment"), p.treatmentNames.join(", ") || none],
    [t("dossier.target"), p.targetSys == null ? t("dossier.targetDefault", { bp: bpText(p.target) }) : `${bpText(p.target)} ${t("common.mmhg")}`],
    [t("dossier.office"), p.lastOfficeSys != null && p.lastOfficeDia != null ? bpText({ sys: p.lastOfficeSys, dia: p.lastOfficeDia }) : none],
    [t("dossier.expected"), t("dossier.expectedValue", { n: p.expectedReadingsPerWeek })],
    [t("dossier.phone"), displayPhone(p.phone)],
    [t("dossier.emergency"), p.emergencyContactPhone ? displayPhone(p.emergencyContactPhone) : none],
  ];

  return (
    <div className="patient-head">
      <div className="patient-head__main">
        <p className="eyebrow">
          {view.followUp ? t("dossier.followUp") : t("dossier.standard")} · {t("dossier.since", { date: longDate(p.consentAt) })}
        </p>
        <h1 className="patient-name">{p.name}</h1>
        <div className="meta">
          {meta.map(([k, v]) => (
            <div className="meta__row" key={k}>
              <span className="meta__k">{k}</span>
              <span className="meta__dots" aria-hidden />
              <span className="meta__v num">{v}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="seal" style={toneVar(LEVEL_COLOR[view.level])}>
        <span className="seal__inner">
          <Glyph level={view.level} size={16} />
          <span className="seal__word">{t(`level.${view.level}` as const)}</span>
          <span className="micro">{isRed(view.level) ? t("dossier.notified") : t("dossier.digest")}</span>
        </span>
      </div>
    </div>
  );
}
