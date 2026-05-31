import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ResourceContext } from '../../src/client/lib/resourceContext.js';
import { ContextIndicator } from '../../src/client/components/ContextIndicator.js';
import type { ResourceContextValue } from '../../src/client/lib/resourceContext.js';

afterEach(cleanup);

function renderWithCtx(value: ResourceContextValue) {
  return render(
    <ResourceContext.Provider value={value}>
      <ContextIndicator />
    </ResourceContext.Provider>,
  );
}

function makeCtx(overrides: Partial<ResourceContextValue['state']> = {}): ResourceContextValue {
  const contextMap = new Map(overrides.contextMap ?? []);
  return {
    state: {
      activeProjectId: overrides.activeProjectId,
      contextMap,
    },
    dispatch: () => undefined,
  };
}

describe('ContextIndicator', () => {
  it('renders nothing when no activeProjectId', () => {
    const { container } = renderWithCtx(makeCtx());
    expect(container.firstChild).toBeNull();
  });

  it('shows project ID when a project is active', () => {
    renderWithCtx(makeCtx({ activeProjectId: 'my-proj' }));
    expect(screen.getByText('my-proj')).toBeTruthy();
  });

  it('shows topic name when selected', () => {
    renderWithCtx(
      makeCtx({
        activeProjectId: 'my-proj',
        contextMap: new Map([
          ['my-proj', { selectedTopicName: 'projects/my-proj/topics/payments' }],
        ]),
      }),
    );
    expect(screen.getByText('projects/my-proj/topics/payments')).toBeTruthy();
  });

  it('shows subscription name when selected', () => {
    renderWithCtx(
      makeCtx({
        activeProjectId: 'my-proj',
        contextMap: new Map([
          ['my-proj', { selectedSubscriptionName: 'projects/my-proj/subscriptions/pay-sub' }],
        ]),
      }),
    );
    expect(screen.getByText('projects/my-proj/subscriptions/pay-sub')).toBeTruthy();
  });

  it('shows placeholder when no topic selected', () => {
    renderWithCtx(makeCtx({ activeProjectId: 'my-proj' }));
    expect(screen.getByText(/no topic selected/i)).toBeTruthy();
  });

  it('shows placeholder when no subscription selected', () => {
    renderWithCtx(makeCtx({ activeProjectId: 'my-proj' }));
    expect(screen.getByText(/no subscription selected/i)).toBeTruthy();
  });
});
