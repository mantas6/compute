// State wiring: `useReducer` + React Context (no external store), per TODO.md.
//
// A single provider owns the reducer state and dispatch; components read them
// through the `useGame` / `useDispatch` hooks. Keeping both on one context is
// fine for a game of this size and avoids prop-drilling through the build UI.

import { createContext, useContext, useReducer } from 'react';
import type { ReactNode } from 'react';
import type { Action, AppState } from './reducer';
import { initialAppState, reducer } from './reducer';

interface GameContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialAppState);
  return (
    <GameContext.Provider value={{ state, dispatch }}>
      {children}
    </GameContext.Provider>
  );
}

function useGameContext(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error('useGame/useDispatch must be used within a <GameProvider>');
  }
  return ctx;
}

/** Read the full app state. */
export function useAppState(): AppState {
  return useGameContext().state;
}

/** Dispatch reducer actions. */
export function useDispatch(): React.Dispatch<Action> {
  return useGameContext().dispatch;
}
