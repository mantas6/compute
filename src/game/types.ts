// Core game data layer types for `compute`.
//
// These types describe the static design data (component specs, levels,
// tasks, criteria) as well as the mutable runtime state (grid, placed
// components, simulation snapshots, results). They are intentionally
// forward-compatible with the reducer (Task 3) and the simulation modules
// (Task 4: power / thermal / tasks / runner) which are not implemented yet.

// ---------------------------------------------------------------------------
// Basic identifiers & geometry
// ---------------------------------------------------------------------------

/** The kinds of hardware components the player can place on the chassis. */
export type ComponentKind =
  | 'cpu'
  | 'ram'
  | 'interface'
  | 'psu'
  | 'heatsink'
  | 'fan';

/**
 * Instruction sets a processor can execute. The vertical slice only ships a
 * single instruction set ("AB") per the confirmed simplifications, but the
 * type is kept as a union so more can be added later.
 */
export type InstructionSet = 'AB';

/** A zero-based grid coordinate. Origin is top-left, x = column, y = row. */
export interface GridPos {
  x: number;
  y: number;
}

/** Medal awarded when a run is scored against a level's criteria. */
export type Medal = 'none' | 'bronze' | 'silver' | 'gold';

/** High-level phase of the game screen / loop. */
export type GamePhase = 'building' | 'running' | 'paused' | 'results';

// ---------------------------------------------------------------------------
// Component catalog (static specs)
// ---------------------------------------------------------------------------

/**
 * Static definition of a component kind, stored in the catalog. All placed
 * instances of a given kind share these numbers; per-instance mutable state
 * lives in the simulation snapshots instead.
 *
 * Units:
 * - power in watts (W)
 * - throughput in work-units per tick
 * - temperatures in degrees (°C)
 * - heat values are abstract "heat units" scaled by the level ThermalConfig
 */
export interface ComponentSpec {
  kind: ComponentKind;
  /** Display name, e.g. "CPU". */
  name: string;
  /** Short description shown in the ComponentInfo panel. */
  description: string;
  /** Single glyph / short label used in the grid cell. */
  label: string;

  // --- Power -------------------------------------------------------------
  /** Watts this component supplies to the power network (PSU > 0). */
  powerSupply: number;
  /** Watts this component draws at full (load = 1) operation. */
  powerDraw: number;
  /**
   * Whether this component conducts power to orthogonal neighbours, letting
   * the power-network BFS pass through it. Interface cells (and the PSU as a
   * source) conduct; processors do not.
   */
  conductsPower: boolean;

  // --- Processing --------------------------------------------------------
  /** Instruction set this component can execute (processors only). */
  instructionSet?: InstructionSet;
  /** Work-units produced per tick at full load (processors only). */
  throughput: number;
  /** Clock multiplier applied to throughput and to power draw. */
  clock: number;

  // --- Thermal -----------------------------------------------------------
  /**
   * Fraction (0..1) of the power drawn each tick that is dissipated as waste
   * heat. Heat produced per tick ≈ powerDraw * load * heatLoss * heatScale.
   */
  heatLoss: number;
  /** Degrees added to the maximum tolerable temperature of the cell it sits on (heatsink). */
  maxTempBonus: number;
  /** Heat units actively removed from its cell per tick (fan / heatsink). */
  cooling: number;
  /** Fraction (0..1) of this cell's heat pushed to orthogonal neighbours per tick. */
  spread: number;
  /** Temperature (°C) at or above which this component overheats. */
  maxTemp: number;

  // --- Economy -----------------------------------------------------------
  /** Cost of placing one instance (used when a level defines a budget). */
  cost: number;
}

/** The full component catalog keyed by kind. */
export type Catalog = Record<ComponentKind, ComponentSpec>;

// ---------------------------------------------------------------------------
// Thermal configuration (per level)
// ---------------------------------------------------------------------------

/** Environmental / simulation tuning constants for a level's thermal model. */
export interface ThermalConfig {
  /** Baseline ambient temperature (°C) that empty cells rest at. */
  ambient: number;
  /** Multiplier converting (power * load * heatLoss) into heat units per tick. */
  heatScale: number;
  /** Fraction (0..1) of a cell's above-ambient heat that decays each tick. */
  baselineDissipation: number;
  /** Global fraction (0..1) of heat that spreads outward to the 4 neighbours. */
  neighborSpread: number;
}

// ---------------------------------------------------------------------------
// Tasks & levels (static specs)
// ---------------------------------------------------------------------------

/** The workload a level asks the player's build to execute. */
export interface TaskSpec {
  /** Instruction set the build must be able to run to make progress. */
  instructionSet: InstructionSet;
  /** Total work-units that must be completed for the task to finish. */
  work: number;
  /**
   * Startup latency in ticks before throughput begins contributing work
   * (models pipeline warm-up / memory latency).
   */
  latency: number;
}

/** A component made available in a level's palette, optionally count-limited. */
export interface AvailableComponent {
  kind: ComponentKind;
  /**
   * Maximum number the player may place. Use a large number (or omit via
   * Infinity in data) for effectively unlimited. When a level uses a budget
   * instead, this can act purely as an upper bound.
   */
  count: number;
}

