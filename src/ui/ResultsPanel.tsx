// Results overlay: shown once a run finishes (phase === 'results'). Presents
// the awarded medal and the run's metrics — time, peak temperature, peak
// power — against each scoring tier, then offers retry / back-to-levels.

import { useAppState, useDispatch } from '../game/context';
import type { CriteriaTier, Medal, RunResult } from '../game/types';
import styles from '../styles/ResultsPanel.module.css';

const MEDAL_LABEL: Record<Medal, string> = {
  none: 'No Medal',
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
};

export function ResultsPanel() {
  const { game } = useAppState();
  const dispatch = useDispatch();
  if (!game || game.phase !== 'results' || !game.result) return null;

  const { result, level } = game;
  const { criteria } = level;

  return (
    <div className={styles.backdrop}>
      <div className={styles.panel} role="dialog" aria-modal>
        <div className={`${styles.medal} ${styles[`medal_${result.medal}`]}`}>
          <span className={styles.medalIcon} aria-hidden>
            {result.medal === 'none' ? '✕' : '★'}
          </span>
          <div>
            <h2 className={styles.medalName}>{MEDAL_LABEL[result.medal]}</h2>
            <p className={styles.outcome}>
              {result.completed
                ? result.overheated
                  ? 'Task complete — but it overheated.'
                  : 'Task complete.'
                : 'Task failed — the job never finished.'}
            </p>
          </div>
        </div>

        <table className={styles.table}>
          <thead>
            <tr>
              <th>Metric</th>
              <th>You</th>
              <th className={styles.bronzeCol}>Bronze</th>
              <th className={styles.silverCol}>Silver</th>
              <th className={styles.goldCol}>Gold</th>
            </tr>
          </thead>
          <tbody>
            <MetricRow
              label="Time"
              value={result.time}
              unit="t"
              result={result}
              pick={(t) => t.maxTime}
              criteria={criteria}
            />
            <MetricRow
              label="Peak temp"
              value={result.peakTemp}
              unit="°C"
              result={result}
              pick={(t) => t.maxPeakTemp}
              criteria={criteria}
            />
            <MetricRow
              label="Peak power"
              value={result.peakPower}
              unit="W"
              result={result}
              pick={(t) => t.maxPower}
              criteria={criteria}
            />
          </tbody>
        </table>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => dispatch({ type: 'BACK_TO_LEVELS' })}
          >
            ← Levels
          </button>
          <button
            type="button"
            className={styles.primary}
            onClick={() => dispatch({ type: 'STOP' })}
          >
            Retry
          </button>
        </div>
      </div>
    </div>
  );
}

function MetricRow({
  label,
  value,
  unit,
  result,
  pick,
  criteria,
}: {
  label: string;
  value: number;
  unit: string;
  result: RunResult;
  pick: (tier: CriteriaTier) => number;
  criteria: { bronze: CriteriaTier; silver: CriteriaTier; gold: CriteriaTier };
}) {
  // A metric "passes" a tier when the run completed and the value is at or
  // below the tier's maximum (all criteria are maximums; lower is better).
  const cell = (tier: CriteriaTier, cls: string) => {
    const threshold = pick(tier);
    const met = result.completed && value <= threshold;
    return (
      <td className={`${cls} ${met ? styles.met : styles.missed}`}>
        <span className={styles.mark} aria-hidden>
          {met ? '✓' : '✕'}
        </span>
        {threshold}
        {unit}
      </td>
    );
  };

  return (
    <tr>
      <th scope="row">{label}</th>
      <td className={styles.you}>
        {value}
        {unit}
      </td>
      {cell(criteria.bronze, styles.bronzeCol)}
      {cell(criteria.silver, styles.silverCol)}
      {cell(criteria.gold, styles.goldCol)}
    </tr>
  );
}
