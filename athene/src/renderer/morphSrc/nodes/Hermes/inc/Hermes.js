// Top-level orchestrator for the Hermes CRUD UI engine. Constructed
// once per node-mount in `Hermes.node.jsx` via the
// `kernelDidInitialize` hook (`kernel.hermes = new Hermes(kernel)`).
// Holds the sub-entity wiring + the mode/status state-machine
// accessors + the cross-entity transition verbs.
//
// Mirrors `Jung` in some-morpheus-based-app — the same OOP-via-`/inc/`
// pattern applied at production scale.
//
// Signal vocabulary (T6):
//   - `mode`   ('index' | 'view' | 'edit' | 'create' | 'delete')
//   - `status` ('normal' | 'evaluate' | 'success' | 'error' | 'confirm')
//
// State-machine accessors + transition verbs live on `Hermes` itself
// (not in a sub-class) because:
//   - Every transition that DOES something (enterEditMode,
//     discardChanges, selectResource) coordinates across sub-entities
//     (EditingDraft + Validator + ResourceIO). Per the "coordination
//     lives on the orchestrator" principle, the orchestrator owns them.
//   - The accessors (setStatus, modeIs, statusIs) are too thin to
//     warrant their own home; keeping them next to the verbs that
//     use them keeps the file cohesive.
//
// If `Hermes` later grows past ~15 methods (G6+ creates more transition
// verbs), splitting out a `Session` sub-class becomes worth it. Until
// then: one orchestrator.

import ResourceCollection from './ResourceCollection.js';
import EditingDraft       from './EditingDraft.js';
import Validator          from './Validator.js';
import ResourceIO         from './ResourceIO.js';

class Hermes {

  constructor( kernel ) {
    this.kernel = kernel;
    this.init();
  }

  init() {
    this.resourceCollection = new ResourceCollection( this );
    this.editingDraft       = new EditingDraft      ( this );
    this.validator          = new Validator         ( this );
    this.resourceIO         = new ResourceIO        ( this );
  }

  /* ────────────────────────────────────────────────────────────
     State-machine accessors
     ──────────────────────────────────────────────────────────── */

  modeIs( mode ) {
    return this.kernel.getSignal( 'mode' ) === mode;
  }

  statusIs( status ) {
    return this.kernel.getSignal( 'status' ) === status;
  }

  setStatus( status ) {
    this.kernel.setSignal( 'status', status );
  }

  // Server-side message for the user — typically the verbatim error
  // string from a failed save (`saveResource`'s catch). Set to '' to
  // clear. Read on the EditOnError screen + future success/confirm
  // screens that want to surface a server message.
  setSystemMessage( message ) {
    this.kernel.setSignal( 'systemMessage', message );
  }

  /* ────────────────────────────────────────────────────────────
     Mode-transition verbs

     Each one writes the `mode` signal plus whatever else needs to
     change in the same atomic transition. Coordinating sub-entities
     (EditingDraft seed / clear, Validator reset) happens here — that's
     the whole reason these live on the orchestrator.
     ──────────────────────────────────────────────────────────── */

  // Back to the overview list. Clears selection so subsequent view
  // mode entries from this state start from a clean slate.
  enterIndexMode() {
    this.kernel.setSignal( 'selectedResourceId', '' );
    this.kernel.setSignal( 'singleResourceData', null );
    this.kernel.setSignal( 'mode', 'index' );
  }

  // Re-fetches the resource collection from scratch and resets the
  // state-machine to a clean index. Used by athene's "scope changed
  // externally" workaround for epsilon E2 — when Chronos's chip
  // selection flips the workbench's selectedAttributeSetVersionId
  // signal, Athene calls this here instead of relying on a parent-
  // driven `<Node>` re-mount. The re-mount path triggers a known
  // morpheus race (see morpheus-core#26) where the just-unmounted
  // instance's graph slot isn't synchronously freed before the new
  // mount's mayCreateInstance check fires. Until #26 lands, this
  // method is the swap-mechanism that doesn't unmount Hermes at all.
  //
  // Clears status + system message too: any draft edit was tied to
  // the previous scope, and surfacing it after the swap would be
  // confusing. Subsequent loadAllResources picks up the new ASV via
  // the Athene.getSelectedAttributeSetVersionId read in the
  // instance's fetchAllResources coreFunction.
  async refreshScope() {
    this.enterIndexMode();
    this.setStatus( 'normal' );
    this.setSystemMessage( '' );
    this.kernel.setSignal( 'resourceError', '' );
    await this.resourceIO.loadAllResources();
  }

