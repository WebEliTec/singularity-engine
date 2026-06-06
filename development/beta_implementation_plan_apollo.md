---
title:      Beta — Apollo as a Node Service (Slice 1: World + Entity Classes + Attribute Set Versions)
status:     done — slice 1 complete (A1–A5); node-Apollo is the live backend, CCC retired for this surface
date:       2026-05-29
scope:      Reimplement Apollo (the world-model backend — today the Laravel content-creation-center) as a clean Node + Fastify service over a file-based content-base. Slice 1 = the schema layer Athene already drives (World → Entity Classes → Attribute Set Versions → Attributes). Apollo and Athene then co-grow one resource-area at a time toward the full stack. Defines the frozen HTTP contract Athene's Apollo.js conforms to exactly once.
parent:     alpha_implementation_plan.md
depends_on: beta_implementation_plan_world_oop_tree.md, beta_implementation_plan_hermes.md, beta_implementation_plan_chronos.md
phases:
  A1: done ✓ — Apollo skeleton: Fastify service + file-based content-base + server-side domain + clean envelope/error model + READ endpoints (list + full-class walk). Built + verified 2026-05-29 (Store seam → World/EntityClass/ASV domain → /entity-classes list + /entity-classes/{id} walk + 404; camelCase contract, seed world on disk).
  A2: done ✓ — Entity Class CRUD: POST/PATCH/DELETE /entity-classes; id = frozen slug-of-singular (409 on clash, immutable); camelCase body schemas reject unknown fields (400) + minProperties guard. Built + verified 2026-05-29.
  A3: done ✓ — ASV lifecycle: POST create empty draft (id = max+1 per class) · POST .../{asvId}/commit (draft→committed; empty→400, already-committed→409) · DELETE draft (committed→409, immutable) · GET list. Param schemas (classId slug + asvId digits → path-safe + 400). Built + verified 2026-05-29; 19-agent adversarial review found 0 real issues.
  A4: done ✓ — Attribute CRUD within an ASV (embedded, draft-only): POST/PATCH/DELETE attributes; id = client-supplied kebab key (immutable, unique-per-ASV → 409); dataType = 13-type enum (dynamicList/optionList deferred); committed-ASV writes → 409. Built + verified 2026-05-29; 21-agent adversarial review → 2 issues fixed (malformed-JSON → 400 not 500; seed dataType textarea → richtext).
  A5: done ✓ — Athene cut over to the clean contract: Apollo.js rewritten (:8001, plural REST, commit=POST, single-encoded camelCase, envelope error.message); World-tree parse consumes arrays + flat camelCase (+ String(asv id)); Hermes ids→kebab (Validator kebabCase), attribute_data_type→dataType (13-type enum, 2 gated), PATCH filtered to visible fields, ViewBody drops class lifecycle/updatedAt; apolloBaseUrl :8000→:8001. Entity-class id refined to client-supplied-or-derived (apollo createEntityClass takes optional id). Verified: conformance harness (exact UI payloads + parse shapes) + 5-dimension adversarial review (0 findings) + CCC-ism grep. CCC retired for the slice-1 surface. 2026-05-29.
---

# Beta — Apollo as a Node Service

*Drafted 2026-05-29. Replaces the alpha premise that the Laravel
content-creation-center (CCC) is "used as-is" and that the node port is
post-MVP — both retired (see alpha amendment).*

## Why now (it's on the launch critical path)

The first content-pocket and the Data-Pocket export the Next.js site
consumes were always going to be node. So Apollo isn't a detour from the
launch — it's the launch's backend: **ingest → Apollo stores → Data-Pocket
export → Next.js builds.** Building it now means building that backend in
its intended tech and *not* pouring more work into the CCC that was always
going to be thrown away (every CCC patch is disposable).

Second reason, equally load-bearing: **building Apollo is the best
pressure-test of the conceptual model.** The read-only client (Athene) can
quietly paper over conceptual gaps; the authoritative write/persistence
side cannot. Slice by slice, Apollo forces the canonical decisions — how a
version is stored, what *commit* and *fork* mean against the model, the one
true shape of an entity class. The hard part is the concepts, not the code;
this beta is where we get the concepts right (see § Conceptual decisions).

