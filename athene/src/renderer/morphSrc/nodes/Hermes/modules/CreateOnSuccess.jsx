// Right-pane content when (mode === 'create') && (status === 'success').
// Rendered after a successful POST. By the time we land here the new
// resource has been fetched and is the current selection, so:
//   - "Back to view" lands on the freshly-created resource's detail
//     view (discardChanges' selection check routes to view-mode).
//   - "Create another" clears the draft + stays in create mode for
//     the next entry.

export default function CreateOnSuccess( { _, Hermes, ResourceCollection } ) {

  const current   = ResourceCollection.getCurrentResource();
  const classMeta = _.getCoreData( 'resourceClassMeta' );

  const singular     = classMeta?.singular ?? 'Resource';
  const resourceName = current?.getDisplayName() || '—';

  return (
    <div className="hermes-status-screen hermes-status-screen--success">

      <header className="hermes-status-header">
        <span className="hermes-status-icon" aria-hidden="true">✓</span>
        <h2 className="dev-heading-alpha">Created</h2>
      </header>

      <p className="hermes-status-message">
        { singular } <strong>{ resourceName }</strong> has been created.
      </p>

      <div className="hermes-status-actions">
        <button
          type      = "button"
          className = "hermes-back-button"
          onClick   = { () => Hermes.enterCreateMode() }
        >
          Create another
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
