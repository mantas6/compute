// Palette: the level's available component catalog as selectable buttons.
// Shows per-kind cost and remaining count; clicking selects a kind for
// placement (click again to deselect). Hover updates the info panel.

import { getSpec } from '../game/catalog';
import { useAppState, useDispatch } from '../game/context';
import {
  countOfKind,
  effectiveBudget,
  limitForKind,
  spentBudget,
} from '../game/reducer';
import styles from '../styles/Palette.module.css';

export function Palette() {
  const { game } = useAppState();
  const dispatch = useDispatch();
  if (!game) return null;

  const { level, selectedKind, phase } = game;
  const building = phase === 'building';
  const budget = effectiveBudget(game);
  const spent = budget !== undefined ? spentBudget(game) : 0;

  return (
    <aside className={styles.palette}>
      <h2 className={styles.heading}>Components</h2>
      <ul className={styles.list}>
        {level.available.map((entry) => {
          const spec = getSpec(entry.kind);
          const used = countOfKind(game, entry.kind);
          const limit = limitForKind(level, entry.kind);
          const remaining = limit - used;
          const overBudget = budget !== undefined && spent + spec.cost > budget;
          const disabled = !building || remaining <= 0 || overBudget;
          const selected = selectedKind === entry.kind;

          return (
            <li key={entry.kind}>
              <button
                type="button"
                data-kind={entry.kind}
                className={`${styles.item} ${selected ? styles.selected : ''}`}
                disabled={disabled}
                title={spec.description}
                onClick={() =>
                  dispatch({
                    type: 'SELECT_KIND',
                    kind: selected ? null : entry.kind,
                  })
                }
              >
                <span className={styles.glyph}>{spec.label}</span>
                <span className={styles.info}>
                  <span className={styles.name}>{spec.name}</span>
                  <span className={styles.sub}>
                    ${spec.cost} · {remaining}/{limit} left
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className={styles.hint}>
        {selectedKind
          ? 'Click an empty cell to place. Click a placed part to select it, again to remove.'
          : 'Pick a component, then click the grid to place it.'}
      </p>
    </aside>
  );
}
