// Power network solver (Task 4).
//
// Model (per TODO.md):
//   PSU is the source of the power network. Power flows out of the PSU and
//   through any cell whose component `conductsPower` (PSU, Interface) via a
//   breadth-first search over orthogonal neighbours. A *consumer* (CPU, RAM,
//   Fan — anything that does not itself conduct) is considered "connected"
//   when it sits orthogonally adjacent to a powered conducting cell.
//
//   Each connected consumer demands `powerDraw * clock` watts at full load.
//   If total demand exceeds total supply the whole network is under-supplied
//   and every consumer's delivered power is scaled down by the same
//   `loadRatio = supply / demand` (clamped to 0..1). This is the single global
//   throttle the tasks/thermal modules read from.

import type { GameState, GridPos, PowerState } from '../types';
import { getSpec } from '../catalog';
import { cellKey } from '../reducer';

/** The four orthogonal neighbours of a grid position (unfiltered). */
export function orthogonalNeighbors(pos: GridPos): GridPos[] {
  return [
    { x: pos.x + 1, y: pos.y },
    { x: pos.x - 1, y: pos.y },
    { x: pos.x, y: pos.y + 1 },
    { x: pos.x, y: pos.y - 1 },
  ];
}

/** Solve the power network for the current (static) build. */
export function computePower(game: GameState): PowerState {
  const { components } = game;

  // Index conducting cells and PSU source cells by their cell key.
  const conducting = new Set<string>();
  const psuKeys: string[] = [];
  const posByKey: Record<string, GridPos> = {};

  for (const id in components) {
    const c = components[id];
    const spec = getSpec(c.kind);
    const key = cellKey(c.pos);
    posByKey[key] = c.pos;
    if (spec.conductsPower) conducting.add(key);
    if (spec.powerSupply > 0) psuKeys.push(key);
  }

  // BFS from every PSU through conducting cells only.
  const powered = new Set<string>();
  const queue: string[] = [];
  for (const k of psuKeys) {
    if (!powered.has(k)) {
      powered.add(k);
      queue.push(k);
    }
  }
  while (queue.length > 0) {
    const key = queue.shift() as string;
    const pos = posByKey[key];
    for (const n of orthogonalNeighbors(pos)) {
      const nk = cellKey(n);
      if (conducting.has(nk) && !powered.has(nk)) {
        powered.add(nk);
        queue.push(nk);
      }
    }
  }

  // Resolve connectivity + demand per component.
  const connected: Record<string, boolean> = {};
  const fullDraw: Record<string, number> = {};
  let totalSupply = 0;
  let totalDemand = 0;

  for (const id in components) {
    const c = components[id];
    const spec = getSpec(c.kind);
    const key = cellKey(c.pos);

    let isConnected: boolean;
    if (spec.conductsPower) {
      // Conductors are connected iff the BFS reached them from a PSU.
      isConnected = powered.has(key);
    } else {
      // Consumers connect by touching a powered conducting cell.
      isConnected = orthogonalNeighbors(c.pos).some((n) =>
        powered.has(cellKey(n)),
      );
    }
    connected[id] = isConnected;

    if (isConnected) {
      totalSupply += spec.powerSupply;
      const draw = spec.powerDraw * spec.clock;
      fullDraw[id] = draw;
      totalDemand += draw;
    } else {
      fullDraw[id] = 0;
    }
  }

  const loadRatio =
    totalDemand > 0 ? Math.min(1, totalSupply / totalDemand) : 1;

  const supplied: Record<string, number> = {};
  for (const id in components) {
    supplied[id] = connected[id] ? fullDraw[id] * loadRatio : 0;
  }

  return { totalSupply, totalDemand, loadRatio, connected, supplied };
}
