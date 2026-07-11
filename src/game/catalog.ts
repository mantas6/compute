// Component catalog: static specs for every placeable component kind.
//
// Values are tuned to be internally consistent with the mechanics described
// in TODO.md and with the level criteria in `levels.ts`:
//
// - A PSU supplies power; consumers (CPU, RAM, Fan) draw power; power flows
//   through the network via `conductsPower` cells (Interface, and the PSU as
//   the source). Under-supply reduces load globally.
// - Heat produced per tick ≈ powerDraw * load * heatLoss * thermal.heatScale.
//   Processors run hot (high heatLoss); cooling parts remove heat and/or raise
//   the tolerable max temperature.
//
// Baseline reference: ambient ~25°C, most consumers tolerate ~85-95°C.

import type { Catalog, ComponentKind, ComponentSpec } from './types';

export const CATALOG: Catalog = {
  // Power Supply Unit — the source of the power network. Conducts power so the
  // BFS can start from it. Draws nothing, runs cool.
  psu: {
    kind: 'psu',
    name: 'PSU',
    description:
      'Power supply. Feeds the network with watts; place Interfaces to route power to processors.',
    label: 'P',
    powerSupply: 120,
    powerDraw: 0,
    conductsPower: true,
    throughput: 0,
    clock: 1,
    heatLoss: 0.05,
    maxTempBonus: 0,
    cooling: 0,
    spread: 0.1,
    maxTemp: 100,
    cost: 40,
  },

  // Interface — passive power conductor. No processing, negligible heat.
  // Cheap connective tile used to bridge the PSU to distant components.
  interface: {
    kind: 'interface',
    name: 'Interface',
    description:
      'Power conduit. Carries power between the PSU and components across the chassis.',
    label: 'I',
    powerSupply: 0,
    powerDraw: 1,
    conductsPower: true,
    throughput: 0,
    clock: 1,
    heatLoss: 0.1,
    maxTempBonus: 0,
    cooling: 0,
    spread: 0.15,
    maxTemp: 100,
    cost: 5,
  },

  // CPU — the workhorse processor. Executes the "AB" instruction set, produces
  // most of the task's throughput, and generates most of the heat.
  cpu: {
    kind: 'cpu',
    name: 'CPU',
    description:
      'Processor executing the AB instruction set. High throughput, but draws a lot of power and runs hot.',
    label: 'C',
    powerSupply: 0,
    powerDraw: 45,
    conductsPower: false,
    instructionSet: 'AB',
    throughput: 12,
    clock: 1,
    heatLoss: 0.85,
    maxTempBonus: 0,
    cooling: 0,
    spread: 0.2,
    maxTemp: 90,
    cost: 60,
  },

  // RAM — working memory. Draws modest power and boosts effective throughput
  // by reducing stalls (interpreted by the task sim); low heat.
  ram: {
    kind: 'ram',
    name: 'RAM',
    description:
      'Working memory. Adds throughput to nearby processors and cuts task latency; light on power and heat.',
    label: 'M',
    powerSupply: 0,
    powerDraw: 10,
    conductsPower: false,
    throughput: 4,
    clock: 1,
    heatLoss: 0.4,
    maxTempBonus: 0,
    cooling: 0,
    spread: 0.15,
    maxTemp: 85,
    cost: 25,
  },

  // Heatsink — passive cooling. Draws no power, raises the tolerable max temp
  // of its cell and gently pulls heat away.
  heatsink: {
    kind: 'heatsink',
    name: 'Heatsink',
    description:
      'Passive cooler. Raises the safe temperature limit of its cell and slowly absorbs heat. No power needed.',
    label: 'H',
    powerSupply: 0,
    powerDraw: 0,
    conductsPower: false,
    throughput: 0,
    clock: 1,
    heatLoss: 0,
    maxTempBonus: 25,
    cooling: 6,
    spread: 0.35,
    maxTemp: 130,
    cost: 20,
  },

  // Fan — active cooling. Draws a little power and exhausts a large amount of
  // heat from its cell each tick.
  fan: {
    kind: 'fan',
    name: 'Fan',
    description:
      'Active cooler. Exhausts heat from its cell every tick. Needs power to spin.',
    label: 'F',
    powerSupply: 0,
    powerDraw: 6,
    conductsPower: false,
    throughput: 0,
    clock: 1,
    heatLoss: 0.2,
    maxTempBonus: 0,
    cooling: 14,
    spread: 0.25,
    maxTemp: 110,
    cost: 30,
  },
};

/** Look up the static spec for a component kind. */
export function getSpec(kind: ComponentKind): ComponentSpec {
  return CATALOG[kind];
}

/** Stable palette ordering for UI (source, conduit, processing, cooling). */
export const CATALOG_ORDER: ComponentKind[] = [
  'psu',
  'interface',
  'cpu',
  'ram',
  'heatsink',
  'fan',
];
