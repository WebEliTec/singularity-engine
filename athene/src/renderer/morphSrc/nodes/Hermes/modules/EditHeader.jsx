// Right-pane header when mode === 'edit'. Discard / Save
// affordances flank the title block. The eyebrow shows the resource
// class singular; the heading shows the resource's displayName so the
// user is anchored in which resource they're mutating.
//
// G4 has no validation, so Save is always enabled (unless a save is
// in flight — `loadingResource` gates both buttons to prevent double
// submits and ambiguous mid-flight Discard).

export default function EditHeader( { _, Hermes, ResourceCollection, EditingDraft } ) {

  const current   = ResourceCollection.getCurrentResource();
  const loading   = _.getSignal( 'loadingResource' );
  const classMeta = _.getCoreData( 'resourceClassMeta' );

  const singular     = classMeta?.singular ?? 'Resource';
  const resourceName = current?.getDisplayName() || '—';

  // Dirty = at least one configured field differs between the editing
  // draft and the canonical resource. Save disabled when clean — a
  // no-op PATCH is wasted bandwidth and the success/refresh cycle
  // would briefly flash without semantic change.
  const isDirty = EditingDraft.isDirty();

  return (
    <header className="hermes-mode-header hermes-mode-header--edit">

      <div className="hermes-mode-titling">
        <span className="hermes-mode-eyebrow">Editing { singular }</span>
        <h2 className="dev-heading-alpha">{ resourceName }</h2>
      </div>

      <div className="hermes-mode-actions">
        <button
          type      = "button"
          className = "hermes-back-button"
          onClick   = { () => Hermes.discardChanges() }
          disabled  = { loading }
        >
          Discard
        </button>
        <button
          type      = "button"
          className = "hermes-action-button hermes-action-button--save"
          onClick   = { () => Hermes.saveResource() }
          disabled  = { loading || ! isDirty }
        >
          { loading ? 'Saving…' : 'Save' }
        </button>
      </div>

    </header>
  );
}
