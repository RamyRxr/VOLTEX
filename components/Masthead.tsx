"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Masthead({
  role = "doctor",
  who = "Dr. Amine Benali",
  initials = "AB",
}: {
  role?: "doctor" | "patient";
  who?: string;
  initials?: string;
}) {
  const path = usePathname();
  const isDoctor = role === "doctor";

  return (
    <header className="masthead">
      <div className="masthead__inner">
        <Link href={isDoctor ? "/doctor" : "/patient"} className="brand" aria-label="TensioCare — accueil">
          <span className="brand__mark" aria-hidden>
            T
          </span>
          <span className="brand__name">
            Tensio<em>Care</em>
          </span>
        </Link>

        {isDoctor && (
          <nav className="nav" aria-label="Navigation principale">
            <Link href="/doctor" aria-current={path === "/doctor" ? "page" : undefined}>
              Triage
            </Link>
            <Link
              href="/doctor/indicateurs"
              aria-current={path.startsWith("/doctor/indicateurs") ? "page" : undefined}
            >
              Indicateurs
            </Link>
          </nav>
        )}

        <div className="masthead__right">
          <span className="demo-pill">
            <i aria-hidden />
            Mode démo
          </span>
          <span className="who">
            <span className="who__init" aria-hidden>
              {initials}
            </span>
            <span>{who}</span>
          </span>
        </div>
      </div>
    </header>
  );
}
