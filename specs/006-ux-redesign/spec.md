# Feature Specification: Complete UX Redesign — "Kanagawa × Blade Runner"

**Feature Branch**: `006-ux-redesign`

**Created**: 2026-06-01

**Status**: Draft

**Input**: User description: "queremos rediseñar el UX de la aplicación completamente, el diseño que vamos a aplicar a la app está en `.claude/redesign`" — a Claude Design handoff bundle containing an HTML/CSS/JS prototype of a fully reimagined Pub/Sub Dashboard with a "Kanagawa × Blade Runner" visual language (Japanese ink palette + neon cyberpunk accents), multiple workspace layouts, a command palette, keyboard-navigable resource lists, live JSON syntax highlighting, and an appearance-customization surface.

## Clarifications

### Session 2026-06-01

- Q: Should appearance/layout customization ship as a persistent user-facing settings surface, or a single fixed configuration? → A: Curated subset — theme + density + accent + layout are user-configurable and persistent; neon intensity + scanlines are fixed defaults (FR-014/FR-015).
- Q: What is the scope of the ⌘K command palette? → A: Navigation-only — it lists and selects projects/topics/subscriptions; it does NOT expose global actions or resource operations (those are out of scope for this feature).
- Q: With auto-poll appending messages, does the receiver running list cap or grow until Clear? → A: Cap at a fixed maximum of the 60 newest messages, dropping the oldest; explicit Clear still empties it.
- Q: What is the auto-poll interval? → A: 2.5 seconds (fixed).

## User Scenarios & Testing *(mandatory)*

<!--
  This is a redesign: every existing capability (project/topic/subscription
  browsing & selection from feature 002, publish + attributes + validation and
  pull + acknowledge from feature 003, JSON composer + copy-to-republish from
  feature 005, and the light/dark theme from feature 004) MUST survive the
  redesign unchanged in behavior. The stories below re-skin and enrich that
  surface; they do not remove any current functionality.
-->

### User Story 1 — Experience the redesigned dashboard with all current capabilities intact (Priority: P1)

A returning developer opens the dashboard and finds it visually transformed into the new "Kanagawa × Blade Runner" language — a deep "Sumi Ink" dark theme and a "Lotus washi" light theme, neon accent colors, refined typography, and panelized layout — yet every task they already rely on (pick a project, browse and filter topics/subscriptions, set an active topic/subscription, publish a message with attributes, pull and acknowledge messages, copy a received message to republish, switch light/dark) works exactly as before.

**Why this priority**: The redesign's first duty is "do no harm" — a beautiful shell that breaks the existing workflow is a regression. Re-skinning the existing, shipped functionality is the core deliverable and the MVP; every other story layers on top of it.

**Independent Test**: With the new design applied, a user completes the full feature-002/003/005 workflow end-to-end (select project → select topic & subscription → publish with an attribute → pull → copy-to-republish → acknowledge) and switches light/dark, with no loss of any current capability.

**Acceptance Scenarios**:

1. **Given** the redesigned app loads, **When** the user views the dashboard, **Then** the new visual language (dark "Sumi Ink" by default, neon accents, refined typography, panel framing) is applied across header, context bar, resource panels, publisher, and receiver.
2. **Given** the redesign is applied, **When** the user selects a project, then a topic and a subscription, **Then** the active context updates and is reflected exactly as in feature 002, with the new styling.
3. **Given** an active topic, **When** the user composes and publishes a message with attributes, **Then** publishing succeeds and shows the returned message ID, preserving all feature-003 behaviors (validation, error handling, preserve-on-success/failure).
4. **Given** an active subscription, **When** the user pulls and acknowledges messages, **Then** pull/ack behave exactly as feature 003, restyled.
5. **Given** a received message, **When** the user copies it to publish, **Then** the feature-005 copy-to-republish flow loads payload + attributes into the composer, restyled.
6. **Given** either theme, **When** the user toggles light/dark, **Then** the theme switches between "Sumi Ink" (dark) and "Lotus washi" (light) and the preference persists as in feature 004.

