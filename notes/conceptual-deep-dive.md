# Singularity Engine — Conceptual Deep Dive

*Findings from a deep-dive analysis of `content-management-hub/` (React frontend) and `content-creation-center/` (Laravel backend). Originally drafted from a structural read; revised 2026-05-27 after a code-level verification pass and after surfacing additional concepts from the in-app HTML documentation and `content-management-hub/notes.txt`. Focus: the abstract concepts living in the system, decoupled from PHP/React specifics, to support the rewrite as Athene + Apollo.*

*Vocabulary rename 2026-05-28: the core concept formerly called "Content Class" is renamed **"Entity Class"** throughout this document and across athene's frontend code. The current Laravel backend (content-creation-center) still uses snake_case `content_class` in its routes, files, and PHP class names — that's a known **temporal mismatch** that resolves when Apollo is reimplemented in Node.js and adopts the same vocabulary. Until then: read references to backend routes (`/api/content_class/…`) and storage paths (`storage/app/content-base/classes/`) as the backend's current naming, not the conceptual model's.*

---

## 1. What this system actually is

Not a CMS. It is a **schema-authoring engine** — a system whose primary job is to let users *design the shape of content*, then *instantiate* and *evolve* that shape over time. The "content" itself is secondary; the schema is the artifact.

- The frontend (`content-management-hub/`, becoming **Athene**) is a visual editor for these schemas.
- The backend (`content-creation-center/`, becoming **Apollo**) is a file-system-backed (JSON tree under `storage/app/content-base/`) persistence layer exposed over REST.
- Eloquent models exist but are mostly decorative — the canonical state lives in the JSON tree, which makes the whole system substrate-portable by design.

---

## 2. The core concepts

These are the abstract domain entities. Substrate-independent.

| # | Concept | Definition |
|---|---------|------------|
| 1 | **Entity Class** | A blueprint for a kind of thing. Has identity (singular/plural/description), an optional class profile image, a lifecycle stage (draft → committed → active), and owns the entities below. |
| 2 | **Attribute** | A named, typed field with data-type-specific properties (e.g., `string_type_min_length`, `selection_type.values` for option lists). Never lives free; always inside an Attribute Set Version. |
| 3 | **Attribute Set Version** | A *versioned* bag of attributes belonging to a Class. Drafts are mutable; committed versions are immutable. The unit of schema evolution at the attribute level. |
| 4 | **Trait** | A reusable role a Class can adopt to gain additional attributes. Owns versioned Trait Attribute Sets (same draft/committed lifecycle). **Currently class-scoped** — each Trait lives inside its host Class's `traits/` directory; trait IDs only need to be unique within their parent Class. *Universal Traits* (cross-class shared traits) are a planned future feature; see Section 11. |
| 5 | **Composition Scheme Version** | A *versioned* description of how a Class contains other Classes/Traits. Composition is not embedded in the Class — it is a first-class, separately-versioned entity. |
| 6 | **Composition Directive** | A single rule inside a Composition Scheme Version: "this sub class goes here, optionally qualified by a trait, with this cardinality, with this description." Directive IDs are deterministic: `{sub_class_id}` or `{sub_class_id}:{trait_id}`. Carries an `is_suplement_class` boolean whose semantics are not yet fully nailed down (likely "supplemental vs core member"). Cardinality grammar observed in real data: `"1"`, `"qty"`, `"qty>0"`, `null`. |
| 7 | **Class Object** | A concrete instance of a Class. Metadata is stored separately from field values. **Class Objects encompass locales** — each instance holds multiple locale variants (language-specific versions of itself), making localization a first-class instance-level concept. Class Objects also carry their own structure versioning (a fifth versioning axis — see Section 4). |
| 8 | **Class Version** | The **binding manifest** that selects coherent versions of all the above. A Class Version records: `attributeSetVersionId`, `traitVersionIds` (a map per adopted Trait), `compositionSchemeVersionId`. The unit at which "the class at version N" is meaningful — the citable, releasable, AI-reviewable spine that turns independently-versioned resources into a coherent whole. |

