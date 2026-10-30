import { Redirect, useRouter } from "expo-router";
import { useSession } from "@/auth/SessionProvider";
import { hasConsent } from "@/features/onboarding/consent";
import { ProfileForm } from "@/features/profile/ProfileForm";

export default function OnboardingProfile() {
  const router = useRouter();
  const { user, setWelcomePending } = useSession();

  // Opened directly (e.g. after a restart): consent comes first.
  if (!hasConsent()) return <Redirect href="/consent" />;

  return (
    <ProfileForm
      initialFullName={user?.signUpName ?? ""}
      // The root guards then open the patient space; home shows the initial risk once.
      onSaved={() => setWelcomePending(true)}
      onExit={() => router.back()}
    />
  );
}
