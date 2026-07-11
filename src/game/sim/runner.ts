// Simulation runner (Task 4).
//
// Orchestrates the per-tick pipeline — power -> thermal -> tasks — into two
// layers:
//
//   * `createEngine` is a pure, headless stepping engine. Each `step()`
//     advances one tick and returns a full `SimState` snapshot; `result()`
//     scores the finished run against the level criteria. This is what the
//     balance tests exercise.
//
//   * `startRun` drives that engine on a timer so a run plays back as an
//     animated loop (~a few seconds), dispatching TICK snapshots and a final
//     FINISH result into the reducer. It returns an abort function for
//     stop/unmount.

import type {
  GameState,
  LevelCriteria,
  Medal,
  RunResult,
  SimState,
  CriteriaTier,
} from '../types';
import type { Action } from '../reducer';
import { computePower } from './power';
import { initThermal, stepThermal } from './thermal';
import { computeThroughput, effectiveLatency } from './tasks';

/** Hard safety cap so a hopeless build still terminates. */
const MAX_TICKS = 400;

export interface SimEngine {
  /** Advance one tick and return the snapshot for it. */
  step(): SimState;
  /** True once the task is complete or the tick cap is hit. */
  done(): boolean;
  /** Score the run so far against the level criteria. */
  result(): RunResult;
}

/** Does a run satisfy every threshold in a scoring tier? */
function meetsTier(r: RunResult, tier: CriteriaTier): boolean {
  return (
    r.completed &&
    r.time <= tier.maxTime &&
    r.peakTemp <= tier.maxPeakTemp &&
    r.peakPower <= tier.maxPower
  );
}

/** Highest medal a run earns (all thresholds are maximums; lower is better). */
export function scoreMedal(criteria: LevelCriteria, r: RunResult): Medal {
  if (meetsTier(r, criteria.gold)) return 'gold';
  if (meetsTier(r, criteria.silver)) return 'silver';
  if (meetsTier(r, criteria.bronze)) return 'bronze';
  return 'none';
}

/** Build a pure, headless stepping engine for a (static) build. */
export function createEngine(game: GameState): SimEngine {
  const task = game.level.task;
  const field = initThermal(game);

  let tick = 0; // index of the *next* tick to compute
  let elapsed = 0; // ticks actually run
  let workDone = 0;
  let complete = false;
  let peakTemp = game.level.thermal.ambient;
  let peakPower = 0;
  let everOverheated = false;

  function step(): SimState {
    const power = computePower(game);
    const thermalStep = stepThermal(game, field, power);
    const latency = effectiveLatency(game, power);

    let throughput = 0;
    if (tick >= latency && !complete) {
      throughput = computeThroughput(game, power, thermalStep.state);
      workDone = Math.min(task.work, workDone + throughput);
    }
    if (workDone >= task.work) complete = true;

    const powerUsed = power.totalDemand * power.loadRatio;
    peakTemp = Math.max(peakTemp, thermalStep.hottest);
    peakPower = Math.max(peakPower, powerUsed);
    if (thermalStep.overheated) everOverheated = true;

    const sim: SimState = {
      tick,
      power,
      thermal: thermalStep.state,
      task: {
        workDone,
        workTotal: task.work,
        throughput,
        complete,
      },
      peakTemp,
      peakPower,
      overheated: thermalStep.overheated,
    };

    tick += 1;
    elapsed += 1;
    return sim;
  }

  function done(): boolean {
    return complete || elapsed >= MAX_TICKS;
  }

  function result(): RunResult {
    const base: RunResult = {
      time: elapsed,
      peakTemp: Math.round(peakTemp * 10) / 10,
      peakPower: Math.round(peakPower * 10) / 10,
      completed: complete,
      overheated: everOverheated,
      medal: 'none',
    };
    base.medal = scoreMedal(game.level.criteria, base);
    return base;
  }

  return { step, done, result };
}

export interface RunOptions {
  /** Milliseconds between ticks (animation pacing). Default 160ms. */
  tickMs?: number;
}

/**
 * Run the simulation as an animated loop, dispatching TICK/FINISH into the
 * reducer. Returns an abort function (call on Stop or unmount).
 */
export function startRun(
  game: GameState,
  dispatch: (action: Action) => void,
  options: RunOptions = {},
): () => void {
  const engine = createEngine(game);
  const tickMs = options.tickMs ?? 160;
  let aborted = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function tickOnce() {
    if (aborted) return;
    const sim = engine.step();
    dispatch({ type: 'TICK', sim });
    if (engine.done()) {
      dispatch({ type: 'FINISH', result: engine.result() });
      return;
    }
    timer = setTimeout(tickOnce, tickMs);
  }

  // Kick off after one interval so the initial (building) frame is visible.
  timer = setTimeout(tickOnce, tickMs);

  return () => {
    aborted = true;
    if (timer !== undefined) clearTimeout(timer);
  };
}
