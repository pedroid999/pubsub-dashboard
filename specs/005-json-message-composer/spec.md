# Feature Specification: JSON Message Composer & Republish

**Feature Branch**: `005-json-message-composer`

**Created**: 2026-06-01

**Status**: Draft

**Input**: User description: "analiza docs/extension-points.md para ver cual es la siguiente feature a desarrollar" → resolved to the work that feature 003 (Publish & Subscribe) explicitly deferred: **structured/templated JSON composition with validation** and **"copy a received message to republish"**. Feature 003 deferred this to "feature 004", but feature 004 became dark/light mode; the deferred messaging-composition work was never built. This feature delivers both deferred capabilities together as the next sequential feature (005), closing the receive → inspect → copy → edit-with-validation → republish debugging loop.

## User Scenarios & Testing *(mandatory)*

<!--
  Builds directly on what is already shipped:
  - Feature 002 (GCP Resource Browser): active context (project + topic/subscription).
  - Feature 003 (Publish & Subscribe): MessagePublisher (free-text body + attributes)
    and MessageReceiver (pull batch, pretty-printed JSON display).
  This feature upgrades the publish composer from free text to a validated JSON
  editor and connects the receive panel back into it via "copy to republish".
-->

### User Story 1 — Compose a Message Body as Validated JSON (Priority: P1)

A developer using the publish panel chooses to compose the message body as structured JSON. As they type, the editor tells them whether the body is valid JSON, where any syntax error is, and lets them format (pretty-print) the body on demand. They publish only once the body is well-formed, so they stop sending malformed test payloads by accident.

**Why this priority**: Today the publish body is opaque free text — a developer can fat-finger a comma and publish broken JSON to a topic without warning, then waste time debugging the wrong end. Validated composition is the single highest-value upgrade to the existing publish loop and the foundation the "republish" flow (US2) plugs into. Without it, the rest of the feature has nothing to compose into.

**Independent Test**: With a topic set as the active context, the user switches the body editor to JSON mode, types an invalid object, sees a clear invalid-JSON indicator and is blocked from publishing; they then fix it (or click "Format"), see the valid indicator, and publish successfully. Fully testable on its own and delivers immediate value.

**Acceptance Scenarios**:

1. **Given** the publish panel is open with a topic as active context, **When** the user enables JSON composition mode, **Then** the body editor switches to a JSON-aware editor showing a live validity indicator (valid / invalid).
2. **Given** the user has typed a syntactically invalid JSON body, **When** the editor evaluates it, **Then** an inline error indicates the body is not valid JSON and identifies the location/reason of the first parse error, and the publish action is blocked.
3. **Given** the user has typed a syntactically valid JSON body, **When** the editor evaluates it, **Then** a valid indicator is shown and the publish action is enabled.
4. **Given** a valid but unformatted/minified JSON body, **When** the user invokes the "Format" action, **Then** the body is rewritten pretty-printed (indented) with no change to its semantic content.
5. **Given** the user has a valid JSON body composed, **When** they publish, **Then** the exact JSON text the editor shows is sent as the message payload (no silent re-serialization that reorders or alters it beyond what the user formatted).
6. **Given** JSON composition mode is enabled, **When** the user toggles back to plain-text mode, **Then** the current body text is preserved as-is and validation is no longer enforced (free text may be published, as in feature 003).

---

### User Story 2 — Copy a Received Message to Republish (Priority: P1)

A developer inspecting a message in the receive panel decides to send it again — unchanged or edited. They invoke "Copy to publish" on that received message; its payload and its attributes are loaded into the publish composer, where they can edit them (with JSON validation from US1) and publish to the active topic.

**Why this priority**: This is the other half of the deferred work and the reason the two capabilities were bundled: the copy action deposits a received payload **into** the JSON composer, so inspect → republish becomes one continuous loop. It is the most common real debugging move — "I saw this message, let me replay it" — and pairing it with validated composition in the same release delivers the full loop.

**Independent Test**: With at least one message displayed in the receive panel, the user clicks "Copy to publish" on it, switches to (or sees) the publish panel pre-filled with that message's payload and attributes, edits one field, and publishes successfully.

**Acceptance Scenarios**:

1. **Given** a received message is displayed in the receive panel, **When** the user invokes its "Copy to publish" action, **Then** the message's decoded payload is loaded into the publish composer's body and its attributes are loaded into the publish attribute rows.
2. **Given** a received message whose payload is valid JSON, **When** it is copied to publish, **Then** the composer opens in JSON mode with the payload pretty-printed and marked valid.
3. **Given** a received message whose payload is not valid JSON, **When** it is copied to publish, **Then** the composer loads the payload as plain text (JSON mode not forced) so the user is not blocked by validation on a non-JSON payload.
4. **Given** the publish composer already contains an unsent body or attributes, **When** the user copies a received message into it, **Then** the system warns that copying will replace the current composition and proceeds only on the user's confirmation (no silent loss of in-progress work).
5. **Given** a received message has been copied into the composer, **When** the user publishes it unchanged, **Then** the republished message carries the same payload and the same attributes as the original received message.
6. **Given** no topic is set as the active context, **When** the user copies a received message to publish, **Then** the composition is loaded but the publish action remains guarded with guidance to select a topic first (consistent with feature 003 FR-009).

