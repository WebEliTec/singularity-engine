---
title:    Delta D7 — ContentClassWorkbench Sketch
status:   archived
date:     2026-05-28
scope:    Resolved the four open D7 calls (scope, sub-manager nav, sub-manager order, class id plumbing) before workbench implementation began.
parent:   ../delta_implementation_plan_content_class_management.md
executed: 2026-05-28 (commit 66775ec; see parent plan's D7 "As landed" note)
---

# Delta D7 — ContentClassWorkbench Sketch

*Pre-execution sketch per the framework's bottom-up rule: the parent
plan listed D7's open architectural calls; this sketch resolves them
so implementation can start with a single coherent target.*

---

## What this sketch resolves

| # | Call | Resolution |
|---|---|---|
| 1 | Scope: Minimal vs Full | **Minimal** |
| 2 | Sub-manager navigation: Tabs vs Nested rail | **Tabs** (deviates from plan lean) |
| 3 | Sub-manager order | Attributes · Traits · Composition · Relations · Taxonomies |
| 4 | Class id plumbing | **Athene holds `currentClassId`; Workbench reads on mount** |

The page-node-shape call (A/B/C) was already settled at D2 — workbench is its own page-node, sibling to Home and ContentClassRegistry.

---

## 1. Scope — Minimal

**Decision:** Minimal. Workbench shell ships with one functional sub-manager (Attributes, lands D9) and four visible-but-inert placeholders.

**Why:**
- Forward progress over theoretical completeness. The shell pattern validates with one real sub-manager; the others earn their way in as they're needed.
- ASV picker deferred: Attributes defaults to "latest draft ASV" on the backend. UI for ASV selection lands when we need it (D8 or later).
- Visible-but-inert placeholders preserve the visual structure so the user understands "this surface is for managing this class's everything" without us building everything at once.

**What "Minimal" means concretely for D7's shell:**
- PageHeaderAlpha with `title = class.displayName` (e.g., "Organization").
- Tab strip below the header — 5 tabs, one active.
- Content area below the tabs — empty placeholder for D7 ("Attributes coming in D9"), populated incrementally.
- No ASV picker.
- No in-workbench class switcher (user navigates via Home).

---

## 2. Sub-manager navigation — Tabs (deviates from plan lean)

**Decision:** Horizontal tabs at the top of the workbench, below the PageHeaderAlpha.

**Why deviate from the plan's "nested left rail" lean:**
- **Visual nesting concern.** When the Attributes sub-manager renders (D9), it'll mount Hermes/Attribute, which has its *own* left rail (the resource list). A workbench-level left rail would mean **two vertical rails** side-by-side inside the page-node, plus the global Sidebar. Three rails on screen is too much.
- **Tabs match the semantics.** Sub-managers are *views of the same class* (Attributes view, Traits view, Composition view, …) — that's exactly what tabs are for. A rail typically lists *resources*; a tab strip typically navigates *views*.
- **content-management-hub used tabs** for this exact surface (`ClassTopBar.jsx`). The earlier app had the same instinct.

**Visual layout (Minimal scope, Attributes tab active):**
```
┌─[ Sidebar ]─┬───────────────────────────────────────────┐
│  ⌂ Home    │  [Logo] Organization                       │ ← PageHeaderAlpha
│  ≡ Manage  │                                            │
│            │  ┌─────────────────────────────────────┐   │
│            │  │ Attributes │ Traits │ Comp │ Rel │ Tax │ │ ← Tabs
│            │  └─────────────────────────────────────┘   │
│            │                                            │
│            │  ┌────────────────────────────────────┐    │
│            │  │   [Hermes/Attribute rail+body]    │    │ ← Content area
│            │  │   (D9 — D7 ships placeholder)     │    │
│            │  └────────────────────────────────────┘    │
└────────────┴────────────────────────────────────────────┘
```

**Active-tab state:** `currentSubManager` signal on the workbench node. Default `'attributes'`. Reading: `_.getSignal('currentSubManager')`. Click sets it via `_.setSignal('currentSubManager', '<id>')`.

**Tab visual:** new `TabBarAlpha` global component? Or inline JSX in the workbench? **Lean inline** for D7 — if a second consumer appears, extract then. (The component-naming convention says don't extract speculatively.)

---

## 3. Sub-manager order

**Decision:** `Attributes | Traits | Composition | Relations | Taxonomies`

**Why this order:**
- **Attributes first** — most fundamental concept (a class's fields). Also the first one we're building.
- **Traits next** — reusable attribute groups attached to a class.
- **Composition** — how attributes display/layout. Refines Attributes + Traits.
- **Relations** — links between classes. Outward-facing.
- **Taxonomies** — categorical metadata. Crosscutting.

Order reflects "innermost to outermost" — start with what the class *has*, work toward how it *relates*.

**ASV picker is not a tab.** When ASV selection lands, it'll appear *inside* the Attributes tab (and possibly inside Composition), since ASVs scope attribute definitions, not the class's relations or taxonomies.

---

## 4. Class id plumbing

**Decision:** Athene holds `currentClassId`; workbench reads it on `nodeDidMount`, populates its own `classId` signal.

**Mechanism:**

```
User clicks "Organization" in Home's list
  │
  ▼
App.athene.goToContentClassWorkbench('organization')
  │  ├─ this.currentClassId = 'organization'      ← stash the id on Athene
  │  └─ this.rootKernel.setSignal('currentSurface', 'classWorkbench')
  ▼
Root.jsx re-renders → dispatches to <Node id="ContentClassWorkbench" />
  ▼
Workbench mounts
  ├─ nodeDidMount(kernel):
  │     const id = kernel.app.athene.currentClassId;
  │     kernel.setSignal('classId', id);
  │     // (D9+: load class detail, etc.)
  ▼
Workbench/Root.jsx reads `classId` signal → renders header with class name
```

**Why this shape:**
- Cross-node communication routes through Athene (the app-level orchestrator). Matches how navigation already works.
- Each workbench mount is fresh — going Home → ClassA → Home → ClassB unmounts and remounts the workbench, picking up the new id cleanly.
- No need for morpheus's `instance` system. The workbench has one Default instance; the class id is carried in a signal. Simpler than minting an instance per content class id (which mixes static-registry semantics with user-data IDs).

**Future enhancement (deferred):** an in-workbench class switcher would update `classId` directly without remounting. Not needed for D7's minimum acceptance.

---

## Phase ordering — what D7 ships vs what comes later

**D7 ships (workbench shell):**
- New page-node `ContentClassWorkbench` (`.node.jsx` + `Root.jsx`).
- Athene gains `currentClassId` property + updates `goToContentClassWorkbench(id)` to set it + flip surface.
- Root.jsx dispatch adds `'classWorkbench': 'ContentClassWorkbench'`.
- Workbench/Root.jsx renders: `PageHeaderAlpha` (title = class displayName), tab strip (5 tabs, Attributes active by default), empty content area with a "coming in D9" placeholder.
- Tab clicks flip a `currentSubManager` signal; content area dispatches off it (each non-active sub-manager shows "coming soon" placeholder for now).

**D7 explicitly does *not* ship:**
- Hermes/Attribute mount (that's D9).
- ASV picker (deferred).
- Functional Traits/Composition/Relations/Taxonomies (D10+).
- In-workbench class switcher.

---

## Acceptance

- Click a class in Home → land on the workbench scoped to that class.
- Header shows the class display name; tabs are visible with Attributes active.
- Click any tab → active tab switches; content area changes its placeholder text accordingly.
- Sidebar's `≡ Manage Content Classes` still works (navigates to registry).
- Sidebar's `⌂ Home` still works (returns to Home).
- Reload → returns to Home (no nav persistence, consistent with prior phases).
- Page-node fade-in fires on transition into the workbench.

---

## Risks / known unknowns

- **`displayName` source on the workbench side.** The workbench needs the class's display name for the header but only has the id at mount time. Options: (a) read from `Athene.contentClassManager.getSingleContentClass(id)` after `loadAllContentClasses()` has populated it; (b) load lazily. **Lean:** (a) — by the time the workbench mounts, Home has already triggered `loadAllContentClasses` and the manager is warm.
- **Tab strip styling.** Need to match the engine aesthetic (cyan + dark gradient) without reusing PanelAlpha/ListAlpha which are too "list-y." Will write inline SCSS for the tab strip in `_content-class-workbench.scss`.
- **Sub-manager state isolation.** If the user switches tabs and back, should each tab remember its internal state (scroll position, mode, etc.)? For D7 placeholders this is moot. For D9+ it matters and the answer is probably "tabs use signals on the workbench kernel, state survives tab switches."
