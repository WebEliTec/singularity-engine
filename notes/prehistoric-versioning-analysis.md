# Versioning in the Prehistoric Artifacts — Analysis

*Extraction of the versioning system from the WordPress-era Singularity
Engine predecessors (2026-05-29), to inform the current SE versioning
model. Applies to: `singularity-engine/VOCABULARY.md` (resolves several of
its open questions — see last section).*

> **Why this matters:** these WP plugins **achieved a recursive, multi-level
> versioning system** that the later `content-creation-center` /
> `content-management-hub` (post-WP) did *not*. So for *versioning*, the
> prehistoric code is ahead of its successors — this is recovery, not
> archaeology-for-its-own-sake.

---

## Artifacts & scope

- **`content-creation-center-alpha-main/`** — WP plugin: the authoring +
  system-versioning + content-pocket-extraction side (the `wp-prof`
  product). 85 PHP files.
- **`content-distribution-center-main/`** — WP plugin (**CDC**): the
  consumer/distribution side that *receives* deployed content. 19 PHP files.
- No docs exist; findings are from code.

**Files read for this analysis:**
`includes/system/Content_System_Version_Controller.php` (the core),
`content-managers/Content_Object_Traits/Object_Version_Controller.php`,
`includes/system/Export_Manager.php`,
`includes/system/Distribution_Manager.php` (a stub).
**Inferred from usage, not deep-read:** class-version internals
(`content-managers/Content_Class.php` — observed via how the version
controller consumes `asc-ids`/`tsc-ids`); the CDC *import* side
(`includes/system/import_manager.php`, `content_storage_operator.php`).

---

## 1. The version ladder (headline)

A recursive, multi-level versioning system. Levels, coarse → fine:

