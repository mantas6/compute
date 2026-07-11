// Level select screen: lists every level and lets the player pick one.
// Each card surfaces the chassis size, the task workload, and the full
// bronze/silver/gold criteria so the player can plan before entering a build.

import { LEVELS } from '../game/levels';
import { useDispatch } from '../game/context';
import type { CriteriaTier, Medal } from '../game/types';
import styles from '../styles/LevelSelect.module.css';

const TIERS: { medal: Exclude<Medal, 'none'>; label: string }[] = [
  { medal: 'bronze', label: 'Bronze' },
  { medal: 'silver', label: 'Silver' },
  { medal: 'gold', label: 'Gold' },
];

export function LevelSelect() {
  const dispatch = useDispatch();

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.prompt}>&gt;</span>
          <h1 className={styles.title}>compute</h1>
        </div>
        <p className={styles.subtitle}>
          Place the hardware, route the power, hold the heat — then run the job
          and beat the clock.
        </p>
      </header>

      <ul className={styles.list}>
        {LEVELS.map((level, i) => (
          <li key={level.id}>
            <button
              type="button"
              className={styles.card}
              onClick={() =>
                dispatch({ type: 'SELECT_LEVEL', levelId: level.id })
              }
            >
              <div className={styles.cardHead}>
                <span className={styles.index}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className={styles.name}>{level.name}</span>
                <span className={styles.grid}>
                  {level.grid.width}×{level.grid.height}
                </span>
              </div>

              <p className={styles.desc}>{level.description}</p>

              <dl className={styles.meta}>
                <div>
                  <dt>Work</dt>
                  <dd>{level.task.work}</dd>
                </div>
                <div>
                  <dt>Latency</dt>
                  <dd>{level.task.latency}t</dd>
                </div>
                {level.budget !== undefined && (
                  <div>
                    <dt>Budget</dt>
                    <dd>${level.budget}</dd>
                  </div>
                )}
              </dl>

              <table className={styles.criteria}>
                <thead>
                  <tr>
                    <th aria-label="Tier" />
                    <th>Time</th>
                    <th>Temp</th>
                    <th>Power</th>
                  </tr>
                </thead>
                <tbody>
                  {TIERS.map(({ medal, label }) => {
                    const tier: CriteriaTier = level.criteria[medal];
                    return (
                      <tr key={medal}>
                        <th scope="row" className={styles[`tier_${medal}`]}>
                          <span className={styles.dot} aria-hidden />
                          {label}
                        </th>
                        <td>{tier.maxTime}t</td>
                        <td>{tier.maxPeakTemp}°</td>
                        <td>{tier.maxPower}W</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <span className={styles.enter}>Enter build →</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
