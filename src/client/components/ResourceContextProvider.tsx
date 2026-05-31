import { useReducer, type ReactNode } from 'react';
import { ResourceContext, resourceContextReducer, initialState } from '../lib/resourceContext.js';

export function ResourceContextProvider({ children }: { children: ReactNode }): JSX.Element {
  const [state, dispatch] = useReducer(resourceContextReducer, initialState);
  return (
    <ResourceContext.Provider value={{ state, dispatch }}>{children}</ResourceContext.Provider>
  );
}
