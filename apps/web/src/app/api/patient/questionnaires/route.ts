import { questionnaireInputSchema, rangeQuerySchema } from "shared";
import { requirePatient } from "@/server/auth";
import { isDemoMode, json, readBody, readQuery, route } from "@/server/http";
import { recordQuestionnaire } from "@/server/patient";
import { listQuestionnaires } from "@/server/reads";

export const dynamic = "force-dynamic";

/** Daily questionnaire → { evaluation, risk }. */
export async function POST(req: Request) {
  return route(async () => {
    const { patientId } = await requirePatient(req);
    const input = await readBody(req, questionnaireInputSchema);
    return json(await recordQuestionnaire(patientId, input, new Date(), isDemoMode()), 201);
  });
}

/** Own questionnaires, ?from=&to= (ISO). */
export async function GET(req: Request) {
  return route(async () => {
    const { patientId } = await requirePatient(req);
    return json(await listQuestionnaires(patientId, readQuery(req, rangeQuerySchema)));
  });
}
