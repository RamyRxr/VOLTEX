import { patientSettingsSchema } from "shared";
import { requireDoctor, requireLinkedPatient } from "@/server/auth";
import { patientFile, updateSettings } from "@/server/doctor";
import { json, readBody, readId, route } from "@/server/http";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Full patient file (profile, risks, sessions, questionnaires, alerts, notes). */
export async function GET(req: Request, { params }: Params) {
  return route(async () => {
    const { doctorId } = await requireDoctor(req);
    const patientId = readId((await params).id);
    const linkId = await requireLinkedPatient(doctorId, patientId);
    return json(await patientFile(patientId, linkId, new Date()));
  });
}

/** { expectedSessionsPerDay? } */
export async function PATCH(req: Request, { params }: Params) {
  return route(async () => {
    const { doctorId } = await requireDoctor(req);
    const patientId = readId((await params).id);
    await requireLinkedPatient(doctorId, patientId);
    const { expectedSessionsPerDay } = await readBody(req, patientSettingsSchema);
    await updateSettings(patientId, expectedSessionsPerDay);
    return json({ ok: true });
  });
}
