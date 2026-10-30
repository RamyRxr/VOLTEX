import type { Level } from "shared";
import { levelDisplay } from "@/lib/status";
import { Icon } from "./Icon";

/** Patient level: icon + colour + word, never colour alone (spec rule 12). */
export function StatusBadge({
  level,
  unconfirmedSevere = false,
  large = false,
}: {
  level: Level;
  unconfirmedSevere?: boolean;
  large?: boolean;
}) {
  const display = levelDisplay(level, unconfirmedSevere);
  return (
    <span className={`badge tone-${display.tone}${large ? " badge-lg" : ""}`}>
      <Icon name={display.icon} size={large ? 18 : 14} />
      {display.word}
    </span>
  );
}
