import { Linking } from "react-native";

/** Algerian emergency medical number (SAMU). */
export const EMERGENCY_NUMBER = "14";

export function callEmergency(): void {
  Linking.openURL(`tel:${EMERGENCY_NUMBER}`).catch(() => undefined);
}
