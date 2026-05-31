import { useEffect, useReducer, useState } from 'react';
import { Check, Download, Trash } from 'lucide-react';
import { useResourceContext } from '../lib/resourceContext.js';
import { ackMessages, pullMessages } from '../lib/messaging.js';
import { tryPrettyPrintJson } from '../lib/jsonFormat.js';
import {
  receivedMessagesReducer,
  initialReceivedMessagesState,
  type DisplayedMessage,
} from '../lib/receivedMessages.js';

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
        <span className="text-[10px] font-medium uppercase text-amber-600">binary (base64)</span>
        <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded bg-slate-50 p-2 font-mono text-[11px] text-slate-700">
          {message.data}
        </pre>
      </div>
    );
  }
  const { formatted } = tryPrettyPrintJson(message.data);
  return (
    <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded bg-slate-50 p-2 font-mono text-[11px] text-slate-700">
      {formatted}
    </pre>
  );
}

export function MessageReceiver({ projectId }: MessageReceiverProps): JSX.Element {
  const { state } = useResourceContext();
  const subscriptionName = state.contextMap.get(projectId)?.selectedSubscriptionName;

  const [messages, dispatch] = useReducer(receivedMessagesReducer, initialReceivedMessagesState);
  const [pullStatus, setPullStatus] = useState<PullStatus>({ status: 'idle' });
  const [ackHint, setAckHint] = useState<string | null>(null);

  // FR-023: the running list belongs to a subscription — when the active
  // subscription changes, clear it so pulls never mix targets.
  useEffect(() => {
    dispatch({ type: 'CLEAR' });
    setPullStatus({ status: 'idle' });
    setAckHint(null);
  }, [subscriptionName]);

  if (!subscriptionName) {
    return (
      <div className="rounded border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">
        Select a subscription to pull messages.
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
    }
  }

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
    <div className="rounded border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Receive</h3>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-slate-400" title={subscriptionName}>
            {subscriptionId}
          </span>
          <button
            type="button"
            onClick={() => void onPull()}
            disabled={pullStatus.status === 'pulling'}
            data-testid="pull-button"
            className="flex items-center gap-1 rounded bg-slate-700 px-2 py-1 text-[11px] font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            <Download className="h-3 w-3" />
            {pullStatus.status === 'pulling' ? 'Pulling…' : 'Pull'}
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

      <ul className="space-y-2">
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
                    className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600"
                  >
                    {k}={v}
                  </span>
                ))}
              </dl>
            )}
            <div className="mt-1.5 flex items-center justify-end">
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
