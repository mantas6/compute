// Career end screens: BANKRUPT (game over) and CAREER COMPLETE (all gold).
// Both present a run summary — levels cleared, medals earned, and the money
// history — and offer a fresh start. Styled to the dark PCB / terminal theme.

import { useAppState, useDispatch } from '../game/context';
import { LEVELS } from '../game/levels';
import { clearedCount, goldCount } from '../game/career';
import type { CareerState } from '../game/career';
import type { Medal } from '../game/types';
import styles from '../styles/CareerEndScreen.module.css';

const MEDAL_GLYPH: Record<Medal, string> = {
  none: '·',
  bronze: '●',
  silver: '●',
  gold: '★',
};

export function CareerEndScreen() {
  const { career } = useAppState();
  const dispatch = useDispatch();
  if (!career) return null;

  const bankrupt = career.status === 'bankrupt';

  return (
    <div className={styles.screen} data-kind={bankrupt ? 'bankrupt' : 'complete'}>
      <div className={styles.panel}>
        <p className={styles.eyebrow}>
          {bankrupt ? 'system halt' : 'all objectives met'}
        </p>
        <h1 className={`${styles.title} ${bankrupt ? styles.bad : styles.win}`}>
          {bankrupt ? 'BANKRUPT' : 'CAREER COMPLETE'}
        </h1>
        <p className={styles.tagline}>
          {bankrupt
            ? "You can no longer afford a viable build. The bench goes dark."
            : 'Gold on every level. The rack hums, flawless. Masterful work.'}
        </p>

        <div className={styles.summary}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Final money</span>
            <span className={styles.statValue}>${career.money}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Levels cleared</span>
            <span className={styles.statValue}>
              {clearedCount(career)}/{LEVELS.length}
            </span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Gold medals</span>
            <span className={styles.statValue}>
              {goldCount(career)}/{LEVELS.length}
            </span>
          </div>
        </div>

        <ul className={styles.medals}>
          {LEVELS.map((level) => {
            const m: Medal = career.best[level.id] ?? 'none';
            return (
              <li key={level.id} className={styles.medalRow}>
                <span className={`${styles.glyph} ${styles[`m_${m}`]}`}>
                  {MEDAL_GLYPH[m]}
                </span>
                <span className={styles.levelName}>{level.name}</span>
                <span className={`${styles.medalTag} ${styles[`m_${m}`]}`}>
                  {m === 'none' ? '—' : m}
                </span>
              </li>
            );
          })}
        </ul>

        <MoneyHistory career={career} />

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => dispatch({ type: 'ABANDON_CAREER' })}
          >
            ← Menu
          </button>
          <button
            type="button"
            className={styles.primary}
            onClick={() => dispatch({ type: 'NEW_CAREER' })}
          >
            Start new career →
          </button>
        </div>
      </div>
    </div>
  );
}

/** A compact sparkline-ish readout of the money balance after each run. */
function MoneyHistory({ career }: { career: CareerState }) {
  const history = career.moneyHistory;
  if (history.length < 2) return null;
  const max = Math.max(...history, 1);

  return (
    <div className={styles.history}>
      <span className={styles.historyLabel}>Balance history</span>
      <div className={styles.bars}>
        {history.map((v, i) => (
          <span
            key={i}
            className={styles.bar}
            style={{ height: `${Math.max(4, (Math.max(0, v) / max) * 100)}%` }}
            title={`$${v}`}
          />
        ))}
      </div>
    </div>
  );
}
