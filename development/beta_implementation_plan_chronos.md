---
title:   Beta Implementation Plan — Chronos Generic Version-Management Engine
status:  E1–E3 executed (ASV engine complete); E5 TraitAttributeSetVersion executed (via Traits beta T3.3, 140fe0e — the engine's instance-agnosticism proven by a 2nd live instance); E4 CompositionSchemeVersion executed (via Composition beta C3, `89826c4` — 3rd live instance, zero engine reshaping); E5+ (ClassVersion, ClassObjectStructureVersion) deferred until their consumers land
date:    2026-05-28
scope:   Build Chronos as a morpheus node — a generic version-management engine, the natural peer to Hermes (generic CRUD engine). Each versioned entity family in the engine (Attribute Set Versions, Composition Scheme Versions, Trait Attribute Set Versions, Class Versions, Class Object Structure Versions) becomes a Chronos instance. Mounts inside the workbench's tab content alongside the Hermes instance for that family. Ships ASV first; the second instance (CSV) earns the pattern; the rest land as their consumers do.
parent:  alpha_implementation_plan.md
depends_on: beta_implementation_plan_world_oop_tree.md, beta_implementation_plan_hermes.md
phases:
  E1:  executed 2026-05-28 — Chronos node + AttributeSetVersion instance + version strip (commit 22bef34)
  E2:  executed 2026-05-29 — Selection coordination + chip-strip reactivity (commit c5aa1fd; references morpheus-core#26 for the Pattern-Y workaround)
  E3:  executed 2026-05-29 — Lifecycle actions: createNew / commit / deleteDraft (commit a11409c; empty-start chosen, fork-from-latest deferred)
  E4:  EXECUTED 2026-06-02 (Composition beta C3, athene `89826c4`) — the CompositionSchemeVersion instance: a 3rd live Chronos instance (class-only, a direct mirror of the ASV instance over the C2 World tree). NB: E5 (TraitAttributeSetVersion) had already proven the engine's instance-agnosticism (140fe0e), so E4 added with zero engine reshaping — exactly the "second instance earns the pattern" claim, now doubly confirmed.
  E5:  TraitAttributeSetVersion EXECUTED 2026-06-01 (Traits beta T3.3, commit 140fe0e) — 2nd live instance; forced Chronos genuinely instance-agnostic (mirror-based kernel block + per-instance selectVersion coreFunction, replacing the latent ASV-coupling)
  E5+: deferred  — ClassVersion, ClassObjectStructureVersion;
                   draft/committed-aware fork-and-edit affordances; Chronos polish
---

# Beta Implementation Plan — Chronos Generic Version-Management Engine

*Amended 2026-05-29 (development/ level re-map): this plan is a **beta** — a direct division of alpha (a sibling of the other subsystem betas: Hermes, EntityClass-management, Chronos, World-OOP-tree). An earlier same-day pass mislabeled these as gammas under a hollow "phase-3" container beta; the container was removed and the four re-parented to alpha. Level is graph position (distance from root), not the kind of thing. Phase IDs (E*) kept as historical git-commit labels. See README.md + plans_index.md.*

*Drafted 2026-05-28 after the World-OOP-tree beta's I1–I3 landed the World tree (entityClasses
→ attributeSetVersions → attributes) and made the versioning layer real
in code. With the World-OOP-tree beta's foundation in place, Chronos has a clean tree to
consume.*

*Naming preserved from the legacy content-management-hub. "Chronos" is
established, descriptive, and there's no collision in our namespace.*

---

## What this plan is

The generic version-management engine. Like Hermes is "the CRUD UI for
any resource family," Chronos is **"the version-management UI for any
versioned entity family."** One node, many instances; each instance
describes one of the engine's five versioning axes (deep dive §3.1 +
§4).

Same engine pattern that the Hermes beta proved out: the node holds
the shared UI + state machine; each instance overrides the resource
meta + the `coreFunctions` that bind it to the actual data layer
(the World tree the World-OOP-tree beta built).

