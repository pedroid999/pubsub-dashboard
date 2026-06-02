import { useEffect, useRef, useState } from 'react';
import { Zap } from 'lucide-react';
import {
  STATUS_FLASH_EVENT,
  STATUS_FLASH_TTL_MS,
  type StatusFlashDetail,
} from '../lib/statusFlash.js';

/**
 * Transient header chip that shows the latest status flash and auto-dismisses
 * after {@link STATUS_FLASH_TTL_MS} (US8 / FR-023). Non-blocking: it never traps
 * focus or interrupts the flow.
 */
export function StatusFlash(): JSX.Element | null {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onFlash(e: Event): void {
      const detail = (e as CustomEvent<StatusFlashDetail>).detail;
      if (!detail?.message) return;
      setMessage(detail.message);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setMessage(null), STATUS_FLASH_TTL_MS);
    }
    window.addEventListener(STATUS_FLASH_EVENT, onFlash);
    return () => {
      window.removeEventListener(STATUS_FLASH_EVENT, onFlash);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!message) return null;

  return (
    <output
      data-testid="status-flash"
      className="rise flex items-center gap-1.5 rounded-token border border-accent/40 bg-inset px-2 py-1 text-[11px] text-accent shadow-glow"
    >
      <Zap className="h-3 w-3" aria-hidden="true" />
      {message}
    </output>
  );
}
