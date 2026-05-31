import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ResourceList } from '../../src/client/components/ResourceList.js';

afterEach(cleanup);

const items = [
  { name: 'projects/p/topics/payments-topic', displayName: 'payments-topic' },
  { name: 'projects/p/topics/orders-topic', displayName: 'orders-topic' },
  { name: 'projects/p/topics/inventory-topic', displayName: 'inventory-topic' },
  { name: 'projects/p/topics/events-topic', displayName: 'events-topic' },
  { name: 'projects/p/topics/alerts-topic', displayName: 'alerts-topic' },
];

describe('ResourceList', () => {
  it('renders all items when query is empty', () => {
    render(
      <ResourceList
        items={items}
        query=""
        onSelect={vi.fn()}
        emptyMessage="No topics"
        noMatchMessage="No matching topics"
      />,
    );
    expect(screen.getAllByRole('button')).toHaveLength(5);
  });

  it('filters items by partial query (case-insensitive)', () => {
    render(
      <ResourceList
        items={items}
        query="PAYMENTS"
        onSelect={vi.fn()}
        emptyMessage="No topics"
        noMatchMessage="No matching topics"
      />,
    );
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByTestId('resource-item-projects/p/topics/payments-topic')).toBeTruthy();
  });

  it('shows noMatchMessage when filter yields nothing', () => {
    render(
      <ResourceList
        items={items}
        query="nonexistent"
        onSelect={vi.fn()}
        emptyMessage="No topics"
        noMatchMessage="No matching topics"
      />,
    );
    expect(screen.getByText('No matching topics')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows emptyMessage when items array is empty', () => {
    render(
      <ResourceList
        items={[]}
        query=""
        onSelect={vi.fn()}
        emptyMessage="No topics"
        noMatchMessage="No matching topics"
      />,
    );
    expect(screen.getByText('No topics')).toBeTruthy();
  });

  it('calls onSelect with item name on click', () => {
    const onSelect = vi.fn();
    render(
      <ResourceList
        items={items}
        query=""
        onSelect={onSelect}
        emptyMessage="No topics"
        noMatchMessage="No matching topics"
      />,
    );
    fireEvent.click(screen.getByTestId('resource-item-projects/p/topics/payments-topic'));
    expect(onSelect).toHaveBeenCalledWith('projects/p/topics/payments-topic');
  });

  it('wraps matched text in a mark element', () => {
    render(
      <ResourceList
        items={[{ name: 'projects/p/topics/pay', displayName: 'pay' }]}
        query="pa"
        onSelect={vi.fn()}
        emptyMessage="No topics"
        noMatchMessage="No matching topics"
      />,
    );
    const mark = document.querySelector('mark');
    expect(mark).toBeTruthy();
    expect(mark?.textContent).toBe('pa');
  });

  it('highlights the selected item', () => {
    render(
      <ResourceList
        items={items}
        query=""
        onSelect={vi.fn()}
        selectedName="projects/p/topics/payments-topic"
        emptyMessage="No topics"
        noMatchMessage="No matching topics"
      />,
    );
    const selected = screen.getByTestId('resource-item-projects/p/topics/payments-topic');
    expect(selected.getAttribute('aria-pressed')).toBe('true');
  });

  it('renders subLabel below displayName when present (FR-006)', () => {
    render(
      <ResourceList
        items={[{
          name: 'projects/p/subscriptions/pay-sub',
          displayName: 'pay-sub [pull]',
          subLabel: 'projects/p/topics/payments',
        }]}
        query=""
        onSelect={vi.fn()}
        emptyMessage="No subs"
        noMatchMessage="No match"
      />,
    );
    expect(screen.getByText('projects/p/topics/payments')).toBeTruthy();
  });

  it('filters by subLabel when displayName does not match (FR-017)', () => {
    const subs = [
      { name: 'sub-1', displayName: 'alpha-sub [pull]', subLabel: 'projects/p/topics/payments' },
      { name: 'sub-2', displayName: 'beta-sub [push]', subLabel: 'projects/p/topics/orders' },
    ];
    render(
      <ResourceList
        items={subs}
        query="payments"
        onSelect={vi.fn()}
        emptyMessage="No subs"
        noMatchMessage="No match"
      />,
    );
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByTestId('resource-item-sub-1')).toBeTruthy();
  });
});