---

### User Story 2 — Jump to any resource with a command palette (Priority: P1)

The user presses ⌘K (Ctrl+K on Windows/Linux), and a centered command palette opens with a search box and a keyboard-navigable list of every project, topic, and subscription. Typing filters the list; arrow keys move the selection; Enter activates it (selecting the project, topic, or subscription); Escape closes the palette. The palette is navigation-only — it selects resources, not actions or operations.

**Why this priority**: Fast keyboard-first navigation is the single biggest productivity upgrade in the redesign and a signature of the new experience. For developers juggling many projects and hundreds of resources, a palette replaces slow click-hunting and defines the tool's "power-user" character.

**Independent Test**: From anywhere in the app, the user presses ⌘K, types part of a topic name, navigates with arrows, presses Enter, and the corresponding topic becomes the active context; pressing Escape at any point closes the palette without side effects.

**Acceptance Scenarios**:

1. **Given** the app is focused, **When** the user presses ⌘K / Ctrl+K, **Then** the command palette opens centered with the search field focused.
2. **Given** the palette is open, **When** the user types a query, **Then** the list filters to projects/topics/subscriptions whose name or parent matches, with the match visually highlighted.
3. **Given** filtered results, **When** the user presses ArrowDown/ArrowUp, **Then** the active row moves and stays scrolled into view; **When** the user presses Enter, **Then** the active item is activated (project/topic/subscription selected) and the palette closes.
4. **Given** the palette is open, **When** the user presses Escape or clicks outside, **Then** the palette closes and no selection changes.
5. **Given** a query with no matches, **When** results are empty, **Then** an explicit empty state is shown and Enter does nothing.

---

### User Story 3 — Choose a workspace layout (Priority: P2)

The user selects among multiple arrangements of the same panels: **Rail** (a left resource rail with topics over subscriptions, beside a publisher/receiver pair), **Triptych** (three equal columns: a tabbed topics/subscriptions panel, publisher, receiver), and **Console** (resources across the top, publisher/receiver beneath). The chosen layout reflows the workspace without changing any data or capability.

**Why this priority**: Different debugging tasks favor different spatial arrangements; offering layouts is a meaningful ergonomics win, but the app is fully usable with a single sensible default, so this is P2.

**Independent Test**: The user switches from Rail to Triptych to Console and confirms that in each, all panels (resources, publisher, receiver) remain present and functional, and the active selection is preserved across switches.

**Acceptance Scenarios**:

1. **Given** the default layout, **When** the user selects another layout, **Then** the panels reflow into that arrangement with no loss of the active project/topic/subscription or composed draft.
2. **Given** the Triptych layout, **When** resources are shown as a tabbed panel, **Then** the user can switch between Topics and Subscriptions tabs, each keeping its own filter and selection.
3. **Given** any layout, **When** the workspace renders, **Then** publisher and receiver remain simultaneously reachable (Console/Rail) or via the three-column split (Triptych).

---

### User Story 4 — Personalize the appearance: density & accent (Priority: P2)

The user opens an appearance/customization surface and adjusts: information **density** (compact / regular / cozy) and **accent color** (cyan / magenta / amber / violet). Choices apply immediately and persist across sessions. Neon intensity and scanlines/grain are NOT user-configurable — they ship at a fixed, tasteful default (see FR-014).

**Why this priority**: Personalization deepens the product's identity and accessibility (density), but the app ships a strong default configuration, so customization is an enhancement rather than a prerequisite.

**Independent Test**: The user changes density and accent, reloads the app, and confirms each choice persisted and is reflected throughout the UI.

**Acceptance Scenarios**:

1. **Given** the customization surface, **When** the user changes density, **Then** spacing, paddings, and base font sizes adjust consistently across all panels.
2. **Given** the customization surface, **When** the user changes the accent color, **Then** the primary accent (highlights, focus, active states) updates everywhere it is used.
3. **Given** any customization change, **When** the user reloads the app, **Then** the chosen density and accent persist (consistent with the preference persistence established in feature 004).