Plus two cross-cutting concepts:

- **Class Relation** — A directed link between two Classes, optionally *qualified by Traits on either side* (so the same two classes can relate differently depending on which roles are active). Each partner declares: entity class, cardinality, predicate, and a `trait_list` of qualifying traits. Top-level fields include a descriptor, label, description, plus `general_data` and `constraints_data` containers.
- **Class Taxonomy** — A categorization layer over Classes themselves (not over instances). Carries **internal vs external descriptions** (private to the engine vs exposed publicly), an `is_internal` flag, and a `supported_classes_with_traits` declaration constraining which Classes (with which traits) it can categorize. Wildcard support (`["*"]`) for trait matching.

---

## 3. The five invariants that define the design philosophy

These are the load-bearing rules. Preserve these in any re-implementation; everything else is style.

### 3.1 Versioning is universal
Every structural artifact (attribute sets, trait attribute sets, composition schemes, class versions, class-object structures) is versioned with a draft → committed lifecycle. Committed = immutable. Drafts can be deleted; committed cannot. This is what gives the system governance properties.

### 3.2 Composition is a separate, versioned entity
Most schema systems embed structure inside the class. Here, a Class doesn't *contain* other classes — a Composition Scheme Version *describes* how it does. Composition can evolve independently of the class definition.

### 3.3 Traits are mixins, not subclasses
Inheritance is intentionally absent. Behavior/attributes are composed via Traits. A Class adopts Traits; a Relation can require Traits; this is the only polymorphism mechanism.

### 3.4 Schema and instance are separated
Class Objects (instances) reference the Class but the Class's structure can keep evolving via new versions without breaking existing objects. The system is built for schema drift over long timescales.

### 3.5 Class Version is the binding spine
Individual resource versions (attribute sets, trait sets, composition schemes) evolve independently on their own draft/committed timelines. The Class Version is the **manifest** that selects a coherent subset of those versions — declaring "Class N at version X = attribute set vA + trait T1 vB + trait T2 vC + composition scheme vD." Without this binding layer you have many independently-versioned resources but no way to refer to "the class at a moment in time." With it, the class becomes citable, releasable, and AI-reviewable as a coherent unit even though its constituent parts evolve separately. **This is the unit at which release operations to Data-Pockets fire, and where AI gate-keepers earn their seat.**

---

## 4. The versioning axes

Five things are independently versioned, in increasing scope:

| # | Versioned entity | Scope |
|---|---|---|
| 1 | **Attribute Set Version** | A versioned bag of attributes on an Entity Class |
| 2 | **Trait Attribute Set Version** | A versioned bag of attributes on a Trait |
| 3 | **Composition Scheme Version** | A versioned bag of Composition Directives on an Entity Class |
| 4 | **Class Version** | A manifest binding specific versions of #1, #2 (across all adopted traits), and #3 into a coherent class snapshot |
| 5 | **Class Object Structure Version** | A versioned shape for an individual instance's data, evolving independently after the instance was created |

All five follow the draft → committed lifecycle. #4 is the spine.

---

## 5. Conceptual map

