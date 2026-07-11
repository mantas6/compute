// Level select: lists every level and lets the player pick one. Each card
// surfaces the chassis size, workload, and full bronze/silver/gold criteria.
//
// In Career Mode it grows a bankroll header, per-level lock/medal state, and a
// payout table; locked levels can't be entered, and the money readout doubles
// as the affordability cap once you enter a build. Free Play is unchanged
// except for a link back to the mode-select screen.

import { LEVELS } from '../game/levels';
import { useAppState, useDispatch } from '../game/context';
import {
  MEDAL_RANK,
  clearedCount,
  economyFor,
  goldCount,
  payoutForMedal,
} from '../game/career';
import type { CareerState } from '../game/career';
import type { CriteriaTier, Medal } from '../game/types';
import styles from '../styles/LevelSelect.module.css';

const TIERS: { medal: Exclude<Medal, 'none'>; label: string }[] = [
  { medal: 'bronze', label: 'Bronze' },
  { medal: 'silver', label: 'Silver' },
  { medal: 'gold', label: 'Gold' },
];

const MEDAL_LABEL: Record<Medal, string> = {
  none: 'Not cleared',
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
};

export function LevelSelect() {
  const { mode, career } = useAppState();
  const dispatch = useDispatch();
  const isCareer = mode === 'career' && career != null;

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.menuLink}
          onClick={() => dispatch({ type: 'BACK_TO_MENU' })}
        >
          ← Menu
        </button>
        <div className={styles.brand}>
          <span className={styles.prompt}>&gt;</span>
          <h1 className={styles.title}>compute</h1>
        </div>
        <p className={styles.subtitle}>
          {isCareer
            ? 'Career campaign — every Run spends real money. Clear levels for payouts and keep the lights on.'
            : 'Place the hardware, route the power, hold the heat — then run the job and beat the clock.'}
        </p>
      </header>

      {isCareer && <CareerHeader career={career!} />}

      <ul className={styles.list}>
        {LEVELS.map((level, i) => {
          const idx = i;
          const locked = isCareer && idx >= career!.unlocked;
          const best: Medal = isCareer
            ? career!.best[level.id] ?? 'none'
            : 'none';
          const econ = isCareer ? economyFor(level.id) : null;

          return (
            <li key={level.id}>
              <button
                type="button"
                className={`${styles.card} ${locked ? styles.locked : ''}`}
                disabled={locked}
                onClick={() =>
                  !locked &&
                  dispatch({ type: 'SELECT_LEVEL', levelId: level.id })
                }
              >
                <div className={styles.cardHead}>
                  <span className={styles.index}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className={styles.name}>{level.name}</span>
                  {isCareer ? (
                    <span
                      className={`${styles.medalBadge} ${
                        styles[`badge_${best}`]
                      }`}
                    >
                      {locked ? 'LOCKED' : MEDAL_LABEL[best]}
                    </span>
                  ) : (
                    <span className={styles.grid}>
                      {level.grid.width}×{level.grid.height}
                    </span>
                  )}
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
                  {isCareer ? (
                    <div>
                      <dt>Min build</dt>
                      <dd>${econ!.minViableCost}</dd>
                    </div>
                  ) : (
                    level.budget !== undefined && (
                      <div>
                        <dt>Budget</dt>
                        <dd>${level.budget}</dd>
                      </div>
                    )
                  )}
                </dl>

                <table className={styles.criteria}>
                  <thead>
                    <tr>
                      <th aria-label="Tier" />
                      <th>Time</th>
                      <th>Temp</th>
                      <th>Power</th>
                      {isCareer && <th>Payout</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {TIERS.map(({ medal, label }) => {
                      const tier: CriteriaTier = level.criteria[medal];
                      const earned =
                        isCareer && MEDAL_RANK[best] >= MEDAL_RANK[medal];
                      return (
                        <tr
                          key={medal}
                          className={earned ? styles.earnedRow : ''}
                        >
                          <th scope="row" className={styles[`tier_${medal}`]}>
                            <span className={styles.dot} aria-hidden />
                            {label}
                          </th>
                          <td>{tier.maxTime}t</td>
                          <td>{tier.maxPeakTemp}°</td>
                          <td>{tier.maxPower}W</td>
                          {isCareer && (
                            <td className={styles.payoutCell}>
                              ${payoutForMedal(level.id, medal)}
                              {earned && (
                                <span
                                  className={styles.earnedMark}
                                  aria-label="earned"
                                >
                                  ✓
                                </span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {isCareer && !locked && (
                  <p className={styles.replayNote}>
                    {best === 'none'
                      ? 'Full payout on first clear.'
                      : best === 'gold'
                        ? 'Maxed — replays pay nothing.'
                        : 'Replays pay only the upgrade difference.'}
                  </p>
                )}

                <span className={styles.enter}>
                  {locked ? 'Clear the previous level' : 'Enter build →'}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CareerHeader({ career }: { career: CareerState }) {
  const dispatch = useDispatch();
  return (
    <div className={styles.careerBar}>
      <div className={styles.bankroll}>
        <span className={styles.bankrollLabel}>Bankroll</span>
        <span className={styles.bankrollValue}>${career.money}</span>
      </div>
      <div className={styles.careerStats}>
        <div>
          <span className={styles.careerStatLabel}>Cleared</span>
          <span className={styles.careerStatValue}>
            {clearedCount(career)}/{LEVELS.length}
          </span>
        </div>
        <div>
          <span className={styles.careerStatLabel}>Gold</span>
          <span className={styles.careerStatValue}>
            {goldCount(career)}/{LEVELS.length}
          </span>
        </div>
      </div>
      <button
        type="button"
        className={styles.abandon}
        onClick={() => {
          if (confirm('Abandon this career? All progress will be erased.')) {
            dispatch({ type: 'ABANDON_CAREER' });
          }
        }}
      >
        Abandon career
      </button>
    </div>
  );
}
