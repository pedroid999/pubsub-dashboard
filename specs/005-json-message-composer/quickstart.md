# Quickstart: JSON Message Composer & Republish

**Feature**: 005-json-message-composer

Manual walkthrough to exercise the feature end-to-end against a real GCP project.
Prereq: ADC configured (`gcloud auth application-default login`) and a topic +
subscription you can publish/pull on.

## Run

```bash
npm install      # no new deps — the JSON editor is a JSON-aware textarea (see research.md Decision 1)
npm run dev      # or: npx pubsub-dashboard  (single-process build)
```

Open the dashboard (auto-opens), pick a project, select a topic AND a subscription
as the active context (feature 002).

## 1. Compose & validate JSON (US1)

1. In the **Publish** panel, switch the body editor to **JSON mode**.
2. Type a broken object, e.g. `{"a": }` → the editor shows an **invalid** indicator
   with the error location, and **Publish is disabled**.
3. Fix it to `{"a": 1}` → **valid** indicator appears, **Publish enabled**.
4. Minify it to `{"a":1,"b":2}` and click **Format** → it re-indents (pretty-print),
   data unchanged.
5. Toggle to **plain-text mode** → body text is preserved; validation no longer
   enforced (free text publishes, as in feature 003).

✅ Expected: malformed JSON can never be published from JSON mode.

## 2. Publish & verify round-trip (feature 003 still works)

1. With a valid JSON body, click **Publish** → success banner shows the message ID.
2. In the **Receive** panel, click **Pull** → your message appears, JSON
   pretty-printed.

## 3. Copy a received message to republish (US2)

1. On a received message, click **Copy to publish**.
2. The **Publish** composer loads that message's **payload** (in JSON mode,
   pretty-printed, marked valid) and its **attributes** into the attribute rows.
3. If the composer already had unsent content, a **replace-confirm** prompt appears
   first — confirming replaces it; cancelling keeps your in-progress draft.
4. Click **Publish** unchanged → the republished message carries the same payload
   and attributes.

✅ Expected: a binary (base64) received message has **Copy to publish disabled**.

## 4. Edit then republish (US3)

1. After copying, change one field value, e.g. `"userId": "A"` → `"userId": "B"`.
2. The validity indicator stays **valid**; if you break the JSON it flips to
   **invalid** and blocks publish until fixed.
3. Click **Publish** → pull again and confirm the republished message reflects the
   edit.

## Automated checks (CI gates — Principle II)

```bash
npm run test         # vitest: jsonValidation + composeDraft reducer ≥90% branch; component tests
npm run e2e          # playwright: pull → copy → edit → republish round-trip
npx tsc --noEmit     # strict type check
npm run lint         # eslint: extension-boundary rule still green (no auth/boot imports)
```

✅ Expected: all green, and the bundle-size/cold-start budget still under 3 s
(CodeMirror 6 was chosen to stay within it).
