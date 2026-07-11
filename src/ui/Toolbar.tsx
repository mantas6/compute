// Toolbar: level name, back button, run/stop controls, a live build summary,
// and — while a run is active — a status strip with the task progress bar and
// live temperature / power readouts.

import { useAppState, useDispatch } from '../game/context';
import { countOfKind, powerSummary, spentBudget } from '../game/reducer';
import styles from '../styles/Toolbar.module.css';

export function Toolbar() {
  const { game } = useAppState();
  const dispatch = useDispatch();
  if (!game) return null;

  const { level, phase, sim } = game;
  const { supply, draw } = powerSummary(game);
  const spent = spentBudget(game);
  const hasCpu = countOfKind(game, 'cpu') > 0;
  const hasPsu = countOfKind(game, 'psu') > 0;
  // Run is enabled once there is at least a PSU and a CPU to do work.
  const canRun = phase === 'building' && hasPsu && hasCpu;
  const running = phase === 'running';

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
              title={
                canRun
                  ? 'Run the simulation'
                  : 'Add a PSU and a CPU before running'
              }
            >
              ▶ Run
            </button>
          )}
        </div>
      </div>

      {sim && (phase === 'running' || phase === 'results') && (
        <RunStatus />
      )}
    </header>
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
