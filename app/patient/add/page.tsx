import { notFound } from "next/navigation";
import { AddReading } from "@/components/AddReading";
import { buildRegistry, getPatient } from "@/lib/data";
import { Footer } from "@/components/Footer";

export const dynamic = "force-dynamic";

const DEMO_PATIENT = "p-05";

export default function AddReadingPage() {
  const now = new Date();
  const registry = buildRegistry(now);
  const patient = getPatient(registry, DEMO_PATIENT);
  if (!patient) notFound();

  const history = patient.sessions
    .filter((s) => s.status === "CONFIRMED" && !s.supersededBySessionId)
    .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());

  return (
    <div className="stage">
      <div className="stage__note no-print">
        <p className="eyebrow">Démonstration · mesure</p>
        <h1
          className="display"
          style={{ fontSize: "clamp(34px, 4vw, 54px)", margin: "12px 0 18px" }}
        >
          La mesure
          <br />
          n&apos;est jamais seule.
        </h1>
        <p>
          Une session contient deux lectures moyennées, jamais un chiffre isolé.
          Si la moyenne dépasse 160/100, rien n&apos;est conclu : TensioCare
          demande une seconde mesure et ne fusionne qu&apos;à ce moment-là.
        </p>

        <div className="stage__steps">
          <div className="stage__step">
            <span className="aside__n">01</span>
            <div>
              <h3>Saisie</h3>
              <p>Deux chiffres, le pouls, le traitement. Moins de trente secondes.</p>
            </div>
          </div>
          <div className="stage__step">
            <span className="aside__n">02</span>
            <div>
              <h3>Confirmation</h3>
              <p>Une mesure élevée devient « en attente » jusqu&apos;à la seconde prise. Le médecin la voit quand même.</p>
            </div>
          </div>
          <div className="stage__step">
            <span className="aside__n">03</span>
            <div>
              <h3>Décision</h3>
              <p>Le niveau est calculé, jamais saisi. Le médecin décide de la suite.</p>
            </div>
          </div>
        </div>

        <div className="note-card">
          <p className="eyebrow" style={{ margin: 0 }}>
            Scénario de démonstration
          </p>
          <p style={{ fontSize: 15 }}>
            Saisir <span className="kbd num">182</span> /{" "}
            <span className="kbd num">118</span>, envoyer, puis remesurer une
            seconde fois. Les deux sessions fusionnent à{" "}
            <span className="kbd num">182/118</span> et le dossier passe en
            crise.
          </p>
        </div>

        <p className="micro" style={{ marginTop: 22, lineHeight: 1.6 }}>
          Seuils : 160/100 pour la confirmation, 180/120 pour la crise. Un signe
          d&apos;alerte annule la confirmation et déclenche l&apos;appel.
        </p>
      </div>

      <AddReading
        history={history}
        target={patient.target}
        expected={patient.expected}
        highRisk={patient.highRisk}
        lastOffice={patient.lastOffice ? { sys: patient.lastOffice.sys, dia: patient.lastOffice.dia } : null}
      />

      <div style={{ gridColumn: "1 / -1", marginTop: 40 }}>
        <Footer />
      </div>
    </div>
  );
}
