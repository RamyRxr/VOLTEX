/**
 * Consent is given before the profile exists, and sent with the first profile save
 * (Patient.consentAt, CLAUDE.md §4.1.1). Kept in memory between the two screens.
 */
let consentAt: string | null = null;

export function recordConsent(now: Date): void {
  consentAt = now.toISOString();
}

export function getConsentAt(): string | null {
  return consentAt;
}
