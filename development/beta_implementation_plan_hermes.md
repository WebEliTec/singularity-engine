---
title:  Beta Implementation Plan — Hermes as a Morpheus Node
status: active
date:   2026-05-28
scope:  Hermes CRUD UI engine as a morpheus node — G1 through G8 (G9 superseded by the EntityClass-management beta)
parent: alpha_implementation_plan.md
phases:
  - G1 — executed 2026-05-27 (Hermes node + index mode)
  - G2 — executed 2026-05-27 (view mode)
  - G3 — executed 2026-05-28 (headers + active selection)
  - G4 — executed 2026-05-28 (edit mode; see archive/gamma_g4_sketch.md)
  - G5 — executed 2026-05-28 (validation + status)
  - G6 — executed 2026-05-28 (success/error templates + (mode × status) dispatch)
  - G7 — executed 2026-05-28 (create mode + displayConditions + rail entry pivot)
  - G8 — executed 2026-05-28 (delete mode + confirm sub-state + status screens)
  - G9 — superseded 2026-05-28 (second Hermes instance for Attribute now lives inside the EntityClass-management beta's per-class management surface — see D8)
---

# Beta Implementation Plan — Hermes as a Morpheus Node

*Amended 2026-05-29 (development/ level re-map): this plan is a **beta** — a direct division of alpha (a sibling of the other subsystem betas: Hermes, EntityClass-management, Chronos, World-OOP-tree). An earlier same-day pass mislabeled these as gammas under a hollow "phase-3" container beta; the container was removed and the four re-parented to alpha. Level is graph position (distance from root), not the kind of thing. Phase IDs (G*) kept as historical git-commit labels. See README.md + plans_index.md.*

*Amended 2026-06-02 (new engine capability — data-driven select options): the Composition beta's C3 added one structural Hermes-engine capability (app-level; morpheus-core untouched) — `getVisibleInputElements` now resolves `dynamicOptions` selects at render time via a **SYNCHRONOUS `resolveFieldOptions` coreFunction** (so a select's options can come from live domain state, e.g. the entity-class list for the composition sub-class picker, instead of a baked enum), plus a `created?.id` fallback in `createResource` for **server-derived ids** (no client `id` field). Both backward-compatible. Landed athene `89826c4`; reusable by the upcoming Relations + Taxonomies pickers. (A future "Gamma-Inputs" child, if drafted, would own the input/renderer catalog incl. this.)*

**Companion to:** [archive/beta_implementation_plan.md](archive/beta_implementation_plan.md), [conceptual-deep-dive.md](../notes/conceptual-deep-dive.md)
**Source material:** `content-management-hub/systems/hermes/` (the existing React-context-based CRUD framework — see Hermes synthesis in chat memory or rederive from `systems/hermes/Hermes.jsx`, `HermesContext.jsx`, `HermesInner.jsx`, `defaultConfig.jsx`, `helpers.jsx`, `validation.jsx`).

*Amended 2026-05-28: G1–G6 landed; signal vocabulary refined post-T6 to `mode` / `status` (was `displayMode` / `actionState`); WorkingCopy class renamed to EditingDraft. References below kept as historical; current code uses the new names. Architecture target also evolved through theta T1–T7 (OOP migration deleted post-execution) — modules now reach state through Hermes orchestrator + sub-entity moduleProps rather than raw signal reads.*

*Amended 2026-05-28: G6 landed alongside a module-folder restructure — all modules moved from `nodes/Hermes/` into `nodes/Hermes/modules/`, configured via `config.defaultPaths.modules: '/modules'`. Top-level Hermes/ now reads as `inc/` (OOP layer) + `modules/` (UI) + `Hermes.node.jsx` (declarations). Not in the original plan; pure structural improvement.*

*Amended 2026-05-28 (G6 implementation note): `Hermes.saveResource()` on success now re-seeds the EditingDraft from the now-fresh canonical and sets `status='success'` (stays in edit mode); EditOnSuccess provides "Continue editing" / "Back to view" affordances. This diverged from the original beta plan's brief description: rather than the kernel methods setting `actionState: 'success'` and the user being auto-flipped to view mode, the user now consciously chooses the next step. Reflects the post-T7 reality where saveResource is a single orchestrator method composing four sub-entities.*

