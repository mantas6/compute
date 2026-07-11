// App shell: wires the game flow through the reducer/context.
//   Level Select -> Build screen (Toolbar + Palette + ChassisGrid + Info).
// The animated Run / Results flow arrives in Task 4.

import { GameProvider, useAppState } from './game/context';
import { LevelSelect } from './ui/LevelSelect';
import { Toolbar } from './ui/Toolbar';
import { Palette } from './ui/Palette';
import { ChassisGrid } from './ui/ChassisGrid';
import { ComponentInfo } from './ui/ComponentInfo';
import styles from './styles/App.module.css';

function Screen() {
  const { game } = useAppState();

  if (!game) {
    return <LevelSelect />;
  }

  return (
    <div className={styles.build}>
      <Toolbar />
      <div className={styles.workspace}>
        <Palette />
        <main className={styles.stage}>
          <ChassisGrid />
        </main>
        <ComponentInfo />
      </div>
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