  // Detail view of the currently-selected resource. Called from
  // discardChanges, from updateResource on success, and (future)
  // from post-create / post-delete refresh paths.
  enterViewMode() {
    this.kernel.setSignal( 'mode', 'view' );
  }

  // Edit-mode entry — seeds the editing draft from the canonical
  // resource, clears any prior evaluation state, resets status.
  // The composition (EditingDraft + Validator + signal writes) is the
  // canonical example of orchestrator coordination.
  enterEditMode() {
    this.editingDraft.seed( this.resourceCollection.getCurrentResource() );
    this.validator.clearEvaluation();
    this.setStatus( 'normal' );
    this.kernel.setSignal( 'resourceError', '' );
    this.setSystemMessage( '' );
    this.kernel.setSignal( 'mode', 'edit' );
  }

  // Cancel the editing draft. Clears + resets status + clears errors,
  // then exits to the nearest sensible mode:
  //   - if there's a selected resource, view it (edit-mode exit, or
  //     CreateOnSuccess "Back to view" after we've set the new id);
  //   - otherwise, return to the index (create-mode exit with nothing
  //     yet to view).
  //
  // The selection-presence check unifies the cancel/discard handler
  // across edit + create flows without needing two verbs. Canonical
  // singleResourceData was never touched, so view-mode re-renders
  // with the original values.
  discardChanges() {
    this.editingDraft.clear();
    this.validator.clearEvaluation();
    this.setStatus( 'normal' );
    this.kernel.setSignal( 'resourceError', '' );
    this.setSystemMessage( '' );
    if ( this.kernel.getOptimisticSignal( 'selectedResourceId' ) ) {
      this.enterViewMode();
    } else {
      this.enterIndexMode();
    }
  }

  // Create-mode entry — clears the draft (no canonical to seed from),
  // clears selection (no resource yet), resets status. Behavior
  // symmetric to enterEditMode: editing-draft cleared instead of
  // seeded; selectedResourceId cleared so view-side reads (canonical)
  // start from null until create completes.
  enterCreateMode() {
    this.editingDraft.clear();
    this.validator.clearEvaluation();
    this.setStatus( 'normal' );
    this.kernel.setSignal( 'selectedResourceId', '' );
    this.kernel.setSignal( 'singleResourceData', null );
    this.kernel.setSignal( 'resourceError', '' );
    this.setSystemMessage( '' );
    this.kernel.setSignal( 'mode', 'create' );
  }

  // Delete-mode entry — invoked from ViewHeader's Delete button. The
  // resource being deleted is whatever's currently selected
  // (selectedResourceId is preserved). Sets status='confirm' so the
  // user lands on the DeleteConfirm screen rather than seeing an
  // immediate destructive action. The actual deletion only fires
  // when they click Confirm (deleteResource).
  enterDeleteMode() {
    this.kernel.setSignal( 'resourceError', '' );
    this.setSystemMessage( '' );
    this.setStatus( 'confirm' );
    this.kernel.setSignal( 'mode', 'delete' );
  }

  // Row-click handler from ResourceList. Sets the selection, flips
  // to view mode, triggers the single-resource fetch. Passes the id
  // directly to loadSingleResource to avoid the G2 signal-read timing
  // trap (getSignal returns React-state, not optimistic cache — bare
  // `getSignal('selectedResourceId')` mid-method sees the PRIOR value).
  async selectResource( id ) {
    this.kernel.setSignal( 'selectedResourceId', id );
    this.kernel.setSignal( 'mode', 'view' );
    await this.resourceIO.loadSingleResource( id );
  }

