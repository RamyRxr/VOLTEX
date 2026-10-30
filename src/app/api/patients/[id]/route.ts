import { requireDoctor, requireViewer } from "@/lib/auth/server";
import { serviceContext } from "@/lib/demo";
import { handle, ok, readJson } from "@/lib/http";
import { ServiceError } from "@/lib/services/context";
import { getDoctorPatientView, getPatientSelfView, updatePatientSettings } from "@/lib/services/patients";
import type { DoctorPatientView, PatientSelfView } from "@/lib/services/views";
import { patientPatchSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };
type PatientView = DoctorPatientView | PatientSelfView;

/** The doctor's view of their patient, or the patient's own view. */
export async function GET(_req: Request, { params }: Params) {
  return handle(async () => {
    const { id } = await params;
    const viewer = await requireViewer();
    const ctx = await serviceContext();
    if (viewer.role === "DOCTOR") return ok<PatientView>(await getDoctorPatientView(ctx, viewer, id));
    if (viewer.patientId !== id) throw new ServiceError("NOT_FOUND", "Patient not found");
    return ok<PatientView>(await getPatientSelfView(ctx, viewer));
  });
}

/** Doctor edits target, expected readings per week, office reading, notes. */
export async function PATCH(req: Request, { params }: Params) {
  return handle(async () => {
    const { id } = await params;
    const viewer = await requireDoctor();
    const patch = await readJson(req, patientPatchSchema);
    const ctx = await serviceContext();
    await updatePatientSettings(ctx, viewer, id, patch);
    return ok(await getDoctorPatientView(ctx, viewer, id));
  });
}
