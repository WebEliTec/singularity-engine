---
title:      Beta Implementation Plan — Composition (class-owned, separately-versioned bags of Composition Directives)
status:     COMPLETE ✓ — C1 (Apollo `1b364ed`) + C2 (athene `0ae8f4a`) + C3 (athene `89826c4`) all shipped & confirmed in-app 2026-06-02. Design locked (see §7). Fulfils Chronos E4. Beta done end-to-end.
date:       2026-06-02
scope:      Add Composition to the engine end-to-end: a class doesn't *contain* other classes — a **Composition Scheme Version** *describes* how it does, as a separately-versioned bag of **Composition Directives** ("this sub-class goes here, optionally trait-qualified, with this cardinality"). Each directive is a NEW per-element shape ({ subClassId, traitId?, cardinalityRules, description }) — so this slice reuses the version *lifecycle* wholesale but builds genuinely new *content*. This beta delivers the full vertical: Apollo backend, the Athene World tree subtree, **Chronos E4** (the CompositionSchemeVersion instance), a `Hermes/CompositionDirective` with a runtime sub-class SELECT picker, and the (currently placeholder) workbench Composition tab.
parent:     alpha_implementation_plan.md
depends_on: beta_implementation_plan_apollo.md, beta_implementation_plan_world_oop_tree.md, beta_implementation_plan_hermes.md, beta_implementation_plan_chronos.md
phases:
  C1: done ✓ — Apollo composition backend: CompositionSchemeVersion CRUD + draft→commit→immutable lifecycle + Composition Directive CRUD (ordered ARRAY, deterministic id) + `compositionSchemeVersions` in the class walk. Lifecycle SHAPE copied from the ASV slice; directive content is new. Landed apollo `main` `1b364ed` (2026-06-02); verified by a 40-assert curl harness + a 6-finder adversarial review (0 confirmed findings). VOCABULARY rows added.
  C2: done ✓ — Athene plumbing: World-tree `compositionSchemeVersions/` subtree (4 new classes — none reusable from attributes; directive shape + server-derived id differ) + `Apollo.js` `_csvPath` + CSV/directive methods + `EntityClass.loadDetail` populates `compositionSchemeVersions` from `walk.compositionSchemeVersions`. Landed athene `epsilon` `0ae8f4a` (2026-06-02); verified by a 20-assert harness driving the real World-tree classes vs live node-Apollo (materialization + write vertical + re-acquire by derived id + immutability).
  C3: done ✓ — Athene UI: `Chronos/CompositionSchemeVersion` (= **Chronos E4**) + `Hermes/CompositionDirective` (data-driven sub-class SELECT — three inputs: subClassId/cardinalityRules/description) + the one-level Composition workbench tab. The ONE Hermes-engine change (app-level, NOT morpheus-core): a SYNCHRONOUS `resolveFieldOptions` coreFunction resolving `dynamicOptions` selects in `getVisibleInputElements` + a `created?.id` fallback in `createResource` for server-derived ids. Landed athene `epsilon` `89826c4` (2026-06-02); confirmed in-app by Daniel (create CSV → directive via the live dropdown → edit → commit → immutability; Attributes/Traits tabs regression-clean). (No boolean affordance — `isSupplementClass` dropped; trait qualifier deferred.)
---

# Beta Implementation Plan — Composition

*Drafted 2026-06-02. A **feature beta** — a sibling division of alpha that
**composes** the subsystem betas (Apollo, World-OOP-tree, Hermes, Chronos)
rather than owning one subsystem. Level is graph position, not kind-of-thing
(see README.md): a feature that cuts across subsystems is still one level below
alpha. Its phases land **in** those subsystems and fulfil work each already
anticipated as deferred — Apollo's "full eventual stack" (slice 1, the next in
the canonical order), Chronos's **E4 CompositionSchemeVersion**, the
World-OOP-tree beta's **I4+** subtree growth, a new Hermes instance. The
Composition slice is the **heaviest remaining schema slice** because, unlike
Traits, its content is a genuinely new shape — see §2.*

## 1. What Composition is (conceptual recap)