  /* ────────────────────────────────────────────────────────────
     Field-visibility helpers

     The configured `inputElements` carry an optional
     `displayConditions.mode: [...]` array. Only fields whose
     conditions match the current mode appear in the form + get
     validated. Used by EditBody (renders the form) + Validator
     (skips invisible fields during evaluation) + EditingDraft (for
     dirtiness on visible fields only, in future).

     The id field for EntityClass, for example, is create-only —
     `displayConditions: { mode: ['create'] }` — so it never renders
     during edit (the id is immutable post-creation) and never gets
     validated during edit either.
     ──────────────────────────────────────────────────────────── */

  shouldDisplayField( fieldId ) {
    const inputElements = this.kernel.getCoreData( 'inputElements' ) ?? {};
    const config        = inputElements[ fieldId ];
    const conditions    = config?.displayConditions;
    // Mode gate (unchanged): if a mode list is set, the current mode must be in it.
    if ( conditions?.mode && ! conditions.mode.includes( this.kernel.getSignal( 'mode' ) ) ) {
      return false;
    }
    // Cross-field gate (dependent fields): show only when each named sibling field
    // holds an allowed value. `'*'` means "present / non-empty" (so a trait
    // qualifier shows as soon as ANY sub-class is picked, without enumerating
    // every class id — the legacy's brittle spot). AND-combined with the mode
    // gate. Fields with no `dependsOn` are unaffected — fully backward-compatible.
    if ( conditions?.dependsOn ) {
      const draft = this.kernel.getSignal( 'singleResourceDataWorkingCopy' ) ?? {};
      for ( const [ depField, allowed ] of Object.entries( conditions.dependsOn ) ) {
        const v  = draft[ depField ];
        const ok = allowed.includes( '*' ) ? ( v != null && v !== '' ) : allowed.includes( v );
        if ( ! ok ) return false;
      }
    }
    return true;
  }

  // Returns the subset of inputElements visible in the current mode.
  // Preserves declaration order (Object.entries iteration order on
  // the source config).
  getVisibleInputElements() {
    const inputElements = this.kernel.getCoreData( 'inputElements' ) ?? {};
    const visible = {};
    for ( const [ fieldId, config ] of Object.entries( inputElements ) ) {
      if ( ! this.shouldDisplayField( fieldId ) ) { continue; }
      // Data-driven select (C3): a field marked `dynamicOptions` sources its
      // `options` at render time from the instance's `resolveFieldOptions`
      // coreFunction — SYNCHRONOUS (it reads already-warm domain state, e.g. the
      // live entity-class list for the composition sub-class picker), so it slots
      // straight into this synchronous pass with no await. Static selects (a baked
      // `options` array) and every non-select field pass through untouched. This
      // is the one structural Hermes-engine change the Composition slice needs;
      // it's reusable by any future data-sourced select (Relations/Taxonomies).
      if ( config.dynamicOptions ) {
        const options = this.kernel.callCoreFunction( 'resolveFieldOptions', fieldId ) ?? [];
        visible[ fieldId ] = { ...config, options };
      } else if ( config.dynamicOptionsAsync ) {
        // Cold/fetched options for a DEPENDENT select (e.g. the chosen sub-class's
        // traits). The await already ran in loadAsyncFieldOptions (fired from
        // updateField on the trigger change) and landed in the dynamicOptionsCache
        // signal — so the render stays SYNCHRONOUS, just reading the cache entry.
        // optionsLoading / optionsError drive the select's pending + error states.
        const entry = ( this.kernel.getSignal( 'dynamicOptionsCache' ) ?? {} )[ fieldId ];
        visible[ fieldId ] = {
          ...config,
          options:        Array.isArray( entry?.options ) ? entry.options : [],
          optionsLoading: !! entry?.loading,
          optionsError:   entry?.error ?? '',
        };
      } else {
        visible[ fieldId ] = config;
      }
    }
    return visible;
  }

