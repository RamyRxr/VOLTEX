import type { TriageGroup } from "./views";

/** CLAUDE.md §6.6 sort order. Shared by the service and the dashboard (no server code). */
export const GROUP_ORDER: readonly TriageGroup[] = ["EMERGENCY", "CRISIS", "ORANGE", "YELLOW", "UNCONFIRMED", "SILENT", "GREEN"];
