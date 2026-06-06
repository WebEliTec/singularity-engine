---
title:      Beta Implementation Plan — Traits (class-scoped mixin roles + their versioned attribute sets)
status:     archived — all phases executed (T1 + T2 + T3.1–T3.4). Frozen historical record per README § Lifecycle.
date:       2026-05-30
executed:   2026-06-02 — T1 apollo `1df0e3e` · T2 athene `86a46a0` · T3.1 `9748951` · T3.2 `d6b5fb6` · T3.3 `140fe0e` · review-fix batch athene `b1f1976` + apollo `59b32a0` · T3.4 doc propagation (markers flipped across alpha P0 / World-OOP-tree I4+ / Apollo slice-order / Chronos E5). Deferred frontend halves (FE-1, FE-2) live in `../deferred_frontend_security.md`; residual framework race = morpheus-core#29.
scope:      Add Traits to the engine end-to-end: a Trait is a reusable role a Class adopts to gain extra attributes (a mixin, not a subclass — the conceptual model's only polymorphism mechanism). Each Trait owns its own versioned attribute sets (Trait Attribute Set Versions) under the same draft → committed lifecycle as a Class's ASVs. This beta builds that full vertical — Apollo backend, Athene World tree, the Hermes + Chronos instances, and the (currently placeholder) workbench Traits tab.
parent:     ../alpha_implementation_plan.md
depends_on: ../beta_implementation_plan_apollo.md, ../beta_implementation_plan_world_oop_tree.md, ../beta_implementation_plan_hermes.md, ../beta_implementation_plan_chronos.md
phases:
  T1: done ✓ — Apollo traits backend: trait CRUD + TASV lifecycle + trait-attribute CRUD + `traits` in the class walk. ASV/attribute lifecycle GENERALIZED over an owner ({classId}|{classId,traitId}); a TASV ≡ an ASV one level down. Built + verified 2026-05-30 (class-ASV regression + full trait vertical curl harness; 6-agent adversarial review = 0 issues). Seed: `sellable` trait on plugin.
  T2: done ✓ — Athene plumbing: World-tree `traits/` subtree (5 new classes; leaf `Attribute` reused) + `Apollo.js` 11 trait methods + `EntityClass.loadDetail` populates `traits` from `walk.traits`. Parallel per-level classes (reserved `Version` base unifies ASV/TASV later). Verified vs live node-Apollo: 22-assert read harness + 10-assert write-vertical harness. Committed `epsilon` @ `86a46a0` (2026-06-01).
  T3: done ✓ — Athene UI, sub-phased T3.1–T3.4. **T3.1** (`9748951`): the generic `viewAction` drill-in capability + `Hermes/Trait` instance (trait CRUD) + Traits-tab mount (level 1). **T3.2** (`d6b5fb6`): Athene `get/setSelectedTraitId` + workbench `selectedTraitId` signal + Root's level-1/2 dispatch + "← Back to Traits"; `manageTraitVersions` drills in. **T3.3** (`140fe0e`, full loop + Attributes-tab regression): level 2 — `Chronos/TraitAttributeSetVersion` (TASV strip; **fulfils Chronos E5**; `tasvsOf()` re-acquire) + `Hermes/TraitAttribute` (via `_resolveSelectedTasv`) + `selectedTraitAttributeSetVersionId` coordination; also made Chronos instance-agnostic + the Hermes init hook per-instance (`registerKernel`). **T3.4** (2026-06-02): adversarial review (8 defects → fixed `b1f1976`/`59b32a0` or deferred FE-1/FE-2) + β2 descriptions + doc propagation across the four parents. Beta CLOSED.
---

# Beta Implementation Plan — Traits

*Drafted 2026-05-30. A **feature beta** — a sibling division of alpha that
**composes** the subsystem betas (Apollo, World-OOP-tree, Hermes, Chronos)
rather than owning one subsystem. Level is graph position, not kind-of-thing
(see README.md): a feature that cuts across subsystems is still one level below
alpha. Its phases land **in** those subsystems and fulfil work each already
anticipated as deferred — Apollo's "full eventual stack", Chronos's **E5
TraitAttributeSetVersion**, the World-OOP-tree beta's **I4+** subtree growth, a
new Hermes instance pair.*

## 1. What a Trait is (conceptual recap)

From `notes/conceptual-deep-dive.md` (§2 #4, §3.3, §4 #2):

- A **Trait** is a *reusable role a Class adopts to gain additional
  attributes* — a **mixin, not a subclass**. Inheritance is intentionally
  absent; traits + relations are the only polymorphism.
- A Trait is **class-scoped**: it lives inside its host Class; its id need only
  be unique within that Class. (Cross-class **Universal Traits** are explicitly
  a future feature — **out of scope here**.)
- A Trait **owns its own versioned attribute sets** — **Trait Attribute Set
  Versions (TASVs)** — under the **same draft → committed lifecycle** as a
  Class's ASVs (committed = immutable; only drafts deletable).

So a Trait is the **class → ASV → attribute** pattern you already shipped,
**nested one level deeper** under a Trait:

```
Entity Class → Attribute Set Version → Attribute               ← built (slice 1)
Entity Class → Trait → Trait Attribute Set Version → Attribute ← this beta
```

**A Trait is a multi-faceted *grant*, not just an attribute bag.** Adopting a
trait grants an entity several *capability types* at once: extra **attributes**
(this facet), **eligibility to enter certain relations**, and — later —
**eligibility to attach data sources**, with more to come. The attribute-set is
**one facet**; relation- and source-eligibility are **siblings**, not sub-parts
of the attributes. This slice builds the **attribute facet** only (the others
arrive with the Relations + Data-Sources slices); the name + substrate
anticipate the broader grant. *(Naming settled 2026-05-30: "trait" — a stable,
intrinsic characteristic that confers capabilities; not "role", which is
context-bound, anti-rigid — a company **is** a software company, it doesn't
**play the role of** one.)*

## 2. The keystone insight — ~90% is reuse

The TASV lifecycle, attribute CRUD, immutability, id-minting, the Chronos
version strip, the Hermes attribute editor, the config-driven ViewBody — **all
already exist and are verified**. A TASV **is** an Attribute Set Version; a
trait-attribute **is** an Attribute. What is genuinely *new* is small and
localized:

| New thing | Where | Note |
|---|---|---|
| The **Trait** entity | Apollo domain + Athene World tree | identity-only, owns TASVs (it's an "ASV owner" like a Class) |
| **One extra path level** | Apollo routes + store | `…/traits/{traitId}/attribute-set-versions/…` |
| **`traits` in the class walk** | Apollo walk + Athene parse | array of traits, each with its TASVs |
| The **two-level Traits tab** | Athene workbench | pick trait → pick TASV → edit attributes (vs the Attributes tab's one level) — **the only real design challenge** |

Implementation opportunity (T1): a Class and a Trait are both "owners of
Attribute Set Versions." Apollo's ASV + attribute logic can be **generalized
over the owner** (parameterized by the owner's store path) so the trait routes
reuse it rather than copy it. Decide in T1 whether to generalize now or copy
then refactor.

## 3. Data model + on-disk shape (Apollo, mirrors the ASV slice)

```
apollo/world/entity-classes/{classId}/
  identity.json
  attribute-set-versions/{n}.json          ← existing
  traits/
    {traitId}/
      identity.json                        { id, label, description }
      attribute-set-versions/{n}.json      ← a TASV — SAME shape as an ASV
                                             { id, lifeCycleStage, createdAt,
                                               committedAt, attributes: [ … ] }
```

- **Trait is identity-only** (`{ id, label, description }`) — lifecycle lives on
  its TASVs, exactly as an Entity Class is identity-only with lifecycle on its
  ASVs. (The legacy `meta.json` carried a trait-level `life_cycle_stage`; we
  drop it for the same reason we dropped it on classes — ❓ confirm, §7.)
- **Trait id** = client-supplied kebab machine key, immutable, unique within
  the class (409 on clash) — same convention as class + attribute ids.
- A **TASV is byte-for-byte an ASV** (reuse the AttributeSetVersion entity).
- A **trait-attribute is an Attribute** (reuse the shape + the 13-type
  `dataType` enum + the kebab id rule).

## 4. The Apollo contract (T1) — mirrors entity-classes, nested under traits

```
GET    /entity-classes/{id}/traits                                  list trait meta
POST   /entity-classes/{id}/traits                                  create trait { id, label, description? }
GET    /entity-classes/{id}/traits/{tid}                            one trait, full walk (+ its TASVs)
PATCH  /entity-classes/{id}/traits/{tid}                            update trait meta (never id)
DELETE /entity-classes/{id}/traits/{tid}                            delete trait (+ its TASVs)
POST   /entity-classes/{id}/traits/{tid}/attribute-set-versions               create draft TASV
POST   /entity-classes/{id}/traits/{tid}/attribute-set-versions/{tasvId}/commit   commit (empty→400, committed→409)
DELETE /entity-classes/{id}/traits/{tid}/attribute-set-versions/{tasvId}      delete draft (committed→409)
GET    /entity-classes/{id}/traits/{tid}/attribute-set-versions               list TASVs
POST   /entity-classes/{id}/traits/{tid}/attribute-set-versions/{tasvId}/attributes            create attribute
PATCH  /entity-classes/{id}/traits/{tid}/attribute-set-versions/{tasvId}/attributes/{attrId}   update attribute
DELETE /entity-classes/{id}/traits/{tid}/attribute-set-versions/{tasvId}/attributes/{attrId}   delete attribute
```

- Same clean conventions as slice 1 (plural REST, no verbs-in-path, commit =
  POST action, single-encoded camelCase, `{ success, data, … }` /
  `{ success, error:{ code, message } }`, real 4xx codes, CORS already on).
- **The class walk grows** `traits`:
  `GET /entity-classes/{id}` → `{ …meta, attributeSetVersions: [...], traits: [ { id, label, description, attributeSetVersions: [ { …, attributes:[...] } ] } ] }`.
- `attrId`/`traitId` validated as kebab route segments (path-safe, like `asvId`).

## 5. The Athene side (T2 + T3)

**T2 — plumbing (World tree + Apollo.js):**
- `app/world/entityClasses/traits/` → `Traits.js` (collection), `Trait.js`,
  then `traits/{trait}/traitAttributeSetVersions/` mirroring the ASV subtree
  (`TraitAttributeSetVersions.js`, `TraitAttributeSetVersion.js`, `attributes/`).
  Reuse the ASV/attribute classes where the shape is identical.
- `EntityClass.loadDetail()` populates `traits` from `walk.traits` (a new
  sibling of `attributeSetVersions`).
- `Apollo.js` gains the trait methods (all via the existing `_request` helper).

**T3 — engines + the Traits tab:**
- **`Hermes/Trait`** instance — CRUD over the class's traits (list, create,
  edit, delete). inputElements: `id` (create-only kebab), `label`,
  `description`. Reuses everything (incl. the config-driven ViewBody fix).
- **`Hermes/TraitAttribute`** instance — CRUD over the attributes inside the
  *selected trait's selected TASV*. Identical to `Hermes/Attribute` but scoped
  by `(classId, traitId, tasvId)`.
- **`Chronos/TraitAttributeSetVersion`** instance — the version strip for the
  selected trait's TASVs. This **fulfils Chronos E5**'s TraitAttributeSetVersion
  axis. Identical engine, scoped by `(classId, traitId)`.
- **`Hermes` `viewAction` capability** (NEW — generic, not trait-specific) —
  the instance-overridable `viewAction: { label, coreFunction }` option + the
  conditional drill button in `ViewHeader` (§6). The Trait instance opts in;
  EntityClass/Attribute default `null` (no button, unchanged).
- **Workbench coordination** — `selectedTraitId` +
  `selectedTraitAttributeSetVersionId` signals on `EntityClassWorkbench` + the
  Athene `get/setSelectedTraitId` + `get/setSelectedTraitAttributeSetVersionId`
  accessor pairs (mirror epsilon E2) + the "← Back to Traits" return door.
- **The Traits tab** — see §6 (the resolved two-level design).
- Agent-facing **descriptions** (β2) for the three new instances.

## 6. The Traits tab — the one genuinely new UX (open call)

The Attributes tab is **one level** of selection: a `selectedAttributeSetVersionId`
signal on the workbench drives a Chronos strip + a Hermes editor. The Traits tab
is **two levels**: pick a **trait**, then pick that trait's **TASV**, then edit
its attributes. So the workbench needs two coordination signals —
`selectedTraitId` and `selectedTraitAttributeSetVersionId` — and the
`Chronos/TraitAttributeSetVersion` + `Hermes/TraitAttribute` instances scope by
both (plus `currentClassId`).

**Resolved 2026-06-01 (with Daniel) — layout A: a trait picker that *drills
into* the reused Attributes-tab body.** The mechanism generalizes the old CMH's
hardcoded "Manage Trait Version" button
(`content-management-hub/blueprints/hermes/ResourceManagementInterface.jsx` — a
`<NavLink to={traitId}>` gated by `on-view-block`) into config-driven Hermes.

**The two levels + the doors between them.**

- **Level 1 — trait picker (`Hermes/Trait`).** Full CRUD over the class's
  traits. Selecting a trait → view mode → the trait's fields + a generic
  drill-in button (next).
- **Entry door — a NEW generic Hermes capability (`viewAction`).** An
  instance-overridable **option** `viewAction: { label, coreFunction }` (default
  `null` ⇒ no button). When set, `ViewHeader`'s action row renders a distinct
  "drill" button (with a `→`), shown only while viewing a selected resource. On
  click it calls `_.callCoreFunction( viewAction.coreFunction, selectedResourceId )`.
  The **Trait** instance sets
  `viewAction: { label: 'Manage Trait Versions', coreFunction: 'manageTraitVersions' }`,
  and its `manageTraitVersions( kernel, traitId )` does the level-1→2 promotion:
  `kernel.app.athene.setSelectedTraitId( traitId )`. This is the new-world
  equivalent of the old `<NavLink>` — selection is **signal-driven through
  Athene, not routed**. *Not trait-specific:* any resource with a deeper surface
  (a future "Manage Class Versions") opts in with one option + one coreFunction,
  no module change. (Resolved: a **single structured option**, not a flat
  show-flag + label pair — an enabled button always needs a label, so they
  co-vary; presence = display.)
- **Level 2 — the trait's version management.** When `selectedTraitId` is set,
  the workbench reveals *exactly the Attributes-tab composition* one level
  deeper: `Chronos/TraitAttributeSetVersion` strip + `Hermes/TraitAttribute`
  editor, scoped to the trait.
- **Return door — a WORKBENCH affordance.** A **"← Back to Traits"** control on
  the level-2 surface clears `selectedTraitId` → back to the picker.
  **Architectural boundary:** the *entry* is a generic **Hermes** affordance (a
  resource offers a drill-in); the *exit* is a **workbench** affordance (the
  workbench owns the two-level structure — Hermes knows nothing of "levels").
  Both manipulate the same Athene `selectedTraitId` state.

**Coordination (mirrors epsilon E2 exactly, one level deeper).**

- Workbench signals: `selectedTraitId` (null/'' ⇒ level 1) and
  `selectedTraitAttributeSetVersionId` (the level-2 TASV selection).
- Athene accessor pairs `get/setSelectedTraitId` +
  `get/setSelectedTraitAttributeSetVersionId`, mirroring
  `get/setSelectedAttributeSetVersionId`. The setters flip the canonical
  workbench signal + coordinate the Chronos mirror + the Hermes refresh
  (Pattern Y / `morpheus-core#26`).
- Level-2 scope reads via the Athene accessors **inside each instance's
  coreFunctions** (the same way `Hermes/Attribute` reads
  `getSelectedAttributeSetVersionId()` today): `Chronos/TraitAttributeSetVersion`
  uses `(currentClassId, selectedTraitId)`; `Hermes/TraitAttribute` uses
  `(currentClassId, selectedTraitId, selectedTraitAttributeSetVersionId)` —
  reaching the T2 World-tree methods (`…traits.getSingle(tid)
  .traitAttributeSetVersions…`). *(moduleProps is optional intra-node
  readability polish; the load-bearing cross-node scope flows through Athene
  state, as in E2.)*

(Rejected: **B master/detail** — heavier, a nested workbench; **C stacked
engines** — conflates "pick a trait" [CRUD over a set] with "pick a version"
[lifecycle over a timeline]. A keeps the two operations distinct and reuses the
Attributes-tab body wholesale.)

## 7. Decisions to lock (recommended defaults)

1. **Trait = identity-only** `{ id, label, description }`; lifecycle on its TASVs
   — consistent with the clean Class model. ❓ confirm dropping the legacy
   trait-level `life_cycle_stage`.
2. **Trait id** = client-supplied kebab, immutable, unique within the class.
3. **`label` + `description`** for trait identity (a role is named) — **no
   singular/plural** (recommended; traits aren't pluralized things). ❓ confirm
   vs mirroring the class's singular/plural for uniformity.
4. **TASV ≡ ASV** and **trait-attribute ≡ attribute** — reuse the shapes,
   the 13-type `dataType` enum, the kebab attribute-id rule.
5. **Apollo domain**: generalize ASV/attribute over the owner (Class | Trait)
   vs copy-then-refactor — decide in T1.
6. **Traits tab layout** — §6; **resolved A** (2026-06-01). Trait picker →
   generic **`viewAction`** drill-in button in `ViewHeader` → reused
   Attributes-tab body. The option is a **single structured `{ label,
   coreFunction }`** (default `null`); **both doors** designed (entry = the
   Hermes `viewAction`; exit = a workbench "← Back to Traits"). `viewAction` is
   a general Hermes capability, not trait-specific.

## 8. Out of scope (explicitly deferred)

- **Universal / cross-class traits** (a top-level trait registry) — future;
  today traits are class-scoped.
- **Class Version manifest** binding `traitVersionIds` — that's the separate
  Class Version slice. Committing a TASV here is independent; nothing yet
  *binds* a chosen trait-version into a class snapshot.
- **Composition / relations / taxonomies** that *reference* traits (trait-list
  qualifiers) — their own later slices.
- **Trait-Specific Class Composition**, **Attribute Groups** — future (deep
  dive §11).
- **A node `feature` resourceType in morpheus** — *considered + parked 2026-06-01.*
  The `viewAction` drill-in button (§6) ships as a composed **`option` +
  `coreFunction`**. Promoting that pattern to a first-class node resource type
  (a `feature` = a named, optionally-displayed, behavior-bound capability) was
  weighed and **deferred**: (a) only one feature exists today — n=1 is premature
  abstraction; (b) the `{ label, coreFunction }` shape **promotes cleanly later
  with no rework**, so waiting is free; (c) the reason it might genuinely *earn*
  existence is **not UI ergonomics but the AI layer** — a `feature` that is
  simultaneously a UI affordance AND an agent-enumerable capability (a node-level
  sibling to the app-level `agentApi`). So its right time is when the pattern
  **repeats** and/or it is designed **jointly with the parallel AI-layer agent**
  in morpheus-core (aligned with `agentApi` / `getAgentManifest`), not bolted on
  now for a single button.
- **Condensation / Decomposition (deep dive §12)** — *anticipated, not built.*
  A trait's attributes can later **merge into** a class (condensation: bake N
  adopted traits into a new class — "speciation by convergence") or **extract
  out** (decomposition). Our **TASV ≡ ASV** decision (§3) is exactly what keeps
  this open: same attribute shape on both sides, so a trait's attribute-set
  composes into / out of a class's without translation. Gated on Universal
  Traits + Class Versions (both above) and the AI gate-keeper, so out of scope
  here — the substrate must merely not *preclude* it (it doesn't).

## 9. Phases

- **T1 — Apollo traits backend.** The §4 contract + §3 store nesting; extend the
  class walk with `traits`. Reuse/generalize the ASV + attribute domain over the
  owner. Seed one trait on a seed class. *Verify:* curl harness (the exact
  payloads) + an adversarial review, as with A1–A5. *Acceptance:* full trait →
  TASV → attribute → commit → immutable loop works on node-Apollo; the class
  walk returns nested traits.
- **T2 — Athene plumbing.** The World-tree `traits/` subtree + `Apollo.js` trait
  methods + `loadDetail` populating `traits`. *Acceptance:* the World tree
  materializes a class's traits + their TASVs + attributes from the walk
  (verified by a read against node-Apollo).
  **As landed (`86a46a0`, 2026-06-01):** 5 new classes under
  `app/world/entityClasses/traits/` (`Traits`, `Trait`,
  `traitAttributeSetVersions/{TraitAttributeSetVersions,TraitAttributeSetVersion}`,
  `…/attributes/TraitAttributes`) — **parallel** per-level classes mirroring the
  ASV subtree, **reusing the leaf `Attribute`** (a trait-attribute IS an
  Attribute; §5's "reuse where identical"). Write paths differ only in being
  trait-scoped (deeper parent chain + trait-scoped Apollo calls). `Apollo.js`
  gained 11 trait methods + `_traitPath`/`_traitAsvPath`. The reserved `Version`
  base (AttributeSetVersion.js header) is the deferred unification — T2 is the
  second versioned type landing it anticipated. Verified by two Node harnesses
  driving the real classes vs live node-Apollo: **22-assert read** (full
  materialization + camelCase passthrough + trait-less class → empty) +
  **10-assert write vertical** (create → TASV → attr → commit → immutable-reject
  → delete; seed clean).
- **T3 — Athene UI + cutover.** `Hermes/Trait`, `Hermes/TraitAttribute`,
  `Chronos/TraitAttributeSetVersion` instances + the §6 Traits tab + the
  workbench coordination signals + β2 descriptions for the new instances.
  *Acceptance:* in-app, the Traits tab lets the user create a trait, add a draft
  TASV, edit its attributes, commit it, and switch traits/versions — end to end
  on node-Apollo.
  **Sub-phased T3.1–T3.4. As landed — T3.1 (`9748951`, confirmed in-app):** the
  generic **`viewAction`** capability (node-level `optionSchemas.viewAction`
  `{ type:'object', default:null }` + a conditional `--drill` button in
  `ViewHeader`) + the **`Hermes/Trait`** instance (CRUD over the class's traits,
  delegating to the World-tree `traits` collection). The `viewAction` mechanism
  was traced through the framework (`valueItemSchema` allows `type:'object'`;
  `resolveResourceData` materializes the `null` default so the shared
  `ViewHeader` never throws for non-opt-in instances). The button is live but
  **inert** until T3.2 — its handler optional-chains the not-yet-existing
  `athene.setSelectedTraitId`. T3.2 = workbench `selectedTraitId` wiring + the
  "← Back to Traits" return door; T3.3 = `Chronos/TraitAttributeSetVersion` +
  `Hermes/TraitAttribute` (level 2, fulfils Chronos E5); T3.4 = β2 descriptions
  + cutover.

## 10. Bottom-up propagation

**All four flipped at T3.4 (2026-06-02) — this beta's markers now live in each parent:**

- **Apollo beta** — ✓ marked: T1 is the first "full eventual stack" entry beyond
  slice 1 (the trait routes extend the same contract, generalized over an owner).
- **Chronos beta** — ✓ marked: T3.3's `TraitAttributeSetVersion` instance **is
  E5**, executed (`140fe0e`) — the 2nd live instance that forced Chronos
  genuinely instance-agnostic.
- **World-OOP-tree beta** — ✓ marked: the `traits/` subtree (landed T2,
  `86a46a0`) is the **first I4+ subtree to materialize**.
- **Alpha** — ✓ marked: Phase 3's "Trait list + editor" + "Trait Attribute Set
  Version editor" P0 surfaces delivered (T3 commits).

## 11. Cross-links

- Conceptual model: `../notes/conceptual-deep-dive.md` §2 #4, §3.3, §4 #2, §8 (storage)
- Pattern reused: `beta_implementation_plan_apollo.md` (the class→ASV→attribute slice + its clean contract)
- Engines: `beta_implementation_plan_hermes.md`, `beta_implementation_plan_chronos.md` (E5)
- World tree: `beta_implementation_plan_world_oop_tree.md`
- Vocabulary: `../VOCABULARY.md` (Trait + Trait Attribute Set Version rows added at T1)
- **Review (2026-06-01):** an adversarial review found 8 confirmed defects
  (mostly the shared Chronos/Athene engine mechanism; the generalization "copied
  the shapes so it copied the ASV bugs too"). All FIXED — athene `b1f1976`
  (MF-1/MF-2/MF-4/SF-1) + apollo `59b32a0` (NTH-1) — except the
  affordance/security-gating items, deferred to `deferred_frontend_security.md`
  (FE-1, FE-2). The findings report was retired once cleared; the fix rationale
  lives in those commit messages + that tracker. Residual framework race:
  morpheus-core#29.
