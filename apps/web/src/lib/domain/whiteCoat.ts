import { CONFIG } from "./config";
import { isAbove } from "./thresholds";
import type { BP, PatientProfile } from "./types";

export interface OfficeComparison {
  readonly kind: "WHITE_COAT" | "MASKED";
  readonly home: BP;
  readonly office: BP;
}

/**
 * Information line only, never an alert level.
 * - Office above home by ≥ 10 systolic or ≥ 5 diastolic → possible white-coat effect.
 * - Home average above target while office below 140/90 → possible masked hypertension.
 */
export function compareOfficeHome(
  homeAvg: BP | null,
  patient: Pick<PatientProfile, "lastOfficeSys" | "lastOfficeDia">,
  target: BP,
): OfficeComparison | null {
  if (!homeAvg || patient.lastOfficeSys == null || patient.lastOfficeDia == null) return null;
  const office = { sys: patient.lastOfficeSys, dia: patient.lastOfficeDia };
  const { minDeltaSys, minDeltaDia, officeHypertension } = CONFIG.whiteCoat;

  if (office.sys - homeAvg.sys >= minDeltaSys || office.dia - homeAvg.dia >= minDeltaDia) {
    return { kind: "WHITE_COAT", home: homeAvg, office };
  }
  if (isAbove(homeAvg, target) && !isAbove(office, officeHypertension)) {
    return { kind: "MASKED", home: homeAvg, office };
  }
  return null;
}
