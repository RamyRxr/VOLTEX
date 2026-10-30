import type { AlertLevel } from "shared";
import { StatusBadge } from "@/components/ui/StatusBadge";

/** An alert's level shown like a patient level (icon + colour + word). */
export function AlertBadge({ level }: { level: AlertLevel }) {
  return <StatusBadge level={level} />;
}
