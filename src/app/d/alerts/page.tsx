import { AlertInbox } from "@/components/doctor/AlertInbox";
import { doctorPage } from "@/lib/auth/server";
import { serviceContext } from "@/lib/demo";
import { listDoctorAlerts } from "@/lib/services/alerts";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const { viewer } = await doctorPage("/d/alerts");
  const ctx = await serviceContext();
  const alerts = await listDoctorAlerts(ctx, viewer, "OPEN");
  return <AlertInbox initial={alerts} serverNow={ctx.now.toISOString()} />;
}
