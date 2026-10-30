import { useRouter } from "expo-router";
import { useMe } from "@/auth/SessionProvider";
import { ProfileForm } from "@/features/profile/ProfileForm";

export default function ProfileEdit() {
  const router = useRouter();
  const me = useMe();
  const patient = me.patient;
  if (!patient) return null;
  return (
    <ProfileForm
      mode="edit"
      initial={patient}
      consentAt={patient.consentAt}
      onSaved={() => router.replace("/risk")}
      onExit={() => router.back()}
    />
  );
}
