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
  Medal,
  PlacedComponent,
  RunResult,
  SimState,
} from './types';
import type { CareerState, LastRunEconomy } from './career';
import {
  MEDAL_RANK,
  bankruptcyFloor,
  betterMedal,
  isComplete,
  marginalPayout,
  newCareer,
} from './career';
import { getSpec } from './catalog';
import { LEVELS, getLevel } from './levels';

// ---------------------------------------------------------------------------
// App-level state
// ---------------------------------------------------------------------------

/**
 * Which top-level experience is active:
 *   - 'menu'     — the mode-select landing screen.
 *   - 'freeplay' — the original sandbox: every level open, level budgets only.
 *   - 'career'   — the money campaign layered over the same levels.
 */
export type AppMode = 'menu' | 'freeplay' | 'career';

/**
 * Top-level application state. `mode` selects the experience; when `game` is
 * null the UI shows the level-select (or menu) screen, otherwise the build/run
 * screen for that session. `career` holds the campaign slice (null in Free
 * Play), and is persisted to localStorage by the context layer.
 *
 * `nextId` is a monotonically increasing counter used to mint unique placed
 * component ids while keeping the reducer pure (no Date.now / random inside).
 */
export interface AppState {
  mode: AppMode;
  game: GameState | null;
  career: CareerState | null;
  nextId: number;
}

export const initialAppState: AppState = {
  mode: 'menu',
  game: null,
  career: null,
  nextId: 1,
};

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type Action =
  // Mode / campaign flow
  | { type: 'SELECT_MODE'; mode: AppMode }
  | { type: 'NEW_CAREER' }
  | { type: 'ABANDON_CAREER' }
  | { type: 'BACK_TO_MENU' }
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
    budgetOverride: null,
  };
}

/**
 * A career session: identical to a free session but with the affordability cap
 * pinned to the player's current money instead of the level's abstract budget.
 */
export function createCareerGameState(
  level: LevelSpec,
  money: number,
): GameState {
  return { ...createGameState(level), budgetOverride: money };
}

/** The effective spending cap for a session (money in career, else budget). */
export function effectiveBudget(game: GameState): number | undefined {
  return game.budgetOverride ?? game.level.budget;
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
  // Spending cap check: the level budget in Free Play, or the player's current
  // money in Career (via budgetOverride).
  const budget = effectiveBudget(state);
  if (budget !== undefined) {
    if (spentBudget(state) + getSpec(kind).cost > budget) return false;
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
// Career payout resolution
// ---------------------------------------------------------------------------

/**
 * Apply a finished run's outcome to the career: award the marginal payout for
 * an improved medal, record the best medal, unlock the next level on bronze+,
 * capture the run economics for the Results overlay, and re-evaluate the
 * win/bankruptcy status. Assumes `career.pending` is set (cost already
 * committed at RUN); returns the career unchanged if not.
 */
function applyRunPayout(career: CareerState, medal: Medal): CareerState {
  const pending = career.pending;
  if (!pending) return career;

  const { levelId, cost, medalBefore, moneyBefore } = pending;
  const medalAfter = betterMedal(medalBefore, medal);
  const payout = marginalPayout(levelId, medalBefore, medal);
  const money = career.money + payout; // cost was already deducted at RUN
  const best = { ...career.best, [levelId]: medalAfter };

  // Completing a level at bronze+ unlocks the next one in sequence.
  let unlocked = career.unlocked;
  let unlockedNew = false;
  const idx = LEVELS.findIndex((l) => l.id === levelId);
  if (
    MEDAL_RANK[medal] >= MEDAL_RANK.bronze &&
    idx === unlocked - 1 &&
    unlocked < LEVELS.length
  ) {
    unlocked += 1;
    unlockedNew = true;
  }

  const lastRun: LastRunEconomy = {
    levelId,
    cost,
    payout,
    medalBefore,
    medalAfter,
    moneyBefore,
    moneyAfter: money,
    unlockedNew,
  };

  let next: CareerState = {
    ...career,
    money,
    best,
    unlocked,
    lastRun,
    pending: null,
    moneyHistory: [...career.moneyHistory, money],
  };

  if (isComplete(next)) {
    next = { ...next, status: 'complete' };
  } else if (money < bankruptcyFloor(next)) {
    next = { ...next, status: 'bankrupt' };
  }

  return next;
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SELECT_MODE':
      return { ...state, mode: action.mode, game: null };

    case 'NEW_CAREER':
      // Reset the campaign to a fresh bankroll and enter it.
      return {
        ...state,
        mode: 'career',
        career: newCareer(),
        game: null,
      };

    case 'ABANDON_CAREER':
      // Wipe the campaign and return to the mode-select landing screen.
      return { ...state, mode: 'menu', career: null, game: null };

    case 'BACK_TO_MENU':
      return { ...state, mode: 'menu', game: null };

    case 'SELECT_LEVEL': {
      const level = getLevel(action.levelId);
      if (!level) return state;
      if (state.mode === 'career') {
        const career = state.career;
        if (!career) return state;
        const idx = LEVELS.findIndex((l) => l.id === level.id);
        // Only unlocked levels are playable in Career.
        if (idx < 0 || idx >= career.unlocked) return state;
        return {
          ...state,
          game: createCareerGameState(level, career.money),
        };
      }
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

    // --- Simulation lifecycle (Task 4 runner drives TICK/FINISH) ----------
    case 'RUN': {
      // The runner will populate `sim` via TICK; here we flip the phase and
      // clear any prior snapshot/result so overlays start from a clean slate.
      // In Career Mode the build cost is *committed* now — deducted from money
      // and never refunded, so a failed or aborted run means fried parts.
      let career = state.career;
      if (state.mode === 'career' && career) {
        const cost = spentBudget(game);
        career = {
          ...career,
          money: career.money - cost,
          pending: {
            levelId: game.level.id,
            cost,
            medalBefore: career.best[game.level.id] ?? 'none',
            moneyBefore: career.money,
          },
        };
      }
      return {
        ...state,
        career,
        game: {
          ...game,
          phase: 'running',
          sim: null,
          result: null,
          selectedKind: null,
          selectedComponentId: null,
        },
      };
    }

    case 'TICK':
      return { ...state, game: { ...game, sim: action.sim } };

    case 'FINISH': {
      const result = action.result;
      let career = state.career;
      if (state.mode === 'career' && career && career.pending) {
        career = applyRunPayout(career, result.medal);
      }
      return {
        ...state,
        career,
        game: { ...game, phase: 'results', result },
      };
    }

    case 'STOP': {
      // Return to building, discarding the in-flight run.
      let career = state.career;
      let nextGame: GameState = {
        ...game,
        phase: 'building',
        sim: null,
        result: null,
      };
      if (state.mode === 'career' && career) {
        // Aborting a committed run: the money is already spent (parts fried);
        // just clear the pending marker and record the balance.
        if (career.pending) {
          career = {
            ...career,
            pending: null,
            moneyHistory: [...career.moneyHistory, career.money],
          };
        }
        // Re-pin the affordability cap to whatever money remains.
        nextGame = { ...nextGame, budgetOverride: career.money };
        if (
          career.status === 'active' &&
          career.money < bankruptcyFloor(career)
        ) {
          career = { ...career, status: 'bankrupt' };
        }
      }
      return { ...state, career, game: nextGame };
    }

    default:
      return state;
  }
}