```
                    ┌─────────────────────┐
                    │   Entity Class     │
                    │  (identity, meta)   │
                    └──────────┬──────────┘
                               │ owns
       ┌───────────────────────┼───────────────────────┐
       │                       │                       │
       ▼                       ▼                       ▼
┌──────────────┐      ┌────────────────┐    ┌──────────────────┐
│  Attribute   │      │     Trait      │    │   Composition    │
│ Set Version  │      │  (in-class     │    │  Scheme Version  │
│  (v1, v2…)   │      │     role)      │    │    (v1, v2…)     │
└──────────────┘      └────────┬───────┘    └─────────┬────────┘
                               │ owns                 │ contains
                               ▼                      ▼
                      ┌────────────────┐    ┌──────────────────┐
                      │ Trait Attr Set │    │   Composition    │
                      │    Version     │    │    Directives    │
                      │   (v1, v2…)    │    │                  │
                      └────────────────┘    └──────────────────┘

                    ┌─────────────────────┐
                    │   Class Version     │ ← THE BINDING MANIFEST
                    │     (manifest)      │   selects specific
                    │ • attrSetVerId      │   versions of the
                    │ • traitVerIds map   │   resources above
                    │ • compSchVerId      │   into a coherent
                    └──────────┬──────────┘   class snapshot
                               │ classifies
                               ▼
                    ┌─────────────────────┐
                    │   Class Objects     │ (instances)
                    │  • locales[]        │ ← multilingual
                    │  • structureVerIds  │ ← self-versioning
                    └─────────────────────┘

  ┌─────────────────────────────────────────────────────────┐
  │       Class Relations and Class Taxonomies              │
  │  – Relations link Classes (trait-qualified per side)    │
  │  – Taxonomies categorize Classes (internal/external)    │
  └─────────────────────────────────────────────────────────┘
```

---

## 6. Frontend mental model — the "named systems"

The frontend folder layout encodes the architecture as a cast of named subsystems (mythological names) — these are the abstract *runtime concerns*, orthogonal to the domain entities:

| System | Concern |
|--------|---------|
| **Hermes** | Forms, dialogs, user-input capture, validation |
| **Chronos** | Time/date, versioning timestamps |
| **Iris** | UI focus/selection/activation state (which thing is "active") |
| **Orion** | Async data fetching and orchestration |
| **Prometheus** | Observability/telemetry (stubbed) |
| **SmartDialog** | Dynamic modal management |

### Domain layer tiers (frontend)

- `classes/` — OOP wrappers over API data (EntityClass, Trait, AttributeSetVersion, CompositionSchemeVersion). Carry behavior, not just data.
- `managers/` — UI containers for CRUD per entity, following an `Index → ManagementInterface → ManagerUi` three-layer pattern.
- `systems/` — the named cross-cutting concerns above.
- `blueprints/` — reusable architectural templates.

### State management

Redux Toolkit Query, sliced by concern:

- `contentSystemSlice` — master CRUD for classes/attributes/traits/composition/objects
- `contentSystemManagerSlice` — system metadata
- `contentDataBrokerSlice` — cross-class aggregated views
- `classRelationManagerSlice` — class-to-class relationships
- `classTaxonomyManagerSlice` — class categorization

Mutations invalidate `EntityClassesData` / `EntityClassList` tags to force coherent refetches.

---

## 7. Backend mental model — managers + PHP traits

The backend uses **PHP traits as a code-composition tool** (confusingly, since the *domain* also has Traits — different concept). The `Content_Class` service is assembled from PHP traits:

- `Initial_Setup` — first-time directory/file creation
- `Class_Attribute_Manager` — attribute set versioning and CRUD
- `Class_Trait_Manager` — trait creation, versioning, attribute management
- `Class_Composition_Manager` — composition scheme versioning, directive CRUD
- `Class_Version_Manager` — class version tracking and promotion
- `Class_Object_Manager` — object instantiation and lifecycle

Singleton managers coordinate state:
- `Content_System_Manager` — system bootstrap/diagnostics
- `Content_Class_Manager` — class lifecycle
- `Class_Relation_Manager` — relations between classes
- `Class_Taxonomy_Manager` — class categorization

A single `RestApiController` is the HTTP entry point; it delegates everywhere.

### Error handling pattern

**Accumulating errors**: validation errors are collected in a `CCC_Error` singleton and only thrown when `error_guard()` is called — enabling batch validation rather than fail-fast.

### Read-side aggregation

`Content_Data_Broker` materializes cross-class views (trait indexes, relation maps) so the frontend doesn't have to traverse the JSON tree itself.

---

## 8. Storage shape — the portable artifact

The entire system state is a JSON tree. **This tree is the migration unit** for the Apollo Node.js port; everything else (Laravel, React, Redux) is implementation detail.

