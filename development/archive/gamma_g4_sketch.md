---
title:         G4 Sketch — Edit Mode (the meaty one)
status:        executed
date_executed: 2026-05-28
date_archived: 2026-05-28
scope:         G4 phase detail — edit mode + working-copy + first Apollo write path
parent:        ../gamma_implementation_plan_hermes.md (§ G4)
---

# G4 Sketch — Edit Mode (the meaty one)

**Companion to:** [../gamma_implementation_plan_hermes.md](../gamma_implementation_plan_hermes.md) (§ G4)
**Predecessor:** G3 just landed (per-mode header modules, index pivot, list-rail polish).

*Archived (frozen). G4 landed in commit `d3d8ea0`. Subsequent gamma
work (G5) and theta (T1–T7) significantly evolved the architecture:
the inline kernel methods this sketch designed (`enterEditMode`,
`updateWorkingCopyField`, `discardChanges`, `updateResource`) moved
onto the `Hermes` orchestrator + sub-entity classes; `WorkingCopy`
was renamed to `EditingDraft`; the signal names changed
(`displayMode` → `mode`, `actionState` → `status`). The G4 contract
is unchanged — only the file layout and class shape evolved.*

---

## Goal

A user in **view mode** can click an "Edit" affordance, land in a form whose fields are described by the instance's `inputElements` config, change values, and either **Save** (writes through to Apollo → Laravel → DB; canonical state refreshed in `ContentClassManager` and re-rendered) or **Discard** (drops the working copy, returns to view with the original values).

Two big architectural firsts land in this phase:

1. **Working-copy pattern** — `singleResourceData` becomes the canonical (server-truth) signal, and a new `singleResourceDataWorkingCopy` is the dirty, in-progress draft the form binds to. Already declared in `Hermes.node.jsx` signals, just unused until now.
2. **First write path against Apollo** — Hermes calls `coreFunctions.updateSingleResource`, which (for the `ContentClass` instance) delegates to `ContentClassManager.updateSingleContentClass(id, values)`, which calls a new `Apollo.updateSingleContentClass(id, patch)`, which hits `PATCH /api/content_class/update_meta/{id}` on the Laravel side.

Everything below is deliberately the minimum viable edit surface — **no validation, no success/error screens, only `inputType: 'text'`**. G5 (validation + `actionState: 'evaluate'`) and G6 (success/error templates) layer on top of this foundation.

---

## What G4 explicitly does NOT do

- **No validation.** G5 adds `evaluateWorkingCopy()`, `singleResourceDataEvaluation`, and the `actionState: 'evaluate'` state. For G4, the save button is always enabled and clicking it goes straight to the write coreFunction.
- **No success/error screens.** G6 adds the `(displayMode × actionState)` dispatch with `EditOnSuccess` / `EditOnError`. For G4, success → silent refresh + return to view; failure → `resourceError` signal + stay in edit mode (re-using the existing error pattern from `loadSingleResource`).
- **Only `inputType: 'text'`.** `HermesInput.jsx` is built as a polymorphic dispatcher from day one, but the only renderer implemented is `HermesSimpleInput.jsx`. Other input types log a "not supported in G4" warning and render a read-only fallback. (Strict choice; expanding the catalog is Gamma-Inputs work post-G9.)
- **No `displayConditions` cascade.** Every field in `inputElements` renders in edit mode for G4. Per-mode conditional fields (`displayConditions.displayMode: ['create']`, etc.) arrive with G7 (create mode), when the first conditional field shows up.
- **No field-refresh cascade (`refreshes`).** Defer until a field actually needs it.
- **No Apollo response merging.** The Laravel handler returns `data: null` (only a success message). Apollo will re-fetch the single resource after a successful PATCH; we don't try to be clever about merging the patch into the cache. Open question below.

---

## Surface area — what the user does