## What this plan is *not*

- Not just an ASV picker for the Attributes tab. Picker behavior emerges
  *from* Chronos being mounted there; building only the picker would
  bake AS-specific logic into the workbench. We build the generic
  engine; the workbench wires instances of it into each version-aware
  tab.
- Not a Hermes replacement or rewrite. Hermes stays the CRUD engine for
  entity *content*; Chronos handles entity *versions* of the schema
  layer those resources live in. They coexist — and in fact compose:
  workbench's Attribute Set Versions tab mounts Chronos *above* the
  Hermes/Attribute instance.
- Not a workflow engine. Chronos handles the draft/committed lifecycle
  (the engine's actual versioning primitive); broader workflow,
  approvals, audit trails are post-MVP.
- Not the Hermes/Attribute → ASV coordination plumbing alone. That's
  E2's job, but it's not the whole point — the engine is. Decoupling
  matters because the same engine will manage CSVs, ClassVersions, etc.,
  each needing the same selection-and-flow semantics.

## Architectural shift introduced

```
Before this (Chronos) beta:
  workbench.tabs['attributes'] → <Node id="Hermes" instance="Attribute" />
                                  (defaults to getLatest() ASV under the hood)

After this beta's E1–E2:
  workbench.tabs['attributes'] →
    <Node id="Chronos" instance="AttributeSetVersion" />   ← version picker
    <Node id="Hermes"  instance="Attribute" />              ← scoped to picked ASV

  workbench holds: signal `selectedAttributeSetVersionId`
    - Chronos flips on user pick
    - Hermes/Attribute reads + keys its mount by it (re-mount on change)
```

Three architectural commitments worth calling out:

1. **Engine, not picker.** Chronos is built as a generic morpheus node
   the way Hermes is — multi-instance, instance config = resource meta +
   coreFunctions. The first instance happens to be AttributeSetVersion;
   the engine doesn't know that.

2. **Selection lives on the workbench.** Cross-node coordination
   between Chronos and Hermes (same tab, same workbench) routes
   through a signal owned by the workbench. The workbench is the
   integration surface; Chronos and Hermes both read it. Final
   mechanism (signal vs custom node event vs other) is an E2 open
   call — but the *location* of the integration state is settled.

3. **Re-mount over update-in-place.** When the selected ASV changes,
   Hermes/Attribute unmounts and re-mounts (keyed by the version id).
   Clean state semantics; matches the user's mental model of
   "switching versions = open a fresh editing session." Comes with a
   known wrinkle: morpheus's current async-unmount cleanup races with
   immediate re-mount (HMR exposed this in the EntityClass-management beta's D5). For E2 we test
   whether deliberate user-triggered switches stay slow enough to
   avoid the race; if they don't, the fix lives in morpheus's
   `core/node/NodeManager.jsx` and unblocks the cleaner semantics for
   every future re-mount case.

## Phases

### E1 — Chronos node skeleton + AttributeSetVersion instance + read-only version display

**Goal:** A visible Chronos engine — mounted inside the workbench's
Attribute Set Versions tab, showing the ASVs for the current class with
their lifecycle stages. No selection yet, no lifecycle actions yet —
just the read-side, so the engine pattern is in place and visible.

**Work:**

- New `nodes/Chronos/` morpheus node:
  - `Chronos.node.jsx` — declarations, signals, coreData/coreFunctions
    schemas, instances block (mirrors the shape of Hermes.node.jsx).
  - `modules/Root.jsx` — layout shell.
  - `modules/VersionList.jsx` (or similar) — renders the version strip.
  - Likely also `inc/Chronos.js` as an OOP orchestrator if state gets
    nontrivial; defer until earned (theta's pattern: kernel methods
    first, OOP layer when complexity warrants it).
- `Chronos.node.jsx` declares an `AttributeSetVersion` instance with:
  - `coreData.versionCollectionMeta` (collection label, e.g., "Attribute
    Set Versions", singular "Version")
  - `coreFunctions.fetchAllVersions(kernel)` — reads from
    `world.entityClasses.getSingle(currentClassId).attributeSetVersions
    .getAll()` (entity class is already loaded by Hermes/Attribute's
    mount; if not, Chronos triggers loadDetail). Returns an array of
    `AttributeSetVersion` instances.
- Workbench's `Attribute Set Versions` tab content area renders:
  ```jsx
  <Node id="Chronos" instance="AttributeSetVersion" />
  <Node id="Hermes"  instance="Attribute" />
  ```
  Both mount; Chronos shows the strip, Hermes shows the latest-ASV
  attributes as today.
- Visual: horizontal strip above Hermes's rail, one chip per ASV.
  Each chip shows: version id (e.g., "v1"), lifecycle stage badge
  ("Draft" or "Committed"). Cyan accent matches the engine aesthetic.
- New SCSS partial `_chronos.scss`.

**Acceptance:** Navigating into a class's Attribute Set Versions tab
shows: the version chip strip on top (currently one chip for
Organization: "v1 · Committed"), unchanged Hermes/Attribute below.

### E2 — Selection coordination

**Goal:** Chronos's selection drives Hermes/Attribute's scope. Click a
version chip → Hermes/Attribute re-mounts against that ASV. The
"latest ASV by default" hack in Hermes/Attribute's coreFunctions retires.

**Work:**

- `EntityClassWorkbench.node.jsx` adds a new signal:
  `selectedAttributeSetVersionId` (string, default = the latest ASV's
  id, populated when the class detail loads — by Chronos's
  `fetchAllVersions` or by the workbench's own load hook).
- Cross-node coordination mechanism — **open call**, settle in this
  phase's first slice. Three patterns to compare:
  - **A — Shared signal via Athene.** Chronos uses
    `App.athene.setSelectedAttributeSetVersionId(id)` (which writes
    workbench's kernel signal). Same shape as how navigation already
    works (Athene.goTo* flips Root's `currentSurface`).
  - **B — Custom node event.** Chronos emits
    `selectedAttributeSetVersionDidChange`; workbench listens and
    flips its signal. Per morpheus's appEvents pattern.
  - **C — Module-prop callback.** Workbench passes a callback into the
    Chronos mount; Chronos invokes on selection. Requires
    `<Node>` to support callback props — verify in morphDocs before
    committing.
  - **Lean:** A. Matches the existing navigation pattern; one less
    morpheus primitive to learn; zero new surface area beyond a
    setter on Athene.
- Hermes/Attribute mount becomes:
  ```jsx
  <Node id="Hermes" instance="Attribute" key={selectedAttributeSetVersionId} />
  ```
  The `key` forces React to unmount on change. Per the architectural
  commitment: clean state, fresh fetch, matches "switching versions =
  open a fresh editing session."
- Hermes/Attribute's `coreFunctions.fetchAllResources` rewires from
  `attributeSetVersions.getLatest().attributes.getAll()` to
  `attributeSetVersions.getSingle(selectedAttributeSetVersionId)
  .attributes.getAll()`. Class id still flows from
  `Athene.currentClassId`; the new piece is the ASV id from the
  workbench signal.
- Chronos's chip click handler flips the signal. Active chip styled
  is-current.

**Acceptance:** With multiple ASVs (after E3 lets us create them, or
manually seeded for testing), clicking a chip switches Hermes/Attribute's
content to that ASV's attributes. Same UX (rail, view, edit, etc.)
applies to whichever version is selected.

### E3 — Lifecycle actions: createNew, commit, deleteDraft

**Goal:** Real version management. The user can create a new draft ASV,
commit a draft, and delete a draft. Chronos's strip gains the action
affordances.

**Work:**

- Chronos UI:
  - A "+ New Version" affordance at the end of the chip strip
    (analogous to Hermes's "+ New Resource" pivot).
  - Per-chip lifecycle actions on the selected chip:
    - **Draft selected:** "Commit" + "Delete Draft" buttons appear.
    - **Committed selected:** no action buttons; committed is immutable
      (deep dive §3.1).
  - Visual placement of action buttons — open call: inline next to the
    chip, or a small action row beneath the strip, or modal-on-click.
    Lean: action row beneath the strip when a draft is selected.
- Chronos coreFunctions for the AttributeSetVersion instance:
  - `createNewVersion(kernel)` → calls
    `entityClass.attributeSetVersions.createSingle()` (already built at
    I2). On success: re-fetch, select the new ASV.
  - `commitVersion(kernel, asvId)` → calls
    `attributeSetVersions.getSingle(asvId).commit()` (built at I2).
    On success: re-fetch, stay on the now-committed version.
  - `deleteDraftVersion(kernel, asvId)` → calls
    `attributeSetVersions.getSingle(asvId).deleteDraft()` (built at I2).
    On success: re-fetch, select the latest remaining ASV (likely the
    most recent committed one).
- "Confirm before destruction" — Hermes G8's pattern: clicking Delete
  enters a confirm sub-mode (Chronos's analog: confirm-confirm chip
  styling, or a small modal). Decide format with the action UX call.
- **Open call:** when "+ New Version" creates a new ASV, does the
  backend copy attributes from the latest committed ASV, or start
  empty? Check `Class_Attribute_Manager::create_attribute_set_version`
  semantics. If the backend doesn't fork, Chronos's createNewVersion
  could pre-fork client-side (copy attributes from the previous
  committed ASV) — but that's a separate write loop and worth thinking
  through.

**Acceptance:** From the Attribute Set Versions tab:
- "+ New Version" creates a draft ASV; the chip strip updates; the new
  draft is the active version; Hermes/Attribute shows its attributes
  (empty or forked depending on backend behavior).
- "Commit" on a draft moves it to committed; the chip's badge updates;
  the action buttons disappear.
- "Delete Draft" removes the draft; the strip updates; the previous
  ASV becomes active.

### E4 — Second instance: CompositionSchemeVersion

**Goal:** Prove Chronos is a generic engine, not a one-off ASV picker.
Mount a second instance (CompositionSchemeVersion) inside the
workbench's Composition Scheme Versions tab. Discover the friction
(what assumptions about ASV don't hold for CSV) and fix them.

**Work:**

- World-OOP-tree beta subtree extension: `app/world/entityClasses/compositionSchemeVersions/`
  with `CompositionSchemeVersions.js`, `CompositionSchemeVersion.js`,
  `compositionDirectives/CompositionDirectives.js`,
  `CompositionDirective.js`. Mirrors the ASV subtree. EntityClass's
  `loadDetail` populates the new branch from
  `walk.composition` (Apollo's directory walk returns this).
- Apollo methods for CSV lifecycle:
  - `createCompositionSchemeVersion(classId)`
  - `commitCompositionSchemeVersion(classId, csvId)`
  - `deleteCompositionSchemeVersionDraft(classId, csvId)`
  (Backend routes already exist — see `routes/api.php` Composition
  Management section.)
- New Chronos instance `CompositionSchemeVersion`:
  - Same coreData shape, different label ("Composition Scheme Versions")
  - coreFunctions wire to the new
    `compositionSchemeVersions` collection
- Workbench Composition Scheme Versions tab mounts the new Chronos
  instance + a stub for the directives list (full
  Hermes/CompositionDirective lands in the EntityClass-management beta's D10+ — out of this beta's
  scope).
- Any per-instance assumptions Chronos baked into ASV terms get
  abstracted up to the engine (analog to the Hermes beta's G9 "prove the pattern
  + fix what doesn't generalize").

**Acceptance:** Composition Scheme Versions tab shows the CSV chip
strip. Selection + create + commit + delete work the same as ASV.
No code in Chronos's body modules is ASV-specific.

### E5+ — Deferred Chronos instances + polish

Concretized when their consumers earn their way in:

- **TraitAttributeSetVersion** — ✅ **EXECUTED** (Traits beta T3.3, `140fe0e`).
  Landed exactly as predicted (alongside Hermes/Trait + Hermes/TraitAttribute,
  on the World-OOP-tree `traitAttributeSetVersions` subtree) — AND was the
  forcing function that made Chronos truly instance-agnostic: the shared kernel
  block now reads each instance's own `selectedVersionId` mirror, and chip
  selection is a per-instance `selectVersion` coreFunction (so VersionList no
  longer hardcodes the ASV Athene setter). The E4 CSV instance inherits this
  cleaned-up generic substrate for free.
- **ClassVersion** — the binding-manifest layer. Likely needs its own
  workbench tab ("Class Versions"). Heavier UX because it references
  other version ids — Chronos may need a "manifest editor" sub-shape.
- **ClassObjectStructureVersion** — the per-instance versioning axis.
  Scoped inside a specific EntityObject, so it mounts deeper in the
  workbench (or in a different surface entirely, when EntityObject
  editing lands).
- **Polish:** committed-state visual variants; version-comparison view
  (diff two ASVs); audit affordances (who committed, when).

---

## Open architectural calls (settle in the phase they're attached to)

1. **Cross-node coordination mechanism (E2).** A: shared signal via
   Athene • B: custom node event • C: module-prop callback.
   Lean: A.

2. **Visual layout of the chip strip (E1).** Horizontal scrolling strip
   above Hermes's rail (current lean) • Vertical list to the left of
   Hermes (heavier, might double-rail) • Compact pill bar with overflow
   menu (good for many ASVs but adds complexity).

3. **Lifecycle action UX (E3).** Inline buttons on the chip • Action
   row below the strip (current lean) • Modal • Right-click menu.

4. **New ASV creation semantics (E3).** Backend fork from latest
   committed? • Empty draft? • Client-side pre-fork after backend
   create? Check backend behavior first.

5. **Morpheus async-unmount race (E2).** If user-triggered version
   switches hit the same race HMR exposed at the EntityClass-management beta's D5, the fix is one
   focused PR against morpheus's GraphManager + NodeManager. Unblocks
   any future "re-mount on prop change" use case, not just Chronos.

6. **OOP layer (E1 → E3).** Chronos.js orchestrator class under `inc/`
   — at what point does state complexity warrant it? Theta migrated
   Hermes there *after* the kernel-fragment approach started to
   creak. Defer until earned.

## Bottom-up propagation against parent (alpha)

Alpha's Phase 3 ("Athene schema authoring UI") lists "Class Version
creation" and "Lifecycle controls (draft → committed UI; visible status;
commit actions)" as P0 deliverables. This (Chronos) beta delivers the generic
engine those deliverables sit on top of, then E1–E4 cash in the ASV +
CSV cases. Alpha gets a marker referencing this beta when E4 lands;
strategic premise unchanged.

## Cross-links

- Planning framework: `README.md`
- Parent plan: `alpha_implementation_plan.md`
- Foundation: `beta_implementation_plan_world_oop_tree.md` (this
  (Chronos) beta consumes the World tree that the World-OOP-tree beta built — `attributeSetVersions`,
  `attributeSetVersion.commit()`, `attributeSetVersion.deleteDraft()`,
  etc. were all built at I2 specifically for Chronos to consume)
- Conceptual model: `../notes/conceptual-deep-dive.md` §3.1
  ("Versioning is universal") + §4 (the five versioning axes)
- Companion engine: `beta_implementation_plan_hermes.md` (Hermes
  taught us the generic-engine pattern; this beta applies the same
  shape to a different axis)