From `notes/conceptual-deep-dive.md` (concept rows 5–6, §3.2, §3.5, axis #3):

- **A class does not contain other classes.** A **Composition Scheme Version**
  *describes how it does* — it is *"a versioned bag of Composition Directives on
  an Entity Class"* (deep-dive §axis #3). Composition is **versioning axis #3**.
- A Composition Scheme Version is a **first-class, separately-versioned entity**
  — **NOT embedded in the class definition** (invariant §3.2). It evolves on its
  **own draft → committed timeline**, independently of the class's attribute
  sets and traits. The class definition and "how this class is composed" version
  on separate clocks.
- A **Composition Directive** is a single composition rule: *"this sub-class
  goes here, optionally qualified by a trait of that sub-class, with this
  cardinality, with this description."* Fields:
  `{ subClassId, traitId?, cardinalityRules, description }`. *(A legacy
  `is_suplement_class` boolean existed but is **dropped from this slice** —
  §7 locked decision 1; revisit once its meaning is settled.)*
- The directive **id is deterministic**: `{subClassId}` alone, or
  `{subClassId}:{traitId}` when the directive is trait-qualified — not a
  user-typed key. (Implication for the UI: the directive create form has **no
  free `id` field** — §6.)
- A **Composition Scheme Version follows the universal draft → committed
  lifecycle**: drafts mutable/deletable, committed immutable — the *same*
  machinery as a Class's ASVs and a Trait's TASVs.

**A directive targets a sub-CLASS, never a bare Trait.** Deep-dive concept row 5
(and the conceptual map's `contains` edge) phrases this as a class "contains
other **Classes/Traits**" — Traits, plural, read as a containable thing. The
implementation does **not** support composing a bare Trait directly: every
directive's primary target is a `subClassId`, and `traitId` is only an *optional
qualifier of that sub-class*. This is faithful to legacy parity (legacy required
`sub_class_id`; `trait_id` was always a qualifier), but it **silently resolves a
genuine ambiguity in the conceptual text**, so it is called out here and as a
§7 fork — flag if Daniel intended a bare-Trait composition form.

So composition is the **class → ASV → attribute** *lifecycle* you already
shipped, with a **different leaf**:

```
Entity Class → Attribute Set Version    → Attribute              ← built (slice 1)
Entity Class → Trait → Trait ASV        → Attribute              ← built (Traits beta)
Entity Class → Composition Scheme Version → Composition Directive ← this beta
```

**Why composition is a separate axis, not "more attributes."** A Composition
Scheme Version says nothing about *what the class is* (its own attributes) — it
says *what the class is built out of*. A `Computer` class's attributes are
`serialNumber`, `model`; its composition directives are "1 `Motherboard`,
`qty>0` `RamStick`, an optional `GraphicsCard`." The two answer different
questions and version independently — which is exactly why the Class Version
manifest (later slice) must *select* one ASV **and** one composition-scheme
**and** a set of trait-versions to pin a coherent class snapshot (deep-dive
§3.5). Binding is **out of scope here** (§8) — composition versions exist and
version *before* any manifest binds them.

## 2. The reuse keystone — and an honest caveat: less reuse than Traits

Traits was ~90% reuse: a TASV **was** an ASV and a trait-attribute **was** an
Attribute, so the entire vertical was the existing shape nested one level
deeper. **Composition is *not* that lucky.** The *version lifecycle* is reuse;
the *content is brand new*.

| Layer | Traits beta | Composition (this beta) |
|---|---|---|
| Version lifecycle (create/commit/delete-draft, immutability, id-minting) | reuse | **reuse** — same machinery |
| Chronos version strip | reuse | **reuse** — a 3rd instance, engine already generic |
| The leaf content shape | reuse (Attribute) | **NEW** — a Directive ≠ an Attribute |
| Content CRUD (find-in-array, dup-id, draft-gate, write-back) | reuse | **reuse in *structure*, new in *fields*** |
| The editor inputs | reuse (Attribute fields) | **NEW** — sub-class SELECT + cardinality + description (trait qualifier deferred; no boolean — `isSupplementClass` dropped) |
| The select option source | static (baked `dataType` enum) | **NEW framework work** — runtime-sourced (live entity classes) |

**What already exists and is verified (reuse):**

- The **draft → committed version lifecycle** — sequential-int id-minting
  (`max(ids)+1`), empty-commit guard (`400`), committed-immutability on delete
  and on content-mutate. Apollo's `World.js` ASV block + `FileStore` path
  helpers + the `entityClasses` route block are the line-for-line template
  (grounding: the CSV vertical is a *copy-with-substitution* of the ASV
  vertical, not a generalization over it — see below). Timestamps are
  **ISO-8601 strings via the shared `nowIso()`** (`World.js:250`) — see §3.
- **Chronos** is already fully instance-agnostic (proven by Traits T3.3 / E5): a
  new instance needs only a `versionCollectionMeta` block + the 5 lifecycle
  `coreFunctions`. Zero structural change.
- **Hermes** CRUD, `HermesInput` dispatcher, `HermesSelectInput` (the `select`
  renderer), all body modules, the OOP layer — reused untouched.
- The **`{ success, data }` / `{ success, error }` envelope**,
  `ApolloError.notFound/validation/conflict` (no new codes), the single
  `entityClassRoutes` plugin registration + server error handler.

**What is genuinely new (be honest) — ONE structural framework touch:**

1. The **Composition Directive** entity — a per-element shape with no Attribute
   analog (`subClassId`, `traitId?`, `cardinalityRules`, `description`).
   Directive-CRUD *mirrors* attribute-CRUD structurally (array find / dup-id
   `409` / draft-gate / write-back) but the field-set, validation, and
   **deterministic id derivation** are all new. *(This is new **content**, not a
   new **engine** capability — it's authored in the World tree + Apollo, not in
   Hermes.)*
2. The **deterministic directive id** (`{subClassId}` or `{subClassId}:{traitId}`)
   — the server **derives** it from the body and dup-checks the derived id,
   rather than accepting an arbitrary client id (unlike attribute create). Again
   backend content, not an engine change.
3. **The one genuine engine change — a synchronous, runtime-sourced options
   resolver for Hermes selects** (C3). The sub-class picker's options are the
   **live list of entity classes**, not a baked enum. Today's pipeline
   (`getVisibleInputElements` → `EditBody` → `HermesSelectInput`) only carries
   *static* `config.options` (`HermesSelectInput.jsx:13` reads only
   `config.options`; `EditBody.jsx:23-24` passes config straight through;
   `Hermes.js:223-232` copies config untouched and is **synchronous**). This is
   the **single** structural Hermes-engine touch the slice requires — and it is a
   **reusable capability** (Relations + Taxonomies will want the same entity-class
   picker).

*(With `isSupplementClass` dropped — §7 locked decision 1 — there is **no
boolean-input affordance** to build: `HermesInput`'s lack of a checkbox renderer
becomes a non-issue, and the slice stays at exactly one structural engine change.
The deferred trait qualifier would add two more engine mechanisms when it lands —
reactive dependent options + cross-field display, §6 point 2 — but it is **not**
on this slice's critical path.)*

**Key seam (grounding):** Traits generalized the ASV lifecycle over an *owner*
(`{classId}` | `{classId,traitId}`), not into a version-type-agnostic primitive.
A Composition Scheme Version is owned **only** by a class (`{classId}`) — never a
trait — so the owner-axis buys nothing here. The reuse is therefore
**copy-with-substitution** (`attributes[]` → `compositionDirectives[]`,
`#requireOwner` → a plain `#requireClass`, no trait branch in the store paths),
**not a shared code path**. Decide in C1 whether to copy-then-tidy or extract a
small shared version-lifecycle helper while landing the second class-only
versioned type.

## 3. Data model + on-disk shape (Apollo)

```
apollo/world/entity-classes/{classId}/
  identity.json
  attribute-set-versions/{n}.json            ← existing
  traits/…                                    ← existing (Traits beta)
  composition-scheme-versions/
    {n}.json                                  ← a Composition Scheme Version
                                                {
                                                  id, lifeCycleStage,
                                                  createdAt, committedAt,
                                                  compositionDirectives: [ … ]   ← ARRAY
                                                }
```

**Composition Scheme Version record** — identical *shape* and identical *types*
to an ASV, with `attributes` swapped for `compositionDirectives`. **Timestamps
are ISO-8601 strings**, not legacy unix ints — written by the shared
`nowIso() = () => new Date().toISOString()` (`World.js:250`) into both
`createdAt` (`World.js:117`) and `committedAt` (`World.js:135`), and emitted
verbatim by the contract serializer. The CSV record is **byte-for-byte
type-identical** to an ASV record (so the Athene `CompositionSchemeVersion`
singular, copied from `AttributeSetVersion.js`, which expects a string
`createdAt`, handles them unchanged). The legacy CCC backend's unix-int
`created_at` is **not** carried forward.

```jsonc
{
  "id": 2,
  "lifeCycleStage": "draft",                  // "draft" | "committed"
  "createdAt":  "2026-06-02T10:00:00.000Z",   // ISO-8601 via nowIso() — NOT a unix int
  "committedAt": null,                        // ISO-8601 string on commit, immutable thereafter
  "compositionDirectives": [                  // ORDERED ARRAY — see below
    {
      "id": "ram-stick",                      // deterministic: subClassId
      "subClassId": "ram-stick",
      "cardinalityRules": "qty>0",
      "description": "<p>…</p>"
    },
    {
      "id": "graphics-card:gaming",           // deterministic: subClassId:traitId
      "subClassId": "graphics-card",
      "traitId": "gaming",                    // a trait of the SUB-class, not the host
      "cardinalityRules": "1",
      "description": "<p>…</p>"
    }
  ]
}
```

**Directive shape** — `{ id, subClassId, traitId?, cardinalityRules,
description }`:

- **`subClassId`** (required) — the composed class, which **must differ from the
  host class** — a class cannot compose itself (**reversed 2026-06-03**; enforced
  in Apollo, see §7). Any *other* entity class may be a sub-class. (Legacy did not
  exclude the host; we now do.)
- **`traitId?`** (optional) — qualifies the directive to a **trait of the
  sub-class** (e.g. "a `GraphicsCard` *with the `gaming` trait*"). **Not** a
  trait of the host class (§6/§7). **Present in the data model + API**, but the
  editor *qualifier picker* is deferred (§7 locked decision 4).
- **`cardinalityRules`** — a string from the small grammar `"1"`, `"qty"`,
  `"qty>0"`, … or `null`. (§7: accept `string|null` in C1; grammar-validate in the
  C3 input only.)
- **`description`** — required rich text.
- *(Dropped: `isSupplementClass` — §7 locked decision 1. The legacy on-disk
  `is_suplement_class` boolean is **not** carried into this slice.)*

**Id convention (deterministic, server-derived):**

- no trait → `id = subClassId`
- trait-qualified → `id = subClassId + ":" + traitId`

So directives need **no id-minting** (unlike scheme versions, which mint
sequential ints). The id is a **stable natural key**; create dup-checks the
derived id (`409`).

**Frozen identity — `subClassId` and `traitId` are the id source, hence
immutable on update.** Because the id is *derived* from `subClassId[:traitId]`,
those two fields are the directive's identity and are **frozen on PATCH**,
exactly as `updateAttribute` (`World.js:166-178`) freezes and re-pins the
attribute id on every patch. The update body **cannot** contain `subClassId` or
`traitId`; only `cardinalityRules` / `description` are patchable. To re-target a directive to a different sub-class (or to add/remove
the trait qualifier — which *flips* the id, see below), **delete and re-create**
(yielding a new id). See §4 for the schema and §7/§9 for the "flip the
qualifier" edge.

**ARRAYS, not id-keyed maps (Apollo's locked contract decision).** The legacy
CCC backend stored `composition_directives` as a **map keyed by directive id**.
Apollo's locked decision turns every such id-keyed map into an **ordered
ARRAY** — so `compositionDirectives` is an array exactly like `ASV.attributes`,
the deterministic id lives in each element's `id` field, and lookup is
find-by-id over the array. (Order is authoring order; the id stays the stable
key for update/delete and dup-detection.)

**Lifecycle import — NEW vs legacy.** The legacy composition slice had **no
commit and no immutability at all** (`life_cycle_stage` was hard-written
`'draft'` and never read; directives were mutable on any version; legacy delete
had **no draft-stage guard** and could remove a *committed* version — only
version `'1'` was undeletable). The draft→committed commit op +
committed-immutability is **imported from the sibling attribute-set slice**
(`commit_attribute_set_version`) — it is **new work for composition**, not a
port. In particular, we adopt the attribute-set delete-guard
(`lifeCycleStage !== 'draft' → 409` on delete), which legacy never had — see §4
and §7. Apollo already localizes immutability in its per-version domain methods,
so this is the same machinery the ASV/TASV slices already proved.

## 4. The Apollo contract (C1) — mirrors entity-classes, sibling of ASV

```
GET    /entity-classes/{id}/composition-scheme-versions                          → 200  list CSVs
POST   /entity-classes/{id}/composition-scheme-versions                          → 201  create draft CSV, returns full CSV object
DELETE /entity-classes/{id}/composition-scheme-versions/{csvId}                  → 200  delete draft, returns { id } (committed → 409)
POST   /entity-classes/{id}/composition-scheme-versions/{csvId}/commit           → 200  commit (empty → 400*, committed → 409)
POST   /entity-classes/{id}/composition-scheme-versions/{csvId}/directives                    → 201  create directive (id DERIVED, dup → 409), returns directive object
PATCH  /entity-classes/{id}/composition-scheme-versions/{csvId}/directives/{directiveId}      → 200  update directive (committed → 409, missing → 404)
DELETE /entity-classes/{id}/composition-scheme-versions/{csvId}/directives/{directiveId}      → 200  delete directive (committed → 409, missing → 404)
```

\* `empty → 400` is **subject to the §7 empty-commit fork** — default mirrors ASV
(`World.js:130-134` → `400`); if Daniel rules an empty composition legitimately
commitable, this `400` is dropped. The table shows the C1 *default*, not a
settled-beyond-question code.

- **Success status codes follow Apollo's locked convention** (annotated above):
  every POST-create returns **`201`** (`entityClasses.js:111,124,164,177` —
  `reply.code(201)`), `POST .../commit` returns **`200`** (no `reply.code`),
  DELETE returns **`200`**. **Response bodies match the mirrored shapes**: a CSV
  create returns the **full CSV contract object**
  (`{ id, lifeCycleStage, createdAt, committedAt, compositionDirectives: [] }`)
  — `new CompositionSchemeVersion(record).toContract()`, the analog of
  `World.js:122` `new AttributeSetVersion(record).toContract()`, **not** a bare
  `{ id }`; a directive create returns the **full directive object**; commit
  returns the updated CSV object; DELETE returns `{ id }`.
- **Same clean conventions as slice 1 + traits**: plural REST nouns, no
  verbs-in-path (commit = a `POST` action sub-resource), single-encoded
  camelCase bodies, `{ success, data, … }` / `{ success, error:{ code, message } }`
  envelopes, real 4xx codes, CORS already on. Routes **append to the existing
  `entityClassRoutes` Fastify plugin** — no new plugin, no `server.js` change,
  zero new error codes.
- **Body schemas obey the locked Apollo body-schema convention**
  (`entityClasses.js:28-30,38,73` — `removeAdditional` disabled; an unknown
  field is a loud `400`):
  - `createDirectiveBody = { type:'object',
    required:['subClassId','cardinalityRules','description'],
    additionalProperties:false,
    properties:{ subClassId, traitId?, cardinalityRules, description } }`
    — **no `id` property** (the server derives it; a client-supplied id is a
    contract violation and must be rejected, analogous to update bodies omitting
    id at `entityClasses.js:30`). **No `isSupplementClass`** (dropped — §7).
  - `updateDirectiveBody = { type:'object', minProperties:1,
    additionalProperties:false,
    properties:{ cardinalityRules, description } }`
    — **no `id`, no `subClassId`, no `traitId`** (those are frozen identity;
    changing them would change the derived id — see §3 frozen-identity rule).
- **The class walk grows `compositionSchemeVersions`** (a sibling of
  `attributeSetVersions` and `traits`):
  `GET /entity-classes/{id}` →
  `{ …meta, attributeSetVersions: [...], traits: [...], compositionSchemeVersions: [ { id, lifeCycleStage, createdAt, committedAt, compositionDirectives: [...] } ] }`.
  `EntityClass.toWalk()` gains the 4th sibling array; `World.#loadClass` loads
  CSV records via a new `store.listCompositionSchemeVersionRecords({classId})`.
  Composition is **class-only** — no per-trait nesting (contrast traits' second
  level). **The walk-embedding is the primary read** (mirroring ASV); the
  standalone `GET .../composition-scheme-versions` list is a *new convenience*
  read (legacy had **no** dedicated composition GET — it surfaced only via the
  whole-class GET). The two read paths are intentional, not an accidental
  duplication.
- **`csvId`** is a sequential-int path segment (like `asvId`, anchored pattern
  per the codebase convention). **`directiveId`** is the deterministic natural
  key and must allow the **`:` qualifier form** in the path
  (`…/directives/graphics-card:gaming`). Per the codebase's "every param has an
  anchored pattern" convention (`entityClasses.js:14-17` for `ATTR_ID` /
  `ASV_ID`), its schema is **explicitly**:
  `DIRECTIVE_ID = ^[a-z0-9]+(?:-[a-z0-9]+)*(?::[a-z0-9]+(?:-[a-z0-9]+)*)?$`
  (kebab `subClassId`, optional `:` + kebab `traitId`). **Wire convention:**
  clients **percent-encode the `:` as `%3A`** in the request path;
  Fastify 5 / find-my-way decodes the segment back to `graphics-card:gaming`. (A
  raw `:` is a gen-delims edge some clients/proxies mangle — encoding avoids
  integration surprises.) The literal `:` appears only in the param *value*, not
  the route *template*, so it does not collide with find-my-way's `:`-param
  syntax. Directives are **embedded** (not file-pathed) — only `csvId` traverses
  the filesystem (and is guarded by `FileStore`'s `#seg`) — so the directive id
  carries no path-traversal risk; the anchored pattern is the schema backstop the
  convention demands.
- **Draft-only directive writes + committed-immutability.** Directive
  create/update/delete go through `#requireDraftCsv` (mirror of
  `#requireDraftAsv`): mutating a committed CSV → `409`. Deleting a committed CSV
  → `409` (we adopt the attribute-set delete-guard `!== 'draft' → 409`, which
  legacy never had — §3/§7). Commit on an empty CSV (no directives) → `400`*;
  re-commit → `409`.
- **Directive id is server-derived.** The create body carries
  `subClassId` (+ optional `traitId`); the handler derives
  `id = subClassId[:traitId]`, dup-checks it against the array (`409`), and
  stores it as the element's `id`. The client never supplies the id. On PATCH,
  `subClassId`/`traitId` are absent from the body (frozen identity, §3), so the
  id is stable across updates.

## 5. The Athene side (C2 + C3)

**C2 — plumbing (World tree + Apollo.js):**

- `app/world/entityClasses/compositionSchemeVersions/` →
  `CompositionSchemeVersions.js` (collection — copy `AttributeSetVersions.js`,
  swap the walk key to `walk.compositionSchemeVersions` and the Apollo create
  call), `CompositionSchemeVersion.js` (singular — copy
  `AttributeSetVersion.js`: `id/lifeCycleStage/createdAt/committedAt` +
  `isDraft/isCommitted` + `commit()`/`deleteDraft()`; its child collection is
  `compositionDirectives`), then
  `compositionDirectives/CompositionDirectives.js` + `CompositionDirective.js`.
  **The directive classes are NEW, not a reuse of `Attributes`** — the
  per-element shape and the deterministic id differ. (This is the World-tree
  honesty caveat: the *version* level mirrors the ASV subtree, but the *leaf*
  collection is its own pair of classes.)
- `EntityClass.loadDetail()` calls
  `this.compositionSchemeVersions._populateFromWalk(walk)` alongside the existing
  `attributeSetVersions` + `traits` calls; the constructor instantiates it.
  (`EntityClass.js` already *names* `compositionSchemeVersions` as a planned
  sibling.)
- `Apollo.js` gains the CSV methods (`createCompositionSchemeVersion`,
  `commitCompositionSchemeVersion`, `deleteCompositionSchemeVersionDraft`) + the
  directive methods (`createCompositionDirective` / `update…` / `delete…`,
  keyed by the deterministic directive id) + a `_csvPath` / `_csvDirectivePath`
  helper pair (model: `_asvPath` / the trait path helpers). None exist today —
  grep finds only forward-reference comments in Athene.

**C3 — engines + the Composition tab:**

- **`Chronos/CompositionSchemeVersion`** instance — the version strip for the
  class's CSVs. This **fulfils Chronos E4**. Copy the `AttributeSetVersion`
  Chronos instance verbatim, swapping `entityClass.attributeSetVersions` →
  `entityClass.compositionSchemeVersions` and the Athene accessor pair →
  `get/setSelectedCompositionSchemeVersionId`. Engine unchanged.
- **`Hermes/CompositionDirective`** instance — CRUD over the *selected CSV's*
  directives, scoped by `(currentClassId, selectedCompositionSchemeVersionId)`
  (a `_resolveSelectedCsv` helper mirroring `_resolveSelectedAsv`, + a
  `_requireSelectedCsv` write-guard). inputElements (3 in the first increment):
  the **data-driven `subClassId` SELECT** (options = live entity classes),
  `cardinalityRules` (text, grammar-validated), `description` (required rich
  text). The **`traitId` qualifier picker is deferred** (§7 locked decision 4)
  and `isSupplementClass` is **dropped** (§7 locked decision 1). The directive
  has **no free `id` field** (it's derived from `subClassId[:traitId]`).
- **The data-driven options resolver (the one structural engine change) —
  SYNCHRONOUS in slice 1.** Extend `getVisibleInputElements` (or a thin sibling)
  so an `inputElements[field]` can declare a runtime options source resolved to
  populate `config.options` **before** `EditBody` hands config to
  `HermesSelectInput`. **Locked decision:** the resolver runs **synchronously**
  — `getVisibleInputElements` is synchronous today (`Hermes.js:223`) and
  `EditBody` renders synchronously from it (`EditBody.jsx:18-23`), so the
  resolver reads the **already-warm** `world.entityClasses.getAll()`
  synchronously and maps to `{ value:id, label:displayName }`. **Slice 1 does
  NOT support async option fetches**; async option sourcing is deferred to
  whenever a not-already-warm source appears. This keeps the "one engine change"
  genuinely small and matches the synchronous render path. (`world.entityClasses`
  is already loaded via `EntityClasses.loadAll`.)
- **Workbench coordination** — `selectedCompositionSchemeVersionId` signal on
  `EntityClassWorkbench` + the Athene `get/setSelectedCompositionSchemeVersionId`
  accessor pair (mirror epsilon E2 / the ASV machinery: the setter flips the
  workbench signal + the Chronos mirror via
  `chronosKernels.get('CompositionSchemeVersion')` + the Hermes refresh).
  **One** signal, **one** Chronos, **one** Hermes — no second selection level
  (§6).
- Flip `EntityClassWorkbench/Root.jsx`'s composition branch from the placeholder
  to the Attributes-tab twin:
  `<Node id='Chronos' instance='CompositionSchemeVersion' />` +
  `<Node id='Hermes' instance='CompositionDirective' />`. (The `composition` tab
  + its "Composition Scheme Versions" label already exist.)
- Agent-facing **descriptions** (β2) for the two new instances.

## 6. The Composition tab UX — resolved: ONE level

**Resolved — one level, the Attributes-tab shape (not the Traits two-level
drill).**

The Traits tab needed **two** levels (pick a trait → pick that trait's TASV →
edit attributes) *only* because a Trait is identity-only and **owns a second
versioned family** (its TASVs) — so there were two things to pick before you
reach content. **Composition has no such nesting.** A Composition Scheme Version
**IS** the versioned thing directly under the class — a sibling of an ASV — and
its directives live inside the selected CSV exactly as attributes live inside
the selected ASV. So the Composition tab is the **one-level Attributes-tab
shape**: one `selectedCompositionSchemeVersionId` signal driving a Chronos strip
+ a Hermes editor. **No `viewAction` drill, no "← Back" door, no second
selection signal.** (This is why the slice's UX is *simpler* than Traits even
though its backend content is *harder*.)

**The directive editor (the genuinely new surface).** **Three** inputs in the
first increment (`subClassId`, `cardinalityRules`, `description`), mapping to the
directive shape — the trait qualifier (point 2) is a deferred follow-up and
`isSupplementClass` is dropped (§7):

1. **`subClassId`** — the **sub-class picker**, a **SELECT**, required. Options =
   the **live list of entity classes** (`world.entityClasses`), sourced at
   runtime via the new **synchronous** data-driven resolver (§5) — **not** a
   baked enum. This is the one piece that needs structural framework work. Label
   e.g. "Sub-class". (Legacy offered *all* classes including the host; **self-
   composition is now FORBIDDEN — reversed 2026-06-03, enforced in Apollo, §7**;
   the picker still *offers* the host pending the deferred FE-3, so picking it
   400s on submit.) **The SELECT only offers existing classes**, so
   forward-reference directives are **not authorable via the editor in this
   slice** — the substrate (Apollo not validating `subClassId` existence, §7)
   keeps the API forward-reference-ready for the later forward-reference slice,
   where the editor would gain a free-entry / pending-class affordance.
2. **`traitId`** — the **optional trait qualifier**, a SELECT whose options would
   be the **traits of the chosen sub-class**, shown only after a sub-class is
   chosen, refreshed when `subClassId` changes. **Recommendation: ship the flat
   `subClassId` select first and the trait qualifier as a follow-up.** In
   **new-engine terms** (not the legacy hub vocabulary), this qualifier needs
   **two mechanisms that do not exist today**: (i) a **reactive dependent-options
   resolver** that re-runs when *another field's* value changes — today
   `updateField` (`EditingDraft.js:56`) just sets a draft value and nothing
   re-resolves options; and (ii) **cross-field conditional display** —
   `shouldDisplayField` (`Hermes.js:212-218`) honors only `displayConditions.mode`
   and has **no** `dependsOn`-another-field. (The legacy `displayConditions.dependsOn.sub_class_id`
   + `get_traits_of_content_classes()[subClassId]` are **legacy mechanisms to be
   rebuilt**, not hooks that merely need a second use.) So the deferred qualifier
   is **two new framework mechanisms**, which is exactly why it is deferred
   (§7/§8). (§7: confirm the qualifier is a trait of the **sub-class**, per
   legacy, not the host.)
3. **`cardinalityRules`** — a text input validated by the cardinality grammar
   (the legacy `quantityEquation` rule: digits, the literal `qty`, `&& ||`,
   `== <= >= != < >`, parens, or empty — the source of the real values `1` /
   `qty` / `qty>0` / `null`). (§7: enforce the full grammar now or accept
   `string|null` and defer strict validation.)
4. **`description`** — required rich text.
*(Dropped: `isSupplementClass`. Per §7 locked decision 1 it is absent from the
slice entirely — no input, no renderer. This is why `HermesInput`'s lack of a
boolean/checkbox renderer is a non-issue here, and the slice stays at exactly one
structural engine change, the data-driven SELECT.)*

**No free id field.** The directive id is derived server-side from
`subClassId[:traitId]`; the create form must **not** prompt for an id (unlike
EntityClass / Attribute / Trait, which take a client-typed kebab id). The
directive's display label should read the **sub-class's label** (resolved from
`world.entityClasses`), optionally suffixed with the qualifying trait.

## 7. Decisions to lock

**Decisions — LOCKED 2026-06-02 (Daniel).** The four genuine forks were resolved:

1. **`isSupplementClass` → DROPPED from this slice.** The field is omitted entirely
   from the directive shape until its meaning is nailed down; a later increment may
   reintroduce it. *Consequence:* the directive is `{ id, subClassId, traitId?,
   cardinalityRules, description }`, and the **boolean-input affordance disappears** —
   so the slice's *only* structural engine change is the data-driven sub-class SELECT
   (§2 is now ONE framework touch, not two).
2. **New-class seeding → START WITH NONE.** A new class begins with **zero** CSVs (no
   auto-created v1); the Composition tab shows an empty-state. Plain monotonic-id
   minting (`max+1`), draft-deletable / committed-immutable — **no legacy "v1
   undeletable" rule**. *Consequence:* C1 has **no seed step**; C2 needs the
   empty-state.
3. **Empty commit → REJECT (400).** A committed CSV must contain ≥1 directive — mirrors
   the ASV empty-commit guard. The §4 route table's `400` is settled (the caveat is
   removed).
4. **Trait qualifier → DEFER (flat sub-class picker first).** C3 ships the `subClassId`
   SELECT only; the optional `traitId` qualifier (a trait **of the sub-class**) is a
   follow-up increment (§6 point 2 / §8). The **data model + API keep `traitId`** (a
   directive *can* be trait-qualified via the contract, and its deterministic id
   supports `:traitId`) — only the editor *qualifier picker* is deferred.

*(The remaining items below are lower-stakes defaults, locked unless Daniel objects.)*

**⭐ Amended 2026-06-03 — TWO landed changes (post-C3):**
- **Self-composition REVERSED → now FORBIDDEN** (was "allowed — legacy parity").
  A class cannot be its own composition partner: Apollo rejects a directive with
  `subClassId === hostClassId` (**400**, traitId-agnostic — host-with-a-trait is
  still self-composition). Enforced at **create** (`World.createCompositionDirective`)
  AND, defense-in-depth, at **commit** (a CSV holding a self-directive can't be
  committed — catches out-of-API/pre-rule data). **Status = 400** (validation): the
  rejection is knowable from the request alone (route classId vs body subClassId,
  no state lookup), unlike the dup-check's 409 — *Relations should mirror this 400
  for its self-reference rule*. Verified by a 10-assert (create) + 8-assert
  (commit) harness. Frontend picker still offers the host → **deferred FE-3**
  (`deferred_frontend_security.md`), per backend-security-first. (This supersedes
  the §3 / §6 "keep parity" notes.)
- **Trait qualifier LANDED** (was "deferred", decision 4 below). The `traitId`
  dependent select shipped in **C3.1** (athene `25e7874`) via the general Hermes
  dependent-fields capability (options = the chosen sub-class's traits, loaded
  async). So decision-4's "deferred" is historical; the picker now exists.

**Recommended defaults (lock unless Daniel objects):**

1. **CSV = ASV shape** (type-identical, **ISO-8601 timestamps via `nowIso()`**),
   `attributes` → `compositionDirectives`; same draft→committed lifecycle, same
   sequential-int id-minting, same committed-immutability. Reuse the lifecycle
   machinery; build new content.
2. **Directives are an ordered ARRAY** (Apollo's locked contract), with the
   **deterministic id** (`subClassId` or `subClassId:traitId`) as each element's
   `id`, **server-derived** on create + dup-checked (`409`). `subClassId`/`traitId`
   are **frozen on update** (id source). The legacy id-keyed map is dropped.
3. **`isSupplementClass`** — **DROPPED this slice** (locked above). Not stored,
   not edited, absent from the directive shape; revisit in a later increment once
   its meaning is settled. (Eliminates the only boolean-input question.)
4. **Composition tab = one level** (§6) — the Attributes-tab shape, no drill.
5. **One structural Hermes-engine change** — the **synchronous** data-driven
   options resolver (§5); ship the flat `subClassId` select first.
6. **A directive targets a sub-CLASS only** (no bare-Trait composition form);
   `traitId` is a qualifier of that sub-class. Adopts the attribute-set
   **delete-guard** (committed CSV → `409` on delete), which legacy lacked.

**Forks — resolved (the four genuine ones LOCKED above; the rest locked as defaults):**

- **`isSupplementClass` semantics.** ✅ **RESOLVED — dropped this slice** (locked
  decision 1). No field, no behavior; revisit later.
- **Empty-commit guard.** ✅ **RESOLVED — reject empty (`400`)** (locked decision 3),
  mirroring ASV. The §4 `400` is settled.
- **Initial CSV seeding + legacy "v1 undeletable" rule.** ✅ **RESOLVED — start with
  zero CSVs, no v1-special rule** (locked decision 2): plain `max+1` minting,
  draft-deletable / committed-immutable. C1 has no seed step; C2 carries the
  empty-state.
- **Trait qualifier = host-trait or sub-class-trait? + build now?** ✅ **RESOLVED —
  sub-class trait, deferred** (locked decision 4). The qualifier is a trait *of the
  sub-class* (legacy parity); the editor picker is a C3 follow-up; the data
  model/API keep `traitId`. The host-trait-driven **Trait-Specific Class
  Composition** remains a separate future concept (§8).
- **Delete-stage guard.** Locked default: deleting a **committed** CSV → `409` (adopt
  attribute-set immutability; legacy lacked this). Near-certain given the §3.1
  invariant.
- **Bare-Trait composition (conceptual ambiguity).** Locked default: a directive
  targets a **sub-CLASS only**; `traitId` is a qualifier, never a primary bare-Trait
  target (legacy parity, §1). Daniel's trait-qualifier answer (decision 4) confirms
  the sub-class-primary reading. (Flag if ever intended otherwise.)
- **Cardinality grammar to support now.** Locked default: **accept `string | null` in
  C1** (store verbatim); enforce the `quantityEquation` grammar in the **C3 input
  validator only** — no authoritative server-side grammar check unless Daniel wants
  one.
- **Forward-reference directives.** Locked default: **do NOT validate sub-class /
  trait existence at create time** — keep the substrate forward-reference-ready;
  defer existence-tracking + the implicit event system to its own slice (§8). The
  editor SELECT offers only existing classes anyway (§6 point 1). (Open nicety: a
  *soft* UI warning later — not in this slice.)
- **Directives: array vs map.** Locked: **ordered array** (Apollo's contract; a
  deviation from the legacy id-keyed map). Ordering = authoring order; deterministic
  id stays the stable key for find/update/delete/dup-detection.
- **Flip-the-qualifier identity edge.** Locked default: because the id is derived and
  `subClassId`/`traitId` are frozen on PATCH (§3), re-targeting a directive (or
  adding/removing the trait qualifier, which flips the id) is **delete + re-create**
  (new id), surfaced in the editor as "changing the sub-class or trait creates a new
  directive." (Moot for C3's first increment, which has no qualifier picker.)

## 8. Out of scope (explicitly deferred)

- **Class Version manifest binding `compositionSchemeVersionId`** — that's the
  separate **Class Version** slice (the binding spine that selects one ASV + one
  composition-scheme + trait-versions for a coherent class snapshot, deep-dive
  §3.5). Committing a CSV here is independent; nothing yet *binds* a chosen
  composition-version into a class snapshot. Per the canonical slice order, Class
  Version comes **after** composition/relations/taxonomies. (Versioning **axis
  #4 = Class Version** is therefore out of scope.)
- **Class Object Structure Version (versioning axis #5)** — the object-structure
  axis (deep-dive §4) is **also out of scope**; this slice touches only axis #3
  (composition). Named here so the boundary is exhaustive against the five
  versioning axes.
- **Forward-Reference Composition Directives** (deep dive §11) — directives
  pointing at not-yet-created sub-classes/traits, with `subEntityClassExists` /
  `traitOfEntityClassExists` flags propagated via the **unbuilt implicit event
  system** (`entityClassCreated`). The substrate here must merely **not
  preclude** it (it doesn't — we don't validate existence, §7); the
  existence-tracking + event propagation is its own slice. (The editor SELECT
  not offering pending classes is the only UI consequence — §6 point 1.)
- **Trait-Specific Class Composition** (deep dive §11) — the advanced form where
  composition behavior varies by which **host**-class trait is adopted (distinct
  from the sub-class `traitId` qualifier we *do* build). Specifics unclear;
  future.
- **The trait *qualifier* select** itself may land as a **C3 follow-up** after
  the flat sub-class select proves the data-driven-options path (§6) — it needs
  two new engine mechanisms (reactive dependent options + cross-field conditional
  display, §6 point 2), so it is in-scope-eventually but **not** on the critical
  path.
- **Universal / cross-class traits** referenced by directives — that's the
  Universal Traits future (the qualifier here is a class-scoped trait of the
  sub-class).
- **Condensation / Decomposition (deep dive §12)** — *anticipated, not built.*
  These ops must later reconsider composition directives in **other** classes
  that compose the class being condensed/decomposed (deep-dive §12), and want
  atomic API ops + recursive versioning to avoid a half-migrated graph. Gated on
  Class Versions + the AI gate-keeper — out of scope; the substrate must merely
  not *preclude* it.
- **Relations + Taxonomies** — the next schema slices after composition, in the
  canonical order. They will reuse this slice's **data-driven entity-class
  picker** (built once here, harvested there).

## 9. Phases

- **C1 — Apollo composition backend.** The §4 contract + §3 store nesting
  (`composition-scheme-versions/{n}.json`, directives as an ordered ARRAY,
  **ISO-8601 timestamps**); extend the class walk with `compositionSchemeVersions`.
  Copy-with-substitution from the ASV vertical (`World.js` lifecycle block +
  `FileStore` path helpers + `entityClasses` route block); build the **new**
  directive content (field-set + body schemas with `additionalProperties:false`
  and **no client `id`** + server-derived deterministic id + frozen
  `subClassId`/`traitId` on PATCH + the anchored `DIRECTIVE_ID` route pattern).
  Add `#requireCsv` / `#requireDraftCsv`; reuse `#requireClass` (no owner/trait
  branch). **No seed step** — a new class starts with **zero** CSVs (§7 locked
  decision 2); no v1-special rule. *Verify:* a curl harness (the exact payloads, with the
  `%3A`-encoded directive id) + an adversarial review, as with the ASV + trait
  verticals. *Acceptance:* full CSV → directive → commit → immutable loop works on
  node-Apollo:
  - create draft CSV (→ `201`, full CSV object with `createdAt` an ISO string,
    `compositionDirectives: []`);
  - create a directive with a deterministic id (→ `201`, full directive object);
  - **create a trait-qualified directive** (`id = subClassId:traitId`) and
    **update/delete it via the `:`-bearing (`%3A`-encoded) path param**;
  - dup-id → `409`; client-supplied `id` in body / unknown field → `400`;
  - **update/delete a missing `directiveId` → `404`**;
  - update a directive on a **committed** CSV → `409`;
  - commit empty → `400` (per §7 fork); commit → immutable; mutate committed → `409`;
  - delete committed CSV → `409`; delete draft → ok (→ `200`, `{ id }`);
  - the class walk returns nested `compositionSchemeVersions` each with
    `compositionDirectives`.
  **As landed (apollo `main` `1b364ed`, 2026-06-02):** all of the above, exactly
  as specified — `CompositionSchemeVersion` entity (mirrors `AttributeSetVersion`)
  + class-only `World` CSV/directive methods (`#requireCsv`/`#requireDraftCsv`,
  `deriveDirectiveId`) + class-only `FileStore` CSV methods +
  `EntityClass.toWalk` 3rd sibling + 7 routes on the existing plugin (no
  `server.js` change). **No seed step**; `isSupplementClass` absent. Verified by
  the 40-assert curl harness (`/tmp/c1_harness.sh`, isolated world — live seed
  untouched) + a 6-finder adversarial review (3 candidates, **0 confirmed** —
  refuted as intended/unreachable, matching the ASV/trait trust-boundary design).
- **C2 — Athene plumbing.** The World-tree `compositionSchemeVersions/` subtree
  (4 new classes — `CompositionSchemeVersions`, `CompositionSchemeVersion`, and
  the **new** `CompositionDirectives` + `CompositionDirective` pair) + `Apollo.js`
  CSV + directive methods + `_csvPath`/`_csvDirectivePath` + `loadDetail`
  populating `compositionSchemeVersions`. *Acceptance:* the World tree
  materializes a class's CSVs + their directives from the walk, and
  camelCase passthrough is clean (verified by a read harness against live
  node-Apollo + a write-vertical harness: create CSV → create directive → commit
  → immutable-reject → delete draft, seed clean), mirroring the Traits-T2
  harness pair.
  **As landed (athene `epsilon` `0ae8f4a`, 2026-06-02):** the 4-class subtree as
  specified — `CompositionSchemeVersions`/`CompositionSchemeVersion` mirror the
  ASV subtree (class-only, same depth); `CompositionDirectives` is **distinct**
  from `Attributes` (create sends **no id**, re-acquires by the server-derived id);
  `CompositionDirective` is an `Object.assign` value object. `EntityClass`
  populates the 3rd walk sibling; `Apollo.js` gained `_csvPath` + 6 methods
  (`encodeURIComponent` → `%3A` round-trips the directive id). Verified by a
  **single 20-assert harness** (`/tmp/c2_harness.mjs`, isolated live Apollo)
  covering both halves — read materialization (CSVs + nested directives; new
  class = zero CSVs) + the full write vertical (incl. trait-qualified
  `id=theme:sellable`, frozen identity, committed-immutability, re-materialize,
  `max+1`/`getLatest`). (Naming note: the helper is `_csvPath`; the plan's earlier
  `_csvDirectivePath` was folded into inline directive paths.)
- **C3 — Athene UI + cutover.** `Chronos/CompositionSchemeVersion` (= **Chronos
  E4**) + `Hermes/CompositionDirective` (with the **new SYNCHRONOUS data-driven
  sub-class SELECT**; three inputs — subClassId / cardinalityRules / description)
  + the §6 one-level Composition tab (incl. the **empty-state** for a class with
  zero CSVs — §7 decision 2) + the `selectedCompositionSchemeVersionId` workbench
  signal + Athene accessor pair + the synchronous data-driven options resolver in
  the Hermes engine + β2 descriptions. *Acceptance:* in-app, the Composition tab
  lets the user — starting from the empty-state — create the first draft CSV, add
  a composition directive (selecting a sub-class from the live class list, with
  cardinality + description), edit/delete it, commit the CSV (empty commit
  rejected), and see committed CSVs go read-only — end to end on node-Apollo.
  (The trait qualifier lands as a follow-up increment — §6/§8.)
  **As landed (athene `epsilon` `89826c4`, 2026-06-02):** all of the above,
  confirmed in-app by Daniel. `Chronos/CompositionSchemeVersion` (= **E4**, a
  direct ASV-instance mirror) + `Hermes/CompositionDirective` (data-driven
  sub-class select; no `id` field; subClassId create-only/frozen) + the one-level
  Composition tab + the workbench signal + Athene accessor pair + β2 descriptions.
  The one Hermes-engine change: `resolveFieldOptions` (sync) in
  `getVisibleInputElements` + the `created?.id` create fallback — both
  backward-compatible (Attributes/Traits tabs regression-clean). The first
  in-app run hit a STALE backend (the pre-C1 `node src/server.js` was squatting
  `:8001`); restarting Apollo on the current code fixed it — a reminder that
  plain-`node` Apollo needs a restart per backend change (`npm run dev` = `--watch`
  avoids it).

## 10. Bottom-up propagation

**✅ ALL FLIPPED 2026-06-02 (C1/C2/C3 all landed). The markers now live in each parent:**

- **Apollo beta — § "Canonical slice order".** Composition is **slice 1** (the
  next, heaviest remaining slice). Flip its row to ✓ / done when **C1** lands —
  the CSV + directive routes extend the same clean contract, copy-substituted
  from the ASV vertical (class-only owner). It is the second class-only versioned
  type beyond the ASV slice.
- **World-OOP-tree beta — I4+.** The `compositionSchemeVersions/` subtree is the
  **next I4+ subtree to materialize** after Traits' `traits/` (the first). Flip
  the I4+ composition entry when **C2** lands.
- **Chronos beta — E4.** The `CompositionSchemeVersion` instance **is E4** — the
  3rd live Chronos instance (after ASV + TASV/E5). Flip E4 to executed when
  **C3** lands. (E5 already proved instance-agnosticism, so E4 is a
  straightforward 3rd instance, not the pattern-prover.)
- **Hermes beta.** Flip the **data-driven (synchronous) options-resolver**
  capability to delivered when **C3** lands — it is the one structural Hermes
  engine change this slice contributes, reusable by Relations/Taxonomies.
- **EntityClass-management beta — D10+.** The **Composition sub-manager** is
  *delivered* (mounts its Hermes/Chronos instances into the workbench's
  Composition tab) when **C3** lands. Flip the "Composition next" marker to ✓.
- **Alpha — Phase 3 P0.** The **"Composition Scheme Version editor"** + the
  **"Composition Directive editor"** P0 surfaces are *delivered* with **C3**.
  Flip both alpha P0 markers.

## 11. Cross-links

- Conceptual model: `../notes/conceptual-deep-dive.md` — concept rows 5–6,
  §3.2 (composition is separate/versioned), §3.5 (Class Version is the binding
  spine), axis #3, §8 (storage), §10–§12 (open questions: `is_suplement_class`,
  forward-reference directives, condensation/decomposition).
- Pattern reused: `beta_implementation_plan_apollo.md` (the class→ASV→attribute
  slice + its clean contract; § "Canonical slice order" — composition = slice 1).
- Engines: `beta_implementation_plan_hermes.md` (the synchronous data-driven
  options resolver is the one new structural capability),
  `beta_implementation_plan_chronos.md` (**E4**).
- World tree: `beta_implementation_plan_world_oop_tree.md` (**I4+**
  `compositionSchemeVersions/` subtree).
- Workbench host: `beta_implementation_plan_entity_class_management.md` (D10+ —
  the Composition sub-manager mounts here).
- Sibling precedent: `archive/beta_implementation_plan_traits.md` (the feature
  beta this one mirrors; Traits was ~90% reuse, Composition is less — §2).
- Vocabulary: `../VOCABULARY.md` (Composition Scheme Version + Composition
  Directive rows added at C1 — currently the next reserved 🔭 concepts).
