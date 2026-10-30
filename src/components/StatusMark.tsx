import type { Level } from "@/lib/domain/types";
import { t } from "@/lib/i18n";
import { LEVEL_COLOR, toneVar } from "@/lib/tone";

/** The doctor's glyph for each level: icon + colour + word, never colour alone. */
export function Glyph({ level, size = 13 }: { level: Level; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 14 14",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (level) {
    case "RED_EMERGENCY":
      return (
        <svg {...common} stroke="none">
          <path d="M7 1.6 12.8 12.3H1.2Z" fill="currentColor" />
          <path d="M7 5.2v3.3" stroke="var(--paper)" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="7" cy="10.2" r="0.85" fill="var(--paper)" />
        </svg>
      );
    case "RED_CRISIS":
      return (
        <svg {...common}>
          <path d="M3.4 8.2 7 4.6l3.6 3.6" />
          <path d="M3.4 11.6 7 8l3.6 3.6" />
        </svg>
      );
    case "ORANGE":
      return (
        <svg {...common}>
          <path d="M3.6 9.2 7 5.6l3.4 3.6" />
          <path d="M3.6 12.1h6.8" />
        </svg>
      );
    case "YELLOW":
      return (
        <svg {...common}>
          <path d="M3 11 11 3" />
          <path d="M5.4 3H11v5.6" />
        </svg>
      );
    case "GREY_SILENT":
      return (
        <svg {...common}>
          <path d="M2.2 7h2.6" />
          <path d="M6.4 7h2.6" />
          <path d="M10.6 7h1.2" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="7" cy="7" r="5.1" />
          <circle cx="7" cy="7" r="1.7" fill="currentColor" stroke="none" />
        </svg>
      );
  }
}

export function StatusMark({ level, className = "" }: { level: Level; className?: string }) {
  return (
    <span className={`mark ${className}`} style={toneVar(LEVEL_COLOR[level])}>
      <Glyph level={level} />
      {t(`level.${level}` as const)}
    </span>
  );
}
