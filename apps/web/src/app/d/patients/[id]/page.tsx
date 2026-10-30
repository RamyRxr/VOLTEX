import { PatientFileView } from "@/components/file/PatientFileView";

export default async function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PatientFileView id={id} />;
}