---

### User Story 5 — Navigate resource lists by keyboard with match highlighting (Priority: P2)

Within the topics and subscriptions panels, the user filters by typing; the matching substring is highlighted in each result; and the list is fully keyboard-navigable (↑/↓ to move, Enter to select, Home/End to jump, Escape to clear), with the active row always kept in view.

**Why this priority**: Keyboard-first list navigation and visible match highlighting make day-to-day resource selection far faster; the lists already work via mouse, so this is a P2 refinement aligned with the palette's keyboard ethos.

**Independent Test**: In the topics panel, the user types a filter, sees the matched text highlighted, moves the active row with arrows, and selects with Enter — all without using the mouse.

**Acceptance Scenarios**:

1. **Given** a resource panel, **When** the user types a filter, **Then** the list narrows to matches and the matched substring is highlighted in each row; the topic and subscription filters remain independent (feature 002).
2. **Given** a filtered list, **When** the user presses ↑/↓/Home/End, **Then** the active row moves accordingly and scrolls into view without jarring jumps.
3. **Given** an active row, **When** the user presses Enter, **Then** that resource becomes the active context.
4. **Given** filter text, **When** the user presses Escape, **Then** the filter clears and the full list returns.

---

### User Story 6 — Compose JSON with live syntax highlighting (Priority: P2)

While composing a message body in JSON mode, the user sees the JSON **syntax-highlighted live** (keys, strings, numbers, booleans, null, punctuation in distinct accent colors) as they type, alongside the live validity indicator and Format action delivered in feature 005. Invalid JSON still blocks publish; highlighting is display-only and never alters the bytes sent.

**Why this priority**: Syntax coloring materially improves readability and error-spotting in the composer — the centerpiece of the publish workflow — but the composer is already functional (feature 005), so this is a P2 visual enhancement, deliberately implemented as a lightweight overlay (not a heavyweight embedded editor), consistent with feature 005's no-heavy-editor decision.

**Independent Test**: In JSON mode, the user types a JSON object and sees keys/strings/numbers colored distinctly; making it invalid keeps the existing invalid indicator and blocks publish; the published payload equals the exact text shown.

**Acceptance Scenarios**:

1. **Given** JSON mode, **When** the user types a JSON body, **Then** the tokens (keys, strings, numbers, booleans, null, punctuation) are colored distinctly and the coloring stays aligned with the editable text.
2. **Given** a syntactically invalid body, **When** highlighting renders, **Then** the feature-005 invalid indicator and publish-block still apply (highlighting does not mask validation).
3. **Given** a valid highlighted body, **When** the user publishes, **Then** the exact text shown is sent as the payload (FR-006 of feature 005 preserved).
4. **Given** plain-text mode, **When** the user composes, **Then** no JSON highlighting is applied (free text, as in feature 005).

---

### User Story 7 — Auto-poll a subscription (Priority: P3)

In the receiver, the user toggles an **Auto** mode that automatically pulls the active subscription on a fixed short interval, appending new messages to the running list, with a clear active indicator; toggling Auto off stops the polling. Manual pull remains available at all times.

**Why this priority**: Continuous monitoring is convenient when watching a live subscription, but it is an additive convenience over the explicit, on-demand pull that already covers the core inspect loop, so it is P3. It must remain opt-in and clearly indicated so it never surprises the user with background activity.

**Independent Test**: The user enables Auto on an active subscription, observes new messages arriving without manual clicks while the active indicator shows, then disables Auto and confirms polling stops.

**Acceptance Scenarios**:

