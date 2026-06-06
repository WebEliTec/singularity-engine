---
title:   Deferred Frontend Follow-ups — adapt once Apollo backend security is in place
status:  LIVING backlog. Items here are deliberately POSTPONED per the backend-security-first principle. None are committed-to yet; revisit as a single pass when Apollo is feature-complete.
date:    2026-06-02
owner:   Daniel
relates: beta_implementation_plan_apollo.md (backend roadmap gating this list); origin = the 2026-06-01 traits-feature review (fixes shipped in athene b1f1976 + apollo 59b32a0; findings report retired)
---

# Deferred Frontend Follow-ups

A "don't forget" list of frontend changes we are **intentionally deferring**
until the Apollo backend is feature-complete — then doing in **one pass**.

## Why these are deferred (the principle)

**Backend-security-first** (Daniel, 2026-06-02). Apollo is the security boundary
/ source of truth; enforce all security + validation **there first**. The
frontend's job — making its affordances *honest* (never offering an action the
backend will reject) and its validation consistent with the backend — is adapted
**after** the backend rules are settled.

*Rationale:* the backend's 4xx already keeps data safe (e.g. a `409` on a
committed-version mutation), so a "dishonest" frontend affordance is a **UX gap,
not a security hole**. Keeping two enforcement layers in sync while the backend
is still growing is churn — so we let Apollo lead, and adapt the UI once.

> **Scope boundary — read this before adding items.** This list is for
> **affordance / gating** gaps: the UI *offers* a control the backend rejects.
> It is **NOT** for frontend **crashes / correctness** bugs — those happen before
> any request reaches Apollo, so they're fixed *regardless* of backend status
> (don't park them here). Example: review finding **MF-4** had two halves — the
> raw-`TypeError` crash-guard was a *non-deferred* fix (shipped in athene commit
> `b1f1976`), while only its affordance-gating half (FE-2 below) belongs here.

## What "adapt the frontend" will mean

Sweep every Hermes / Chronos affordance + the client validation so the user is
**never offered an action Apollo will reject** (no post-submit `409`/`400`
surprises), and client-side validation **mirrors or defers to** the backend's
enforced rules. The items below become that pass's checklist.

---

## Deferred items

### FE-1 · Committed versions must disable Edit / Delete / New (immutability gating)

- **Source:** review finding **MF-3**.
- **Backend rule it must mirror:** Apollo returns **409** on any mutation of a
  **committed** ASV/TASV (`…committed; its attributes are immutable`).
- **Current frontend gap:** Hermes never reads the selected version's lifecycle
  stage, so `ViewHeader`'s Edit/Delete (`canEdit`) and `ResourceList`'s "New
  {singular}" pivot stay **enabled on a committed version** — the user only
  learns it's immutable *after* Save. (Chronos's `ActionRow` already hides
  Commit/Delete via its `isDraft` gate, so the two engines currently disagree.)
- **Frontend change:** the `Attribute` + `TraitAttribute` instances read the
  resolved version's `isCommitted` (via `_resolveSelectedAsv` /
  `_resolveSelectedTasv` — the version objects already expose it) and surface a
  `readOnly` flag to Hermes → `ViewHeader` disables Edit/Delete and
  `ResourceList` hides the New pivot when the selection is committed. Applies to
  **both** instances (ASV + TASV). Makes the instance `metaData` promise
  ("Editing only works on a draft version…") true *pre-submit*.

### FE-2 · Gate the "New {attribute}" pivot when no draft version is in scope

- **Source:** review finding **MF-4** (the *affordance* half only; the crash
  half is non-deferred — see the scope boundary above).
- **Backend rule it must mirror:** Apollo rejects attribute writes that target a
  missing or committed version; a brand-new trait/class has **no** version until
  one is created (creation auto-seeds none).
- **Current frontend gap:** the "+ New Attribute" pivot is always rendered, even
  when there is no draft version to write into.
- **Frontend change:** hide/disable the New pivot when `_resolveSelectedAsv` /
  `_resolveSelectedTasv` yields no draft version. Overlaps FE-1's `readOnly`
  mechanism, so do them together.

### FE-3 · Exclude the host class from the composition sub-class picker

- **Source:** the 2026-06-03 no-self-composition rule (Apollo now rejects a
  directive whose `subClassId === hostClassId` → 400; see
  `beta_implementation_plan_composition.md` §7).
- **Backend rule it must mirror:** a class cannot compose itself.
- **Current frontend gap:** `Hermes/CompositionDirective`'s `resolveFieldOptions`
  (`nodes/Hermes/Hermes.node.jsx`) sources the sub-class picker from
  `world.entityClasses.getAll()` with **no host filter**, so the host class is
  offered — picking it surfaces a post-submit 400 (a dishonest affordance, not a
  crash). The code comment there already flags this.
- **Frontend change:** filter `currentClassId` out of the `subClassId` options.
  One line; pairs naturally with FE-1's read-only sweep. *(Relations will want the
  same self-exclusion on its partner pickers — fold in when that lands.)*

---

## Watch-list (likely future FE-N items as Apollo grows)

Not concrete yet — add as real gaps appear:

- **Validation parity** — client-side `Validator` rules vs. Apollo's enforced
  validation (kebab ids, `dataType` enum, required fields, future field types).
  Decide per-rule: mirror in the client, or defer to the backend and surface its
  error cleanly.
- **Lifecycle gating for later version axes** — Class Versions, Object Structure
  Versions: same "no editing a committed/locked thing" affordance discipline as
  FE-1, once those land.
- **Eligibility gating** — relation- / source-eligibility once traits' other
  facets ship (only offer a relation/source the backend would accept).

## Cross-links

- The principle: `planning_state` memory ("BACKEND-SECURITY-FIRST").
- Origin of FE-1 / FE-2: the 2026-06-01 traits-feature adversarial review
  (findings **MF-3** + **MF-4**). The crash/correctness fixes shipped in athene
  `b1f1976` + apollo `59b32a0`; these affordance halves are the deferred
  remainder. (The findings report itself was retired once cleared — rationale is
  in those commit messages.)
- Backend roadmap that gates this whole list: `beta_implementation_plan_apollo.md`
  — specifically its **§ "Canonical slice order"**. "Apollo feature-complete"
  (the trigger for this one-pass frontend sweep) = that sequence finished
  (composition → relations → taxonomies → class versions → objects → Data-Pocket).
