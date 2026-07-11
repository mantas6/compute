// State wiring: `useReducer` + React Context (no external store), per TODO.md.
//
// A single provider owns the reducer state and dispatch; components read them
// through the `useGame` / `useDispatch` hooks. Keeping both on one context is
// fine for a game of this size and avoids prop-drilling through the build UI.

import { createContext, useContext, useEffect, useReducer } from 'react';
import type { ReactNode } from 'react';
import type { Action, AppState } from './reducer';
import { initialAppState, reducer } from './reducer';
import { loadCareer, saveCareer } from './career';

interface GameContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const GameContext = createContext<GameContextValue | null>(null);

/** Seed the reducer with any career persisted from a previous session. */
function init(): AppState {
  return { ...initialAppState, career: loadCareer() };
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, init);

  // Write-through persistence: mirror the career slice to localStorage
  // whenever it changes (including clearing it on abandon).
  useEffect(() => {
    saveCareer(state.career);
  }, [state.career]);

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
