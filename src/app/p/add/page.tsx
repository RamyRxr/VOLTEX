import { AddReadingFlow } from "@/components/patient/AddReadingFlow";
import { patientPage } from "@/lib/auth/server";
import { serviceContext, smsGatewayNumber, timings } from "@/lib/demo";
import { getPatientSelfView } from "@/lib/services/patients";

export const dynamic = "force-dynamic";

export default async function AddReadingPage() {
  const { viewer } = await patientPage("/p/add");
  const ctx = await serviceContext();
  const view = await getPatientSelfView(ctx, viewer);
  return <AddReadingFlow target={view.target} timings={timings(ctx.demoMode)} smsNumber={smsGatewayNumber()} />;
}
