import type { ReceivedMessage } from '../../server/schemas/messaging.js';

export interface DisplayedMessage extends ReceivedMessage {
  /** View flag: set true after a successful explicit acknowledge (FR-019). */
  acknowledged: boolean;
}

export interface ReceivedMessagesState {
  items: DisplayedMessage[];
}

export type ReceivedMessagesAction =
  | { type: 'APPEND'; messages: ReceivedMessage[] }
  | { type: 'CLEAR' }
  | { type: 'MARK_ACKNOWLEDGED'; ackId: string };

export const initialReceivedMessagesState: ReceivedMessagesState = { items: [] };

/**
 * Running-list reducer for pulled messages (FR-026 / US2 AS7/AS8). APPEND
 * concatenates a new pull onto the existing list (never dropping items, never
 * destructively de-duplicating redeliveries); CLEAR empties the list; and
 * MARK_ACKNOWLEDGED flags a message by ackId, leaving it visible (FR-019).
 */
export function receivedMessagesReducer(
  state: ReceivedMessagesState,
  action: ReceivedMessagesAction,
): ReceivedMessagesState {
  switch (action.type) {
    case 'APPEND': {
      const appended = action.messages.map((m) => ({ ...m, acknowledged: false }));
      return { items: [...state.items, ...appended] };
    }
    case 'CLEAR': {
      return { items: [] };
    }
    case 'MARK_ACKNOWLEDGED': {
      return {
        items: state.items.map((m) =>
          m.ackId === action.ackId ? { ...m, acknowledged: true } : m,
        ),
      };
    }
    default: {
      return state;
    }
  }
}
