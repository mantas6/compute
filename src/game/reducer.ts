// Game state reducer (Task 3).
//
// Owns the mutable build/session state via a pure reducer that is driven by
// `useReducer` + React Context (see `context.tsx`). It enforces the building
// rules from TODO.md — cell occupancy, per-kind count limits, and an optional
// per-level budget — and is forward-compatible with the Task 4 simulation
// runner through the RUN / TICK / FINISH / STOP action placeholders.
//
// The simulation itself (power / thermal / tasks) is NOT implemented here.

import type {
  ComponentKind,
  GameState,
  GridPos,
  LevelSpec,
  PlacedComponent,
  RunResult,
  SimState,
} from './types';
import { getSpec } from './catalog';
import { getLevel } from './levels';

// ---------------------------------------------------------------------------
// App-level state
// ---------------------------------------------------------------------------

/**
 * Top-level application state. When `game` is null the UI shows the level
 * select screen; otherwise it shows the build/run screen for that session.
 *
 * `nextId` is a monotonically increasing counter used to mint unique placed
 * component ids while keeping the reducer pure (no Date.now / random inside).
 */
export interface AppState {
  game: GameState | null;
  nextId: number;
}

export const initialAppState: AppState = {
  game: null,
  nextId: 1,
};

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type Action =
  // Level flow
  | { type: 'SELECT_LEVEL'; levelId: string }
  | { type: 'BACK_TO_LEVELS' }
  // Palette / inspection
  | { type: 'SELECT_KIND'; kind: ComponentKind | null }
  | { type: 'SELECT_COMPONENT'; componentId: string | null }
  // Grid editing
  | { type: 'PLACE'; pos: GridPos }
  | { type: 'REMOVE'; componentId: string }
  | { type: 'CELL_CLICK'; pos: GridPos }
  | { type: 'CLEAR_ALL' }
  // Simulation lifecycle (placeholders driven by the Task 4 runner)
  | { type: 'RUN' }
  | { type: 'TICK'; sim: SimState }
  | { type: 'FINISH'; result: RunResult }
  | { type: 'STOP' };

// ---------------------------------------------------------------------------
// Helpers / selectors (pure, exported for the UI)
// ---------------------------------------------------------------------------

/** Convenience "x,y" key for a grid position. */
export function cellKey(pos: GridPos): string {
  return `${pos.x},${pos.y}`;
}

/** Build a fresh, empty session for the given level. */
export function createGameState(level: LevelSpec): GameState {
  return {
    level,
    components: {},
    occupancy: {},
    selectedKind: null,
    selectedComponentId: null,
    phase: 'building',
    sim: null,
    result: null,
  };
}

/** True if the position lies inside the level's chassis. */
export function inBounds(level: LevelSpec, pos: GridPos): boolean {
  return (
    pos.x >= 0 &&
    pos.y >= 0 &&
    pos.x < level.grid.width &&
    pos.y < level.grid.height
  );
}

/** Number of placed instances of a given kind. */
export function countOfKind(state: GameState, kind: ComponentKind): number {
  let n = 0;
  for (const id in state.components) {
    if (state.components[id].kind === kind) n += 1;
  }
  return n;
}

/** The count limit for a kind in this level (0 if not available). */
export function limitForKind(level: LevelSpec, kind: ComponentKind): number {
  const entry = level.available.find((a) => a.kind === kind);
  return entry ? entry.count : 0;
}

/** Total money spent on currently placed components. */
export function spentBudget(state: GameState): number {
  let total = 0;
  for (const id in state.components) {
    total += getSpec(state.components[id].kind).cost;
  }
  return total;
}

/** Aggregate power supply / draw of the current build (static, pre-sim). */
export function powerSummary(state: GameState): {
  supply: number;
  draw: number;
} {
  let supply = 0;
  let draw = 0;
  for (const id in state.components) {
    const spec = getSpec(state.components[id].kind);
    supply += spec.powerSupply;
    draw += spec.powerDraw;
  }
  return { supply, draw };
}

