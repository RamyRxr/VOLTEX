/**
 * Consent is given on its own screen before the profile exists, then sent as `consent: true`
 * with the first profile save; the API stores consentAt (spec §4.1.1). Kept in memory between the two screens.
 */
let given = false;

export function recordConsent(): void {
  given = true;
}

export function hasConsent(): boolean {
  return given;
}
