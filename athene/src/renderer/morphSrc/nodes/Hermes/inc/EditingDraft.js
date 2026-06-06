// The user's in-progress unsaved edit of a resource. Exists only
// between `Hermes.enterEditMode()` and either `Hermes.discardChanges()`
// or a successful save. Backed by the
// `singleResourceDataWorkingCopy` signal (signal name preserved
// across the WorkingCopy → EditingDraft rename — purely a class /
// vocabulary refinement, not a storage change).
//
// `EditingDraft` owns:
//   - seeding from a Resource on edit-mode entry
//   - per-field updates (with live re-eval gated on status)
//   - clearing on discard / post-save
//   - reads (getFieldValue per field, getAllFieldValues for save payloads)
//   - dirty comparison vs the canonical Resource
//
// Vocabulary note: "EditingDraft" deliberately disambiguates from
// the backend `lifeCycleStage = 'draft'` value, which is the saved-
// resource lifecycle stage and lives at a completely different layer.
// Here "Draft" is qualified by "Editing" — the in-progress, ephemeral
// unsaved version of a resource being modified by the user right now.
//

import HermesChild from './HermesChild.js';

class EditingDraft extends HermesChild {

  // Seeds the draft from a Resource. Iterates the configured
  // `inputElements` keys and pulls each value through
  // `resource.getFieldValue(fieldId)` — the per-resource accessor
  // handles domain getters transparently (EntityClass exposes flat
  // camelCase getters; future resource types may differ). Falls back
  // to '' for missing fields so the form's inputs always have a
  // string to bind to.
  seed( resource ) {
    const inputElements = this.kernel.getCoreData( 'inputElements' ) ?? {};
    const draft = {};
    for ( const fieldId of Object.keys( inputElements ) ) {
      draft[ fieldId ] = resource?.getFieldValue( fieldId ) ?? '';
    }
    this.kernel.setSignal( 'singleResourceDataWorkingCopy', draft );
  }

  // Drops the draft. Canonical singleResourceData is untouched, so a
  // re-render after this reverts the view instantly.
  clear() {
    this.kernel.setSignal( 'singleResourceDataWorkingCopy', {} );
  }

  // Updates one field. Spread + reassign is deliberate — signal
  // change detection compares references, so mutating in place would
  // not propagate to subscribers.
  //
  // Live re-eval: when the user has already attempted save (status
  // === 'evaluate'), each keystroke runs the validation pass again so
  // errors clear as the user fixes them. Before the first attempt we
  // stay quiet — avoids nagging while the user is still composing.
  updateField( fieldId, value ) {
    const inputElements = this.kernel.getCoreData( 'inputElements' ) ?? {};
    const current       = this.kernel.getOptimisticSignal( 'singleResourceDataWorkingCopy' );
    const next          = { ...current, [ fieldId ]: value };

    // Dependent-field cascade. The dependency edge is declared ONCE, on the
    // dependent's `displayConditions.dependsOn` (the same knob that shows/hides
    // it). When the field that just changed is a dependency of some other field,
    // that dependent is a "dependent of this trigger": clear its stale value (a
    // dependent can't keep a value chosen under the old trigger — e.g. a trait
    // picked for the previous sub-class). saveResource already filters hidden
    // fields from a PATCH, but create sends the whole draft, so this clear is what
    // keeps a stale dependent out of a create payload.
    const dependents = Object.keys( inputElements ).filter( id =>
      fieldId in ( inputElements[ id ]?.displayConditions?.dependsOn ?? {} ) );
    for ( const dep of dependents ) { delete next[ dep ]; }

    this.kernel.setSignal( 'singleResourceDataWorkingCopy', next );

    // Re-resolve each ASYNC-options dependent for the new trigger value (loads
    // into dynamicOptionsCache; the render reads it synchronously). Fire-and-
    // forget — the cache write re-renders when it lands.
    for ( const dep of dependents ) {
      if ( inputElements[ dep ]?.dynamicOptionsAsync ) {
        this.hermes.loadAsyncFieldOptions( dep, value );
      }
    }

    if ( this.hermes.statusIs( 'evaluate' ) ) {
      this.hermes.validator.evaluateEditingDraft();
    }
  }

  getFieldValue( fieldId ) {
    const draft = this.kernel.getSignal( 'singleResourceDataWorkingCopy' );
    return draft?.[ fieldId ];
  }

  // Full draft object — used by the save flow to assemble the PATCH
  // payload, and by EditBody for binding inputs when a per-field
  // getFieldValue would be noisier than one snapshot read.
  getAllFieldValues() {
    return this.kernel.getSignal( 'singleResourceDataWorkingCopy' ) ?? {};
  }

  // Dirty = at least one configured field differs between the draft
  // and the canonical resource. Reads canonical through
  // ResourceCollection — domain getters flow transparently. EditHeader
  // calls this to gate the Save button: clean → no point saving (the
  // PATCH would be a server-side no-op, the success/refresh would
  // briefly flash without semantic change).
  isDirty() {
    const inputElements = this.kernel.getCoreData( 'inputElements' ) ?? {};
    const current       = this.hermes.resourceCollection.getCurrentResource();
    const draft         = this.kernel.getSignal( 'singleResourceDataWorkingCopy' ) ?? {};
    return Object.keys( inputElements ).some( fieldId => {
      // Only consider visible fields — invisible ones (e.g. EntityClass's
      // id during edit) carry their seeded canonical value and shouldn't
      // factor into the dirtiness check, in case the seeding logic ever
      // diverges from what the canonical actually exposes.
      if ( ! this.hermes.shouldDisplayField( fieldId ) ) { return false; }
      const canonical = current?.getFieldValue( fieldId ) ?? '';
      const drafted   = draft[ fieldId ] ?? '';
      return canonical !== drafted;
    } );
  }

}

export default EditingDraft;
