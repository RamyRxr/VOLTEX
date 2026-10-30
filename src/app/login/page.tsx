import { redirect } from "next/navigation";
import { LoginForm, type DemoAccount } from "@/components/auth/LoginForm";
import { currentSession, homeOf } from "@/lib/auth/server";
import { isDemoMode } from "@/lib/demo";
import { t } from "@/lib/i18n";
import { DEMO_LOGIN_CODE } from "@/lib/services/auth";
import { DEMO_DOCTOR, STORY_PATIENTS } from "@/lib/store/seedData";

export const dynamic = "force-dynamic";

function demoAccounts(): DemoAccount[] {
  const ahmed = STORY_PATIENTS.find((p) => p.key === "ahmed");
  return [
    { name: DEMO_DOCTOR.name, role: t("login.demoDoctorRole"), phone: DEMO_DOCTOR.phone },
    ...(ahmed ? [{ name: ahmed.name, role: t("login.demoPatientRole"), phone: ahmed.phone }] : []),
  ];
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const session = await currentSession();
  if (session) redirect(homeOf(session.role));
  const { next } = await searchParams;
  const demo = isDemoMode();

  return (
    <main className="auth" id="contenu">
      <div className="auth__frame">
        <div className="auth__brand">
          <p className="eyebrow eyebrow--gold">{t("login.eyebrow")}</p>
          <p className="cover__word auth__word">
            Tensio<em>Care</em>
          </p>
          <p className="lede">{t("cover.pitch")}</p>
        </div>
        <LoginForm next={next ?? null} demoAccounts={demo ? demoAccounts() : []} demoCode={demo ? DEMO_LOGIN_CODE : null} />
      </div>
    </main>
  );
}
