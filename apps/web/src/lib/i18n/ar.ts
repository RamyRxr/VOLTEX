import type { MessageKey } from "./fr";

/**
 * Arabic dictionary (right-to-left). French ships first (spec rule 8);
 * any key missing here falls back to French. Fill this file to switch a
 * patient to Arabic: the layout already uses logical CSS properties.
 */
export const ar: Partial<Record<MessageKey, string>> = {
  "register.lang.AR": "العربية",
};
