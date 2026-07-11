// Toolbar: level name, back button, run button (no-op until Task 4), and a
// live budget / power summary of the current build.

import { useAppState, useDispatch } from '../game/context';
import { countOfKind, powerSummary, spentBudget } from '../game/reducer';
import styles from '../styles/Toolbar.module.css';

export function Toolbar() {
  const { game } = useAppState();
  const dispatch = useDispatch();
  if (!game) return null;

  const { level, phase } = game;
  const { supply, draw } = powerSummary(game);
  const spent = spentBudget(game);
  const hasCpu = countOfKind(game, 'cpu') > 0;
  const hasPsu = countOfKind(game, 'psu') > 0;
  // Run is enabled once there is at least a PSU and a CPU to do work.
  const canRun = phase === 'building' && hasPsu && hasCpu;

  return (
    <header className={styles.bar}>
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
          <span className={styles.phase}>{phase}</span>
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
      </div>
    </header>
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
