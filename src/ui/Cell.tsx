// A single chassis cell. Renders any occupying component's glyph and reflects
// selection / placement affordances. Click handling is delegated to the grid
// via the CELL_CLICK action so the interaction rules live in the reducer.

import { getSpec } from '../game/catalog';
import type { GridPos, PlacedComponent } from '../game/types';
import { useDispatch } from '../game/context';
import styles from '../styles/ChassisGrid.module.css';

interface CellProps {
  pos: GridPos;
  component: PlacedComponent | null;
  selected: boolean;
  /** True while a palette kind is selected and this empty cell is placeable. */
  placeable: boolean;
  interactive: boolean;
}

export function Cell({
  pos,
  component,
  selected,
  placeable,
  interactive,
}: CellProps) {
  const dispatch = useDispatch();
  const spec = component ? getSpec(component.kind) : null;

  const classes = [
    styles.cell,
    component ? styles.occupied : styles.empty,
    selected ? styles.selected : '',
    placeable ? styles.placeable : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={classes}
      disabled={!interactive}
      data-kind={component?.kind}
      title={spec ? spec.name : `Cell ${pos.x},${pos.y}`}
      onClick={() => dispatch({ type: 'CELL_CLICK', pos })}
    >
      {spec ? <span className={styles.glyph}>{spec.label}</span> : null}
    </button>
  );
}