```
content-base/
├── meta-system.json                       ← system-level metadata
├── classes/{class_id}/
│   ├── meta.json                          ← class metadata + lifecycle stage
│   ├── versions/{v}.json                  ← Class Version manifests (attrSetVerId, traitVerIds, compSchVerId)
│   ├── attributes/{v}.json                ← Attribute Set Versions (committed/draft)
│   ├── traits/{trait_id}/
│   │   ├── meta.json                      ← trait identity + lifecycle stage
│   │   └── {v}.json                       ← Trait Attribute Set Versions
│   ├── composition/{v}.json               ← Composition Scheme Versions (contains composition_directives map)
│   └── objects/{object_id}/
│       └── meta.json                      ← class instance metadata (with locales, structure versions)
├── class-relations/{relation_id}/meta.json
└── class-taxonomies/{taxonomy_id}/meta.json
```

Concrete shapes verified against real data (class_id `organization`, `plugin_group`, etc.):

- **Class Version manifest** (`classes/{id}/versions/N.json`): `{ attributeSetVersionId, traitVersionIds: {trait: ver}, compositionSchemeVersionId, created_at }`
- **Attribute Set Version** (`classes/{id}/attributes/N.json`): `{ life_cycle_stage, attributes: {id: {type-specific fields}}, created_at, updated_at, committed_at }`
- **Composition Scheme Version** (`classes/{id}/composition/N.json`): `{ life_cycle_stage, composition_directives: { "subId:traitId": {sub_class_id, trait_id?, cardinality_rules, description, is_suplement_class} }, created_at, updated_at }`
- **Class Relation** (`class-relations/{id}/meta.json`): `{ descriptor, label, description, general_data, constraints_data, partners: { class_id_one: {content_class_id, cardinality, predicate, trait_list}, class_id_two: {...} }, life_cycle_stage }`
- **Class Taxonomy** (`class-taxonomies/{id}/meta.json`): `{ id, id_slug, singular, plural, is_internal, short_description, internal_description, external_description, supported_classes_with_traits }`

---

## 9. API surface (canonical contract)

Grouped by purpose. All under `/api/`.

### System
- `GET /system_status`, `GET /content_system_manager/info`
- `GET /content_data_broker` — aggregated read-side dataset

### Entity Class
- `GET /content_classes_all`, `GET /content_class`, `GET /content_class/{id}`
- `POST /content_class/create`
- `PATCH /content_class/update_meta/{id}`
- `DELETE /content_class/delete/{id}`

### Attribute Sets (nested under class)
- `POST   /content_class/{cid}/attribute-set` — create draft
- `PATCH  /content_class/{cid}/attribute-set/{vid}` — commit
- `DELETE /content_class/{cid}/attribute-set/{vid}` — delete draft
- `POST   /content_class/{cid}/attribute-set/{vid}` — add attribute
- `PATCH  /content_class/{cid}/attribute-set/{vid}/{aid}` — update attribute
- `DELETE /content_class/{cid}/attribute-set/{vid}/{aid}` — delete attribute

### Traits (nested under class; mirror the attribute-set pattern with one extra level)
- `POST /content_class/{cid}/trait` — create trait
- `POST /content_class/{cid}/trait/{tid}/create-version` — create trait attr set version
- `POST /content_class/{cid}/trait/{tid}/{tvid}` — add trait attribute
- `PATCH /content_class/{cid}/trait/{tid}/{tvid}/{taid}` — update
- `DELETE` variants at each level

### Composition (nested under class)
- `POST   /content_class/{cid}/composition` — create scheme version
- `DELETE /content_class/{cid}/composition/{csvid}`
- `POST   /content_class/{cid}/composition/{csvid}/composition-directive`
- `PATCH/DELETE` directives by id

### Class Version Management
- `POST /content_class/{cid}/version-management` — create a Class Version manifest (snapshots current resource versions into a coherent class snapshot)

### Class Objects (instances)
- `POST   /content_class/{cid}/class_object_manager`
- `PATCH  /content_class/{cid}/class_object_manager/update_meta/{oid}`
- `DELETE /content_class/{cid}/class_object_manager/delete/{oid}`
- `GET    /content_class_object/{cid}/{oid}`
- `POST   /content_class_object/{fully_qualified_class_object_id}/object_structure_version_management` — create object structure version