/** Whether placing one more of `kind` at `pos` is currently legal. */
export function canPlace(
  state: GameState,
  kind: ComponentKind,
  pos: GridPos,
): boolean {
  if (state.phase !== 'building') return false;
  const { level } = state;
  if (!inBounds(level, pos)) return false;
  // Cell must be empty.
  if (state.occupancy[cellKey(pos)]) return false;
  // Kind must be offered by this level and not exceed its count limit.
  const limit = limitForKind(level, kind);
  if (limit <= 0) return false;
  if (countOfKind(state, kind) >= limit) return false;
  // Budget check (only when the level defines one).
  if (level.budget !== undefined) {
    if (spentBudget(state) + getSpec(kind).cost > level.budget) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Internal building-state mutations (operate on GameState)
// ---------------------------------------------------------------------------

function placeComponent(
  game: GameState,
  kind: ComponentKind,
  pos: GridPos,
  id: string,
): GameState {
  if (!canPlace(game, kind, pos)) return game;
  const placed: PlacedComponent = { id, kind, pos };
  return {
    ...game,
    components: { ...game.components, [id]: placed },
    occupancy: { ...game.occupancy, [cellKey(pos)]: id },
    selectedComponentId: id,
  };
}

function removeComponent(game: GameState, componentId: string): GameState {
  if (game.phase !== 'building') return game;
  const placed = game.components[componentId];
  if (!placed) return game;
  const components = { ...game.components };
  delete components[componentId];
  const occupancy = { ...game.occupancy };
  delete occupancy[cellKey(placed.pos)];
  return {
    ...game,
    components,
    occupancy,
    selectedComponentId:
      game.selectedComponentId === componentId
        ? null
        : game.selectedComponentId,
  };
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SELECT_LEVEL': {
      const level = getLevel(action.levelId);
      if (!level) return state;
      return { ...state, game: createGameState(level) };
    }

    case 'BACK_TO_LEVELS':
      return { ...state, game: null };

    default:
      break;
  }

  // All remaining actions require an active session.
  const game = state.game;
  if (!game) return state;

  switch (action.type) {
    case 'SELECT_KIND':
      return {
        ...state,
        game: { ...game, selectedKind: action.kind, selectedComponentId: null },
      };

    case 'SELECT_COMPONENT':
      return {
        ...state,
        game: { ...game, selectedComponentId: action.componentId },
      };

    case 'PLACE': {
      if (!game.selectedKind) return state;
      const next = placeComponent(
        game,
        game.selectedKind,
        action.pos,
        `c${state.nextId}`,
      );
      if (next === game) return state;
      return { ...state, game: next, nextId: state.nextId + 1 };
    }

    case 'REMOVE': {
      const next = removeComponent(game, action.componentId);
      return next === game ? state : { ...state, game: next };
    }

    case 'CELL_CLICK': {
      if (game.phase !== 'building') return state;
      const occupantId = game.occupancy[cellKey(action.pos)] ?? null;

      if (occupantId) {
        // Occupied: select it, or remove it if it is already selected
        // ("click again to remove", per TODO.md).
        if (game.selectedComponentId === occupantId) {
          const next = removeComponent(game, occupantId);
          return { ...state, game: next };
        }
        return {
          ...state,
          game: { ...game, selectedComponentId: occupantId },
        };
      }

      // Empty cell: place the palette selection if possible, else clear.
      if (game.selectedKind && canPlace(game, game.selectedKind, action.pos)) {
        const next = placeComponent(
          game,
          game.selectedKind,
          action.pos,
          `c${state.nextId}`,
        );
        return { ...state, game: next, nextId: state.nextId + 1 };
      }
      return { ...state, game: { ...game, selectedComponentId: null } };
    }

    case 'CLEAR_ALL':
      if (game.phase !== 'building') return state;
      return {
        ...state,
        game: {
          ...game,
          components: {},
          occupancy: {},
          selectedComponentId: null,
        },
      };

    // --- Simulation lifecycle placeholders (Task 4 drives these) ----------
    case 'RUN':
      // The runner will populate `sim` via TICK; here we flip the phase and
      // clear any prior snapshot/result so overlays start from a clean slate.
      return {
        ...state,
        game: {
          ...game,
          phase: 'running',
          sim: null,
          result: null,
          selectedKind: null,
          selectedComponentId: null,
        },
      };

    case 'TICK':
      return { ...state, game: { ...game, sim: action.sim } };

    case 'FINISH':
      return {
        ...state,
        game: { ...game, phase: 'results', result: action.result },
      };

    case 'STOP':
      // Return to building, discarding the in-flight run.
      return {
        ...state,
        game: { ...game, phase: 'building', sim: null, result: null },
      };

    default:
      return state;
  }
}
