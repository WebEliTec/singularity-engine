---
title:   Beta — Per-EntityClass Management Surface
status:  drafting
date:    2026-05-28
scope:   Build the per-EntityClass management surface — the UI where a
         user works inside one EntityClass (its ASVs, Attributes, Traits,
         Composition, Relations, Taxonomies). Includes the app-shell work
         that lands first (Home node, lifted ResourceList, navigation
         signal, expandable sidebar) since the management surface can't
         exist without a way to navigate to it.
parent:  alpha_implementation_plan.md
depends_on: beta_implementation_plan_hermes.md
phases:
  D1:  executed 2026-05-28 — Lift the rail aside to globals/components as PanelAlpha + ListAlpha (commit 0ef089c)
  D2:  executed 2026-05-28 — Page-node architecture: Root-as-dispatcher + Home + EntityClassRegistry (commit 5de77f3)
  D3:  executed 2026-05-28 — Home consumes ListAlpha with live entity-class list (commit 27df77f)
  D4:  executed 2026-05-28 — Navigation signal: Athene.goTo* flips Root.currentSurface (commit 5496b51)
  D5:  executed 2026-05-28 — Expandable sidebar with Home + Manage Entity Classes affordances (commit decc089)
  D6:  executed 2026-05-28 — PageHeaderAlpha + apply to EntityClassRegistry (commit eafb2b8)
  D7:  executed 2026-05-28 — EntityClassWorkbench shell (commit 66775ec; sketch archived)
  D9:  executed 2026-05-28 — Hermes/Attribute full CRUD in workbench (commits f751c2d + 832f0c4; former gamma G9)
  D8:  deferred  — ASV picker + selection state (Minimal scope shipped D7; ASV plumbing lands when writes need it)
  D10+: superseded as D-phases — the Traits / Composition / Relations / Taxonomies sub-managers now land as **feature betas** in the canonical slice order (see apollo beta § "Canonical slice order"), each mounting its Hermes/Chronos instances into this workbench's tabs. Traits ✓ delivered (Traits beta T3, `9748951`/`d6b5fb6`/`140fe0e`); **Composition ✓ delivered** (Composition beta C3, `89826c4` — the Composition tab mounts Chronos/CompositionSchemeVersion + Hermes/CompositionDirective); Relations next, then Taxonomies. (Attribute write paths already shipped at D9.)
---

# Beta Implementation Plan — Per-EntityClass Management Surface

*Amended 2026-05-29 (development/ level re-map): this plan is a **beta** — a direct division of alpha (a sibling of the other subsystem betas: Hermes, EntityClass-management, Chronos, World-OOP-tree). An earlier same-day pass mislabeled these as gammas under a hollow "phase-3" container beta; the container was removed and the four re-parented to alpha. Level is graph position (distance from root), not the kind of thing. Phase IDs (D*) kept as historical git-commit labels. See README.md + plans_index.md.*

*Amended 2026-06-02 (D10+ sub-managers — reframed): the deferred D10+ sub-managers (Traits, Composition Directives, Relations, Taxonomies) are **no longer D-phases of this beta**. The Traits feature proved the pattern: each schema concept ships as its own **feature beta** (Apollo slice + World-tree subtree + Hermes/Chronos instances) whose Athene surface **mounts into this workbench's tabs**. This beta still owns the workbench shell + tab structure; the per-concept managers arrive with their feature betas, in the canonical slice order (apollo beta § "Canonical slice order"). Traits ✓ done; Composition → Relations → Taxonomies next.*

*Drafted 2026-05-28. A sibling beta that builds on the Hermes beta. The Hermes beta built the
generic Hermes CRUD engine and instantiated it for EntityClass at the
**global** level. This beta builds the surface a user enters when they pick
one EntityClass and want to manage its **internal** structure — its
Attribute Set Versions, Attributes, Traits, Composition Directives,
Relations, Taxonomies.*

*The app-shell work (Home, navigation, sidebar) lands first because the
management surface can't exist without a way to navigate to it. It is
**not** a separate subsystem; it's the early phases of this plan.*

---

## What this plan is

