# TensioCare — front-end prototype

Registre de suivi tensionnel. Ce dépôt contient **l'interface uniquement** : les
données sont synthétiques et vivent en mémoire, mais le moteur d'alertes est le
vrai, celui qui est vérifié par `scripts/verify-demo.mts`.

## Lancer

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm run start
```

## Écrans

| Route | Rôle | État |
|---|---|---|
| `/` | couverture | statique |
| `/doctor` | triage du jour, 30 patients | filtres + recherche fonctionnels |
| `/doctor/patients/[id]` | dossier : courbe, journal, annotations | lecture seule |
| `/doctor/indicateurs` | six indicateurs | calculés depuis les données |
| `/patient` | accueil patient (mobile) | lecture seule |
| `/patient/add` | saisie d'une mesure | **fonctionnel, moteur réel** |

Le parcours `/patient/add` appelle `evaluatePatient` côté client. Saisir
`182/118` déclenche la demande de confirmation ; la seconde mesure fusionne les
deux sessions et fait passer le dossier en crise. C'est le scénario de
démonstration, et il n'est pas simulé.

## Vérifier

Le parcours de démonstration est vérifié dans un vrai navigateur :

```bash
npm run start          # dans un terminal
node scripts/shots.mjs # captures + joue le scénario 182/118 -> crise
node scripts/audit.mjs # débordements, textes tronqués, cibles tactiles
```

`scripts/shots.mjs` écrit ses captures dans `shots/` (non versionné).

## Direction visuelle

« Le Registre » : papier ivoire, encre, bleu royal, filets or. Serif éditorial
(Instrument Serif) pour les noms et les chiffres, grotesque (Archivo) pour
l'interface, chiffres tabulaires, filets d'un pixel à la place des cartes.

Tout est dans `app/globals.css` :

- jetons de couleur et de rythme en haut du fichier (`:root`) ;
- aucune couleur de statut en dur ailleurs : `lib/tone.ts` fait la correspondance
  niveau → couleur et niveau → mot ;
- le statut est toujours **icône + mot + couleur**, jamais la couleur seule ;
- grain de papier en SVG inline, ombres dures (pas de flou), coins droits.

## Structure

```
app/                 routes (App Router)
components/          composants partagés, la plupart sans état
lib/alerts/rules.ts  moteur d'alertes — copie de src/lib/alerts/rules.ts
lib/data.ts          jeu de démonstration + traduction FR des sorties du moteur
lib/tone.ts          niveaux → mots et couleurs
lib/format.ts        dates françaises, « il y a 3 j »
```

## Règles à respecter en reprenant ce code

1. **Aucun chiffre de tension en dur dans un composant.** Les seuils sont dans
   `rules.ts`, les données dans `data.ts`. Un composant qui écrit `160` est un
   bug.
2. **Ne pas modifier `rules.ts` sans relancer** `node scripts/verify-demo.mts`
   (à la racine du dépôt). Les cinq phrases du scénario de démonstration en
   dépendent.
3. `lib/data.ts` est un **adaptateur**. Le jour où l'API existe, seules les
   fonctions `buildRegistry` / `getPatient` changent : elles doivent renvoyer la
   même forme (`PatientRecord`), et les pages ne bougent pas.
4. Les boutons « Prendre en charge », « Envoyer », « Planifier » sont des
   emplacements visuels. Ne pas les présenter comme fonctionnels devant le jury.

## Ce qui n'est pas fait

- Pas de backend, pas de base, pas d'authentification.
- Les actions du médecin (acquitter, répondre, planifier) ne font rien.
- Les SMS, l'escalade et les rappels adaptatifs sont sur la feuille de route,
  pas dans le code.
- Les courbes sont des SVG maison : pas de bibliothèque de graphiques.