## Approach — Apollo grows, Athene grows

One resource-area at a time, both sides co-evolving. **Slice 1 (this beta)
is exactly Athene's current surface** (E1–E3: the EntityClass registry +
the ASV/Attributes workbench), so cutover is immediately verifiable — the
existing UI keeps working, just against the new backend.

*Amended 2026-06-02 (strategic — slice ORDER canonicalized with Daniel): the
"full eventual stack" below was an unordered grab-bag that implied **Class
Versions next**. It is now an **explicit, rationaled build order** (§ Canonical
slice order). The driving principle: **finish a class's full *definitional*
surface before instantiating anything against it** — so the schema concepts
(composition → relations → taxonomies) come first, the binding/release layers
(Class Versions, then Objects, then Data-Pocket) come last. This is the project's
canonical roadmap order; alpha + `plans_index.md` point here.*

- **Slice 1 (done):** World, Entity Classes, Attribute Set Versions (+ the
  Attributes inside an ASV). No Class Objects / "world entities" yet — no
  upfront entity-creation machinery.
- **Per slice:** extend Apollo's contract + domain + store → conform
  Athene's `Apollo.js` + World-tree parse → cut over → retire that CCC area.
  Each slice is a **full vertical** (backend + World-tree subtree + Hermes/Chronos
  instances), exactly as the Traits feature beta was.

### Canonical slice order (agreed 2026-06-02)

**The principle:** a Class is *defined* by what it has and how it relates —
attributes, traits, composition, relations, taxonomies. Only once that
**definitional surface is whole** does instantiating *objects* against it make
sense, and only then is a **Class Version** (the binding manifest) meaningful —
deep-dive §2 #8: a Class Version selects coherent versions of attribute-set +
trait-versions + composition-scheme, so it **cannot precede** a complete schema
surface. Hence:

| # | Slice | Versioned? | Notes |
|---|---|---|---|
| ✓ | **Attributes** | yes (ASV) | slice 1 — done |
| ✓ | **Traits** | yes (TASV) | Traits beta — done (apollo `1df0e3e`; routes generalized the ASV/attribute domain over an owner `{classId}`\|`{classId,traitId}`, a TASV ≡ an ASV one level down; the class walk grew a nested `traits` array) |
| ✓ | **Composition** | yes (CompositionSchemeVersion) | **DONE** (2026-06-02) — Composition Scheme Versions + Composition Directives, end-to-end: **C1** apollo `1b364ed` (backend; 40-assert harness + adversarial review, 0 findings) · **C2** athene `0ae8f4a` (World-tree subtree; 20-assert harness) · **C3** athene `89826c4` (the Composition tab — Chronos E4 + Hermes/CompositionDirective + the data-driven options resolver; confirmed in-app). Delivered Chronos E4 + the reusable Hermes data-driven-select capability. |
| **2** | **Relations** | likely **no** | `EntityClassRelations` — a **World-level** concept (between classes, not nested in one). Lighter: Apollo slice + top-level World collection + `Hermes/Relation`, **no Chronos axis** (not in the versioned-artifact list, deep-dive §3.1). **DECIDE at design:** does the no-self-reference rule transfer (composition forbids `subClassId===hostClassId`)? A reflexive relation `sourceClassId===targetClassId` is the analog, but a **same-class, different-trait** self-relation (e.g. Person[parent]→Person[child]) may be **legitimate** — so it does NOT auto-transfer. Pick the same status code as composition (**400**). Reuses the C3.1 dependent-trait picker on both partners. |
| **3** | **Taxonomies** | likely **no** | Same shape as Relations — a World-level collection + `Hermes/Taxonomy`. |
| **4** | **Class Versions** | — (the binding layer) | The **gate into objects**: the manifest that binds coherent child-version-ids into "the class at version N." Only buildable once 1–3 land. |
| **5** | **Objects** | yes (ObjectStructureVersion) | `Class Objects` + Object Structure Versions + **locale variants** + **source attribution**. Instances of a committed Class Version. The big instantiation phase. |
| **6** | **Data-Pocket export** | — | Projects committed objects — the lossy compiled projection the Next.js site consumes. The launch payload; fires at the Class-Version release boundary. Naturally last. |

