"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiSend } from "@/lib/client/api";
import { CONFIG } from "@/lib/domain/config";
import { bpText, t } from "@/lib/i18n";
import type { DoctorPatientView } from "@/lib/services/views";
import { patientPatchSchema } from "@/lib/validation/schemas";

type Fields = Record<"targetSys" | "targetDia" | "expectedReadingsPerWeek" | "lastOfficeSys" | "lastOfficeDia" | "doctorNotes", string>;

const str = (n: number | null) => (n == null ? "" : String(n));
const num = (s: string) => (s.trim() === "" ? null : Number(s));

function fieldsOf(p: DoctorPatientView["patient"]): Fields {
  return {
    targetSys: str(p.targetSys),
    targetDia: str(p.targetDia),
    expectedReadingsPerWeek: String(p.expectedReadingsPerWeek),
    lastOfficeSys: str(p.lastOfficeSys),
    lastOfficeDia: str(p.lastOfficeDia),
    doctorNotes: p.doctorNotes ?? "",
  };
}

/** Doctor edits personal target, expected frequency, office reading and notes (CLAUDE.md §4.2). */
export function SettingsForm({ view }: { view: DoctorPatientView }) {
  const qc = useQueryClient();
  const [fields, setFields] = useState<Fields>(() => fieldsOf(view.patient));
  const [invalid, setInvalid] = useState(false);
  const save = useMutation({
    mutationFn: (patch: unknown) => apiSend<DoctorPatientView>(`/api/patients/${encodeURIComponent(view.patient.id)}`, "PATCH", patch),
    onSettled: () => qc.invalidateQueries(),
  });

  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFields((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = patientPatchSchema.safeParse({
      targetSys: num(fields.targetSys),
      targetDia: num(fields.targetDia),
      expectedReadingsPerWeek: Number(fields.expectedReadingsPerWeek),
      lastOfficeSys: num(fields.lastOfficeSys),
      lastOfficeDia: num(fields.lastOfficeDia),
      doctorNotes: fields.doctorNotes.trim() || null,
    });
    setInvalid(!parsed.success);
    if (parsed.success) save.mutate(parsed.data);
  };

  const input = (k: Exclude<keyof Fields, "doctorNotes">, label: string) => (
    <label className="field">
      <span className="field__label">{label}</span>
      <input inputMode="numeric" pattern="[0-9]*" value={fields[k]} onChange={set(k)} />
    </label>
  );

  return (
    <form className="panel settings no-print" onSubmit={submit}>
      <div className="panel__head">
        <span className="eyebrow">{t("dossier.settings")}</span>
      </div>
      <div className="panel__body">
        <div className="settings__grid">
          {input("targetSys", t("settings.targetSys"))}
          {input("targetDia", t("settings.targetDia"))}
          {input("lastOfficeSys", t("settings.officeSys"))}
          {input("lastOfficeDia", t("settings.officeDia"))}
          {input("expectedReadingsPerWeek", t("settings.expected"))}
        </div>
        <p className="micro settings__hint">{t("settings.defaultHint", { bp: bpText(CONFIG.defaultTarget) })}</p>
        <label className="field">
          <span className="field__label">{t("settings.notes")}</span>
          <textarea rows={3} maxLength={2000} value={fields.doctorNotes} onChange={set("doctorNotes")} />
        </label>
        <button type="submit" className="btn btn--sm btn--block" disabled={save.isPending}>
          {save.isPending ? t("common.saving") : t("common.save")}
        </button>
        <p className="composer__status" role="status">
          {invalid || save.isError ? t("settings.error") : save.isSuccess ? t("common.saved") : ""}
        </p>
      </div>
    </form>
  );
}
