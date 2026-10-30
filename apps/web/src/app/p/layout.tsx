import { Masthead } from "@/components/Masthead";
import { patientPage } from "@/lib/auth/server";

export default async function PatientLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { claims } = await patientPage("/p");
  return (
    <div className="shell">
      <Masthead role="patient" who={claims.name} />
      <div className="shell__body">{children}</div>
    </div>
  );
}
