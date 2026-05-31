import { describe, it, expect, vi } from 'vitest';
import {
  resourceContextReducer,
  initialState,
  type ResourceContextState,
} from '../../src/client/lib/resourceContext.js';

function fresh(): ResourceContextState {
  return { activeProjectId: undefined, contextMap: new Map() };
}

describe('resourceContextReducer', () => {
  describe('SELECT_PROJECT', () => {
    it('sets activeProjectId', () => {
      const next = resourceContextReducer(fresh(), {
        type: 'SELECT_PROJECT',
        projectId: 'proj-a',
      });
      expect(next.activeProjectId).toBe('proj-a');
    });

    it('creates an empty context entry for a new project', () => {
      const next = resourceContextReducer(fresh(), {
        type: 'SELECT_PROJECT',
        projectId: 'proj-a',
      });
      expect(next.contextMap.has('proj-a')).toBe(true);
      expect(next.contextMap.get('proj-a')).toEqual({});
    });

    it('does not overwrite an existing context entry', () => {
      const state: ResourceContextState = {
        activeProjectId: undefined,
        contextMap: new Map([['proj-a', { selectedTopicName: 'topics/t1' }]]),
      };
      const next = resourceContextReducer(state, {
        type: 'SELECT_PROJECT',
        projectId: 'proj-a',
      });
      expect(next.contextMap.get('proj-a')).toEqual({ selectedTopicName: 'topics/t1' });
    });
  });

  describe('SELECT_TOPIC', () => {
    it('stores selectedTopicName for the given project', () => {
      const state = resourceContextReducer(fresh(), {
        type: 'SELECT_PROJECT',
        projectId: 'proj-a',
      });
      const next = resourceContextReducer(state, {
        type: 'SELECT_TOPIC',
        projectId: 'proj-a',
        topicName: 'projects/proj-a/topics/payments',
      });
      expect(next.contextMap.get('proj-a')?.selectedTopicName).toBe(
        'projects/proj-a/topics/payments',
      );
    });

    it('does not affect other projects', () => {
      const s0 = resourceContextReducer(fresh(), {
        type: 'SELECT_PROJECT',
        projectId: 'proj-a',
      });
      const s1 = resourceContextReducer(s0, {
        type: 'SELECT_PROJECT',
        projectId: 'proj-b',
      });
      const s2 = resourceContextReducer(s1, {
        type: 'SELECT_TOPIC',
        projectId: 'proj-a',
        topicName: 'topics/t1',
      });
      expect(s2.contextMap.get('proj-b')?.selectedTopicName).toBeUndefined();
    });
  });

  describe('DESELECT_TOPIC', () => {
    it('removes selectedTopicName while preserving other fields', () => {
      const state: ResourceContextState = {
        activeProjectId: 'proj-a',
        contextMap: new Map([
          ['proj-a', { selectedTopicName: 'topics/t1', selectedSubscriptionName: 'subs/s1' }],
        ]),
      };
      const next = resourceContextReducer(state, {
        type: 'DESELECT_TOPIC',
        projectId: 'proj-a',
      });
      const ctx = next.contextMap.get('proj-a');
      expect(ctx?.selectedTopicName).toBeUndefined();
      expect(ctx?.selectedSubscriptionName).toBe('subs/s1');
    });
  });

  describe('SELECT_SUBSCRIPTION', () => {
    it('stores selectedSubscriptionName for the given project', () => {
      const state = resourceContextReducer(fresh(), {
        type: 'SELECT_PROJECT',
        projectId: 'proj-a',
      });
      const next = resourceContextReducer(state, {
        type: 'SELECT_SUBSCRIPTION',
        projectId: 'proj-a',
        subscriptionName: 'projects/proj-a/subscriptions/payments-sub',
      });
      expect(next.contextMap.get('proj-a')?.selectedSubscriptionName).toBe(
        'projects/proj-a/subscriptions/payments-sub',
      );
    });
  });

  describe('DESELECT_SUBSCRIPTION', () => {
    it('removes selectedSubscriptionName while preserving other fields', () => {
      const state: ResourceContextState = {
        activeProjectId: 'proj-a',
        contextMap: new Map([
          ['proj-a', { selectedTopicName: 'topics/t1', selectedSubscriptionName: 'subs/s1' }],
        ]),
      };
      const next = resourceContextReducer(state, {
        type: 'DESELECT_SUBSCRIPTION',
        projectId: 'proj-a',
      });
      const ctx = next.contextMap.get('proj-a');
      expect(ctx?.selectedTopicName).toBe('topics/t1');
      expect(ctx?.selectedSubscriptionName).toBeUndefined();
    });
  });

  describe('NAVIGATE_BACK', () => {
    it('clears activeProjectId', () => {
      const state = resourceContextReducer(fresh(), {
        type: 'SELECT_PROJECT',
        projectId: 'proj-a',
      });
      const next = resourceContextReducer(state, { type: 'NAVIGATE_BACK' });
      expect(next.activeProjectId).toBeUndefined();
    });

    it('preserves contextMap entries', () => {
      let s = resourceContextReducer(fresh(), { type: 'SELECT_PROJECT', projectId: 'proj-a' });
      s = resourceContextReducer(s, {
        type: 'SELECT_TOPIC',
        projectId: 'proj-a',
        topicName: 'topics/t1',
      });
      const next = resourceContextReducer(s, { type: 'NAVIGATE_BACK' });
      expect(next.contextMap.get('proj-a')?.selectedTopicName).toBe('topics/t1');
    });
  });

  describe('per-project isolation (US3 persistence scenario)', () => {
    it('navigating back to project A restores its previous selection', () => {
      let s = fresh();
      s = resourceContextReducer(s, { type: 'SELECT_PROJECT', projectId: 'proj-a' });
      s = resourceContextReducer(s, {
        type: 'SELECT_TOPIC',
        projectId: 'proj-a',
        topicName: 'topics/t1',
      });
      s = resourceContextReducer(s, { type: 'NAVIGATE_BACK' });
      s = resourceContextReducer(s, { type: 'SELECT_PROJECT', projectId: 'proj-b' });
      s = resourceContextReducer(s, {
        type: 'SELECT_SUBSCRIPTION',
        projectId: 'proj-b',
        subscriptionName: 'subs/s1',
      });
      s = resourceContextReducer(s, { type: 'NAVIGATE_BACK' });
      s = resourceContextReducer(s, { type: 'SELECT_PROJECT', projectId: 'proj-a' });

      expect(s.activeProjectId).toBe('proj-a');
      expect(s.contextMap.get('proj-a')?.selectedTopicName).toBe('topics/t1');
      expect(s.contextMap.get('proj-b')?.selectedSubscriptionName).toBe('subs/s1');
    });
  });

  describe('initialState', () => {
    it('has no activeProjectId and empty contextMap', () => {
      expect(initialState.activeProjectId).toBeUndefined();
      expect(initialState.contextMap.size).toBe(0);
    });
  });

  describe('default case', () => {
    it('returns state unchanged for an unknown action type', () => {
      const state = fresh();
      // Cast to bypass TypeScript exhaustiveness check
      const result = resourceContextReducer(state, { type: 'UNKNOWN' } as never);
      expect(result).toBe(state);
    });
  });
});

