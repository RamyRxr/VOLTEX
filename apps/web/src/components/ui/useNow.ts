"use client";

import { useEffect, useState } from "react";

const TICK_MS = 30_000;

/** Current time, refreshed every 30 s, for "il y a 5 min" labels. */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(id);
  }, []);
  return now;
}
