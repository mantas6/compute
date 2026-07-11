# compute — Hardware-Building Puzzle Game

A build-and-simulate puzzle game based on
[unknown-prototype/Ideas.md](https://github.com/mantas6/unknown-prototype/blob/master/Ideas.md).
Place components on a grid chassis, get power flowing, keep heat under control,
run a task, and hit each level's criteria (bronze/silver/gold).

## Stack
- Vite + React + TypeScript
- Plain CSS Modules
- State via `useReducer` + Context (no external store)
- DOM CSS-grid chassis with heat/power color overlays

## Project structure
```
compute/
  index.html, package.json, tsconfig.json, vite.config.ts
  src/
    main.tsx, App.tsx
    game/
      types.ts          # Block, Component, Cell, GameState types
      catalog.ts        # component specs (CPU, RAM, Interface, PSU, Heatsink, Fan)
      levels.ts         # 2-3 levels + criteria thresholds
      reducer.ts        # place/remove/select/run actions
      sim/
        power.ts        # PSU -> interface connectivity -> component supply
        thermal.ts      # per-tick heat generation, spread, dissipation
        tasks.ts        # task progress from throughput + latency
        runner.ts       # tick loop orchestrating the above
    ui/
      LevelSelect.tsx, Toolbar.tsx, Palette.tsx,
      ChassisGrid.tsx, Cell.tsx, ComponentInfo.tsx,
      ResultsPanel.tsx
    styles/*.css
```

## Mechanics (vertical slice)
- **Interaction:** click component in palette -> click cell to place -> click again
  to remove; selection shows stats.
- **Power:** PSU -> BFS through Interface cells -> components draw by clock/load;
  under-supply reduces load.
- **Thermal:** per-tick heat gen proportional to power x loss, spread % to 4
  neighbors, baseline dissipation, Heatsink raises max, Fan exhausts; overheat =
  fail/penalty.
- **Tasks:** required instruction set + work + latency; progress from connected
  powered processors' throughput.
- **Scoring:** time / peak temp / power -> bronze/silver/gold per level.
- **Sim feel:** animated tick loop (~1-3s) with live overlays + progress bar.

## Simplifications (confirmed for slice)
- Interfaces placed on cells (not between-block gaps).
- No heat pipes.
- Single task / single instruction set (CPU AB).
- Durability tracked as simple overheat penalty, not full wear model.

## Gameplay flow
Level Select -> Build -> Run (animated) -> Results vs criteria (medal) -> back.

## Deployment (GitHub Pages)
- Pages URL: https://mantas6.github.io/compute/
- `vite.config.ts`: `base: '/compute/'`
- `.github/workflows/deploy.yml`: push to `master` -> `npm ci` -> `npm run build`
  -> `actions/upload-pages-artifact` -> `actions/deploy-pages`
  (permissions `pages: write`, `id-token: write`).
- Enable Pages "GitHub Actions" source.
- `gh repo edit mantas6/compute --description "..." --homepage "https://mantas6.github.io/compute/"`

## Build order / tasks
- [ ] 1. Scaffold Vite React-TS project + config (incl. `base`)
- [ ] 2. Types + component catalog + levels
- [ ] 3. Grid model + reducer + UI (LevelSelect, Toolbar, Palette, ChassisGrid/Cell, ComponentInfo)
- [ ] 4. Simulation (power -> thermal -> tasks -> runner tick loop) + overlays + ResultsPanel
- [ ] 5. Wire full flow, polish visuals
- [ ] 6. Add Pages workflow, set `base`, commit/push, set repo description + homepage
