import { noteInputSchema } from "shared";
import { requireDoctor, requireLinkedPatient } from "@/server/auth";
import { addNote } from "@/server/doctor";
import { json, readBody, readId, route } from "@/server/http";

export const dynamic = "force-dynamic";

/** Doctor note / decision: { body }. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const { doctorId } = await requireDoctor(req);
    const patientId = readId((await params).id);
    await requireLinkedPatient(doctorId, patientId);
    const { body } = await readBody(req, noteInputSchema);
    return json(await addNote(doctorId, patientId, body, new Date()), 201);
  });
}
