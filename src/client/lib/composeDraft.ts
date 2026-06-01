/**
 * Lifted publish-composition draft (feature 005). Owns the body, attribute
 * rows, composition mode, and the pending-copy confirmation so that
 * `MessageReceiver` can hand a received message to `MessagePublisher` across the
 * component tree (FR-009..FR-016). Modeled on `resourceContext.ts`.
 */
import { createContext, useContext, type Dispatch } from 'react';
import type { AttributeRow } from './messaging.js';
import type { DisplayedMessage } from './receivedMessages.js';
import { validateJson, formatJson } from './jsonValidation.js';

export type CompositionMode = 'json' | 'text';

export interface CopyPayload {
  body: string;
  attributes: AttributeRow[];
  mode: CompositionMode;
}

export interface ComposeDraftState {
  mode: CompositionMode;
  body: string;
  attributes: AttributeRow[];
  /** A copy parked awaiting replace-confirmation because the draft is dirty (FR-012). */
  pendingCopy: CopyPayload | null;
}

export type ComposeDraftAction =
  | { type: 'SET_MODE'; mode: CompositionMode }
  | { type: 'SET_BODY'; body: string }
  | { type: 'ADD_ATTRIBUTE' }
  | { type: 'UPDATE_ATTRIBUTE'; index: number; patch: Partial<AttributeRow> }
  | { type: 'REMOVE_ATTRIBUTE'; index: number }
  | { type: 'COPY_TO_PUBLISH'; payload: CopyPayload }
  | { type: 'CONFIRM_COPY' }
  | { type: 'CANCEL_COPY' }
  | { type: 'RESET' };

export const initialComposeDraftState: ComposeDraftState = {
  mode: 'text',
  body: '',
  attributes: [],
  pendingCopy: null,
};

/** A draft is dirty if it holds any unsent body text or attribute rows (FR-012). */
export function isDirty(state: ComposeDraftState): boolean {
  return state.body.length > 0 || state.attributes.length > 0;
}

function applyPayload(state: ComposeDraftState, payload: CopyPayload): ComposeDraftState {
  return {
    ...state,
    mode: payload.mode,
    body: payload.body,
    attributes: payload.attributes,
    pendingCopy: null,
  };
}

export function composeDraftReducer(
  state: ComposeDraftState,
  action: ComposeDraftAction,
): ComposeDraftState {
  switch (action.type) {
    case 'SET_MODE': {
      // FR-007: switching mode preserves body and attributes.
      return { ...state, mode: action.mode };
    }
    case 'SET_BODY': {
      return { ...state, body: action.body };
    }
    case 'ADD_ATTRIBUTE': {
      return { ...state, attributes: [...state.attributes, { key: '', value: '' }] };
    }
    case 'UPDATE_ATTRIBUTE': {
      return {
        ...state,
        attributes: state.attributes.map((row, i) =>
          i === action.index ? { ...row, ...action.patch } : row,
        ),
      };
    }
    case 'REMOVE_ATTRIBUTE': {
      return { ...state, attributes: state.attributes.filter((_, i) => i !== action.index) };
    }
    case 'COPY_TO_PUBLISH': {
      // FR-012: never overwrite a non-empty draft without confirmation — park it.
      return isDirty(state)
        ? { ...state, pendingCopy: action.payload }
        : applyPayload(state, action.payload);
    }
    case 'CONFIRM_COPY': {
      return state.pendingCopy ? applyPayload(state, state.pendingCopy) : state;
    }
    case 'CANCEL_COPY': {
      return { ...state, pendingCopy: null };
    }
    case 'RESET': {
      return initialComposeDraftState;
    }
    default: {
      return state;
    }
  }
}

/**
 * Build a copy payload from a received message (FR-010/FR-011/FR-014):
 * - base64 (binary) payloads are NOT copyable → returns null so the receiver
 *   can disable the action and never load unusable bytes into the editor.
 * - valid-JSON utf-8 → JSON mode, pretty-printed body.
 * - other utf-8 → plain-text mode, raw body.
 * Attributes are mapped to editable rows in both copyable cases.
 */
export function copyPayloadFromMessage(message: DisplayedMessage): CopyPayload | null {
  if (message.dataEncoding === 'base64') {
    return null;
  }
  const attributes: AttributeRow[] = Object.entries(message.attributes).map(([key, value]) => ({
    key,
    value,
  }));
  if (validateJson(message.data).valid) {
    const formatted = formatJson(message.data);
    return {
      mode: 'json',
      body: formatted.ok ? formatted.formatted : message.data,
      attributes,
    };
  }
  return { mode: 'text', body: message.data, attributes };
}

export interface ComposeDraftValue {
  state: ComposeDraftState;
  dispatch: Dispatch<ComposeDraftAction>;
}

export const ComposeDraftContext = createContext<ComposeDraftValue | null>(null);

export function useComposeDraft(): ComposeDraftValue {
  const ctx = useContext(ComposeDraftContext);
  if (ctx === null) {
    throw new Error('useComposeDraft must be used inside ComposeDraftProvider');
  }
  return ctx;
}
