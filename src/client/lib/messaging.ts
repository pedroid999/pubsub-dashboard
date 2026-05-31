import { apiPost } from './api.js';
import {
  PublishResponseSchema,
  PullResponseSchema,
  AckResponseSchema,
  type PublishResponse,
  type PullResponse,
  type AckResponse,
} from '../../server/schemas/messaging.js';

export interface AttributeRow {
  key: string;
  value: string;
}

export interface OutboundDraft {
  body: string;
  attributes: AttributeRow[];
}

export type DraftValidation =
  | { ok: true; attributes: Record<string, string> }
  | { ok: false; error: string };

/**
 * Pure client-side validation of a publish draft (FR-003/FR-006). Empty body
 * fails. Fully-empty attribute rows are ignored (not yet attributes); a row with
 * only a key or only a value fails; duplicate keys fail. Returns the assembled
 * `attributes` record on success.
 */
export function validateOutboundDraft(draft: OutboundDraft): DraftValidation {
  if (draft.body.length === 0) {
    return { ok: false, error: 'Message body must not be empty.' };
  }
  const attributes: Record<string, string> = {};
  for (const row of draft.attributes) {
    const key = row.key.trim();
    const value = row.value;
    if (key === '' && value === '') continue; // empty row — ignore
    if (key === '' || value === '') {
      return { ok: false, error: 'Each attribute needs both a key and a value.' };
    }
    if (Object.prototype.hasOwnProperty.call(attributes, key)) {
      return { ok: false, error: `Duplicate attribute key: "${key}".` };
    }
    attributes[key] = value;
  }
  return { ok: true, attributes };
}

function topicPath(projectId: string, topicId: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}/topics/${encodeURIComponent(topicId)}`;
}

function subscriptionPath(projectId: string, subscriptionId: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}/subscriptions/${encodeURIComponent(
    subscriptionId,
  )}`;
}

export async function publishMessage(
  projectId: string,
  topicId: string,
  body: string,
  attributes: Record<string, string>,
  fetchImpl: typeof fetch = fetch,
): Promise<PublishResponse> {
  const { data } = await apiPost(
    `${topicPath(projectId, topicId)}/publish`,
    { data: body, attributes },
    PublishResponseSchema,
    fetchImpl,
  );
  return data;
}

export async function pullMessages(
  projectId: string,
  subscriptionId: string,
  maxMessages = 10,
  fetchImpl: typeof fetch = fetch,
): Promise<PullResponse> {
  const { data } = await apiPost(
    `${subscriptionPath(projectId, subscriptionId)}/pull`,
    { maxMessages },
    PullResponseSchema,
    fetchImpl,
  );
  return data;
}

export async function ackMessages(
  projectId: string,
  subscriptionId: string,
  ackIds: string[],
  fetchImpl: typeof fetch = fetch,
): Promise<AckResponse> {
  const { data } = await apiPost(
    `${subscriptionPath(projectId, subscriptionId)}/ack`,
    { ackIds },
    AckResponseSchema,
    fetchImpl,
  );
  return data;
}
