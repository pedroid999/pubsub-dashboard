import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SessionBadge } from '../../src/client/components/SessionBadge.js';
import { DiagnosticsPanel } from '../../src/client/components/DiagnosticsPanel.js';

describe('SessionBadge — non-ApiError failure branch', () => {
  it('renders a generic message when load rejects with a plain Error', async () => {
    const load = () => Promise.reject(new Error('boom-network'));
    render(<SessionBadge load={load} />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('boom-network');
    });
  });
});

describe('DiagnosticsPanel — load failure branch', () => {
  it('falls back to the empty state when load rejects', async () => {
    const load = () => Promise.reject(new Error('down'));
    render(<DiagnosticsPanel load={load} />);
    await waitFor(() => {
      expect(screen.getByText(/no operations/i)).toBeInTheDocument();
    });
  });
});
