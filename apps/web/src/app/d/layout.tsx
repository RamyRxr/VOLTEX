import { DoctorShell } from "@/components/shell/DoctorShell";

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  return <DoctorShell>{children}</DoctorShell>;
}
