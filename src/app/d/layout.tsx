import { RedAlertBanner } from "@/components/doctor/RedAlertBanner";
import { Footer } from "@/components/Footer";
import { Masthead } from "@/components/Masthead";
import { doctorPage } from "@/lib/auth/server";

export default async function DoctorLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { claims } = await doctorPage("/d");
  return (
    <div className="shell">
      <Masthead role="doctor" who={claims.name} />
      <RedAlertBanner />
      <main className="page" id="contenu">
        {children}
        <Footer />
      </main>
    </div>
  );
}