  // Loads a `dynamicOptionsAsync` field's options for a new dependency value
  // (e.g. the traits of the just-chosen sub-class) into the dynamicOptionsCache
  // signal, so getVisibleInputElements reads them synchronously on re-render.
  // Fired (NOT awaited) from EditingDraft.updateField when a dependent's trigger
  // (the field named in its displayConditions.dependsOn) changes. Loading-window
  // shape mirrors ResourceIO.loadAllResources; on fetch
  // failure the cache entry carries `error`, which HermesSelectInput surfaces
  // inline (Daniel's call). Single-entry per field — the latest dependency wins.
  async loadAsyncFieldOptions( fieldId, depValue ) {
    const write = ( entry ) => this.kernel.setSignal(
      'dynamicOptionsCache',
      { ...( this.kernel.getSignal( 'dynamicOptionsCache' ) ?? {} ), [ fieldId ]: entry },
    );
    const current = () => ( this.kernel.getSignal( 'dynamicOptionsCache' ) ?? {} )[ fieldId ];

    // Dependency cleared → empty, no error, not loading.
    if ( depValue == null || depValue === '' ) {
      write( { dep: depValue, options: [], loading: false, error: '' } );
      return;
    }
    // Cache hit for the SAME dependency with no prior error → nothing to do
    // (a prior error re-tries).
    const prior = current();
    if ( prior && prior.dep === depValue && ! prior.error ) { return; }

    write( { dep: depValue, options: [], loading: true, error: '' } );
    try {
      const options = await this.kernel.callCoreFunction( 'resolveFieldOptionsAsync', fieldId, depValue ) ?? [];
      // Guard against out-of-order resolution: only land if this dependency is
      // still the current one (a faster later change must not be clobbered).
      if ( current()?.dep === depValue ) {
        write( { dep: depValue, options, loading: false, error: '' } );
      }
    } catch ( err ) {
      if ( current()?.dep === depValue ) {
        write( { dep: depValue, options: [], loading: false, error: err?.message ?? String( err ) } );
      }
    }
  }

  /* ────────────────────────────────────────────────────────────
     Multi-entity composites

     The canonical "this is what an orchestrator is for" verb:
     coordinates four sub-entities + the state machine in one
     atomic-from-the-caller's-view operation. The Save button calls
     `Hermes.saveResource()` and the whole pipeline runs.
     ──────────────────────────────────────────────────────────── */

  // Validate → PATCH → refresh-list → refresh-single → re-seed draft
  // → set status='success' (or 'error' on a thrown failure). G6
  // changed the success path: instead of jumping straight to view
  // mode, we now stay in edit mode with status='success', which
  // routes ContentBody to the EditOnSuccess module. The user
  // chooses "Back to view" (discardChanges) or "Continue editing"
  // (setStatus('normal')) from there.
  //
  // On validation failure, status='evaluate' and we bail without
  // touching the network. The normal EditHeader+EditBody pair stays
  // mounted and renders inline errors.
  //
  // On network/server failure, status='error' routes ContentBody to
  // EditOnError. The draft + evaluation are preserved so "Back to
  // editing" or "Try again" picks up exactly where the user was.
  //
  // loadingResource is set across the full PATCH → refresh-list →
  // refresh-single sequence so the Save button stays disabled
  // throughout (the inner ResourceIO methods would otherwise toggle
  // it on/off between steps).
  async saveResource() {
    const id = this.kernel.getOptimisticSignal( 'selectedResourceId' );
    if ( ! id ) { return; }

    // PATCH only the fields visible in the current (edit) mode. The create-only
    // `id` is seeded into the draft but must NOT appear in the PATCH body —
    // Apollo's clean contract rejects unknown/immutable fields with a 400.
    const allValues = this.editingDraft.getAllFieldValues();
    const values    = {};
    for ( const fieldId of Object.keys( allValues ) ) {
      if ( this.shouldDisplayField( fieldId ) ) { values[ fieldId ] = allValues[ fieldId ]; }
    }

    const errors = this.validator.evaluateEditingDraft();
    if ( Object.keys( errors ).length > 0 ) {
      this.setStatus( 'evaluate' );
      return;
    }

    this.setStatus( 'normal' );
    this.kernel.setSignal( 'loadingResource', true );
    this.kernel.setSignal( 'resourceError', '' );
    this.setSystemMessage( '' );
    try {
      await this.resourceIO.updateSingleResource( id, values );
      await this.resourceIO.loadAllResources();
      await this.resourceIO.loadSingleResource( id );
      // Re-seed the draft from the now-fresh canonical so isDirty is
      // false going into the success screen — "Continue editing"
      // lands the user on a clean draft aligned with the just-saved
      // server state, ready for further modifications.
      this.editingDraft.seed( this.resourceCollection.getCurrentResource() );
      this.validator.clearEvaluation();
      this.setStatus( 'success' );
    } catch ( err ) {
      const message = err.message || String( err );
      this.kernel.setSignal( 'resourceError', message );
      this.setSystemMessage( message );
      this.setStatus( 'error' );
    } finally {
      this.kernel.setSignal( 'loadingResource', false );
    }
  }

