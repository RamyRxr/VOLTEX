import { Masthead } from "@/components/Masthead";

export default function PatientLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="shell">
      <Masthead role="patient" who="Ahmed Saidi" initials="AS" />
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}
