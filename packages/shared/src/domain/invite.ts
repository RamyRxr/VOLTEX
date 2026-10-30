/** Doctor invite codes (spec §3): 6 characters from A-Z + 2-9, no 0/O/1/I, valid 24 h, single use. */

export const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const INVITE_LENGTH = 6;
export const INVITE_VALID_HOURS = 24;
export const INVITE_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;

/** `randomIndex(n)` returns an integer in [0, n); injected so the API uses crypto and tests stay deterministic. */
export function generateInviteCode(randomIndex: (n: number) => number): string {
  return Array.from({ length: INVITE_LENGTH }, () => INVITE_ALPHABET[randomIndex(INVITE_ALPHABET.length)]).join("");
}

export const inviteExpiresAt = (now: Date): Date => new Date(now.getTime() + INVITE_VALID_HOURS * 3_600_000);

/** Usable when not used and not expired. */
export const isInviteUsable = (invite: { readonly expiresAt: Date; readonly usedAt: Date | null }, now: Date): boolean =>
  invite.usedAt == null && invite.expiresAt.getTime() > now.getTime();