1. View mode shows a resource (G3 state). The ViewHeader gets a new **"Edit"** affordance on the right side, opposite the back button.
2. Click "Edit" → `displayMode` flips to `'edit'`, working copy is initialized from `singleResourceData`.
3. EditHeader renders: eyebrow + "Editing: {displayName}" heading. Back/Discard button on the left, Save button on the right.
4. EditBody renders one `<HermesInput>` per field declared in the instance's `coreData.inputElements`, each bound to `singleResourceDataWorkingCopy[fieldId]`.
5. Typing into a field calls `_.updateWorkingCopyField(fieldId, value)` → working copy updates → input re-renders with the new value.
6. **Discard** → working copy cleared, `displayMode` → `'view'`. The original values from `singleResourceData` are back on screen instantly (canonical signal was never touched).
7. **Save** → `_.updateResource()`:
   - Calls `coreFunctions.updateSingleResource(kernel, id, workingCopy)`.
   - On resolve: clear working copy, re-fetch single resource (server is now source of truth), flip `displayMode` → `'view'`. The view now reflects the saved values.
   - On reject: set `resourceError`, stay in edit mode so the user can retry or discard.

---

## State machine additions

### Signals — already declared, newly exercised

- `displayMode` — gains a new value: `'edit'`.
- `singleResourceDataWorkingCopy` (object, default `{}`) — dirty draft. Bound to inputs.
- `actionState` (string, default `'normal'`) — declared but unused in G4 (G5+).
- `singleResourceDataEvaluation` (object, default `{}`) — declared but unused in G4 (G5+).

No new signals.

### Kernel methods (Hermes.node.jsx)

```js
// Entry from view mode. Snapshots canonical → working copy and flips
// displayMode. Working copy is a shallow object; ContentClass is flat,
// so shallow is fine for G4 (nested-resource working copies revisit
// in G7+ when richer resource shapes appear).
enterEditMode() {
  const data = this.getOptimisticSignal( 'singleResourceData' );
  this.setSignal( 'singleResourceDataWorkingCopy', { ...( data ?? {} ) } );
  this.setSignal( 'resourceError', '' );
  this.setSignal( 'displayMode', 'edit' );
},

// Patches one field of the working copy. The spread + reassign is
// deliberate — signal change detection compares references, so
// mutating the existing object in place would not propagate.
updateWorkingCopyField( fieldId, value ) {
  const current = this.getOptimisticSignal( 'singleResourceDataWorkingCopy' );
  this.setSignal( 'singleResourceDataWorkingCopy', { ...current, [ fieldId ]: value } );
},

// Drops the working copy, returns to view. Canonical was never
// touched, so the view re-renders with the original values.
discardChanges() {
  this.setSignal( 'singleResourceDataWorkingCopy', {} );
  this.setSignal( 'resourceError', '' );
  this.setSignal( 'displayMode', 'view' );
},

// The write. G4 does no validation — straight to the coreFunction.
// On success, refresh canonical via loadSingleResource (so the view
// shows server truth, including any server-side computed fields like
// updatedAt). On failure, stay in edit mode so the user can retry.
async updateResource() {
  const id     = this.getOptimisticSignal( 'selectedResourceId' );
  const values = this.getOptimisticSignal( 'singleResourceDataWorkingCopy' );
  if ( ! id ) { return; }
  this.setSignal( 'loadingResource', true );
  this.setSignal( 'resourceError', '' );
  try {
    await this.callCoreFunction( 'updateSingleResource', id, values );
    this.setSignal( 'singleResourceDataWorkingCopy', {} );
    this.setSignal( 'displayMode', 'view' );
    await this.loadSingleResource( id );  // refresh canonical from server
  } catch ( err ) {
    this.setSignal( 'resourceError', err.message || String( err ) );
  } finally {
    this.setSignal( 'loadingResource', false );
  }
},
```

`getOptimisticSignal` is used throughout — the G2 lesson holds (kernel methods that just wrote a signal and then await must read via the optimistic cache, not React state).

### CoreFunctions

`updateSingleResource` is already declared in `coreFunctionSchemas` and the base implementation throws. G4 wires the `ContentClass` instance override:

```js
// In instances.ContentClass.coreFunctions
async updateSingleResource( kernel, id, values ) {
  return kernel.app.athene.contentClassManager.updateSingleContentClass( id, values );
},
```

---

## New layer additions

### Apollo — first write path

Add `updateSingleContentClass(id, patch)` to `app/apollo/Apollo.js`:

