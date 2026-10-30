import { Sparkline } from "@/components/Sparkline";
import { buildIndicators, buildRegistry } from "@/lib/data";
import { longDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const fr1 = (n: number) => n.toFixed(1).replace(".", ",");

const SERIES = {
  frequency: [2.1, 2.3, 2.2, 2.5, 2.4, 2.6, 2.7],
  control: [0.72, 0.74, 0.75, 0.78, 0.79, 0.81, 0.83],
  regularity: [0.68, 0.71, 0.7, 0.73, 0.75, 0.77, 0.78],
  response: [9, 8.5, 8, 7.2, 6.8, 6.2, 6],
};

/** Rescale an 8-week shape so its last point equals the value shown today. */
const fit = (series: number[], end: number) => {
  const last = series[series.length - 1];
  return series.map((v) => (v / last) * end);
};

export default function IndicatorsPage() {
  const now = new Date();
  const registry = buildRegistry(now);
  const ind = buildIndicators(registry, now);

  const openAlerts = ind.counts.ORANGE + ind.counts.YELLOW + ind.counts.SILENT;
  const urgent = ind.counts.EMERGENCY + ind.counts.CRISIS + ind.counts.PENDING;

  return (
    <>
      <div className="page-head">
        <div className="page-head__left">
          <p className="eyebrow">Indicateurs · {longDate(now)}</p>
          <h1 className="title">Le registre en chiffres</h1>
          <p className="sub">
            Sept derniers jours, {ind.patients} patients, {ind.totalReadings}{" "}
            sessions enregistrées depuis l&apos;ouverture du suivi.
          </p>
        </div>
        <p className="micro" style={{ paddingBottom: 4 }}>
          Données synthétiques · pas de mesure d&apos;impact réel
        </p>
      </div>

      <div className="figures">
        <div className="figure">
          <span className="figure__label">Fréquence de mesure</span>
          <span className="figure__value">
            {fr1(ind.frequency)}
            <span className="figure__unit">mesures / patient / sem.</span>
          </span>
          <span className="figure__spark">
            <Sparkline values={fit(SERIES.frequency, ind.frequency)} width={120} height={24} fill />
          </span>
          <span className="figure__cap">
            Le seuil d&apos;utilité clinique est de deux mesures par semaine.
            En dessous, la tendance n&apos;est pas lisible.
          </span>
        </div>

        <div className="figure">
          <span className="figure__label">Taux de contrôle</span>
          <span className="figure__value">
            {Math.round(ind.controlRate * 100)}
            <span className="figure__unit">% sous cible</span>
          </span>
          <span className="figure__spark">
            <Sparkline values={fit(SERIES.control, ind.controlRate)} width={120} height={24} color="var(--emerald)" fill />
          </span>
          <span className="figure__cap">
            Patients dont la moyenne des sept derniers jours reste sous
            135/85 mmHg. {ind.counts.GREEN} patients sur {ind.patients}.
          </span>
        </div>

        <div className="figure">
          <span className="figure__label">Régularité</span>
          <span className="figure__value">
            {Math.round(ind.regularity * 100)}
            <span className="figure__unit">% du rythme attendu</span>
          </span>
          <span className="figure__spark">
            <Sparkline values={fit(SERIES.regularity, ind.regularity)} width={120} height={24} fill />
          </span>
          <span className="figure__cap">
            Part des patients ayant envoyé au moins 70 % des mesures
            demandées cette semaine.
          </span>
        </div>

        <div className="figure">
          <span className="figure__label">Moyenne du groupe</span>
          <span className="figure__value">
            {ind.groupAvg.sys}
            <span className="figure__unit">/ {ind.groupAvg.dia} mmHg</span>
          </span>
          <span className="figure__cap" style={{ marginTop: 8 }}>
            Moyenne des moyennes individuelles à sept jours. Une moyenne de
            groupe ne remplace jamais une lecture par patient.
          </span>
        </div>

        <div className="figure">
          <span className="figure__label">Alertes ouvertes</span>
          <span className="figure__value">
            {openAlerts + urgent}
            <span className="figure__unit">à examiner</span>
          </span>
          <span
            className="num"
            style={{ display: "flex", gap: 14, fontSize: 12, color: "var(--ink-2)" }}
          >
            <span>
              <b style={{ color: "var(--crimson)" }}>{urgent}</b> immédiates
            </span>
            <span>
              <b style={{ color: "var(--amber)" }}>{ind.counts.ORANGE}</b> élevées
            </span>
            <span>
              <b style={{ color: "var(--ochre)" }}>{ind.counts.YELLOW}</b> dérives
            </span>
            <span>
              <b style={{ color: "var(--slate)" }}>{ind.counts.SILENT}</b> silences
            </span>
          </span>
          <span className="figure__cap">
            Une alerte n&apos;est pas un diagnostic : c&apos;est une invitation
            à regarder le dossier.
          </span>
        </div>

        <div className="figure">
          <span className="figure__label">Délai de prise en charge</span>
          <span className="figure__value">
            6
            <span className="figure__unit">minutes · médiane</span>
          </span>
          <span className="figure__spark">
            <Sparkline values={SERIES.response} width={120} height={24} color="var(--gold)" fill />
          </span>
          <span className="figure__cap">
            Entre la notification d&apos;une urgence et son acquittement par le
            médecin. Objet du cahier des charges : moins de dix minutes.
          </span>
        </div>
      </div>

      <div className="lede-block">
        <p className="eyebrow">Lecture</p>
        <p className="lede">
          Le chiffre qui compte n&apos;est pas le nombre de mesures reçues, mais
          le nombre de patients dont on sait, cette semaine, s&apos;ils vont
          bien. Sur ce registre, cinq dossiers demandent une décision ; les
          autres peuvent attendre le résumé de huit heures sans risque
          identifié.
        </p>
      </div>

      <div
        style={{
          marginTop: 34,
          paddingTop: 18,
          borderTop: "1px solid var(--line)",
          display: "grid",
          gridTemplateColumns: "150px minmax(0, 62ch)",
          gap: 30,
        }}
      >
        <p className="eyebrow">Réserve</p>
        <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: "var(--ink-3)" }}>
          Ces chiffres proviennent d&apos;un jeu de données synthétique construit
          pour la démonstration. Ils montrent que le registre sait produire les
          indicateurs demandés ; ils ne démontrent aucune amélioration
          clinique. Une évaluation réelle demanderait un protocole, un groupe
          témoin et plusieurs mois.
        </p>
      </div>
    </>
  );
}
