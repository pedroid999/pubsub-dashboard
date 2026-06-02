# Contract: SearchableList (keyboard nav + match highlight)

**Modules**: `src/client/components/ResourceList.tsx` (REWRITE),
`src/client/lib/searchListNav.ts` (NEW, pure)
**Traces**: FR-016, FR-017 · US5 · feature-002 preservation

## Filtering & highlight

- **L1** Given a resource list, When the user types a filter, Then the list narrows
  to matching items and the matched substring is highlighted in each row.
- **L2** The Topics and Subscriptions lists keep **independent** filter and
  selection state (feature 002, FR-016).

## Bounded layout (the original layout bug)

- **L3** Given a selected topic/subscription, When the lists render, Then each list
  has a **bounded height with its own scroll**, and the publisher/receiver editors
  remain visible (lists never push editors off-screen).

## Keyboard navigation (FR-017)

- **L4** `ArrowDown`/`ArrowUp` move the active row by ±1, clamped to
  `[0, len-1]`; the active row is scrolled into view via manual `scrollTop`
  (never `scrollIntoView`).
- **L5** `Home`/`End` jump to the first/last item.
- **L6** `Enter` selects the active item → sets it as the active context
  (dispatches the matching `resourceContext` action).
- **L7** `Escape` clears the filter when non-empty (and does not propagate);
  when the filter is already empty it is a no-op.
- **L8** `MouseEnter` over a row updates the active index (hover and keyboard share
  one active state).

## Correctness (pure core)

- **L9** `searchListNav` `move(active, delta|absolute, len)` returns a clamped
  index for all inputs (empty list → 0; out-of-range → clamped); unit-tested to
  ≥90% branch.
- **L10** Rapid successive keypresses select the correct item because handlers read
  the active **ref**, not a stale state closure.
- **L11** Changing the query resets the active index to 0 and re-clamps the ref.

## Triptych tabs (FR-011)

- **L12** In the Triptych layout, switching between the Topics and Subscriptions
  tabs preserves each tab's own filter text and selection.