1. **Given** an active subscription, **When** the user enables Auto, **Then** the system pulls every 2.5 seconds and appends results to the running list (capped at the 60 newest, oldest dropped), showing an active/polling indicator.
2. **Given** Auto is on, **When** the user disables it, **Then** automatic polling stops immediately and only manual pull remains.
3. **Given** Auto is on, **When** the active subscription changes, **Then** auto-polling resets for the new subscription and does not mix messages across subscriptions (consistent with feature 003 FR-023).
4. **Given** Auto polling, **When** a pull fails, **Then** the error is surfaced as in feature 003 and auto-polling pauses pending user action rather than silently retrying forever.

---

### User Story 8 — Orient via header, context bar, and status feedback (Priority: P3)

The header presents the brand, a project switcher dropdown, an ADC connection status indicator, a command-palette affordance (⌘K), and the theme toggle. A context breadcrumb bar always shows the current Project · Topic · Subscription. Transient actions (e.g., "message published", "copied to publisher") surface as brief, non-blocking status flashes.

**Why this priority**: Persistent orientation and lightweight feedback round out the experience and reduce "where am I / did that work?" friction, but they are supporting affordances around the core workflow, so P3.

**Independent Test**: The user changes project via the header switcher, sees the breadcrumb update, performs a copy-to-publish, and sees a brief confirmation flash that auto-dismisses.

**Acceptance Scenarios**:

1. **Given** the header, **When** the app is connected via ADC, **Then** a connection status indicator is shown; the project switcher lists projects and switches the active one.
2. **Given** any selection state, **When** the context bar renders, **Then** it shows the active Project, Topic (or "none"), and Subscription (or "none").
3. **Given** a completed action (publish, copy-to-publish), **When** it succeeds, **Then** a brief non-blocking status flash appears and auto-dismisses after a short delay.

---

### Edge Cases