The full arc from *"Athene currently mounts Hermes/EntityClass directly
under Root"* to *"Athene has a Home surface, a class-list-as-navigation,
a per-EntityClass management view with its own sub-managers, and an
expandable sidebar tying the surfaces together."*

## What this plan is *not*

- Not a URL/router plan — navigation is in-app, signal-driven. No URLs.
- Not Apollo-side work — the data model and endpoints already exist for
  ASVs, Attributes, Traits, etc. (the Hermes beta proved the HTTP pattern).
- Not a re-design of Hermes — Hermes will be *reused* (a second instance
  for Attribute mounts inside the management surface), not reshaped.

---

## Architectural shift introduced

*Amended 2026-05-28 at D2: "page-node" model adopted — Root becomes a pure
dispatcher, each surface is its own morpheus node sibling.*

```
Before this beta:
  Root.jsx (with brand header)
    └── (always) Hermes/EntityClass

After this beta:
  Root.jsx (pure dispatcher — no chrome of its own, except D5 sidebar)
    └── currentSurface dispatch — one of:
         ├── <Node id="Home" />                    ← D2 stub + D3 list (logo lives here only)
         ├── <Node id="EntityClassRegistry" />    ← D2 wraps Hermes/EntityClass (adding/deleting classes)
         └── <Node id="EntityClassWorkbench" />   ← D6+ per-class internal surface
```

**Page-node rule.** Root holds no surface chrome. The engine logo lives
*only* on Home (the brand-identity surface). Every "page" is its own
morpheus node — Root's job is solely to mount one at a time. Page-nodes
may compose engines (Hermes) internally without exposing them to Root.

Dispatch lives in `Root.jsx`, driven by an app-level signal
(`currentSurface`) flipped via Athene navigation methods (`goToHome`,
`goToEntityClassRegistry`, `goToEntityClassWorkbench(id)`). The signal
lands in D4 — D2 hardcodes `currentSurface` to a constant.

---

## Phases

### D1 — Lift the rail aside to `globals/components/` as `PanelAlpha` + `ListAlpha`

*Amended 2026-05-28: original D1 lifted one component (`ResourceList`). On
review the visual shape decomposes into two orthogonal primitives — a box
with a header (`PanelAlpha`) and a clickable list (`ListAlpha`). Naming
follows the [[component-naming-convention]]: visual primitive + Greek-letter
variant, not purpose-bound. `PanelBeta` is foreshadowed (Hermes content-body
wrapper, lands later).*

Move the `.hermes-resource-list` `<aside>` out of
`nodes/Hermes/modules/ResourceList.jsx` into two presentational components
in `globals/components/` (props-only, no framework injection — per
`morphDocs/examples/18-global-modules-and-components/`):

**`PanelAlpha`** — the outer box.
| prop | type | notes |
|---|---|---|
| `eyebrow` | string | header label |
| `count` | number? | optional header count badge |
| `children` | ReactNode | rendered inside the panel below the header |

Renders `<aside class="panel-alpha"><header class="panel-alpha-header">…</header>{children}</aside>`.

**`ListAlpha`** — the inner clickable list.
| prop | type | notes |
|---|---|---|
| `topPivots` | `Array<{ glyph, label, isActive, onClick }>` | may be empty |
| `items` | `Array<{ id, name, secondary?, isActive, onClick }>` | the rows |
| `bottomPivots` | `Array<{ glyph, label, isActive, onClick }>` | may be empty |

Renders pivots-above, then `<nav class="list-alpha-items">…items…</nav>`, then pivots-below.

