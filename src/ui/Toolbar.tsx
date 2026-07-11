// Toolbar: level name, back button, run/stop controls, a live build summary,
// and — while a run is active — a status strip with the task progress bar and
// live temperature / power readouts.
//
// In Career Mode the summary shows money, the committed build cost, and the
// projected balance, plus a strip of potential payouts and a bankruptcy
// warning when a failed run would leave you unable to afford any progress.

import { useAppState, useDispatch } from '../game/context';
import { countOfKind, powerSummary, spentBudget } from '../game/reducer';
import {
  bankruptcyFloor,
  marginalPayout,
} from '../game/career';
import type { CareerState } from '../game/career';
import type { GameState, Medal } from '../game/types';
import styles from '../styles/Toolbar.module.css';

const PAYOUT_TIERS: Exclude<Medal, 'none'>[] = ['bronze', 'silver', 'gold'];

export function Toolbar() {
  const { game, mode, career } = useAppState();
  const dispatch = useDispatch();
  if (!game) return null;

  const { level, phase, sim } = game;
  const { supply, draw } = powerSummary(game);
  const spent = spentBudget(game);
  const isCareer = mode === 'career' && career != null;
  const hasCpu = countOfKind(game, 'cpu') > 0;
  const hasPsu = countOfKind(game, 'psu') > 0;
  // Career: you must be able to afford the build you're about to commit.
  const affordable = !isCareer || career!.money >= spent;
  const canRun = phase === 'building' && hasPsu && hasCpu && affordable;
  const running = phase === 'running';

  const runTitle = !hasPsu || !hasCpu
    ? 'Add a PSU and a CPU before running'
    : !affordable
      ? "You can't afford this build"
      : isCareer
        ? 'Commit the build cost and run'
        : 'Run the simulation';

  return (
    <header className={styles.header}>
      <div className={styles.bar}>
        <div className={styles.left}>
          <button
            type="button"
            className={styles.back}
            onClick={() => dispatch({ type: 'BACK_TO_LEVELS' })}
          >
            ← Levels
          </button>
          <div className={styles.titleGroup}>
            <span className={styles.name}>{level.name}</span>
            <span className={styles.phase} data-phase={phase}>
              <span className={styles.phaseDot} aria-hidden />
              {phase}
            </span>
          </div>
        </div>

        <div className={styles.stats}>
          {isCareer ? (
            <>
              <Stat label="Money" value={`$${career!.money}`} />
              <Stat label="Build cost" value={`$${spent}`} />
              <Stat
                label="After run"
                value={`$${career!.money - spent}`}
                warn={career!.money - spent < 0}
              />
            </>
          ) : (
            <>
              {level.budget !== undefined && (
                <Stat
                  label="Budget"
                  value={`$${spent} / $${level.budget}`}
                  warn={spent > level.budget}
                />
              )}
              <Stat
                label="Power"
                value={`${draw}W / ${supply}W`}
                warn={draw > supply}
              />
            </>
          )}
        </div>

        <div className={styles.right}>
          {running ? (
            <button
              type="button"
              className={styles.stop}
              onClick={() => dispatch({ type: 'STOP' })}
              title="Abort the run and return to building"
            >
              ■ Stop
            </button>
          ) : (
            <button
              type="button"
              className={styles.run}
              disabled={!canRun}
              onClick={() => dispatch({ type: 'RUN' })}
              title={runTitle}
            >
              ▶ Run
            </button>
          )}
        </div>
      </div>

      {isCareer && phase === 'building' && (
        <CareerStrip game={game} career={career!} spent={spent} />
      )}

      {sim && (phase === 'running' || phase === 'results') && <RunStatus />}
    </header>
  );
}

/**
 * Career build strip: potential payouts for this level (marginal to your best
 * medal) and a warning when committing this build and failing would bankrupt
 * you (parts are never refunded).
 */
function CareerStrip({
  game,
  career,
  spent,
}: {
  game: GameState;
  career: CareerState;
  spent: number;
}) {
  const levelId = game.level.id;
  const best = career.best[levelId] ?? 'none';
  const balanceOnFail = career.money - spent;
  const floor = bankruptcyFloor(career);
  const wouldBankrupt = spent > 0 && balanceOnFail < floor;

  return (
    <div className={styles.careerStrip}>
      <div className={styles.payouts}>
        <span className={styles.payoutsLabel}>Payout</span>
        {PAYOUT_TIERS.map((medal) => {
          const amount = marginalPayout(levelId, best, medal);
          return (
            <span
              key={medal}
              className={`${styles.payout} ${styles[`payout_${medal}`]} ${
                amount === 0 ? styles.payoutZero : ''
              }`}
            >
              {medal[0].toUpperCase()}
              {medal.slice(1)}: {amount > 0 ? `+$${amount}` : '—'}
            </span>
          );
        })}
      </div>
      {wouldBankrupt && (
        <span className={styles.bankruptWarn}>
          ⚠ A failed run bankrupts you — parts aren't refunded.
        </span>
      )}
    </div>
  );
}

function RunStatus() {
  const { game } = useAppState();
  if (!game || !game.sim) return null;
  const { sim } = game;
  const pct =
    sim.task.workTotal > 0
      ? Math.min(100, (sim.task.workDone / sim.task.workTotal) * 100)
      : 0;

  return (
    <div className={styles.status}>
      <div className={styles.progressWrap}>
        <div className={styles.progressLabel}>
          <span>Task</span>
          <span>
            {Math.floor(sim.task.workDone)} / {sim.task.workTotal}
          </span>
        </div>
        <div className={styles.progressTrack}>
          <div
            className={`${styles.progressFill} ${
              sim.task.complete ? styles.progressDone : ''
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <div className={styles.readouts}>
        <Readout label="Tick" value={String(sim.tick)} />
        <Readout
          label="Peak temp"
          value={`${Math.round(sim.peakTemp)}°C`}
          warn={sim.overheated}
        />
        <Readout label="Peak power" value={`${Math.round(sim.peakPower)}W`} />
        <Readout
          label="Throughput"
          value={`${sim.task.throughput.toFixed(1)}/t`}
        />
      </div>
    </div>
  );
}

function Readout({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className={`${styles.readout} ${warn ? styles.readoutWarn : ''}`}>
      <span className={styles.readoutLabel}>{label}</span>
      <span className={styles.readoutValue}>{value}</span>
    </div>
  );
}

function Stat({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className={`${styles.stat} ${warn ? styles.warn : ''}`}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value}</span>
    </div>
  );
}
