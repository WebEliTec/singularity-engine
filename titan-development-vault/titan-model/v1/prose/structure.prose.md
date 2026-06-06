# Structure

What exists in the Singularity Engine's domain: the things a modeler builds, and how they nest. (This document mirrors `structure.formal.md`; the formal is canonical.)

## Concepts

The signature — every concept named once.

**Entities:**

- **World** — the whole model; the root that holds all entity classes. (Its singleton-ness is stated as invariant I11, not here.)
- **EntityClass** — a kind of thing the modeler defines (e.g. *Article*, *Author*). Owns its traits, its attribute-set versions, and its composition-scheme versions.
- **Trait** — a reusable, class-scoped role attached to an entity class. Like a class, it owns its own attribute-set versions.
- **AttributeOwner** — the abstract umbrella for *anything that owns attribute-set versions* — a class **or** a trait. (`EntityClass` and `Trait` are its two kinds; see Taxonomy.)
- **Version** — the abstract umbrella for a *spec version*: it carries a version number and a lifecycle stage. (`AttributeSetVersion` and `CompositionSchemeVersion` are its two kinds.)
- **AttributeSetVersion** — one versioned set of attribute definitions, owned by an `AttributeOwner`. Holds `Attribute`s.
- **CompositionSchemeVersion** — one versioned set of composition directives, owned by an `EntityClass` (classes only). Holds `CompositionDirective`s.
- **Attribute** — one field definition (its label, data type, whether it's required) inside an attribute-set version.
- **CompositionDirective** — one entry in a composition scheme: "this class composes *that* sub-class" (optionally qualified by a trait).

**Enumerated value types:**

- **LifeCycleStage** — `≡ {draft, committed}` — a spec version is either being edited (`draft`) or frozen (`committed`).
- **DataType** — `≡ {text, richtext, email, url, tel, boolean, integer, float, date, time, datetimeLocal, json, unixTimestamp}` — the kind of value an attribute holds. (`datetimeLocal` is serialized `datetime-local` in code.)

## Taxonomy

The is-a hierarchy. A subconcept inherits its parent's properties and relations.

- `EntityClass ⊑ AttributeOwner` — every entity class is an attribute-owner.
- `Trait ⊑ AttributeOwner` — every trait is an attribute-owner.
- `AttributeSetVersion ⊑ Version` — every attribute-set version is a spec version.
- `CompositionSchemeVersion ⊑ Version` — every composition-scheme version is a spec version.

## Properties

Each concept's own data fields — `=1` required, `≤1` optional.

**EntityClass** — `=1 id.ID ⊓ =1 singular.String ⊓ =1 plural.String ⊓ ≤1 description.String ⊓ ≤1 profileImgUrl.String`

- `id` — its identity (a kebab slug), required.
- `singular` — the singular display name, required.
- `plural` — the plural display name, required.
- `description` — free text, optional.
- `profileImgUrl` — an image URL, optional.

**Trait** — `=1 id.ID ⊓ =1 label.String ⊓ ≤1 description.String`

- `id` — its identity (kebab), required.
- `label` — the role name, required.
- `description` — free text, optional.

**Version** (shared by `AttributeSetVersion` and `CompositionSchemeVersion`) — `=1 version.Integer ⊓ =1 lifeCycleStage.LifeCycleStage`

- `version` — its version number (a positive integer), required.
- `lifeCycleStage` — `draft` or `committed`, required.

**Attribute** — `=1 id.ID ⊓ =1 label.String ⊓ =1 dataType.DataType ⊓ =1 isRequired.Boolean ⊓ ≤1 description.String`

- `id` — its identity (kebab), required.
- `label` — display name, required.
- `dataType` — the kind of value it holds (a `DataType`), required.
- `isRequired` — whether the field must be filled, required.
- `description` — free text, optional.

**CompositionDirective** — `=1 subClassId.ID ⊓ ≤1 traitId.ID ⊓ =1 description.String ⊓ ≤1 cardinalityRules.String`

- `subClassId` — the id of the composed sub-class, required. (A plain id, not a resolved link — it may name a class that does not yet exist.)
- `traitId` — the id of a trait that qualifies the sub-class, optional. (Also a plain, possibly-unresolved id.)
- `description` — its purpose, required.
- `cardinalityRules` — a cardinality grammar string, optional (stored verbatim; not parsed here).

## Relations

The non-taxonomic links — all containment. `[d]` is the count of domain instances per range instance; `[r]` the count of range instances per domain instance.

- `hasEntityClass : World [1] → [0..N] EntityClass` — the world holds 0..N entity classes; each class belongs to exactly one world.
- `hasTrait : EntityClass [1] → [0..N] Trait` — a class holds 0..N traits; each trait belongs to exactly one class.
- `hasAttributeSetVersion : AttributeOwner [1] → [0..N] AttributeSetVersion` — an owner (class or trait) holds 0..N attribute-set versions; each such version has exactly one owner.
- `hasCompositionSchemeVersion : EntityClass [1] → [0..N] CompositionSchemeVersion` — a class holds 0..N composition-scheme versions; each belongs to exactly one class.
- `hasAttribute : AttributeSetVersion [1] → [0..N] Attribute` — a version holds 0..N attributes; each attribute belongs to exactly one version.
- `hasCompositionDirective : CompositionSchemeVersion [1] → [0..N] CompositionDirective` — a version holds 0..N directives; each directive belongs to exactly one version.
