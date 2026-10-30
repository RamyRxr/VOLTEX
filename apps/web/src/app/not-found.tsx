import Link from "next/link";
import { fr } from "@/lib/i18n/fr";

export default function NotFound() {
  return (
    <main id="contenu" style={{ display: "grid", placeItems: "center", minHeight: "100vh", padding: 24, textAlign: "center" }}>
      <div>
        <h1>Page introuvable</h1>
        <p className="muted" style={{ margin: "8px 0 20px" }}>
          {fr.app.tagline}
        </p>
        <Link href="/d" className="btn btn-primary">
          {fr.common.back}
        </Link>
      </div>
    </main>
  );
}
