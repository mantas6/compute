// A single chassis cell. Renders any occupying component's glyph and reflects
// selection / placement affordances. During a run it also paints a heat color
// overlay (ambient -> red) and a powered / unpowered indicator. Click handling
// is delegated to the grid via the CELL_CLICK action so the interaction rules
// live in the reducer.

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
  /** Whether to paint the run overlays (heat + power). */
  showOverlay: boolean;
  /** Current temperature (°C) at this cell, when a run is active. */
  temp?: number;
  /** Effective max temperature (°C) at this cell. */
  maxTemp?: number;
  /** Ambient baseline (°C) for heat normalization. */
  ambient?: number;
  /** Power state for an occupied cell: true powered, false starved, null empty. */
  powered?: boolean | null;
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** Inline background for the heat overlay: transparent when cool -> red hot. */
function heatStyle(
  temp: number,
  maxTemp: number,
  ambient: number,
): React.CSSProperties {
  const span = Math.max(1, maxTemp - ambient);
  const r = clamp01((temp - ambient) / span);
  if (r < 0.03) return { opacity: 0 };
  // 55° (warm amber) -> 0° (hot red), deepening as the cell approaches its max.
  const hue = 55 - 55 * r;
  const alpha = 0.14 + 0.62 * r;
  return { backgroundColor: `hsla(${hue}, 92%, 52%, ${alpha})`, opacity: 1 };
}

export function Cell({
  pos,
  component,
  selected,
  placeable,
  interactive,
  showOverlay,
  temp,
  maxTemp,
  ambient,
  powered,
}: CellProps) {
  const dispatch = useDispatch();
  const spec = component ? getSpec(component.kind) : null;

  const overheating =
    showOverlay &&
    component != null &&
    temp !== undefined &&
    maxTemp !== undefined &&
    temp > maxTemp;

  const classes = [
    styles.cell,
    component ? styles.occupied : styles.empty,
    selected ? styles.selected : '',
    placeable ? styles.placeable : '',
    overheating ? styles.overheating : '',
  ]
    .filter(Boolean)
    .join(' ');

  const showHeat =
    showOverlay &&
    temp !== undefined &&
    maxTemp !== undefined &&
    ambient !== undefined;

  return (
    <button
      type="button"
      className={classes}
      disabled={!interactive}
      data-kind={component?.kind}
      title={
        spec
          ? showOverlay && temp !== undefined
            ? `${spec.name} · ${Math.round(temp)}°C`
            : spec.name
          : `Cell ${pos.x},${pos.y}`
      }
      onClick={() => dispatch({ type: 'CELL_CLICK', pos })}
    >
      {showHeat && (
        <span
          className={styles.heat}
          style={heatStyle(temp, maxTemp, ambient)}
          aria-hidden
        />
      )}
      {spec ? <span className={styles.glyph}>{spec.label}</span> : null}
      {showOverlay && component && powered != null && (
        <span
          className={`${styles.power} ${powered ? styles.powered : styles.starved}`}
          aria-hidden
        />
      )}
    </button>
  );
}