- **Reduced motion / accessibility**: Users who prefer reduced motion get the neon/scanline ambience minimized or disabled, and all interactive targets remain keyboard-reachable with visible focus.
- **Light theme legibility**: The "Lotus washi" light theme MUST keep neon accents legible (sufficient contrast) rather than washing them out.
- **Very long resource lists**: Filtering plus keyboard navigation keeps the active row in view; the list remains responsive at typical Pub/Sub scales (consistent with feature 002's no-virtualization decision unless a real perf issue appears).
- **Command palette with empty data**: With no topics/subscriptions in a project, the palette still opens and shows only projects (and an empty state for resource queries).
- **Layout switch mid-compose**: Switching layout never discards a composed draft, the pulled message list, or the active selection.
- **Auto-poll left running**: Auto mode is always visibly indicated and stops on subscription change, navigation away, or explicit toggle — it must never poll invisibly.
- **Theme/customization first paint**: The persisted theme and customization apply on first paint without a visible flash of the wrong theme.
- **Bilingual labels**: Japanese accent labels are decorative brand elements and MUST NOT replace the primary (Spanish/English) labels that convey meaning.

## Requirements *(mandatory)*

### Functional Requirements

**Visual language & preservation**

- **FR-001**: The system MUST apply the new "Kanagawa × Blade Runner" visual language across the entire application surface (header, context bar, resource panels, publisher, receiver, dialogs), in both a dark ("Sumi Ink") and a light ("Lotus washi") theme.
- **FR-002**: The redesign MUST preserve every existing capability without behavioral regression: project discovery/selection (feature 002), topic/subscription browsing, filtering, and active-context selection (feature 002), publish with attributes + validation and pull + acknowledge (feature 003), JSON composer + copy-to-republish (feature 005), and light/dark theming with persistence (feature 004).
- **FR-003**: The system MUST default to the dark theme and allow toggling to light, persisting the choice across sessions (feature 004 persistence reused).
- **FR-004**: Accent colors, glows, and ambient effects MUST maintain sufficient contrast and legibility in both themes, and MUST honor a reduced-motion preference by minimizing or disabling animated/neon/scanline effects.

**Command palette**

- **FR-005**: The system MUST provide a global command palette opened by ⌘K (macOS) / Ctrl+K (other platforms) from anywhere in the app, with the search field focused on open.
- **FR-006**: The palette MUST list all projects, topics, and subscriptions and filter them by typed query against name and parent, highlighting the matched substring. The palette is **navigation-only**: it selects a project/topic/subscription and MUST NOT expose global actions (e.g., toggle theme, switch layout) or resource operations (e.g., publish, pull) — those are out of scope for this feature.
- **FR-007**: The palette MUST be fully keyboard-operable: ArrowUp/ArrowDown move the active row (kept in view), Enter activates it (selecting project/topic/subscription), Escape or outside-click closes it without side effects.
- **FR-008**: The palette MUST present a distinct empty state when no results match, and activating with no results MUST do nothing.

**Layouts**

- **FR-009**: The system MUST offer multiple workspace layouts — at minimum Rail, Triptych, and Console — arranging the same resource/publisher/receiver panels differently.
- **FR-010**: Switching layout MUST preserve the active project/topic/subscription, the composed draft, and the pulled-message list (no data loss on reflow). The chosen layout MUST persist across sessions (part of the settings surface in FR-015).
- **FR-011**: In the Triptych layout, resources MUST be presented as a tabbed Topics/Subscriptions panel, each tab keeping its own independent filter and selection.

**Appearance customization**

- **FR-012**: The system MUST let the user adjust information density (compact / regular / cozy), and the choice MUST consistently affect spacing, padding, and base font sizes across all panels.
- **FR-013**: The system MUST let the user choose an accent color from a defined set (at minimum cyan, magenta, amber, violet), applied wherever the primary accent is used.
- **FR-014**: Neon/glow intensity and the scanlines/grain ambient overlay MUST ship at a fixed, tasteful default and are NOT user-configurable. (They remain subject to the reduced-motion behavior in FR-004.)
- **FR-015**: The product MUST ship a user-facing settings surface that persists the user's choices for **theme (dark/light), density, accent color, and workspace layout** across sessions, applying them on first paint without a flash of the wrong appearance. Neon intensity and scanlines are excluded from this surface (FR-014). *(Resolved: curated-subset configurability — density + accent + layout + theme are configurable and persistent; neon/scanlines are fixed defaults.)*

**Resource lists**

- **FR-016**: Topic and subscription lists MUST support type-to-filter with the matched substring highlighted in each result, keeping the two filters independent (feature 002).
- **FR-017**: Resource lists MUST be keyboard-navigable (↑/↓ to move, Home/End to jump, Enter to select, Escape to clear filter), keeping the active row scrolled into view.

**JSON composing**

- **FR-018**: In JSON mode, the composer MUST render the body with live syntax highlighting (distinct treatment for keys, strings, numbers, booleans, null, punctuation), kept aligned with the editable text, while preserving feature-005 validity gating and Format.
- **FR-019**: Syntax highlighting MUST be display-only and MUST NOT alter the bytes published (feature 005 FR-006 preserved); plain-text mode applies no highlighting.

**Receiver auto-poll**

- **FR-020**: The receiver MUST offer an opt-in Auto mode that pulls the active subscription on a fixed **2.5-second** interval, appends results to the running list, and shows a clear active indicator. The running list MUST be capped at the **60 newest** messages (oldest dropped beyond the cap); the explicit Clear action still empties it.
- **FR-021**: Auto mode MUST stop on explicit toggle-off, on active-subscription change, and when leaving the receiver context; it MUST never poll invisibly, and a failed auto-pull MUST surface the error and pause rather than retry indefinitely.

**Orientation & feedback**

- **FR-022**: The header MUST present the brand, a project switcher, an ADC connection status indicator, a command-palette affordance, and the theme toggle; the context bar MUST always show the active Project · Topic · Subscription (with explicit "none" states).
- **FR-023**: Completed actions (e.g., publish, copy-to-publish) MUST surface a brief, non-blocking status flash that auto-dismisses.
- **FR-024**: Japanese bilingual labels MAY appear as decorative brand accents but MUST NOT replace the primary meaning-bearing labels.

**Non-functional / constraints**

- **FR-025**: The redesign MUST remain local-first with no new external data sinks or telemetry; any fonts/assets the new look requires MUST be served locally (no third-party CDN dependency at runtime), consistent with the project's local-first, outbound-limited posture.
- **FR-026**: The redesign MUST keep the application a single locally-served experience and MUST NOT introduce a separate backend or change the authentication/boot path; it consumes the existing data and auth surfaces only.

### Key Entities *(include if feature involves data)*

- **Appearance Preferences**: The user's persisted look-and-feel choices — theme (dark/light), density (compact/regular/cozy), accent (cyan/magenta/amber/violet), and workspace layout (rail/triptych/console). Neon intensity and scanlines are NOT stored (fixed defaults, FR-014). Extends the preference store established in feature 004.
- **Command Palette Entry**: A searchable, activatable reference to a project, topic, or subscription — carries a display label, a secondary/parent label, a kind (project/topic/subscription), and the selection action it performs.
- **Workspace Layout**: A named arrangement (Rail / Triptych / Console) of the resource, publisher, and receiver panels; selecting one reflows the workspace without altering data or selection.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the workflows shipped in features 002, 003, 004, and 005 remain completable after the redesign, with zero loss of capability (verified by the existing acceptance flows passing against the new UI).
- **SC-002**: A user can navigate to any project, topic, or subscription using only the keyboard via the command palette in 3 or fewer keystrokes after opening it (open → type → Enter).
- **SC-003**: A user can switch between all offered layouts and confirm the active selection and composed draft survive every switch, in under 5 seconds total.
- **SC-004**: Every appearance choice the user makes (theme, density, accent, layout) persists across a full reload and is visible on first paint with no flash of the wrong appearance.
- **SC-005**: In JSON mode, a malformed body is still impossible to publish, and the live highlighting never changes the published bytes versus the text shown (byte-for-byte identical).
- **SC-006**: Auto-poll never runs without a visible active indicator, and disabling it (or changing subscription) stops it within one poll interval — in usability testing, zero instances of unexpected background polling.
- **SC-007**: Both themes meet a legibility bar (accent text and primary text remain readable) and the app remains fully operable with reduced motion enabled.
- **SC-008**: No runtime third-party network request is introduced by the redesign (fonts/assets are local); the app stays local-first.

## Assumptions

- This redesign builds on the shipped features 001–005; it restyles and enriches their UX but does not change server endpoints, the auth/boot path, or the messaging contracts. It SHOULD land after feature 005 is merged, since it restyles the feature-005 composer and copy-to-republish.
- The prototype's mock data and in-browser simulation (auto-pull latency, fake pulls) stand in for the real backend; the production redesign wires the same UI to the existing live data/services.
- "Complete UX redesign" is interpreted as including the prototype's net-new interaction patterns (command palette, layouts, keyboard list navigation, live JSON highlighting, auto-poll, customization), not merely a recoloring; preserving existing functionality takes precedence over any net-new behavior where they conflict.
- Live JSON syntax highlighting is implemented as a lightweight presentation overlay over the existing textarea-based composer, NOT a heavyweight embedded code editor — consistent with feature 005's deliberate decision to avoid a heavy editor dependency.
- Japanese labels (e.g., パブサブ, トピック, サブスク, 送信, 受信) are decorative bilingual brand accents; the app's functional language remains as today (Spanish/English labels carry meaning).
- Required typefaces and any icon/asset sets are bundled and served locally to preserve the local-first, outbound-limited constraint (no third-party CDN at runtime).
- Theme and appearance persistence reuse the single local preferences store established in feature 004; no database or remote state is introduced.
- Accessibility is in scope at a baseline: keyboard reachability of all interactive elements, visible focus, sufficient contrast in both themes, and honoring reduced-motion — even though the aesthetic is intentionally bold.
