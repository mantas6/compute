// App shell: wires the game flow through the reducer/context.
//   Level Select -> Build screen (Toolbar + Palette + ChassisGrid + Info)
//   -> animated Run (RunController drives the sim loop) -> Results overlay.

import { useEffect, useRef } from 'react';
import { GameProvider, useAppState, useDispatch } from './game/context';
import { startRun } from './game/sim/runner';
import { ModeSelect } from './ui/ModeSelect';
import { LevelSelect } from './ui/LevelSelect';
import { Toolbar } from './ui/Toolbar';
import { Palette } from './ui/Palette';
import { ChassisGrid } from './ui/ChassisGrid';
import { ComponentInfo } from './ui/ComponentInfo';
import { ResultsPanel } from './ui/ResultsPanel';
import { CareerEndScreen } from './ui/CareerEndScreen';
import styles from './styles/App.module.css';

/**
 * Drives the animated simulation loop. When the phase transitions to
 * 'running' it starts the runner against the current build snapshot and
 * aborts on cleanup (Stop, finishing, or unmount).
 */
function RunController() {
  const { game } = useAppState();
  const dispatch = useDispatch();
  const phase = game?.phase;

  // Keep a ref to the latest build so the effect can start the run from the
  // current snapshot without re-subscribing to every TICK state change.
  const gameRef = useRef(game);
  gameRef.current = game;

  useEffect(() => {
    if (phase !== 'running') return;
    const g = gameRef.current;
    if (!g) return;
    const abort = startRun(g, dispatch);
    return abort;
  }, [phase, dispatch]);

  return null;
}

function Screen() {
  const { mode, game, career } = useAppState();

  // Mode-select landing screen.
  if (mode === 'menu') {
    return <ModeSelect />;
  }

  // Career game-over / win screens take over the whole view.
  if (mode === 'career' && career && career.status !== 'active') {
    return <CareerEndScreen />;
  }

  // Level select (career or free play) when no session is active.
  if (!game) {
    return <LevelSelect />;
  }

  return (
    <div className={styles.build}>
      <RunController />
      <Toolbar />
      <div className={styles.workspace}>
        <Palette />
        <main className={styles.stage}>
          <ChassisGrid />
        </main>
        <ComponentInfo />
      </div>
      <ResultsPanel />
    </div>
  );
}

export default function App() {
  return (
    <GameProvider>
      <Screen />
    </GameProvider>
  );
}