---

### User Story 3 — Republish a Copied Message with Edits (Priority: P2)

After copying a received message into the composer, the developer changes part of the payload (e.g., one field value) or adjusts an attribute, relies on JSON validation to confirm the edit is still well-formed, and republishes the modified message.

**Why this priority**: Editing-before-republish is the natural extension of US1+US2 and where most real debugging value lands ("replay this message but with a different userId"). The core copy loop (US2) and validated composition (US1) already deliver value without explicit edit affordances, so this is P2 — it is mostly the composition of the two P1 stories applied to a copied payload.

**Independent Test**: The user copies a JSON received message, edits a single field value, confirms the validity indicator stays valid, publishes, and (via feature 003 pull) confirms the republished message reflects the edit.

**Acceptance Scenarios**:

1. **Given** a valid JSON payload copied into the composer, **When** the user edits a field and the result is still valid JSON, **Then** the valid indicator remains and publish stays enabled.
2. **Given** a valid JSON payload copied into the composer, **When** the user's edit makes the JSON invalid, **Then** the invalid indicator appears and publish is blocked until the body is valid again.
3. **Given** attributes copied from a received message, **When** the user adds, removes, or edits an attribute pair, **Then** the same attribute validation from feature 003 applies (non-empty key and value, unique keys) before publish.
4. **Given** an edited, valid composition, **When** the user publishes, **Then** the published message reflects the edited payload and attributes, and the composition is preserved afterward so the user can iterate again (consistent with feature 003 FR-007).

---

### Edge Cases

- **Empty JSON body in JSON mode**: An empty body in JSON mode is treated as invalid (not valid JSON) and blocks publish with the same inline indicator; the user must enter at least a valid JSON value.
- **Valid JSON that is a primitive**: A body that is a bare JSON primitive (e.g., `"hello"`, `42`, `true`, `null`) is valid JSON and accepted; JSON validity is not restricted to objects/arrays.
- **Very large JSON body**: A composed body that exceeds the messaging service's per-message size limit is blocked before sending with a clear size-limit message (consistent with feature 003), independent of JSON validity.
- **Copy when payload is binary/non-UTF-8**: A received message rendered as a non-text fallback (feature 003 FR-014) either disables "Copy to publish" or copies a safe textual representation, clearly labelled, never loading unusable bytes into the editor silently.
- **Copy overwrites in-progress composition**: Confirmed via US2 AS4 — copying never silently discards unsent work; it requires confirmation when the composer is non-empty.
- **Format on invalid JSON**: Invoking "Format" while the body is invalid JSON does not reformat; instead it surfaces the parse error (formatting requires parseable input).
- **Active context changes after copy**: If the active topic changes after a message is copied into the composer, the composer keeps its content but the publish target updates and is clearly indicated (consistent with feature 003 FR-023), so the user does not republish to the wrong topic unknowingly.
- **Attributes with reserved/duplicate keys on copy**: If a received message's attributes would violate publish validation (e.g., duplicate keys are not possible from a single received message, but empty values may occur), the copied attributes surface the same inline validation as manually entered ones before publish is allowed.

## Requirements *(mandatory)*

### Functional Requirements

**JSON Composition & Validation**

- **FR-001**: System MUST let the user compose the publish message body in a JSON composition mode, distinct from the existing plain-text mode.
- **FR-002**: In JSON mode, the system MUST continuously evaluate the body and display a clear validity indicator distinguishing valid JSON from invalid JSON.
- **FR-003**: When the body is invalid JSON in JSON mode, the system MUST surface an inline error that identifies the reason and location (or first error position) and MUST block the publish action.
- **FR-004**: When the body is valid JSON in JSON mode, the system MUST enable the publish action.
- **FR-005**: System MUST provide a "Format" (pretty-print) action that, given valid JSON, rewrites the body indented without altering its semantic content; on invalid JSON it MUST NOT reformat and MUST surface the parse error instead.
- **FR-006**: When publishing from JSON mode, the system MUST send the JSON text exactly as shown to the user (the validated/formatted body), without silent re-serialization that reorders keys or alters the content beyond the user's own formatting.
- **FR-007**: System MUST allow the user to toggle between JSON mode and plain-text mode, preserving the current body text across the toggle; plain-text mode retains feature 003 behavior (free text, no JSON validation enforced).
- **FR-008**: System MUST treat any well-formed JSON value as valid (objects, arrays, strings, numbers, booleans, null); validity MUST NOT be restricted to objects or arrays.

**Copy a Received Message to Republish**