**Composition (Hermes's current rail):**
```jsx
<Component id="PanelAlpha" eyebrow="Entity Classes" count={5}>
  <Component id="ListAlpha"
    topPivots={[indexPivot, newPivot]}
    items={entityClasses}
  />
</Component>
```

**Composition (Home's class list, lands D3):**
```jsx
<Component id="PanelAlpha" eyebrow="Entity Classes" count={5}>
  <Component id="ListAlpha"
    items={entityClasses}
    bottomPivots={[manageEntityClassesPivot]}
  />
</Component>
```

Hermes's existing `ResourceList` module becomes a thin **adapter**: reads
`_`, `Hermes`, `ResourceCollection`, maps signals → props, renders the two
components composed. Loading + error states stay in the adapter
(Hermes-specific), not in the global components.

Both components registered in `app.js` under `globalComponents` alongside
the existing `HermesInput*` entries.

**CSS:** existing `.hermes-resource-list*` rules rename to `.panel-alpha*` /
`.list-alpha*` and move from `_hermes.scss` into their own SCSS partials
(`_panel-alpha.scss`, `_list-alpha.scss`) per the component-naming
convention's CSS clause. Hermes-specific styles (status screens, action
buttons, edit form chrome) stay in `_hermes.scss`.

**Acceptance:** Hermes/EntityClass is visually and behaviorally unchanged.

**As landed 2026-05-28 (commit `0ef089c`):**
- Two presentational components shipped as drafted (`PanelAlpha`, `ListAlpha`); Hermes adapter composes them; loading + error states stayed in the adapter.
- Shared chrome extracted to a new partial `_panel-chrome.scss` (mixins renamed `hermes-panel` → `panel-chrome`, `hermes-eyebrow` → `panel-eyebrow`). Both `_panel-alpha.scss` and `_hermes.scss` `@use 'panel-chrome' as panel`.
- Rail CSS classes lifted out of `#hermes` scope. `_hermes.scss` shrank 773 → 490 lines.
- Item secondary-line class renamed `-item-id` → `-item-secondary` since the content isn't always an id (Hermes still passes id; future consumers can pass anything).
- Both new components registered in `app.js` `globalComponents` and opted into via `{ isGlobal: true }` in `Hermes.node.jsx`.

### D2 — Page-node architecture: Root-as-dispatcher + Home + EntityClassRegistry

*Amended 2026-05-28 mid-execution: originally scoped to "Home node skeleton"
only. Daniel introduced the page-node model — Root holds no surface chrome,
every page is its own node sibling. Folding EntityClassRegistry (the
wrapper around Hermes/EntityClass) into D2 keeps the architectural shift
atomic. The brand-header migration formerly assigned to D4 lands here too.*

**New nodes:**
- `nodes/Home/Home.node.jsx` + `Home.jsx` — declarations only (empty
  `kernel: {}`). Renders the engine brand (logo + title via
  `SingularityLogoAnimated` global) and a placeholder `<PanelAlpha>` for
  the class list. D3 fills the list with real content.
- `nodes/EntityClassRegistry/EntityClassRegistry.node.jsx` +
  `EntityClassRegistry.jsx` — declarations only. Root module renders
  `<Node id="Hermes" instance="EntityClass" />`. Thin by design — the
  architectural sleeve that makes "the CRUD-for-entity-classes surface"
  a dispatchable page rather than an engine instance directly.

**Updated nodes:**
- `nodes/Root/Root.node.jsx` — drops `SingularityLogoAnimated` component
  declaration; logo no longer renders from Root.
- `nodes/Root/Root.jsx` — strips the `<header className="engine-brand">`
  block; becomes a dispatcher that reads a local `currentSurface`
  constant and renders `<Node id={ pageNodes[ currentSurface ] } />`.
  D4 replaces the constant with a kernel-signal read.

**New SCSS:** `_home.scss` partial — minimal `#home` padding + `.home-body`
width centering, registered in `main.scss`.

**Registered:** `Home: {}` and `EntityClassRegistry: {}` in `app.js`
under `nodes`.

**Acceptance:**
- Booting with `currentSurface = 'home'` shows: brand header (logo +
  title) at top, empty PanelAlpha labeled "Entity Classes" below.
- Booting with `currentSurface = 'classRegistry'` shows the existing
  Hermes/EntityClass surface, visually unchanged (now mounted one
  level deeper).
- The engine logo no longer appears on the Hermes surface.

**As landed 2026-05-28 (commit `5de77f3`):**
- Three new files per page-node (`Home.node.jsx` + `Root.jsx`, `EntityClassRegistry.node.jsx` + `Root.jsx`) plus `_home.scss`.
- Root.jsx is a 9-line dispatcher with `currentSurface = 'home'` constant — D4 wires the signal.
- Logo migration that was originally D4 work landed here (Root's brand header stripped).
- One runtime correction during execution: morpheus resolves the root module by **filename**, not by node folder name. Both page-nodes' root module files are `Root.jsx` (matching their `modules: { Root: { isRoot: true } }` declaration). My initial `Home.jsx` / `EntityClassRegistry.jsx` names failed at boot with "Root Module of node 'Home' not found"; renamed before commit.

### D3 — Home consumes the global ListAlpha

Replace D2's empty placeholder with a real `<ListAlpha>` inside Home's
`<PanelAlpha>`:
- `topPivots`: empty (intentionally no Index, no New)
- `items`: one per entity class — name + id (or similar secondary).
  Click handler stubs to `console.log` for now; D4 wires real per-class
  navigation.
- `bottomPivots`: single entry
  `{ glyph: '≡', label: 'Manage Entity Classes', isActive: false, onClick: stub }`.
  D4 wires this to `Athene.goToEntityClassRegistry()`.

**Open call (resolve during execution):** does Home call
`Athene.entityClassManager.loadAllEntityClasses()` itself, or does
Athene bootstrap-load classes once at app start so both Home and Hermes
share? **Lean:** Home triggers its own load on `nodeDidMount` for D3
(simplest reactive path — Home owns a `entityClassList` signal it
populates after fetch). Bootstrap-load + shared cache is a worthwhile
optimization once it actually matters (likely D4+ or later); not
load-bearing now.

**Acceptance:** Home shows real entity-class items (Company,
Organization, Person, Plugin, Plugin_group, …). Bottom pivot is visible.
Clicks log without navigating.

**As landed 2026-05-28 (commit `27df77f`):**
- `entityClassList` signal added to Home node; `nodeDidMount` hook calls `Athene.entityClassManager.loadAllEntityClasses()` then `setSignal` from `getAllEntityClasses()`.
- Home/Root.jsx maps each `EntityClass` to a `ListAlpha` item (`name = displayName`, `secondary = id`). Bottom pivot `≡ Manage Entity Classes` rendered.
- Click handlers `console.log` with a `D4: ...` comment pointing at the intended `Athene.goTo*` call — easy grep when D4 wires the real signal.
- Open call resolved as Home-owns-load (the simpler lean), not Athene-bootstrap. Two consumers (Home + Hermes when navigated to) each trigger their own load. Optimization lives in the plan's notes; lands when it actually saves something.

### D4 — App-level navigation signal

*Amended 2026-05-28 at D2: the dispatcher pattern + brand-header migration
already shipped in D2. D4 narrows to wiring the kernel signal and the
Athene navigation methods that flip it.*

Replace Root.jsx's hardcoded `currentSurface` constant with a kernel
signal read.

**Decisions to settle in execution:**

1. **Where does `currentSurface` live?**
   - Signal on Root's kernel — morpheus-native; rebroadcasts trigger
     re-render.
   - Property on Athene singleton — closer to app orchestrator, but
     Athene currently has no signals of its own.

   **Lean:** signal on Root's kernel; Athene exposes setter methods
   that flip the signal via `appKernel`.

2. **Surface enum vocabulary.** Initial: `'home' | 'classRegistry'`.
   `'classWorkbench'` (per-class) joins the enum with D6.

Athene gains navigation methods:
- `goToHome()` → flips signal to `'home'`
- `goToEntityClassRegistry()` → flips signal to `'classRegistry'`
- `goToEntityClassWorkbench(id)` → placeholder until D6; logs a warning

Home's bottom pivot (added D3) wires to `Athene.goToEntityClassRegistry()`.

**Acceptance:** App boots into Home. Clicking "Manage Entity Classes"
lands in EntityClassRegistry (which mounts Hermes/EntityClass) with
all CRUD still working. Reload returns to Home (no persisted nav state
— fine for MVP).

**As landed 2026-05-28 (commit `5496b51`):**
- `currentSurface` signal declared on Root's kernel; `Root.kernelDidInitialize` hands the kernel to Athene via `registerRootKernel(kernel)`.
- Athene gained three navigation methods. `goToEntityClassWorkbench(id)` warns + no-ops (D6 target node doesn't exist yet).
- Home/Root.jsx destructures `App` and calls `App.athene.goTo*` directly — D3's console.log stubs and `D4: ...` comments are gone.
- All four phase deliverables matched plan exactly; no deviations.

### D5 — Expandable sidebar

A persistent left-edge sidebar present on every surface. Collapsed by
default; expandable on user interaction (click vs hover — UX call in
execution).

Minimum contents: a Home affordance calling `Athene.goToHome()`.
Inert/hidden when already on Home.

**Open call (resolve during execution):** is the sidebar a
`globals/components/AppSidebar.jsx` rendered from Root.jsx, a new
sibling node, or inline JSX in Root.jsx itself? **Lean:** global
component — it's pure chrome with no orchestration needs.

**Acceptance:** From any non-Home surface, the sidebar reveals a Home
affordance that returns to Home cleanly.

**As landed 2026-05-28 (commit `decc089`):**
- **Architecture deviation from plan lean.** Plan leaned "global component"; landed as Root-node module instead. The sidebar has real orchestration (reads `currentSurface`, calls `App.athene.goTo*`) — a Root module gets framework access naturally without needing global registration. No other node uses it.
- **State deviation from plan implicit assumption.** Plan didn't specify, but I chose a kernel signal (`sidebarExpanded` on Root) over React `useState`. Matches the codebase's signal-first pattern — there are zero React hooks anywhere else in athene's morphSrc.
- **UX call.** Click-toggle, collapsed default. Matches Slack/VSCode/Linear convention.
- **Two affordances, not one.** Plan minimum was "Home affordance"; Daniel added "Manage Entity Classes" as a sidebar request on D5 polish. Both affordances follow the same shape — `is-current` triggers an active-cyan highlight ("you are here"); non-current is normal-styled and navigable.
- **Defensive `:disabled:not(.is-current)` rule** keeps a gray-out for any future disabled-but-non-current state, while keeping the current affordance's highlight clean.
- **One runtime hiccup during execution** — saw a transient `Node instance "Home:Default" already exists in the graph` error during development. Diagnostics confirmed it was an HMR artifact (Vite hot-reloaded while a previous mount's async unmount cleanup was still in flight). Resolved on its own; current graph is healthy.

### D6 — Page-node header pattern (PageHeaderAlpha)

*Inserted 2026-05-28 mid-execution. Daniel called for unification of
the page-nodes: the registry has no header, and future page-nodes
(D7's workbench) need one too. The pattern is small but worth its own
phase letter so D7+ inherits cleanly. The original D6 (workbench)
becomes D7; subsequent phases renumbered.*

A new global component `PageHeaderAlpha` modeled on devApp's Overview
brand header (`some-morpheus-based-app/morpheus/devApp/nodes/Overview/Root.jsx`
+ `_overview.scss`): a smaller version of the engine logo as a faded
backdrop, with the page title overlaid using the same mask-gradient
treatment. Adapted from devApp's *centered* layout to a *left-aligned*
header so it reads as a per-page identity strip rather than a brand
hero.

**New global component:**
- `globals/components/PageHeaderAlpha.jsx` — props `{ title }`.
  Renders `<header class="page-header-alpha">` with the
  `SingularityLogoAnimated` SVG (smaller — ~100px) plus a `<h2>` title
  positioned to read over the logo's right side with mask-gradient
  fade. Direct ES import of `SingularityLogoAnimated.jsx` since global
  components don't get the `Component` framework prop.

**New SCSS partial:** `_page-header-alpha.scss` — registered in
`main.scss` alongside the other global-component partials.

**Apply to EntityClassRegistry:**
- `EntityClassRegistry.node.jsx` opts into `PageHeaderAlpha` and
  `SingularityLogoAnimated` via `{ isGlobal: true }`.
- `EntityClassRegistry/Root.jsx` renders the header above the Hermes
  mount with `title="Entity Class Manager"`.

**Open call:** does Home also adopt PageHeaderAlpha (replacing its
current big centered brand)? Lean: leave Home as-is for now — its big
centered brand is the engine's "you are at the entry surface"
treatment, distinct from the per-page identity strip. Revisit if Daniel
wants uniform headers across all surfaces.

**Acceptance:** EntityClassRegistry surface gains a left-aligned
header reading "Entity Class Manager" with the engine logo as
backdrop, visually consistent with devApp's pattern at the new scale.
The Hermes/EntityClass content below it is unchanged.

**As landed 2026-05-28 (commit `eafb2b8`):**
- `PageHeaderAlpha` global component + `_page-header-alpha.scss` partial. Direct ES import of `SingularityLogoAnimated.jsx` inside the component (global components don't get the `Component` framework prop).
- Logo positioning settled mid-execution on Daniel's tuning: `top: 16px; left: 14px; opacity: 0.5;` (replacing my initial centered-via-translateY default).
- Title overlap tuned: `margin-left: 1.5rem` so the title's left ~20% (the mask fade-in region) sits over the logo's right half. Mirrors devApp's vertical title-on-logo overlap, rotated 90°.
- Applied to `EntityClassRegistry` only. **Home not touched** — its big centered brand remains the engine entry-surface identity (open call resolved by inaction: keep Home distinct, use PageHeaderAlpha for non-Home page-nodes).
- Page-node transitions now fade in: EntityClassRegistry's wrapper got `className="fade-in"` matching what Home already had. Since each page-node mounts fresh on dispatcher switch, the same `.fade-in` keyframes in `_base.scss` (lifted from devApp) animate every transition.

### D7 — Per-class management surface: shape decision + first slice

This is where the shell work pays off. The user has clicked a
EntityClass item in Home and expects to land in a surface scoped to
that one class.

**Open architectural question (decide in this phase's sketch):**

| Option | Description | Tradeoff |
|---|---|---|
| **A** | New top-level page-node `EntityClassWorkbench` taking a class id; Root.jsx adds a third dispatch branch alongside Home and EntityClassRegistry | Clean morpheus shape — one page-node per surface. *Settled at D2: page-node model confirmed.* |
| **B** | Extend Hermes with a `manage` mode (sixth mode value) | Smaller refactor but stretches Hermes's per-resource-family scope. |
| **C** | Wrapping shell node | Less clean. |

**Scope question (also resolved here):**
- **Minimal:** just enough to host a second Hermes instance (for
  Attributes), defaulting to "latest draft ASV" — skip the ASV picker.
- **Full:** complete management surface with all sub-managers and
  proper ASV selection UI.
- **Lean:** Minimal, with stubs/placeholders for other sub-managers
  visible-but-inert.

**Visual structure (per the content-management-hub tour):**
- Class-identity header at the top (current class name).
- Sub-manager navigation: tabs (content-management-hub style) vs nested
  left rail (Athene-consistent with Hermes). **Lean:** nested left rail
  for visual consistency with Hermes — the D5 sidebar's Home affordance
  ensures the user can always escape.
- Active sub-manager renders in the main pane.

D7 ships the management surface **shell** (class-identity header — likely
using PageHeaderAlpha from D6 — sub-manager navigation, blank main
pane). Sub-managers populate in D8+.

**Pre-execution requirement:** before D7 implementation begins, write
`delta_d7_sketch.md` resolving the A/B/C call, the Minimal/Full call,
the tabs/rail call, and the sub-manager order.

**As landed 2026-05-28 (commit `66775ec`):**
- All four open calls resolved in `archive/delta_d7_sketch.md` (now archived).
  Sketch settled: Minimal scope, Tabs (deviating from plan's rail
  lean), order Attributes·Traits·Composition·Relations·Taxonomies,
  class id via Athene.
- One simplification during execution: dropped the `classId` signal the
  sketch proposed. Workbench reads `App.athene.currentClassId` directly
  at render time — the id is stable for the workbench's lifetime, so
  the signal layer was overhead. Reactivity for mid-session class
  changes can be re-introduced if D9+ needs it.
- All five sub-managers render placeholder text; the active tab dispatches
  the placeholder via `currentSubManager` signal.

### D8+ — Sub-managers, populated in dependency order

Phase names finalized once D7's sketch lands. Approximate
dependency-ordered candidates:

- **D8 — ASV picker + selection state** (gated on D7 scope; slips later
  if D7 ships Minimal).
- **D9 — Hermes/Attribute** mounted inside the management surface —
  this is the work previously named gamma G9, now **superseded** there
  (see `beta_implementation_plan_hermes.md`).
  **Executed 2026-05-28** (commit `f751c2d`).
  As landed:
  - D9 ran AHEAD of D8 — Minimal scope from D7 deferred the ASV picker,
    so Hermes/Attribute defaults to the latest ASV (highest-numbered id)
    rather than waiting on UI selection. D8 lands when writes need an
    ASV selection mechanism.
  - New `app/attributeManager/` (`Attribute.js` value class +
    `AttributeManager.js` Athene sub-entity, mirroring the EntityClass
    pattern).
  - New Apollo method `getSingleEntityClassDirectoryWalk(id)` —
    returns the full walk; AttributeManager extracts the latest ASV's
    `.attributes` records.
  - New `Attribute` instance on the Hermes node with coreData +
    coreFunctions for `fetchAllResources` and `fetchSingleResource`
    only. Write paths (create/update/delete) deliberately omitted →
    Hermes node-level defaults throw with "No <verb>SingleResource
    configured" as the "not yet wired" signal.
  - Workbench's Attributes tab dispatch updated to render
    `<Node id="Hermes" instance="Attribute" />`. Class context flows
    through `Athene.currentClassId` (set at navigation time, read at
    fetch time).
  - Removed `.workbench-content { padding }` to avoid double-padding
    when Hermes mounts inside (Hermes brings its own `#hermes` padding).
  - **Write paths added in follow-up commit `832f0c4`** (same day):
    Apollo gained create/update/delete attribute methods; AttributeManager
    tracks `loadedAsvId` and exposes write methods; Hermes Attribute
    instance now has all five coreFunctions.
  - **Two surface-level fixes** that landed with the write paths:
    (1) `Attribute` class switched to `Object.assign(this, rawRecord)`
    so snake_case multi-word fields (`attribute_data_type`,
    `is_required`) are directly accessible — Hermes's
    `Resource.getFieldValue('attribute_data_type')` does plain property
    access, so camelCase-only getters returned undefined and broke
    edit-mode population. (2) Added `HermesSelectInput` global
    component + `case 'select'` in the HermesInput dispatcher + cyan
    chevron styling, so `attribute_data_type` renders as a proper
    dropdown over the legacy 15-type catalog.
  - **Known limitations** (documented in code): writes target the
    latest ASV regardless of life-cycle stage (the backend doesn't
    enforce committed-vs-draft on attribute writes); type-specific
    cascading fields (`string_type_min_length`, `selection_type`, …)
    not yet surfaced in the edit form.
- **D10+ — Traits, Composition Directives, Relations, Taxonomies** —
  each its own sub-surface within the management view; Hermes-instance
  vs bespoke decided per case.

These are *placeholders* — concretize phase-by-phase as the work
approaches.

---

## Bottom-up propagation against parent (alpha)

Alpha's Phase 3 ("Athene schema authoring UI") flattens all schema
surfaces into one phase. This beta reveals that surface is structurally
**two levels**: global EntityClass list (the Hermes beta) + per-class management
(this beta, D6+). Alpha amended in place with a marker; strategic premise
unchanged, structure sharpened.

## Cross-links

- Planning framework: `README.md`
- Parent plan: `alpha_implementation_plan.md`
- Prerequisite (complete through G8): `beta_implementation_plan_hermes.md`
- Earlier-version UI reference (mine for ideas, don't copy verbatim):
  `content-management-hub/src/pages/entity-class/attributes/AttributeSetLayout.jsx`
  (master-detail pattern),
  `content-management-hub/managers/class-attribute-set-version-manager/ClassAttributeSetVersionManager.jsx`
  (version selector).