```js
// PATCH /api/content_class/update_meta/{id} — `RestApiController::
// update_content_class_meta`. Body is JSON of the patch (subset of
// the editable meta fields). The Laravel handler returns the standard
// envelope with `data: null` on success, so callers MUST re-fetch
// (via getSingleContentClass) if they need the post-save record.
async updateSingleContentClass( id, patch ) {
  const res = await fetch( `${ this.baseUrl }/api/content_class/update_meta/${ id }`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body:    JSON.stringify( patch ),
  } );
  if ( ! res.ok ) {
    throw new Error( `Apollo updateSingleContentClass: HTTP ${ res.status } ${ res.statusText }` );
  }
  const body = await res.json();
  if ( ! body.success ) {
    throw new Error( `Apollo updateSingleContentClass: server reported failure — ${ body.message ?? 'unknown' }` );
  }
  // Server returns `data: null`. No record echoed back — caller refetches.
  return null;
},
```

Also add a single-resource read companion (used by the post-save refresh — Hermes already has `loadSingleResource` calling `fetchSingleResource` from the manager, but the manager currently only reads from its local Map; after a PATCH, the Map is stale until we re-load. See manager section).

```js
// GET /api/content_class/{id} — `RestApiController::get_content_class_data`.
// Single-resource read; same envelope shape as the list endpoint.
async getSingleContentClassData( id ) {
  const res = await fetch( `${ this.baseUrl }/api/content_class/${ id }` );
  if ( ! res.ok ) { throw new Error( `Apollo getSingleContentClassData: HTTP ${ res.status } ${ res.statusText }` ); }
  const body = await res.json();
  if ( ! body.success ) { throw new Error( `Apollo getSingleContentClassData: server reported failure — ${ body.message ?? 'unknown' }` ); }
  return body.data;
},
```

### ContentClassManager — write + refetch

Add `updateSingleContentClass(id, values)`:

```js
// Updates a ContentClass via Apollo + refreshes the Map entry from
// the server. Two round-trips (PATCH then GET) is the conservative
// choice — the alternative (merge `values` locally into the existing
// ContentClass) drifts whenever the server computes derived fields
// (updatedAt, profileImgUrl, lifeCycleStage transitions, etc.).
async updateSingleContentClass( id, values ) {
  await this.athene.apollo.updateSingleContentClass( id, values );
  const fresh = await this.athene.apollo.getSingleContentClassData( id );
  this._classesById.set( id, new ContentClass( fresh ) );
  return this._classesById.get( id );
},
```

`Apollo.getSingleContentClassData` returns the same raw record shape as one entry in the list endpoint's keyed object, so `ContentClass` constructs cleanly from it. **Open question below: confirm the server response shape match.**

---

## Modules

Two new modules. The naming pattern mirrors G3's IndexHeader/IndexBody + ViewHeader/ViewBody.

### `nodes/Hermes/EditHeader.jsx`

```jsx
// Right-pane header when displayMode === 'edit'. Discard / Save
// affordances flank the title block. The eyebrow shows the resource
// class singular; the heading shows "Editing: {displayName}" so the
// user is anchored in which resource they're mutating.

export default function EditHeader( { _ } ) {

  const data       = _.getSignal( 'singleResourceData' );
  const loading    = _.getSignal( 'loadingResource' );
  const classMeta  = _.getCoreData( 'resourceClassMeta' );

  const singular     = classMeta?.singular ?? 'Resource';
  const resourceName = data?.displayName ?? data?.id ?? '—';

  return (
    <header className="hermes-mode-header hermes-mode-header--edit">
      <button
        type      = "button"
        className = "hermes-back-button"
        onClick   = { () => _.discardChanges() }
        disabled  = { loading }
      >
        Discard
      </button>
      <div className="hermes-mode-titling">
        <span className="hermes-mode-eyebrow">Editing { singular }</span>
        <h2 className="dev-heading-alpha">{ resourceName }</h2>
      </div>
      <button
        type      = "button"
        className = "hermes-action-button hermes-action-button--save"
        onClick   = { () => _.updateResource() }
        disabled  = { loading }
      >
        { loading ? 'Saving…' : 'Save' }
      </button>
    </header>
  );
}
```

### `nodes/Hermes/EditBody.jsx`

```jsx
// Right-pane content when displayMode === 'edit'. Iterates the
// instance's `coreData.inputElements` config and renders one
// HermesInput per field, bound to singleResourceDataWorkingCopy.
// Save / Discard live in EditHeader; EditBody is just the form.