- **FR-009**: System MUST provide, for each message displayed in the receive panel, an action to copy that message into the publish composer ("Copy to publish").
- **FR-010**: Copying a received message MUST load its decoded payload into the composer body and its attributes into the composer's attribute rows.
- **FR-011**: When a copied message's payload is valid JSON, the system MUST open the composer in JSON mode with the payload pretty-printed and marked valid; when the payload is not valid JSON, the system MUST load it as plain text without forcing JSON mode.
- **FR-012**: When the composer already contains unsent body text or attributes, the system MUST warn that copying will replace the current composition and MUST proceed only after explicit user confirmation; it MUST NOT silently discard in-progress work.
- **FR-013**: A republished message (copied and published unchanged) MUST carry the same payload and the same attributes as the original received message.
- **FR-014**: When a received message's payload is non-text/binary (rendered via feature 003's safe fallback), the system MUST NOT load unusable raw bytes into the editor silently; it MUST either disable copy for that message or load a clearly-labelled safe textual representation.

**Edit & Republish**

- **FR-015**: System MUST allow the user to edit a copied payload and attributes before republishing, applying JSON validation (FR-002–FR-004) to body edits and feature 003's attribute validation (non-empty key/value, unique keys) to attribute edits.
- **FR-016**: After a republish, the system MUST preserve the composed body and attributes so the user can iterate and publish again without re-copying (consistent with feature 003 FR-007).

**Cross-cutting**

- **FR-017**: The composer MUST continue to honor all feature 003 publish guarantees: guarding publish when no topic is active (FR-009), preserving composition on failure (FR-008), surfacing the returned message ID on success (FR-004), and blocking over-size bodies (edge case).
- **FR-018**: The system MUST reflect and clearly indicate the active publish target (topic) at all times, including when the active context changes after a message has been copied into the composer (consistent with feature 003 FR-023).
- **FR-019**: This feature MUST be delivered within the documented extension surface — extending the existing publish/receive UI and schemas — without modifying the boot path or the auth resolution internals, and consuming auth (if any) only through the `auth/index.ts` barrel (per `docs/extension-points.md`).
- **FR-020**: JSON validation, formatting, and copy-to-republish MUST operate entirely client-side on already-pulled/composed data; this feature MUST NOT introduce new server messaging operations beyond the publish path already delivered by feature 003.

### Key Entities *(include if feature involves data)*

- **Composed Message (extended)**: The message under composition. Extends feature 003's Outbound Message with: composition mode (JSON | plain text), and a derived validity state (valid / invalid + error detail) when in JSON mode. Still carries body text and attribute key/value pairs and targets the active topic.
- **Validity State**: The result of evaluating the body in JSON mode — either valid, or invalid with a human-readable reason and a first-error location. Drives the validity indicator and the publish-enabled/blocked state.
- **Copy-to-Publish Action**: A transfer of a Received Message (feature 003) into the Composed Message — mapping decoded payload → body and received attributes → composer attributes, choosing JSON vs plain-text mode based on payload validity, and gated by a replace-confirmation when the composer is non-empty.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user composing in JSON mode can never publish a syntactically invalid JSON body — every invalid body blocks publish with a visible reason; in usability testing, zero malformed-JSON messages are published from JSON mode.
- **SC-002**: A user can turn a minified/unformatted valid JSON body into a readable, indented one in a single "Format" action, with no change to the data.
- **SC-003**: A user can take any received message shown in the receive panel and load it into the publish composer in a single action, then republish it unchanged with its payload and attributes intact.
- **SC-004**: When a copied received message's payload is valid JSON, the composer presents it pretty-printed and ready to edit within the same interaction, with no manual reformatting required.
- **SC-005**: Copying a message into a non-empty composer never silently destroys in-progress work — in usability testing, zero accidental losses of an unsent composition occur.
- **SC-006**: A developer can complete the full debugging loop — pull a message (feature 003), inspect it, copy it to publish, edit one field with validation confirming it stays valid JSON, and republish to the active topic — without leaving the dashboard.
- **SC-007**: The feature introduces no new server-side messaging operation and no auth-path or boot-path change: it is delivered purely within the existing extension surface.

## Assumptions

- This feature builds on the active context delivered by feature 002 and the publish/receive panels delivered by feature 003; it extends those panels rather than reimplementing browsing, selection, or the pull/acknowledge flows.
- The user is authenticated via ADC (feature 001); the dashboard serves a single authenticated Google identity at a time.
- JSON validation and formatting are display/composition concerns performed client-side; the messaging service still receives the body as a payload string, and the service neither enforces nor interprets JSON structure on the publish path.
- "Copy to republish" operates on data already pulled into the receive panel during the browser session; it does not re-fetch the original message from the messaging service.
- Schema validation against a user-supplied JSON Schema, templating/variable substitution, saved message templates, and a message history/library are out of scope for this feature; only free-form JSON validity (well-formedness) and pretty-printing are in scope.
- Copied and composed messages are held in client-side memory for the browser session and are not persisted across page refreshes (consistent with feature 003).
- The plain-text composition mode from feature 003 remains available and unchanged; JSON mode is an additive, opt-in upgrade, not a replacement.
- No new external service calls or IAM permissions beyond those already required by feature 003's publish path are introduced.
