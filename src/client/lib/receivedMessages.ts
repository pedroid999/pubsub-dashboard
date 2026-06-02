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
 * Cap on the running received-message list (feature 006 / FR-020). Appending
 * beyond this keeps the 60 newest and drops the oldest, bounding memory and DOM
 * under the opt-in 2.5 s auto-poll (US7).
 */
export const MAX_RECEIVED_MESSAGES = 60;

/**
 * Running-list reducer for pulled messages (FR-026 / US2 AS7/AS8). APPEND
 * concatenates a new pull onto the existing list (never destructively
 * de-duplicating redeliveries) and caps it at the {@link MAX_RECEIVED_MESSAGES}
 * newest (FR-020); CLEAR empties the list; and MARK_ACKNOWLEDGED flags a message
 * by ackId, leaving it visible (FR-019).
 */
export function receivedMessagesReducer(
  state: ReceivedMessagesState,
  action: ReceivedMessagesAction,
): ReceivedMessagesState {
  switch (action.type) {
    case 'APPEND': {
      const appended = action.messages.map((m) => ({ ...m, acknowledged: false }));
      const combined = [...state.items, ...appended];
      // Keep only the newest MAX_RECEIVED_MESSAGES (newest are at the tail).
      const items =
        combined.length > MAX_RECEIVED_MESSAGES
          ? combined.slice(combined.length - MAX_RECEIVED_MESSAGES)
          : combined;
      return { items };
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