| Level | Stored as | Binds / means | Kind |
|---|---|---|---|
| **System-Major** | `major-version.json` → `supported_classes`, `relation_scheme` | the world's **type-inventory**: which classes / relations / taxonomies exist | composite |
| **System-Minor** | `minor-version.json` → `supported_class_version_ids` | **which class-version is active per class** | composite (binds class-versions) |
| **Class-Version** | (per class) → `asc-ids`, `tsc-ids` | which **attribute-scheme + taxonomy-scheme** the class uses | composite (binds schemes) |
| **Attribute-Scheme / Taxonomy-Scheme** | scheme files | the actual field / taxonomy **definitions** | **spec** (≈ today's ASV) |
| **System-Micro** | `micro-version.json` → `objects` (globalId → objectVersionId), `relations` | the **content snapshot** (deployed objects + relation graph) | composite (binds object-versions) |
| **Object-Version** | object `version-config.json`; `{classVersion}.{iteration}` | one object's content, against a class-version; draft/committed | spec + lifecycle |

Two kinds of version run throughout (the distinction we re-derived later):
- **Spec version** — the file *is* the content (attribute-scheme, taxonomy-scheme, an object's values).
- **Composite version** — a *binding tuple* of child-version-ids (system-minor binds class-versions; class-version binds schemes; system-micro binds object-versions). `replace_scheme_references_with_actual_schemes()` is the literal **reference → resolve** dereference step.

---

## 2. On-disk = the version tree (nested, RESET semantics)

`content-system/{major}/{minor}/{micro}/`, each level's config enumerating
its children (`minor_version_ids`, `micro_version_ids`). The path *is* the
version coordinate.

- `set_next_micro_version_id()` = `max(micro_version_ids) + 1`, scoped
  **within a minor**; minors scoped within a major.
- ⇒ **Nested / semver-RESET model**: micro resets per-minor, minor per-major.
  (This is why a remembered tail like `…2.4` stays small.) The version is a
  *coordinate into the tree*, not a set of independent lifetime counters.

---

## 3. Event → level rules (recovered)

What event bumps which level:

| Level | Bumps on |
|---|---|
| **Major** | a new entity-class, relation-type, or taxonomy (the world's shape changes) |
| **Minor** | a class's active schema-version changes (`supported_class_version_ids`) |
| **Micro** | content changes — a new/edited deployed object, or a relation change |

(These match the rules reconstructed from memory: "new class/relation/
taxonomy → first digit; new object / edit value → last digit." The middle
digit, forgotten, = **which class-schema-version is active**.)

---

## 4. Content-pocket extraction = a compiler (source vs artifact)

`create_content_system_micro_version()` → `create_archive_entry()` writes a
ZIP containing **two vaults** — this is the key architectural insight:

- **`internal-vault.json`** — the full, **normalized** record (major+minor+
  micro data, version structure intact). → the **source of truth**.
- **`external-vault.json`** — **flattened + resolved + denormalized** for
  consumers: class-version references dereferenced into actual
  attributes/taxonomies (`replace_scheme_references_with_actual_schemes()`),
  relation cardinalities inlined, each object's content extracted
  (`extract_content()`). → the **compiled artifact** (the Data-Pocket).
- `generate_version_metadata_file()` stamps `version = major.minor.micro`
  (dot form) + `created_at`.

So the WP era already built the **"World = source / Data-Pocket = compiled,
lossy, one-way projection"** split. The external-vault *is* the content-pocket;
the internal-vault keeps the normalized authority. Extraction = the compiler.

---

## 5. Object versions + lifecycle

`Object_Version_Controller` — per-object, `{classVersion}.{iteration}`:
- **major = the class-version the object conforms to**; minor = the object's
  own content iterations.
- **`commit_object_version()` / `uncommit_object_version()`** →
  `version_publishing_status: 'commited' | 'draft'`. *(Origin of the
  long-lived `'commited'` misspelling — it propagated WP → CCC → Athene.)*
- **"currently *selected*" (being edited) vs "currently *deployed*"
  (published/released)** — a HEAD/working-vs-released split. The micro
  snapshot pulls each object's *deployed* version, not its working one.

---

## 6. Distribution / CDC (the consumer side)

`Export_Manager` posts to `CDC_URL/wp-json/cdc/v1/import_action`:
- `deploy_object_version()`, `retract_object()`,
  `update_base_attributes_remote()`, `deploy_relation_value_list()` — a
  per-object deploy/retract API against the remote **CDC** plugin.
- `Distribution_Manager` is a stub (`upload_data_vault()` placeholder) —
  whole-vault distribution was nascent; per-object deploy was the live path.
- **CDC = the read-side consumer** that receives deployed objects + the
  relation graph (the role install-wp.com / the Next.js consumer now plays).
  *(CDC import internals not deep-read here.)*

So there were **two export paths**: (a) whole-system archive (the
internal/external vault ZIP, §4), and (b) per-object live deployment to CDC.

---

## 7. Mapping to the current SE model

| Prehistoric (WP) | Current SE | Note |
|---|---|---|
| Attribute-Scheme (spec) | Attribute Set Version (ASV) | the spec layer |
| Class-Version binds `asc-ids`+`tsc-ids` | Class Version binds {ASV + composition + traits} | composite |
| System-Minor binds class-versions | World Version binds class-versions | composite, one up |
| System-Major (types) + Minor (schema) + Micro (content) | World Version, layered | one world cut spans all three |
| internal-vault / external-vault | World store / Data-Pocket | source / compiled artifact |
| `replace_scheme_references_with_actual_schemes()` | resolve a composite version's bindings | reference → dereference |
| nested major/minor/micro | (the reset-vs-no-reset question) | historically RESET |
| selected vs deployed object version | working/HEAD vs released | adopt |

---

## 8. Open questions in `VOCABULARY.md` this resolves / informs

- **reset vs no-reset** → historically **RESET / nested** (a coordinate, not
  independent odometers). *Decision: keep, or evolve to no-reset for lossless
  diffs.*
- **digit → level partition** → **recovered**: Major=types, Minor=active
  class-schema-versions, Micro=content (objects+relations). 3 levels; the
  current 4-level idea (splitting object-population vs object-content) would
  be a *refinement*.
- **"world version: schema-only or schema+content?"** → **layered, both**:
  Major=types, Minor=schema, Micro=content — a single world cut spans all.
- **Data-Pocket contents** → the **external-vault** shows the resolved/
  flattened shape (classes→attributes/taxonomies, relation cardinalities,
  objects→extracted content).

---

## 9. New since the WP era (not present here)

The WP design used the structured `major.minor.micro` **as** the release id
directly — there was **no separate human release counter**. The current
idea of a clean `1, 2, 3…` **release version mapped to** the world-state
coordinate (the git **tag ↔ SHA** model — "versioning systems &
correspondences") is an *evolution beyond* this design.

## 10. What does NOT carry forward

WP-specific plumbing: `wpdb`/`postmeta` queries, `global_id` ↔ `post_id`
mapping, language-groups, `deployment_status` flags, serialized meta. The
**clean ideas** (the level ladder, spec-vs-composite, reference→resolve, the
source/compiled-artifact split, selected-vs-deployed) carry; the WordPress
coupling does not.
