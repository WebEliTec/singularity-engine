// Right-pane content when (mode === 'edit') && (status === 'success').
// Rendered by ContentBody.jsx after a successful save instead of the
// normal EditHeader + EditBody pair. Tells the user the save landed
// + offers two affordances: continue editing the same resource (status
// → 'normal' lands them back on the normal edit screen with the draft
// already re-seeded from the now-canonical post-save values) or
// return to the detail view.

export default function EditOnSuccess( { _, Hermes, ResourceCollection } ) {

  const current   = ResourceCollection.getCurrentResource();
  const classMeta = _.getCoreData( 'resourceClassMeta' );

  const singular     = classMeta?.singular ?? 'Resource';
  const resourceName = current?.getDisplayName() || '—';

  return (
    <div className="hermes-status-screen hermes-status-screen--success">

      <header className="hermes-status-header">
        <span className="hermes-status-icon" aria-hidden="true">✓</span>
        <h2 className="dev-heading-alpha">Saved</h2>
      </header>

      <p className="hermes-status-message">
        Changes to { singular } <strong>{ resourceName }</strong> have been
        saved.
      </p>

      <div className="hermes-status-actions">
        <button
          type      = "button"
          className = "hermes-back-button"
          onClick   = { () => Hermes.setStatus( 'normal' ) }
        >
          Continue editing
        </button>
        <button
          type      = "button"
          className = "hermes-action-button"
          onClick   = { () => Hermes.discardChanges() }
        >
          Back to view
        </button>
      </div>

    </div>
  );
}
