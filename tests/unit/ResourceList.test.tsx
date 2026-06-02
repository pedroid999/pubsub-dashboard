import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { ResourceList, type ResourceItem } from '../../src/client/components/ResourceList.js';

afterEach(cleanup);

const items: ResourceItem[] = [
  { name: 'projects/p/topics/payments-topic', displayName: 'payments-topic' },
  { name: 'projects/p/topics/orders-topic', displayName: 'orders-topic' },
  { name: 'projects/p/topics/inventory-topic', displayName: 'inventory-topic' },
  { name: 'projects/p/topics/events-topic', displayName: 'events-topic' },
  { name: 'projects/p/topics/alerts-topic', displayName: 'alerts-topic' },
];

function renderList(props: Partial<React.ComponentProps<typeof ResourceList>> = {}): {
  onSelect: ReturnType<typeof vi.fn>;
} {
  const onSelect = vi.fn();
  render(
    <ResourceList
      items={items}
      onSelect={onSelect}
      emptyMessage="No topics"
      noMatchMessage="No matching topics"
      searchTestId="topic-search"
      searchLabel="Filter topics…"
      {...props}
    />,
  );
  return { onSelect };
}

function rows(): HTMLElement[] {
  return within(screen.getByTestId('resource-list')).getAllByRole('option');
}
function activeRow(): HTMLElement | undefined {
  return rows().find((r) => r.getAttribute('data-active') === 'true');
}
function input(): HTMLInputElement {
  return screen.getByTestId('topic-search') as HTMLInputElement;
}

