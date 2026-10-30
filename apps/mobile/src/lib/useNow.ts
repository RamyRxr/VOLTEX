import { useEffect, useState } from "react";

/** Current time, refreshed every `intervalMs` (for countdowns and "il y a 5 min"). */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Seconds left until `targetIso` (0 when passed, null when there is no target). */
export function useSecondsLeft(targetIso: string | null): number | null {
  const now = useNow(1_000);
  if (!targetIso) return null;
  return Math.max(0, Math.ceil((new Date(targetIso).getTime() - now.getTime()) / 1000));
}
