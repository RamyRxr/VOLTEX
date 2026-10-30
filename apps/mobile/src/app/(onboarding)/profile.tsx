import { Redirect, useRouter } from "expo-router";
import { useSession } from "@/auth/SessionProvider";
import { getConsentAt } from "@/features/onboarding/consent";
import { ProfileForm } from "@/features/profile/ProfileForm";

export default function OnboardingProfile() {
  const router = useRouter();
  const { setWelcomePending } = useSession();
  const consentAt = getConsentAt();

  // Opened directly (e.g. after a restart): consent comes first.
  if (!consentAt) return <Redirect href="/consent" />;

  return (
    <ProfileForm
      mode="onboarding"
      initial={null}
      consentAt={consentAt}
      // The root guards then open the patient space; home shows the initial risk once.
      onSaved={() => setWelcomePending(true)}
      onExit={() => router.back()}
    />
  );
}
