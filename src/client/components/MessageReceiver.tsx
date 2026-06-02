import { useEffect, useReducer, useRef, useState } from 'react';
import { Check, Copy, Download, Trash } from 'lucide-react';
import { useResourceContext } from '../lib/resourceContext.js';
import { useComposeDraft } from '../lib/composeDraft.js';
import { copyPayloadFromMessage } from '../lib/composeDraft.js';
import { ackMessages, pullMessages } from '../lib/messaging.js';
import { tryPrettyPrintJson } from '../lib/jsonFormat.js';
import { HighlightedJson } from './HighlightedJson.js';
import { flashStatus } from '../lib/statusFlash.js';
import {
  receivedMessagesReducer,
  initialReceivedMessagesState,
  type DisplayedMessage,
} from '../lib/receivedMessages.js';

/** Auto-poll cadence (FR-020 / SC-006). */
const AUTO_POLL_INTERVAL_MS = 2500;

export interface MessageReceiverProps {
  projectId: string;
}

function lastSegment(fullName: string): string {
  return fullName.split('/').at(-1) ?? fullName;
}

type PullStatus =
  | { status: 'idle' }
  | { status: 'pulling' }
  | { status: 'empty' }
  | { status: 'error'; message: string; code?: string };

function PayloadView({ message }: { message: DisplayedMessage }): JSX.Element {
  if (message.dataEncoding === 'base64') {
    return (
      <div>
        <span className="text-[10px] font-medium uppercase text-amber-600 dark:text-amber-400">
          binary (base64)
        </span>
        <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded bg-slate-50 p-2 font-mono text-[11px] text-slate-700 dark:bg-slate-700 dark:text-slate-300">
          {message.data}
        </pre>
      </div>
    );
  }
  // R11: JSON-highlighted payload, display-only, reusing the composer tokenizer.
  const { formatted } = tryPrettyPrintJson(message.data);
  return (
    <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded bg-slate-50 p-2 font-mono text-[11px] text-slate-700 dark:bg-slate-700 dark:text-slate-300">
      <HighlightedJson text={formatted} />
    </pre>
  );
}

