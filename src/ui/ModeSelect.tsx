// Mode-select landing screen: the first thing the player sees. Offers the
// money-driven Career campaign and the original sandbox Free Play. When a
// career is already saved, the Career card surfaces its progress and a
// "Continue" action; otherwise it starts a fresh run.

import { useAppState, useDispatch } from '../game/context';
import { clearedCount, goldCount } from '../game/career';
import { LEVELS } from '../game/levels';
import styles from '../styles/ModeSelect.module.css';

export function ModeSelect() {
  const { career } = useAppState();
  const dispatch = useDispatch();

  const hasActiveCareer = career != null && career.status === 'active';

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.prompt}>&gt;</span>
          <h1 className={styles.title}>compute</h1>
        </div>
        <p className={styles.subtitle}>
          Build the hardware, route the power, hold the heat. Pick how you want
          to play.
        </p>
      </header>

      <div className={styles.cards}>
        {/* --- Career -------------------------------------------------- */}
        <section className={`${styles.card} ${styles.career}`}>
          <div className={styles.cardHead}>
            <span className={styles.badge}>Campaign</span>
            <h2 className={styles.cardTitle}>Career</h2>
          </div>
          <p className={styles.cardDesc}>
            Start with a fixed bankroll. Every Run commits your build cost —
            win or lose. Clear levels for payouts, upgrade medals, and don't go
            broke.
          </p>

          {hasActiveCareer ? (
            <div className={styles.progress}>
              <div className={styles.money}>
                <span className={styles.moneyLabel}>Bankroll</span>
                <span className={styles.moneyValue}>${career!.money}</span>
              </div>
              <div className={styles.progressStats}>
                <span>
                  Cleared {clearedCount(career!)}/{LEVELS.length}
                </span>
                <span>
                  Gold {goldCount(career!)}/{LEVELS.length}
                </span>
              </div>
            </div>
          ) : (
            <div className={styles.progress}>
              <div className={styles.money}>
                <span className={styles.moneyLabel}>Starting bankroll</span>
                <span className={styles.moneyValue}>$400</span>
              </div>
            </div>
          )}

          <div className={styles.actions}>
            {hasActiveCareer ? (
              <>
                <button
                  type="button"
                  className={styles.primary}
                  onClick={() => dispatch({ type: 'SELECT_MODE', mode: 'career' })}
                >
                  Continue →
                </button>
                <button
                  type="button"
                  className={styles.ghost}
                  onClick={() => {
                    if (
                      confirm(
                        'Start a new career? Your current progress will be lost.',
                      )
                    ) {
                      dispatch({ type: 'NEW_CAREER' });
                    }
                  }}
                >
                  New career
                </button>
              </>
            ) : (
              <button
                type="button"
                className={styles.primary}
                onClick={() => dispatch({ type: 'NEW_CAREER' })}
              >
                Start career →
              </button>
            )}
          </div>
        </section>

        {/* --- Free Play ---------------------------------------------- */}
        <section className={`${styles.card} ${styles.freeplay}`}>
          <div className={styles.cardHead}>
            <span className={styles.badge}>Sandbox</span>
            <h2 className={styles.cardTitle}>Free Play</h2>
          </div>
          <p className={styles.cardDesc}>
            Every level unlocked, no economy. Experiment with builds against the
            level budgets and chase bronze, silver, and gold at your own pace.
          </p>
          <div className={styles.progress}>
            <div className={styles.money}>
              <span className={styles.moneyLabel}>Levels open</span>
              <span className={styles.moneyValue}>{LEVELS.length}</span>
            </div>
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primary}
              onClick={() => dispatch({ type: 'SELECT_MODE', mode: 'freeplay' })}
            >
              Free play →
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