### Cross-class
- `GET/POST/PATCH/DELETE /class_relations`
- `GET/POST/PATCH/DELETE /class_taxonomy_manager`

Responses wrap payloads in a `data` field (sometimes a JSON-encoded string requiring `JSON.parse` on the frontend).

---

## 10. Things worth flagging for re-implementation

- **Auth is essentially absent.** Sanctum is configured but no middleware guards the routes; CORS is wide open (allows `*`). Greenfield for Apollo (Node).
- **Eloquent models are vestigial.** Migrations exist for `content_classes` and `content_objects` but the real state is the JSON tree. The Apollo Node port doesn't need to carry them.
- **Composition Directive `is_suplement_class` semantics need confirmation.** The flag exists on every directive in real data, but its precise meaning is not documented. We'll likely rediscover this during implementation. Best guess: marks the composed class as supplemental (optional/auxiliary) rather than a core member.
- **The `archive/` folder** in the frontend (`bombadil`, `bomb_minion`) shows earlier composition/plugin attempts that were abandoned. Useful as a record of paths not taken.
- **Two meanings of "trait."** Domain traits (mixin roles on Entity Classes) vs PHP traits (code composition for the `Content_Class` service). Same word, different layer. In the Node rewrite, PHP traits go away — the language doesn't have them — so only the domain meaning remains.
- **Global ID Manager** is referenced in helpers — likely intended to support portable identifiers across systems (hinting at federation/multi-tenancy plans).
- **Localization is instance-level, not schema-level.** Class Objects carry locales (language variants) as part of the instance shape. The schema doesn't have language-aware fields; instead each instance can hold multiple locale representations of itself.
- **Class Version creation appears manual** (a deliberate `POST /content_class/{cid}/version-management` route exists). This suggests Class Version is a deliberate "release candidate" action, not an automatic snapshot on every commit. Worth confirming during the rewrite.
- **Implicit event system is planned but not implemented.** `notes.txt` references a `entityClassCreated` event that propagates to dependents. This will be load-bearing for forward-reference composition directives (Section 11) and aligns naturally with morpheus's `appEvents` model.

---

## 11. Planned features (not yet implemented)

Surfaced from `content-management-hub/notes.txt`. These were intended additions when the original system was being developed. We don't need to implement them in the MVP, but **the substrate should not preclude them**.

### Universal Traits
Cross-class shared traits. Today, traits are class-scoped — each class has its own `traits/` directory and trait IDs are scoped to the parent class. Universal Traits would be a separate, top-level trait registry from which any Entity Class could adopt traits, enabling structural patterns to be reused across multiple Classes. **Prerequisite for Class Condensation (Section 12).**

### Trait-Specific Class Composition
Beyond the current `{sub_class_id}:{trait_id}` directive form, something more advanced is envisaged. Specifics unclear — likely composition behavior that varies by which Trait the host Class has adopted.

### Attribute Groups / Modules
Reusable bundles of attributes that form a unit (the canonical example: a postal address). Today, attributes are flat inside an Attribute Set Version. Attribute Groups would let authors define an "Address Group" (street, city, postcode, country) and embed that group into any Attribute Set, similar to how Composition Directives work but for attributes within a class rather than between classes.

### Composite Attributes
A *single* attribute whose value is itself structured — a named bag of sub-fields — rather than a primitive (text, integer, boolean, …). Canonical motivating example: an `address_of_headquarters` attribute on an Organization Class. Right now an author can only choose between (a) flattening it into sibling attributes (`hq_address_street`, `hq_address_city`, `hq_address_postal_code`, `hq_address_country`, …), which loses the conceptual unity and pollutes the attribute list; or (b) storing it as opaque `json`, which gives up structure-aware validation, edit-form rendering, search, and AI reasoning over the field. Composite Attributes would let the attribute itself carry a sub-schema, each sub-field with its own `attribute_data_type` (including, recursively, further composite types).