describe('ResourceList → SearchableList (US5 · L1–L11)', () => {
  it('renders the owned filter input and all items', () => {
    renderList();
    expect(screen.getByTestId('topic-search')).toBeInTheDocument();
    expect(rows()).toHaveLength(5);
  });

  it('L1: typing narrows the list and highlights the match', () => {
    renderList();
    fireEvent.change(input(), { target: { value: 'PAYMENTS' } });
    expect(rows()).toHaveLength(1);
    const mark = document.querySelector('mark');
    expect(mark?.textContent?.toLowerCase()).toBe('payments');
  });

  it('shows noMatchMessage when filter yields nothing', () => {
    renderList();
    fireEvent.change(input(), { target: { value: 'zzz' } });
    expect(screen.getByText('No matching topics')).toBeInTheDocument();
    expect(screen.queryByTestId('resource-list')).toBeNull();
  });

  it('shows emptyMessage when items array is empty (input still present)', () => {
    render(
      <ResourceList
        items={[]}
        onSelect={vi.fn()}
        emptyMessage="No topics"
        noMatchMessage="No matching topics"
        searchTestId="topic-search"
        searchLabel="Filter topics…"
      />,
    );
    expect(screen.getByText('No topics')).toBeInTheDocument();
    expect(screen.getByTestId('topic-search')).toBeInTheDocument();
  });

  it('calls onSelect with the item name on click', () => {
    const { onSelect } = renderList();
    fireEvent.click(screen.getByTestId('resource-item-projects/p/topics/orders-topic'));
    expect(onSelect).toHaveBeenCalledWith('projects/p/topics/orders-topic');
  });

  it('marks the selected item with aria-pressed', () => {
    renderList({ selectedName: 'projects/p/topics/payments-topic' });
    expect(screen.getByTestId('resource-item-projects/p/topics/payments-topic')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('renders subLabel below displayName when present', () => {
    render(
      <ResourceList
        items={[
          {
            name: 'projects/p/subscriptions/pay-sub',
            displayName: 'pay-sub [pull]',
            subLabel: 'projects/p/topics/payments',
          },
        ]}
        onSelect={vi.fn()}
        emptyMessage="No subs"
        noMatchMessage="No match"
        searchTestId="sub-search"
        searchLabel="Filter…"
      />,
    );
    expect(screen.getByText('projects/p/topics/payments')).toBeInTheDocument();
  });

  it('L3: bounds its height with an overflow scroll container', () => {
    renderList();
    const list = screen.getByTestId('resource-list');
    expect(list.className).toMatch(/overflow-y-auto/);
    expect(list.className).toMatch(/max-h-/);
  });

  it('filters by subLabel when displayName does not match', () => {
    render(
      <ResourceList
        items={[
          {
            name: 'sub-1',
            displayName: 'alpha-sub [pull]',
            subLabel: 'projects/p/topics/payments',
          },
          { name: 'sub-2', displayName: 'beta-sub [push]', subLabel: 'projects/p/topics/orders' },
        ]}
        onSelect={vi.fn()}
        emptyMessage="No subs"
        noMatchMessage="No match"
        searchTestId="sub-search"
        searchLabel="Filter…"
      />,
    );
    fireEvent.change(screen.getByTestId('sub-search'), { target: { value: 'payments' } });
    expect(within(screen.getByTestId('resource-list')).getAllByRole('option')).toHaveLength(1);
    expect(screen.getByTestId('resource-item-sub-1')).toBeInTheDocument();
  });

  it('L4: ArrowDown/ArrowUp move the active row clamped to range', () => {
    renderList();
    // First row active by default.
    expect(activeRow()).toBe(screen.getByTestId('resource-item-projects/p/topics/payments-topic'));
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    expect(activeRow()).toBe(screen.getByTestId('resource-item-projects/p/topics/orders-topic'));
    fireEvent.keyDown(input(), { key: 'ArrowUp' });
    expect(activeRow()).toBe(screen.getByTestId('resource-item-projects/p/topics/payments-topic'));
    // Clamp at the top.
    fireEvent.keyDown(input(), { key: 'ArrowUp' });
    expect(activeRow()).toBe(screen.getByTestId('resource-item-projects/p/topics/payments-topic'));
  });

  it('L4: never calls Element.scrollIntoView (manual scrollTop only)', () => {
    // jsdom does not implement scrollIntoView; stub it so we can assert the
    // component never reaches for it (it must adjust scrollTop manually).
    const proto = Element.prototype as unknown as { scrollIntoView?: () => void };
    const original = proto.scrollIntoView;
    const fn = vi.fn();
    proto.scrollIntoView = fn;
    renderList();
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    fireEvent.keyDown(input(), { key: 'End' });
    expect(fn).not.toHaveBeenCalled();
    if (original) proto.scrollIntoView = original;
    else delete proto.scrollIntoView;
  });

  it('L5: Home/End jump to first/last item', () => {
    renderList();
    fireEvent.keyDown(input(), { key: 'End' });
    expect(activeRow()).toBe(screen.getByTestId('resource-item-projects/p/topics/alerts-topic'));
    fireEvent.keyDown(input(), { key: 'Home' });
    expect(activeRow()).toBe(screen.getByTestId('resource-item-projects/p/topics/payments-topic'));
  });

  it('L6: Enter selects the active item', () => {
    const { onSelect } = renderList();
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith('projects/p/topics/inventory-topic');
  });

  it('L7: Escape clears a non-empty filter and stops propagation; empty is a no-op', () => {
    renderList();
    fireEvent.change(input(), { target: { value: 'orders' } });
    expect(input().value).toBe('orders');
    const cleared = fireEvent.keyDown(input(), { key: 'Escape' });
    expect(input().value).toBe('');
    // returns false when a handler called preventDefault.
    expect(cleared).toBe(false);
    // Empty → no-op (does not preventDefault, event not cancelled).
    const noop = fireEvent.keyDown(input(), { key: 'Escape' });
    expect(noop).toBe(true);
  });

  it('L8: MouseEnter over a row updates the active index', () => {
    renderList();
    fireEvent.mouseEnter(screen.getByTestId('resource-item-projects/p/topics/events-topic'));
    expect(activeRow()).toBe(screen.getByTestId('resource-item-projects/p/topics/events-topic'));
  });

  it('L10: rapid successive keypresses select the correct item (ref-backed)', () => {
    const { onSelect } = renderList();
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith('projects/p/topics/events-topic');
  });

  it('L11: changing the query resets the active index to 0', () => {
    renderList();
    fireEvent.keyDown(input(), { key: 'End' });
    expect(activeRow()).toBe(screen.getByTestId('resource-item-projects/p/topics/alerts-topic'));
    fireEvent.change(input(), { target: { value: 'topic' } });
    // After re-filter the active row is the first match again.
    const firstRow = rows()[0];
    expect(firstRow?.getAttribute('data-active')).toBe('true');
  });
});
