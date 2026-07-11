// Thermal field solver (Task 4).
//
// The thermal field is a persistent per-cell temperature map that carries
// across ticks (heat accumulates and dissipates over the run). One tick does,
// in order:
//
//   1. Generation  — each powered component adds
//                       supplied * heatLoss * heatScale
//                     heat units to the cell it occupies. Only *delivered*
//                     watts count, so an under-supplied build runs cooler.
//   2. Active cooling — Fans (need power) and Heatsinks (passive) remove
//                     `cooling` heat units from their own cell and a reduced
//                     share (`NEIGHBOR_COOL_FACTOR`) from each orthogonal
//                     neighbour, so parking a cooler next to a hot CPU is what
//                     actually keeps it in the safe zone.
//   3. Spread      — each cell pushes a fraction of its above-ambient heat to
//                     its in-bounds orthogonal neighbours (component `spread`
//                     for occupied cells, level `neighborSpread` for empty
//                     ones). This is how a hot CPU dumps heat into an adjacent
//                     heatsink/fan cell that then exhausts it.
//   4. Dissipation — every cell decays toward ambient by `baselineDissipation`.
//
// Overheating: a component whose cell temperature exceeds its effective max
// (`maxTemp + maxTempBonus`) is flagged overheated. Heatsinks raise the
// tolerable limit of their own cell; their real cooling value to a processor
// comes from pulling heat across the spread step.

import type {
  CellKey,
  GameState,
  PowerState,
  ThermalState,
} from '../types';
import { getSpec } from '../catalog';
import { cellKey } from '../reducer';
import { orthogonalNeighbors } from './power';

/** Fraction of a cooler's power applied to each orthogonal neighbour cell. */
const NEIGHBOR_COOL_FACTOR = 0.5;

/** Persistent thermal field, mutated in place each tick by `stepThermal`. */
export interface ThermalField {
  temp: Record<CellKey, number>;
}

/** Result of stepping the thermal field one tick. */
export interface ThermalStep {
  state: ThermalState;
  /** Any occupied component exceeded its effective max temp this tick. */
  overheated: boolean;
  /** Hottest *occupied* cell temperature this tick (used for peak-temp scoring). */
  hottest: number;
}

/** All cell keys for a level's grid. */
function allCellKeys(game: GameState): CellKey[] {
  const { width, height } = game.level.grid;
  const keys: CellKey[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) keys.push(cellKey({ x, y }));
  }
  return keys;
}

/** True if a cell key lies inside the level grid. */
function inGrid(game: GameState, key: CellKey): boolean {
  const [x, y] = key.split(',').map(Number);
  return (
    x >= 0 &&
    y >= 0 &&
    x < game.level.grid.width &&
    y < game.level.grid.height
  );
}

/** Create a fresh thermal field with every cell at ambient. */
export function initThermal(game: GameState): ThermalField {
  const ambient = game.level.thermal.ambient;
  const temp: Record<CellKey, number> = {};
  for (const key of allCellKeys(game)) temp[key] = ambient;
  return { temp };
}

/** Advance the thermal field by one tick and return the derived state. */
export function stepThermal(
  game: GameState,
  field: ThermalField,
  power: PowerState,
): ThermalStep {
  const { components, occupancy } = game;
  const thermal = game.level.thermal;
  const amb = thermal.ambient;
  const temp = field.temp;

  // 1. Generation.
  for (const id in components) {
    const c = components[id];
    const spec = getSpec(c.kind);
    const gen = power.supplied[id] * spec.heatLoss * thermal.heatScale;
    if (gen > 0) temp[cellKey(c.pos)] += gen;
  }

  // 2. Active cooling (fans need power; heatsinks are passive). A cooler
  //    pulls heat from its own cell and, at a reduced rate, its neighbours.
  //    Accumulate into a buffer so the order of coolers doesn't matter.
  const keys = allCellKeys(game);
  const cool: Record<CellKey, number> = {};
  for (const key of keys) cool[key] = 0;

  for (const id in components) {
    const c = components[id];
    const spec = getSpec(c.kind);
    if (spec.cooling <= 0) continue;
    const needsPower = spec.powerDraw > 0;
    const poweredOk = needsPower ? power.supplied[id] > 0 : true;
    if (!poweredOk) continue;
    cool[cellKey(c.pos)] += spec.cooling;
    for (const n of orthogonalNeighbors(c.pos)) {
      const nk = cellKey(n);
      if (inGrid(game, nk)) cool[nk] += spec.cooling * NEIGHBOR_COOL_FACTOR;
    }
  }
  for (const key of keys) {
    if (cool[key] > 0) temp[key] = Math.max(amb, temp[key] - cool[key]);
  }

  // 3. Spread (computed simultaneously via a delta buffer).
  const delta: Record<CellKey, number> = {};
  for (const key of keys) delta[key] = 0;

  for (const key of keys) {
    const above = temp[key] - amb;
    if (above <= 0) continue;
    const occ = occupancy[key];
    const spreadFrac = occ
      ? getSpec(components[occ].kind).spread
      : thermal.neighborSpread;
    if (spreadFrac <= 0) continue;

    const [x, y] = key.split(',').map(Number);
    const outKeys = orthogonalNeighbors({ x, y })
      .map((n) => cellKey(n))
      .filter((nk) => inGrid(game, nk));
    if (outKeys.length === 0) continue;

    const out = above * spreadFrac;
    const per = out / outKeys.length;
    delta[key] -= out;
    for (const nk of outKeys) delta[nk] += per;
  }
  for (const key of keys) temp[key] += delta[key];

  // 4. Baseline dissipation toward ambient.
  for (const key of keys) {
    const above = temp[key] - amb;
    if (above > 0) temp[key] -= above * thermal.baselineDissipation;
  }

  // Derive max-temp map + overheat / hottest over occupied cells.
  const maxTemp: Record<CellKey, number> = {};
  let overheated = false;
  let hottest = amb;
  for (const key of keys) {
    const occ = occupancy[key];
    if (occ) {
      const spec = getSpec(components[occ].kind);
      const mt = spec.maxTemp + spec.maxTempBonus;
      maxTemp[key] = mt;
      if (temp[key] > hottest) hottest = temp[key];
      if (temp[key] > mt) overheated = true;
    } else {
      // Empty cells have no hard limit; expose a reference span for overlays.
      maxTemp[key] = amb + 65;
    }
  }

  return {
    state: { temp: { ...temp }, maxTemp },
    overheated,
    hottest,
  };
}