/**
 * A single scoring tier. A run must satisfy *all* thresholds (each metric at
 * or below the listed maximum — lower is better) to earn that tier.
 */
export interface CriteriaTier {
  /** Maximum ticks to complete the task. */
  maxTime: number;
  /** Maximum peak temperature (°C) reached during the run. */
  maxPeakTemp: number;
  /** Maximum peak power draw (W) during the run. */
  maxPower: number;
}

/** Bronze / silver / gold thresholds for a level. */
export interface LevelCriteria {
  bronze: CriteriaTier;
  silver: CriteriaTier;
  gold: CriteriaTier;
}

/** A complete, playable level definition. */
export interface LevelSpec {
  id: string;
  name: string;
  description: string;
  /** Chassis grid dimensions in cells. */
  grid: { width: number; height: number };
  /** The task to run. */
  task: TaskSpec;
  /** Components offered in the palette for this level. */
  available: AvailableComponent[];
  /** Optional money budget; when present, placement is limited by cost. */
  budget?: number;
  /** Thermal tuning for this level. */
  thermal: ThermalConfig;
  /** Medal thresholds. */
  criteria: LevelCriteria;
}

// ---------------------------------------------------------------------------
// Runtime grid / build state
// ---------------------------------------------------------------------------

/** A placed instance of a component on the chassis. */
export interface PlacedComponent {
  /** Unique instance id. */
  id: string;
  kind: ComponentKind;
  pos: GridPos;
}

/** A single chassis cell. */
export interface Cell {
  pos: GridPos;
  /** Id of the component occupying this cell, or null if empty. */
  componentId: string | null;
}

/**
 * Convenience string key for a grid position ("x,y"). Kept as a plain string
 * so it can be used directly as a Record key.
 */
export type CellKey = string;

// ---------------------------------------------------------------------------
// Simulation snapshot state (populated by Task 4)
// ---------------------------------------------------------------------------

/** Power-network solution for the current tick. */
export interface PowerState {
  /** Total watts supplied by all connected PSUs. */
  totalSupply: number;
  /** Total watts demanded by all connected consumers at full load. */
  totalDemand: number;
  /** Global supply/demand ratio, clamped to 0..1 (under-supply reduces load). */
  loadRatio: number;
  /** Whether each component id is reachable from a PSU through the network. */
  connected: Record<string, boolean>;
  /** Watts actually delivered to each component id this tick. */
  supplied: Record<string, number>;
}

/** Thermal field for the current tick, keyed by CellKey. */
export interface ThermalState {
  /** Absolute temperature (°C) at each cell. */
  temp: Record<CellKey, number>;
  /** Effective max tolerable temperature (°C) at each cell (incl. heatsink bonus). */
  maxTemp: Record<CellKey, number>;
}

/** Progress of the level's task. */
export interface TaskProgress {
  workDone: number;
  workTotal: number;
  /** Work-units produced this tick by connected, powered, capable processors. */
  throughput: number;
  /** True once workDone >= workTotal. */
  complete: boolean;
}

/** A full simulation snapshot for one tick. */
export interface SimState {
  /** Current tick index (0-based). */
  tick: number;
  power: PowerState;
  thermal: ThermalState;
  task: TaskProgress;
  /** Highest temperature seen so far this run (°C). */
  peakTemp: number;
  /** Highest total power draw seen so far this run (W). */
  peakPower: number;
  /** True if any component has exceeded its max temperature. */
  overheated: boolean;
}

// ---------------------------------------------------------------------------
// Run result & scoring
// ---------------------------------------------------------------------------

/** Final, scored outcome of a run, compared against level criteria. */
export interface RunResult {
  /** Ticks elapsed when the task completed (or when the run ended). */
  time: number;
  /** Peak temperature reached (°C). */
  peakTemp: number;
  /** Peak power draw reached (W). */
  peakPower: number;
  /** Whether the task's work was fully completed. */
  completed: boolean;
  /** Whether the build overheated during the run. */
  overheated: boolean;
  /** Awarded medal after scoring. */
  medal: Medal;
}

// ---------------------------------------------------------------------------
// Top-level game state
// ---------------------------------------------------------------------------

/** The complete state of a level session, owned by the reducer (Task 3). */
export interface GameState {
  /** The level currently loaded. */
  level: LevelSpec;
  /** All placed components keyed by instance id. */
  components: Record<string, PlacedComponent>;
  /** Cell occupancy: maps CellKey -> component instance id. */
  occupancy: Record<CellKey, string>;
  /** Component kind currently selected in the palette for placement. */
  selectedKind: ComponentKind | null;
  /** Placed component currently selected for inspection. */
  selectedComponentId: string | null;
  /** Current phase of the session. */
  phase: GamePhase;
  /** Live simulation snapshot while running, or null when building. */
  sim: SimState | null;
  /** Final scored result once a run finishes, or null otherwise. */
  result: RunResult | null;
  /**
   * Effective spending cap for this session. In Career Mode this is set to the
   * player's current money (overriding the level's abstract budget) so parts
   * can't be placed beyond what they can afford. `null` means "use the level's
   * own `budget`" (Free Play), preserving the original behaviour.
   */
  budgetOverride: number | null;
}