export default function EditBody( { _, Component } ) {

  const workingCopy    = _.getSignal( 'singleResourceDataWorkingCopy' );
  const error          = _.getSignal( 'resourceError' );
  const inputElements  = _.getCoreData( 'inputElements' ) ?? {};

  return (
    <div className="hermes-edit-body">

      { error && (
        <div className="morpheus-error-box">
          <span className="morpheus-error-corner" />
          <strong>Save failed</strong>
          <p>{ error }</p>
        </div>
      ) }

      <div className="hermes-edit-fields">
        { Object.entries( inputElements ).map( ( [ fieldId, config ] ) => (
          <Component
            id        = "HermesInput"
            key       = { fieldId }
            fieldId   = { fieldId }
            config    = { config }
            value     = { workingCopy?.[ fieldId ] ?? '' }
            onChange  = { value => _.updateWorkingCopyField( fieldId, value ) }
          />
        ) ) }
      </div>

    </div>
  );
}
```

### ContentBody.jsx — dispatch table extension

```jsx
{ displayMode === 'edit' && (
  <>
    <Module id="EditHeader" />
    <Module id="EditBody"   />
  </>
) }
```

### ViewHeader.jsx — add entry point

Add an "Edit" button on the right side of `.hermes-mode-header--view`. Single line edit; calls `_.enterEditMode()`.

### Modules block in Hermes.node.jsx

```js
modules: {
  Root:         { isRoot: true },
  ResourceList: {},
  ContentBody:  {},
  IndexHeader:  {},
  IndexBody:    {},
  ViewHeader:   {},
  ViewBody:     {},
  EditHeader:   {},  // new
  EditBody:     {},  // new
},
```

---

## Components

Polymorphic input dispatcher + first concrete renderer. **Open question on component location**: globals/components/ (shared) vs node-local. The morpheus framework allows components to live at either level. For G4 I'll **start global** under `globals/components/hermes/` so the layout is obvious and future Manager nodes (if we ever build any outside Hermes) could reuse, but flag this for review — node-local is also defensible if "shared" is overpromising.

### `globals/components/hermes/HermesInput.jsx`

```jsx
// Polymorphic dispatcher. Looks at `config.inputType` and renders the
// right concrete input component. G4 supports only `text`; everything
// else falls through to HermesUnsupportedInput so the gap is visible
// at runtime rather than silently missing.

import HermesSimpleInput      from './HermesSimpleInput.jsx';
import HermesUnsupportedInput from './HermesUnsupportedInput.jsx';

export default function HermesInput( { fieldId, config, value, onChange } ) {
  switch ( config.inputType ) {
    case 'text':
      return <HermesSimpleInput fieldId={ fieldId } config={ config } value={ value } onChange={ onChange } />;
    default:
      return <HermesUnsupportedInput fieldId={ fieldId } config={ config } />;
  }
}
```

### `globals/components/hermes/HermesSimpleInput.jsx`

```jsx
// The `inputType: 'text'` renderer. Single-line input with a label.
// Lifts onChange's `event.target.value` for parent simplicity. Bound
// purely to props — no internal state — so working-copy-as-source-of
// truth is uncontestable.

export default function HermesSimpleInput( { fieldId, config, value, onChange } ) {
  return (
    <div className="hermes-input hermes-input--text">
      <label className="hermes-input-label" htmlFor={ fieldId }>
        { config.label }
      </label>
      <input
        id        = { fieldId }
        type      = "text"
        className = "hermes-input-control"
        value     = { value ?? '' }
        onChange  = { e => onChange( e.target.value ) }
      />
    </div>
  );
}
```

### `globals/components/hermes/HermesUnsupportedInput.jsx`

```jsx
// Read-only fallback for inputTypes G4 doesn't implement. Visible
// surface for the gap — better than a blank space or a silent skip.

