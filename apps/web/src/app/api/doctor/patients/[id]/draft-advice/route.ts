import { draftAdvice } from "@/lib/llm/features";
import { requireDoctor, requireLinkedPatient } from "@/server/auth";
import { json, limitWrites, readId, route } from "@/server/http";

export const dynamic = "force-dynamic";

/** Message suggestion (spec §9.2) → { text, source }. The doctor edits it and sends it himself. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const { doctorId } = await requireDoctor(req);
    const patientId = readId((await params).id);
    await requireLinkedPatient(doctorId, patientId);
    limitWrites("draft", doctorId);
    return json(await draftAdvice(patientId, new Date()));
  });
}
