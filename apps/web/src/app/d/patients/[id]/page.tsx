import { notFound } from "next/navigation";
import { PatientDossier } from "@/components/doctor/PatientDossier";
import { doctorPage } from "@/lib/auth/server";
import { serviceContext } from "@/lib/demo";
import { ServiceError } from "@/lib/services/context";
import { getDoctorPatientView } from "@/lib/services/patients";

export const dynamic = "force-dynamic";

export default async function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { viewer } = await doctorPage(`/d/patients/${id}`);
  const view = await loadView(viewer, id);
  return <PatientDossier initial={view} />;
}

async function loadView(viewer: Parameters<typeof getDoctorPatientView>[1], id: string) {
  try {
    return await getDoctorPatientView(await serviceContext(), viewer, id);
  } catch (error: unknown) {
    if (error instanceof ServiceError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
}
