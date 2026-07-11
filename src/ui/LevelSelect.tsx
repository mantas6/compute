// Level select screen: lists every level and lets the player pick one.

import { LEVELS } from '../game/levels';
import { useDispatch } from '../game/context';
import styles from '../styles/LevelSelect.module.css';

export function LevelSelect() {
  const dispatch = useDispatch();

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.title}>compute</h1>
        <p className={styles.subtitle}>
          Build a machine, power it, keep it cool, and finish the job.
        </p>
      </header>

      <ul className={styles.list}>
        {LEVELS.map((level) => (
          <li key={level.id}>
            <button
              type="button"
              className={styles.card}
              onClick={() =>
                dispatch({ type: 'SELECT_LEVEL', levelId: level.id })
              }
            >
              <div className={styles.cardHead}>
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
                {level.budget !== undefined && (
                  <div>
                    <dt>Budget</dt>
                    <dd>${level.budget}</dd>
                  </div>
                )}
                <div>
                  <dt>Gold time</dt>
                  <dd>{level.criteria.gold.maxTime}t</dd>
                </div>
              </dl>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
