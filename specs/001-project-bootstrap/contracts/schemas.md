# Contract — Shared Zod Schemas (v1 bootstrap)

**Feature**: 001-project-bootstrap
**Location**: `src/server/schemas/**` (imported by both server and client)

> These schemas are the **single source of truth** for both server-side
> validation and client-side TypeScript types. Any breaking change to a schema
> is a breaking change to the HTTP contract and MUST bump the package's
> SemVer MINOR (additive) or MAJOR (removed/renamed fields).

Below, schemas are described in TypeScript-flavoured pseudocode (`z.foo()`).
Implementation must match field-for-field and validation-for-validation.

---

## `SessionSchema` — `src/server/schemas/session.ts`

```ts
export const SessionSchema = z.object({
  projectId:   z.string().regex(/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/),
  identity:    z.string().min(1),
  bindAddress: z.literal('127.0.0.1'),
  port:        z.number().int().min(1).max(65535),
  startedAt:   z.string().datetime({ offset: true }),
  lastTraceId: z.string().uuid().nullable(),
  version:     z.string().regex(/^\d+\.\d+\.\d+(?:-[\w.+-]+)?$/),
  nodeVersion: z.string().regex(/^v\d+\.\d+\.\d+$/),
});
export type Session = z.infer<typeof SessionSchema>;
```

### Tests

- T-SCHEMA-010: Valid Session round-trips through parse → identical object.
- T-SCHEMA-011: Invalid `projectId` (uppercase letter, too short) → parse error.
- T-SCHEMA-012: `bindAddress: '0.0.0.0'` → parse error (literal mismatch).
- T-SCHEMA-013: `port: 0` or `port: 70000` → parse error.

---

## `HealthResponseSchema` — `src/server/schemas/health.ts`

```ts
export const HealthResponseSchema = z.object({
  status:   z.literal('ok'),
  uptimeMs: z.number().int().nonnegative(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
```

### Tests

- T-SCHEMA-020: `{status:'ok', uptimeMs:0}` parses.
- T-SCHEMA-021: `{status:'degraded', ...}` rejects (no v1 degraded state).

---

## `DiagnosticsRecordSchema` — `src/server/schemas/diagnostics.ts`

```ts
const HeaderMap = z.record(z.string(), z.string());

export const DiagnosticsRecordSchema = z.object({
  traceId: z.string().uuid(),
  at:      z.string().datetime({ offset: true }),
  request: z.object({
    method:  z.enum(['GET','POST','PUT','PATCH','DELETE','OPTIONS','HEAD']),
    path:    z.string().startsWith('/'),
    headers: HeaderMap,
    body:    z.unknown(),
  }),
  response: z.object({
    status:     z.number().int().min(100).max(599),
    headers:    HeaderMap,
    body:       z.unknown(),
    durationMs: z.number().nonnegative(),
  }),
  error: z.object({
    code:    z.string(),
    message: z.string(),
  }).nullable(),
});
export type DiagnosticsRecord = z.infer<typeof DiagnosticsRecordSchema>;

export const DiagnosticsListSchema = z.array(DiagnosticsRecordSchema).max(50);
export type DiagnosticsList = z.infer<typeof DiagnosticsListSchema>;
```

### Tests

- T-SCHEMA-030: List exceeding 50 items rejects.
- T-SCHEMA-031: Negative `durationMs` rejects.
- T-SCHEMA-032: `status: 99` rejects.
- T-SCHEMA-033: `path` not starting with `/` rejects.

---

## `ErrorResponseSchema` — `src/server/schemas/errors.ts`

The body shape for every non-2xx JSON response.

```ts
export const ErrorCode = z.enum([
  'ADC_MISSING',          // 12
  'GCLOUD_MISSING',       // 11
  'NO_ACTIVE_PROJECT',    // 13
  'INVALID_QUERY',        // generic 400
  'INTERNAL',             // generic 500
]);
export type ErrorCodeT = z.infer<typeof ErrorCode>;

export const ErrorResponseSchema = z.object({
  code:        ErrorCode,
  message:     z.string().min(1),
  remediation: z.string().min(1).optional(),
  traceId:     z.string().uuid(),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
```

### Tests

- T-SCHEMA-040: `ADC_MISSING` error carries a `remediation` whose text contains the substring `gcloud auth application-default login`.
- T-SCHEMA-041: `NO_ACTIVE_PROJECT` carries a `remediation` containing `gcloud config set project`.
- T-SCHEMA-042: Unknown `code` value rejects.

---

## `CliArgsSchema` — `src/cli/args.ts`

The zod schema parsed argv passes through after `node:util.parseArgs`.

```ts
export const CliArgsSchema = z.object({
  port:    z.coerce.number().int().min(1).max(65535).default(4321),
  verbose: z.boolean().default(false),
  help:    z.boolean().default(false),
  version: z.boolean().default(false),
}).strict();   // unknown flags rejected
export type CliArgs = z.infer<typeof CliArgsSchema>;
```

### Tests

- T-SCHEMA-050: `{}` → `{port:4321, verbose:false, help:false, version:false}`.
- T-SCHEMA-051: `{port:'5173'}` → coerced to `5173`.
- T-SCHEMA-052: `{port:'abc'}` rejects.
- T-SCHEMA-053: `{xyz:true}` rejects (`.strict()`).

---

## `PreferencesSchema` — `src/server/schemas/preferences.ts` (reserved)

Reserved for feature 002+. Bootstrap does not read or write it.

```ts
export const PreferencesSchema = z.object({
  preferredPort:     z.number().int().min(1).max(65535).optional(),
  verboseByDefault:  z.boolean().optional(),
  recentProjects:    z.array(z.string()).max(20).optional(),
}).strict();
export type Preferences = z.infer<typeof PreferencesSchema>;
```

### Tests

- T-SCHEMA-060: Empty object parses (all fields optional).
- T-SCHEMA-061: Unknown field rejects (`.strict()`).
- T-SCHEMA-062 (v1 invariant): A test asserts that after a full `boot → /api/health → SIGINT` cycle, the preferences file path does not exist (or, if it pre-existed, its mtime is unchanged). This guards against accidental writes from middleware refactors.
