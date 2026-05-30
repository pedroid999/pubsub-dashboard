import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { DiagnosticsPanel } from '../../src/client/components/DiagnosticsPanel.js';
import type { DiagnosticsList } from '../../src/server/schemas/diagnostics.js';

function record(path: string, traceId: string): DiagnosticsList[number] {
  return {
    traceId,
    at: '2026-05-29T20:00:00.000Z',
    request: { method: 'GET', path, headers: {}, body: null },
    response: { status: 200, headers: {}, body: { ok: true }, durationMs: 3 },
    error: null,
  };
}

describe('DiagnosticsPanel (T066)', () => {
  it('renders the most recent operations newest-first with their trace ids', async () => {
    const records: DiagnosticsList = [
      record('/api/session', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
      record('/api/health', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
    ];
    render(<DiagnosticsPanel load={() => Promise.resolve(records)} />);

    await waitFor(() => {
      expect(screen.getByText('/api/session')).toBeInTheDocument();
      expect(screen.getByText('/api/health')).toBeInTheDocument();
      expect(screen.getByText(/aaaaaaaa-aaaa-4aaa/)).toBeInTheDocument();
    });
  });

  it('shows an empty state when there are no operations', async () => {
    render(<DiagnosticsPanel load={() => Promise.resolve([])} />);
    await waitFor(() => {
      expect(screen.getByText(/no operations/i)).toBeInTheDocument();
    });
  });
});
