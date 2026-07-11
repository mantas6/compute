// The chassis: a CSS-grid of cells sized to the level. Places a palette
// selection on empty cells, selects/removes placed components on occupied
// cells (rules enforced by the reducer). During a run it feeds each cell its
// live temperature and power state for the heat/power overlays.

import { useAppState } from '../game/context';
import { canPlace, cellKey } from '../game/reducer';
import { getSpec } from '../game/catalog';
import type { GridPos } from '../game/types';
import { Cell } from './Cell';
import styles from '../styles/ChassisGrid.module.css';

export function ChassisGrid() {
  const { game } = useAppState();
  if (!game) return null;

  const {
    level,
    occupancy,
    components,
    selectedComponentId,
    selectedKind,
    sim,
    phase,
  } = game;
  const { width, height } = level.grid;
  const building = phase === 'building';
  const showOverlay = (phase === 'running' || phase === 'results') && sim != null;
  const ambient = level.thermal.ambient;

  const cells: React.ReactNode[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pos: GridPos = { x, y };
      const key = cellKey(pos);
      const id = occupancy[key] ?? null;
      const component = id ? components[id] : null;
      const placeable =
        building &&
        !component &&
        selectedKind !== null &&
        canPlace(game, selectedKind, pos);

      // Power indicator: green = live, red = starved. Passive parts that draw
      // no power (heatsink) get no dot; the PSU always reads as live.
      let powered: boolean | null = null;
      if (showOverlay && id && component) {
        const spec = getSpec(component.kind);
        if (spec.powerSupply > 0) {
          powered = true;
        } else if (spec.powerDraw > 0) {
          powered =
            Boolean(sim!.power.connected[id]) && sim!.power.supplied[id] > 0;
        }
      }

      cells.push(
        <Cell
          key={key}
          pos={pos}
          component={component}
          selected={id !== null && id === selectedComponentId}
          placeable={placeable}
          interactive={building}
          showOverlay={showOverlay}
          temp={showOverlay ? sim!.thermal.temp[key] : undefined}
          maxTemp={showOverlay ? sim!.thermal.maxTemp[key] : undefined}
          ambient={ambient}
          powered={powered}
        />,
      );
    }
  }

  return (
    <div className={styles.stage}>
      <div
        className={styles.grid}
        style={{
          gridTemplateColumns: `repeat(${width}, var(--cell-size))`,
          gridTemplateRows: `repeat(${height}, var(--cell-size))`,
        }}
      >
        {cells}
      </div>
    </div>
  );
}
