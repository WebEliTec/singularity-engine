---
title:   Beta Implementation Plan — World OOP Tree (app/ layer refactor + workbench tab vocabulary)
status:  drafting
date:    2026-05-28
scope:   Restructure athene's `app/` domain layer from flat managers (EntityClassManager, AttributeManager) into a nested OOP tree (World → EntityClasses → EntityClass → AttributeSetVersions → AttributeSetVersion → Attributes → Attribute, etc.) that mirrors the conceptual model. Reframe workbench tab vocabulary so the versioning layer is visible (Attributes → Attribute Set Versions, Composition → Composition Scheme Versions). Parallel-track infrastructure refactor analogous to theta (Hermes OOP migration).
parent:  alpha_implementation_plan.md
track:   parallel
phases:
  I1:  executed 2026-05-28 — World + EntityClasses; EntityClass reshape (commit b7fd269)
  I2:  executed 2026-05-28 — AttributeSetVersions + Attributes; EntityClass.loadDetail (commit 5e1b5eb)
  I3:  executed 2026-05-28 — Workbench tab vocabulary reframe (commit 7c1f72d)
  I4+: deferred — TraitAttributeSetVersions, CompositionSchemeVersions,
                  ClassVersions, EntityClassRelations, Taxonomies,
                  EntityObjects — concretized as their consumers land
---

# Beta Implementation Plan — World OOP Tree

*Amended 2026-05-29 (development/ level re-map): this plan is a **beta** — a direct division of alpha (a sibling of the other subsystem betas: Hermes, EntityClass-management, Chronos, World-OOP-tree). An earlier same-day pass mislabeled these as gammas under a hollow "phase-3" container beta; the container was removed and the four re-parented to alpha. Level is graph position (distance from root), not the kind of thing. Phase IDs (I*) kept as historical git-commit labels. See README.md + plans_index.md.*

*Parallel-track infrastructure refactor. Analogous to theta (the Hermes
inc/ OOP migration) but at the app-domain layer. Marked as orthogonal
via `track: parallel` in the frontmatter — to the EntityClass-management
beta's feature work and the Chronos beta's work, both of which build
on this beta's foundation.*

*Drafted 2026-05-28 after a conversation traced the friction in calling
the workbench's first tab "Attributes" — they live inside an Attribute
Set Version, not at the class level — back to a deeper conceptual
misalignment: the OOP layer flattens the engine's nested versioned
structure into manager Maps. This beta straightens both.*

---

## What this plan is

The structural refactor that makes the engine's conceptual model
manifest in the code. The conceptual deep dive (`notes/conceptual-deep-dive.md`
§2 + §3.1) already names the nesting:

```
World
└── EntityClasses
    └── EntityClass {id}
        ├── AttributeSetVersions
        │   └── AttributeSetVersion {id}
        │       └── Attributes
        │           └── Attribute {id}
        ├── Traits
        │   └── Trait {id}
        │       └── TraitAttributeSetVersions
        │           └── TraitAttributeSetVersion {id}
        │               └── TraitAttributes
        ├── CompositionSchemeVersions
        │   └── CompositionSchemeVersion {id}
        │       └── CompositionDirectives
        ├── ClassVersions
        │   └── ClassVersion {id}
        └── EntityObjects
            └── EntityObject {id}
                └── (instance field values + locales)
├── EntityClassRelations
│   └── EntityClassRelation {id}
└── Taxonomies
    └── Taxonomy {id}
```

This beta lands the upper-left slice (through `Attribute`) — enough to retire
the existing managers and unblock everything downstream. Subsequent
phases extend the tree as their consumers earn their way in.

## What this plan is *not*

- Not a wire-format change — Apollo's HTTP surface stays as-is.
  This beta reshapes how athene materializes the response, not what the
  response *is*.
- Not Chronos — the Chronos beta owns the version-management UI engine.
  This beta gives the Chronos beta a tree to read from.
- Not a wholesale rewrite of consumers — Hermes/EntityClass and
  Hermes/Attribute keep their UIs; only their `coreFunctions` rewire
  to the new tree.
- Not the eventual Apollo Node.js port — but designed so that port
  becomes "implement the same tree on the backend," with the JSON
  envelope a natural marshalling of mirror structures.

## Architectural shift introduced

**Before (current):**
```
Athene
├── apollo (HTTP boundary)
├── entityClassManager (Map<id, EntityClass>)
│   └── EntityClass (value object — getters)
└── attributeManager (Map<id, Attribute> + loadedClass + loadedAsvId)
    └── Attribute (value object — getters)
```