  // Validate → POST → refresh-list → select the new resource →
  // load-single → re-seed draft → set status='success' (or 'error'
  // on a thrown failure). Mirrors saveResource's shape for the
  // create flow.
  //
  // Key differences from saveResource:
  //   - No id input at the start — `values.id` comes from the user
  //     (the id field is required in create-mode inputElements).
  //   - After the POST, `selectedResourceId` is set to the new id so
  //     the CreateOnSuccess screen's "Back to view" affordance lands
  //     on the freshly-created resource (discardChanges' selection
  //     check routes to view-mode rather than index).
  //   - Re-seeds the draft from canonical so isDirty is false going
  //     into success — "Create another" can then clear cleanly via
  //     enterCreateMode.
  async createResource() {
    const values = this.editingDraft.getAllFieldValues();

    const errors = this.validator.evaluateEditingDraft();
    if ( Object.keys( errors ).length > 0 ) {
      this.setStatus( 'evaluate' );
      return;
    }

    this.setStatus( 'normal' );
    this.kernel.setSignal( 'loadingResource', true );
    this.kernel.setSignal( 'resourceError', '' );
    this.setSystemMessage( '' );
    try {
      // createSingleResource returns the created resource. For client-id types
      // (EntityClass / Attribute / Trait) `values.id` is authoritative; for
      // SERVER-DERIVED ids (a Composition Directive's `subClassId[:traitId]`,
      // C3) there is no client id, so fall back to the created resource's own
      // id. Backward-compatible: client-id types still resolve to `values.id`.
      const created = await this.resourceIO.createSingleResource( values );
      await this.resourceIO.loadAllResources();
      const newId = values.id ?? created?.id ?? '';
      this.kernel.setSignal( 'selectedResourceId', newId );
      await this.resourceIO.loadSingleResource( newId );
      this.editingDraft.seed( this.resourceCollection.getCurrentResource() );
      this.validator.clearEvaluation();
      this.setStatus( 'success' );
    } catch ( err ) {
      const message = err.message || String( err );
      this.kernel.setSignal( 'resourceError', message );
      this.setSystemMessage( message );
      this.setStatus( 'error' );
    } finally {
      this.kernel.setSignal( 'loadingResource', false );
    }
  }

  // DELETE → refresh-list → status='success' (or 'error' on a thrown
  // failure). Invoked from the DeleteConfirm screen's Confirm button.
  //
  // Deliberately does NOT clear selectedResourceId / singleResourceData
  // on success — leaves both populated so DeleteOnSuccess can name the
  // just-deleted resource. Cleanup happens when the user clicks
  // "Back to index" (enterIndexMode clears both as part of its normal
  // signal resets).
  //
  // Rail re-renders correctly during the success-screen-lingering
  // window because indexData has been refreshed and the deleted row
  // is gone from it; selectedResourceId pointing at a no-longer-listed
  // id is harmless (no row matches).
  async deleteResource() {
    const id = this.kernel.getOptimisticSignal( 'selectedResourceId' );
    if ( ! id ) { return; }

    this.kernel.setSignal( 'loadingResource', true );
    this.kernel.setSignal( 'resourceError', '' );
    this.setSystemMessage( '' );
    try {
      await this.resourceIO.deleteSingleResource( id );
      await this.resourceIO.loadAllResources();
      this.setStatus( 'success' );
    } catch ( err ) {
      const message = err.message || String( err );
      this.kernel.setSignal( 'resourceError', message );
      this.setSystemMessage( message );
      this.setStatus( 'error' );
    } finally {
      this.kernel.setSignal( 'loadingResource', false );
    }
  }

}

export default Hermes;
