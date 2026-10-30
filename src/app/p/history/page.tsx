import { HistoryView } from "@/components/patient/HistoryView";
import { patientPage } from "@/lib/auth/server";
import { serviceContext } from "@/lib/demo";
import { getPatientSelfView } from "@/lib/services/patients";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const { viewer } = await patientPage("/p/history");
  return <HistoryView initial={await getPatientSelfView(await serviceContext(), viewer)} />;
}
