import type { Hono } from 'hono';
import type { AppEnv } from '../app.js';
import type { AdcContext } from '../auth/index.js';
import {
  GcpProjectSchema,
  type GcpProject,
  type PubSubError,
} from '../schemas/pubsub.js';

const CRM_BASE = 'https://cloudresourcemanager.googleapis.com/v3/projects';
const FETCH_TIMEOUT_MS = 8_000;

export interface ProjectsDeps {
  adc: AdcContext;
  fetchImpl?: typeof fetch;
}

interface CrmProject {
  projectId?: string;
  displayName?: string;
  state?: string;
}

interface CrmResponse {
  projects?: CrmProject[];
  nextPageToken?: string;
}

interface CrmErrorDetail {
  '@type'?: string;
  metadata?: { quota_metric?: string };
}

interface CrmError {
  error?: {
    code?: number;
    message?: string;
    details?: CrmErrorDetail[];
  };
}

function extractQuotaName(details: CrmErrorDetail[]): string | undefined {
  for (const d of details) {
    if (
      d['@type'] === 'type.googleapis.com/google.rpc.ErrorInfo' &&
      d.metadata?.quota_metric
    ) {
      return d.metadata.quota_metric;
    }
  }
  return undefined;
}

async function fetchAllProjects(
  token: string,
  fetchFn: typeof fetch,
): Promise<GcpProject[]> {
  const all: GcpProject[] = [];
  let pageToken: string | undefined;
  const deadline = Date.now() + FETCH_TIMEOUT_MS;

  do {
    if (Date.now() > deadline) {
      const err = new Error('CRM request timed out');
      (err as NodeJS.ErrnoException).name = 'AbortError';
      throw err;
    }

    const url = new URL(CRM_BASE);
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const controller = new AbortController();
    const remaining = deadline - Date.now();
    const timeoutId = setTimeout(() => controller.abort(), remaining);

    let res: Response;
    try {
      res = await fetchFn(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as CrmError;
      const httpCode = res.status;
      const details = body.error?.details ?? [];
      const quotaName = extractQuotaName(details);

      if (httpCode === 429) {
        const err = Object.assign(new Error('QUOTA_EXCEEDED'), {
          code: 'QUOTA_EXCEEDED',
          quotaName,
        });
        throw err;
      }
      if (httpCode === 403 || httpCode === 401) {
        throw Object.assign(new Error('PERMISSION_DENIED'), { code: 'PERMISSION_DENIED' });
      }
      throw Object.assign(new Error('INTERNAL_ERROR'), { code: 'INTERNAL_ERROR' });
    }

    const data = (await res.json()) as CrmResponse;
    for (const p of data.projects ?? []) {
      const parsed = GcpProjectSchema.safeParse({
        projectId: p.projectId ?? '',
        displayName: p.displayName ?? p.projectId ?? '',
        state: p.state ?? 'ACTIVE',
      });
      if (parsed.success) all.push(parsed.data);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return all;
}

export function registerProjects(
  app: Hono<AppEnv>,
  deps: ProjectsDeps,
): void {
  const fetchFn = deps.fetchImpl ?? fetch;

  app.get('/api/projects', async (c) => {
    const traceId = c.var.traceId;
    let token: string;
    try {
      token = await deps.adc.getAccessToken();
    } catch {
      const body: PubSubError = {
        code: 'PERMISSION_DENIED',
        message:
          'ADC credentials expired or missing. Run: gcloud auth application-default login',
        traceId,
      };
      return c.json(body, 401);
    }

    try {
      const projects = await fetchAllProjects(token, fetchFn);
      return c.json({ projects, traceId });
    } catch (err: unknown) {
      const e = err as { code?: string; quotaName?: string; name?: string };

      if (e.name === 'AbortError' || e.code === 'TIMEOUT') {
        const body: PubSubError = {
          code: 'TIMEOUT',
          message:
            'Project list request timed out. Check connectivity to cloudresourcemanager.googleapis.com.',
          traceId,
        };
        return c.json(body, 504);
      }

      if (e.code === 'QUOTA_EXCEEDED') {
        const body: PubSubError = {
          code: 'QUOTA_EXCEEDED',
          message: `API quota exceeded${e.quotaName ? `: ${e.quotaName}` : ''}. Retry manually or wait for quota reset.`,
          traceId,
          quotaName: e.quotaName,
        };
        return c.json(body, 429);
      }

      if (e.code === 'PERMISSION_DENIED') {
        const body: PubSubError = {
          code: 'PERMISSION_DENIED',
          message:
            'Missing resourcemanager.projects.list permission. Grant roles/viewer on your organization or project.',
          traceId,
        };
        return c.json(body, 401);
      }

      const body: PubSubError = {
        code: 'INTERNAL_ERROR',
        message: err instanceof Error ? err.message : 'Unexpected error listing projects.',
        traceId,
      };
      return c.json(body, 500);
    }
  });
}
