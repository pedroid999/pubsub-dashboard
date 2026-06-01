import { describe, it, expect } from 'vitest';
import {
  composeDraftReducer,
  initialComposeDraftState,
  isDirty,
  copyPayloadFromMessage,
  type ComposeDraftState,
  type CopyPayload,
} from '../../src/client/lib/composeDraft.js';
import type { DisplayedMessage } from '../../src/client/lib/receivedMessages.js';

function draft(over: Partial<ComposeDraftState> = {}): ComposeDraftState {
  return { ...initialComposeDraftState, ...over };
}

function payload(over: Partial<CopyPayload> = {}): CopyPayload {
  return { body: 'X', attributes: [{ key: 'k', value: 'v' }], mode: 'json', ...over };
}

function received(over: Partial<DisplayedMessage> = {}): DisplayedMessage {
  return {
    messageId: 'm1',
    ackId: 'ack-1',
    data: '{"k":1}',
    dataEncoding: 'utf-8',
    attributes: { eventType: 'x' },
    publishTime: '2026-05-31T10:00:00.000Z',
    deliveryAttempt: 1,
    acknowledged: false,
    ...over,
  };
}

describe('composeDraftReducer', () => {
  it('SET_MODE preserves body and attributes (FR-007)', () => {
    const start = draft({ mode: 'text', body: '{"a":1}', attributes: [{ key: 'k', value: 'v' }] });
    const next = composeDraftReducer(start, { type: 'SET_MODE', mode: 'json' });
    expect(next.mode).toBe('json');
    expect(next.body).toBe('{"a":1}');
    expect(next.attributes).toEqual([{ key: 'k', value: 'v' }]);
  });

  it('SET_BODY replaces the body', () => {
    const next = composeDraftReducer(draft(), { type: 'SET_BODY', body: 'hi' });
    expect(next.body).toBe('hi');
  });

  it('ADD/UPDATE/REMOVE_ATTRIBUTE manage attribute rows', () => {
    let s = composeDraftReducer(draft(), { type: 'ADD_ATTRIBUTE' });
    expect(s.attributes).toEqual([{ key: '', value: '' }]);
    s = composeDraftReducer(s, { type: 'UPDATE_ATTRIBUTE', index: 0, patch: { key: 'a' } });
    expect(s.attributes).toEqual([{ key: 'a', value: '' }]);
    s = composeDraftReducer(s, { type: 'REMOVE_ATTRIBUTE', index: 0 });
    expect(s.attributes).toEqual([]);
  });

  it('COPY_TO_PUBLISH applies immediately on an empty draft', () => {
    const next = composeDraftReducer(draft(), { type: 'COPY_TO_PUBLISH', payload: payload() });
    expect(next.body).toBe('X');
    expect(next.mode).toBe('json');
    expect(next.attributes).toEqual([{ key: 'k', value: 'v' }]);
    expect(next.pendingCopy).toBeNull();
  });

  it('COPY_TO_PUBLISH parks a pendingCopy on a dirty draft without overwriting (FR-012)', () => {
    const start = draft({ body: 'in-progress' });
    const next = composeDraftReducer(start, { type: 'COPY_TO_PUBLISH', payload: payload() });
    expect(next.body).toBe('in-progress'); // not overwritten
    expect(next.pendingCopy).toEqual(payload());
  });

  it('CONFIRM_COPY applies the parked copy then clears it (FR-012)', () => {
    const start = draft({ body: 'in-progress', pendingCopy: payload({ body: 'Y' }) });
    const next = composeDraftReducer(start, { type: 'CONFIRM_COPY' });
    expect(next.body).toBe('Y');
    expect(next.pendingCopy).toBeNull();
  });

  it('CONFIRM_COPY is a no-op when there is nothing parked', () => {
    const start = draft({ body: 'keep' });
    expect(composeDraftReducer(start, { type: 'CONFIRM_COPY' })).toEqual(start);
  });

  it('CANCEL_COPY clears the parked copy without touching the draft (FR-012)', () => {
    const start = draft({ body: 'keep', pendingCopy: payload() });
    const next = composeDraftReducer(start, { type: 'CANCEL_COPY' });
    expect(next.body).toBe('keep');
    expect(next.pendingCopy).toBeNull();
  });

  it('RESET returns the initial state', () => {
    const start = draft({ body: 'x', mode: 'json', attributes: [{ key: 'a', value: 'b' }] });
    expect(composeDraftReducer(start, { type: 'RESET' })).toEqual(initialComposeDraftState);
  });

  it('ignores unknown actions', () => {
    const start = draft({ body: 'x' });
    // @ts-expect-error — exercising the default branch
    expect(composeDraftReducer(start, { type: 'NOPE' })).toEqual(start);
  });
});

describe('isDirty', () => {
  it('is false for an empty draft and true with body or attributes', () => {
    expect(isDirty(initialComposeDraftState)).toBe(false);
    expect(isDirty(draft({ body: 'x' }))).toBe(true);
    expect(isDirty(draft({ attributes: [{ key: 'k', value: 'v' }] }))).toBe(true);
  });
});

describe('copyPayloadFromMessage', () => {
  it('returns null for a binary (base64) payload (FR-014)', () => {
    expect(copyPayloadFromMessage(received({ data: '//79', dataEncoding: 'base64' }))).toBeNull();
  });

  it('loads valid JSON in json mode, pretty-printed (FR-011)', () => {
    const result = copyPayloadFromMessage(received({ data: '{"k":1}' }));
    expect(result).not.toBeNull();
    expect(result?.mode).toBe('json');
    expect(result?.body).toBe('{\n  "k": 1\n}');
    expect(result?.attributes).toEqual([{ key: 'eventType', value: 'x' }]);
  });

  it('loads non-JSON utf-8 in text mode, raw (FR-011)', () => {
    const result = copyPayloadFromMessage(received({ data: 'plain text', attributes: {} }));
    expect(result?.mode).toBe('text');
    expect(result?.body).toBe('plain text');
    expect(result?.attributes).toEqual([]);
  });
});