---

## Why this exists

Every domain primitive in our conceptual model — Entity Class, Content Object, Class Attribute, Class Trait, Composition Directive, Class Relation, Class Taxonomy — needs a CRUD interface in Athene. In CMH today, all seven of them sit on top of a single shared engine called **Hermes**: a declarative React-context-based framework that renders the whole resource-management lifecycle (index → view → edit → create → delete, with success/error/confirm intermediate states) from a config object.

This beta ports that engine to morpheus. When it's done, every entity-class-explorer-shaped view in Athene gets built by mounting `<Node id="Hermes" instance="X" />` with a per-resource config — no duplication, one engine, seven (and growing) consumers.

It's deliberately one of the most substantial pieces of this rewrite: Hermes is ~35 files in CMH with non-trivial state, validation, conditional display, and template composition. We do it slowly — one displayMode per phase — to keep each step shippable in isolation.

---

## Architectural target (provisional)

The morpheus shape mirrors the CMH shape but uses native morpheus primitives instead of React context:

```
Hermes node
├── signals          ← the state machine that HermesProvider owned
│   ├── displayMode             ('index' | 'view' | 'edit' | 'create' | 'delete')
│   ├── actionState             ('normal' | 'evaluate' | 'success' | 'error' | 'confirm')
│   ├── selectedResourceId
│   ├── indexData               (array of list rows)
│   ├── singleResourceData      (canonical fetched record)
│   ├── singleResourceDataWorkingCopy
│   ├── singleResourceDataEvaluation   (field-keyed errors)
│   ├── codeEditorValidationData       (for embedded code-editor diagnostics)
│   ├── loadingResource
│   ├── resourceError
│   └── systemMessage
│
├── kernel methods   ← the verb vocabulary children call (functions.* in CMH)
│   ├── enterIndexMode / enterViewMode / enterEditMode / enterCreateMode / showConfirmDelete
│   ├── handleSelectResource(id)
│   ├── updateWorkingCopyField(fieldId, value)
│   ├── fetchIndex / fetchSingle           (delegates to per-instance coreFunctions)
│   ├── createResource / updateResource / deleteResource
│   ├── evaluateWorkingCopy                (validation; field-keyed error map)
│   ├── setSystemMessage / setActionState
│   └── handleCodeEditorEvaluationDataChange
│
├── coreFunctions    ← instance-overridable async actions (the CRUD I/O)
│   ├── fetchIndex(kernel)         → array of {id, ...listFields}
│   ├── fetchSingle(kernel, id)    → resource record
│   ├── createResource(kernel, values)
│   ├── updateResource(kernel, id, values)
│   └── deleteResource(kernel, id)
│
├── options          ← instance-overridable behavioral toggles
│   ├── operationMode               ('view' | 'manage')
│   ├── remoteResourceIdGeneration  (bool)
│   ├── showTopbar                  (bool)
│   └── ... (others as we encounter them)
│
├── coreData         ← per-instance resource description (host-supplied)
│   ├── resourceCollectionMeta      ({ collectionId, singular, plural, resourceLabel })
│   ├── resourceClassMeta           ({ id, singular, plural })
│   ├── inputElements               ({ [fieldId]: { label, inputType, constraints, displayConditions, refreshes, ... } })
│   └── (templates registry — see below)
│
├── modules          ← shared across instances
│   ├── Root                        (layout shell — resource list + content body)
│   ├── ResourceList                (left rail)
│   ├── ContentBody                 (the displayMode × actionState dispatcher)
│   └── one body module per (displayMode, actionState) cell
│
└── components       ← shared, framework-free input renderers
    ├── HermesInput                 (the polymorphic dispatcher)
    ├── HermesSimpleInput / HermesSelect / HermesRichText / BooleanCheckbox / ...
    └── (one per inputType, ported progressively)
```

**Per-instance "templates" pattern.** Morpheus instances cannot override `modules` (per Guide 10), so we can't do CMH's "swap the entire EditResource template" the same way. Translation:

