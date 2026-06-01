import { useReducer, type ReactNode } from 'react';
import {
  ComposeDraftContext,
  composeDraftReducer,
  initialComposeDraftState,
} from '../lib/composeDraft.js';

/**
 * Holds the publish-composition draft above both the publish and receive panels
 * so a received message can be copied into the composer (feature 005). Mirrors
 * `ResourceContextProvider`.
 */
export function ComposeDraftProvider({ children }: { children: ReactNode }): JSX.Element {
  const [state, dispatch] = useReducer(composeDraftReducer, initialComposeDraftState);
  return (
    <ComposeDraftContext.Provider value={{ state, dispatch }}>
      {children}
    </ComposeDraftContext.Provider>
  );
}
