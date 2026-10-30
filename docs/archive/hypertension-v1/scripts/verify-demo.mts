/**
 * Verify the demo data against the rule engine.
 *
 *   node scripts/verify-demo.mts
 *
 * Prints the level + evidence for the five story patients and asserts that
 * they match DEMO-DATA.md exactly. If this fails, fix the seed — never the
 * demo script.
 */
import { evaluatePatient, type Session, type Symptom } from '../src/lib/alerts/rules.ts';

const NOW = new Date('2026-10-30T09:00:00Z');
const D = (offset: number) => new Date(NOW.getTime() + offset * 86_400_000);

type Row = [number, number, number, boolean?];
const rows = (rs: Row[]): Session[] =>
  rs.map(([offset, sys, dia, pill], i) => ({
    id: `s${i}`,
    startedAt: D(offset),
    avgSys: sys,
    avgDia: dia,
    avgPulse: 76,
    status: 'CONFIRMED',
    pillTaken: pill ?? true,
    symptoms: [] as Symptom[],
    supersededBySessionId: null,
  }));

const patients = [
  {
    name: 'Fatima',
    expect: 'ORANGE|2 of the last 3 readings above 160/100 (162/101, 166/98).',
    patient: { targetSys: 135, targetDia: 85, expectedReadingsPerWeek: 7, highRisk: false },
    sessions: rows([
      [-21, 139, 88], [-18, 137, 86], [-15, 140, 89], [-12, 136, 85], [-11, 138, 87], [-9, 137, 86],
      [-8, 143, 92, false], [-6, 145, 93, false], [-5, 148, 95, false],
      [-3, 158, 98, false], [-2, 162, 101, false], [-1, 166, 98, false],
    ]),
  },
  {
    name: 'Mohamed',
    expect: 'YELLOW|Systolic rising 3.6 mmHg/week over 14 days; likely above target in about 13 days.',
    patient: { targetSys: 135, targetDia: 85, expectedReadingsPerWeek: 7, highRisk: true },
    sessions: rows([
      [-14, 121, 78], [-13, 122, 79], [-12, 122, 79], [-11, 123, 80], [-10, 123, 80],
      [-9, 124, 81], [-8, 124, 81], [-7, 125, 81], [-6, 125, 82], [-5, 126, 82],
      [-4, 126, 83], [-3, 127, 83], [-2, 127, 84], [-1, 128, 84],
    ]),
  },
  {
    name: 'Karim',
    expect: 'GREEN|Within target (131/83 vs 135/85).',
    patient: {
      targetSys: 135, targetDia: 85, expectedReadingsPerWeek: 3, highRisk: false,
      lastOfficeSys: 148, lastOfficeDia: 92,
    },
    sessions: rows([[-6, 130, 82], [-5, 133, 84], [-3, 129, 81], [-2, 132, 83]]),
  },
  {
    name: 'Zohra',
    expect: 'SILENT|Silent: no readings for 9 days, expected 2 per week.',
    patient: { targetSys: 135, targetDia: 85, expectedReadingsPerWeek: 2, highRisk: true },
    sessions: rows([[-18, 139, 86], [-15, 136, 85], [-12, 140, 87], [-9, 138, 86]]),
  },
  {
    name: 'Ahmed',
    expect: 'GREEN|Within target (132/84 vs 135/85).',
    patient: { targetSys: 135, targetDia: 85, expectedReadingsPerWeek: 7, highRisk: false },
    sessions: rows([[-10, 132, 84], [-8, 130, 83], [-6, 134, 85], [-4, 131, 84], [-2, 133, 85], [-1, 131, 83]]),
  },
];

let failures = 0;
for (const p of patients) {
  const r = evaluatePatient({ patient: p.patient, sessions: p.sessions, now: NOW });
  const got = `${r.level}|${r.evidence}`;
  const ok = got === p.expect;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${p.name.padEnd(8)} ${got}`);
  if (!ok) console.log(`      expected: ${p.expect}`);
  for (const i of r.insights) {
    if (i.id === 'MISSED_PILL' || i.id === 'WHITE_COAT') {
      console.log(`      insight: ${i.body}`);
    }
  }
}

/* ---- edge cases ---- */

const edge = (label: string, got: string, want: string) => {
  const ok = got === want;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(34)} ${got}${ok ? '' : `   expected ${want}`}`);
};

const one = (
  offset: number,
  sys: number,
  dia: number,
  extra: Partial<Session> = {},
): Session => ({
  id: 'x',
  startedAt: D(offset),
  avgSys: sys,
  avgDia: dia,
  status: 'CONFIRMED',
  pillTaken: true,
  symptoms: [],
  supersededBySessionId: null,
  ...extra,
});

const normal = { targetSys: 135, targetDia: 85, expectedReadingsPerWeek: 7, highRisk: false };

// chest pain with a normal BP must still be an emergency
edge(
  'chest pain at 128/79',
  evaluatePatient({
    patient: normal,
    sessions: [one(-1, 128, 79, { symptoms: ['CHEST_PAIN'] })],
    now: NOW,
  }).level,
  'EMERGENCY',
);

// unconfirmed high, 31 min old -> visible, but no notification
const pending = evaluatePatient({
  patient: normal,
  sessions: [one(-1, 195, 125, { status: 'PENDING', startedAt: new Date(NOW.getTime() - 31 * 60_000) })],
  now: NOW,
});
edge('unconfirmed 195/125 after 31 min', pending.level, 'PENDING');
edge('  ...does not notify', String(pending.notifyDoctorNow), 'false');

// unconfirmed high, 2 min old -> still inside the window, no pending row
edge(
  'unconfirmed 195/125 after 2 min',
  evaluatePatient({
    patient: normal,
    sessions: [one(-1, 195, 125, { status: 'PENDING', startedAt: new Date(NOW.getTime() - 2 * 60_000) })],
    now: NOW,
  }).level,
  'PENDING',
);

// a single slightly-high reading is not an alert
edge(
  'single 141/88 (1 session)',
  evaluatePatient({ patient: normal, sessions: [one(-1, 141, 88)], now: NOW }).level,
  'GREEN',
);

// three sessions above target -> yellow by average
edge(
  'three sessions at 145/90',
  evaluatePatient({ patient: normal, sessions: [one(-3, 145, 90), one(-2, 145, 90), one(-1, 145, 90)], now: NOW }).level,
  'YELLOW',
);

// three sessions at 158/98 -> not orange (nothing reaches 160/100), still yellow
edge(
  'three sessions at 158/98',
  evaluatePatient({ patient: normal, sessions: [one(-3, 158, 98), one(-2, 158, 98), one(-1, 158, 98)], now: NOW }).level,
  'YELLOW',
);

// confirmation merge: the superseded session is excluded from statistics
edge(
  'superseded session ignored',
  evaluatePatient({
    patient: normal,
    sessions: [one(-1, 128, 79), one(-1, 210, 130, { supersededBySessionId: 'a' })],
    now: NOW,
  }).level,
  'GREEN',
);

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
