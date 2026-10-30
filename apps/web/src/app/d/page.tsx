import { TriageBoard } from "@/components/doctor/TriageBoard";
import { doctorPage } from "@/lib/auth/server";
import { serviceContext } from "@/lib/demo";
import { getTriage } from "@/lib/services/triage";

export const dynamic = "force-dynamic";

/** Triage list: the money screen (spec §4.2). */
export default async function TriagePage() {
  const { viewer } = await doctorPage("/d");
  const triage = await getTriage(await serviceContext(), viewer.doctorId);
  return <TriageBoard initial={triage} />;
}
