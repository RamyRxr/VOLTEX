/** Doctor invite codes: 6 characters from A-Z and 2-9, without 0/O/1/I (CLAUDE.md §3). */
export const INVITE_CODE_LENGTH = 6;
const ALLOWED = /[ABCDEFGHJKLMNPQRSTUVWXYZ2-9]/;

/** Uppercases, drops spaces and characters that can never appear in a code, caps the length. */
export function normalizeInviteCode(raw: string): string {
  return raw
    .toUpperCase()
    .split("")
    .filter((ch) => ALLOWED.test(ch))
    .join("")
    .slice(0, INVITE_CODE_LENGTH);
}

export function isCompleteInviteCode(code: string): boolean {
  return code.length === INVITE_CODE_LENGTH && normalizeInviteCode(code) === code;
}