Containment is implicit — buried in manager Maps. Versioning is hidden
(the manager loaded "the latest" ASV; the ASV layer isn't represented
at all). Cross-entity reasoning ("which class does this attribute
belong to?") requires asking the manager.

**After (this beta, I1–I2):**
```
Athene (infra orchestrator)
├── apollo (HTTP boundary — unchanged)
└── world (NEW — domain root)
    └── entityClasses (NEW — collection)
        └── EntityClass {id}
            └── attributeSetVersions (NEW — collection)
                └── AttributeSetVersion {id}
                    └── attributes (NEW — collection)
                        └── Attribute {id}
```

Containment IS composition. Every layer in the conceptual model has a
class. Operations land where they conceptually belong:

```js
world.entityClasses.getSingle('organization')
  .attributeSetVersions.getSingle(1)
  .attributes.getSingle('hq_address')
```

Five layers deep. Reads naturally. The class-id is the *self* of the
receiver, not a parameter.

## Project conventions

### Collection-class pattern
Per Daniel's call: collection sub-objects, not facade methods on the
parent. Every parent-of-many exposes a typed collection object:

```js
class EntityClass extends WorldChild {
  constructor( parent, rawRecord ) {
    super( parent );
    Object.assign( this, rawRecord );
    this.attributeSetVersions = new AttributeSetVersions( this );
    // … traits, compositionSchemeVersions, etc.
  }
}
```

Methods land on the collection (`.getAll()`, `.getSingle(id)`,
`.createSingle(values)`), not on the parent. Since the resource type
is implied by *which collection* you're inside, the existing method-
naming convention drops the `…ResourceName` suffix when applied to
collection methods:

```
world.entityClasses.getAll()                  ← was: getAllEntityClasses
world.entityClasses.createSingle(values)      ← was: createSingleEntityClass
entityClass.attributeSetVersions.getAll()
asv.attributes.getSingle('hq_address')
asv.attributes.createSingle(values)
```

Verbosity drops; structure rises.

### Parent-back-references
Every child holds a reference to its parent — non-enumerable so JSON
serialization stays acyclic (Theta T2's `Object.defineProperty` trick).
This lets methods reach up the tree for context they need:

```js
async createSingleAttribute( values ) {
  const asvId     = this.parent.id;               // AttributeSetVersion id
  const classId   = this.parent.parent.id;        // EntityClass id
  const apollo    = this.parent.parent.parent.athene.apollo;
  // …
}
```

For ergonomics, the base class `WorldChild` also exposes a fast path
to Athene's services regardless of depth:

```js
this.athene   // reaches Athene
this.apollo   // shortcut for this.athene.apollo
```

These are non-enumerable too — set on instance construction.

### File structure mirrors the tree
Filesystem nesting mirrors OOP nesting — the same way the conceptual
hierarchy manifests at every layer it exists in:

```
app/
  Athene.js
  WorldChild.js                          ← base for domain entities
  AtheneChild.js                         ← base for infra (Apollo) — retained
  apollo/
    Apollo.js
  world/
    World.js
    entityClasses/
      EntityClasses.js                  ← collection
      EntityClass.js                    ← singular
      attributeSetVersions/
        AttributeSetVersions.js
        AttributeSetVersion.js
        attributes/
          Attributes.js
          Attribute.js
```

Deep, but honest. Reading the directory tree shows the same thing
reading the conceptual deep dive's nesting diagram does.

### Eager full-fetch
Per Daniel's call: when an EntityClass loads, the directory-walk
endpoint gives us the entire subtree (ASVs, Traits, Composition, …).
EntityClass materializes its whole descendant tree on `load()`. No
lazy-on-first-access for now; revisit if data volume bites.

The lighter list endpoint (`listAllEntityClasses` → meta only) still
serves Home's class list — those EntityClass instances just don't
have their subtrees populated until the user navigates into a workbench.

---

## Phases

### I1 — World + EntityClasses (replaces EntityClassManager)

**Goal:** Stand up the World root + EntityClasses collection. Move
EntityClass into the new shape. Retire EntityClassManager. Existing
consumers (Home, Hermes/EntityClass) work identically — HTTP traffic
unchanged.

**Work:**
- New `app/WorldChild.js` — base class. Holds `parent`, exposes
  non-enumerable `athene` (resolved by walking up to World's parent
  Athene) and `apollo` shortcut.
- New `app/world/World.js` — root of the domain tree. Holds
  `entityClasses` collection. Constructor takes Athene (its parent).
- New `app/world/entityClasses/EntityClasses.js` — collection.
  Methods: `getAll()`, `getSingle(id)`, `getCount()`, `loadAll()`,
  `createSingle(values)`, `updateSingle(id, patch)`, `deleteSingle(id)`.
  Holds the Map of EntityClass instances.
- New `app/world/entityClasses/EntityClass.js` — relocated from
  `entityClassManager/`. Adds parent ref. `Object.assign(this, raw)`
  pattern stays (so snake_case fields work via plain property access).
  Constructor wires up empty subtree collections (`attributeSetVersions`,
  etc.) — they populate on `this.loadDetail()`.
  Methods: `loadDetail()` (re-fetches walk + repopulates subtree),
  `refresh()` (alias for parent's refresh of this one).
- Update `Athene.js`: instantiate `world = new World(this)` in `init()`;
  remove `entityClassManager`. (AtheneChild for Apollo stays.)
- Update `Hermes.node.jsx` EntityClass instance's `coreFunctions`:
  `world.entityClasses.loadAll() / getAll() / getSingle(id) /
   createSingle / updateSingle / deleteSingle`.
- Update `Home/Home.node.jsx` nodeDidMount: same.
- Delete `app/entityClassManager/`.

**Acceptance:** Home shows the class list. Hermes/EntityClass CRUD
works identically. No HTTP-level change visible from Apollo's side.

### I2 — AttributeSetVersions + Attributes (replaces AttributeManager)

**Goal:** Land the ASV and Attribute layers. Retire AttributeManager.
Drop the `loadedAsvId` hack — ASV is now a chain step, not stashed
state.

**Work:**
- New `app/world/entityClasses/attributeSetVersions/AttributeSetVersions.js`
  — collection. Methods: `getAll()`, `getSingle(id)`, `getLatest()`,
  `getCount()`, `createSingle()` (= "create new ASV"), …
  Populated from the walk's `.attributes` object when EntityClass's
  `loadDetail()` runs.
- New `AttributeSetVersion.js` — singular. Extends WorldChild. Carries
  `id`, `life_cycle_stage`, `created_at`, `updated_at`, `committed_at`.
  Method: `commit()` (PATCH commit_attribute_set_version),
  `deleteDraft()` (DELETE), `attributes` (Attributes collection).
- New `Attributes.js` — collection. Methods: `getAll()`, `getSingle(id)`,
  `getCount()`, `createSingle(values)`, `updateSingle(id, patch)`,
  `deleteSingle(id)`. Each write delegates to Apollo via the parent
  chain, then triggers `this.parent.parent.refresh()` so the cache
  re-syncs from the walk.
- Relocated `Attribute.js` — now in
  `app/world/entityClasses/attributeSetVersions/attributes/`. Otherwise
  same shape (Object.assign + camelCase getters).
- Update `Hermes.node.jsx` Attribute instance's `coreFunctions`:
  read class id from `Athene.currentClassId` → `world.entityClasses
  .getSingle(id)` → `attributeSetVersions.getSingle(asvId)` → `.attributes`
  for the chosen ASV's data + writes.
- ASV id source: until the Chronos beta lands, default to
  `attributeSetVersions.getLatest().id` — preserves current "latest ASV"
  behavior without the hidden `loadedAsvId` state.
- Delete `app/attributeManager/`.

**Acceptance:** Attribute CRUD works identically (browse, view, edit,
create, delete). No HTTP-level change visible.

### I3 — Workbench tab vocabulary reframe

**Goal:** Make the versioning layer visible at the surface. The OOP
tree now exposes ASVs as their own level; the UI tab names should too.

**Work:**
- Update `nodes/EntityClassWorkbench/Root.jsx` `subManagers` array:
  - `'attributes'` label `Attributes` → label `Attribute Set Versions`
  - `'composition'` label `Composition` → label `Composition Scheme Versions`
  - Traits / Relations / Taxonomies stay (they ARE the conceptual
    children of EntityClass at that level)
- No SCSS change — same tab shape.
- Tab id strings (`'attributes'`, etc.) can stay short — they're
  internal. Labels are what the user reads.

**Acceptance:** Workbench's tab strip reads "Attribute Set Versions",
"Composition Scheme Versions", "Traits", "Relations", "Taxonomies."
The versioning structure is legible without the user clicking in.

### I4+ — Future subtree growth (deferred)

**First I4+ subtree landed (Traits beta T2, `86a46a0`, 2026-06-01):** the
`traits/` subtree — `Traits` (collection) → `Trait` →
`traitAttributeSetVersions/` (`TraitAttributeSetVersions`,
`TraitAttributeSetVersion`) → `attributes/TraitAttributes`, the leaf `Attribute`
**reused**. Built exactly to the I2 pattern below (parallel per-level collection
+ singular classes; `EntityClass.loadDetail` now populates `traits` from
`walk.traits` alongside `attributeSetVersions`). Proves the tree extends as a
consumer (the Traits feature) earns it. The remaining I4+ items stay deferred,
and now grow in a **fixed order** — the canonical slice order (apollo beta §
"Canonical slice order"): **composition → relations → taxonomies → class
versions → objects**. (Relations + Taxonomies are top-level collections on
`World`, not nested under EntityClass.)

Concretized when each consumer lands (listed in the canonical order):
- TraitAttributeSetVersions — **✓ landed (T2, above)**; Hermes/Trait + Hermes/TraitAttribute consume it (Traits beta T3)
- CompositionSchemeVersions + CompositionDirectives — **✓ landed (Composition beta C2, athene `0ae8f4a`)**: the `compositionSchemeVersions/` subtree (class-only, mirrors the ASV subtree; the `CompositionDirective` leaf is distinct from `Attribute`) — the **2nd I4+ subtree** to materialize after `traits/`. `Hermes/CompositionDirective` consumes it at C3.
- ClassVersions (Hermes/ClassVersion + the manifest UI)
- EntityObjects (when the instance-editing surface lands)
- EntityClassRelations + Taxonomies (top-level collections on World, parallel to EntityClasses)

Each follows the I2 pattern: new collection class + singular class +
relocate any existing manager into the new shape + retire the manager.

---

## Bottom-up propagation against parent (alpha)

Alpha §"Athene — control plane" lists "Business-class scaffold
(Jung-style architecture)" as a P0 deliverable, with an `inc/` tree
suggestion. This beta concretizes that scaffold into the World tree under
`app/` rather than `inc/` (inc/ stays inside individual nodes for
node-OOP concerns like theta did for Hermes). The conceptual intent
is unchanged — alpha gets a marker pointing at this beta for the realized
shape.

## Open calls left for execution

These don't block starting I1 — flagged here so they don't get lost:

1. **Refresh semantics on writes.** When `attributes.createSingle()`
   succeeds, what re-fetches? Just the parent ASV's data? The whole
   class's walk? The walk endpoint is what we have — re-fetching it
   gives us a consistent picture. Cost is one HTTP round-trip per
   write, which is what we do today.
2. **Stale references after refresh.** After `class.loadDetail()`
   re-runs, the previous `attributeSetVersion` and `attribute` objects
   are gone — new instances take their place. Any UI holding a stale
   reference reads from old state. Hermes already re-reads on every
   render, so it works. Anything else (the Chronos beta, future
   sub-managers) should follow the same pattern: don't cache domain
   references across renders.
3. **`Object.assign` field shadowing on classes.** EntityClass and
   Attribute both `Object.assign(this, raw)`. If raw has a key that
   collides with a class property (`parent`, `athene`, `apollo`,
   collection sub-objects), the spread silently overwrites the
   class-defined property. Risk is low (the walk's raw records don't
   use those keys), but worth a reserved-key check in WorldChild.
4. **EntityObjects.** Daniel flagged "EntityObjects will hold their
   objects" — meaning the tree extends to instances, each carrying
   its own field values + locale variants. This beta defers this; I4+
   lands it when the instance-editing surface earns its way. Worth
   leaving a placeholder `entityObjects` collection on EntityClass
   from I1 so it's visible the layer is anticipated.

## Phasing strategy

**Incremental, ship after each phase.** Theta proved this works for
OOP refactors — each phase leaves the app in a known-good state, with
the refactor consumer-rewired in lockstep with the structural change.
Single-cut would mean a longer no-ship window and a bigger blast
radius for any mistake.

Phase ordering: **I1 → I2 → I3**. I1 establishes the pattern (World +
collection + WorldChild base). I2 cascades it one level deeper.
I3 catches up the UI vocabulary now that the model layer makes the
versioning visible.

## What survives, what retires

**Survives:**
- `Apollo.js` — HTTP boundary unchanged
- `Athene.js` — gains `world`, loses managers
- `AtheneChild.js` — stays for infra children (Apollo)
- Hermes node + EntityClass instance + Attribute instance —
  `coreFunctions` rewire; UI unchanged
- `HermesSelectInput` and the rest of the input catalog
- Workbench + Chronos-to-come

**Retires:**
- `app/entityClassManager/` (entire folder, after I1)
- `app/attributeManager/` (entire folder, after I2)
- The `loadedAsvId` hack on the old AttributeManager
- The old "latest ASV via highest-numbered id" extraction code —
  becomes a clean `attributeSetVersions.getLatest()` method on the
  collection

**New:**
- `app/WorldChild.js`
- `app/world/` (entire subtree per I1/I2)
- ASV CRUD methods on the new AttributeSetVersions collection
  (the Chronos beta will use these even though this beta doesn't ship the UI)

## Cross-links

- Planning framework: `README.md`
- Parent plan: `alpha_implementation_plan.md`
- Conceptual model (the spec this beta implements): `../notes/conceptual-deep-dive.md`
- Theta plan (analogue at the Hermes layer; deleted after T7 — see
  the README's index for the one-off note) — same pattern, smaller
  scope
- Naming conventions: [[method-naming-convention]] (per-collection
  variant clarified above), [[component-naming-convention]] (unaffected
  but the principle is the same — surface the structure)
- Daniel's design ethic: [[unified-protocol]]
