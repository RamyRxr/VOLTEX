import { assistantInputSchema } from "shared";
import { assistantAnswer } from "@/lib/llm/features";
import { requirePatient } from "@/server/auth";
import { json, limitWrites, readBody, route } from "@/server/http";

export const dynamic = "force-dynamic";

/** Information assistant (spec §9.3): { question } → { answer }. General information only. */
export async function POST(req: Request) {
  return route(async () => {
    const { patientId } = await requirePatient(req);
    limitWrites("assistant", patientId);
    const { question } = await readBody(req, assistantInputSchema);
    return json(await assistantAnswer(question));
  });
}