- Default body modules ship with the Hermes node.
- A host that needs a custom body for one display mode declares a custom component (registered on the Hermes node) and overrides the per-instance `coreData.templates` map (e.g. `templates.edit = 'MyCustomEditBody'`). The body module resolves "which component renders for the current displayMode" through that map.

This pushes the override seam from "swap the module" to "swap the component the module renders." Cleaner with morpheus's grain — and the instance system already supports `coreData` overrides cleanly.

**Why a single Hermes node with instances, not many nodes.** Hermes's behavior is identical across resources; only the data and the async actions differ. That maps exactly to morpheus's instance system. One node, N named instances (`EntityClass`, `Attribute`, `Trait`, `CompositionDirective`, `Relation`, `Taxonomy`, `ContentObject`). Each gets independent signal state — Edit-mode-in-EntityClass doesn't bleed into Edit-mode-in-Attribute.

---

## What this beta does NOT do

- No port of all 13 input element types in one phase. Start with `text`; add others progressively as later phases demand them (`richText`, `select`, `comboBox`, `booleanCheckbox`, `radioButtons`, `dynamicList`, `jsonEditor`, `staticText`, `simpleInput`-variants, calendar pickers).
- No port of all 7 manager families at once. Start with **Entity Class** (the resource we already proved end-to-end in beta B5). Add a second instance (probably **Class Attribute**) only when the first is fully functional, to prove the instance pattern carries.
- No topbar templates yet. The CMH default config already has `showTopbar: false`; we keep that as the morpheus default and skip the entire `topbar-templates/` tree for now.
- No fancy resource-list item rendering (selection highlights, search/filter, ordering). Bare list first; styling+features later.
- No code editor / JSON editor input types. They carry their own diagnostic pipeline (`codeEditorValidationData`); deferred until after edit+create modes are solid.
- No writes against Apollo. Read paths only until G3+ explicitly opens write phases.
- No deletion of the existing `EntityClassExplorer` node until G2 demonstrably renders the same surface. Once it does, EntityClassExplorer goes away.

---

## Phased deliverables

Each phase is independently shippable. The Electron app keeps running between phases; new functionality opt-in via the Hermes instance(s) we've registered so far.

### G1 — Hermes node + Index mode (view-only)

**Goal:** A `Hermes` node that, configured as a `EntityClass` instance, renders the same entity-class list EntityClassExplorer renders today — but through the new generic engine.

**Work:**

1. Create `nodes/Hermes/Hermes.node.jsx`:
   - **Signals** (minimum needed): `displayMode` (default `'index'`), `selectedResourceId`, `indexData` (array, default `[]`), `loadingResource`, `resourceError`.
   - **coreFunctions**: `fetchIndex(kernel)` — default no-op throwing "no fetcher configured".
   - **coreData**: `resourceCollectionMeta`, `resourceClassMeta` — default placeholders.
   - **Kernel methods**: `loadIndex()` — sets `loadingResource: true`, calls `callCoreFunction('fetchIndex')`, copies result into `indexData` signal, clears `loadingResource`. Catches → `resourceError`.
   - **hooks.nodeDidMount**: `await kernel.loadIndex()`.
   - **modules**: `Root` (root), `ResourceList`, `ContentBody`, `IndexBody` (just renders `indexData` as a list).
2. Create the four module files in `nodes/Hermes/`:
   - `Root.jsx` — flex layout: `<Module id="ResourceList" />` + `<Module id="ContentBody" />`.
   - `ResourceList.jsx` — reads `indexData` from signals, renders one row per item.
   - `ContentBody.jsx` — reads `displayMode`, conditionally renders `<Module id="IndexBody" />` (G1 only has index; G2 adds the dispatch table).
   - `IndexBody.jsx` — renders a "(N) items" header above the list (the list lives in `ResourceList` for now; `IndexBody` is initially almost empty but earns its keep in G2+).
