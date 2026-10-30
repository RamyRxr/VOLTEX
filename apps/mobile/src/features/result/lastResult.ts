import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";
import type { EvaluationDto as Evaluation } from "shared";

/**
 * The last evaluation the API returned, kept on the phone so the home screen and the
 * re-measure countdown survive navigation and app restarts.
 */
export interface LastResult {
  readonly evaluation: Evaluation;
  readonly source: "SESSION" | "QUESTIONNAIRE";
  readonly receivedAt: string;
  readonly bp: { readonly sys: number; readonly dia: number } | null;
  /** ISO time after which the patient should re-measure (REMEASURE action). */
  readonly remeasureAt: string | null;
  readonly notificationId: string | null;
  /** Shown from the phone's own safety net because the API could not be reached. */
  readonly offline: boolean;
}

const KEY = "tensiocare.lastResult.v1";
let current: LastResult | null = null;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

export async function hydrateLastResult(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    current = raw ? (JSON.parse(raw) as LastResult) : null;
  } catch {
    current = null;
  }
  emit();
}

export async function setLastResult(result: LastResult): Promise<void> {
  current = result;
  emit();
  await AsyncStorage.setItem(KEY, JSON.stringify(result)).catch(() => undefined);
}

export async function clearLastResult(): Promise<void> {
  current = null;
  emit();
  await AsyncStorage.removeItem(KEY).catch(() => undefined);
}

export function getLastResult(): LastResult | null {
  return current;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLastResult(): LastResult | null {
  return useSyncExternalStore(subscribe, getLastResult, getLastResult);
}
