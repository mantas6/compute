// Level definitions.
//
// Each level sets a chassis size, the palette (with per-kind limits) and an
// optional budget, a single "AB" task, thermal tuning, and bronze/silver/gold
// criteria. Criteria are *maximums* (lower is better) and a run must satisfy
// every threshold in a tier — time, peak temp, and peak power — to earn it.
//
// The thresholds below are hand-tuned to the catalog values and give a clear
// design intent per level; they can be re-balanced once the sim (Task 4) is
// running and produces exact numbers.

import type { LevelSpec } from './types';

export const LEVELS: LevelSpec[] = [
  // -------------------------------------------------------------------------
  // Level 1 — First Boot
  // A gentle intro: small grid, generous power, light workload. Teaches
  // PSU -> Interface -> CPU wiring and basic cooling with a single fan.
  // -------------------------------------------------------------------------
  {
    id: 'first-boot',
    name: 'First Boot',
    description:
      'Wire a PSU to a CPU through interface tiles and run a short job. Keep it cool enough to finish.',
    grid: { width: 4, height: 4 },
    task: { instructionSet: 'AB', work: 100, latency: 2 },
    available: [
      { kind: 'psu', count: 1 },
      { kind: 'interface', count: 6 },
      { kind: 'cpu', count: 1 },
      { kind: 'fan', count: 1 },
      { kind: 'heatsink', count: 2 },
    ],
    thermal: {
      ambient: 25,
      heatScale: 0.5,
      baselineDissipation: 0.08,
      neighborSpread: 0.12,
    },
    criteria: {
      bronze: { maxTime: 22, maxPeakTemp: 88, maxPower: 90 },
      silver: { maxTime: 15, maxPeakTemp: 72, maxPower: 70 },
      gold: { maxTime: 11, maxPeakTemp: 60, maxPower: 58 },
    },
  },

  // -------------------------------------------------------------------------
  // Level 2 — Thermal Throttle
  // Bigger job on a hotter chassis with tighter power. Players must balance a
  // CPU (+RAM for throughput) against active/passive cooling. Budget-limited.
  // -------------------------------------------------------------------------
  {
    id: 'thermal-throttle',
    name: 'Thermal Throttle',
    description:
      'A heavier workload in a warm chassis. Add RAM for speed, then tame the heat before it throttles or fails you.',
    grid: { width: 5, height: 5 },
    task: { instructionSet: 'AB', work: 240, latency: 3 },
    budget: 260,
    available: [
      { kind: 'psu', count: 1 },
      { kind: 'interface', count: 10 },
      { kind: 'cpu', count: 1 },
      { kind: 'ram', count: 2 },
      { kind: 'fan', count: 2 },
      { kind: 'heatsink', count: 3 },
    ],
    thermal: {
      ambient: 30,
      heatScale: 0.5,
      baselineDissipation: 0.06,
      neighborSpread: 0.12,
    },
    criteria: {
      bronze: { maxTime: 30, maxPeakTemp: 92, maxPower: 110 },
      silver: { maxTime: 22, maxPeakTemp: 78, maxPower: 90 },
      gold: { maxTime: 16, maxPeakTemp: 66, maxPower: 85 },
    },
  },

  // -------------------------------------------------------------------------
  // Level 3 — Full Rack
  // Large grid, large job, strict power ceiling. Encourages a dual-CPU build
  // with careful routing and a full cooling layout. The hard mode.
  // -------------------------------------------------------------------------
  {
    id: 'full-rack',
    name: 'Full Rack',
    description:
      'A big job on a big board with a strict power ceiling. Route two processors, feed them RAM, and cool the whole rack.',
    grid: { width: 6, height: 6 },
    task: { instructionSet: 'AB', work: 520, latency: 4 },
    budget: 520,
    available: [
      { kind: 'psu', count: 2 },
      { kind: 'interface', count: 18 },
      { kind: 'cpu', count: 2 },
      { kind: 'ram', count: 4 },
      { kind: 'fan', count: 4 },
      { kind: 'heatsink', count: 6 },
    ],
    thermal: {
      ambient: 32,
      heatScale: 0.5,
      baselineDissipation: 0.05,
      neighborSpread: 0.1,
    },
    criteria: {
      bronze: { maxTime: 40, maxPeakTemp: 95, maxPower: 220 },
      silver: { maxTime: 28, maxPeakTemp: 82, maxPower: 180 },
      gold: { maxTime: 20, maxPeakTemp: 70, maxPower: 150 },
    },
  },
];

/** Look up a level by id, or undefined if not found. */
export function getLevel(id: string): LevelSpec | undefined {
  return LEVELS.find((level) => level.id === id);
}