3. Register the `EntityClass` instance in `Hermes.node.jsx`:
   ```js
   instances: {
     EntityClass: {
       coreData: {
         resourceCollectionMeta: { collectionId: 'content_class', singular: 'Entity Class', plural: 'Entity Classes' },
         resourceClassMeta:      { id: 'content_class', singular: 'Entity Class', plural: 'Entity Classes' },
       },
       coreFunctions: {
         fetchIndex: async (kernel) => {
           await kernel.app.athene.entityClasses.loadAll();
           return kernel.app.athene.entityClasses.getAll();
         },
       },
     },
   },
   ```
4. Update `app.js`: register `Hermes` node, make `EntityClassExplorer` no longer root, make Hermes root rendering `instance="EntityClass"`. **Don't delete EntityClassExplorer yet** — keep it around as the reference behavior to compare against.
5. Style hookup: reuse the existing `_entity-class-explorer.scss` brand header at the app level; add a small `_hermes.scss` for the Hermes-specific layout (list rail + content body).

**Acceptance:**

- Athene launches, the Hermes node mounts as root with `instance="EntityClass"`.
- The list of entity classes renders, sourced through `coreFunction.fetchIndex` (which delegates to `EntityClasses.loadAll/getAll`).
- No `Error:userCodeError` or `Error:apiMisuse` in the diagnostics timeline.
- The screen looks visually equivalent to EntityClassExplorer's list (same brand header, same row treatment).

---

### G2 — View mode

**Goal:** Click a row → view the single entity class. Adds the canonical fetch-single path.

**Work:**

1. Add signals: `singleResourceData`.
2. Add kernel methods: `handleSelectResource(id)` (sets `selectedResourceId`, flips `displayMode` to `'view'`, calls `loadSingle`), `loadSingle()` (similar to `loadIndex` but uses `selectedResourceId` and a new `fetchSingle` coreFunction), `enterIndexMode()` (back to index).
3. Add coreFunctions: `fetchSingle(kernel, id)` — default no-op; in `EntityClass` instance, delegates to `EntityClasses.getById(id)`.
4. Add `ViewBody.jsx` module — renders the single resource's fields (for EntityClass: title, id, description, lifeCycleStage, etc., flat formatted).
5. Add the `(displayMode)` dispatch table to `ContentBody.jsx` — for G2, just `index` ↔ `view`.
6. ResourceList rows become clickable; active row gets highlighted.
7. Add a back affordance from view → index.

