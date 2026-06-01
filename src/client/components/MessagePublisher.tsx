import { useEffect, useState } from 'react';
import { Plus, Send, Trash2, Wand2 } from 'lucide-react';
import { useResourceContext } from '../lib/resourceContext.js';
import { useComposeDraft } from '../lib/composeDraft.js';
import { validateJson, formatJson } from '../lib/jsonValidation.js';
import { publishMessage, validateOutboundDraft } from '../lib/messaging.js';

export interface MessagePublisherProps {
  projectId: string;
}

function lastSegment(fullName: string): string {
  return fullName.split('/').at(-1) ?? fullName;
}

type PublishState =
  | { status: 'idle' }
  | { status: 'publishing' }
  | { status: 'success'; messageId: string }
  | { status: 'error'; message: string; code?: string };

export function MessagePublisher({ projectId }: MessagePublisherProps): JSX.Element {
  const { state: resourceState } = useResourceContext();
  const topicName = resourceState.contextMap.get(projectId)?.selectedTopicName;

  const { state: draft, dispatch } = useComposeDraft();
  const { mode, body, attributes, pendingCopy } = draft;

  const [publishState, setPublishState] = useState<PublishState>({ status: 'idle' });
  const [validationError, setValidationError] = useState<string | null>(null);

  // FR-018: on active-topic change, reset ONLY the publish result and inline
  // validation message — the draft (body/attributes/mode) lives in the provider
  // and intentionally persists across topic changes; only the target updates.
  useEffect(() => {
    setPublishState({ status: 'idle' });
    setValidationError(null);
  }, [topicName]);

  if (!topicName) {
    return (
      <div className="rounded border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-center text-xs text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400">
        Select a topic to publish a message.
      </div>
    );
  }

  const topicId = lastSegment(topicName);
  const jsonValidity = validateJson(body);
  const jsonInvalid = mode === 'json' && !jsonValidity.valid;

  function updateRow(index: number, patch: Partial<{ key: string; value: string }>): void {
    dispatch({ type: 'UPDATE_ATTRIBUTE', index, patch });
  }

  function onFormat(): void {
    const result = formatJson(body);
    if (result.ok) {
      dispatch({ type: 'SET_BODY', body: result.formatted });
      setValidationError(null);
    } else {
      setValidationError(result.message);
    }
  }

  async function onPublish(): Promise<void> {
    const validation = validateOutboundDraft({ body, attributes });
    if (!validation.ok) {
      setValidationError(validation.error);
      return;
    }
    setValidationError(null);
    setPublishState({ status: 'publishing' });
    try {
      const result = await publishMessage(projectId, topicId, body, validation.attributes);
      setPublishState({ status: 'success', messageId: result.messageId });
      // FR-007/FR-016: body + attributes are intentionally preserved for republish.
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      // FR-008: composed draft preserved on failure for retry.
      setPublishState({
        status: 'error',
        message: e.message ?? 'Failed to publish message.',
        code: e.code,
      });
    }
  }

  return (
    <div className="rounded border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Publish
        </h3>
        <span
          className="font-mono text-[11px] text-slate-400 dark:text-slate-500"
          title={topicName}
        >
          {topicId}
        </span>
      </div>

      {/* FR-012: replace-confirm banner when a copy is parked over a dirty draft. */}
      {pendingCopy && (
        <div
          role="alert"
          className="mb-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200"
        >
          <p className="font-medium">Replace the current composition with the copied message?</p>
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={() => dispatch({ type: 'CONFIRM_COPY' })}
              className="rounded bg-amber-600 px-2 py-0.5 font-medium text-white hover:bg-amber-700"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: 'CANCEL_COPY' })}
              className="rounded border border-amber-400 px-2 py-0.5 hover:bg-amber-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* FR-007: JSON / plain-text mode toggle. */}
      <div className="mb-1 flex items-center gap-2">
        <div className="inline-flex overflow-hidden rounded border border-slate-300 text-[11px] dark:border-slate-600">
          <button
            type="button"
            aria-pressed={mode === 'text'}
            onClick={() => dispatch({ type: 'SET_MODE', mode: 'text' })}
            className={`px-2 py-0.5 ${mode === 'text' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}
          >
            Text
          </button>
          <button
            type="button"
            aria-pressed={mode === 'json'}
            onClick={() => dispatch({ type: 'SET_MODE', mode: 'json' })}
            className={`px-2 py-0.5 ${mode === 'json' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}
          >
            JSON
          </button>
        </div>
        {mode === 'json' && (
          <>
            <button
              type="button"
              onClick={onFormat}
              aria-label="Format JSON"
              className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 dark:text-blue-400"
            >
              <Wand2 className="h-3 w-3" /> Format
            </button>
            <span
              data-testid={jsonValidity.valid ? 'json-valid' : 'json-invalid'}
              className={`text-[11px] ${jsonValidity.valid ? 'text-green-600' : 'text-red-600'}`}
            >
              {jsonValidity.valid
                ? 'Valid JSON'
                : `Invalid JSON: ${jsonValidity.message}${
                    !jsonValidity.valid && jsonValidity.position !== undefined
                      ? ` (position ${jsonValidity.position})`
                      : ''
                  }`}
            </span>
          </>
        )}
      </div>

      <textarea
        value={body}
        onChange={(e) => dispatch({ type: 'SET_BODY', body: e.target.value })}
        placeholder={mode === 'json' ? 'Message body (JSON)…' : 'Message body (text or JSON)…'}
        aria-label="Message body"
        data-testid="publish-body"
        rows={4}
        className={`w-full rounded border p-2 font-mono text-xs focus:outline-none focus:ring-1 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-500 ${
          jsonInvalid
            ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
            : 'border-slate-300 focus:border-blue-500 focus:ring-blue-500 dark:border-slate-600'
        }`}
      />

      <div className="mt-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            Attributes
          </span>
          <button
            type="button"
            onClick={() => dispatch({ type: 'ADD_ATTRIBUTE' })}
            aria-label="Add attribute"
            className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>
        {attributes.map((row, i) => (
          <div key={i} className="mb-1 flex items-center gap-1">
            <input
              type="text"
              value={row.key}
              onChange={(e) => updateRow(i, { key: e.target.value })}
              placeholder="key"
              aria-label={`Attribute ${i + 1} key`}
              className="w-1/3 rounded border border-slate-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-500"
            />
            <input
              type="text"
              value={row.value}
              onChange={(e) => updateRow(i, { value: e.target.value })}
              placeholder="value"
              aria-label={`Attribute ${i + 1} value`}
              className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-500"
            />
            <button
              type="button"
              onClick={() => dispatch({ type: 'REMOVE_ATTRIBUTE', index: i })}
              aria-label={`Remove attribute ${i + 1}`}
              className="text-slate-400 hover:text-red-600"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {validationError && (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {validationError}
        </p>
      )}

      <button
        type="button"
        onClick={() => void onPublish()}
        disabled={publishState.status === 'publishing' || jsonInvalid}
        className="mt-3 flex items-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        <Send className="h-3.5 w-3.5" />
        {publishState.status === 'publishing' ? 'Publishing…' : 'Publish'}
      </button>

      {publishState.status === 'success' && (
        <p className="mt-2 rounded border border-green-200 bg-green-50 px-2 py-1.5 text-xs text-green-700">
          Published. Message ID: <span className="font-mono">{publishState.messageId}</span>
        </p>
      )}
      {publishState.status === 'error' && (
        <div
          role="alert"
          className="mt-2 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700"
        >
          <p className="font-medium">{publishState.message}</p>
          {publishState.code === 'PERMISSION_DENIED' && (
            <p className="mt-0.5">
              Grant <span className="font-mono">roles/pubsub.publisher</span>.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