Nothing is permanently cut; this is purely *order*. Each row spawns its own
feature beta (or Apollo+Athene slice pair) when it becomes the active work block.

## Stack & storage

- **Node + Fastify, plain JS.** Fastify for first-class JSON-Schema
  validation (a natural fit for a schema-validated domain engine) and a
  thin, unopinionated shell — our own domain model stays the center.
- **Directory `singularity-engine/apollo/`**, run alongside Athene; the
  Electron app's `Apollo.js` re-points at it.
- **File-based content-base (directory-as-DB), cleanly reimplemented** —
  containment = folders mirrors the conceptual model; versionable,
  inspectable, git-friendly; serves the deterministic-versioned-core. The
  on-disk layout is Apollo's private concern; the HTTP contract is the
  public surface.
- **Server-side domain model** mirroring the conceptual tree (World →
  EntityClasses → EntityClass → AttributeSetVersions → ASV → Attributes),
  write-side, over the store — conceptually parallel to Athene's client
  World tree (same names/shape), not shared code.

  *Amended 2026-06-02 (domain shape — settled after an investigation into "World
  is too fat"): the **version entities own their invariants**. `AttributeSetVersion`
  / `CompositionSchemeVersion` carry their lifecycle as **pure, record-returning
  transitions** — `commit(nowIso)` (already-committed → 409, empty → 400),
  `assertDraft()` (immutability), and `add/update/remove{Attribute,Directive}`
  (draft-guard, dup → 409, 404, frozen id). **World is the orchestration layer**:
  `#require*` existence checks, the full-class walk, `max+1` id-minting,
  create-version factories, and entity-class/trait IDENTITY CRUD (store-coupled).
  **No leaf holds a store handle — the Store seam stays at World** (rejected:
  store-on-entity / repository-per-aggregate, which dissolves the seam). World
  loads → calls the transition → persists. This is the **canonical shape for
  every slice**. Landed apollo `main` `cb8010e` (behaviour-preserving, 57-assert
  regression).*

  *Amended 2026-06-03 (rule governance — the implicit invariants made explicit):
  the semantic invariants the entities + World enforce are now EXTRACTED into a
  three-tier rule model. The canonical model lives in the top-level `../model/`
  (Tier 1 formal predicate-logic + Tier 2 prose); enforcement is a set of named
  predicates + a declarative `RULE_REGISTRY` in `apollo/src/domain/rules/` (Tier
  3), called at every enforcement point so each rule has ONE definition (the
  self-composition comparison that once diverged now lives in one place, shared
  by the add- and commit-gates). A binding test (`npm test`) keeps the three
  tiers in bijection by id. Behaviour-preserving (status codes/conditions
  unchanged; some error-message wordings normalised); verified by an adversarial
  diff/live/duplication pass. See `../model/README.md`. Landed apollo `main`
  (R0–R4).*

## The contract — slice 1 (the keystone)

The shape Athene's `Apollo.js` conforms to **once** and never re-touches
for the backend again. Proposed below; pressure-tested and locked in A1.

**Conventions (cleaning the CCC quirks):**
- Vocabulary `entity-class` (not `content_class`); **plural REST
  collections**; standard verbs, **no verbs-in-path** (today's
  `/create`, `/delete/{id}`, `/update_meta/{id}` go away).
- **camelCase JSON**, **single-encoded** (no double-JSON-in-a-string),
  `committedAt` spelled correctly.
- **Standard HTTP status** — `400` validation, `404` not-found, `409`
  conflict (e.g. already-committed) — not the CCC habit of `500`-on-
  validation.
- Envelope: success `{ success: true, data, message }`; failure
  `{ success: false, error: { code, message } }`.

**Endpoints (12 ops):**

| Method | Path | Purpose |
|---|---|---|
| GET | `/entity-classes` | list all entity classes (registry — array of class meta) |
| POST | `/entity-classes` | create an entity class |
| GET | `/entity-classes/{id}` | one entity class, **full walk** (meta + nested ASVs + attributes) |
| PATCH | `/entity-classes/{id}` | update class meta |
| DELETE | `/entity-classes/{id}` | delete an entity class |
| POST | `/entity-classes/{id}/attribute-set-versions` | create a new **draft** ASV (empty) |
| POST | `/entity-classes/{id}/attribute-set-versions/{asvId}/commit` | commit a draft → committed (rejects empty / already-committed) |
| DELETE | `/entity-classes/{id}/attribute-set-versions/{asvId}` | delete a **draft** ASV (committed are immutable) |
| POST | `/entity-classes/{id}/attribute-set-versions/{asvId}/attributes` | create an attribute |
| PATCH | `/entity-classes/{id}/attribute-set-versions/{asvId}/attributes/{attrId}` | update an attribute |
| DELETE | `/entity-classes/{id}/attribute-set-versions/{asvId}/attributes/{attrId}` | delete an attribute |
| GET | `/entity-classes/{id}/attribute-set-versions` | list an ASV's versions without the full walk |

**Resource shapes (proposed):**
```
EntityClass (meta)   { id, singular, plural, description, profileImgUrl }   (identity only — no mutable state, per VOCABULARY)
EntityClass (walk)   { ...meta, attributeSetVersions: [ AttributeSetVersion, ... ] }
AttributeSetVersion  { id, lifeCycleStage: 'draft'|'committed', createdAt, committedAt?,
                       attributes: [ Attribute, ... ] }
Attribute            { id, label, dataType, description, isRequired }   (id = client-supplied kebab key; embedded in its ASV; dataType ∈ 13-type enum)
```
> Note the walk uses **arrays** of versions/attributes (ordered, id-bearing),
> not the CCC habit of id-keyed objects that empty-serialize to `[]` — the
> client always gets one stable shape.

## Phases

- **A1 — Skeleton + read path.** Fastify app; file-based content-base
  read/write foundation; the server-side domain; envelope + error model;
  `GET /entity-classes` and `GET /entity-classes/{id}` (walk). Migrate or
  re-point the existing content-base data. *Acceptance:* Athene lists
  classes and loads a class detail against node-Apollo (read).
- **A2 — Entity Class CRUD.** POST/PATCH/DELETE `/entity-classes`.
  *Acceptance:* Hermes/EntityClass create/edit/delete works against node-Apollo.
- **A3 — ASV lifecycle.** create-draft / commit / delete-draft, with the
  empty-commit guard + draft/committed rules reimplemented cleanly (the
  spec captured in the CCC patch carries here). *Acceptance:* Chronos E3 —
  create, commit, delete-draft, empty-commit rejection — works against node-Apollo.
- **A4 — Attribute CRUD.** POST/PATCH/DELETE attributes within an ASV.
  *Acceptance:* Hermes/Attribute CRUD works against node-Apollo.
- **A5 — Cutover + retire CCC (slice-1).** Point `Apollo.js` fully at
  node-Apollo (clean contract); align the World-tree raw-parse to the clean
  shapes; CCC stops serving classes/ASVs/attributes. *Acceptance:* the whole
  E1–E3 flow runs end-to-end on node-Apollo; the CCC dependency is gone for
  this surface.

*(Cutover may also happen per-area as A1–A4 land; A5 is the final sweep +
CCC retirement. Strategy TBD in A1: wholesale base-URL flip after A1–A4 vs.
per-method routing during.)*

## Conceptual decisions to lock as we build

These are the model questions Apollo forces — reason through each, amend
this plan in place (bottom-up propagation), and let real findings reshape
the contract above:

1. **Commit as an action sub-resource (`/commit`) vs. a PATCH** of the ASV's
   lifecycleStage. — **✅ locked A3: explicit `POST …/{asvId}/commit` action.**
   Commit enforces rules (empty→400, already-committed→409), so it's a guarded
   transition, not a free field write — and keeping `lifeCycleStage` out of any
   PATCH body is what protects committed-immutability.
2. **Walk shape** — one canonical `GET /{id}` returning the full nested tree,
   vs. separate meta + walk endpoints. — **✅ locked A1: one full walk** (list
   stays meta-only).
3. **camelCase contract vs. snake_case** stored shape. — **✅ locked A1/A2:
   camelCase on disk AND wire** (store shape == contract, so the map is
   near-identity; it earns its keep when a non-file substrate arrives).
4. **On-disk layout** of the file-based content-base. — **✅ locked A1:** see
   VOCABULARY § node-anatomy + slice-1 shape (kebab folders, `identity.json`,
   `attribute-set-versions/{n}.json`).
5. **How "the World" is represented** at the root. — **✅ locked A1: `world.json`**
   own-record (`{ schemaVersion }`, rest reserved); the singleton-root exception.
6. **Data migration** of the existing CCC content-base vs. regenerate via the
   ingestion script. — **open;** A1/A2 run on a small hand-seeded world.

## Athene cutover

`Apollo.js` becomes a thin, complete anti-corruption boundary against the
clean contract: once it conforms, everything above it (World tree, Hermes,
Chronos, managers, UI) is **frozen** against backend change. The E3 rules I
landed on CCC (commit return-fix, empty-commit guard) reimplement here as
their proper home.

**A5 cutover checklist** — concrete Athene-side mismatches catalogued by the
A3 adversarial review (Apollo's contract is already correct per VOCABULARY;
these are the *Athene* changes A5 must make when `apolloBaseUrl` flips from the
Laravel CCC `:8000` to node-Apollo `:8001`):

- **Collection shape:** Athene parses **id-keyed objects** (`Object.entries`);
  Apollo returns **ordered arrays** (class list, `attributeSetVersions`,
  `attributes`). Rewrite the World-tree raw-parse to consume arrays.
- **Field casing + nesting:** Athene reads `core`-nested **snake_case**
  (`life_cycle_stage`, `created_at`, `updated_at`, `class_profile_img_url`) incl.
  the legacy **`commited_at`** typo; Apollo emits flat **camelCase**
  (`lifeCycleStage`, `createdAt`, `committedAt`, `profileImgUrl`).
- **ASV id type:** Apollo mints a **number**; Athene currently keys its Map by
  the string form. Normalize on one (string-coerce at the parse boundary).
- **Failure envelope:** Athene reads `primary_error.message ?? message`; Apollo
  nests it at **`error.message`** with a stable `error.code`.
- **No `core` wrapper / no verbs-in-path:** Apollo is flat REST
  (`POST …/{asvId}/commit`, `DELETE …/{asvId}`), single-encoded JSON — drop the
  CCC `create_*`/`/commit_*`/double-JSON-string habits.
- **Attribute fields:** the UI form mints `attribute_name` (snake, pattern
  `smallLettersAndUnderscores`) + keys `attribute_data_type` + offers a 15-type
  catalog; Apollo expects body `id` (**kebab**, matching the route segment),
  `dataType`, and a **13-type enum**. At A5: switch the machine-name input
  patterns (entity-class **and** attribute) snake → **kebab**, rename
  `attribute_data_type` → `dataType`, and gate the 2 deferred types
  (`dynamicList`/`optionList`).

These live only in `app/apollo/Apollo.js` + `app/world/**` (the parse layer);
nothing above the World tree changes — that's the whole point of conforming
`Apollo.js` once.

**Transport — CORS (Apollo-side, landed `3153c84`):** the renderer fetches
Apollo cross-origin (Vite `:5173`), so Apollo must send
`Access-Control-Allow-Origin` + answer OPTIONS preflight. The CCC had
`config/cors.php`; bare Fastify did not — which blocked the cutover (no
classes/CRUD) until a permissive CORS hook was added to `server.js`. **Lesson:
CORS is a first-class cutover step when repointing a browser/Electron client at
a new backend** — it's transport, invisible to a server-side contract harness,
so it needs an explicit check. (Also: node-Apollo must be *running* on `:8001` —
`npm run dev` in `apollo/` — it's now Athene's backend, replacing the CCC.)

## Pointers

- Parent: `alpha_implementation_plan.md` (§ Apollo backend, § Phase 1, and the 2026-05-29 amendment)
- Current backend being replaced: `content-creation-center/` (Laravel CCC)
- Domain shape Apollo mirrors: `beta_implementation_plan_world_oop_tree.md`
- Consumers of the contract: `beta_implementation_plan_hermes.md`, `beta_implementation_plan_chronos.md`
- Conceptual model (the spec): `../notes/conceptual-deep-dive.md`