export default function HermesUnsupportedInput( { fieldId, config } ) {
  return (
    <div className="hermes-input hermes-input--unsupported">
      <label className="hermes-input-label">{ config.label }</label>
      <div className="hermes-input-unsupported-note">
        Input type <code>{ config.inputType }</code> not supported yet (field <code>{ fieldId }</code>).
      </div>
    </div>
  );
}
```

Register on Hermes.node.jsx via `globalComponents` (or per the morpheus convention used for `SingularityLogoAnimated`).

---

## Per-instance config: ContentClass `inputElements`

The first concrete `inputElements` map. Lives under `instances.ContentClass.coreData.inputElements` in `Hermes.node.jsx`:

```js
inputElements: {
  singular: {
    label:     'Singular label',
    inputType: 'text',
  },
  plural: {
    label:     'Plural label',
    inputType: 'text',
  },
  description: {
    label:     'Description',
    inputType: 'text',  // upgrade to 'richText' when that input type lands
  },
},
```

**Excluded from edit (intentional):**
- `id` — primary key; not editable post-creation.
- `lifeCycleStage` — has its own lifecycle workflow on the backend; not a free-text edit.
- `updatedAt`, `profileImgUrl` — server-managed.

**Field-name mapping caution:** the working copy's keys must match what the Laravel handler expects. The list endpoint returns records with snake_case server keys, and `ContentClass.js` maps those to camelCase getters. The Laravel `update_class_meta_data($data)` handler — **open question** — needs verification of which keys it actually accepts. Tentative: snake_case (`singular`, `plural`, `description` — these happen to look the same in both styles; if any camelCase getter has a different underlying key, we surface that in the patch transform).

---

## SCSS additions (sketch)

Already-shared `.hermes-mode-header` chrome carries `--edit` variant. New pieces:

```scss
// Save button — primary affordance, distinct from the secondary
// back-button. Filled treatment with a glow.
.hermes-action-button {
  // base shared with back-button (border, padding, transitions)
}

.hermes-action-button--save {
  background:   linear-gradient(180deg, rgba(14,110,158,.4), rgba(14,110,158,.2));
  border-color: $secondary;
  color:        $secondary;
  text-shadow:  0 0 8px rgba(165,249,252,.4);
  &:hover { /* brighten */ }
  &:disabled { opacity: .5; cursor: not-allowed; }
}

// Input chrome
.hermes-input { display: flex; flex-direction: column; gap: .35rem; margin-bottom: 1rem; }
.hermes-input-label { /* eyebrow-style label */ }
.hermes-input-control {
  background:   rgba(0, 12, 21, .7);
  border:       1px solid $secondary-beta;
  border-radius: .15rem;
  color:        $secondary;
  padding:      .5rem .65rem;
  font-size:    .9rem;
  &:focus { border-color: $secondary; outline: none; box-shadow: 0 0 0 2px rgba(165,249,252,.15); }
}
```

---

## Acceptance criteria

- From view mode, click "Edit" → land in edit mode with `singular`, `plural`, `description` pre-filled from the canonical record.
- Type into any field → only that field's working-copy value updates; the others are untouched; the view (when returned to) is unchanged until save.
- Click **Discard** → return to view with original values; no network call fires.
- Click **Save** → `PATCH /api/content_class/update_meta/{id}` lands; on 2xx + `success: true`, the working copy clears, `displayMode` flips to view, the view re-renders with the server-fresh record (the manager's Map entry is now post-PATCH).
- Click **Save** with the Laravel server down → save fails; user stays in edit mode; `resourceError` shows the failure; working copy is preserved; clicking Save again retries.
- The list rail's row label updates after save (the `displayName` derives from the new `singular`).
- Diagnostics show no `Error:userCodeError` / `Error:apiMisuse` / `Error:frameworkFault` for the round-trip.

---

## Open questions — resolve before / during implementation

1. **`Apollo.getSingleContentClassData` response shape.** Is the single-resource GET's `data` shape identical to one entry of the list endpoint's keyed object? If yes, `new ContentClass( fresh )` just works. If the single endpoint returns a different envelope (e.g., wraps in `{ core, life_cycle_stage, ... }` slightly differently), the manager's refetch path adapts. **Action:** quick `curl http://localhost:8000/api/content_class/<id>` during G4 to verify before wiring the manager.

2. **PATCH payload key naming.** Does `update_class_meta_data($data)` expect snake_case keys (`life_cycle_stage`) or camelCase (`lifeCycleStage`)? Tentative answer: snake_case, matching the rest of the controller surface. For the three G4 fields (singular, plural, description), the names are the same in either style — only matters when we expand the editable surface. **Action:** read `ContentClass::update_class_meta_data` on the Laravel side; document the contract in the Apollo method's doc comment.

