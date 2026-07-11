// Stats panel. Shows the spec for the currently selected placed component,
// falling back to the palette-selected kind. Empty otherwise.

import { getSpec } from '../game/catalog';
import type { ComponentKind } from '../game/types';
import { useAppState } from '../game/context';
import styles from '../styles/ComponentInfo.module.css';

export function ComponentInfo() {
  const { game } = useAppState();
  if (!game) return null;

  const selectedPlaced = game.selectedComponentId
    ? game.components[game.selectedComponentId]
    : null;

  const kind: ComponentKind | null =
    selectedPlaced?.kind ?? game.selectedKind ?? null;

  if (!kind) {
    return (
      <aside className={styles.panel}>
        <h2 className={styles.heading}>Details</h2>
        <p className={styles.empty}>
          Select a component from the palette or the grid to inspect its stats.
        </p>
      </aside>
    );
  }

  const spec = getSpec(kind);
  const isProcessor = spec.throughput > 0;

  return (
    <aside className={styles.panel}>
      <div className={styles.title}>
        <span className={styles.glyph} data-kind={kind}>
          {spec.label}
        </span>
        <div>
          <h2 className={styles.heading}>{spec.name}</h2>
          <span className={styles.tag}>
            {selectedPlaced ? 'Placed' : 'Palette'}
          </span>
        </div>
      </div>

      <p className={styles.desc}>{spec.description}</p>

      <dl className={styles.stats}>
        {spec.powerSupply > 0 && (
          <Row label="Power supply" value={`${spec.powerSupply} W`} />
        )}
        {spec.powerDraw > 0 && (
          <Row label="Power draw" value={`${spec.powerDraw} W`} />
        )}
        <Row label="Conducts power" value={spec.conductsPower ? 'Yes' : 'No'} />
        {isProcessor && (
          <>
            <Row label="Instruction set" value={spec.instructionSet ?? '—'} />
            <Row label="Throughput" value={`${spec.throughput}/tick`} />
            <Row label="Clock" value={`×${spec.clock}`} />
          </>
        )}
        <Row label="Heat loss" value={`${Math.round(spec.heatLoss * 100)}%`} />
        {spec.cooling > 0 && (
          <Row label="Cooling" value={`${spec.cooling}/tick`} />
        )}
        {spec.maxTempBonus > 0 && (
          <Row label="Max temp bonus" value={`+${spec.maxTempBonus}°C`} />
        )}
        <Row label="Max temp" value={`${spec.maxTemp}°C`} />
        <Row label="Cost" value={`$${spec.cost}`} />
      </dl>
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.row}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
