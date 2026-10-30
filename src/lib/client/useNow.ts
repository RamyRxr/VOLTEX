import { useEffect, useState } from "react";

const TICK_MS = 15_000;

/**
 * "Now" for relative times. Starts from the server's clock so the first
 * client render matches the server HTML, then follows the browser clock.
 */
export function useNow(serverNowIso: string): string {
  const [now, setNow] = useState(serverNowIso);
  useEffect(() => {
    const id = setInterval(() => setNow(new Date().toISOString()), TICK_MS);
    return () => clearInterval(id);
  }, []);
  return now;
}
