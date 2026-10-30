import { PatientHome } from "@/components/patient/PatientHome";
import { patientPage } from "@/lib/auth/server";
import { serviceContext, smsGatewayNumber } from "@/lib/demo";
import { getPatientSelfView } from "@/lib/services/patients";

export const dynamic = "force-dynamic";

export default async function PatientHomePage() {
  const { viewer } = await patientPage("/p");
  const view = await getPatientSelfView(await serviceContext(), viewer);
  return <PatientHome initial={view} smsNumber={smsGatewayNumber()} />;
}
