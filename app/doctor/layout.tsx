import { Masthead } from "@/components/Masthead";
import { Footer } from "@/components/Footer";

export default function DoctorLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="shell">
      <Masthead role="doctor" who="Dr. Amine Benali" initials="AB" />
      <main className="page">
        {children}
        <Footer />
      </main>
    </div>
  );
}