3. **Where do Hermes components live — `globals/components/hermes/` or `nodes/Hermes/components/`?** Global makes them shareable beyond Hermes; node-local keeps Hermes's surface area self-contained. The sketch above leans global, but node-local is also defensible. **Action:** pick one in advance and stick with it; revisit when (and if) a second engine wants the same input renderers.

4. **`Component` injection in modules.** Modules in morpheus receive `Component` to render registered components, parallel to `Module`. Verify this works for global components — the existing `SingularityLogoAnimated` is rendered from `Root.jsx` (a wrapper node), confirming the pattern, but EditBody is mounting components in a loop. Should be fine, but flag if any morpheus-side adjustment surfaces.

5. **Save button placement.** Sketch has Discard + Save in EditHeader. Alternative: Save in EditHeader (primary affordance), Discard at the bottom of EditBody as a secondary affordance. CMH had buttons together in a `Buttons.jsx` slot below the form. **Action:** start with both in EditHeader (symmetric to ViewHeader's Back + future Edit); if it feels cramped, promote Buttons to its own module in G5.

6. **`enterEditMode` accessibility from non-view states.** G4 surfaces the entry point only from ViewHeader (so you must view a resource before editing it). Should it also be reachable from index mode (e.g., "edit" affordance on each list row)? **Decision:** no for G4 — the row-level affordance lives in the rail and the rail's job is selection. Once view mode is entered, edit is one click away. Keeps the surface narrow.

7. **Optimistic UI for the rail's row label.** After Save, the rail's row name reflects the new singular only once `loadSingleResource` completes (and even then, only if we also reload `indexData`). G4 acceptance: row label updates correctly. **Implementation choice:** after a successful update, call `kernel.loadAllResources()` in addition to `loadSingleResource()` to refresh the rail. Two round-trips post-save (single + all) is fine at this scale; revisit if/when it becomes noticeable.

---

## Implementation order (proposed)

A single G4 PR / commit, but worked in this order so each step is independently testable:

1. **Apollo write + refetch methods.** Add `updateSingleContentClass` and `getSingleContentClassData` to `Apollo.js`. Smoke-test from the browser console: `app.athene.apollo.updateSingleContentClass('plugin', { description: 'updated via Apollo' })` then `app.athene.apollo.getSingleContentClassData('plugin')`.
2. **Manager method.** Add `ContentClassManager.updateSingleContentClass`. Confirm Map entry is replaced after a manual call.
3. **CoreFunction override.** Wire `instances.ContentClass.coreFunctions.updateSingleResource` to the manager. No UI yet — call from console: `app.kernel.getNodeInstance('Hermes', 'ContentClass').callCoreFunction('updateSingleResource', 'plugin', { description: 'updated via Hermes' })`.
4. **Kernel methods.** Add `enterEditMode`, `updateWorkingCopyField`, `discardChanges`, `updateResource`.
5. **Input components.** Create `HermesInput`, `HermesSimpleInput`, `HermesUnsupportedInput`. Stub them into the global component registry.
6. **EditHeader + EditBody modules.** Register in `modules`.
7. **ContentBody dispatch.** Add the `'edit'` case.
8. **ViewHeader entry.** Add the "Edit" button.
9. **`inputElements` config on `ContentClass` instance.**
10. **SCSS.** Edit-form chrome + Save button treatment.
11. **End-to-end check + diagnostics review.**

Each step lands without breaking prior gammas (index + view still work the whole time).

---

## Cross-links

- Companion gamma plan: [gamma_implementation_plan_hermes.md](../gamma_implementation_plan_hermes.md) (§ G4)
- CMH's analog for working-copy semantics: `content-management-hub/systems/hermes/HermesProvider.jsx` (working-copy state lived in `useState` + the `evaluateResource` flow)
- Reference inputElements map (Attribute manager): `content-management-hub/managers/shared/attributeInputElements.jsx` (shape we mirror; G4 supports only the `text` rows)
- Laravel handler: `content-creation-center/app/Http/Controllers/RestApiController.php::update_content_class_meta` (route: `PATCH /api/content_class/update_meta/{content_class_id}`)