export function MessageReceiver({ projectId }: MessageReceiverProps): JSX.Element {
  const { state } = useResourceContext();
  const { dispatch: composeDispatch } = useComposeDraft();
  const subscriptionName = state.contextMap.get(projectId)?.selectedSubscriptionName;

  const [messages, dispatch] = useReducer(receivedMessagesReducer, initialReceivedMessagesState);
  const [pullStatus, setPullStatus] = useState<PullStatus>({ status: 'idle' });
  const [ackHint, setAckHint] = useState<string | null>(null);
  // US7: opt-in auto-poll. Off by default (no invisible polling — FR-021/SC-006).
  const [auto, setAuto] = useState(false);
  // Always-fresh reference to onPull so the interval never restarts per render.
  const onPullRef = useRef<() => Promise<void>>(async () => {});

  // FR-023: the running list belongs to a subscription — when the active
  // subscription changes, clear it, stop auto-polling, and reset (R4/SC-006) so
  // pulls never mix targets and Auto never silently follows a new subscription.
  useEffect(() => {
    dispatch({ type: 'CLEAR' });
    setPullStatus({ status: 'idle' });
    setAckHint(null);
    setAuto(false);
  }, [subscriptionName]);

  // US7 (R1/R5/R6): while Auto is on for an active subscription, pull every
  // 2.5 s. The interval is torn down on toggle-off, subscription change, and
  // unmount, so there is never background polling without the visible indicator.
  useEffect(() => {
    if (!auto || !subscriptionName) return;
    const id = setInterval(() => {
      void onPullRef.current();
    }, AUTO_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [auto, subscriptionName]);

  if (!subscriptionName) {
    return (
      <div className="panel ticks flex min-h-[150px] items-center justify-center px-3 py-4 text-center text-xs text-fg3">
        <span className="flex items-center gap-2">
          <Download className="h-4 w-4 opacity-50" /> Select a subscription to pull messages.
        </span>
      </div>
    );
  }

  const subscriptionId = lastSegment(subscriptionName);

  async function onPull(): Promise<void> {
    setAckHint(null);
    setPullStatus({ status: 'pulling' });
    try {
      const result = await pullMessages(projectId, subscriptionId, 10);
      if (result.messages.length === 0) {
        setPullStatus({ status: 'empty' });
        return;
      }
      dispatch({ type: 'APPEND', messages: result.messages });
      setPullStatus({ status: 'idle' });
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      setPullStatus({
        status: 'error',
        message: e.message ?? 'Failed to pull messages.',
        code: e.code,
      });
      // R7: a failed pull pauses auto-polling pending user action (no infinite retry).
      setAuto(false);
    }
  }
  // Keep the interval's pull reference current without restarting the timer.
  onPullRef.current = onPull;

  async function onAck(ackId: string): Promise<void> {
    setAckHint(null);
    try {
      const result = await ackMessages(projectId, subscriptionId, [ackId]);
      if (result.acknowledged.includes(ackId)) {
        dispatch({ type: 'MARK_ACKNOWLEDGED', ackId });
      } else if (result.expired.includes(ackId)) {
        setAckHint('Acknowledge window expired — pull again to refresh ackIds.');
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      setAckHint(e.message ?? 'Failed to acknowledge message.');
    }
  }

  return (
    <div className="panel ticks rise flex min-h-0 flex-col p-3">
      <div className="mb-2 flex flex-none items-center justify-between">
        <h3 className="flex items-center gap-2 text-[var(--fs-label)] font-semibold uppercase tracking-[0.12em] text-fg2">
          Receive
          <span className="font-jp text-[10px] normal-case tracking-normal text-magenta">受信</span>
        </h3>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-fg3" title={subscriptionName}>
            {subscriptionId}
          </span>
          <button
            type="button"
            onClick={() => void onPull()}
            disabled={pullStatus.status === 'pulling'}
            data-testid="pull-button"
            className="flex items-center gap-1 rounded bg-slate-700 px-2 py-1 text-[11px] font-medium text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-600 dark:hover:bg-slate-500"
          >
            <Download className="h-3 w-3" />
            {pullStatus.status === 'pulling' ? 'Pulling…' : 'Pull'}
          </button>
          {/* US7: opt-in auto-poll toggle with a visible pulsing indicator. */}
          <button
            type="button"
            onClick={() => setAuto((v) => !v)}
            aria-pressed={auto}
            data-testid="auto-toggle"
            className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium ${
              auto ? 'bg-magenta/20 text-magenta' : 'text-fg3 hover:text-fg1'
            }`}
          >
            {auto && (
              <span
                data-testid="auto-indicator"
                aria-label="Auto-polling active"
                className="h-2 w-2 animate-pulse rounded-full bg-magenta"
              />
            )}
            Auto
          </button>
          {messages.items.length > 0 && (
            <button
              type="button"
              onClick={() => dispatch({ type: 'CLEAR' })}
              aria-label="Clear messages"
              className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-700"
            >
              <Trash className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
      </div>

      {pullStatus.status === 'empty' && (
        <p className="rounded border border-slate-200 bg-slate-50 px-3 py-3 text-center text-xs text-slate-500">
          No messages currently available.
        </p>
      )}
      {pullStatus.status === 'error' && (
        <div
          role="alert"
          className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
        >
          <p className="font-medium">{pullStatus.message}</p>
          {pullStatus.code === 'PERMISSION_DENIED' && (
            <p className="mt-0.5">
              Grant <span className="font-mono">roles/pubsub.subscriber</span>.
            </p>
          )}
          <button
            type="button"
            onClick={() => void onPull()}
            className="mt-1 text-red-600 underline hover:text-red-800"
          >
            Retry
          </button>
        </div>
      )}
      {ackHint && <p className="mb-2 text-xs text-amber-600">{ackHint}</p>}

      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto">
        {messages.items.map((m, i) => (
          <li
            key={`${m.messageId}-${i}`}
            className={`rounded border p-2 ${m.acknowledged ? 'border-green-200 bg-green-50/40' : 'border-slate-200'}`}
          >
            <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
              <span className="font-mono">{m.messageId}</span>
              <span>{m.publishTime}</span>
            </div>
            <PayloadView message={m} />
            {Object.keys(m.attributes).length > 0 && (
              <dl className="mt-1 flex flex-wrap gap-1">
                {Object.entries(m.attributes).map(([k, v]) => (
                  <span
                    key={k}
                    className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                  >
                    {k}={v}
                  </span>
                ))}
              </dl>
            )}
            <div className="mt-1.5 flex items-center justify-end gap-3">
              {/* FR-009/FR-014: copy into the publish composer; disabled for binary payloads. */}
              <button
                type="button"
                disabled={m.dataEncoding === 'base64'}
                onClick={() => {
                  const payload = copyPayloadFromMessage(m);
                  if (payload) {
                    composeDispatch({ type: 'COPY_TO_PUBLISH', payload });
                    flashStatus('Copied to composer');
                  }
                }}
                aria-label="Copy to publish"
                className="flex items-center gap-1 text-[11px] text-slate-500 underline hover:text-slate-700 disabled:cursor-not-allowed disabled:no-underline disabled:opacity-40"
              >
                <Copy className="h-3 w-3" /> Copy to publish
              </button>
              {m.acknowledged ? (
                <span className="flex items-center gap-1 text-[11px] text-green-600">
                  <Check className="h-3 w-3" /> Acknowledged
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => void onAck(m.ackId)}
                  className="text-[11px] text-slate-500 underline hover:text-slate-700"
                >
                  Acknowledge
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
