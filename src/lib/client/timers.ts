import { useEffect, useState, useSyncExternalStore } from "react";

const TICK_MS = 250;

const remaining = (endsAt: number | null) => (endsAt == null ? 0 : Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));

/** Whole seconds left until `endsAt` (epoch ms); 0 when null or past. */
export function useCountdown(endsAt: number | null): number {
  const [seconds, setSeconds] = useState(() => remaining(endsAt));
  useEffect(() => {
    setSeconds(remaining(endsAt));
    if (endsAt == null) return;
    const id = setInterval(() => {
      const next = remaining(endsAt);
      setSeconds(next);
      if (next === 0) clearInterval(id);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [endsAt]);
  return seconds;
}

const subscribe = (notify: () => void) => {
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
  return () => {
    window.removeEventListener("online", notify);
    window.removeEventListener("offline", notify);
  };
};

/** Browser connectivity; assumed online during server rendering. */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}

/** "4:05" for a countdown display. */
export const mmss = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
