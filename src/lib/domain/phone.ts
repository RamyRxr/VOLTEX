/**
 * Phone numbers are the patient key for SMS, so every channel normalises them
 * the same way: Algerian national format (0550 00 00 00) → +213550000000.
 */
export function normalizePhone(raw: string): string | null {
  const compact = raw.trim().replace(/[\s.\-()]/g, "");
  let candidate = compact;
  if (candidate.startsWith("00")) candidate = `+${candidate.slice(2)}`;
  if (/^0\d{8,9}$/.test(candidate)) candidate = `+213${candidate.slice(1)}`;
  return /^\+\d{9,15}$/.test(candidate) ? candidate : null;
}

/** For display and logs: never the full number. "+213 •• •• 00 00" */
export function maskPhone(phone: string): string {
  return phone.length <= 4 ? "••••" : `${phone.slice(0, 4)} •• •• ${phone.slice(-4, -2)} ${phone.slice(-2)}`;
}
