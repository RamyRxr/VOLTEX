import { notFound } from "next/navigation";
import { SmsSimulator } from "@/components/dev/SmsSimulator";
import { RedAlertBanner } from "@/components/doctor/RedAlertBanner";
import { Masthead } from "@/components/Masthead";
import { normalizePhone } from "@/lib/domain/phone";
import { doctorPage } from "@/lib/auth/server";
import { isDemoMode, serviceContext } from "@/lib/demo";
import { t } from "@/lib/i18n";
import { listPatientContacts } from "@/lib/services/patients";
import { STORY_PATIENTS } from "@/lib/store/seedData";

export const dynamic = "force-dynamic";

/** Hidden backup page (CLAUDE.md §4.3): the demo never depends on the gateway phone. */
export default async function SmsSimulatorPage() {
  if (!isDemoMode()) notFound();
  const { claims, viewer } = await doctorPage("/dev/sms-simulator");
  const contacts = await listPatientContacts(await serviceContext(), viewer);
  const zohra = STORY_PATIENTS.find((p) => p.key === "zohra");
  const defaultPhone = (zohra && normalizePhone(zohra.phone)) ?? contacts[0]?.phone ?? "";

  return (
    <div className="shell">
      <Masthead role="doctor" who={claims.name} />
      <RedAlertBanner />
      <main className="page" id="contenu">
        <div className="page-head">
          <div className="page-head__left">
            <p className="eyebrow">{t("sim.eyebrow")}</p>
            <h1 className="title">{t("sim.title")}</h1>
            <p className="sub">{t("sim.lede")}</p>
          </div>
        </div>
        <SmsSimulator contacts={contacts} defaultPhone={defaultPhone} />
      </main>
    </div>
  );
}
