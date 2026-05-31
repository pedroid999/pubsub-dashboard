import { createContext, useContext, type Dispatch } from 'react';

export interface ProjectContext {
  selectedTopicName?: string;
  selectedSubscriptionName?: string;
}

export interface ResourceContextState {
  activeProjectId?: string;
  contextMap: Map<string, ProjectContext>;
}

export type ResourceContextAction =
  | { type: 'SELECT_PROJECT'; projectId: string }
  | { type: 'SELECT_TOPIC'; projectId: string; topicName: string }
  | { type: 'DESELECT_TOPIC'; projectId: string }
  | { type: 'SELECT_SUBSCRIPTION'; projectId: string; subscriptionName: string }
  | { type: 'DESELECT_SUBSCRIPTION'; projectId: string }
  | { type: 'NAVIGATE_BACK' };

export const initialState: ResourceContextState = {
  activeProjectId: undefined,
  contextMap: new Map(),
};

export function resourceContextReducer(
  state: ResourceContextState,
  action: ResourceContextAction,
): ResourceContextState {
  switch (action.type) {
    case 'SELECT_PROJECT': {
      const contextMap = new Map(state.contextMap);
      if (!contextMap.has(action.projectId)) {
        contextMap.set(action.projectId, {});
      }
      return { ...state, activeProjectId: action.projectId, contextMap };
    }
    case 'SELECT_TOPIC': {
      const contextMap = new Map(state.contextMap);
      const existing = contextMap.get(action.projectId) ?? {};
      contextMap.set(action.projectId, { ...existing, selectedTopicName: action.topicName });
      return { ...state, contextMap };
    }
    case 'DESELECT_TOPIC': {
      const contextMap = new Map(state.contextMap);
      const existing = contextMap.get(action.projectId) ?? {};
      const { selectedTopicName: _removed, ...rest } = existing;
      contextMap.set(action.projectId, rest);
      return { ...state, contextMap };
    }
    case 'SELECT_SUBSCRIPTION': {
      const contextMap = new Map(state.contextMap);
      const existing = contextMap.get(action.projectId) ?? {};
      contextMap.set(action.projectId, {
        ...existing,
        selectedSubscriptionName: action.subscriptionName,
      });
      return { ...state, contextMap };
    }
    case 'DESELECT_SUBSCRIPTION': {
      const contextMap = new Map(state.contextMap);
      const existing = contextMap.get(action.projectId) ?? {};
      const { selectedSubscriptionName: _removed, ...rest } = existing;
      contextMap.set(action.projectId, rest);
      return { ...state, contextMap };
    }
    case 'NAVIGATE_BACK': {
      return { ...state, activeProjectId: undefined };
    }
    default: {
      return state;
    }
  }
}

export interface ResourceContextValue {
  state: ResourceContextState;
  dispatch: Dispatch<ResourceContextAction>;
}

export const ResourceContext = createContext<ResourceContextValue | null>(null);

export function useResourceContext(): ResourceContextValue {
  const ctx = useContext(ResourceContext);
  if (ctx === null) {
    throw new Error('useResourceContext must be used inside ResourceContextProvider');
  }
  return ctx;
}
