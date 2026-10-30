# TensioCare

Suivi de l'hypertension entre deux consultations (hackathon, problème 2).
Le patient mesure (page web mobile ou SMS), le moteur de règles trie, le
médecin décide. La source de vérité du produit est la spec du projet.

## Lancer la démo

```bash
npm install
cp .env.example .env.local     # puis remplir JWT_SECRET (32+ caractères), CRON_SECRET, SMS_GATEWAY_TOKEN
npm run build && npm run start # http://localhost:3000  (ou npm run dev)
```

`DEMO_MODE=true` raccourcit les délais (5 s au lieu de 60 s / 5 min), affiche
le bandeau « Mode démo : délais raccourcis » et active `/dev/sms-simulator`.

| Accès | Téléphone | Code |
|---|---|---|
| Dr Amine Benali (médecin, code d'invitation `DEMO01`) | `0550000000` | `1234` |
| Ahmed Saidi (patient de la démo en direct) | `0555000006` | `1234` |
| Zohra Meziane (téléphone à clavier, pour le SMS) | `0555000005` | — |

La page de connexion propose deux boutons d'accès rapide. Un numéro inconnu
ouvre l'inscription (consentement obligatoire, code `DEMO01`).

**Avant chaque répétition :** `/dev/sms-simulator` → « Réinitialiser la démo »
(les données sont recalculées par rapport à l'heure courante).

## Scénario de scène (spec §14)

1. **Médecin** `/d` : 30 patients triés. Fatima (élevée, « +19 mmHg les jours
   sans médicament »), Mohamed (tendance +2,1 mmHg/semaine), Karim (effet
   blouse blanche), Nadia (195/125 non confirmé), Zohra (silencieuse 9 jours).
2. **Téléphone** (Ahmed) `/p/add` : 182/118 aux boutons +/−, deux lectures,
   « Envoyer » → « Reposez-vous 5 minutes » (5 s en démo) → seconde session.
3. La ligne d'Ahmed passe en rouge (≈ 0,3 s mesuré), bandeau « Alerte rouge ».
   Clic → « Confirmé 182/118, niveau crise » → « Prendre en charge » →
   réponse rapide « Venez au cabinet aujourd'hui. » → visible côté patient.
4. **SMS** : téléphone réel via la passerelle, ou `/dev/sms-simulator` avec
   `TA 165 100 78 MP` depuis Zohra → réponse « Tension élevée (165/100)… ».
5. **Indicateurs** `/d/indicators`.

Répétition automatique dans de vrais navigateurs (captures dans `shots/`) :

```bash
node scripts/rehearse.mjs        # BASE=http://localhost:3000 par défaut
```

## Vérifications

```bash
npm run typecheck && npm run lint && npm test
```

Les tests (`src/**/__tests__`) couvrent chaque règle de la spec §6, les
phrases d'exemple mot pour mot, le jeu de démonstration et la boucle de scène.

## Architecture

```
src/lib/domain/      règles PURES (aucune base, aucun Next) — seul endroit des seuils : config.ts
src/lib/services/    colle : ingestion unique (web, SMS, simulateur, seed), triage, alertes…
src/lib/store/       Repo (forme exacte du schéma Prisma §7) + implémentation en mémoire + seed
src/app/api/         routes fines : session → Zod → un service
src/components/      écrans ; les données arrivent du serveur puis sont rafraîchies (1 s médecin)
src/lib/i18n/        dictionnaire FR (AR à remplir : la mise en page est déjà en propriétés logiques)
src/styles/          « Le Registre », découpé par écran
```

**Passer à Neon/Prisma :** écrire un `Repo` Prisma (mêmes méthodes que
`src/lib/store/types.ts`), le renvoyer depuis `src/lib/store/index.ts`, et
appeler `seedDemo(repo, new Date())` dans `prisma/seed.ts`. Les services et
les écrans ne changent pas.

## Choix faits là où la spec ne tranche pas

- **Une paire confirmée compte une fois** pour « 2 des 3 dernières », les
  groupes du traitement oublié et l'observance (sinon une seule mesure
  confirmée déclencherait « 2 des 3 »). Moyennes et tendance utilisent toutes
  les sessions valides, comme le dit §6.2.
- **Confirmation par palier** : la seconde session doit atteindre le même
  seuil (cible, 160/100 ou 180/120) ; 182/118 puis 150/95 n'est pas une crise.
  Une remesure qui saute au palier crise demande une mesure de plus.
- **Fenêtre de confirmation en démo** : 5 min (`CONFIG.demoModeSeconds`).
- **Mesure ≥ 180/120 non confirmée** (en attente, abandonnée, ou remesure plus
  basse) : visible du médecin tant qu'aucune mesure valide plus récente
  n'existe. *À valider avec un médecin : une remesure à 178/118 doit-elle
  confirmer la crise ?* (aujourd'hui non, il faut le même palier).
- **Délai minimal de confirmation** : 60 s (5 s en démo) ; un SMS renvoyé à
  l'identique dans la minute n'est pas enregistré deux fois.
- **Alertes** : une alerte par évaluation, celle de la règle qui fixe le
  niveau (les autres règles restent lisibles dans le dossier). Une alerte
  rouge garde le patient en rouge jusqu'à ce que le médecin la clôture ; une
  alerte non rouge se ferme d'elle-même quand sa règle ne s'applique plus, et
  une alerte clôturée ne revient qu'avec une nouvelle mesure.
- **Pile** : CSS maison conservé (pas Tailwind), graphiques SVG maison (pas
  Recharts), formulaires sans React Hook Form ; Zod partout.

## Sécurité

- Session : JWT signé (HS256) dans un cookie httpOnly SameSite=Lax ; `/d`,
  `/p` et `/dev` protégés par le middleware et revérifiés par chaque page.
- Chaque requête médecin est filtrée par `doctorId` ; « absent » et « pas à
  vous » donnent la même réponse 404 (tests `src/lib/services/__tests__/security.test.ts`).
- CSRF : `Sec-Fetch-Site` + type exactement `application/json` sur toute mutation.
- Limitation de débit en mémoire (connexion, inscription, mesures, messages,
  simulateur), plafond de patients par médecin, corps JSON ≤ 64 Ko.
- Secrets passerelle et cron : 32 caractères minimum, sinon l'API répond 503.
- En-têtes : `nosniff`, `frame-ancestors 'none'`, HSTS, politique de référent.

## Pas encore fait

- Base de données : la démo tourne **en mémoire, sur une seule machine**
  (`next start`). Sur Vercel (plusieurs instances), il faut le Repo Prisma.
- Envoi réel des SMS sortants : le webhook renvoie le texte de réponse ; le
  format exact dépend de l'application passerelle (question ouverte §18).
- Arabe (dictionnaire vide), Darija, résumé médecin, SMS au proche, escalade.
- Limitation de débit partagée (Redis) si l'app tourne sur plusieurs instances.
