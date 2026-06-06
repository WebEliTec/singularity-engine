# Singularity Engine — Concept & Vocabulary Registry

**One canonical name per concept, rendered consistently across every
surface** — Apollo (on disk + HTTP contract), Athene (domain classes + UI),
the install-wp.com consumer, the ingestion script. This is CodeAsContext
**#6 — "one name per concept across all surfaces"** — made a project
artifact. Apollo and Athene both *derive* their names from here; drift
between surfaces is a defect to fix here first.

External vocab (e.g. the legacy backend's `content_class`, or an upstream
plugin's own version) is translated to the canonical name **at the
boundary** — it never leaks inward.

> Status tags: **✅ settled** · **🔭 reserved / future-slice** · **❓ open question.**
> Slice 1 = World + Entity Classes + Attribute Set Versions (+ embedded
> Attributes). The composite-version layers, releases, correspondences, and
> the Data-Pocket are later slices — described here so the *concepts* are
> fixed, even though the *code* comes later.

---

## Casing per surface

| Surface | Casing | Example |
|---|---|---|
| on-disk folders / route segments | `kebab-case` | `entity-classes` |
| JSON / contract keys (disk **and** wire) | `camelCase` ✅ **(Decision #3)** | `attributeSetVersions` |
| domain classes (Athene + Apollo) | `PascalCase` — singular item / plural collection | `EntityClass` / `EntityClasses` |
| UI labels | Title Case | "Attribute Set Versions" |

---

## Node anatomy on disk ✅

Every **typed node** is a folder:
```
{node}/
  identity.json          ← the node's own, STABLE identity (id + descriptive fields). Not its state.
  {child-collection}/    ← child collections, each a folder named 1:1 to its concept
  versions/              ← (where versioned) composite version tuples — see Versioning
```
- **`identity.json`** holds *what the node is* — never its mutable state. Lifecycle (draft/committed) is **not** here; it lives on the *versioned* things (ASVs, class versions). This is the cleaner separation CCC's `meta.json` lacked (it mixed identity + state, and even keyed its content `core` while the file said `meta`).
- The **World** is the singleton-root **exception**: its own-record is **`world.json`** (system/store metadata — currently just `schemaVersion`; the rest reserved), not `identity.json` — the World has system-state, not an identity.

**Layout principle:** folder-containment for things with **independent identity + lifecycle** (World, Entity Classes, ASVs, later objects/traits — each its own folder/file); **embedded JSON for atomic parts of a single version's snapshot** (Attributes, which version *as a set* inside their ASV). The on-disk tree mirrors the OOP tree, named identically. *(All storage specifics stay behind a `Store` seam in Apollo — the domain never touches paths/files directly, so the substrate stays swappable.)*

**Slice-1 shape:**
```
apollo/world/
  world.json                         { schemaVersion: 1 }   (+ reserved)
  entity-classes/
    plugin/
      identity.json                  { id, singular, plural, description, profileImgUrl }
      attribute-set-versions/
        1.json  2.json …             an ASV — attributes embedded
```

---

## Concepts — slice 1

| Concept | Definition | on-disk (`apollo/world/`) | contract key | domain class | UI label |
|---|---|---|---|---|---|
| **World** | the root — the whole modeled domain | `world/` (`world.json` = own-record) | — | `World` | — |
| **Entity Class** | a *type* of thing modeled (e.g. plugin, theme, provider) | `entity-classes/{id}/identity.json` | `entityClass(es)` | `EntityClass(es)` | "Entity Class(es)" |
| **Attribute Set Version** | a versioned snapshot of a class's attribute schema; draft → committed | `…/{id}/attribute-set-versions/{n}.json` | `attributeSetVersion(s)` | `AttributeSetVersion(s)` | "Attribute Set Version(s)" |
| **Attribute** | a field defined within an ASV (embedded — versions as a set with its ASV) | embedded in the ASV file | `attribute(s)` | `Attribute(s)` | "Attribute(s)" |
| **Trait** *(T1)* | a class-scoped reusable role (mixin) a class adopts; identity-only, owns its own ASVs | `…/{classId}/traits/{traitId}/identity.json` | `trait(s)` | `Trait(s)` | "Trait(s)" |
| **Trait Attribute Set Version** *(T1)* | a versioned snapshot of a *trait's* attribute schema — byte-for-byte an ASV, owned by a trait not a class | `…/traits/{traitId}/attribute-set-versions/{n}.json` | `attributeSetVersion(s)` (nested in the trait) | `AttributeSetVersion` (shared) | "Attribute Set Version(s)" |
| **Composition Scheme Version** *(C1)* | a versioned bag of a class's Composition Directives — *how the class is composed of other classes*; draft → committed; **class-only**, a separate axis from attributes | `…/{classId}/composition-scheme-versions/{n}.json` | `compositionSchemeVersion(s)` | `CompositionSchemeVersion(s)` | "Composition Scheme Version(s)" |
| **Composition Directive** *(C1)* | one composition rule inside a CSV (embedded, ordered array): `{ subClassId, traitId?, cardinalityRules, description }` with a **server-derived** deterministic id | embedded in the CSV file | `compositionDirective(s)` | `CompositionDirective(s)` | "Composition Directive(s)" |

**Entity Class identity ✅ (settled in A2, refined in A5):** an Entity Class's
`id` is a **kebab-case machine key**, **frozen at creation** — both the stable
identity and the on-disk folder name. It is **client-supplied** when given
(matching the Attribute contract + Athene's create form, which carries an
explicit id), else **derived** from `singular` (slugified). A clash is a
**409**, never a silent rename; `id` is immutable (PATCH can neither set nor
change it; unknown body fields → 400). Opaque/generated ids were rejected —
they'd fight the inspectable, git-friendly directory-as-DB.

**Attribute Set Version lifecycle ✅ (settled in A3):** an ASV is **created
empty as a `draft`**, gains attributes, then **commits** (`draft → committed`)
via an explicit action. A **committed ASV is immutable** (re-commit → 409,
delete → 409); only **drafts** are deletable. **An empty draft cannot be
committed** (the empty-commit guard → 400). ASV **id = `max(existing) + 1`
within the class**, so committed ids are **monotonic and never reused** (a
committed ASV is never deleted, so the max only grows); a *deleted draft's* id
may be recycled — harmless, since nothing committed ever references a draft.
(This intra-system minting is distinct from the Axis-2 "one number, one
purpose" rule, which is about *cross-system* correspondence.) **Multiple open
drafts per class are allowed** — no single-draft constraint in slice 1.

**Attribute identity + types ✅ (settled in A4):** an Attribute is
`{ id, label, dataType, description, isRequired }`, **embedded in its ASV** (it
versions as a set with the ASV — no separate file). Its **`id` is a
client-supplied kebab machine key** (validated, immutable, unique within the
ASV → 409 on clash), **distinct from the editable `label`**. Note this differs
from an Entity Class's id, which is *derived* from `singular`: a class has a
natural name to slug; an attribute's machine key has no 1:1 source and its
label may change, so the key is chosen explicitly and frozen. `dataType` is a
**13-type enum** — the config-free scalars `text, richtext, email, url, tel,
boolean, integer, float, date, time, datetime-local, json, unixTimestamp`;
`dynamicList`/`optionList` are **deferred** (they need extra selection-config).
`description` is **optional** (default `''`), `isRequired` defaults `false` —
the backend stays permissive; the UI may be stricter. All attribute writes are
**draft-only** (a committed ASV's attributes are immutable → 409). **Ids stay
kebab everywhere** (they're folder names + route segments, per the casing
rule); Athene's snake_case machine-name inputs switch to kebab at A5.

**Trait identity + the multi-faceted grant ✅ (settled in T1):** a **Trait** is a
class-scoped reusable role — a *stable, intrinsic characteristic that confers
capabilities* (the "trait" vs "role" call, settled 2026-05-30: a company **is** a
software company, it doesn't *play that role* — roles are context-bound,
anti-rigid). Adopting a trait grants several capability types at once; the
**attribute-set is one facet**, with relation- and (later) source-eligibility as
**siblings** (future slices). **T1 builds the attribute facet only.** A Trait is
**identity-only** `{ id, label, description }` (lifecycle lives on its versions,
like a class); its **`id` is client-supplied kebab** (required, immutable, unique
within the class → 409). It **owns Attribute Set Versions exactly like a class** —
a TASV ≡ an ASV one level down — which is what keeps **condensation/decomposition**
open (deep dive §12). In Apollo the ASV/attribute lifecycle is **generalized over
an *owner*** (`{classId}` | `{classId,traitId}`), so one implementation serves both.

**Composition ✅ (settled in C1):** a **Composition Scheme Version (CSV)** is a
class-owned, **separately-versioned** bag of **Composition Directives** — it
answers *what the class is built out of*, an axis orthogonal to its attributes
(deep dive §3.2). It follows the **same draft → committed lifecycle** as an ASV
(empty-commit → 400; committed immutable → 409 on mutate / delete / re-commit;
id = `max(existing)+1`), but is **class-only** (no trait/owner axis). A class
**starts with zero CSVs** (no seed; created on demand — so the Composition tab
opens on an empty-state). A **Composition Directive** is embedded in its CSV as
an **ordered array** element `{ id, subClassId, traitId?, cardinalityRules,
description }`: `subClassId` is the composed class, `traitId` optionally
qualifies it to a **trait of that sub-class**, and the **id is server-derived** —
`subClassId` alone, or `subClassId:traitId` when qualified (never client-supplied;
dup → 409). **A class cannot compose ITSELF** — `subClassId` must differ from the
host class id (else **400**, traitId-agnostic; enforced at create + commit, added
2026-06-03). `subClassId`/`traitId` are the **frozen identity** (absent from the
update body; re-target = delete + recreate). `cardinalityRules` is stored
**verbatim as `string|null`** — the grammar (`"1"`, `"qty"`, `"qty>0"`, …) is
validated only in the Athene input, not server-side. Sub-class / trait
**existence is intentionally not validated** (forward-reference-ready, deep dive
§11). The legacy `is_suplement_class` boolean is **dropped** for now; the legacy
id-keyed directive **map becomes an ordered array** (Apollo's contract rule). On
the wire the directive id's `:` is **percent-encoded** (`%3A`) in the route path.

🔭 *Added as each slice lands:* Class Version, Object Structure Version, Class Object, Relation, Taxonomy.

---

## Versioning — two orthogonal axes

Versioning runs on **two axes**; keep them distinct.

### Axis 1 — Composition (*versions of versions*) ✅ concept

Two kinds of version:
- **Spec version** — the file *is* the content. An **ASV** = its set of attributes.
- **Composite version** — a **binding tuple** pointing at *which child-version-ids* compose it. It carries no spec of its own.

The ladder (self-similar — the version structure mirrors the containment tree):
```
spec        Attribute Set Version   =  the attributes themselves
composite   Class Version           =  { which ASV + composition + trait-versions }   (one class)
composite   World Version           =  { which class-version per entity-class, … }    (the whole world)
```
On disk, composite versions live in a `versions/` folder of tuples (e.g. `entity-classes/{id}/versions/{n}.json`; `world/versions/{n}.json`). **Slice 1 builds only the spec layer (ASVs)**; the composite layers (class/world versions) come later. A **World Version** is the canonical "state of the whole world at a cut."

### Axis 2 — Correspondence (*versioning systems & mappings*) ✅ concept (the newest)

The engine maintains a small **registry of versioning *systems*** — each defined by *(id-domain + advance-rule + purpose)* — plus **correspondences** (mappings) between them, each a link **stamped at an event**. The discipline that keeps this from sprawling: **define each system once, define each correspondence once, and never make one number serve two purposes.**

Two systems so far:

| System | Id-domain | Advances on | Purpose |
|---|---|---|---|
| **World-state version** | multi-digit odometer `W.X.Y.Z` — one digit per world-tree *level* | each **committed/saved** event, mechanically (a pure function of the committed event log) | precise, lossless, auditable internal coordinate of the world's evolution |
| **Release (content-pocket) version** | simple monotonic integer `1, 2, 3…` | `+1` per published pocket | clean human/external handle |

**Correspondence (the mapping):** `Release(1) ← WorldState(1.28.2.4)`. The release record *is* the mapping: `{ release: 1, worldState: "1.28.2.4", extractedAt: … }`. (Mental model: git **tag → commit-SHA**. The release is the tag; the world-state is the precise SHA; never ship the SHA as the human label.)

**World-state digit → level (candidate):**

| Digit | World-tree level | Bumps on |
|---|---|---|
| 1 | World **type-inventory** | new entity-class / relation-type / taxonomy ✅ |
| 2 | Class **schema** | a class's committed schema changes ❓ |
| 3 | Object **population / graph** | object created/deleted, relation-instance, taxonomy-assignment ❓ |
| 4 | Object **content** | an existing object's attribute value edited ✅ |

❓ Open within the world-state system: the exact event→digit **partition** (digits 2/3; whether "new object" and "edit value" are one level or two); and **reset vs no-reset** (semver-style coordinate that resets lower digits on a higher bump — matches the small tail in `1.28.2.4`; vs. independent lifetime counters — lossless component-wise diff between releases). Both are "purely mechanical"; the reset clause is the choice.

🔭 *Next correspondence — source provenance:* an upstream's own version (e.g. Yoast `21.5`) ↔ our object's content-version (+ `last_fetched_at`) — powers source attribution and staleness/re-fetch. Per-locale release status is likely another.

---

## Data-Pocket 🔭

A **lossy, one-way projection** of a *committed* world-state — the resolved, flattened, denormalized snapshot install-wp.com consumes. **Not equivalent** to a World Version.

> **Compiler metaphor:** World store = *source* · Data-Pocket = *compiled artifact* · extraction = the *compiler*. You compile the artifact from the source; you never reconstruct the source (history, drafts, bindings, alternatives) from the artifact.

Reserved for the export slice (needs objects). ❓ Open: does a World Version bind **schema-only** (class-versions) or **schema + content** (objects + values + locales)? — i.e. what a "release" actually freezes. Decided when objects + extraction land.

---

## The prescriptive model (`model/`) ✅

The canonical, formal statement of **what the system is** — *what exists*, *what
must always be true*, and (later) *what happens* — lives in one place: the
top-level **`model/`** directory (a governance peer to `development/`; established
2026-06-03 as `rules/`, reorganised into the versioned `model/` 2026-06-04). It is
the **heart of the system**: the apollo shapes, the HTTP contract, the on-disk
layout, the athene tree, and the enforcement code all *derive* from it.

- **Three layers, each in the logic fit for its dimension** (charter:
  `model/ARCHITECTURE.md`): **Structure** (what exists) in **Description Logic** ·
  **Invariants** (what must be true) in **first-order logic** · **Dynamics** (what
  happens) in **LTLf** (reserved). All one first-order family.
- **Three tiers per layer:** **formal** (canonical) → **prose** (for Daniel) →
  **code** (the runtime — e.g. the Invariants Tier-3 is `apollo/src/domain/rules/`,
  a `RULE_REGISTRY` of named predicates, with a binding test that keeps the tiers
  in bijection by id).
- **Versioned, forked-forward snapshots** under `model/versions/vN/`; the canonical
  model is the highest-numbered **committed** version (**v1** = the inaugural
  attributes + traits + composition model). A new concept forks a new version.
- **Invariant id** = `R-<DOMAIN>-NN` (`LIFE`/`IDENT`/`COMP`/`EXIST`/`SAFE`; future
  `REL`/`TAX`/`VER`); `N-<DOMAIN>-NN` = a deliberate non-invariant. **Structure**
  uses DL concept/role names.
- **Change protocol:** fork a version, then **formal → prose → code**, never
  skipped — even for a rule found while reading code. Boundary/shape rules (kebab
  ids, the `dataType` enum, `additionalProperties`, `minLength`) stay declarative
  at the Apollo route, only *referenced* by the model.

> Scope boundary: `model/` = *what the system IS*; `development/` = *what we're
> about to build*; this file = *one name per concept*. Three peers.

---

## Open questions & reserved (parked, in one place)

- ✅ Contract/JSON **casing** = camelCase (disk + wire) — Decision #3, settled in A1.
- ❓ World-state version: digit **partition** (2/3, new-object-vs-edit) + **reset vs no-reset** + live-counted-on-commit vs computed-at-extraction.
- ❓ World Version binds **schema-only vs schema + content**.
- 🔭 World own-record (`world.json`) beyond `schemaVersion` (current-release pointer, status…).
- 🔭 Data-Pocket exact contents; the extraction algorithm.
- 🔭 Source-provenance correspondence; per-locale release status.
