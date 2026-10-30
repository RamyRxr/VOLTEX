/**
 * Canned answers for the info assistant in demo mode. The real answers come from the
 * server LLM (spec §9.3), which follows the same safety rule for symptoms.
 */
export const SYMPTOM_REPLY =
  "Si vous avez ce symptôme, allez aux urgences de la maternité ou appelez le 14. Vous pouvez aussi le signaler dans le questionnaire du jour.";

const SYMPTOM_WORDS = [
  "mal de tête",
  "maux de tête",
  "trouble de la vue",
  "troubles de la vue",
  "vision",
  "flou",
  "douleur",
  "mal au ventre",
  "gonfl",
  "respir",
  "bouge moins",
  "saign",
  "vertige",
];

const TOPICS: readonly { words: readonly string[]; answer: string }[] = [
  {
    words: ["pré-éclampsie", "preeclampsie", "pré eclampsie", "eclampsie"],
    answer:
      "La pré-éclampsie est une complication de la grossesse, souvent après 20 semaines. Elle associe une tension élevée à d'autres signes, comme des protéines dans les urines. Elle peut évoluer vite, d'où l'intérêt de mesurer régulièrement sa tension et de signaler les symptômes. Seul votre médecin peut poser ce diagnostic.",
  },
  {
    words: ["mesurer", "mesure", "tensiomètre", "comment prendre"],
    answer:
      "Pour une mesure fiable : reposez-vous 5 minutes, asseyez-vous le dos appuyé, les pieds à plat. Posez le bras sur une table, le brassard au niveau du cœur. Ne parlez pas pendant la mesure. Recopiez ensuite les trois chiffres de l'écran dans l'application.",
  },
  {
    words: ["signe", "alerter", "inquiéter", "danger", "urgence"],
    answer:
      "Les signes qui doivent faire appeler le 14 ou aller aux urgences de la maternité : mal de tête fort qui ne passe pas, troubles de la vue, douleur en haut du ventre, gonflement brutal du visage ou des mains, difficulté à respirer, bébé qui bouge moins. N'attendez pas une réponse dans l'application.",
  },
  {
    words: ["application", "fonctionne", "appli", "médecin voit", "données"],
    answer:
      "Vous enregistrez votre tension et répondez à un court questionnaire. L'application vous dit quoi faire selon les résultats et prévient votre médecin si besoin. Seul le médecin que vous avez ajouté, après acceptation, voit vos données. L'application ne pose pas de diagnostic.",
  },
  {
    words: ["hypertension", "tension", "gestationnelle"],
    answer:
      "On parle d'hypertension pendant la grossesse quand la tension est à 140/90 ou plus. Elle se surveille de près car elle peut évoluer. Continuez vos mesures comme prévu : votre médecin suit vos résultats.",
  },
];

const FALLBACK =
  "Je peux répondre à des questions générales sur la tension pendant la grossesse et sur l'application. Pour toute question sur votre situation, parlez-en à votre médecin.";

export function cannedAnswer(question: string): string {
  const q = question.toLowerCase();
  if (SYMPTOM_WORDS.some((w) => q.includes(w))) return SYMPTOM_REPLY;
  return TOPICS.find((topic) => topic.words.some((w) => q.includes(w)))?.answer ?? FALLBACK;
}