**Distinction from Attribute Groups / Modules.** The two are related but orthogonal:
- *Composite Attributes* are about value **shape** — an attribute holds a structured value, not a primitive. A structural extension to the Attribute concept (Section 2 #2).
- *Attribute Groups* are about authoring **reuse** — define a sub-schema once, inject it into many Attribute Sets.

They compose naturally: an Attribute Group could serve as the reusable sub-schema for many composite attributes across many classes (e.g., one "PostalAddress" group definition referenced by every class's address-typed attribute).

**Open design questions:**
- Are sub-fields' types drawn from the same `attribute_data_type` catalog as flat attributes (text, richtext, …) — i.e., is a composite attribute just an attribute whose type is `composite` with an inline (or referenced) sub-schema?
- How does versioning interact? Does the composite's sub-schema live inside the parent Attribute Set Version's lifecycle, or get its own version axis?
- How do constraints layer — can a composite attribute be `required` while its sub-fields are individually optional, and vice versa?
- Localization: when a Class Object holds locale variants (Section 2 #7), do composite sub-fields localize independently?
- API + storage: are sub-field values stored as a nested JSON blob under the attribute id, or normalized into something a query layer can index?

### Forward-Reference Composition Directives
A directive should be creatable even when its referenced sub-class or trait does not yet exist. Requires tracking `subEntityClassExists` / `traitOfEntityClassExists` flags on the directive, and propagating updates via the implicit event system when the referenced entities are eventually created. Lets authors lay out a class's composition skeleton ahead of building the constituent classes.

### Implicit Event System
A `entityClassCreated` event (and presumably siblings: `traitCreated`, `attributeSetVersionCommitted`, etc.) that propagates to dependents. Already designed in concept in the notes, just not implemented. Maps cleanly onto morpheus's `appEvents` framework when the rewrite arrives.

### System-Wide Entity Version Status + Mutual Dependencies
The draft/committed lifecycle has cross-entity coordination that isn't fully wired. E.g., committing an attribute set version while its parent Class Version is still in draft has implications that the current implementation doesn't fully enforce. The rewrite should formalize these dependencies.

### Unified Dynamic Options
Dynamic options for select/radio/combobox elements share machinery currently only available to comboboxes. Generalization planned.

### Data Sources
A peer engine primitive (alongside Class Relation, Class Taxonomy, DataPocket) that turns ingestion from imperative-script into configuration. Each Data Source declares:
- An endpoint (REST URL, RSS feed, scraper target, file path)
- A parser / mapping rule (how to turn endpoint response data into Class Object structure)
- A bound Entity Class — and possibly a bound Trait (which class this source populates)
- A refresh policy (how often to pull; change-detection strategy)

Once Data Sources are first-class, *"ingest 800 plugins"* becomes *"configure a Data Source for wp.org and trigger a refresh"* rather than *"write a script."* Adding a new source (wp-beginner RSS, GitHub stars, ThemeForest) becomes configuration, not code.

The formal pattern is well-trodden — Airbyte, Fivetran, and Apollo Federation all do versions of this (declarative connectors over imperative pipelines). In academic terms it's something like *parameterized ETL configurations*; in engineering terms it's "data sources as data, not code."

**For MVP:** we don't build the Data Source primitive yet. A one-off ingestion script (which is logically a hardcoded equivalent of a single Data Source instance) handles wp.org ingestion for the initial volume. Data Sources as a real primitive are post-MVP.

**Connection to AI gate-keepers:** Data Sources become particularly valuable when AI agents are managing ongoing ingestion. The agent's job becomes "monitor the Data Source for changes, apply them through the API, flag anomalies for human review" rather than running arbitrary code.

---

## 12. Schema refactoring operations: Condensation and Decomposition

These are forward-looking conceptual operations Daniel had in mind during the original design. They're not implemented and probably won't be in the MVP — but they're load-bearing for the long-term vision and the substrate should accommodate them.

### Class Condensation

An Entity Class that has adopted N Universal Traits (see Section 11) may **condensate** into a completely new Class that bakes those traits in permanently.

The mechanism:
- Class A adopts Universal Traits T1, T2, T3 ad hoc
- The combination stabilizes across many instances
- The combination has earned its own identity
- **Condensation** promotes (A + T1 + T2 + T3) into a new Class B that includes those traits as core attributes

Conceptually this is "extract class" at the trait level. *Speciation by convergence* — the engine recognizes when an emergent combination has stabilized enough to deserve its own name. Depends on Universal Traits existing (without cross-class shared traits there's no constellation to condense).

A natural AI gate-keeper operation: an agent watching usage patterns detects "12 plugins all carry `addon` + `premium` + `commercial` traits — should we condense into a `CommercialAddonPlugin` class?" The agent proposes, the human approves, the engine executes atomically.

### Class Decomposition

The opposite direction: an Entity Class **decomposes** into multiple new classes when the unified abstraction is no longer serving — different instance populations are using it in incompatible ways, or its attribute set has accumulated mutually-irrelevant concerns.

Conceptually this is "split class" applied schema-wide. Examples in the WordPress space:
- `Plugin` might decompose into `FreePlugin` and `CommercialPlugin` if their structural needs diverge enough
- `Person` might decompose into `NaturalPerson` and `JuridicalPerson` (a legal distinction relevant to plugin authors and publishers)

### What both operations require from the engine

Both are intricate because they touch the entire dependency graph:
- **Existing instances** must be migrated (or split) to the new class(es)
- **Class Relations** referencing the old class must be updated or duplicated per partner side
- **Composition Directives** in *other* classes that compose the old class must be reconsidered
- **Class Taxonomies** that categorized the old class need adjustment
- **Versioning** must capture this as a structural event — new Class Versions get created as the condensation/decomposition output, with provenance pointing at the source

This is exactly the kind of operation that *only* a system with Singularity Engine's invariants can safely perform. Without recursive versioning, history breaks. Without atomic API operations, the graph is left half-migrated. Without the world model centralized in Apollo, you can't reason about all the affected references.

### Architectural framing

These are the schema-evolution counterparts to what content creation is for content. They turn Singularity Engine from a *schema editor* into a **schema metabolism** — a system where the schema is alive, recognizes emergent patterns, and refactors itself (under human or AI direction) without breaking the world.

They also reinforce why AI gate-keepers earn a seat at the publish boundary specifically: a condensation or decomposition is a *major release event*, not an ordinary commit. It's the kind of structural change where a reviewing agent's eye is genuinely valuable.

---

## 13. Key file references

### Frontend (`content-management-hub/`)
- Domain classes: `classes/entity-class/EntityClass.jsx`, `Trait.jsx`, `CompositionSchemeVersion.jsx`
- State: `utils/store/content-system-slice.js`, `utils/store/index.js`
- Named systems: `systems/hermes/`, `systems/iris/`, `systems/orion/`, `systems/chronos/`
- Manager pattern: `managers/entity-class-manager/`, `managers/class-trait-manager/`
- Routes: `utils/routes.jsx`
- Config: `utils/conf.js`
- Working notes: `notes.txt` (planned features, TODO list)

### Backend (`content-creation-center/`)
- Entry point: `app/Services/Content_Creation_Center.php`
- Class lifecycle: `app/Services/content-managers/Content_Class_Manager.php`
- Class trait composition: `app/Services/content-managers/content_class/Content_Class.php`
- Class Composition Manager: `app/Services/content-managers/content_class/Class_Composition_Manager.php`
- Class Trait Manager: `app/Services/content-managers/content_class/Class_Trait_Manager.php`
- Initial setup: `app/Services/content-managers/content_class/Initial_Setup.php`
- API contract: `routes/api.php`
- In-app documentation snippets: `app/Services/documentation/*.html`
- Schema hints (underused): `database/migrations/2025_01_12_144034_create_content_classes_table.php`, `2025_01_12_144035_create_content_objects_table.php`
