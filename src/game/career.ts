// Career Mode economy (Task: Career Mode).
//
// Career Mode layers a money-based campaign on top of the existing levels.
// The player starts with a fixed bankroll, commits their build cost every time
// they press Run (win or lose), and earns medal-based payouts. Running out of
// money to afford a viable build is a game over (bankruptcy); a gold on every
// level is a win.
//
// -------------------------------------------------------------------------
// Balancing (derived from headless-sim runs of representative builds, the
// same approach Task 4 used to tune the criteria):
//
//   Cheapest build that still earns *bronze* per level (the "min viable kit"):
//     first-boot        $100   (bare PSU + CPU already clears bronze)
//     thermal-throttle  $150   (CPU + one fan + one heatsink)
//     full-rack         $280   (two spread CPUs + heavy cooling)
//
//   Starting bankroll: $400. Payouts form a ladder that keeps a *competent
//   bronze-path* player comfortably solvent while making sloppy, expensive
//   failures punishing:
//
//     bronze-path cash trace from $400 (spend a safe kit, collect bronze):
//       L1: -130 -> 270, +180 -> 450
//       L2: -150 -> 300, +320 -> 620
//       L3: -300 -> 320, +520 -> 840
//     => never approaches the bankruptcy floor on the safe path.
//
//   Every payout comfortably exceeds its level's min viable cost, so progress
//   is always net-positive when you succeed. But a failed run refunds nothing:
//   an expensive dud on the Full Rack (~$450 sunk, $0 back) is a huge hit, and
//   2-3 such careless runs will bankrupt you.
//
//   Replays pay only the *marginal* difference to your best prior medal, so you
//   can still profit from upgrading bronze -> gold, but you can't farm a solved
//   level for infinite cash (same-or-worse medal pays $0 yet still costs the
//   build).
// -------------------------------------------------------------------------

import type { Medal } from './types';
import { LEVELS } from './levels';

/** Versioned localStorage key so the schema can evolve without clashes. */
export const CAREER_STORAGE_KEY = 'compute.career.v1';

/** Bankroll a fresh career starts with. */
export const STARTING_MONEY = 400;

/** Payout for first reaching each medal tier on a level. */
export interface MedalPayouts {
  bronze: number;
  silver: number;
  gold: number;
}

/** Per-level economy tuning. */
export interface LevelEconomy {
  /**
   * Cheapest build (found via a headless-sim search) that still earns bronze.
   * Used as the affordability floor for the bankruptcy check.
   */
  minViableCost: number;
  /** Payout ladder; replays award only the marginal increase (see below). */
  payouts: MedalPayouts;
}

export const CAREER_ECONOMY: Record<string, LevelEconomy> = {
  'first-boot': {
    minViableCost: 100,
    payouts: { bronze: 180, silver: 240, gold: 300 },
  },
  'thermal-throttle': {
    minViableCost: 150,
    payouts: { bronze: 320, silver: 420, gold: 520 },
  },
  'full-rack': {
    minViableCost: 280,
    payouts: { bronze: 520, silver: 680, gold: 850 },
  },
};

/** Fallback economy for any level missing an explicit entry. */
const DEFAULT_ECONOMY: LevelEconomy = {
  minViableCost: 120,
  payouts: { bronze: 200, silver: 280, gold: 360 },
};

export function economyFor(levelId: string): LevelEconomy {
  return CAREER_ECONOMY[levelId] ?? DEFAULT_ECONOMY;
}

// ---------------------------------------------------------------------------
// Medal helpers
// ---------------------------------------------------------------------------

export const MEDAL_RANK: Record<Medal, number> = {
  none: 0,
  bronze: 1,
  silver: 2,
  gold: 3,
};

/** The higher of two medals. */
export function betterMedal(a: Medal, b: Medal): Medal {
  return MEDAL_RANK[a] >= MEDAL_RANK[b] ? a : b;
}

/** Absolute payout for holding a given medal on a level. */
export function payoutForMedal(levelId: string, medal: Medal): number {
  if (medal === 'none') return 0;
  return economyFor(levelId).payouts[medal];
}

/**
 * Payout actually awarded when a run scores `next` while the best prior medal
 * was `prev` — the marginal difference, never negative. Same-or-worse pays $0.
 */
export function marginalPayout(levelId: string, prev: Medal, next: Medal): number {
  return Math.max(
    0,
    payoutForMedal(levelId, next) - payoutForMedal(levelId, prev),
  );
}

// ---------------------------------------------------------------------------
// Career state
// ---------------------------------------------------------------------------

