import { summaryRequestSchema } from "shared";
import { doctorSummary } from "@/lib/llm/features";
import { requireDoctor, requireLinkedPatient } from "@/server/auth";
import { json, limitWrites, readBody, readId, route } from "@/server/http";

export const dynamic = "force-dynamic";

/** AI summary (spec §9.1): `{ refresh?: boolean }` → { text, generatedAt, fromCache, source? }. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const { doctorId } = await requireDoctor(req);
    const patientId = readId((await params).id);
    await requireLinkedPatient(doctorId, patientId);
    limitWrites("summary", doctorId);
    const hasBody = (req.headers.get("content-length") ?? "0") !== "0";
    const { refresh } = hasBody ? await readBody(req, summaryRequestSchema) : { refresh: false };
    return json(await doctorSummary(patientId, refresh === true, new Date()));
  });
}
