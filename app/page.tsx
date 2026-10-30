import Link from "next/link";

function Arrow() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
      <path d="M4 13h18M15 6l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function CoverPage() {
  return (
    <main className="cover">
      <div className="cover__frame">
        <div className="cover__top">
          <div className="seal-stamp" aria-hidden>
            <span>TC</span>
          </div>
          <div className="cover__head">
            <span className="eyebrow">Dossier</span>
            <span>N° 02 — Hypertension artérielle</span>
            <span className="eyebrow">Terrain</span>
            <span>Algérie · médecine de ville</span>
            <span className="eyebrow">Nature</span>
            <span>Démonstration · données synthétiques</span>
          </div>
        </div>

        <div className="cover__mid">
          <p className="eyebrow eyebrow--gold">Registre de suivi tensionnel</p>
          <h1 className="cover__word">
            Tensio<em>Care</em>
          </h1>

          <div className="cover__sub">
            <span className="display" style={{ fontSize: 17, color: "var(--ink-3)" }}>
              Entre deux consultations
            </span>
            <span style={{ width: 42, height: 1, background: "var(--gold-2)" }} aria-hidden />
            <span className="eyebrow">Web · SMS · 30 secondes</span>
          </div>

          <p className="cover__lede">
            Le mois de silence entre deux consultations, mis en registre.
            La machine surveille. Le médecin décide.
          </p>
        </div>

        <div className="cover__doors">
          <Link href="/doctor" className="door">
            <span className="door__no">01</span>
            <span className="door__title">
              Espace médecin
              <Arrow />
            </span>
            <span className="door__desc">
              Triage du jour, tendances sur quatorze jours, observance et
              messages. Trente patients, un seul registre.
            </span>
          </Link>

          <Link href="/patient" className="door">
            <span className="door__no">02</span>
            <span className="door__title">
              Espace patient
              <Arrow />
            </span>
            <span className="door__desc">
              Une mesure en trente secondes, sans compte et sans application à
              installer. Le médecin est prévenu si nécessaire.
            </span>
          </Link>
        </div>

        <div className="cover__foot">
          <span>
            Hackathon · Problème 2 — détection précoce et suivi continu de
            l&apos;hypertension
          </span>
          <span className="num">TensioCare · v0.1</span>
        </div>
      </div>
    </main>
  );
}