export type CareerStatus = 'active' | 'bankrupt' | 'complete';

/** Economics of the most recently committed run, for the Results overlay. */
export interface LastRunEconomy {
  levelId: string;
  /** Build cost committed at Run (deducted, never refunded). */
  cost: number;
  /** Payout received (marginal; 0 if failed or no improvement). */
  payout: number;
  medalBefore: Medal;
  medalAfter: Medal;
  /** Money before the cost was committed. */
  moneyBefore: number;
  /** Money after cost + payout were applied. */
  moneyAfter: number;
  /** True if this run unlocked the next level. */
  unlockedNew: boolean;
}

/** Set when a run is committed (Run pressed); consumed at Finish/Stop. */
export interface PendingRun {
  levelId: string;
  cost: number;
  medalBefore: Medal;
  moneyBefore: number;
}

export interface CareerState {
  /** Current bankroll. */
  money: number;
  /** Best medal earned per level id. */
  best: Record<string, Medal>;
  /** Number of unlocked levels (indices 0 .. unlocked-1 in LEVELS). */
  unlocked: number;
  status: CareerStatus;
  /** Money after each committed run, for the end-screen summary. */
  moneyHistory: number[];
  /** Result of the last committed run (for the Results overlay). */
  lastRun: LastRunEconomy | null;
  /** In-flight committed run, or null. */
  pending: PendingRun | null;
}

/** A brand-new career at full bankroll with only the first level unlocked. */
export function newCareer(): CareerState {
  const best: Record<string, Medal> = {};
  for (const l of LEVELS) best[l.id] = 'none';
  return {
    money: STARTING_MONEY,
    best,
    unlocked: 1,
    status: 'active',
    moneyHistory: [STARTING_MONEY],
    lastRun: null,
    pending: null,
  };
}

// ---------------------------------------------------------------------------
// Derived queries
// ---------------------------------------------------------------------------

/** Levels cleared at bronze or better. */
export function clearedCount(career: CareerState): number {
  return LEVELS.reduce(
    (n, l) => n + (MEDAL_RANK[career.best[l.id] ?? 'none'] >= 1 ? 1 : 0),
    0,
  );
}

/** Count of gold medals earned. */
export function goldCount(career: CareerState): number {
  return LEVELS.reduce(
    (n, l) => n + (career.best[l.id] === 'gold' ? 1 : 0),
    0,
  );
}

/** True when every level is gold. */
export function isComplete(career: CareerState): boolean {
  return LEVELS.every((l) => career.best[l.id] === 'gold');
}

/**
 * The cheapest viable build cost among unlocked levels that still have upside
 * (not yet gold). If money drops below this you can no longer afford to make
 * progress anywhere and the career is bankrupt. Returns 0 when nothing is left
 * to improve (career complete), which can never trigger bankruptcy.
 */
export function bankruptcyFloor(career: CareerState): number {
  let floor = Infinity;
  LEVELS.forEach((l, i) => {
    if (i >= career.unlocked) return;
    if (MEDAL_RANK[career.best[l.id] ?? 'none'] >= MEDAL_RANK.gold) return;
    floor = Math.min(floor, economyFor(l.id).minViableCost);
  });
  return floor === Infinity ? 0 : floor;
}

// ---------------------------------------------------------------------------
// Persistence (localStorage; called from the context effect / lazy init)
// ---------------------------------------------------------------------------

/** Load a saved career, or null if none / corrupt / unavailable. */
export function loadCareer(): CareerState | null {
  try {
    const raw = localStorage.getItem(CAREER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CareerState>;
    if (typeof parsed.money !== 'number' || typeof parsed.best !== 'object') {
      return null;
    }
    const fresh = newCareer();
    const best: Record<string, Medal> = {};
    for (const l of LEVELS) best[l.id] = parsed.best?.[l.id] ?? 'none';
    return {
      ...fresh,
      ...parsed,
      best,
      // A run should never be considered "in flight" across a reload.
      pending: null,
      moneyHistory: Array.isArray(parsed.moneyHistory)
        ? parsed.moneyHistory
        : fresh.moneyHistory,
    };
  } catch {
    return null;
  }
}

/** Persist (or clear, when null) the career. Silently ignores storage errors. */
export function saveCareer(career: CareerState | null): void {
  try {
    if (career) {
      localStorage.setItem(CAREER_STORAGE_KEY, JSON.stringify(career));
    } else {
      localStorage.removeItem(CAREER_STORAGE_KEY);
    }
  } catch {
    /* storage unavailable (private mode / quota) — ignore */
  }
}
