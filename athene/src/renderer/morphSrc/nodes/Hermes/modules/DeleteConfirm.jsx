// Right-pane content when (mode === 'delete') && (status === 'confirm').
// The user has clicked Delete in ViewHeader and now sees a
// confirmation screen asking them to commit to the destructive
// action before anything goes over the wire.
//
// Cancel → discardChanges (mode-aware exit; selectedResourceId is
// set during delete-confirm so this returns to view mode showing
// the resource the user was about to delete, status reset to normal).
//
// Confirm → Hermes.deleteResource() runs the DELETE + refresh-list,
// landing on DeleteOnSuccess (or DeleteOnError on a thrown failure).

export default function DeleteConfirm( { _, Hermes, ResourceCollection } ) {

  const current   = ResourceCollection.getCurrentResource();
  const loading   = _.getSignal( 'loadingResource' );
  const classMeta = _.getCoreData( 'resourceClassMeta' );

  const singular     = classMeta?.singular ?? 'Resource';
  const resourceName = current?.getDisplayName() || '—';

  return (
    <div className="hermes-status-screen hermes-status-screen--confirm">

      <header className="hermes-status-header">
        <span className="hermes-status-icon" aria-hidden="true">⚠</span>
        <h2 className="dev-heading-alpha">Delete { singular }?</h2>
      </header>

      <p className="hermes-status-message">
        Are you sure you want to delete { singular.toLowerCase() }
        { ' ' }<strong>{ resourceName }</strong>? This cannot be undone.
      </p>

      <div className="hermes-status-actions">
        <button
          type      = "button"
          className = "hermes-back-button"
          onClick   = { () => Hermes.discardChanges() }
          disabled  = { loading }
        >
          Cancel
        </button>
        <button
          type      = "button"
          className = "hermes-action-button hermes-action-button--danger"
          onClick   = { () => Hermes.deleteResource() }
          disabled  = { loading }
        >
          { loading ? 'Deleting…' : 'Delete' }
        </button>
      </div>

    </div>
  );
}
