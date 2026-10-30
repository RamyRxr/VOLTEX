import { ContactView } from "@/components/patient/ContactView";
import { patientPage } from "@/lib/auth/server";
import { serviceContext } from "@/lib/demo";
import { getPatientSelfView } from "@/lib/services/patients";

export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const { viewer } = await patientPage("/p/contact");
  return <ContactView initial={await getPatientSelfView(await serviceContext(), viewer)} />;
}