**Acceptance:** Click a class in the list → see its full meta; click "back" → see the list again. Same record on second click (cached in EntityClasses' Map). At this point **delete EntityClassExplorer** — Hermes covers its surface.

---

### G3 — Headers + active selection in list

**Goal:** UX polish on the read-only surface. No state-machine additions.

**Work:**

1. Two new modules: `IndexHeader.jsx`, `ViewHeader.jsx`. Display the collection plural (Index) / singular + resource label (View) as titled headings.
2. `ResourceList`: active-row CSS treatment driven by `selectedResourceId`.
3. SCSS: refine list rail spacing, header typography.

**Acceptance:** Visually crisp index + view; obvious which row is selected; headers match each mode.

---

### G4 — Edit mode (the meaty phase)

**Goal:** Click "Edit" in view mode → land in an edit form whose fields are described by the instance's `inputElements` config. Save → calls a write coreFunction. The working-copy pattern lands here.

**Work:**

1. New signals: `singleResourceDataWorkingCopy`, `singleResourceDataEvaluation` (default `{}`).
2. Add `actionState` signal (default `'normal'`).
3. New kernel methods: `enterEditMode()`, `updateWorkingCopyField(fieldId, value)`, `updateResource()`, `discardChanges()`.
4. Add `coreFunctions.updateResource(kernel, id, values)` — default throws. In `EntityClass` instance, eventually delegates to a new `Apollo.updateEntityClass(id, patch)` method (added as needed).
5. New `EditBody.jsx` module — reads `singleResourceDataWorkingCopy`, renders `<HermesInput />` per field declared in `coreData.inputElements`.
6. New `HermesInput.jsx` component — the polymorphic dispatcher. **G4 supports only `inputType: 'text'`** (one renderer: `HermesSimpleInput.jsx` component).
7. New `EditHeader.jsx` module.
8. Edit/Save/Discard buttons component (subset of CMH's `Buttons.jsx`). Wired to `updateResource()` and `discardChanges()`.
9. Working-copy logic: on `enterEditMode`, copy `singleResourceData` → `singleResourceDataWorkingCopy`. On each `updateWorkingCopyField`, dirty the copy. On save, pass copy to `coreFunctions.updateResource`. On success, refresh canonical via `loadSingle`.

**Acceptance:** A entity class can be edited (e.g. change its singular label), saved → backend reflects the change → view shows the new value. Discard reverts. **Apollo.updateEntityClass is the new piece on Apollo's side**; we discover/add the Laravel endpoint the same way we did `listEntityClasses`.

---

### G5 — Validation + actionState

**Goal:** Save fails gracefully when fields are invalid. Adds the `evaluate` actionState and per-field error display.

**Work:**

1. Implement `evaluateWorkingCopy()` kernel method — port of CMH's `evaluateResource`. Three sources: custom JS constraints (required, etc.), native HTML5 validity API (walk the form's elements), and code-editor markers (deferred — placeholder hook).
2. On save: run `evaluateWorkingCopy` first. If errors, set `actionState: 'evaluate'`, populate `singleResourceDataEvaluation` signal, do **not** call the write coreFunction.
3. `HermesInput`: read `singleResourceDataEvaluation[fieldId]` and render error messages below the field.
4. Constraints supported in G5: `required`, `minLength`, `pattern` (with the named-regex registry from CMH's `customValidationConstraints`).
5. EntityClass instance: add `inputElements` config with constraints (e.g. id is required + pattern `smallLettersAndUnderscores`).

**Acceptance:** Try to save an edit with an empty required field → save blocked, error shown next to the field, no backend call fires. Fix → save proceeds.

---

### G6 — Success / error templates + (mode × status) dispatch — *executed 2026-05-28*

**Goal:** After save, show a confirmation screen; after failure, show an error screen; both with affordance to continue editing or return to view.

**As landed** (terminology updated post-T6 from `displayMode`/`actionState` to `mode`/`status`):

1. Two new modules in `modules/`: `EditOnSuccess.jsx`, `EditOnError.jsx`.
2. `ContentBody` dispatches by `(mode × status)`:
   - `mode='edit' && status='success'` → `EditOnSuccess`
   - `mode='edit' && status='error'` → `EditOnError`
   - `mode='edit'` otherwise → `EditHeader` + `EditBody` (normal/evaluate)
   - (Create/Delete equivalents come with G7/G8.)
3. `Hermes.saveResource()` (the T7 composite) re-seeds the EditingDraft from canonical on success + sets `status='success'`; on catch, sets `systemMessage` + `resourceError` + `status='error'`. Save no longer auto-flips to view mode — the user chooses via the success screen's affordances.
4. `Hermes.setSystemMessage(message)` helper added; `enterEditMode` / `discardChanges` clear it alongside `resourceError`.

**Acceptance landed:** Save succeeds → "Saved." confirmation with "Continue editing" / "Back to view". Save fails (Laravel down, etc.) → error screen with the server message + "Discard" / "Back to editing" / "Try again".

---

### G7 — Create mode — *executed 2026-05-28*

**Goal:** "New resource" entry point. Starts with an empty draft; validation + create lands the new record.

**As landed** (terminology updated post-T6 from `displayMode`/`actionState` to `mode`/`status`):

1. Orchestrator methods on `Hermes`: `enterCreateMode()` (clears draft + selection + validator + status, flips mode to `'create'`), `createResource()` (validate → POST → loadAllResources → set selectedResourceId = `values.id` → loadSingleResource → re-seed draft → `setStatus('success')`; on catch, sets `systemMessage` + `resourceError` + `status='error'`). `discardChanges` made mode-aware (selection-presence check unifies edit-exit + create-cancel + post-create "Back to view").
2. `coreFunctions.createSingleResource` wired on the EntityClass instance, delegating to `EntityClassManager.createSingleEntityClass`, which calls `Apollo.createSingleEntityClass(values)` (`POST /api/content_class/create`) and refreshes the Map. `ResourceIO.createSingleResource` upgraded from stub to real `callCoreFunction` wrapper.
3. New modules: `CreateHeader.jsx`, `CreateOnSuccess.jsx`, `CreateOnError.jsx`. **Deviation:** no separate `CreateBody.jsx` — `EditBody.jsx` is reused for both edit and create modes because the form surface was identical. The mode-based filter is handled by `Hermes.getVisibleInputElements()` so EditBody renders the right fields per mode without knowing which mode it's in. If create + edit ever need divergent body layouts, splitting becomes straightforward.
4. `displayConditions` cascade: implemented as `Hermes.shouldDisplayField(fieldId)` + `Hermes.getVisibleInputElements()`. The pattern uses `config.displayConditions.mode: [...]` — only the mode-based axis for now. Validator + EditingDraft both honor it (invisible fields don't gate saves and don't factor into dirtiness). CMH's `removeConditionalFieldsFromWorkingCopy` not yet ported — EditingDraft.seed iterates all inputElements (cheap; if a config grows enough invisible fields to matter, revisit).
5. After successful create, `selectedResourceId` is set to `values.id` (client-supplied) so the success screen's "Back to view" lands on the freshly-created resource via `discardChanges`'s selection-aware routing. `remoteResourceIdGeneration` not implemented — EntityClass uses client-supplied IDs; future resource types with server-generated IDs will need the coreFunction to return the new id.

**Entry point** (post-implementation tweak): originally a "New {singular}" button in IndexHeader. After the first visual pass, moved to the rail (ResourceList) as a "New {singular}" pivot directly below the Index pivot, sharing the `.hermes-resource-list-pivot` styling. Glyph: `+`. Active when `mode === 'create'`. Reads more cohesively with the rail's existing navigation language.

**Acceptance landed:** Click "New {singular}" pivot → empty form with id + singular + plural + description fields. Fill + click Create → new resource exists in the list and is selected (the freshly-created class's row is highlighted in the rail). Duplicate-id and Laravel-down both route to CreateOnError with the server message; "Try again" retries. Edit mode hides the id field via displayConditions.

---

### G8 — Delete mode — *executed 2026-05-28*

**Goal:** Confirmable delete flow.

**As landed** (terminology updated post-T6 from `displayMode`/`actionState` to `mode`/`status`):

1. Orchestrator methods on `Hermes`: `enterDeleteMode()` (preserves selectedResourceId, sets mode='delete' + status='confirm'), `deleteResource()` composite (DELETE → loadAllResources → setStatus('success'), or 'error' on catch). Cancel-confirm uses the existing `discardChanges` — its selection-presence check routes back to view mode since selectedResourceId is preserved during the confirm state.
2. New modules: `DeleteConfirm.jsx` (replaces the plan's `DeleteConfirmBody.jsx` — single module rather than a header/body split; matches the EditOnSuccess / CreateOnSuccess pattern), `DeleteOnSuccess.jsx`, `DeleteOnError.jsx`. Plus a Delete button added to `ViewHeader.jsx` as the entry point.
3. `coreFunctions.deleteSingleResource` wired on the EntityClass instance → `EntityClassManager.deleteSingleEntityClass` → `Apollo.deleteSingleEntityClass` (`DELETE /api/content_class/delete/{id}`). `ResourceIO.deleteSingleResource` upgraded from stub to real `callCoreFunction` wrapper.
4. **Deviation from the original plan's step 4:** `deleteResource()` deliberately does NOT clear `selectedResourceId` / `singleResourceData` on success. They're left populated so DeleteOnSuccess can name the just-deleted resource ("Entity Class X has been deleted."); the cleanup happens when the user clicks "Back to index" (enterIndexMode handles both signal resets as part of its normal lifecycle). The rail stays correct during the success-screen window because indexData has been refreshed and no row matches the deleted id.

**SCSS additions:** `.hermes-status-screen--confirm` variant (amber/yellow halo — caution without alarm, tonally between cyan-success and red-error) and `.hermes-action-button--danger` variant (red border + red text) for the Delete button and the destructive confirm.

**Acceptance landed:** Click Delete in ViewHeader → DeleteConfirm with the resource name. Cancel → back to view. Confirm → resource gone from rail; DeleteOnSuccess names it; "Back to index" returns to a clean index without the deleted row. Laravel-down rehearsal routes correctly to DeleteOnError with the server message; "Try again" retries.

---

### G9 — Second instance: Class Attribute

> *Superseded 2026-05-28: the second Hermes instance for Attribute does not mount as a sibling of Hermes/EntityClass. Attribute is scoped **inside a specific EntityClass's Attribute Set Version** — so it needs a per-class management surface to host it. That surface, and the Hermes/Attribute instance that lives in it, are now phases of the EntityClass-management beta (`beta_implementation_plan_entity_class_management.md`) (D6 surface shell, D8 Hermes/Attribute). The notes below remain for historical reference.*

**Goal:** Prove the instance pattern by porting a second resource family. We discover the friction (what assumptions about EntityClass don't hold for Attribute) and fix them.

**Work:**

1. Survey CMH's `managers/class-attribute-manager/` for the canonical config (`AttributeManagerUi.jsx`, `AttributeManagementInterface.jsx`).
2. Add Apollo methods for Attribute list/get/create/update/delete.
3. Register `Attribute` instance on the `Hermes` node with its own coreFunctions + coreData (inputElements, meta).
4. Decide on the new entry point: a second root-mountable node? A simple top-level switch? (For G9 the simplest is a temporary debug switch in `Root.jsx` to mount Hermes with one instance or the other; routing comes later.)
5. Fix any architectural assumptions in modules that turn out to be EntityClass-specific.

**Acceptance:** With one debug switch flipped, the Athene window shows Attribute's full CRUD instead of EntityClass's — without any module changes, only instance config differences.

---

## Open design questions, to resolve in-flight

- **Custom body templates per instance.** When a host wants a fully custom edit form (the CMH blueprint shows `ResourceManagementInterface` as an example), we need a clean override seam. Sketched plan: per-instance `coreData.templates = { edit: 'CustomEditBody' }` map + node-level component registry. Concrete shape decides in G4.
- **Where Hermes lives long-term.** Today: `nodes/Hermes/` inside athene's morphSrc. Long-term: probably promoted into morpheus framework itself so multiple apps can mount it. Defer until pattern is solid and a second app needs it.
- **Apollo write surface.** Discovered/added incrementally per phase (G4 → updateEntityClass, G7 → createEntityClass, G8 → deleteEntityClass). Each addition follows the B3 discovery pattern: find or add the Laravel route, document the envelope shape, wire Apollo.
- **Routing for multiple instances.** G9 punts on this with a debug switch. Real per-instance routing (URL → which Hermes instance) comes in a later beta or as a beta-routing slice.
- **Field-refresh cascade.** CMH supports `refreshes: ['dependentFieldId', ...]` to clear dependents on a field's change. Port in G4 if it falls out naturally, otherwise defer.

---

## Coordination with the beta plan

- The beta plan delivered B1–B5: Athene singleton, Apollo (read), EntityClasses registry, EntityClassExplorer view.
- G1 deprecates EntityClassExplorer (replaces it via the Hermes/EntityClass instance) in G2.
- G4 introduces the first **write** path against Apollo, which the beta plan flagged as "Beta-Edit" candidate. This beta absorbs that work — Beta-Edit is no longer a separate plan, it's G4.
- Beta-Detail (clicking a class → detail view) is similarly absorbed into G2–G3.

---

## Next gammas (sketch — not committed)

Once G1–G9 land, candidate next slices:

- **Gamma-Inputs:** flesh out the input-element catalog — `richText`, `select`, `comboBox`, `radioButtons`, `booleanCheckbox`, `dynamicList`, `jsonEditor`, `staticText`. One per slice; pick by which Manager needs it next.
- **Gamma-RemainingManagers:** Trait, CompositionDirective, Relation, Taxonomy, ContentObject — each gets its own instance + Apollo write methods.
- **Gamma-Topbars:** port the topbar-templates tree for hosts that want them visible (`showTopbar: true`).
- **Gamma-Routing:** real URL ↔ instance binding so each manager has its own bookmarkable URL.

Each of these gets its own plan when we're ready.
