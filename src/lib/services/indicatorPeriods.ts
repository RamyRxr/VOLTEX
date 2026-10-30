/** Periods offered on the indicators page, in weeks. Shared with the client (no server code). */
export const INDICATOR_PERIODS = [4, 8, 12] as const;
export type IndicatorPeriod = (typeof INDICATOR_PERIODS)[number];
