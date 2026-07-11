// Task throughput solver (Task 4).
//
// A level ships a single "AB" task with a total `work` amount and a startup
// `latency`. Work is produced by *capable* processors — components that:
//   - have throughput > 0,
//   - execute the task's required instruction set,
//   - are connected to power, and are actually receiving watts.
//
// Each capable processor contributes `throughput * clock`, scaled by the
// global power `loadRatio` (under-supply slows everything) and throttled to a
// fraction while its cell is over its max temperature.
//
// RAM is not itself capable (no instruction set) but boosts the build: any
// powered RAM adjacent to a capable processor adds its own throughput, and
// each connected RAM shaves one tick off the effective startup latency.

import type { GameState, PowerState, ThermalState } from '../types';
import { getSpec } from '../catalog';
import { cellKey } from '../reducer';
import { orthogonalNeighbors } from './power';

/** Throughput multiplier applied to a processor whose cell is overheating. */
const OVERHEAT_THROTTLE = 0.3;

/** True if a component is a powered, connected processor for this task. */
function isCapableProcessor(
  game: GameState,
  id: string,
  power: PowerState,
): boolean {
  const spec = getSpec(game.components[id].kind);
  return (
    spec.throughput > 0 &&
    spec.instructionSet === game.level.task.instructionSet &&
    power.connected[id] &&
    power.supplied[id] > 0
  );
}

/** Work units produced this tick (before the runner applies latency gating). */
export function computeThroughput(
  game: GameState,
  power: PowerState,
  thermal: ThermalState,
): number {
  const { components } = game;
  const load = power.loadRatio;
  let total = 0;

  // Capable processors.
  for (const id in components) {
    if (!isCapableProcessor(game, id, power)) continue;
    const c = components[id];
    const spec = getSpec(c.kind);
    const key = cellKey(c.pos);
    const throttle = thermal.temp[key] > thermal.maxTemp[key]
      ? OVERHEAT_THROTTLE
      : 1;
    total += spec.throughput * spec.clock * load * throttle;
  }

  // RAM boost: powered RAM adjacent to a capable processor.
  for (const id in components) {
    const c = components[id];
    if (c.kind !== 'ram') continue;
    if (!power.connected[id] || power.supplied[id] <= 0) continue;
    const adjacentToProcessor = orthogonalNeighbors(c.pos).some((n) => {
      const occ = game.occupancy[cellKey(n)];
      return occ ? isCapableProcessor(game, occ, power) : false;
    });
    if (!adjacentToProcessor) continue;
    total += getSpec(c.kind).throughput * load;
  }

  return total;
}

/** Effective startup latency after RAM reduction (never below zero). */
export function effectiveLatency(game: GameState, power: PowerState): number {
  let ramCount = 0;
  for (const id in game.components) {
    const c = game.components[id];
    if (c.kind !== 'ram') continue;
    if (power.connected[id] && power.supplied[id] > 0) ramCount += 1;
  }
  return Math.max(0, game.level.task.latency - ramCount);
}
