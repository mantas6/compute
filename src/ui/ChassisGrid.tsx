// The chassis: a CSS-grid of cells sized to the level. Places a palette
// selection on empty cells, selects/removes placed components on occupied
// cells (rules enforced by the reducer). Heat/power overlays arrive in Task 4.

import { useAppState } from '../game/context';
import { canPlace, cellKey } from '../game/reducer';
import type { GridPos } from '../game/types';
import { Cell } from './Cell';
import styles from '../styles/ChassisGrid.module.css';

export function ChassisGrid() {
  const { game } = useAppState();
  if (!game) return null;

  const { level, occupancy, components, selectedComponentId, selectedKind } =
    game;
  const { width, height } = level.grid;
  const building = game.phase === 'building';

  const cells: React.ReactNode[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pos: GridPos = { x, y };
      const id = occupancy[cellKey(pos)] ?? null;
      const component = id ? components[id] : null;
      const placeable =
        building &&
        !component &&
        selectedKind !== null &&
        canPlace(game, selectedKind, pos);

      cells.push(
        <Cell
          key={cellKey(pos)}
          pos={pos}
          component={component}
          selected={id !== null && id === selectedComponentId}
          placeable={placeable}
          interactive={building}
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
